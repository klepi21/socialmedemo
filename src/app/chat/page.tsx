'use client';

import { Suspense, useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { MessageSquare, Mic, Send, MicOff, ChevronLeft, Loader2, Sparkles, Volume2, Square, FileText, ChevronDown, ChevronUp, CheckCircle2, Target, Wallet, Download, Clock } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeech';
import LeadSummaryCard from '@/components/LeadSummaryCard';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  
  const [isExporting, setIsExporting] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  const generatePDF = async () => {
    setIsExporting(true);
    // Wait for state to settle and template to render
    await new Promise(r => setTimeout(r, 500));

    try {
      if (!pdfRef.current) return;
      const canvas = await html2canvas(pdfRef.current, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: '#000000',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 10, 10, imgWidth, imgHeight);
      pdf.save(`Proposal_${(leadData?.client_name || 'Business').replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Η δημιουργία του PDF απέτυχε. Παρακαλούμε δοκιμάστε ξανά.');
    } finally {
      setIsExporting(false);
    }
  };

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

      // Auto-detect lead completion
      if (assistantText.includes('[LEAD_COMPLETE]') && (leadState.email || leadState.phone)) {
        console.log('[LEAD] Complete tag detected, triggering analysis...');
        setTimeout(() => handleFinish(), 2000);
      }

      // Safety net: auto-analyze after 10+ messages if we have SOME data
      const totalMessages = messagesRef.current.length;
      if (totalMessages >= 10 && leadState.client_name && (leadState.email || leadState.phone) && !isAnalyzing && !leadData) {
        console.log('[LEAD] Safety net: enough messages with lead data, auto-analyzing...');
        setTimeout(() => handleFinish(), 3000);
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
            <div className="space-y-4 mb-4">
              <h2 className="text-3xl font-black text-slate-900 leading-tight">Ευχαριστούμε πολύ!</h2>
              <p className="text-slate-500 max-w-sm mx-auto leading-relaxed">
                Λάβαμε όλες τις απαραίτητες πληροφορίες. Η ομάδα μας θα επικοινωνήσει μαζί σας σύντομα στο <strong>{leadData?.email || leadState.email}</strong> για να σας στείλουμε την πλήρη πρότασή μας.
              </p>
            </div>

            {/* Client Summary Card */}
            {leadData && (
              <div className="w-full max-w-md bg-white rounded-[32px] border border-slate-100 p-8 shadow-xl text-left mb-8 animate-in zoom-in-95 duration-500">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 leading-tight">Σύνοψη Έργου</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{leadData.project_title || 'Νέο Project'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 flex-shrink-0">
                      <Target size={16} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Σκοπός</p>
                      <p className="text-sm text-slate-700 leading-relaxed line-clamp-2">{leadData.scope}</p>
                    </div>
                  </div>
                  {leadData.budget_estimation && (
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 flex-shrink-0">
                        <Wallet size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Εκτίμηση Budget</p>
                        <p className="text-sm font-black text-emerald-600">{leadData.budget_estimation}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-50 flex flex-col gap-3">
                   <Button 
                    className="w-full h-14 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl gap-2 shadow-lg shadow-blue-200"
                    onClick={generatePDF}
                    disabled={isExporting}
                  >
                    {isExporting ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                    Λήψη Πρότασης (PDF)
                  </Button>
                </div>
              </div>
            )}

            <Button 
              variant="outline" 
              className="px-8 h-12 text-slate-400 border-slate-200 rounded-xl"
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
            className={`w-10 h-10 p-0 rounded-full border ${useVoice ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-slate-600 border-slate-200'}`}
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
                  <p className="text-slate-500 max-w-xs mx-auto text-sm leading-relaxed mb-4">
                    Είμαι ο ψηφιακός σας σύμβουλος. Πώς προτιμάτε να επικοινωνήσουμε;
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Button 
                      onClick={() => setUseVoice(false)}
                      variant={!useVoice ? 'primary' : 'outline'}
                      className={`gap-2 px-6 h-11 rounded-2xl ${!useVoice ? 'bg-blue-600 shadow-lg shadow-blue-500/25' : 'border-blue-200 text-blue-600 bg-blue-50/50'}`}
                    >
                      <MessageSquare size={18} /> Κείμενο
                    </Button>
                    <Button 
                      onClick={() => setUseVoice(true)}
                      variant={useVoice ? 'primary' : 'outline'}
                      className={`gap-2 px-6 h-11 rounded-2xl ${useVoice ? 'bg-blue-600 shadow-lg shadow-blue-500/25' : 'border-blue-200 text-blue-600 bg-blue-50/50'}`}
                    >
                      <Mic size={18} /> Φωνή
                    </Button>
                  </div>
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
          
          {/* Smart Finished Button: Appears when we have enough data to be useful */}
          {leadState.client_name && (leadState.email || leadState.phone) && !isAnalyzing && !isFinished && (
            <div className="flex justify-center animate-in slide-in-from-bottom-2">
              <Button 
                onClick={handleFinish}
                variant="primary"
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 px-8 rounded-full shadow-lg shadow-emerald-600/20 py-6 h-auto group"
              >
                <FileText size={20} className="group-hover:scale-110 transition-transform" />
                Ολοκλήρωση & Σχεδιασμός Πρότασης
              </Button>
            </div>
          )}
          
          <div className="flex items-center justify-center gap-6 w-full">
            {useVoice ? (
              <div className="flex items-center gap-8">
                <button 
                  onClick={() => { stopListening(); cancelSpeak(); }}
                  className="w-14 h-14 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-full flex items-center justify-center transition-all border border-slate-100 shadow-inner"
                  title="Stop"
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
                <button 
                   onClick={() => { setUseVoice(false); stopListening(); cancelSpeak(); }}
                   className="w-14 h-14 bg-slate-50 hover:bg-slate-100 text-blue-500 rounded-full flex items-center justify-center transition-all border border-slate-100 shadow-inner"
                   title="Switch to Text"
                >
                  <MessageSquare size={20} />
                </button>
              </div>
            ) : (
              <div className="w-full flex items-center gap-3">
                <button 
                  onClick={() => { setUseVoice(true); }}
                  className="w-12 h-12 bg-blue-50 text-blue-600 border border-blue-100 rounded-2xl flex items-center justify-center hover:bg-blue-100 transition-colors shadow-sm"
                  title="Switch to Voice"
                >
                  <Mic size={20} />
                </button>
                <div className="flex-1 bg-slate-50 p-2 rounded-2xl border border-slate-200 flex items-center gap-2 pr-3 focus-within:border-blue-300 focus-within:bg-white transition-all shadow-inner">
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
              </div>
            )}
          </div>
        </div>
      </footer>
      </>
      )}

      {/* Hidden PDF Template for Export */}
      {leadData && (
          <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
            <div ref={pdfRef} style={{ backgroundColor: '#000000', color: '#ffffff', width: '800px', padding: '40px', fontFamily: 'Arial, sans-serif' }}>
              {/* PDF Header */}
              <div style={{ backgroundColor: '#059669', padding: '32px 24px', borderRadius: '16px', marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '16px' }}>
                    <CheckCircle2 color="#ffffff" size={36} />
                  </div>
                  <div>
                    <h3 style={{ color: '#ffffff', fontWeight: '900', fontSize: '24px' }}>Επαγγελματική Πρόταση</h3>
                    <p style={{ color: '#d1fae5', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px' }}>
                      {leadData.client_name} • SocialMe Digital AI
                    </p>
                  </div>
                </div>
              </div>

              {/* Project Title */}
              {leadData.project_title && (
                <div style={{ borderLeft: '4px solid #059669', paddingLeft: '20px', marginBottom: '32px' }}>
                  <p style={{ color: '#34d399', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '8px' }}>Τίτλος Έργου</p>
                  <p style={{ fontSize: '28px', fontWeight: '900', lineHeight: '1.1' }}>{leadData.project_title}</p>
                </div>
              )}

              {/* Info Grid */}
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '32px' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <p style={{ color: '#6b7280', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Επικοινωνία</p>
                  <p style={{ fontSize: '15px', marginTop: '8px' }}>{leadData.email}</p>
                  <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: '4px' }}>{leadData.phone}</p>
                </div>
                {leadData.budget_estimation && (
                  <div style={{ flex: '1 1 200px' }}>
                    <p style={{ color: '#6b7280', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Προϋπολογισμός</p>
                    <p style={{ fontSize: '24px', color: '#34d399', marginTop: '8px', fontWeight: '900' }}>{leadData.budget_estimation}</p>
                  </div>
                )}
                {leadData.timeline && (
                  <div style={{ flex: '1 1 200px' }}>
                    <p style={{ color: '#6b7280', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Χρονοδιάγραμμα</p>
                    <p style={{ fontSize: '16px', marginTop: '8px', fontWeight: '600' }}>{leadData.timeline}</p>
                  </div>
                )}
              </div>

              {/* Goals */}
              {leadData.client_goals?.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                  <p style={{ color: '#6b7280', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '12px' }}>Στόχοι Πελάτη</p>
                  {leadData.client_goals.map((g: string, i: number) => (
                    <p key={i} style={{ fontSize: '14px', color: '#e5e7eb', marginBottom: '6px' }}>• {g}</p>
                  ))}
                </div>
              )}

              {/* Tasks */}
              {leadData.key_tasks?.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                  <p style={{ color: '#6b7280', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '12px' }}>Πλάνο Υλοποίησης</p>
                  {leadData.key_tasks.map((t: any, i: number) => (
                    <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', backgroundColor: '#059669', padding: '4px 12px', borderRadius: '999px', textTransform: 'uppercase' }}>{t.category}</span>
                      <p style={{ fontSize: '14px', color: '#d1d5db' }}>{t.task}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div style={{ paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3em', fontWeight: 'bold', color: '#475569' }}>
                  SOCIALME DIGITAL STRATEGY BUREAU • {new Date().getFullYear()}
                </p>
              </div>
            </div>
          </div>
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
