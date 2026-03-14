'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { 
  Plus, 
  MessageSquare, 
  Settings, 
  Activity, 
  Clock, 
  Search, 
  LayoutDashboard, 
  Layers, 
  Database,
  Globe,
  FileText,
  Zap,
  ChevronRight,
  Loader2
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  namespace: string;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      });
      await res.json();
      setNewProject({ name: '', description: '' });
      setIsCreating(false);
      fetchProjects();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <main className="min-h-screen bg-[#030303] text-white selection:bg-blue-500/30">
      {/* Background Gradients */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <div className="max-w-[1400px] mx-auto flex min-h-screen">
        
        {/* Sidebar */}
        <aside className="w-72 border-r border-white/5 p-8 flex flex-col gap-10 hidden lg:flex">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              <Zap className="text-white fill-white" size={20} />
            </div>
            <span className="font-black text-2xl tracking-tighter">AI.AGENCY</span>
          </div>

          <nav className="flex flex-col gap-2">
            <Button variant="glass" className="justify-start gap-4 h-12 text-blue-400 border-blue-500/20 bg-blue-500/5">
              <LayoutDashboard size={18} /> Dashboard
            </Button>
            <Button variant="glass" className="justify-start gap-4 h-12 text-gray-400 hover:text-white border-transparent"
              onClick={() => window.location.href = '/leads'}
            >
              <FileText size={18} /> Leads Center
            </Button>
            <Button variant="glass" className="justify-start gap-4 h-12 text-gray-400 hover:text-white border-transparent">
              <Layers size={18} /> All Projects
            </Button>
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 p-8 lg:p-12 overflow-y-auto">
          
          {/* Top Bar */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl font-black tracking-tight mb-2">My AI Projects</h1>
              <p className="text-gray-500">Manage and deploy custom-trained AI agents for your clients.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative hidden sm:block">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input 
                  type="text" 
                  placeholder="Search projects..." 
                  className="bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-5 outline-none focus:border-blue-500/50 transition-all w-64 text-sm"
                />
              </div>
              <Button variant="primary" className="gap-2 h-12 px-6 shadow-xl shadow-blue-600/20" onClick={() => setIsCreating(true)}>
                <Plus size={20} />
                Create Project
              </Button>
            </div>
          </header>

          {/* Project List */}
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-blue-500" size={40} />
              <p className="text-gray-500 animate-pulse">Synchronizing your dashboard...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="glass border-dashed border-white/10 p-20 rounded-[2rem] flex flex-col items-center text-center gap-6">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
                <Layers className="text-gray-600" size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2">No Projects Found</h3>
                <p className="text-gray-500 max-w-sm mx-auto">Create your first project to start training AI agents on custom knowledge bases.</p>
              </div>
              <Button variant="primary" className="h-12 px-8" onClick={() => setIsCreating(true)}>Get Started</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div key={project.id} className="glass group rounded-[2rem] p-8 border border-white/5 hover:border-blue-500/20 transition-all hover:translate-y-[-4px] flex flex-col gap-6">
                  <div className="flex items-start justify-between">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Zap className="text-white fill-white" size={24} />
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${
                        project.status === 'ready' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 
                        project.status === 'training' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20 animate-pulse' :
                        'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                      }`}>
                        {project.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-black mb-2 tracking-tight truncate" title={project.name}>{project.name}</h3>
                    <p className="text-gray-400 text-sm line-clamp-2 leading-relaxed">
                      {project.description || 'No description provided. Start by adding a training source.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 overflow-hidden">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Namespace</p>
                      <p className="text-xs font-mono text-blue-400 truncate" title={project.namespace}>{project.namespace}</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 overflow-hidden">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1.5 truncate">
                        <Clock size={10} className="text-gray-600" />
                        Created
                      </p>
                      <p className="text-xs font-medium">{new Date(project.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2 mt-auto">
                    <Button 
                      variant="primary" 
                      className="flex-1 h-12 gap-2 shadow-lg"
                      onClick={() => window.location.href = `/project/${project.id}`}
                    >
                      Manage Training
                    </Button>
                    <Button 
                      variant="glass" 
                      className="h-12 w-12 p-0 group-hover:bg-white/10"
                      onClick={() => window.location.href = `/chat?project=${project.id}`}
                    >
                      <MessageSquare size={18} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="max-w-md w-full glass rounded-[2.5rem] p-10 border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300">
            <h2 className="text-3xl font-black mb-2 tracking-tight">Create AI Project</h2>
            <p className="text-gray-500 mb-8">Set up a new autonomous agent environment.</p>
            
            <form onSubmit={handleCreate} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Project Name</label>
                <input 
                  autoFocus
                  required
                  type="text" 
                  value={newProject.name}
                  onChange={e => setNewProject({...newProject, name: e.target.value})}
                  placeholder="e.g., Luxury Real Estate Bot"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 outline-none focus:border-blue-500 transition-all text-white font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Description</label>
                <textarea 
                  value={newProject.description}
                  onChange={e => setNewProject({...newProject, description: e.target.value})}
                  placeholder="Briefly describe the purpose of this agent..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 h-32 outline-none focus:border-blue-500 transition-all text-white text-sm"
                />
              </div>
              
              <div className="flex gap-4 pt-4">
                <Button 
                  type="button"
                  variant="glass" 
                  className="flex-1 h-14 rounded-2xl"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  variant="primary" 
                  className="flex-1 h-14 rounded-2xl shadow-xl shadow-blue-600/20"
                >
                  Create
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
