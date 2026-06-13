import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, X, Loader2, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLocation } from 'react-router-dom';

export default function VoiceAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'analyzing' | 'speaking'>('idle');
  const [transcript, setTranscript] = useState('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  
  const location = useLocation();

  // Handle open/close based on route or logic
  // For demo, we add a floating button on all pages except Map
  const showFab = location.pathname !== '/map';

  const startVoiceSession = async () => {
    setIsOpen(true);
    setStatus('listening');
    setTranscript('Listening...');
    nextPlayTimeRef.current = 0;

    try {
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProto}//${window.location.host}/live`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = async () => {
        try {
          // Setup Input Capture safely
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContextClass) {
            throw new Error("AudioContext is not supported in this browser");
          }

          try {
            inputCtxRef.current = new AudioContextClass({ sampleRate: 16000 });
          } catch (e) {
            console.warn("Falling back input AudioContext creation", e);
            try {
              inputCtxRef.current = new AudioContextClass();
            } catch (fallbackErr) {
              console.error("Fallback input AudioContext also failed", fallbackErr);
            }
          }

          try {
            outputCtxRef.current = new AudioContextClass({ sampleRate: 24000 });
          } catch (e) {
            console.warn("Falling back output AudioContext creation", e);
            try {
              outputCtxRef.current = new AudioContextClass();
            } catch (fallbackErr) {
              console.error("Fallback output AudioContext also failed", fallbackErr);
            }
          }

          if (!inputCtxRef.current || !outputCtxRef.current) {
            throw new Error("Unable to instantiate AudioContext properly");
          }

          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          
          const source = inputCtxRef.current.createMediaStreamSource(stream);
          processorRef.current = inputCtxRef.current.createScriptProcessor(4096, 1, 1);
          
          source.connect(processorRef.current);
          processorRef.current.connect(inputCtxRef.current.destination);

          processorRef.current.onaudioprocess = (e) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              // Encode PCM to Base64
              const inputData = e.inputBuffer.getChannelData(0);
              const buffer = new ArrayBuffer(inputData.length * 2);
              const view = new DataView(buffer);
              for (let i = 0; i < inputData.length; i++) {
                let s = Math.max(-1, Math.min(1, inputData[i]));
                view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
              }
              const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
              wsRef.current.send(JSON.stringify({ audio: base64 }));
            }
          };
        } catch (onOpenErr) {
          console.error("Failed to initialize voice session safely inside iframe:", onOpenErr);
          setTranscript("Voice assistant is not supported in this iframe environment");
          setStatus('idle');
          cleanup();
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.audio && outputCtxRef.current) {
            setStatus('speaking');
            
            try {
              // Decode Base64 PCM and play properly as a Float32 continuous stream
              const binaryText = atob(msg.audio);
              const len = binaryText.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryText.charCodeAt(i);
              }
              
              const numSamples = len / 2; // 16-bit is 2 bytes per sample
              const pcm16 = new Int16Array(bytes.buffer, bytes.byteOffset, numSamples);
              const float32 = new Float32Array(numSamples);
              for (let i = 0; i < numSamples; i++) {
                float32[i] = pcm16[i] / 32768.0;
              }
              
              const currentSampleRate = outputCtxRef.current.sampleRate || 24000;
              const audioBuffer = outputCtxRef.current.createBuffer(1, numSamples, currentSampleRate);
              audioBuffer.copyToChannel(float32, 0);
              
              const curTime = outputCtxRef.current.currentTime;
              let startTime = nextPlayTimeRef.current;
              if (startTime < curTime) {
                startTime = curTime + 0.05; // 50ms scheduling buffer
              }
              
              const source = outputCtxRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputCtxRef.current.destination);
              source.start(startTime);
              
              nextPlayTimeRef.current = startTime + audioBuffer.duration;
            } catch (err) {
              console.error("Error processing PCM audio streaming buffer", err);
            }
          }
          if (msg.interrupted) {
            // Handle interruption logic if needed
          }
        } catch (messageErr) {
          console.error("Error reading WebSocket live message", messageErr);
        }
      };

      wsRef.current.onerror = (e) => {
        console.error("WS Error", e);
        setStatus('idle');
      };

      wsRef.current.onclose = () => {
        cleanup();
        setStatus('idle');
      };

    } catch (e) {
      console.error(e);
      cleanup();
      setIsOpen(false);
    }
  };

  const cleanup = () => {
    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    inputCtxRef.current?.close();
    outputCtxRef.current?.close();
    if(wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
  };

  const closeSession = () => {
    cleanup();
    setIsOpen(false);
    setStatus('idle');
  };

  useEffect(() => {
    return () => cleanup();
  }, []);

  return (
    <>
      {showFab && !isOpen && (
        <button 
          onClick={startVoiceSession}
          className="fixed bottom-24 right-6 w-14 h-14 bg-blue-500 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.3)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40"
        >
          <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
          <Mic className="w-6 h-6 text-white relative z-10" />
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col pt-10 pb-6 px-5 bg-slate-950"
          >
            {/* Top close */}
            <div className="flex justify-end w-full">
              <button onClick={closeSession} className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full">
              {/* Orb */}
              <div className="relative mb-12">
                <div className={cn(
                  "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500",
                  status === 'listening' ? "bg-blue-500/20 shadow-[0_0_50px_rgba(59,130,246,0.4)] animate-pulse" : 
                  status === 'speaking' ? "bg-emerald-500/20 shadow-[0_0_50px_rgba(52,211,153,0.4)]" :
                  "bg-slate-800"
                )}>
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center transition-all",
                    status === 'listening' ? "bg-blue-500/40" : 
                    status === 'speaking' ? "bg-emerald-500/40" :
                    "bg-slate-700"
                  )}>
                    <div className={cn(
                      "w-8 h-8 rounded-full",
                      status === 'listening' ? "bg-blue-500" : 
                      status === 'speaking' ? "bg-emerald-500" :
                      "bg-slate-600"
                    )} />
                  </div>
                </div>
              </div>

              {/* Transcript */}
              <div className="text-center px-4">
                <p className={cn(
                  "text-2xl font-bold tracking-tight leading-snug transition-colors",
                  status === 'listening' ? "text-blue-400" : "text-white"
                )}>
                  "{transcript}"
                </p>
                {status === 'speaking' && <p className="text-sm font-medium text-emerald-400 mt-4 flex items-center justify-center gap-1"><Sparkles className="w-4 h-4"/> AI Responding...</p>}
                {status === 'analyzing' && <p className="text-sm font-medium text-slate-400 mt-4 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Processing...</p>}
              </div>
            </div>

            {/* Waveform visualizer mock */}
            <div className="flex flex-col items-center gap-6 mt-auto">
               <div className="flex items-center justify-center gap-1.5 h-12">
                 {[...Array(7)].map((_, i) => (
                   <motion.div 
                     key={i}
                     animate={{ height: status === 'listening' ? [8, 32, 8] : 8 }}
                     transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.1 }}
                     className="w-1.5 bg-blue-500 rounded-full opacity-60"
                   />
                 ))}
               </div>
               <span className="text-xs font-bold tracking-[0.2em] uppercase text-slate-500">
                 {status === 'speaking' ? 'Playing Audio' : 'Listening...'}
               </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
