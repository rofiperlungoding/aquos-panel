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
  Square
} from 'lucide-react';
import 'xterm/css/xterm.css';

const API_URL = '/api';

function App() {
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState<any>({ cpu: '0.0', ram: 0, disk: 0, uptime: 0, activeMem: 0, totalMem: 0 });
  const [repoUrl, setRepoUrl] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [ping, setPing] = useState('...');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);

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

  const checkUpdate = async () => {
    try {
      const res = await axios.get(`${API_URL}/system/check-update`);
      setUpdateAvailable(res.data.updateAvailable);
    } catch (e) {}
  };

  useEffect(() => {
    fetchData();
    checkUpdate();
    const intv = setInterval(fetchData, 2000);
    const updateIntv = setInterval(checkUpdate, 5000); 
    return () => {
      clearInterval(intv);
      clearInterval(updateIntv);
    };
  }, []);

  const triggerUpdate = async () => {
    setUpdating(true);
    try {
      await axios.post(`${API_URL}/system/update`);
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch(e) {
      alert("Update failed, check terminal");
      setUpdating(false);
    }
  };

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl) return;
    setDeploying(true);
    try {
      await axios.post(`${API_URL}/projects`, { repoUrl });
      setRepoUrl('');
      fetchData();
    } catch (e) {
      alert("Deployment failed");
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f8f9fa] text-[#202124] font-['Plus_Jakarta_Sans'] antialiased">
      {/* Sidebar - Slimmed */}
      <aside className="w-64 bg-white border-r border-[#dadce0] flex flex-col shadow-[2px_0_12px_rgba(0,0,0,0.01)] transition-all">
        <div className="h-16 flex items-center px-6 border-b border-[#f1f3f4]">
          <div className="flex flex-col">
            <span className="text-[#1a73e8] font-bold text-lg flex items-center gap-2 tracking-tight">
              <Server className="w-6 h-6" /> Aquos Cloud
            </span>
            <span className="text-[9px] text-[#5f6368] font-black tracking-[0.1em] uppercase mt-0.5 opacity-60">
              Enterprise v1.1.8
            </span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {updateAvailable && (
             <button 
               onClick={triggerUpdate}
               disabled={updating}
               className="w-full mb-4 bg-[#fce8e6] text-[#d93025] p-3 rounded-[16px] text-[11px] font-black flex items-center gap-2 border border-[#d93025]/10 animate-pulse"
             >
               <RefreshCcw className={`w-4 h-4 ${updating ? 'animate-spin' : ''}`} />
               {updating ? 'UPDATING...' : 'UPDATE NOW'}
             </button>
          )}

          <div className="bg-[#e8f0fe] text-[#1a73e8] p-3 rounded-[14px] flex items-center gap-3 font-bold text-xs shadow-sm border border-[#d2e3fc]">
            <Activity className="w-4 h-4" /> Universal Compute
          </div>
          <div className="text-[#5f6368] p-3 rounded-[14px] flex items-center gap-3 font-bold text-xs hover:bg-[#f1f3f4] cursor-not-allowed transition-all opacity-80">
            <TerminalIcon className="w-4 h-4" /> Cloud Shell
          </div>
          <div className="text-[#5f6368] p-3 rounded-[14px] flex items-center gap-3 font-bold text-xs hover:bg-[#f1f3f4] cursor-not-allowed transition-all opacity-80">
            <SettingsIcon className="w-4 h-4" /> Settings
          </div>
        </nav>

        <div className="p-4 border-t border-[#f1f3f4]">
          <div className="bg-[#f8f9fa] p-3 rounded-[16px] border border-[#f1f3f4]">
            <div className="text-[9px] font-black text-[#5f6368] uppercase tracking-widest mb-1 opacity-60">Node</div>
            <div className="flex items-center gap-2 text-[11px] font-black text-[#34a853]">
              <div className="w-2 h-2 bg-[#34a853] rounded-full"></div>
              Jakarta-JP4
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content - Compressed */}
      <main className="flex-1 overflow-y-auto p-8 bg-[#f8f9fa]">
        <header className="mb-8">
          <h1 className="text-2xl font-black text-[#202124] tracking-tight">System Status</h1>
          <p className="text-[12px] text-[#5f6368] font-medium opacity-80 italic italic">Real-time infrastructure health monitoring</p>
        </header>

        {/* Stats Grid - Smaller Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white p-6 rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-[#f1f3f4] transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] group">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[#5f6368]"><u>CPU Load</u></span>
              <Activity className="text-[#1a73e8] w-4 h-4" />
            </div>
            <div className="text-3xl font-black text-[#202124] tracking-tighter">{stats.cpu}%</div>
            <div className="text-[10px] text-[#5f6368] mt-2 font-medium italic opacity-60">Avg. load across cores</div>
          </div>

          <div className="bg-white p-6 rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-[#f1f3f4] transition-all">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[#5f6368]"><u>RAM Memory</u></span>
              <Database className="text-[#1a73e8] w-4 h-4" />
            </div>
            <div className="text-3xl font-black text-[#202124] tracking-tighter">{stats.ram}%</div>
            <div className="text-[10px] text-[#5f6368] mt-2 leading-tight">
               <b>Used:</b> <i>{stats.activeMem}MB</i> / <b>P:</b> {stats.totalMem}GB
            </div>
          </div>

          <div className="bg-white p-6 rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-[#f1f3f4] transition-all text-center">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[#5f6368]"><u>Storage</u></span>
              <HardDrive className="text-[#1a73e8] w-4 h-4" />
            </div>
            <div className="text-3xl font-black text-[#202124] tracking-tighter">{stats.disk}%</div>
            <div className="text-[10px] text-[#5f6368] mt-2 font-bold text-[#34a853] underline">STABLE</div>
          </div>

          <div className="bg-white p-6 rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-[#f1f3f4] transition-all">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[#5f6368]"><u>System UP</u></span>
              <RefreshCcw className="text-[#1a73e8] w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-[#202124] tracking-tighter">{Math.floor(stats.uptime/3600)}h {Math.floor((stats.uptime%3600)/60)}m</div>
            <div className="text-[10px] mt-2 flex items-center gap-1.5 font-bold">
               Lat: <span className="text-[#34a853] bg-[#e6f4ea] px-1.5 py-0.5 rounded-md border border-[#ceead6]">{ping}</span>
            </div>
          </div>
        </div>

        {/* Action Panel - Slimmer */}
        <div className="bg-white rounded-[32px] shadow-[0_8px_40px_rgba(0,0,0,0.02)] border border-[#f1f3f4] mb-8 overflow-hidden">
          <div className="px-8 py-5 border-b border-[#f1f3f4] bg-[#fcfdfe]">
            <h2 className="text-lg font-black text-[#202124] tracking-tight">Provision App Engine</h2>
          </div>
          <div className="p-8">
            <form onSubmit={handleDeploy} className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Code className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1a73e8]" />
                <input 
                  type="text" 
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repo..."
                  className="w-full pl-12 pr-6 py-4 bg-[#f8f9fa] border-2 border-transparent focus:border-[#d2e3fc] rounded-[18px] focus:ring-0 transition-all outline-none text-sm font-bold placeholder:font-normal"
                />
              </div>
              <button 
                disabled={deploying}
                className="bg-[#1a73e8] text-white px-10 py-4 rounded-[18px] font-black text-sm hover:bg-[#1557b0] transition-all active:scale-95 shadow-lg shadow-[#1a73e8]/20"
              >
                {deploying ? 'PROVISIONING...' : 'DEPLOY ENGINE'}
              </button>
            </form>
          </div>
        </div>

        {/* Instances Table - Dense */}
        <div className="bg-white rounded-[32px] shadow-[0_8px_40px_rgba(0,0,0,0.02)] border border-[#f1f3f4] overflow-hidden">
          <div className="px-8 py-5 border-b border-[#f1f3f4] flex justify-between items-center bg-[#fcfdfe]">
            <h2 className="text-lg font-black text-[#202124] tracking-tight">Active Workloads</h2>
            <div className="text-[9px] font-black uppercase bg-[#e8f0fe] text-[#1a73e8] px-3 py-1 rounded-full border border-[#d2e3fc]">
               {projects.length} Online
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f8f9fa] border-b border-[#f1f3f4] text-[9px] font-black uppercase tracking-[0.15em] text-[#5f6368]">
                <tr>
                  <th className="px-8 py-4">ID / Managed</th>
                  <th className="px-4 py-4">Arch</th>
                  <th className="px-4 py-4">CPU</th>
                  <th className="px-4 py-4">RAM</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-8 py-4 text-right">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f4]">
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-12 text-center text-[#5f6368] text-xs font-medium italic">Empty workloads environment.</td>
                  </tr>
                ) : projects.map((project: any) => (
                  <tr key={project.name} className="hover:bg-[#fcfdfe] transition-colors group">
                    <td className="px-8 py-4">
                      <div className="font-extrabold text-[#1a73e8] group-hover:underline cursor-pointer text-sm">{project.name}</div>
                      <div className="text-[9px] text-[#5f6368] font-bold italic opacity-50">PM2 CLOUD AGENT</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="bg-[#f1f3f4] px-2 py-1 rounded-lg text-[9px] font-black text-[#5f6368] border border-[#dadce0]">LXC</span>
                    </td>
                    <td className="px-4 py-4 font-mono font-bold text-xs">{project.cpu}%</td>
                    <td className="px-4 py-4 font-bold text-xs">{project.memory}</td>
                    <td className="px-4 py-4">
                      <span className="flex items-center gap-1.5 text-[11px] font-black text-[#34a853]">
                        <div className="w-2 h-2 bg-[#34a853] rounded-full"></div>
                        <u>ACTIVE</u>
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button title="Restart" className="p-2.5 hover:bg-[#e8f0fe] rounded-[12px] text-[#5f6368] hover:text-[#1a73e8] transition-all"><RefreshCcw className="w-4 h-4" /></button>
                        <button title="Stop" className="p-2.5 hover:bg-[#f1f3f4] rounded-[12px] text-[#5f6368] transition-all"><Square className="w-4 h-4 fill-current" /></button>
                        <button title="Destroy" className="p-2.5 hover:bg-[#fce8e6] rounded-[12px] text-[#d93025] transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 right-8 p-3 opacity-30 select-none">
         <p className="text-[8px] font-black text-[#80868b] uppercase tracking-[0.2em] italic">AquosNode Engine</p>
      </footer>
    </div>
  );
}

export default App;
