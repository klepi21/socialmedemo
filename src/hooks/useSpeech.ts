import { useState, useEffect, useCallback, useRef } from 'react';

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeakingState] = useState(false);
  const [hasSupport, setHasSupport] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onFinalTranscriptRef = useRef<((text: string) => void) | null>(null);

  const setIsSpeaking = (val: boolean) => {
    isSpeakingRef.current = val;
    setIsSpeakingState(val);
  };

  const cancelSpeak = useCallback(() => {
    // 1. Clear any pending submission timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // 2. Abort pending TTS fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // 3. Stop and Cleanup Audio
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      audioRef.current.src = "";
      audioRef.current = null;
    }

    // 4. Stop browser synthesis
    window.speechSynthesis.cancel();
    
    setIsSpeaking(false);
    setTranscript(''); // Clear UI transcript on stop
  }, []);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'el-GR';

      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);

      rec.onresult = (event: any) => {
        // IGNORE MIC IF AI IS SPEAKING
        if (isSpeakingRef.current) return;

        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        
        // Final guard: don't even show transcript if AI is speaking
        if (isSpeakingRef.current) return;
        
        setTranscript(currentTranscript);

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (currentTranscript.trim() && onFinalTranscriptRef.current && !isSpeakingRef.current) {
            const final = currentTranscript.trim();
            setTranscript('');
            onFinalTranscriptRef.current(final);
          }
        }, 1500); // 1.5s for natural pause
      };

      recognitionRef.current = rec;
      setHasSupport(true);
    }
    
    return () => cancelSpeak();
  }, [cancelSpeak]);

  const startListening = useCallback((onFinal?: (text: string) => void) => {
    if (onFinal) onFinalTranscriptRef.current = onFinal;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }
  }, []);

  const speak = async (text: string, onEnd?: () => void) => {
    stopListening(); // Mute mic before starting speech
    cancelSpeak(); // Hard stop everything before starting new speech
    
    setIsSpeaking(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Use the Turbo model via the proxy route
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const audio = new Audio(url);
      audioRef.current = audio;
      
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setIsSpeaking(false);
        if (onEnd) onEnd();
      };

      audio.onpause = () => {
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      
      console.error('TTS Error:', err);
      // Fallback to basic voice if premium fails
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'el-GR';
      utterance.onend = () => {
        setIsSpeaking(false);
        if (onEnd) onEnd();
      };
      window.speechSynthesis.speak(utterance);
    }
  };

  return { 
    isListening, 
    transcript, 
    isSpeaking,
    startListening, 
    stopListening, 
    speak, 
    cancelSpeak,
    hasSupport
  };
}
