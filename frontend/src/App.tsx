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
  Square,
  Play,
  RotateCcw,
  Box,
  ChevronRight,
  TrendingUp,
  Clock,
  Lock,
  Unlock,
  LogOut,
  ShieldCheck,
  GitBranch,
  Rocket,
  Download,
  Zap,
  AlertTriangle
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area 
} from 'recharts';
import TerminalView from './components/TerminalView';
import DeployModal from './components/DeployModal';
import ProjectDetail from './components/ProjectDetail';
import { ToastProvider, useToast } from './components/Toast';

const API_URL = '/api';
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTOCOL}//${window.location.host}`;

function AppContent() {
  const [token, setToken] = useState(localStorage.getItem('aquos_token'));
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('compute');
  const [projects, setProjects] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [deploying, setDeploying] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateCountdown, setUpdateCountdown] = useState<number | null>(null);
  const { addToast } = useToast();

  // Check for panel updates
  const checkForPanelUpdate = async () => {
    try {
      const res = await axios.get(`${API_URL}/system/check-update`);
      setUpdateAvailable(res.data.updateAvailable);
    } catch {
      // silently fail — not critical
    }
  };

  const handlePanelUpdate = async () => {
    setUpdateCountdown(5);
    try {
      axios.post(`${API_URL}/system/update`).catch(e => console.error(e));
      
      let timeLeft = 5;
      const timer = setInterval(() => {
        timeLeft -= 1;
        if (timeLeft <= 0) {
          clearInterval(timer);
          window.location.reload();
        } else {
          setUpdateCountdown(timeLeft);
        }
      }, 1000);
    } catch (e: any) {
      addToast('error', 'Update trigger failed', e.message);
      setUpdateCountdown(null);
    }
  };

  // Configure Axios with Token + check for updates
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      checkForPanelUpdate();
    }
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/login`, { password });
      const newToken = res.data.token;
      setToken(newToken);
      localStorage.setItem('aquos_token', newToken);
      setLoginError('');
    } catch (err) {
      setLoginError('Invalid access key');
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('aquos_token');
    delete axios.defaults.headers.common['Authorization'];
  };

  const fetchData = async () => {
    if (!token) return;
    try {
      const pRes = await axios.get(`${API_URL}/projects?t=${Date.now()}`);
      setProjects(pRes.data.projects);
      
      const sRes = await axios.get(`${API_URL}/stats?t=${Date.now()}`);
      const newStats = sRes.data;
      setStats(newStats);

      if (newStats.history && newStats.history.length > 0) {
        setHistory(newStats.history.map((h: any) => ({
          time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          cpu: h.cpu,
          ram: h.ram
        })));
      } else {
        setHistory(prev => {
          const entry = {
            time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            cpu: parseFloat(newStats.system.cpu),
            ram: newStats.system.ram.percentage
          };
          return [...prev, entry].slice(-30);
        });
      }
    } catch (e: any) {
      if (e.response?.status === 401 || e.response?.status === 403) {
        handleLogout();
      }
    }
  };

  const handleAction = async (name: string, action: string) => {
    if (action === 'delete') {
      setDeleteConfirm(name);
      return;
    }
    try {
      await axios.post(`${API_URL}/projects/${name}/action`, { action });
      addToast('success', `${action.charAt(0).toUpperCase() + action.slice(1)}ed`, `${name} has been ${action}ed.`);
      fetchData();
    } catch (e: any) {
      addToast('error', 'Action failed', e.response?.data?.error || e.message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const name = deleteConfirm;
    setDeleteConfirm(null);
    try {
      await axios.post(`${API_URL}/projects/${name}/action`, { action: 'delete' });
      addToast('success', 'Deleted', `${name} has been removed.`);
      fetchData();
    } catch (e: any) {
      addToast('error', 'Delete failed', e.response?.data?.error || e.message);
    }
  };

  const handleUpdate = async (name: string) => {
    try {
      await axios.post(`${API_URL}/projects/${name}/update`);
      addToast('success', 'Updated', `${name} pulled latest code and restarted.`);
      fetchData();
    } catch (e: any) {
      addToast('error', 'Update failed', e.response?.data?.error || e.message);
    }
  };

  useEffect(() => {
    if (token) {
        fetchData();
        const intv = setInterval(fetchData, 3000);
        
        // Local ticker for uptime to make it look "alive"
        const ticker = setInterval(() => {
          setStats((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              system: {
                ...prev.system,
                uptime: prev.system.uptime + 1
              }
            };
          });
        }, 1000);

        return () => {
          clearInterval(intv);
          clearInterval(ticker);
        };
    }
  }, [token]);

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl) return;
    setDeploying(true);
    setShowDeployModal(true);

    try {
      await axios.post(`${API_URL}/projects`, { repoUrl, branch });
      setRepoUrl('');
      setBranch('main');
      fetchData();
    } catch (e: any) {
      addToast('error', 'Deployment failed', e.response?.data?.error || e.message);
    } finally {
      setDeploying(false);
    }
  };

  const onDeployModalClose = () => {
    setShowDeployModal(false);
    setActiveTab('resources');
    fetchData();
  };

  // ─── LOGIN SCREEN ───────────────────────────────────────────────────────────
  if (!token) return (
    <div className="h-screen bg-[#0f1115] flex flex-col items-center justify-center font-['Plus_Jakarta_Sans'] p-6 overflow-hidden relative">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#1a73e8] rounded-full blur-[120px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#ea4335] rounded-full blur-[120px] opacity-10 animate-pulse" style={{animationDelay: '1s'}}></div>
      
      <div className="w-full max-w-md bg-[#1a1c22]/80 backdrop-blur-xl p-10 rounded-[40px] border border-white/5 shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-[#1a73e8] to-[#0d47a1] rounded-[28px] flex items-center justify-center shadow-lg shadow-[#1a73e8]/30 mb-6 group transition-all hover:rotate-6">
            <Box className="w-10 h-10 text-white fill-white/20" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter">AQUOS CORE</h1>
          <p className="text-[11px] font-black text-[#5f6368] uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-[#1a73e8] rounded-full"></div> SEAMLESS NODE ACCESS
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <div className="relative group">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#5f6368] group-focus-within:text-[#1a73e8] transition-colors" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Secure Access Key"
                className="w-full pl-14 pr-6 py-5 bg-white/5 border border-white/10 focus:border-[#1a73e8]/50 focus:bg-white/[0.08] rounded-[24px] outline-none text-white text-sm font-bold transition-all placeholder:text-[#5f6368]"
                autoFocus
              />
            </div>
            {loginError && <p className="text-[#ea4335] text-[10px] font-black uppercase tracking-wider mt-3 ml-2 animate-bounce">{loginError}</p>}
          </div>

          <button className="w-full bg-[#1a73e8] hover:bg-[#1557b0] text-white py-5 rounded-[24px] font-black text-sm uppercase tracking-widest shadow-xl shadow-[#1a73e8]/20 transition-all active:scale-95 flex items-center justify-center gap-3">
            <Unlock className="w-4 h-4" /> Authenticate
          </button>
        </form>
        
        <p className="mt-8 text-center text-[9px] font-bold text-[#5f6368] uppercase tracking-[0.2em] opacity-40">
          End-to-End Encrypted Tunnel Active
        </p>
      </div>
    </div>
  );

  // ─── LOADING ────────────────────────────────────────────────────────────────
  if (!stats) return <div className="h-screen bg-[#f8f9fa] flex flex-col items-center justify-center font-bold text-[#1a73e8] animate-pulse">
    <Server className="w-12 h-12 mb-4 animate-bounce" />
    <span className="text-xl">Establishing Uplink...</span>
  </div>;

  // ─── MAIN APP ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#f8f9fa] text-[#202124] font-['Plus_Jakarta_Sans'] antialiased overflow-hidden">
      {/* Navigation Rail */}
      <aside className="w-64 bg-white border-r border-[#dadce0] flex flex-col shadow-[1px_0_15px_rgba(0,0,0,0.02)] z-10">
        <div className="h-16 flex items-center px-6 border-b border-[#f1f3f4]">
          <div className="flex flex-col">
            <span className="text-[#1a73e8] font-black text-xl flex items-center gap-2 leading-none">
              <Box className="w-6 h-6 fill-[#1a73e8]/10" /> AQUOS
            </span>
            <span className="text-[10px] text-[#202124] font-black tracking-[0.05em] uppercase opacity-40 mt-1">Global Access v2.0.0</span>
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

        <div className="p-4 border-t border-[#f1f3f4] space-y-3">
          <div className="bg-[#f8f9fa] p-4 rounded-[20px] border border-[#f1f3f4]">
            <div className="flex items-center justify-between mb-3 text-[10px] font-black uppercase tracking-widest text-[#5f6368] opacity-50">
               <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Secure Node</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] font-black text-[#202124]">
              <div className="w-2 h-2 bg-[#34a853] rounded-full shadow-[0_0_8px_#34a853]"></div>
              Jakarta-HQ-Global
            </div>
            <div className="mt-2 text-[10px] font-bold text-[#5f6368]">
              {projects.filter((p: any) => p.status === 'online').length} / {projects.length} instances online
            </div>
          </div>

          {/* Update Available Banner */}
          {updateAvailable && (
            <button
              onClick={handlePanelUpdate}
              className="w-full bg-gradient-to-r from-[#fbbc04] to-[#f9ab00] p-4 rounded-[20px] flex items-center gap-3 group hover:scale-[1.02] transition-all shadow-lg shadow-[#fbbc04]/20 animate-[slideUp_0.3s_ease-out]"
            >
              <div className="w-10 h-10 bg-white/20 rounded-[14px] flex items-center justify-center backdrop-blur-sm">
                <Download className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <div className="text-[11px] font-black text-white uppercase tracking-wider">Update Available</div>
                <div className="text-[9px] font-bold text-white/70 uppercase tracking-widest">Tap to install latest</div>
              </div>
              <Zap className="w-4 h-4 text-white/80 ml-auto group-hover:scale-110 transition-transform" />
            </button>
          )}
          
          <button onClick={handleLogout} className="w-full p-3 rounded-[18px] flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest text-[#ea4335] hover:bg-[#ea4335]/5 transition-all">
            <LogOut className="w-3.5 h-3.5" /> Terminate Session
          </button>
        </div>
      </aside>

      {/* Main Framework */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#fafbfc]">
        
        {/* TAB: OPERATIONS HUB */}
        {activeTab === 'compute' && (
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
             <header className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-black text-[#202124] tracking-tight">System Infrastructure</h1>
                  <p className="text-[12px] text-[#5f6368] font-bold opacity-60">Real-time health of global hardware nodes</p>
                </div>
                <div className="flex gap-2">
                    <div className="bg-white border px-4 py-2 rounded-2xl shadow-sm text-xs font-bold flex items-center gap-2">
                       <Clock className="w-4 h-4 text-[#1a73e8]" /> 
                       {(() => {
                          const s = stats?.system?.uptime || 0;
                          const h = Math.floor(s / 3600);
                          const m = Math.floor((s % 3600) / 60);
                          const sec = Math.floor(s % 60);
                          return `${h}h ${m}m ${sec}s Online`;
                       })()}
                    </div>
                </div>
             </header>

             {/* Stats Grid */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Global Load (CPU) */}
                <div className="bg-white p-6 rounded-[32px] border border-[#f1f3f4] shadow-sm flex items-center gap-5 group hover:border-[#1a73e8]/20 transition-all">
                   <div className="w-16 h-16 bg-[#e8f0fe] rounded-[24px] flex items-center justify-center">
                      <Activity className="text-[#1a73e8] w-8 h-8" />
                   </div>
                   <div className="flex-1">
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#5f6368] opacity-50 mb-1">Global Load</div>
                      <div className="text-3xl font-black text-[#202124] flex items-baseline gap-2">
                        {stats.system.cpu}%
                        <span className="text-[10px] font-bold text-[#5f6368] opacity-60">system</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#f1f3f4] rounded-full overflow-hidden flex">
                          <div className="h-full bg-[#1a73e8]" style={{ width: `${Math.min(100, stats.panel.cpu)}%` }}></div>
                          <div className="h-full bg-[#34a853]" style={{ width: `${Math.min(100, projects.reduce((acc: number, p: any) => acc + (p.process?.cpu || 0), 0))}%` }}></div>
                        </div>
                        <div className="text-[9px] font-black text-[#5f6368] uppercase">
                          Apps: {projects.reduce((acc: number, p: any) => acc + (p.process?.cpu || 0), 0).toFixed(1)}%
                        </div>
                      </div>
                   </div>
                </div>

                {/* Memory Index (RAM) */}
                <div className="bg-white p-6 rounded-[32px] border border-[#f1f3f4] shadow-sm flex items-center gap-5 group hover:border-[#1a73e8]/20 transition-all">
                   <div className="w-16 h-16 bg-[#fde9e9] rounded-[24px] flex items-center justify-center">
                      <Database className="text-[#ea4335] w-8 h-8" />
                   </div>
                   <div className="flex-1">
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#5f6368] opacity-50 mb-1">Memory Index</div>
                      <div className="text-3xl font-black text-[#202124] flex items-baseline gap-2">
                        {stats.system.ram.percentage}%
                        <span className="text-[10px] font-bold text-[#5f6368] opacity-60">used</span>
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-[9px] font-black tracking-wider uppercase text-[#5f6368]">
                          <span>Panel: {stats.panel.mem}MB</span>
                          <span>Apps: {(projects.reduce((acc: number, p: any) => acc + (p.process?.memory || 0), 0) / (1024*1024)).toFixed(0)}MB</span>
                        </div>
                        <div className="h-1 bg-[#f1f3f4] rounded-full overflow-hidden flex">
                          <div className="h-full bg-[#ea4335]" style={{ width: `${(parseFloat(stats.panel.mem) / (parseFloat(stats.system.ram.total)*1024)) * 100}%` }}></div>
                          <div className="h-full bg-orange-400" style={{ width: `${(projects.reduce((acc: number, p: any) => acc + (p.process?.memory || 0), 0) / (parseFloat(stats.system.ram.total)*1024*1024*1024)) * 100}%` }}></div>
                        </div>
                      </div>
                   </div>
                </div>

                {/* Storage Hub (Disk) */}
                <div className="bg-white p-6 rounded-[32px] border border-[#f1f3f4] shadow-sm flex items-center gap-5 group hover:border-[#1a73e8]/20 transition-all">
                   <div className="w-16 h-16 bg-[#e6f4ea] rounded-[24px] flex items-center justify-center">
                      <HardDrive className="text-[#34a853] w-8 h-8" />
                   </div>
                   <div className="flex-1">
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#5f6368] opacity-50 mb-1">Storage Hub</div>
                      <div className="text-3xl font-black text-[#202124] flex items-baseline gap-2">
                        {stats.system.disk.percentage}%
                        <span className="text-[10px] font-bold text-[#5f6368] opacity-60">full</span>
                      </div>
                      <div className="mt-2 flex justify-between items-center text-[9px] font-black text-[#5f6368] uppercase tracking-wider">
                        <span>{stats.system.disk.used} GB / {stats.system.disk.total} GB</span>
                        <div className="w-12 h-1 bg-[#34a853]/20 rounded-full overflow-hidden">
                          <div className="h-full bg-[#34a853]" style={{ width: `${stats.system.disk.percentage}%` }}></div>
                        </div>
                      </div>
                   </div>
                </div>
             </div>

             {/* Deploy Box */}
             <div className="bg-[#1a73e8] rounded-[40px] p-10 text-white shadow-2xl shadow-[#1a73e8]/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform">
                   <Rocket className="w-48 h-48 -rotate-12" />
                </div>
                <div className="relative z-10 max-w-2xl">
                   <h2 className="text-2xl font-black tracking-tight mb-2">Deploy from GitHub</h2>
                   <p className="text-sm font-bold text-white/70 mb-8 italic">Paste a repo URL → auto-clones the <code className="bg-white/10 px-1.5 py-0.5 rounded text-white/90 not-italic">server/</code> folder → installs deps → runs on PM2.</p>
                   
                   <form onSubmit={handleDeploy} className="space-y-4">
                     <div className="flex gap-4">
                       <div className="flex-1 relative">
                         <input 
                           type="text" 
                           value={repoUrl}
                           onChange={(e) => setRepoUrl(e.target.value)}
                           placeholder="https://github.com/user/repo"
                           className="w-full pl-6 pr-6 py-4 bg-white/10 border-2 border-white/20 focus:border-white/40 rounded-[22px] outline-none text-sm font-bold placeholder:text-white/30 backdrop-blur-md transition-all"
                         />
                       </div>
                       <div className="w-36 relative">
                         <GitBranch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                         <input 
                           type="text" 
                           value={branch}
                           onChange={(e) => setBranch(e.target.value)}
                           placeholder="main"
                           className="w-full pl-10 pr-4 py-4 bg-white/10 border-2 border-white/20 focus:border-white/40 rounded-[22px] outline-none text-sm font-bold placeholder:text-white/30 transition-all"
                         />
                       </div>
                       <button 
                         disabled={deploying || !repoUrl}
                         className="bg-white text-[#1a73e8] px-10 py-4 rounded-[22px] font-black text-sm uppercase shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                         {deploying ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                         {deploying ? 'DEPLOYING...' : 'DEPLOY'}
                       </button>
                     </div>
                   </form>
                </div>
             </div>

             {/* Active Projects Preview */}
             <div className="bg-white border border-[#f1f3f4] rounded-[32px] p-6">
                <div className="flex justify-between items-center mb-6 px-2">
                   <h3 className="text-sm font-black text-[#202124] uppercase tracking-wider">Active Instances</h3>
                   <span className="text-[10px] font-black text-[#1a73e8] bg-[#e8f0fe] px-3 py-1 rounded-full uppercase">{projects.length} Total</span>
                </div>

                {projects.length === 0 ? (
                  <div className="text-center py-12">
                    <Rocket className="w-12 h-12 text-[#dadce0] mx-auto mb-4" />
                    <p className="text-[14px] font-black text-[#9aa0a6]">No instances deployed yet</p>
                    <p className="text-[11px] font-bold text-[#dadce0] mt-1">Paste a GitHub URL above to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projects.slice(0, 5).map((p: any) => (
                       <div key={p.name} className="flex items-center justify-between p-4 bg-[#fbfcfd] border border-[#f1f3f4] rounded-[24px] hover:border-[#1a73e8]/20 transition-all cursor-pointer group" onClick={() => setSelectedProject(p.name)}>
                          <div className="flex items-center gap-4">
                             <div className="w-10 h-10 bg-white shadow-sm border border-[#f1f3f4] rounded-xl flex items-center justify-center">
                                <Code className="w-5 h-5 text-[#1a73e8]" />
                             </div>
                             <div>
                                <div className="text-sm font-extrabold text-[#202124]">{p.name}</div>
                                <div className="text-[9px] font-bold text-[#5f6368] uppercase tracking-widest flex items-center gap-2">
                                  {p.stack || 'NODEJS'} · :{p.port}
                                </div>
                             </div>
                          </div>
                          <div className="flex items-center gap-4">
                             <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase ${p.status === 'online' ? 'text-[#34a853]' : 'text-[#ea4335]'}`}>
                               <div className={`w-2 h-2 rounded-full ${p.status === 'online' ? 'bg-[#34a853] shadow-[0_0_8px_#34a853]' : 'bg-[#ea4335]'}`}></div>
                               {p.status}
                             </span>
                             <ChevronRight className="text-[#dadce0] w-5 h-5 group-hover:text-[#1a73e8] transition-colors" />
                          </div>
                       </div>
                    ))}
                  </div>
                )}
             </div>
          </div>
        )}

        {/* TAB: WORKLOADS & INSIGHTS */}
        {activeTab === 'resources' && (
          <div className="flex-1 overflow-y-auto p-8 space-y-8">
             <header className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-black text-[#202124]">Performance Analytics</h1>
                  <p className="text-[12px] text-[#5f6368] font-bold opacity-60">Deep-scan workload telemetry and historical logs</p>
                </div>
                <div className="flex gap-2">
                   <button onClick={fetchData} className="p-3 bg-white border border-[#dadce0] rounded-2xl shadow-sm hover:bg-[#f8f9fa] transition-all"><RotateCcw className="w-5 h-5 text-[#5f6368]" /></button>
                </div>
             </header>

             {/* Charts */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-[32px] border border-[#f1f3f4] shadow-sm">
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xs font-black text-[#5f6368] uppercase tracking-widest">CPU Load History (%)</h3>
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
                            <Area type="monotone" dataKey="cpu" stroke="#1a73e8" strokeWidth={3} fillOpacity={1} fill="url(#colorCpu)" />
                         </AreaChart>
                      </ResponsiveContainer>
                   </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border border-[#f1f3f4] shadow-sm">
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xs font-black text-[#5f6368] uppercase tracking-widest">Memory Index (%)</h3>
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
                            <Area type="monotone" dataKey="ram" stroke="#ea4335" strokeWidth={3} fillOpacity={1} fill="url(#colorRam)" />
                         </AreaChart>
                      </ResponsiveContainer>
                   </div>
                </div>
             </div>

             {/* Projects Table */}
             <div className="bg-white rounded-[32px] border border-[#f1f3f4] overflow-hidden shadow-sm">
                {projects.length === 0 ? (
                  <div className="text-center py-16">
                    <Box className="w-12 h-12 text-[#dadce0] mx-auto mb-4" />
                    <p className="text-[14px] font-black text-[#9aa0a6]">No workloads running</p>
                    <p className="text-[11px] font-bold text-[#dadce0] mt-1">Deploy a project from the Operations Hub</p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-[#f8f9fa] border-b border-[#f1f3f4] text-[9px] font-black uppercase tracking-[0.2em] text-[#5f6368]">
                     <tr>
                       <th className="px-8 py-5">Instance</th>
                       <th className="px-4 py-5 text-center">Port</th>
                       <th className="px-4 py-5 text-center">CPU</th>
                       <th className="px-4 py-5 text-center">RAM</th>
                       <th className="px-4 py-5">Status</th>
                       <th className="px-8 py-5 text-right">Actions</th>
                     </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f3f4]">
                     {projects.map((p: any) => (
                       <tr key={p.name} className="hover:bg-[#fcfdfe] transition-colors group">
                         <td className="px-8 py-5">
                           <button onClick={() => setSelectedProject(p.name)} className="text-left hover:text-[#1a73e8] transition-colors">
                             <div className="text-[14px] font-extrabold text-[#1a73e8]">{p.name}</div>
                             <div className="text-[9px] font-bold text-[#5f6368] uppercase tracking-widest">{p.stack || 'NODEJS'}</div>
                           </button>
                         </td>
                         <td className="px-4 py-5 text-center">
                           <span className="text-[11px] font-black text-[#202124] bg-[#f8f9fa] px-2 py-1 rounded-lg">:{p.port}</span>
                         </td>
                         <td className="px-4 py-5 text-center text-[11px] font-black">{p.cpu}%</td>
                         <td className="px-4 py-5 text-center font-black text-[11px]">{Math.round(p.memory / (1024*1024))} MB</td>
                         <td className="px-4 py-5">
                            <span className={`flex items-center gap-2 text-[10px] font-black uppercase ${p.status === 'online' ? 'text-[#34a853]' : 'text-[#ea4335]'}`}>
                              <div className={`w-2 h-2 rounded-full ${p.status === 'online' ? 'bg-[#34a853] shadow-[0_0_10px_#34a853]' : 'bg-[#ea4335]'}`}></div>
                              {p.status}
                            </span>
                         </td>
                         <td className="px-8 py-5 text-right">
                            <div className="flex justify-end gap-2">
                               {/* Update */}
                               <button onClick={() => handleUpdate(p.name)} className="p-2.5 bg-[#f8f9fa] hover:bg-[#1a73e8] hover:text-white rounded-[16px] transition-all" title="Pull & Restart">
                                 <RefreshCcw className="w-3.5 h-3.5" />
                               </button>
                               {/* Start/Stop */}
                               {p.status === 'online' ? (
                                 <button onClick={() => handleAction(p.name, 'stop')} className="p-2.5 bg-[#f8f9fa] hover:bg-[#202124] hover:text-white rounded-[16px] transition-all" title="Stop"><Square className="w-3.5 h-3.5 fill-current" /></button>
                               ) : (
                                 <button onClick={() => handleAction(p.name, 'start')} className="p-2.5 bg-[#f8f9fa] hover:bg-[#34a853] hover:text-white rounded-[16px] transition-all" title="Start"><Play className="w-3.5 h-3.5 fill-current" /></button>
                               )}
                               {/* Restart */}
                               <button onClick={() => handleAction(p.name, 'restart')} className="p-2.5 bg-[#f8f9fa] hover:bg-[#1a73e8] hover:text-white rounded-[16px] transition-all" title="Restart"><RotateCcw className="w-3.5 h-3.5" /></button>
                               {/* Delete */}
                               <button onClick={() => handleAction(p.name, 'delete')} className="p-2.5 bg-[#f8f9fa] hover:bg-[#ea4335] hover:text-white rounded-[16px] transition-all" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                         </td>
                       </tr>
                     ))}
                    </tbody>
                  </table>
                )}
             </div>
          </div>
        )}

        {/* TAB: CLOUD SHELL */}
        {activeTab === 'shell' && (
          <div className="flex-1 flex flex-col bg-[#0f1115] overflow-hidden">
             {/* Compact Header */}
             <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <TerminalIcon className="w-4 h-4 text-[#1a73e8]" />
                  <span className="text-sm font-black text-white tracking-tight">Cloud Shell</span>
                  <span className="text-[9px] font-bold text-[#555] uppercase tracking-widest">Real-time PTY Bridge</span>
                </div>
                <div className="text-[9px] font-black text-[#ea4335] flex items-center gap-2 bg-[#ea4335]/10 px-2.5 py-1 rounded-full uppercase">
                  <div className="w-1.5 h-1.5 bg-[#ea4335] rounded-full animate-ping" />
                  termux-wake-lock recommended
                </div>
             </div>
             {/* Terminal fills remaining space */}
             <div className="flex-1 min-h-0 overflow-hidden">
                <TerminalView wsUrl={WS_URL} />
             </div>
          </div>
        )}
      </main>

      {/* ─── Modals & Overlays ──────────────────────────────────────────────── */}

      {/* Deploy Progress Modal */}
      <DeployModal
        isOpen={showDeployModal}
        onClose={onDeployModalClose}
        wsUrl={WS_URL}
        onDeployComplete={fetchData}
        repoUrl={repoUrl}
        branch={branch}
      />

      {/* Project Detail Slide-Over */}
      <ProjectDetail
        projectName={selectedProject}
        onClose={() => setSelectedProject(null)}
        onAction={handleAction}
      />

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-[#fde9e9] rounded-[20px] flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-[#ea4335]" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#202124]">Delete Instance?</h3>
                <p className="text-[12px] font-bold text-[#5f6368]">This will remove <strong>{deleteConfirm}</strong> and its files.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-4 rounded-[20px] font-black text-sm text-[#5f6368] bg-[#f8f9fa] hover:bg-[#f1f3f4] transition-all">
                Cancel
              </button>
              <button onClick={confirmDelete} className="flex-1 py-4 rounded-[20px] font-black text-sm text-white bg-[#ea4335] shadow-lg shadow-[#ea4335]/20 hover:bg-[#d33] transition-all active:scale-95">
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Countdown Overlay */}
      {updateCountdown !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-6 animate-[fadeIn_0.3s_ease-out]">
          <div className="w-24 h-24 bg-gradient-to-br from-[#fbbc04] to-[#f9ab00] rounded-full flex items-center justify-center mb-6 animate-pulse shadow-[0_0_50px_rgba(251,188,4,0.4)]">
            <Zap className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Applying Update...</h2>
          <p className="text-[#9aa0a6] font-bold text-lg mb-8 tracking-widest uppercase text-[12px]">Panel restarts in {updateCountdown}s</p>
          
          <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#fbbc04] to-[#f9ab00] transition-all duration-1000 ease-linear" 
              style={{ width: `${((5 - updateCountdown) / 5) * 100}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
