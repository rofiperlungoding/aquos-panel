import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import {
  X,
  GitBranch,
  GitCommitHorizontal,
  Code,
  HardDrive,
  Clock,
  RotateCcw,
  Save,
  Plus,
  Trash2,
  ScrollText,
  Settings,
  Info,
  RefreshCcw,
  Globe,
  Sparkles
} from 'lucide-react';
import { useToast } from './Toast';

const API_URL = '/api';

interface ProjectDetailProps {
  projectName: string | null;
  onClose: () => void;
  onAction?: (name: string, action: string) => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ projectName, onClose }) => {
  const [detail, setDetail] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [logs, setLogs] = useState({ stdout: '', stderr: '' });
  const [envEntries, setEnvEntries] = useState<{ key: string; value: string }[]>([]);
  const [updating, setUpdating] = useState(false);
  const [savingEnv, setSavingEnv] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement>(null);
  const { addToast } = useToast();

  const fetchDetail = async () => {
    if (!projectName) return;
    try {
      const res = await axios.get(`${API_URL}/projects/${projectName}`);
      setDetail(res.data);
      // Set env entries
      const envVars = res.data.envVars || {};
      setEnvEntries(Object.entries(envVars).map(([key, value]) => ({ key, value: String(value) })));
    } catch (e) {
      addToast('error', 'Failed to load project details');
    }
  };

  const fetchLogs = async () => {
    if (!projectName) return;
    try {
      const res = await axios.get(`${API_URL}/projects/${projectName}/logs?lines=200`);
      setLogs(res.data);
    } catch (e) {
      addToast('error', 'Failed to load logs');
    }
  };

  useEffect(() => {
    if (projectName) {
      setActiveTab('overview');
      fetchDetail();
    }
  }, [projectName]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
      const intv = setInterval(fetchLogs, 5000);
      return () => clearInterval(intv);
    }
  }, [activeTab, projectName]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const handleUpdate = async () => {
    if (!projectName) return;
    setUpdating(true);
    try {
      await axios.post(`${API_URL}/projects/${projectName}/update`);
      addToast('success', 'Project updated', 'Pulled latest code and restarted.');
      fetchDetail();
    } catch (e: any) {
      addToast('error', 'Update failed', e.response?.data?.error || e.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveEnv = async () => {
    if (!projectName) return;
    setSavingEnv(true);
    try {
      const envVars: Record<string, string> = {};
      envEntries.forEach(e => {
        if (e.key.trim()) envVars[e.key.trim()] = e.value;
      });
      await axios.post(`${API_URL}/projects/${projectName}/env`, { envVars });
      addToast('success', 'Environment saved', 'Process restarted with new variables.');
      fetchDetail();
    } catch (e: any) {
      addToast('error', 'Failed to save env', e.response?.data?.error || e.message);
    } finally {
      setSavingEnv(false);
    }
  };

  const handleAnalyzeError = async () => {
    if (!projectName) return;
    setIsAnalyzing(true);
    setAiAnalysis(null);
    try {
      const res = await axios.post(`${API_URL}/projects/${projectName}/analyze-error`);
      setAiAnalysis(res.data.analysis);
      addToast('success', 'Analysis Complete', 'AQUOS Sentinel has diagnosed the issue.');
    } catch (e: any) {
      addToast('error', 'AI Analysis failed', e.response?.data?.error || e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!projectName) return null;

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Info },
    { key: 'logs', label: 'Logs', icon: ScrollText },
    { key: 'env', label: 'Environment', icon: Settings },
    { key: 'git', label: 'Git', icon: GitBranch },
  ];

  const formatUptime = (timestamp: number) => {
    if (!timestamp) return '—';
    const diff = Date.now() - timestamp;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-end animate-[fadeIn_0.15s_ease-out]">
      <div className="w-full max-w-[620px] bg-white h-full shadow-2xl overflow-hidden flex flex-col animate-[slideLeft_0.25s_ease-out]">
        {/* Header */}
        <div className="px-8 pt-8 pb-4 border-b border-[#f1f3f4] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#e8f0fe] rounded-[18px] flex items-center justify-center">
              <Code className="w-6 h-6 text-[#1a73e8]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#202124]">{projectName}</h2>
              <div className="flex items-center gap-3 mt-1">
                {detail?.process && (
                  <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase ${
                    detail.process.status === 'online' ? 'text-[#34a853]' : 'text-[#ea4335]'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      detail.process.status === 'online' ? 'bg-[#34a853] shadow-[0_0_8px_#34a853]' : 'bg-[#ea4335]'
                    }`} />
                    {detail.process.status}
                  </span>
                )}
                {detail?.stack && (
                  <span className="text-[10px] font-bold text-[#5f6368] bg-[#f8f9fa] px-2 py-0.5 rounded-md">{detail.stack}</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-[#f8f9fa] rounded-xl transition-all">
            <X className="w-5 h-5 text-[#5f6368]" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-8 pt-4 flex gap-1 border-b border-[#f1f3f4] flex-shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 rounded-t-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                activeTab === tab.key
                  ? 'text-[#1a73e8] bg-[#e8f0fe] border-b-2 border-[#1a73e8]'
                  : 'text-[#5f6368] hover:bg-[#f8f9fa]'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {!detail ? (
            <div className="flex items-center justify-center h-full text-[#9aa0a6]">
              <RefreshCcw className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <>
              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Quick Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleUpdate}
                      disabled={updating}
                      className="flex-1 bg-[#1a73e8] text-white py-3.5 rounded-[18px] font-black text-[11px] uppercase tracking-wider shadow-lg shadow-[#1a73e8]/20 hover:bg-[#1557b0] transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      {updating ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                      {updating ? 'Updating...' : 'Pull & Restart'}
                    </button>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <InfoCard label="Port" value={detail.port ? `:${detail.port}` : '—'} icon={Globe} />
                    <InfoCard label="Stack" value={detail.stack} icon={Code} />
                    <InfoCard label="Uptime" value={detail.process ? formatUptime(detail.process.uptime) : '—'} icon={Clock} />
                    <InfoCard label="Disk" value={detail.diskSize || '—'} icon={HardDrive} />
                    <InfoCard label="Memory" value={detail.process ? `${Math.round(detail.process.memory / (1024*1024))} MB` : '—'} icon={HardDrive} />
                    <InfoCard label="Restarts" value={detail.process?.restarts?.toString() || '0'} icon={RotateCcw} />
                  </div>

                  {/* Repo */}
                  {detail.repoUrl && (
                    <div className="bg-[#f8f9fa] rounded-[20px] p-5 border border-[#f1f3f4]">
                      <div className="text-[9px] font-black uppercase tracking-widest text-[#5f6368] opacity-50 mb-2">Repository</div>
                      <a
                        href={detail.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[13px] font-bold text-[#1a73e8] hover:underline break-all"
                      >
                        {detail.repoUrl}
                      </a>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="bg-[#f8f9fa] rounded-[20px] p-5 border border-[#f1f3f4] space-y-2">
                    <div className="text-[9px] font-black uppercase tracking-widest text-[#5f6368] opacity-50 mb-3">Timeline</div>
                    {detail.deployedAt && (
                      <p className="text-[12px] font-bold text-[#5f6368]">
                        <span className="text-[#202124]">Deployed:</span> {new Date(detail.deployedAt).toLocaleString()}
                      </p>
                    )}
                    {detail.lastUpdated && (
                      <p className="text-[12px] font-bold text-[#5f6368]">
                        <span className="text-[#202124]">Last Update:</span> {new Date(detail.lastUpdated).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* LOGS TAB */}
              {activeTab === 'logs' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-[#5f6368]">Process Output</h3>
                    <button onClick={fetchLogs} className="p-2 hover:bg-[#f8f9fa] rounded-xl transition-all">
                      <RefreshCcw className="w-4 h-4 text-[#5f6368]" />
                    </button>
                  </div>
                  <pre
                    ref={logRef}
                    className="bg-[#1a1c22] text-[#d4d4d4] p-5 rounded-[20px] text-[11px] font-mono leading-relaxed overflow-auto max-h-[500px] whitespace-pre-wrap break-all"
                  >
                    {logs.stdout || '(no output)'}
                  </pre>
                  {logs.stderr && logs.stderr !== '(no error logs)' && (
                    <>
                      <div className="flex justify-between items-center mt-6 mb-2">
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-[#ea4335]">Errors</h3>
                        <button 
                          onClick={handleAnalyzeError}
                          disabled={isAnalyzing}
                          className="flex items-center gap-2 bg-[#fdf2f2] hover:bg-[#fce8e8] text-[#ea4335] px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shadow-sm disabled:opacity-50"
                        >
                          {isAnalyzing ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          {isAnalyzing ? 'Analyzing Logs...' : 'Ask AI Sentinel'}
                        </button>
                      </div>
                      <pre className="bg-[#2d1b1b] text-[#f8a8a8] p-5 rounded-[20px] text-[11px] font-mono leading-relaxed overflow-auto max-h-[300px] whitespace-pre-wrap break-all">
                        {logs.stderr}
                      </pre>
                    </>
                  )}

                  {/* AI Sentinel Analysis Result */}
                  {aiAnalysis && (
                    <div className="mt-6 bg-gradient-to-br from-[#eff3ff] to-[#f8faff] p-6 rounded-[24px] border border-[#d2e3fc] shadow-sm animate-[slideUp_0.3s_ease-out]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center shadow-lg shadow-[#1a73e8]/30">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-black text-[#1a73e8]">AQUOS Sentinel Diagnosis</h3>
                      </div>
                      <div className="prose prose-sm max-w-none prose-headings:font-black prose-headings:text-[#202124] prose-p:text-[#5f6368] prose-p:font-bold prose-code:text-[#1a73e8] prose-code:bg-[#e8f0fe] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-pre:bg-[#1a1c22] prose-pre:text-white prose-pre:p-4 prose-pre:rounded-xl">
                        <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ENV TAB */}
              {activeTab === 'env' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-[#5f6368]">Environment Variables</h3>
                    <button
                      onClick={() => setEnvEntries(prev => [...prev, { key: '', value: '' }])}
                      className="flex items-center gap-1.5 text-[11px] font-black text-[#1a73e8] hover:bg-[#e8f0fe] px-3 py-2 rounded-xl transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Variable
                    </button>
                  </div>

                  {/* PORT is always injected */}
                  <div className="flex items-center gap-3 bg-[#f8f9fa] p-3 rounded-[16px] border border-[#f1f3f4] opacity-60">
                    <input value="PORT" disabled className="flex-1 bg-transparent text-[12px] font-bold text-[#202124] outline-none" />
                    <input value={detail.port || 'auto'} disabled className="flex-1 bg-transparent text-[12px] font-bold text-[#5f6368] outline-none" />
                    <div className="w-9" />
                  </div>

                  {envEntries.map((entry, i) => (
                    <div key={i} className="flex items-center gap-3 bg-[#f8f9fa] p-3 rounded-[16px] border border-[#f1f3f4] group">
                      <input
                        value={entry.key}
                        onChange={e => {
                          const updated = [...envEntries];
                          updated[i].key = e.target.value;
                          setEnvEntries(updated);
                        }}
                        placeholder="KEY"
                        className="flex-1 bg-transparent text-[12px] font-bold text-[#202124] outline-none placeholder:text-[#dadce0] uppercase"
                      />
                      <input
                        value={entry.value}
                        onChange={e => {
                          const updated = [...envEntries];
                          updated[i].value = e.target.value;
                          setEnvEntries(updated);
                        }}
                        placeholder="value"
                        className="flex-1 bg-transparent text-[12px] font-bold text-[#5f6368] outline-none placeholder:text-[#dadce0]"
                      />
                      <button
                        onClick={() => setEnvEntries(prev => prev.filter((_, j) => j !== i))}
                        className="p-1.5 hover:bg-[#fde9e9] rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[#ea4335]" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={handleSaveEnv}
                    disabled={savingEnv}
                    className="w-full bg-[#34a853] text-white py-3.5 rounded-[18px] font-black text-[11px] uppercase tracking-wider shadow-lg shadow-[#34a853]/20 hover:bg-[#2d9249] transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {savingEnv ? 'Saving & Restarting...' : 'Save & Restart'}
                  </button>
                </div>
              )}

              {/* GIT TAB */}
              {activeTab === 'git' && (
                <div className="space-y-4">
                  {detail.git && !detail.git.error ? (
                    <>
                      <div className="bg-[#f8f9fa] rounded-[20px] p-5 border border-[#f1f3f4]">
                        <div className="flex items-center gap-2 mb-3">
                          <GitBranch className="w-4 h-4 text-[#1a73e8]" />
                          <span className="text-[13px] font-black text-[#202124]">{detail.git.branch}</span>
                        </div>
                        {detail.git.lastCommit && (
                          <div className="flex items-start gap-3 mt-3 pt-3 border-t border-[#f1f3f4]">
                            <GitCommitHorizontal className="w-4 h-4 text-[#5f6368] mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-[12px] font-bold text-[#202124]">{detail.git.lastCommit.message}</p>
                              <p className="text-[10px] font-bold text-[#5f6368] mt-1">
                                <code className="bg-[#e8f0fe] text-[#1a73e8] px-1.5 py-0.5 rounded">{detail.git.lastCommit.hash}</code>
                                <span className="ml-2">{detail.git.lastCommit.date}</span>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={handleUpdate}
                        disabled={updating}
                        className="w-full bg-[#1a73e8] text-white py-3.5 rounded-[18px] font-black text-[11px] uppercase tracking-wider shadow-lg shadow-[#1a73e8]/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        {updating ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        {updating ? 'Pulling...' : 'Git Pull & Restart'}
                      </button>
                    </>
                  ) : (
                    <div className="bg-[#f8f9fa] rounded-[20px] p-5 text-center">
                      <p className="text-[13px] font-bold text-[#5f6368]">Git info unavailable</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Small reusable info card
const InfoCard: React.FC<{ label: string; value: string; icon: any }> = ({ label, value, icon: Icon }) => (
  <div className="bg-[#f8f9fa] rounded-[18px] p-4 border border-[#f1f3f4]">
    <div className="flex items-center gap-2 mb-1.5">
      <Icon className="w-3.5 h-3.5 text-[#9aa0a6]" />
      <span className="text-[9px] font-black uppercase tracking-widest text-[#5f6368] opacity-50">{label}</span>
    </div>
    <p className="text-[16px] font-black text-[#202124]">{value}</p>
  </div>
);

export default ProjectDetail;
