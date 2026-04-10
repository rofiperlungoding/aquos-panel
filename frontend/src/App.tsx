import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Server, Cpu, HardDrive, Play, Square, RefreshCw, Trash2, Code,
  Terminal, Settings, LayoutDashboard, Copy
} from 'lucide-react';

const API_URL = '/api';

function App() {
  const [stats, setStats] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [repoUrl, setRepoUrl] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [ping, setPing] = useState<string>('--');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Fetch data
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
    const updateIntv = setInterval(checkUpdate, 30000); // Check updates every 30s
    return () => {
      clearInterval(intv);
      clearInterval(updateIntv);
    };
  }, []);

  const triggerUpdate = async () => {
    setUpdating(true);
    try {
      await axios.post(`${API_URL}/system/update`);
      // Wait a few seconds for the backend to reload, then hard refresh
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
      alert("Deploy failed!");
    } finally {
      setDeploying(false);
    }
  };

  const executeAction = async (name: string, action: string) => {
    try {
      await axios.post(`${API_URL}/projects/${name}/action`, { action });
      fetchData();
    } catch (e) {
      alert(`Action ${action} failed`);
    }
  };

  const instanceTotalRamMB = projects.reduce((acc, p) => acc + (p.memory || 0), 0) / 1024 / 1024;
  const instanceTotalCpu = projects.reduce((acc, p) => acc + (p.cpu || 0), 0);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fa] text-[#202124] font-['Roboto']">
      
      {/* Sidebar - GCP Style */}
      <aside className="w-64 bg-white border-r border-[#dadce0] flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-[#dadce0]">
          <div className="flex flex-col">
            <span className="text-[#1a73e8] font-bold text-lg flex items-center gap-2">
              <Server className="w-6 h-6" /> Aquos Cloud
            </span>
            <span className="text-[10px] text-[#5f6368] font-bold tracking-widest uppercase mt-0.5 opacity-70">
              Enterprise v1.1.2
            </span>
          </div>
        </div>
        <nav className="flex-1 py-4">
          <a href="#" className="flex items-center px-6 py-3 bg-[#e8f0fe] text-[#1967d2] font-medium border-l-4 border-[#1a73e8]">
            <LayoutDashboard className="w-5 h-5 mr-3" /> Universal Compute
          </a>
          <a href="#" className="flex items-center px-6 py-3 text-[#5f6368] hover:bg-[#f1f3f4] font-medium border-l-4 border-transparent">
            <Terminal className="w-5 h-5 mr-3" /> Cloud Shell
          </a>
          <a href="#" className="flex items-center px-6 py-3 text-[#5f6368] hover:bg-[#f1f3f4] font-medium border-l-4 border-transparent">
            <Settings className="w-5 h-5 mr-3" /> Settings
          </a>
        </nav>

        {/* Sidebar Footer Updater */}
        {updateAvailable && (
          <div className="p-4 border-t border-[#dadce0] bg-blue-50/50">
            <div className="flex items-center gap-2 text-[10px] text-blue-700 font-bold uppercase tracking-widest mb-2 px-1">
              <RefreshCw className={`w-3 h-3 ${updating ? 'animate-spin' : ''}`} />
              System Update UI
            </div>
            <button 
              onClick={triggerUpdate}
              disabled={updating}
              className="w-full bg-[#1a73e8] text-white py-2 px-3 rounded text-[11px] font-bold hover:bg-[#1765cc] transition shadow-sm disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {updating ? 'Processing...' : 'Seamless Reload'}
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto flex flex-col">

        {/* Header */}
        <header className="h-16 bg-white border-b border-[#dadce0] flex items-center px-8 shadow-sm shrink-0 z-10">
          <h1 className="text-xl text-[#202124] font-medium">Dashboard</h1>
        </header>

        <div className="p-8 max-w-7xl mx-auto w-full">
          
          {/* Top Panel: System Status (GCP dense cards) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 border border-[#dadce0] rounded shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-start">
                <span className="text-[#5f6368] text-sm font-medium uppercase tracking-wider">CPU</span>
                <Cpu className="w-5 h-5 text-[#1a73e8]" />
              </div>
              <div className="mt-2 text-2xl font-normal">
                {stats ? `${Math.round(stats.cpu?.usageObj[0]*100)}%` : '--'}
              </div>
              <div className="text-xs text-[#5f6368] mt-1 space-y-0.5">
                <div>Instances Total: <span className="font-medium text-[#202124]">{instanceTotalCpu.toFixed(1)}%</span></div>
                <div>HP System: <span className="font-medium text-[#202124]">{stats ? Math.max(0, Math.round(stats.cpu?.usageObj[0]*100) - instanceTotalCpu).toFixed(1) : '--'}%</span></div>
              </div>
            </div>
            <div className="bg-white p-4 border border-[#dadce0] rounded shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-start">
                <span className="text-[#5f6368] text-sm font-medium uppercase tracking-wider">Memory</span>
                <Server className="w-5 h-5 text-[#1a73e8]" />
              </div>
              <div className="mt-2 text-2xl font-normal">
                {stats ? `${stats.ram?.percentage}%` : '--'}
              </div>
              <div className="text-xs text-[#5f6368] mt-1 space-y-0.5">
                <div>Instances: <span className="font-medium text-[#202124]">{instanceTotalRamMB.toFixed(1)} MB</span></div>
                <div>HP System: <span className="font-medium text-[#202124]">{stats ? ((stats.ram?.used / 1024 / 1024) - instanceTotalRamMB).toFixed(1) : '--'} MB</span></div>
                <div>Physical Total: <span className="font-medium text-[#202124]">{stats ? (stats.ram?.total / 1024 / 1024 / 1024).toFixed(1) + ' GB' : ''}</span></div>
              </div>
            </div>
             <div className="bg-white p-4 border border-[#dadce0] rounded shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-start">
                <span className="text-[#5f6368] text-sm font-medium uppercase tracking-wider">Storage</span>
                <HardDrive className="w-5 h-5 text-[#1a73e8]" />
              </div>
              <div className="mt-2 text-2xl font-normal">
                {stats?.disk ? `${stats.disk.percentage}%` : '--'}
              </div>
            </div>
             <div className="bg-white p-4 border border-[#dadce0] rounded shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-start">
                <span className="text-[#5f6368] text-sm font-medium uppercase tracking-wider">Sys Uptime & Net</span>
                <RefreshCw className="w-5 h-5 text-[#1a73e8]" />
              </div>
              <div className="mt-2 text-2xl font-normal">
                {stats ? `${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m` : '--'}
              </div>
              <div className="text-xs text-[#5f6368] mt-1">
                Ping Latency: <span className="font-medium text-[#202124]">{ping}</span>
              </div>
            </div>
          </div>

          {/* Create Instance Card */}
          <div className="bg-white border border-[#dadce0] rounded shadow-sm mb-8 overflow-hidden">
            <div className="bg-[#f8f9fa] border-b border-[#dadce0] px-6 py-3">
              <h2 className="text-[#202124] font-medium">Create New App Engine Instance</h2>
            </div>
            <div className="p-6">
              <form onSubmit={handleDeploy} className="flex gap-4">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Code className="h-5 w-5 text-[#5f6368]" />
                  </div>
                  <input 
                    type="text" 
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    className="pl-10 w-full outline-none border border-[#dadce0] rounded px-4 py-2 text-sm focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] transition"
                    placeholder="https://github.com/username/repository.git"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={deploying}
                  className="bg-[#1a73e8] hover:bg-[#1557b0] text-white px-6 py-2 rounded font-medium text-sm transition shadow-sm disabled:opacity-50"
                >
                  {deploying ? 'PROVISIONING...' : 'DEPLOY'}
                </button>
              </form>
              <p className="text-xs text-[#5f6368] mt-3">
                Auto-detects Node.js, Python, or Go environments and provisions instantly.
              </p>
            </div>
          </div>

          {/* Instances Table */}
          <div className="bg-white border border-[#dadce0] rounded shadow-sm overflow-hidden">
            <div className="flex justify-between items-center bg-[#f8f9fa] border-b border-[#dadce0] px-6 py-3">
              <h2 className="text-[#202124] font-medium">Running Instances</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white border-b border-[#dadce0] text-[#5f6368]">
                  <tr>
                    <th className="px-6 py-3 font-medium uppercase text-xs tracking-wider">Instance Name</th>
                    <th className="px-6 py-3 font-medium uppercase text-xs tracking-wider">Engine</th>
                    <th className="px-6 py-3 font-medium uppercase text-xs tracking-wider">CPU</th>
                    <th className="px-6 py-3 font-medium uppercase text-xs tracking-wider">RAM</th>
                    <th className="px-6 py-3 font-medium uppercase text-xs tracking-wider">Status</th>
                    <th className="px-6 py-3 font-medium uppercase text-xs tracking-wider">Port / Network</th>
                    <th className="px-6 py-3 font-medium uppercase text-xs tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dadce0]">
                  {projects.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-[#5f6368]">
                        No active instances. Deploy a repository to get started.
                      </td>
                    </tr>
                  ) : projects.map((p, idx) => (
                    <tr key={idx} className="hover:bg-[#f1f3f4] transition">
                      <td className="px-6 py-4 font-medium text-[#1a73e8]">{p.name}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800`}>
                          {p.stack || 'Custom'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-normal text-[#5f6368]">
                        {(p.cpu || 0).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 font-normal text-[#5f6368]">
                        {((p.memory || 0) / 1024 / 1024).toFixed(1)} MB
                      </td>
                      <td className="px-6 py-4 flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${p.status === 'online' ? 'bg-[#0f9d58]' : 'bg-[#db4437]'}`}></div>
                        <span className="capitalize">{p.status}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 cursor-pointer hover:bg-gray-200 p-1 rounded w-max" title="Copy to clipboard">
                          <span>{p.port ? `:${p.port}` : '--'}</span>
                          <Copy className="w-3 h-3 text-[#5f6368]" />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => executeAction(p.name, p.status === 'online' ? 'restart' : 'start')} className="p-1.5 text-[#1a73e8] hover:bg-[#e8f0fe] rounded transition" title={p.status === 'online' ? 'Restart' : 'Start'}>
                            {p.status === 'online' ? <RefreshCw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <button onClick={() => executeAction(p.name, 'stop')} className="p-1.5 text-[#5f6368] hover:bg-[#f1f3f4] rounded transition" title="Stop">
                            <Square className="w-4 h-4 fill-current opacity-70" />
                          </button>
                          <button onClick={() => executeAction(p.name, 'delete')} className="p-1.5 text-[#db4437] hover:bg-red-50 rounded transition" title="Delete Instance">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}

export default App;
