'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { MessageSquare, Mic, Send, MicOff, ChevronLeft, Loader2, Sparkles, Volume2, Square, FileText, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeech';
import LeadSummaryCard from '@/components/LeadSummaryCard';
import ReactMarkdown from 'react-markdown';

type Message = { role: 'user' | 'assistant'; content: string };

function ChatMessage({ msg }: { msg: Message }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = msg.content.length > 500;
  const displayContent = isLong && !isExpanded ? msg.content.slice(0, 450) + '...' : msg.content;

  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-200`}>
      <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm sm:text-[15px] transition-all ${
        msg.role === 'user' 
          ? 'bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-500/20' 
          : 'bg-white text-slate-900 rounded-tl-none border border-slate-200 shadow-sm'
      }`}>
        <div className="prose max-w-none text-sm sm:text-[15px] leading-relaxed">
          <ReactMarkdown>{displayContent}</ReactMarkdown>
        </div>
        {isLong && (
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className={`mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${msg.role === 'user' ? 'text-blue-100' : 'text-blue-600'}`}
          >
            {isExpanded ? (
              <><ChevronUp size={12} /> Σύμπτυξη</>
            ) : (
              <><ChevronDown size={12} /> Διαβάστε περισσότερα</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function ChatComponent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');
  
  const [useVoice, setUseVoice] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [leadData, setLeadData] = useState<any>(null);
  const [projectName, setProjectName] = useState<string | null>(null);

  // Lead Quality State
  const [leadState, setLeadState] = useState({
    client_name: null,
    company: null,
    website: null,
    service_type: null,
    problem: null,
    budget: null,
    timeline: null,
    email: null,
    phone: null
  });
  
  const { 
    isListening, 
    transcript, 
    isSpeaking,
    startListening, 
    stopListening, 
    speak, 
    cancelSpeak,
    hasSupport 
  } = useSpeechRecognition();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const speakQueueRef = useRef<string[]>([]);
  const isPlayingQueueRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    messagesRef.current = messages;
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (projectId) {
      fetch(`/api/projects/${projectId}`)
        .then(res => res.json())
        .then(data => setProjectName(data.project?.name || null))
        .catch(() => setProjectName(null));
    }
  }, [projectId]);

  // Voice mode auto-start
  useEffect(() => {
    if (useVoice && hasSupport) {
      setTimeout(() => startListening((t) => handleSend(t)), 500);
    }
  }, [useVoice, hasSupport]);

  const processSpeakQueue = async () => {
    if (isPlayingQueueRef.current || speakQueueRef.current.length === 0) return;
    isPlayingQueueRef.current = true;
    while (speakQueueRef.current.length > 0) {
      const sentence = speakQueueRef.current.shift();
      if (sentence) {
        await new Promise<void>((resolve) => speak(sentence, () => resolve()));
      }
    }
    isPlayingQueueRef.current = false;
    if (useVoice && !isLoading) startListening((t) => handleSend(t));
  };

  const handleSend = async (content: string) => {
    const text = content || input;
    if (!text.trim() || isLoading) return;

    cancelSpeak();
    speakQueueRef.current = [];
    isPlayingQueueRef.current = false;

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    messagesRef.current = [...messagesRef.current, userMsg];
    
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: messagesRef.current, 
          lastMessage: text,
          projectId: projectId || undefined,
          leadState: leadState // Send current progress
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || 'Failed to fetch response');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let sentenceBuffer = '';

      // Initialize assistant message for streaming
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        assistantText += chunk;
        sentenceBuffer += chunk;

        // Update UI in real-time
        setMessages(prev => {
          const newMessages = [...prev];
          const last = newMessages[newMessages.length - 1];
          if (last.role === 'assistant') {
            last.content = assistantText
              .replace(/\[LEAD_UPDATE:[\s\S]*?\]/g, '')
              .replace('[LEAD_COMPLETE]', '')
              .trim();
          }
          return newMessages;
        });

        // Voice handling
        if (useVoice) {
          const match = sentenceBuffer.match(/[.!?;:]\s+|\n/);
          if (match) {
            const boundaryIndex = match.index! + match[0].length;
            const rawSentence = sentenceBuffer.substring(0, boundaryIndex).trim();
            sentenceBuffer = sentenceBuffer.substring(boundaryIndex);
            const cleanSentence = rawSentence
              .replace(/<think>[\s\S]*?<\/think>/g, '')
              .replace(/\[LEAD_UPDATE:[\s\S]*?\]/g, '')
              .replace('[LEAD_COMPLETE]', '')
              .trim();
            if (cleanSentence.length > 2) {
              speakQueueRef.current.push(cleanSentence);
              processSpeakQueue();
            }
          }
        }

        // Real-time Lead Progress Detection
        const allUpdates = assistantText.matchAll(/\[LEAD_UPDATE:\s*(\{[\s\S]*?\})\]/g);
        for (const match of allUpdates) {
          try {
            const update = JSON.parse(match[1]);
            setLeadState(prev => ({ ...prev, ...update }));
          } catch(e) {}
        }
      }

      if (assistantText.includes('[LEAD_COMPLETE]') && leadState.email && leadState.phone) {
         setTimeout(() => handleFinish(), 2000);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const [isFinished, setIsFinished] = useState(false);

  const handleFinish = async () => {
    if (messagesRef.current.length < 2) return;
    setIsAnalyzing(true);
    stopListening();
    cancelSpeak();

    try {
      const response = await fetch('/api/lead/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: messagesRef.current,
          projectId: projectId || undefined
        }),
      });
      const data = await response.json();
      setLeadData(data);
      setIsFinished(true); // Switch to thank you view
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const leadQuality = (Object.values(leadState).filter(Boolean).length / Object.keys(leadState).length) * 100;
  // Manual button shows if we have at least 2 messages and not already analyzing
  const showManualButton = messages.length >= 2 && !isAnalyzing && !leadData;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-900 overflow-hidden relative p-2 sm:p-4">
      {/* 
        The client should NO LONGER see the PDF/Summary card. 
        {leadData && <LeadSummaryCard data={leadData} onClose={() => setLeadData(null)} />} 
      */}

      <div className="relative w-full max-w-4xl h-[90vh] sm:h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {isFinished ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8 animate-in fade-in zoom-in-95 duration-700">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-xl">
              <CheckCircle2 size={48} />
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-black text-slate-900 leading-tight">Ευχαριστούμε πολύ!</h2>
              <p className="text-slate-500 max-w-sm mx-auto leading-relaxed">
                Λάβαμε όλες τις απαραίτητες πληροφορίες. Η ομάδα μας θα επικοινωνήσει μαζί σας σύντομα στο <strong>{leadState.email}</strong> για να σας στείλουμε την πλήρη πρότασή μας.
              </p>
            </div>
            <Button 
              variant="outline" 
              className="px-8 h-12 text-slate-400 border-slate-200"
              onClick={() => window.location.reload()}
            >
              Νέα Συνομιλία
            </Button>
          </div>
        ) : (
          <>

      <header className="px-5 py-4 flex items-center justify-between border-b border-slate-200 bg-white/90 backdrop-blur z-30">
        <button onClick={() => window.history.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div className="text-center">
          <h2 className="font-bold text-slate-900 text-sm sm:text-base">{projectName || 'SocialMe Assistant'}</h2>
          <div className="flex items-center gap-1.5 justify-center">
             <span className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
               {isListening ? 'Listening' : 'Ready'}
             </span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-2">
            <div className="h-1 w-20 bg-slate-100 rounded-full overflow-hidden">
               <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${leadQuality}%` }} />
            </div>
            <span className="text-[7px] font-black text-slate-400 mt-1 uppercase tracking-tighter">Quality: {Math.round(leadQuality)}%</span>
          </div>
          
          <Button 
            variant="glass" 
            className={`w-10 h-10 p-0 rounded-full border ${useVoice ? 'text-blue-500 bg-blue-50 border-blue-100' : 'text-slate-400 border-slate-100'}`}
            onClick={() => { setUseVoice(!useVoice); stopListening(); cancelSpeak(); }}
          >
            {useVoice ? <Mic size={20} /> : <MessageSquare size={20} />}
          </Button>
        </div>
      </header>

      <div className="flex-1 relative flex flex-col overflow-hidden bg-slate-50">
        {useVoice ? (
          <div className="orb-container">
            <div className={`voice-orb ${isLoading || isAnalyzing ? 'thinking' : isSpeaking ? 'speaking' : isListening ? 'listening' : ''}`} />
            <div className="text-center space-y-4 px-6 max-w-md">
              <p className="voice-status-text">
                {isAnalyzing ? 'Σχεδιάζουμε την πρότασή σας, θα πάρει λίγη ώρα...' :
                 isLoading ? 'Πληκτρολογεί...' : 
                 isSpeaking ? 'SocialMe is speaking' : 
                 isListening ? (transcript ? `"${transcript}"` : 'Σας ακούω...') : 
                 'Πείτε κάτι για να ξεκινήσουμε'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-hide pb-32">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-20 grayscale-[0.5] opacity-80">
                <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center shadow-inner animate-pulse">
                  <Sparkles size={40} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">Γεια σας!</h3>
                  <p className="text-slate-500 max-w-xs mx-auto text-sm leading-relaxed">
                    Είμαι ο ψηφιακός σας σύμβουλος. Πώς μπορώ να βοηθήσω την επιχείρησή σας σήμερα;
                  </p>
                </div>
              </div>
            )}
            {messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)}
            
            {isLoading && !useVoice && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200 flex gap-3 items-center shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Πληκτρολογεί...</span>
                </div>
              </div>
            )}

            {isAnalyzing && (
               <div className="flex justify-center p-8 animate-in zoom-in-95 duration-700">
                  <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[40px] border border-blue-100 flex flex-col items-center gap-6 shadow-2xl text-center max-w-sm">
                    <div className="relative">
                      <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center shadow-2xl shadow-blue-500/40">
                        <FileText className="text-white animate-pulse" size={40} />
                      </div>
                      <div className="absolute inset-0 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-slate-900">Δημιουργία Πρότασης</h4>
                      <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                        Σχεδιάζουμε την πρότασή σας, θα πάρει λίγη ώρα...
                      </p>
                    </div>
                  </div>
               </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <footer className="p-4 sm:p-6 z-30 bg-white border-t border-slate-100">
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          
          {/* Smart Finished Button removed as per user request */}
          
          <div className="flex items-center justify-center gap-6 w-full">
            {useVoice ? (
              <div className="flex items-center gap-8">
                <button 
                  onClick={() => { stopListening(); cancelSpeak(); }}
                  className="w-14 h-14 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-full flex items-center justify-center transition-all border border-slate-100 shadow-inner"
                >
                  <Square size={20} fill="currentColor" />
                </button>
                <button 
                  onClick={() => isListening ? stopListening() : startListening((t) => handleSend(t))}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl ${
                    isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-600 text-white hover:scale-105'
                  }`}
                >
                  {isListening ? <MicOff size={36} /> : <Mic size={36} />}
                </button>
              </div>
            ) : (
              <div className="w-full bg-slate-50 p-2 rounded-2xl border border-slate-200 flex items-center gap-2 pr-3 focus-within:border-blue-300 focus-within:bg-white transition-all shadow-inner">
                <input 
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend('')}
                  placeholder="Πώς μπορούμε να σας βοηθήσουμε;"
                  className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-sm sm:text-base text-slate-900"
                />
                <button 
                  onClick={() => handleSend('')}
                  disabled={!input.trim() || isLoading || isAnalyzing}
                  className="w-10 h-10 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95"
                >
                  <Send size={18} className="text-white" />
                </button>
              </div>
            )}
          </div>
        </div>
      </footer>
      </>
      )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>}>
      <ChatComponent />
    </Suspense>
  );
}
