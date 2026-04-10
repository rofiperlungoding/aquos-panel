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
  const [stats, setStats] = useState<any>(null);
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

  if (!stats) return <div className="h-screen bg-[#f8f9fa] flex items-center justify-center font-bold text-[#1a73e8] animate-pulse">Initializing Aquos Engine...</div>;

  return (
    <div className="flex h-screen bg-[#f8f9fa] text-[#202124] font-['Plus_Jakarta_Sans'] antialiased">
      {/* Sidebar - Pro Compact */}
      <aside className="w-60 bg-white border-r border-[#dadce0] flex flex-col shadow-[1px_0_10px_rgba(0,0,0,0.01)] transition-all">
        <div className="h-14 flex items-center px-5 border-b border-[#f1f3f4]">
          <div className="flex flex-col">
            <span className="text-[#1a73e8] font-bold text-base flex items-center gap-2">
              <Server className="w-5 h-5" /> Aquos Cloud
            </span>
            <span className="text-[9px] text-[#5f6368] font-bold tracking-[0.1em] uppercase opacity-60">
              Enterprise v1.1.9
            </span>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {updateAvailable && (
             <button 
               onClick={triggerUpdate}
               disabled={updating}
               className="w-full mb-4 bg-[#fce8e6] text-[#d93025] p-2.5 rounded-[12px] text-[10px] font-black flex items-center gap-2 border border-[#d93025]/5"
             >
               <RefreshCcw className={`w-3.5 h-3.5 ${updating ? 'animate-spin' : ''}`} />
               {updating ? 'APPLYING...' : 'RELEASE DETECTED'}
             </button>
          )}

          <div className="bg-[#e8f0fe] text-[#1a73e8] p-2.5 rounded-[12px] flex items-center gap-2.5 font-bold text-[11px] shadow-sm border border-[#d2e3fc]">
            <Activity className="w-4 h-4" /> Global Compute
          </div>
          <div className="text-[#5f6368] p-2.5 rounded-[12px] flex items-center gap-2.5 font-bold text-[11px] hover:bg-[#f1f3f4] transition-all opacity-80">
            <TerminalIcon className="w-4 h-4" /> Shell Hub
          </div>
          <div className="text-[#5f6368] p-2.5 rounded-[12px] flex items-center gap-2.5 font-bold text-[11px] hover:bg-[#f1f3f4] transition-all opacity-80">
            <SettingsIcon className="w-4 h-4" /> Resources
          </div>
        </nav>

        <div className="p-3 border-t border-[#f1f3f4]">
          <div className="bg-[#f8f9fa] p-2.5 rounded-[12px] border border-[#f1f3f4]">
            <div className="text-[8px] font-black text-[#5f6368] uppercase tracking-[0.1em] mb-1 opacity-50">Local Engine</div>
            <div className="flex items-center gap-2 text-[10px] font-black text-[#34a853]">
              <div className="w-1.5 h-1.5 bg-[#34a853] rounded-full animate-pulse"></div>
              Jakarta-Node-1
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 bg-[#f8f9fa]">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-[#202124] tracking-tight">Cloud Infrastructure Overview</h1>
        </header>

        {/* Improved Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-[20px] border border-[#f1f3f4] shadow-sm group">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[9px] font-black uppercase tracking-[0.05em] text-[#5f6368]"><u>Global CPU</u></span>
              <Activity className="text-[#1a73e8] w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-black text-[#202124]">{stats.system.cpu}%</div>
            <div className="text-[10px] text-[#5f6368] mt-3 pt-3 border-t border-[#f1f3f4] flex justify-between">
               <span>Panel Instance:</span>
               <span className="font-bold text-[#1a73e8]">{stats.panel.cpu}%</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[20px] border border-[#f1f3f4] shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[9px] font-black uppercase tracking-[0.05em] text-[#5f6368]"><u>Memory Allocation</u></span>
              <Database className="text-[#1a73e8] w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-black text-[#202124]">{stats.system.ram.percentage}%</div>
            <div className="text-[10px] text-[#5f6368] mt-3 pt-3 border-t border-[#f1f3f4] space-y-1">
               <div className="flex justify-between"><span>Used (OS+Apps):</span> <span className="font-bold">{stats.system.ram.used} MB</span></div>
               <div className="flex justify-between italic"><span>Free Available:</span> <span>{stats.system.ram.free} MB</span></div>
               <div className="flex justify-between opacity-60"><span>Total Physical:</span> <span>{stats.system.ram.total} GB</span></div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[20px] border border-[#f1f3f4] shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[9px] font-black uppercase tracking-[0.05em] text-[#5f6368]"><u>Physical Storage</u></span>
              <HardDrive className="text-[#1a73e8] w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-black text-[#202124]">{stats.system.disk.percentage}%</div>
            <div className="text-[10px] text-[#5f6368] mt-3 pt-3 border-t border-[#f1f3f4] space-y-1">
               <div className="flex justify-between"><span>Allocated:</span> <span className="font-bold">{stats.system.disk.used} GB</span></div>
               <div className="flex justify-between"><span>Volume Total:</span> <span>{stats.system.disk.total} GB</span></div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[20px] border border-[#f1f3f4] shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[9px] font-black uppercase tracking-[0.05em] text-[#5f6368]"><u>Availability</u></span>
              <RefreshCcw className="text-[#1a73e8] w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-black text-[#202124]">{Math.floor(stats.system.uptime/3600)}h {Math.floor((stats.system.uptime%3600)/60)}m {Math.floor(stats.system.uptime%60)}s</div>
            <div className="text-[10px] text-[#5f6368] mt-3 pt-3 border-t border-[#f1f3f4] flex justify-between">
               <span>Network Latency:</span>
               <span className="text-[#34a853] font-black">{ping}</span>
            </div>
          </div>
        </div>

        {/* Provision Section - Compact */}
        <div className="bg-white rounded-[24px] border border-[#f1f3f4] mb-6 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-[#f1f3f4] bg-[#fcfdfe]">
            <h2 className="text-sm font-black text-[#202124] uppercase tracking-wide">Deploy New Workload</h2>
          </div>
          <div className="p-6">
            <form onSubmit={handleDeploy} className="flex gap-3">
              <div className="relative flex-1">
                <Code className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1a73e8]" />
                <input 
                  type="text" 
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="Insert Git URI..."
                  className="w-full pl-10 pr-4 py-3 bg-[#f8f9fa] border border-transparent focus:border-[#d2e3fc] rounded-[14px] outline-none text-[12px] font-bold"
                />
              </div>
              <button 
                disabled={deploying}
                className="bg-[#1a73e8] text-white px-8 py-3 rounded-[14px] font-black text-[12px] uppercase hover:bg-[#1557b0] transition-all shadow-md shadow-[#1a73e8]/20"
              >
                {deploying ? 'Provisioning...' : 'Deploy'}
              </button>
            </form>
          </div>
        </div>

        {/* Active Workloads Table - Professionalized */}
        <div className="bg-white rounded-[24px] border border-[#f1f3f4] overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-[#f1f3f4] flex justify-between items-center bg-[#fcfdfe]">
            <h2 className="text-sm font-black text-[#202124] uppercase tracking-wide">Active Instances</h2>
            <div className="text-[9px] font-black bg-[#e8f0fe] text-[#1a73e8] px-2.5 py-1 rounded-full border border-[#d2e3fc]">
               RUNNING: {projects.length}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f8f9fa] border-b border-[#f1f3f4] text-[8px] font-black uppercase tracking-[0.1em] text-[#5f6368]">
                <tr>
                  <th className="px-6 py-4">Instance Identity</th>
                  <th className="px-4 py-4">Runtime</th>
                  <th className="px-4 py-4">CPU %</th>
                  <th className="px-4 py-4">RAM Allocation</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f4]">
                {projects.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-[#5f6368] text-[11px] italic font-medium">No services currently deployed in this region.</td></tr>
                ) : projects.map((project: any) => (
                  <tr key={project.name} className="hover:bg-[#fcfdfe] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-[#1a73e8] text-sm">{project.name}</div>
                      <div className="text-[8px] text-[#5f6368] font-black opacity-40">ENV: PRODUCTON</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="bg-[#f1f3f4] px-2 py-0.5 rounded-md text-[9px] font-black text-[#5f6368] border border-[#dadce0]">NODE_JS</span>
                    </td>
                    <td className="px-4 py-4 font-mono font-bold text-[11px]">{project.cpu}%</td>
                    <td className="px-4 py-4 font-bold text-[11px]">
                      {project.memory ? (Math.round(parseInt(project.memory) / (1024*1024))) : '0'} MB
                    </td>
                    <td className="px-4 py-4">
                      <span className="flex items-center gap-1.5 text-[10px] font-black text-[#34a853]">
                        <div className="w-1.5 h-1.5 bg-[#34a853] rounded-full"></div>
                        HEALTHY
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button title="Restart" className="p-2 hover:bg-[#e8f0fe] rounded-lg text-[#5f6368] hover:text-[#1a73e8] transition-all"><RefreshCcw className="w-3.5 h-3.5" /></button>
                        <button title="Stop" className="p-2 hover:bg-[#f1f3f4] rounded-lg text-[#5f6368] transition-all"><Square className="w-3.5 h-3.5 fill-current" /></button>
                        <button title="Destroy" className="p-2 hover:bg-[#fce8e6] rounded-lg text-[#d93025] transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-0 right-6 p-2 pointer-events-none">
         <p className="text-[7px] font-black text-[#dadce0] uppercase tracking-[0.2em]">Aquos Core Enterprise Ecosystem</p>
      </footer>
    </div>
  );
}

export default App;
