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
  Plus,
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
    <div className="flex h-screen bg-[#f8f9fa] text-[#202124] font-['Plus_Jakarta_Sans']">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-[#dadce0] flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="h-20 flex items-center px-8 border-b border-[#f1f3f4]">
          <div className="flex flex-col">
            <span className="text-[#1a73e8] font-extrabold text-xl flex items-center gap-2 tracking-tight">
              <Server className="w-7 h-7" /> Aquos Cloud
            </span>
            <span className="text-[10px] text-[#5f6368] font-bold tracking-[0.1em] uppercase mt-1 opacity-60">
              Enterprise v1.1.7
            </span>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-2">
          {updateAvailable && (
             <button 
               onClick={triggerUpdate}
               disabled={updating}
               className="w-full mb-6 bg-[#fce8e6] text-[#d93025] p-5 rounded-[20px] text-sm font-bold flex items-center gap-3 border border-[#f9ab00]/20 animate-pulse transition-all hover:scale-[1.02]"
             >
               <RefreshCcw className={`w-5 h-5 ${updating ? 'animate-spin' : ''}`} />
               {updating ? 'APPLYING UPDATE...' : 'CLICK TO UPDATE NOW'}
             </button>
          )}

          <div className="bg-[#e8f0fe] text-[#1a73e8] p-4 rounded-[22px] flex items-center gap-4 font-bold text-sm shadow-sm border border-[#d2e3fc]">
            <Activity className="w-5 h-5" /> Universal Compute
          </div>
          <div className="text-[#5f6368] p-4 rounded-[22px] flex items-center gap-4 font-semibold text-sm hover:bg-[#f1f3f4] cursor-not-allowed transition-all">
            <TerminalIcon className="w-5 h-5" /> Cloud Shell
          </div>
          <div className="text-[#5f6368] p-4 rounded-[22px] flex items-center gap-4 font-semibold text-sm hover:bg-[#f1f3f4] cursor-not-allowed transition-all">
            <SettingsIcon className="w-5 h-5" /> Settings
          </div>
        </nav>

        <div className="p-8 border-t border-[#f1f3f4]">
          <div className="bg-[#f8f9fa] p-5 rounded-[24px] border border-[#f1f3f4]">
            <div className="text-[10px] font-black text-[#5f6368] uppercase tracking-widest mb-2 opacity-60">Region Status</div>
            <div className="flex items-center gap-2 text-sm font-bold text-[#34a853]">
              <div className="w-2.5 h-2.5 bg-[#34a853] rounded-full animate-pulse"></div>
              Jakarta-JP4-A
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-12 bg-[#f8f9fa]">
        <header className="mb-14">
          <h1 className="text-4xl font-extrabold text-[#202124] tracking-tight text-center md:text-left">System Status</h1>
          <p className="text-[#5f6368] mt-2 font-medium italic opacity-80 text-center md:text-left">Infrastructure health monitoring & active workloads</p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-14">
          <div className="bg-white p-8 rounded-[36px] shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-[#f1f3f4] transition-all hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] group">
            <div className="flex justify-between items-center mb-6">
              <span className="text-[11px] font-black uppercase tracking-[0.15em] text-[#5f6368]"><u>CPU Usage</u></span>
              <Activity className="text-[#1a73e8] w-5 h-5 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-5xl font-black text-[#202124] tracking-tighter">{stats.cpu}%</div>
            <div className="text-[12px] text-[#5f6368] mt-5 leading-relaxed font-medium">
               <i>Real-time system load across all cores</i>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[36px] shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-[#f1f3f4] transition-all hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] group">
            <div className="flex justify-between items-center mb-6">
              <span className="text-[11px] font-black uppercase tracking-[0.15em] text-[#5f6368]"><u>RAM Memory</u></span>
              <Database className="text-[#1a73e8] w-5 h-5 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-5xl font-black text-[#202124] tracking-tighter">{stats.ram}%</div>
            <div className="text-[12px] text-[#5f6368] mt-5 leading-relaxed">
              <b>Used:</b> <span className="font-bold underlineDecoration">{stats.activeMem} MB</span><br/>
              <b>Total:</b> <span className="font-medium">{stats.totalMem} GB</span>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[36px] shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-[#f1f3f4] transition-all hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] group">
            <div className="flex justify-between items-center mb-6">
              <span className="text-[11px] font-black uppercase tracking-[0.15em] text-[#5f6368]"><u>Disk Space</u></span>
              <HardDrive className="text-[#1a73e8] w-5 h-5 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-5xl font-black text-[#202124] tracking-tighter">{stats.disk}%</div>
            <div className="text-[12px] text-[#5f6368] mt-5 italic font-medium opacity-70">Read/Write operations normal</div>
          </div>

          <div className="bg-white p-8 rounded-[36px] shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-[#f1f3f4] transition-all hover:shadow-[0_20px_60px_rgba(0,0,0,0.06)] group">
            <div className="flex justify-between items-center mb-6">
              <span className="text-[11px] font-black uppercase tracking-[0.15em] text-[#5f6368]"><u>Uptime</u></span>
              <RefreshCcw className="text-[#1a73e8] w-5 h-5 group-hover:rotate-180 transition-transform duration-700" />
            </div>
            <div className="text-4xl font-black text-[#202124] tracking-tighter">{Math.floor(stats.uptime/3600)}h {Math.floor((stats.uptime%3600)/60)}m</div>
            <div className="text-[12px] text-[#5f6368] mt-5">
              <b>Latency:</b> <span className="text-[#34a853] font-black bg-[#e6f4ea] px-3 py-1 rounded-lg border border-[#ceead6]">{ping}</span>
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="bg-white rounded-[48px] shadow-[0_12px_50px_rgba(0,0,0,0.03)] border border-[#f1f3f4] mb-14 overflow-hidden">
          <div className="px-12 py-10 border-b border-[#f1f3f4] bg-[#fcfdfe]">
            <h2 className="text-2xl font-black text-[#202124] tracking-tight text-center md:text-left">Provision New App Engine</h2>
          </div>
          <div className="p-12">
            <form onSubmit={handleDeploy} className="flex flex-col md:flex-row gap-5">
              <div className="relative flex-1">
                <Code className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-[#1a73e8]" />
                <input 
                  type="text" 
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="Insert GitHub Repository URL..."
                  className="w-full pl-16 pr-8 py-6 bg-[#f8f9fa] border-2 border-transparent focus:border-[#d2e3fc] rounded-[28px] focus:ring-4 focus:ring-[#1a73e8]/5 transition-all outline-none text-[#202124] font-bold placeholder:font-medium placeholder:italic"
                />
              </div>
              <button 
                disabled={deploying}
                className="bg-[#1a73e8] text-white px-14 py-6 rounded-[28px] font-black text-lg hover:bg-[#1557b0] transition-all shadow-2xl shadow-[#1a73e8]/30 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
              >
                {deploying ? 'PROVISIONING...' : 'DEPLOY INSTANCE'}
                {!deploying && <Plus className="w-6 h-6" />}
              </button>
            </form>
            <p className="text-[13px] text-[#5f6368] mt-8 ml-4 italic font-medium opacity-80">
              * System automatically initializes Node.js, Python, or Go environments and handles service isolation.
            </p>
          </div>
        </div>

        {/* Instances Table */}
        <div className="bg-white rounded-[48px] shadow-[0_12px_50px_rgba(0,0,0,0.03)] border border-[#f1f3f4] overflow-hidden">
          <div className="px-12 py-10 border-b border-[#f1f3f4] flex justify-between items-center bg-[#fcfdfe]">
            <h2 className="text-2xl font-black text-[#202124] tracking-tight">Active Workloads</h2>
            <div className="flex items-center gap-2 bg-[#e8f0fe] text-[#1a73e8] px-5 py-2 rounded-full font-black text-[11px] uppercase tracking-widest border border-[#d2e3fc]">
              <span className="w-2 h-2 bg-[#1a73e8] rounded-full animate-pulse"></span>
              {projects.length} Online
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f8f9fa] border-b border-[#f1f3f4] text-[10px] font-black uppercase tracking-[0.2em] text-[#5f6368]">
                <tr>
                  <th className="px-12 py-6">Identifier</th>
                  <th className="px-8 py-6">Architecture</th>
                  <th className="px-8 py-6">Process CPU</th>
                  <th className="px-8 py-6">Memory</th>
                  <th className="px-8 py-6">Deployment Status</th>
                  <th className="px-12 py-6 text-right">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f4]">
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-12 py-20 text-center text-[#5f6368] italic font-medium">No active instances found. Deploy your first repository above!</td>
                  </tr>
                ) : projects.map((project: any) => (
                  <tr key={project.name} className="hover:bg-[#fcfdfe] transition-colors group">
                    <td className="px-12 py-9">
                      <div className="font-extrabold text-[#1a73e8] group-hover:underline cursor-pointer text-base tracking-tight">{project.name}</div>
                      <div className="text-[11px] text-[#5f6368] mt-1 font-medium opacity-60 italic">Managed by PM2 Cloud Agent</div>
                    </td>
                    <td className="px-8 py-9">
                      <span className="bg-[#f1f3f4] px-4 py-1.5 rounded-full font-black text-[10px] text-[#5f6368] uppercase tracking-wider border border-[#dadce0]">LXC / Custom</span>
                    </td>
                    <td className="px-8 py-9 font-mono font-bold text-sm text-[#202124]">{project.cpu}%</td>
                    <td className="px-8 py-9 font-bold text-sm text-[#202124]">{project.memory}</td>
                    <td className="px-8 py-9">
                      <span className="flex items-center gap-2.5 text-sm font-black text-[#34a853]">
                        <div className="w-2.5 h-2.5 bg-[#34a853] rounded-full shadow-[0_0_8px_rgba(52,168,83,0.4)]"></div>
                        <u>ONLINE</u>
                      </span>
                    </td>
                    <td className="px-12 py-9 text-right">
                      <div className="flex justify-end gap-3">
                        <button title="Restart" className="p-4 hover:bg-[#e8f0fe] rounded-[24px] text-[#5f6368] hover:text-[#1a73e8] transition-all"><RefreshCcw className="w-5 h-5" /></button>
                        <button title="Stop" className="p-4 hover:bg-[#f1f3f4] rounded-[24px] text-[#5f6368] transition-all"><Square className="w-5 h-5 fill-current" /></button>
                        <button title="Terminal" className="p-4 hover:bg-[#f1f3f4] rounded-[24px] text-[#1a73e8] transition-all"><TerminalIcon className="w-5 h-5" /></button>
                        <button title="Destroy" className="p-4 hover:bg-[#fce8e6] rounded-[24px] text-[#d93025] transition-all active:scale-90"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 right-10 p-4">
         <p className="text-[10px] font-bold text-[#dadce0] uppercase tracking-widest">Powered by AquosOS Node Engine</p>
      </footer>
    </div>
  );
}

export default App;
