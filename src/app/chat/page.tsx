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

        // Real-time Completion Detection (Inside Loop for Speed)
        if (assistantText.includes('[LEAD_COMPLETE]') || assistantText.includes('έχω όσα χρειάζομαι για να ετοιμάσω την πρότασή σας')) {
          if (!isAnalyzing && !isFinished) {
            console.log('[LEAD] Completion detected in stream, preparing analysis...');
            // Wait 2 seconds to let the user hear/read the final sentence
            setTimeout(() => handleFinish(), 2000);
            break; // Exit stream loop early as we are finishing
          }
        }
      }

      // Final check just in case the loop break missed it
      if (assistantText.includes('[LEAD_COMPLETE]') && !isAnalyzing && !isFinished) {
        handleFinish();
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
      console.log("[LEAD ANALYZE] Received data:", data);
      if (data.error) throw new Error(data.error);
      
      setLeadData(data);
      setIsFinished(true); // Switch to thank you view
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Κάτι πήγε στραβά με την ανάλυση. Παρακαλούμε προσπαθήστε ξανά.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const leadQuality = (Object.values(leadState).filter(Boolean).length / Object.keys(leadState).length) * 100;
  // Manual button shows if we have at least 2 messages and not already analyzing
  const showManualButton = messages.length >= 2 && !isAnalyzing && !leadData;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-900 overflow-hidden relative p-2 sm:p-4">
      <div className="relative w-full max-w-4xl h-[90vh] sm:h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {isFinished && leadData ? (
          <LeadSummaryCard 
            data={{
              ...leadData,
              client_name: leadData.client_name || leadState.client_name || 'Πελάτης',
              project_title: leadData.project_title || leadState.company || 'Επαγγελματική Πρόταση',
              scope: leadData.scope || leadState.problem || 'Ψηφιακή Ανάπτυξη',
              email: leadData.email || leadState.email,
              phone: leadData.phone || leadState.phone,
              budget_estimation: leadData.budget_estimation || leadState.budget || 'Κατόπιν Συνεννόησης',
              timeline: leadData.timeline || leadState.timeline || 'Άμεσα'
            }} 
            onClose={() => setIsFinished(false)} 
          />
        ) : (
          <>
            <header className="px-5 py-4 flex items-center justify-between border-b border-slate-200 bg-white/90 backdrop-blur z-30">
              <button 
                onClick={() => window.history.back()} 
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                aria-label="Back"
              >
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
                      {isAnalyzing ? 'Σχεδιάζουμε την πρότασή σας...' :
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
                    <div className="flex justify-center p-8">
                       <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[40px] border border-blue-100 flex flex-col items-center gap-6 shadow-2xl text-center max-w-sm">
                         <Loader2 className="animate-spin text-blue-600" size={40} />
                         <p className="text-sm text-slate-500">Σχεδιάζουμε την πρότασή σας...</p>
                       </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <footer className="p-4 sm:p-6 z-30 bg-white border-t border-slate-100">
              <div className="max-w-2xl mx-auto flex flex-col gap-4">
                {leadState.client_name && (leadState.email || leadState.phone) && !isAnalyzing && !isFinished && (
                  <div className="flex justify-center">
                    <Button 
                      onClick={handleFinish}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 px-8 rounded-full shadow-lg h-14"
                    >
                      <FileText size={20} /> Ολοκλήρωση
                    </Button>
                  </div>
                )}
                
                <div className="flex items-center justify-center gap-6 w-full">
                  {useVoice ? (
                    <div className="flex items-center gap-8">
                      <button onClick={() => { stopListening(); cancelSpeak(); }} className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100"><Square size={16} fill="currentColor" /></button>
                      <button 
                        onClick={() => isListening ? stopListening() : startListening((t) => handleSend(t))}
                        className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg ${isListening ? 'bg-red-500' : 'bg-blue-600'} text-white`}
                      >
                        {isListening ? <MicOff size={28} /> : <Mic size={28} />}
                      </button>
                      <button onClick={() => setUseVoice(false)} className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100"><MessageSquare size={16} /></button>
                    </div>
                  ) : (
                    <div className="w-full flex items-center gap-3">
                      <button onClick={() => setUseVoice(true)} className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center"><Mic size={20} /></button>
                      <div className="flex-1 bg-slate-50 p-2 rounded-2xl border border-slate-200 flex items-center gap-2">
                        <input 
                          type="text"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSend('')}
                          placeholder="Πώς μπορούμε να βοηθήσουμε;"
                          className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-slate-900"
                        />
                        <button onClick={() => handleSend('')} disabled={!input.trim() || isLoading} className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white"><Send size={18} /></button>
                      </div>
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
