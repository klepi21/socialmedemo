'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { 
  ChevronLeft, 
  Globe, 
  FileText, 
  MessageSquare, 
  Zap, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ExternalLink,
  Plus,
  Settings
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  namespace: string;
  status: string;
}

interface Source {
  id: string;
  type: string;
  content: string;
  status: string;
}

export default function ProjectPage() {
  const params = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  
  // Dynamic Backend Routing
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || ''; 
  const isRemote = BACKEND_URL.startsWith('http'); // Only treat as remote if it's a full URL
  const [loading, setLoading] = useState(true);
  const [trainingJob, setTrainingJob] = useState<any>(null);
  const [stats, setStats] = useState({ vectors: 0, sources: 0 });
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isUpdatingPrompt, setIsUpdatingPrompt] = useState(false);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [newSource, setNewSource] = useState({ type: 'url', content: '' });
  const [isWiping, setIsWiping] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (params?.id) {
      fetchProject();
    }
  }, [params?.id]);

  const fetchProject = async () => {
    const id = params?.id as string;
    if (!id) return;
    
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) {
        const contentType = res.headers.get('content-type');
        let errorMessage = `Server Error (Status: ${res.status})`;
        
        if (contentType && contentType.includes('application/json')) {
          const errorData = await res.json();
          errorMessage = errorData.error || errorData.details || errorMessage;
        } else {
          const text = await res.text();
          errorMessage = `HTML Error: ${text.slice(0, 150)}...`;
        }
        throw new Error(errorMessage);
      }
      const data = await res.json();
      setProject(data.project);
      setSources(data.sources);
      setPages(data.pages || []);
      setStats(data.stats);
      setSystemPrompt(data.project.system_prompt || '');
      
      if (data.activeJobId) {
        monitorJob(data.activeJobId);
      }
    } catch (err: any) {
      console.error('Fetch project error:', err);
      setAuthError(err.message); // Reusing authError for general page error
    } finally {
      setLoading(false);
    }
  };

  // Poll for stats every 3 seconds if we have a project and stats.vectors is 0 or training is active
  useEffect(() => {
    if (!project || !isAuthenticated) return;
    
    // Only poll if no vectors yet or job is active
    if (stats.vectors === 0 || trainingJob) {
      const interval = setInterval(() => {
        fetch(`/api/projects/${project.id}`)
          .then(res => res.json())
          .then(data => {
            if (data.stats) setStats(data.stats);
            if (data.project) setProject(prev => ({ ...prev, status: data.project.status } as Project));
          })
          .catch(err => console.error("Polling error:", err));
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [project?.id, stats.vectors, trainingJob, isAuthenticated]);

  const addSource = async () => {
    if (!newSource.content) return;
    const { id } = params as any;
    try {
      await fetch(`/api/projects/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSource),
      });
      setNewSource({ ...newSource, content: '' });
      fetchProject();
    } catch (err) {
      console.error(err);
    }
  };

  const startTraining = async (sourceId?: string, url?: string, text?: string) => {
    const { id: projectId } = params as any;
    try {
      const endpoint = isRemote ? `${BACKEND_URL}/train` : '/api/train';
      console.log(`[TRAIN] Starting job at: ${endpoint} (Remote: ${isRemote})`);
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId,
          sourceId,
          url,
          manualKnowledge: text
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`[TRAIN ERROR] Status: ${res.status}. Body snippet: ${text.slice(0, 200)}`);
        throw new Error(`Server returned ${res.status}: ${text.slice(0, 50)}...`);
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error(`[TRAIN ERROR] Expected JSON but got ${contentType}. Body snippet: ${text.slice(0, 200)}`);
        throw new Error("Server returned non-JSON response. Check if Backend URL is correct.");
      }

      const data = await res.json();
      const { jobId } = data;
      monitorJob(jobId);
    } catch (err: any) {
      console.error("[TRAIN FATAL]", err);
      alert(`Training failed: ${err.message}`);
    }
  };
  const wipeKnowledge = async () => {
    setIsWiping(true);
    setShowWipeConfirm(false);
    const id = params?.id as string;
    try {
      // 1. Wipe DB (always local API to maintain DB security)
      await fetch(`/api/projects/${id}/wipe`, { method: 'POST' });
      
      // 2. If remote, ensure we tell the VPS to stop as well
      if (isRemote) {
        await fetch(`${BACKEND_URL}/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: id })
        }).catch(e => console.warn("Could not stop remote job", e));
      }

      setPages([]);
      setSources([]);
      setStats({ vectors: 0, sources: 0 });
      setTrainingJob(null);
      fetchProject();
    } catch (err) {
      console.error(err);
    } finally {
      setIsWiping(false);
    }
  };

  const deleteProject = async () => {
    if (!confirm('☢️ EXTREME ACTION: This will delete the project and all its data FOREVER. Proceed?')) return;
    const id = params?.id as string;
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      window.location.href = '/';
    } catch (err) {
      console.error(err);
    }
  };

  const monitorJob = (jobId: string) => {
    const url = isRemote ? `${BACKEND_URL}/status/${jobId}` : `/api/train?jobId=${jobId}`;
    const eventSource = new EventSource(url);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setTrainingJob(data);
        if (data.status === 'success' || data.status === 'error') {
          eventSource.close();
          fetchProject();
        }
      } catch (e) {
        console.error("MonitorJob JSON parse error:", e, "Raw data:", event.data);
      }
    };
    eventSource.onerror = (err) => {
      console.error('SSE Error:', err);
    };
  };

  if (loading) return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-500" size={40} />
    </div>
  );

  if (!project) return (
    <div className="min-h-screen bg-[#030303] text-white flex flex-col items-center justify-center gap-4">
      <AlertCircle size={40} className="text-red-500" />
      <p className="text-xl font-bold">Project not found or error loading</p>
      {authError && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl max-w-md text-center">
          <p className="text-red-500 text-sm font-mono">{authError}</p>
        </div>
      )}
      <Button variant="glass" onClick={() => window.location.href = '/'}>Back to Dashboard</Button>
    </div>
  );

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (project.name === 'Socialme' && password === '12345') {
      setIsAuthenticated(true);
      setAuthError('');
    } else if (project.name === 'Avgouste' && password === 'avg123!:') {
      setIsAuthenticated(true);
      setAuthError('');
    } else if (project.name !== 'Socialme' && project.name !== 'Avgouste' && password === '12345') {
      // Fallback for other test projects
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Incorrect password');
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#030303] text-white flex flex-col items-center justify-center p-4">
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.05),transparent_50%)]" />
        
        <div className="max-w-md w-full glass p-10 rounded-[2.5rem] border border-white/10 shadow-2xl space-y-8 animate-in zoom-in-95">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Settings size={32} className="text-blue-500" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter">Access Required</h1>
            <p className="text-gray-500">Enter password for {project.name}</p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <input 
                type="password" 
                value={password}
                onChange={e => { setPassword(e.target.value); setAuthError(''); }}
                placeholder="Password"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 outline-none focus:border-blue-500 transition-all text-white text-center tracking-widest"
                autoFocus
              />
              {authError && <p className="text-red-500 text-xs text-center font-bold px-4">{authError}</p>}
            </div>
            <Button type="submit" variant="primary" className="w-full h-14 rounded-2xl shadow-xl shadow-blue-600/20 text-lg">
              Unlock Training
            </Button>
            <Button type="button" variant="glass" className="w-full h-14 rounded-2xl" onClick={() => window.location.href = '/'}>
              Cancel
            </Button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#030303] text-white">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.05),transparent_50%)]" />

      <div className="max-w-6xl mx-auto p-8 lg:p-12">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-6">
            <Button variant="glass" className="w-12 h-12 p-0 rounded-2xl" onClick={() => window.location.href = '/'}>
              <ChevronLeft size={20} />
            </Button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-4xl font-black tracking-tighter">{project.name}</h1>
                <span className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  project.status === 'ready' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'
                }`}>
                  {project.status}
                </span>
              </div>
              <p className="text-gray-500 text-sm">Namespace: {project.namespace}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <Button 
                variant="glass" 
                className="text-red-500 border-red-500/20 hover:bg-red-500/10 h-14 px-4 shadow-xl"
                onClick={deleteProject}
              >
                Delete Project
              </Button>
              <Button 
                variant="primary" 
                className="gap-2 h-14 px-8 shadow-2xl shadow-blue-600/20 disabled:opacity-50 disabled:grayscale"
                disabled={stats.vectors === 0}
                onClick={() => window.location.href = `/chat?project=${project.id}`}
              >
                <MessageSquare size={20} />
                Launch AI Consultant
              </Button>
            </div>
            {stats.vectors === 0 && (
              <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-tighter animate-pulse">
                Train the AI first to chat
              </span>
            )}
          </div>
        </header>

        {/* AI Configuration Section */}
        <section className="mb-12 glass p-8 rounded-[2rem] border-blue-500/10 bg-gradient-to-br from-blue-500/5 to-transparent space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center">
                <Settings size={20} className="text-blue-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold">AI Personality & Logic</h2>
                <p className="text-sm text-gray-500">Define the core identity and rules for this agent.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="glass" 
                className="text-xs h-10 px-4 gap-2 border-yellow-500/20 text-yellow-500"
                disabled={isEnhancingPrompt}
                onClick={async () => {
                  setIsEnhancingPrompt(true);
                  try {
                    const res = await fetch(`/api/projects/${params.id}/enhance-prompt`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ currentPrompt: systemPrompt }),
                    });
                    const data = await res.json();
                    if (data.enhancedPrompt) setSystemPrompt(data.enhancedPrompt);
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setIsEnhancingPrompt(false);
                  }
                }}
              >
                {isEnhancingPrompt ? <Loader2 className="animate-spin" size={14} /> : (
                  <>
                    <Zap size={14} className="fill-yellow-500" />
                    Auto-Enhance
                  </>
                )}
              </Button>
              <Button 
                variant="primary" 
                className="text-xs h-10 px-6"
                disabled={isUpdatingPrompt}
                onClick={async () => {
                  setIsUpdatingPrompt(true);
                  try {
                    await fetch(`/api/projects/${params.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ system_prompt: systemPrompt }),
                    });
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setIsUpdatingPrompt(false);
                    fetchProject();
                  }
                }}
              >
                {isUpdatingPrompt ? <Loader2 className="animate-spin" size={14} /> : 'Save Prompt'}
              </Button>
            </div>
          </div>

          <textarea 
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 h-40 outline-none focus:border-blue-500 transition-all text-sm font-medium leading-relaxed resize-none"
            placeholder="Describe how the AI should behave, its tone of voice, and any specific rules it must follow..."
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
          />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Left Column: Sources & Management */}
          <div className="lg:col-span-2 space-y-12">
            
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Globe size={20} className="text-blue-500" />
                  Training Sources
                </h2>
                <div className="flex items-center gap-4 relative">
                  {showWipeConfirm ? (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-lg">
                      <span className="text-[9px] text-red-500 font-black uppercase">Are you sure?</span>
                      <button onClick={wipeKnowledge} className="text-[9px] text-white bg-red-500 px-2 py-0.5 rounded font-black uppercase hover:bg-red-600 transition-colors">Yes, Wipe</button>
                      <button onClick={() => setShowWipeConfirm(false)} className="text-[9px] text-gray-400 hover:text-white transition-colors">Cancel</button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowWipeConfirm(true)}
                      disabled={isWiping}
                      className="text-[10px] text-red-500 font-bold uppercase tracking-widest hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {isWiping ? 'Wiping...' : 'Wipe Knowledge'}
                    </button>
                  )}
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-widest">{sources.length} Sources Found</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {sources.map((source) => (
                  <div key={source.id} className="glass p-6 rounded-[1.5rem] border border-white/5 flex items-center justify-between hover:border-white/10 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-gray-400">
                        {source.type === 'url' ? <Globe size={20} /> : <FileText size={20} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white mb-0.5">{source.content}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">{source.type}</p>
                      </div>
                    </div>
                    <Button 
                      variant="glass" 
                      className="text-xs h-10 px-4 gap-2 text-blue-400"
                      onClick={() => source.type === 'url' ? startTraining(source.id, source.content) : startTraining(source.id, undefined, source.content)}
                    >
                      <Zap size={14} className="fill-blue-400" />
                      Sync Knowledge
                    </Button>
                  </div>
                ))}

                <div className="glass p-6 rounded-[1.5rem] border-dashed border-white/10 space-y-4">
                  <div className="flex gap-4">
                    <select 
                      className="bg-white/5 border border-white/10 rounded-xl px-4 text-xs font-bold uppercase outline-none focus:border-blue-500"
                      value={newSource.type}
                      onChange={e => setNewSource({...newSource, type: e.target.value})}
                    >
                      <option value="url">URL</option>
                      <option value="text">Text</option>
                    </select>
                    <input 
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-sm outline-none focus:border-blue-500"
                      placeholder={newSource.type === 'url' ? "https://client-site.com" : "Paste raw knowledge text..."}
                      value={newSource.content}
                      onChange={e => setNewSource({...newSource, content: e.target.value})}
                    />
                    <Button variant="glass" className="h-12 w-12 p-0" onClick={addSource}>
                      <Plus size={20} />
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            {/* Knowledge Inventory Section */}
            {pages.length > 0 && (
              <section className="space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <FileText size={20} className="text-blue-500" />
                    Knowledge Inventory
                  </h2>
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{pages.length} Pages Learned</span>
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {pages.map((page, idx) => (
                    <div key={idx} className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-white/5 transition-colors group">
                      <div className="flex flex-col gap-0.5 max-w-[80%]">
                        <span className="text-xs font-bold text-white truncate">{page.title}</span>
                        <span className="text-[10px] text-gray-500 truncate">{page.url}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-blue-500/50">{(page.char_count / 1000).toFixed(1)}k chars</span>
                        <a href={page.url} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right Column: Status & Progress */}
          <div className="space-y-8">
            <div className="glass p-8 rounded-[2rem] border-blue-500/20 bg-blue-500/5 space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Clock size={18} className="text-blue-500" />
                Live Status
              </h3>

              {trainingJob ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">
                      {trainingJob.status === 'scraping' 
                        ? `Scanning: ${trainingJob.totalDiscovered} found / ${trainingJob.current} learned` 
                        : trainingJob.status}
                    </span>
                    <span className="text-xs font-bold">{trainingJob.progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${trainingJob.status === 'scraping' ? '30' : trainingJob.progress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed italic line-clamp-1">
                    "{trainingJob.message}"
                  </p>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                    <Zap size={12} className="text-yellow-500 fill-yellow-500" />
                    Vectors created: {trainingJob.chunks || 0}
                  </div>
                </div>
              ) : project.status === 'training' ? (
                <div className="text-center py-8 space-y-4">
                  <Loader2 size={40} className="mx-auto text-blue-500 animate-spin" />
                  <p className="text-sm text-blue-400">Recovering training status...</p>
                  <button 
                    onClick={async () => {
                      const id = params?.id;
                      await fetch(`/api/projects/${id}/reset-status`, { method: 'POST' });
                      fetchProject();
                    } }
                    className="text-[10px] text-gray-500 hover:text-white underline uppercase tracking-widest font-bold"
                  >
                    Force Reset Status
                  </button>
                </div>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <CheckCircle2 size={40} className="mx-auto text-gray-700" />
                  <p className="text-sm text-gray-500">Wait for training to start.</p>
                </div>
              )}
            </div>

            <div className="glass p-8 rounded-[2rem] border-white/5 space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400">Quick Metrics</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                  <p className="text-2xl font-black">{stats.vectors}</p>
                  <p className="text-[9px] text-gray-500 uppercase">Vectors</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                  <p className="text-2xl font-black">{stats.sources}</p>
                  <p className="text-[9px] text-gray-500 uppercase">Knowledge Segments</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
