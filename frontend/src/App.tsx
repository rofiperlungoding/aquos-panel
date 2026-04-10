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
  Box,
  ChevronRight,
  TrendingUp,
  Clock
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area 
} from 'recharts';
import TerminalView from './components/TerminalView';

const API_URL = '/api';
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTOCOL}//${window.location.host}`;

function App() {
  const [activeTab, setActiveTab] = useState('compute');
  const [projects, setProjects] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [repoUrl, setRepoUrl] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [ping, setPing] = useState('...');

  const fetchData = async () => {
    try {
      const start = performance.now();
      const pRes = await axios.get(`${API_URL}/projects?t=${Date.now()}`);
      setProjects(pRes.data.projects);
      
      const sRes = await axios.get(`${API_URL}/stats?t=${Date.now()}`);
      const newStats = sRes.data;
      setStats(newStats);
      setPing(Math.round(performance.now() - start).toString() + 'ms');

      // Update history for graphs
      setHistory(prev => {
        const newData = [...prev, {
          time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          cpu: parseFloat(newStats.system.cpu),
          ram: newStats.system.ram.percentage
        }].slice(-20); // Keep last 20 points
        return newData;
      });

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
    <span className="text-xl">Architecting Hub...</span>
  </div>;

  return (
    <div className="flex h-screen bg-[#f8f9fa] text-[#202124] font-['Plus_Jakarta_Sans'] antialiased overflow-hidden">
      {/* Navigation Rail - Modern Slim */}
      <aside className="w-64 bg-white border-r border-[#dadce0] flex flex-col shadow-[1px_0_15px_rgba(0,0,0,0.02)] z-10">
        <div className="h-16 flex items-center px-6 border-b border-[#f1f3f4]">
          <div className="flex flex-col">
            <span className="text-[#1a73e8] font-black text-xl flex items-center gap-2 leading-none">
              <Box className="w-6 h-6 fill-[#1a73e8]/10" /> AQUOS
            </span>
            <span className="text-[10px] text-[#202124] font-black tracking-[0.05em] uppercase opacity-40 mt-1">Core Engine v1.2.1</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button onClick={() => setActiveTab('compute')} className={`w-full p-3.5 rounded-[18px] flex items-center gap-3 font-bold text-xs transition-all ${activeTab === 'compute' ? 'bg-[#1a73e8] text-white shadow-lg shadow-[#1a73e8]/20' : 'text-[#5f6368] hover:bg-[#f8f9fa]'}`}>
            <Activity className="w-4 h-4" /> Operations Hub
          </button>
          <button onClick={() => setActiveTab('shell')} className={`w-full p-3.5 rounded-[18px] flex items-center gap-3 font-bold text-xs transition-all ${activeTab === 'shell' ? 'bg-[#1a73e8] text-white shadow-lg shadow-[#1a73e8]/20' : 'text-[#5f6368] hover:bg-[#f8f9fa]'}`}>
            <TerminalIcon className="w-4 h-4" /> Cloud Shell
          </button>
          <button onClick={() => setActiveTab('resources')} className={`w-full p-3.5 rounded-[18px] flex items-center gap-3 font-bold text-xs transition-all ${activeTab === 'resources' ? 'bg-[#1a73e8] text-white shadow-lg shadow-[#1a73e8]/20' : 'text-[#5f6368] hover:bg-[#f8f9fa]'}`}>
            <TrendingUp className="w-4 h-4" /> Workloads & Insights
          </button>
        </nav>

        <div className="p-4 border-t border-[#f1f3f4]">
          <div className="bg-[#f8f9fa] p-4 rounded-[20px] border border-[#f1f3f4]">
            <div className="flex items-center justify-between mb-3 text-[10px] font-black uppercase tracking-widest text-[#5f6368] opacity-50">
              <span className="flex items-center gap-1"><Server className="w-3 h-3" /> Region</span>
              <span>Online</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] font-black text-[#202124]">
              <div className="w-2 h-2 bg-[#34a853] rounded-full shadow-[0_0_8px_#34a853]"></div>
              Jakarta-HQ-Node
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-bold">
               <span className="text-[#5f6368]">Lat:</span>
               <span className="text-[#34a853] bg-[#e6f4ea] px-1.5 py-0.5 rounded-md border border-[#ceead6]">{ping}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Framework */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#fafbfc]">
        
        {/* TAB: COMPUTE - Executive Compact View */}
        {activeTab === 'compute' && (
          <div className="flex-1 overflow-y-auto p-8 space-y-6 animate-in fade-in duration-500">
             <header className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-black text-[#202124] tracking-tight">System Infrastructure</h1>
                  <p className="text-[12px] text-[#5f6368] font-bold opacity-60">Real-time health of managed hardware resources</p>
                </div>
                <div className="flex gap-2">
                   <div className="bg-white border px-4 py-2 rounded-2xl shadow-sm text-xs font-bold flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#1a73e8]" /> {Math.floor(stats.system.uptime/3600)}h {Math.floor((stats.system.uptime%3600)/60)}m Up
                   </div>
                </div>
             </header>

             {/* Modern Compact Grid */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[32px] border border-[#f1f3f4] shadow-sm flex items-center gap-5 group hover:border-[#1a73e8]/20 transition-all">
                   <div className="w-16 h-16 bg-[#e8f0fe] rounded-[24px] flex items-center justify-center">
                      <Activity className="text-[#1a73e8] w-8 h-8" />
                   </div>
                   <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#5f6368] opacity-50 mb-1">Global Load</div>
                      <div className="text-3xl font-black text-[#202124]">{stats.system.cpu}%</div>
                   </div>
                   <div className="ml-auto flex flex-col items-end">
                      <div className="text-[9px] font-bold text-[#1a73e8] mb-1">Self: {stats.panel.cpu}%</div>
                      <div className="w-12 h-1 bg-[#f1f3f4] rounded-full overflow-hidden">
                         <div className="h-full bg-[#1a73e8]" style={{width: `${stats.system.cpu}%`}}></div>
                      </div>
                   </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-[#f1f3f4] shadow-sm flex items-center gap-5 group hover:border-[#1a73e8]/20 transition-all">
                   <div className="w-16 h-16 bg-[#fde9e9] rounded-[24px] flex items-center justify-center">
                      <Database className="text-[#ea4335] w-8 h-8" />
                   </div>
                   <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#5f6368] opacity-50 mb-1">Memory Index</div>
                      <div className="text-3xl font-black text-[#202124]">{stats.system.ram.percentage}%</div>
                   </div>
                   <div className="ml-auto text-right">
                      <div className="text-[10px] font-black text-[#ea4335]">{stats.system.ram.used}MB</div>
                      <div className="text-[9px] font-bold text-[#5f6368] opacity-40">OF {stats.system.ram.total}GB</div>
                   </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-[#f1f3f4] shadow-sm flex items-center gap-5 group hover:border-[#1a73e8]/20 transition-all">
                   <div className="w-16 h-16 bg-[#e6f4ea] rounded-[24px] flex items-center justify-center">
                      <HardDrive className="text-[#34a853] w-8 h-8" />
                   </div>
                   <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#5f6368] opacity-50 mb-1">Storage Hub</div>
                      <div className="text-3xl font-black text-[#202124]">{stats.system.disk.percentage}%</div>
                   </div>
                   <div className="ml-auto text-right text-[10px] font-black">
                      <div className="text-[#34a853]">{stats.system.disk.used} GB</div>
                      <div className="text-[#5f6368] opacity-30">USED</div>
                   </div>
                </div>
             </div>

             {/* Deployment Engine - Centered & Clean */}
             <div className="bg-[#1a73e8] rounded-[40px] p-10 text-white shadow-2xl shadow-[#1a73e8]/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform">
                   <Box className="w-48 h-48 -rotate-12" />
                </div>
                <div className="relative z-10 max-w-2xl">
                   <h2 className="text-2xl font-black tracking-tight mb-2">Deploy New Engine Instance</h2>
                   <p className="text-sm font-bold text-white/70 mb-8 italic">Automated provisioning system for Node.js, Python, and Go microservices.</p>
                   
                   <form onSubmit={handleDeploy} className="flex gap-4">
                     <div className="flex-1 relative">
                       <input 
                         type="text" 
                         value={repoUrl}
                         onChange={(e) => setRepoUrl(e.target.value)}
                         placeholder="Enter repository URI (GitHub/GitLab)..."
                         className="w-full pl-6 pr-6 py-4 bg-white/10 border-2 border-white/20 focus:border-white/40 rounded-[22px] outline-none text-sm font-bold placeholder:text-white/30 backdrop-blur-md transition-all"
                       />
                     </div>
                     <button 
                       disabled={deploying}
                       className="bg-white text-[#1a73e8] px-10 py-4 rounded-[22px] font-black text-sm uppercase shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
                     >
                       {deploying ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                       {deploying ? 'Deploying...' : 'Provision'}
                     </button>
                   </form>
                </div>
             </div>

             {/* Minimal Active workload list */}
             <div className="bg-white border border-[#f1f3f4] rounded-[32px] p-6">
                <div className="flex justify-between items-center mb-6 px-2">
                   <h3 className="text-sm font-black text-[#202124] uppercase tracking-wider">Operational Summary</h3>
                   <span className="text-[10px] font-black text-[#1a73e8] bg-[#e8f0fe] px-3 py-1 rounded-full uppercase">{projects.length} Active Workloads</span>
                </div>
                <div className="space-y-3">
                   {projects.slice(0, 3).map((p: any) => (
                      <div key={p.name} className="flex items-center justify-between p-4 bg-[#fbfcfd] border border-[#f1f3f4] rounded-[24px] hover:border-[#1a73e8]/20 transition-all cursor-pointer" onClick={() => setActiveTab('resources')}>
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white shadow-sm border border-[#f1f3f4] rounded-xl flex items-center justify-center">
                               <Code className="w-5 h-5 text-[#1a73e8]" />
                            </div>
                            <div>
                               <div className="text-sm font-extrabold text-[#202124]">{p.name}</div>
                               <div className="text-[9px] font-bold text-[#5f6368] opacity-50 uppercase tracking-widest">{p.stack || 'NODEJS'} INTERPRETER</div>
                            </div>
                         </div>
                         <div className="flex items-center gap-8">
                            <div className="text-right">
                               <div className="text-[12px] font-black text-[#202124]">{p.cpu}%</div>
                               <div className="text-[8px] font-bold text-[#5f6368] opacity-40 uppercase tracking-widest">CPU</div>
                            </div>
                            <div className="text-right">
                               <div className="text-[12px] font-black text-[#202124]">{Math.round(p.memory / (1024*1024))}MB</div>
                               <div className="text-[8px] font-bold text-[#5f6368] opacity-40 uppercase tracking-widest">MEM</div>
                            </div>
                            <div className="px-3 py-1.5 bg-[#e6f4ea] text-[#34a853] rounded-lg text-[10px] font-black">ACTIVE</div>
                            <ChevronRight className="text-[#dadce0] w-5 h-5" />
                         </div>
                      </div>
                   ))}
                   {projects.length > 3 && (
                      <button onClick={() => setActiveTab('resources')} className="w-full py-3 text-[10px] font-black text-[#5f6368] hover:text-[#1a73e8] uppercase tracking-widest transition-all">View All Workloads ({projects.length})</button>
                   )}
                </div>
             </div>
          </div>
        )}

        {/* TAB: RESOURCES - Detailed Insights with Graphs */}
        {activeTab === 'resources' && (
          <div className="flex-1 overflow-y-auto p-8 space-y-8 animate-in slide-in-from-right-4 duration-500">
             <header className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-black text-[#202124]">Performance Analytics</h1>
                  <p className="text-[12px] text-[#5f6368] font-bold opacity-60">Deep-dive engine metrics and historical resource monitoring</p>
                </div>
                <div className="flex gap-2">
                   <button onClick={fetchData} className="p-3 bg-white border border-[#dadce0] rounded-2xl shadow-sm hover:bg-[#f8f9fa] transition-all"><RotateCcw className="w-5 h-5 text-[#5f6368]" /></button>
                </div>
             </header>

             {/* Live Graphs */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-[32px] border border-[#f1f3f4] shadow-sm">
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xs font-black text-[#5f6368] uppercase tracking-widest">Global CPU History (%)</h3>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-[#1a73e8] bg-[#e8f0fe] px-2 py-1 rounded-md">LIVE MONITORING</div>
                   </div>
                   <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={history}>
                            <defs>
                               <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#1a73e8" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#1a73e8" stopOpacity={0}/>
                               </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f3f4" />
                            <XAxis dataKey="time" hide />
                            <YAxis domain={[0, 100]} hide />
                            <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 'bold'}} />
                            <Area type="monotone" dataKey="cpu" stroke="#1a73e8" strokeWidth={3} fillOpacity={1} fill="url(#colorCpu)" animationDuration={300} />
                         </AreaChart>
                      </ResponsiveContainer>
                   </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-[#f1f3f4] shadow-sm">
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xs font-black text-[#5f6368] uppercase tracking-widest">Memory Index Chart (%)</h3>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-[#ea4335] bg-[#fde9e9] px-2 py-1 rounded-md">ALLOCATION SENSOR</div>
                   </div>
                   <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={history}>
                            <defs>
                               <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#ea4335" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#ea4335" stopOpacity={0}/>
                               </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f3f4" />
                            <XAxis dataKey="time" hide />
                            <YAxis domain={[0, 100]} hide />
                            <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 'bold'}} />
                            <Area type="monotone" dataKey="ram" stroke="#ea4335" strokeWidth={3} fillOpacity={1} fill="url(#colorRam)" animationDuration={300} />
                         </AreaChart>
                      </ResponsiveContainer>
                   </div>
                </div>
             </div>

             {/* Instance Table - Pro Expanded */}
             <div className="bg-white rounded-[32px] border border-[#f1f3f4] overflow-hidden shadow-sm">
                <div className="px-8 py-5 border-b border-[#f1f3f4] bg-[#fcfdfe] flex items-center justify-between">
                   <h2 className="text-sm font-black text-[#202124] uppercase tracking-wide">Workload Catalog</h2>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-[#f8f9fa] border-b border-[#f1f3f4] text-[9px] font-black uppercase tracking-[0.2em] text-[#5f6368]">
                        <tr>
                          <th className="px-8 py-5">Managed Entity</th>
                          <th className="px-4 py-5 text-center">Interpreter</th>
                          <th className="px-4 py-5 text-center">CPU %</th>
                          <th className="px-4 py-5 text-center">RAM Used</th>
                          <th className="px-4 py-5">Infrastructure Status</th>
                          <th className="px-8 py-5 text-right">Operations Hub</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1f3f4]">
                        {projects.map((p: any) => (
                          <tr key={p.name} className="hover:bg-[#fcfdfe] transition-colors group">
                            <td className="px-8 py-6">
                               <div className="font-extrabold text-[#1a73e8] text-[15px]">{p.name}</div>
                               <div className="text-[9px] font-black text-[#5f6368] flex items-center gap-2 mt-1 opacity-50 uppercase tracking-widest">EXPOSED PORT: {p.port || 'Auto'}</div>
                            </td>
                            <td className="px-4 py-6 text-center">
                               <span className="bg-[#f1f3f4] px-3 py-1 rounded-full text-[10px] font-black text-[#5f6368] border border-[#dadce0]">{p.stack || 'NODEJS'}</span>
                            </td>
                            <td className="px-4 py-6 text-center">
                               <div className="w-24 h-1.5 bg-[#f1f3f4] rounded-full mx-auto overflow-hidden">
                                  <div className={`h-full transition-all duration-1000 ${p.cpu > 50 ? 'bg-[#ea4335]' : 'bg-[#1a73e8]'}`} style={{width: `${Math.max(5, p.cpu)}%`}}></div>
                               </div>
                               <span className="text-[10px] font-black mt-2 inline-block">{p.cpu}%</span>
                            </td>
                            <td className="px-4 py-6 text-center font-black text-[11px]">{Math.round(p.memory / (1024*1024))} MB</td>
                            <td className="px-4 py-6">
                               <span className={`flex items-center gap-2 text-[10px] font-black uppercase ${p.status === 'online' ? 'text-[#34a853]' : 'text-[#ea4335]'}`}>
                                 <div className={`w-2.5 h-2.5 rounded-full ${p.status === 'online' ? 'bg-[#34a853] shadow-[0_0_10px_#34a853]' : 'bg-[#ea4335]'}`}></div>
                                 {p.status}
                               </span>
                            </td>
                            <td className="px-8 py-6 text-right">
                               <div className="flex justify-end gap-2">
                                  {p.status === 'online' ? (
                                    <button onClick={() => handleAction(p.name, 'stop')} className="p-3 bg-[#f8f9fa] hover:bg-[#202124] hover:text-white rounded-[18px] transition-all"><Square className="w-4 h-4 fill-current" /></button>
                                  ) : (
                                    <button onClick={() => handleAction(p.name, 'start')} className="p-3 bg-[#f8f9fa] hover:bg-[#34a853] hover:text-white rounded-[18px] transition-all"><Play className="w-4 h-4 fill-current" /></button>
                                  )}
                                  <button onClick={() => handleAction(p.name, 'restart')} className="p-3 bg-[#f8f9fa] hover:bg-[#1a73e8] hover:text-white rounded-[18px] transition-all"><RotateCcw className="w-4 h-4" /></button>
                                  <button onClick={() => handleAction(p.name, 'delete')} className="p-3 bg-[#f8f9fa] hover:bg-[#ea4335] hover:text-white rounded-[18px] transition-all"><Trash2 className="w-4 h-4" /></button>
                               </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'shell' && (
          <div className="flex-1 p-8 flex flex-col bg-[#0f1115] animate-in slide-in-from-bottom-4 duration-500">
             <header className="mb-6 flex justify-between items-center text-white">
                <div>
                  <h1 className="text-xl font-bold tracking-tight flex items-center gap-3">
                    <TerminalIcon className="text-[#1a73e8]" /> Remote Shell Hub
                  </h1>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/30">NODE_JKT_TERMINAL_SESSION_ACTIVE</div>
             </header>
             <div className="flex-1">
                <TerminalView wsUrl={WS_URL} />
             </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 right-10 p-4 opacity-20 pointer-events-none">
         <p className="text-[8px] font-black text-[#5f6368] tracking-[0.3em] uppercase">Private Infrastructure • AquosNode System</p>
      </footer>
    </div>
  );
}

export default App;
