import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Server, 
  Activity, 
  Database, 
  HardDrive, 
  RefreshCcw, 
  Code, 
  Trash2, 
  Terminal as TerminalIcon,
  Settings as SettingsIcon,
  Square,
  Play,
  RotateCcw,
  Box
} from 'lucide-react';
import TerminalView from './components/TerminalView';

const API_URL = '/api';
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTOCOL}//${window.location.host}`;

function App() {
  const [activeTab, setActiveTab] = useState('compute');
  const [projects, setProjects] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [ping, setPing] = useState('...');

  const fetchData = async () => {
    try {
      const start = performance.now();
      const pRes = await axios.get(`${API_URL}/projects?t=${Date.now()}`);
      setProjects(pRes.data.projects);
      
      const sRes = await axios.get(`${API_URL}/stats?t=${Date.now()}`);
      setStats(sRes.data);
      setPing(Math.round(performance.now() - start).toString() + 'ms');
    } catch (e) {
      console.error(e);
      setPing('ERR');
    }
  };

  const handleAction = async (name: string, action: string) => {
    try {
      await axios.post(`${API_URL}/projects/${name}/action`, { action });
      fetchData();
    } catch (e) {
      alert("Action failed: " + action);
    }
  };

  useEffect(() => {
    fetchData();
    const intv = setInterval(fetchData, 2000);
    return () => clearInterval(intv);
  }, []);

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl) return;
    setDeploying(true);
    try {
      await axios.post(`${API_URL}/projects`, { repoUrl });
      setRepoUrl('');
      fetchData();
      setActiveTab('resources');
    } catch (e: any) {
      alert("Deployment failed: " + (e.response?.data?.error || e.message));
    } finally {
      setDeploying(false);
    }
  };

  if (!stats) return <div className="h-screen bg-[#f8f9fa] flex flex-col items-center justify-center font-bold text-[#1a73e8] animate-pulse">
    <Server className="w-12 h-12 mb-4 animate-bounce" />
    <span className="text-xl">Initializing Infrastructure...</span>
  </div>;

  return (
    <div className="flex h-screen bg-[#f8f9fa] text-[#202124] font-['Plus_Jakarta_Sans'] antialiased overflow-hidden">
      {/* Sidebar - Pro Navigation */}
      <aside className="w-64 bg-white border-r border-[#dadce0] flex flex-col shadow-[1px_0_15px_rgba(0,0,0,0.02)] z-10">
        <div className="h-16 flex items-center px-6 border-b border-[#f1f3f4]">
          <div className="flex flex-col">
            <span className="text-[#1a73e8] font-black text-xl flex items-center gap-2 tracking-tighter">
              <Box className="w-6 h-6 fill-[#1a73e8]/10" /> AQUOS
            </span>
            <span className="text-[10px] text-[#5f6368] font-black tracking-[0.1em] uppercase opacity-60 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#34a853] rounded-full"></div> Node Engine v1.2.0
            </span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('compute')}
            className={`w-full p-3 rounded-[16px] flex items-center gap-3 font-bold text-xs transition-all ${activeTab === 'compute' ? 'bg-[#e8f0fe] text-[#1a73e8] shadow-sm' : 'text-[#5f6368] hover:bg-[#f8f9fa]'}`}
          >
            <Activity className="w-4 h-4" /> Compute Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('shell')}
            className={`w-full p-3 rounded-[16px] flex items-center gap-3 font-bold text-xs transition-all ${activeTab === 'shell' ? 'bg-[#e8f0fe] text-[#1a73e8] shadow-sm' : 'text-[#5f6368] hover:bg-[#f8f9fa]'}`}
          >
            <TerminalIcon className="w-4 h-4" /> Cloud Shell
          </button>
          <button 
            onClick={() => setActiveTab('resources')}
            className={`w-full p-3 rounded-[16px] flex items-center gap-3 font-bold text-xs transition-all ${activeTab === 'resources' ? 'bg-[#e8f0fe] text-[#1a73e8] shadow-sm' : 'text-[#5f6368] hover:bg-[#f8f9fa]'}`}
          >
            <SettingsIcon className="w-4 h-4" /> Workloads & Logs
          </button>
        </nav>

        <div className="p-4 bg-[#fcfdfe] border-t border-[#f1f3f4]">
          <div className="bg-white p-4 rounded-[18px] border border-[#f1f3f4] shadow-sm">
            <div className="text-[9px] font-black text-[#5f6368] uppercase tracking-[0.1em] mb-2 opacity-50">Node Primary</div>
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2 text-[11px] font-black">
                 <div className="w-2 h-2 bg-[#34a853] rounded-full animate-pulse shadow-[0_0_8px_#34a853]"></div>
                 JKT4-HQ
               </div>
               <span className="text-[10px] font-bold text-[#1a73e8]">{ping}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#fbfcfd]">
        {activeTab === 'compute' && (
          <div className="flex-1 overflow-y-auto p-8 space-y-8 animate-in fade-in duration-500">
            <header>
              <h1 className="text-2xl font-black text-[#202124] tracking-tight">System Infrastructure</h1>
              <p className="text-[12px] text-[#5f6368] font-medium opacity-80 mt-1">Real-time health monitoring of Jakarta Node HQ</p>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-[28px] border border-[#f1f3f4] shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#5f6368]">Global CPU</span>
                  <div className="p-2 bg-[#f8f9fa] rounded-xl"><Activity className="text-[#1a73e8] w-4 h-4" /></div>
                </div>
                <div className="text-3xl font-black text-[#202124]">{stats.system.cpu}%</div>
                <div className="mt-4 pt-4 border-t border-[#f1f3f4] flex justify-between text-[11px] font-bold">
                   <span className="text-[#5f6368]">Self Instance:</span>
                   <span className="text-[#1a73e8]">{stats.panel.cpu}%</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[28px] border border-[#f1f3f4] shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#5f6368]">RAM Usage</span>
                  <div className="p-2 bg-[#f8f9fa] rounded-xl"><Database className="text-[#1a73e8] w-4 h-4" /></div>
                </div>
                <div className="text-3xl font-black text-[#202124]">{stats.system.ram.percentage}%</div>
                <div className="mt-4 pt-4 border-t border-[#f1f3f4] space-y-1.5 font-bold text-[10px]">
                   <div className="flex justify-between text-[#5f6368]"><span>Total Memory:</span> <span>{stats.system.ram.total} GB</span></div>
                   <div className="flex justify-between text-[#1a73e8]"><span>Used Allocation:</span> <span>{stats.system.ram.used} MB</span></div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[28px] border border-[#f1f3f4] shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#5f6368]">File System</span>
                  <div className="p-2 bg-[#f8f9fa] rounded-xl"><HardDrive className="text-[#1a73e8] w-4 h-4" /></div>
                </div>
                <div className="text-3xl font-black text-[#202124]">{stats.system.disk.percentage}%</div>
                <div className="mt-4 pt-4 border-t border-[#f1f3f4] flex justify-between text-[11px] font-bold">
                   <span className="text-[#5f6368]">Used Space:</span>
                   <span>{stats.system.disk.used} / {stats.system.disk.total} GB</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[28px] border border-[#f1f3f4] shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#5f6368]">Availability</span>
                  <div className="p-2 bg-[#f8f9fa] rounded-xl"><RefreshCcw className="text-[#1a73e8] w-4 h-4" /></div>
                </div>
                <div className="text-2xl font-black text-[#202124] tracking-tight">
                  {Math.floor(stats.system.uptime/3600)}h {Math.floor((stats.system.uptime%3600)/60)}m {Math.floor(stats.system.uptime%60)}s
                </div>
                <div className="mt-4 pt-4 border-t border-[#f1f3f4] flex justify-between text-[11px] font-bold">
                   <span className="text-[#5f6368]">Current Status:</span>
                   <span className="text-[#34a853]">HEALTHY ONLINE</span>
                </div>
              </div>
            </div>

            {/* Deployment Panel */}
            <div className="bg-white rounded-[32px] border border-[#f1f3f4] shadow-sm overflow-hidden">
               <div className="px-8 py-5 border-b border-[#f1f3f4] bg-[#fcfdfe] flex items-center justify-between">
                 <h2 className="text-sm font-black text-[#202124] uppercase tracking-wide">Automated Workload Provisioning</h2>
                 <span className="text-[10px] px-3 py-1 bg-[#e8f0fe] text-[#1a73e8] rounded-full font-black border border-[#d2e3fc]">LXC ISOLATED</span>
               </div>
               <div className="p-8">
                 <form onSubmit={handleDeploy} className="flex gap-4">
                   <div className="relative flex-1 group">
                     <Code className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1a73e8] transition-all group-focus-within:scale-110" />
                     <input 
                       type="text" 
                       value={repoUrl}
                       onChange={(e) => setRepoUrl(e.target.value)}
                       placeholder="https://github.com/organization/repository..."
                       className="w-full pl-14 pr-6 py-4 bg-[#f8f9fa] border-2 border-transparent focus:border-[#d2e3fc] rounded-[20px] outline-none text-sm font-extrabold focus:ring-4 focus:ring-[#1a73e8]/5 transition-all"
                     />
                   </div>
                   <button 
                     disabled={deploying}
                     className="bg-[#1a73e8] text-white px-10 py-4 rounded-[20px] font-black text-[13px] uppercase hover:bg-[#1557b0] transition-all active:scale-95 shadow-xl shadow-[#1a73e8]/20 flex items-center gap-2"
                   >
                     {deploying ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                     {deploying ? 'PROVISIONING...' : 'INITIATE DEPLOY'}
                   </button>
                 </form>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'shell' && (
          <div className="flex-1 p-8 flex flex-col bg-[#0b0c0f] animate-in slide-in-from-bottom-4 duration-500">
             <header className="mb-6 flex justify-between items-center">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
                    <TerminalIcon className="text-[#1a73e8]" /> Cloud Console
                  </h1>
                  <p className="text-[11px] text-[#80868b] mt-1 font-bold">DIRECT SHELL ACCESS TO AQUOS CORE ENGINE</p>
                </div>
                <div className="flex gap-2">
                   <span className="px-3 py-1 bg-[#1e1e1e] border border-[#333] rounded-full text-[10px] font-black text-[#34a853]">ID: JKT-PTY-1</span>
                   <span className="px-3 py-1 bg-[#1e1e1e] border border-[#333] rounded-full text-[10px] font-black text-[#1a73e8]">USER: AQUOS-ROOT</span>
                </div>
             </header>
             <div className="flex-1 overflow-hidden">
                <TerminalView wsUrl={WS_URL} />
             </div>
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="flex-1 overflow-y-auto p-8 animate-in fade-in duration-500 space-y-8">
             <header className="flex justify-between items-center">
                <div>
                  <h1 className="text-xl font-bold text-[#202124]">Workloads Management</h1>
                  <p className="text-[12px] text-[#5f6368] font-medium opacity-80 mt-1">Operational control of active engine instances</p>
                </div>
                <button onClick={fetchData} className="p-3 hover:bg-white border hover:border-[#dadce0] rounded-[18px] transition-all">
                   <RotateCcw className="w-5 h-5 text-[#5f6368]" />
                </button>
             </header>

             <div className="bg-white rounded-[32px] border border-[#f1f3f4] overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-[#f8f9fa] border-b border-[#f1f3f4] text-[9px] font-black uppercase tracking-[0.2em] text-[#5f6368]">
                    <tr>
                      <th className="px-8 py-5">Managed Instance</th>
                      <th className="px-4 py-5">Stack</th>
                      <th className="px-4 py-5 text-center">CPU Load</th>
                      <th className="px-4 py-5 text-center">RAM Used</th>
                      <th className="px-4 py-5">Instance Status</th>
                      <th className="px-8 py-5 text-right">Operations Hub</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f3f4]">
                    {projects.length === 0 ? (
                      <tr><td colSpan={6} className="px-8 py-20 text-center text-[#5f6368] font-black text-sm opacity-50 italic">No workloads detected.</td></tr>
                    ) : projects.map((p: any) => (
                      <tr key={p.name} className="hover:bg-[#fcfdfe] transition-colors group">
                        <td className="px-8 py-6">
                           <div className="font-extrabold text-[#1a73e8] text-[15px]">{p.name}</div>
                           <div className="text-[9px] font-black text-[#5f6368] flex items-center gap-2 mt-1 opacity-50">
                              <Box className="w-3 h-3" /> PORT: {p.port || 'Auto'}
                           </div>
                        </td>
                        <td className="px-4 py-6">
                           <span className="bg-[#f1f3f4] px-3 py-1 rounded-full text-[10px] font-black text-[#5f6368] border border-[#dadce0]">{p.stack || 'NODEJS'}</span>
                        </td>
                        <td className="px-4 py-6 text-center">
                           <div className="w-24 h-1.5 bg-[#f1f3f4] rounded-full mx-auto overflow-hidden">
                              <div className={`h-full transition-all duration-1000 ${p.cpu > 50 ? 'bg-[#ea4335]' : 'bg-[#1a73e8]'}`} style={{width: `${Math.max(5, p.cpu)}%`}}></div>
                           </div>
                           <span className="text-[10px] font-black mt-2 inline-block">{p.cpu}%</span>
                        </td>
                        <td className="px-4 py-6 text-center">
                           <span className="text-[11px] font-black">{Math.round(p.memory / (1024*1024))} MB</span>
                        </td>
                        <td className="px-4 py-6">
                           <span className={`flex items-center gap-2 text-[10px] font-black uppercase ${p.status === 'online' ? 'text-[#34a853]' : 'text-[#ea4335]'}`}>
                             <div className={`w-2 h-2 rounded-full ${p.status === 'online' ? 'bg-[#34a853] shadow-[0_0_8px_#34a853]' : 'bg-[#ea4335]'}`}></div>
                             {p.status}
                           </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                           <div className="flex justify-end gap-2">
                              {p.status === 'online' ? (
                                <button onClick={() => handleAction(p.name, 'stop')} className="p-3 bg-[#f8f9fa] hover:bg-[#ea4335] hover:text-white rounded-[16px] transition-all"><Square className="w-4 h-4 fill-current" /></button>
                              ) : (
                                <button onClick={() => handleAction(p.name, 'start')} className="p-3 bg-[#f8f9fa] hover:bg-[#34a853] hover:text-white rounded-[16px] transition-all"><Play className="w-4 h-4 fill-current" /></button>
                              )}
                              <button onClick={() => handleAction(p.name, 'restart')} className="p-3 bg-[#f8f9fa] hover:bg-[#1a73e8] hover:text-white rounded-[16px] transition-all"><RotateCcw className="w-4 h-4" /></button>
                              <button onClick={() => handleAction(p.name, 'delete')} className="p-3 bg-[#f8f9fa] hover:bg-[#ea4335] hover:text-white rounded-[16px] transition-all"><Trash2 className="w-4 h-4" /></button>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 right-10 p-4 opacity-40 select-none">
         <p className="text-[9px] font-black text-[#80868b] tracking-[0.2em]">AQUOS CLOUD ECOSYSTEM v1.2.0 • TERMUX OPTIMIZED</p>
      </footer>
    </div>
  );
}

export default App;
