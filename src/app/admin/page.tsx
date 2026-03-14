'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Globe, Loader2, CheckCircle2, AlertCircle, BarChart3, Binary, BookOpen, Users } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
  const [url, setUrl] = useState('');
  const [manualKnowledge, setManualKnowledge] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState({ pages: 0, chunks: 0 });

  const updateUI = (data: any) => {
    setMessage(data.message);
    setProgress(data.progress || 0);
    setStats({ pages: data.total || data.current || 0, chunks: data.chunks || 0 });
    
    if (data.status === 'success') {
      setStatus('success');
    } else if (data.status === 'error') {
      setStatus('error');
    } else if (data.status === 'scraping' || data.status === 'vectorizing') {
      setStatus('loading');
    }
  };

  const handleTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url && !manualKnowledge) return;

    setStatus('loading');
    setProgress(0);
    setMessage('Initialising training job...');

    try {
      const res = await fetch('/api/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, manualKnowledge }),
      });

      if (!res.ok) throw new Error('Failed to start training');

      const streamUrl = url ? url : 'manual-' + Date.now();
      const eventSource = new EventSource(`/api/train?url=${encodeURIComponent(streamUrl)}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        updateUI(data);

        if (data.status === 'success' || data.status === 'error') {
          eventSource.close();
        }
      };
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  return (
    <div className="min-h-screen pt-24 px-4 bg-black text-white">
      <div className="max-w-2xl mx-auto space-y-8 pb-12">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-bold gradient-text">Deep Knowledge Training</h1>
          <p className="text-gray-400">
            Crawl websites or paste manual data to train your AI agent.
          </p>
          <div className="flex justify-center pt-2">
            <Link href="/admin/leads">
              <Button variant="glass" className="gap-2 text-xs h-10 px-6 uppercase tracking-widest font-bold">
                <Users size={14} /> View Leads Dashboard
              </Button>
            </Link>
          </div>
        </div>

        <div className="glass p-8 rounded-3xl border border-white/10 relative overflow-hidden">
          {status === 'loading' && (
             <div className="absolute top-0 left-0 h-1 bg-blue-600 transition-all duration-500 shadow-[0_0_10px_rgba(37,99,235,0.8)]" style={{ width: `${progress}%` }} />
          )}

          <form onSubmit={handleTrain} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Globe size={16} className="text-blue-400" />
                Agency Website URL
              </label>
              <input
                type="url"
                placeholder="https://example-agency.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                disabled={status === 'loading'}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <BookOpen size={16} className="text-purple-400" />
                Additional Knowledge (Manual)
              </label>
              <textarea
                placeholder="Paste pricing, specific packages, FAQs, or any details that might be hidden in images/tabs..."
                value={manualKnowledge}
                onChange={(e) => setManualKnowledge(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 h-40 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all resize-none"
                disabled={status === 'loading'}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-14" 
              disabled={status === 'loading'}
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={20} />
                  Training in Progress... {progress}%
                </>
              ) : (
                'Start Education Process'
              )}
            </Button>
          </form>

          {status !== 'idle' && (
            <div className={`mt-6 p-5 rounded-2xl space-y-4 ${
              status === 'success' ? 'bg-green-500/5 border border-green-500/20' : 
              status === 'error' ? 'bg-red-500/5 border border-red-500/20' :
              'bg-blue-500/5 border border-blue-500/20'
            }`}>
              <div className="flex items-start gap-3">
                {status === 'success' && <CheckCircle2 size={20} className="text-green-400 mt-1" />}
                {status === 'error' && <AlertCircle size={20} className="text-red-400 mt-1" />}
                {status === 'loading' && <Loader2 className="animate-spin text-blue-400 mt-1" size={20} />}
                <div className="flex-1">
                  <span className={`text-sm font-medium block ${
                     status === 'success' ? 'text-green-400' : 
                     status === 'error' ? 'text-red-400' : 'text-blue-400'
                  }`}>{message}</span>
                </div>
              </div>

              {status === 'loading' && (
                <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-500 ease-out" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="glass p-6 rounded-2xl flex flex-col items-center justify-center text-center">
            <BarChart3 className="text-blue-500 mb-2" size={24} />
            <span className="text-2xl font-bold">{stats.pages || '--'}</span>
            <span className="text-xs text-gray-400 uppercase tracking-widest">Knowledge Points</span>
          </div>
          <div className="glass p-6 rounded-2xl flex flex-col items-center justify-center text-center">
            <Binary className="text-purple-500 mb-2" size={24} />
            <span className="text-2xl font-bold">{stats.chunks || '--'}</span>
            <span className="text-xs text-gray-400 uppercase tracking-widest">Memory Vectors</span>
          </div>
        </div>
      </div>
    </div>
  );
}
