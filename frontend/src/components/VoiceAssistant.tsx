import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, X, Loader2, Sparkles, Radio } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLocation } from 'react-router-dom';

interface VoiceAssistantProps {
  embedded?: boolean;
  className?: string;
}

export default function VoiceAssistant({ embedded = false, className }: VoiceAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'analyzing' | 'speaking'>('idle');
  const [transcript, setTranscript] = useState('Ready for voice input');

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  const location = useLocation();
  const showFab = !embedded && location.pathname !== '/map';

  const cleanup = () => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    inputCtxRef.current?.close().catch(() => undefined);
    inputCtxRef.current = null;
    outputCtxRef.current?.close().catch(() => undefined);
    outputCtxRef.current = null;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    wsRef.current = null;
  };

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
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContextClass) {
            throw new Error('AudioContext is not supported in this browser');
          }

          try {
            inputCtxRef.current = new AudioContextClass({ sampleRate: 16000 });
          } catch (e) {
            console.warn('Falling back input AudioContext creation', e);
            inputCtxRef.current = new AudioContextClass();
          }

          try {
            outputCtxRef.current = new AudioContextClass({ sampleRate: 24000 });
          } catch (e) {
            console.warn('Falling back output AudioContext creation', e);
            outputCtxRef.current = new AudioContextClass();
          }

          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;

          const source = inputCtxRef.current.createMediaStreamSource(stream);
          processorRef.current = inputCtxRef.current.createScriptProcessor(4096, 1, 1);

          source.connect(processorRef.current);
          processorRef.current.connect(inputCtxRef.current.destination);

          processorRef.current.onaudioprocess = (e) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              const inputData = e.inputBuffer.getChannelData(0);
              const buffer = new ArrayBuffer(inputData.length * 2);
              const view = new DataView(buffer);
              for (let i = 0; i < inputData.length; i++) {
                const sample = Math.max(-1, Math.min(1, inputData[i]));
                view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
              }
              const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
              wsRef.current.send(JSON.stringify({ audio: base64 }));
            }
          };
        } catch (onOpenErr) {
          console.error('Failed to initialize voice session:', onOpenErr);
          setTranscript('Voice assistant is not supported in this browser environment');
          setStatus('idle');
          cleanup();
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.text) {
            setTranscript(msg.text);
            setStatus('analyzing');
          }
          if (msg.audio && outputCtxRef.current) {
            setStatus('speaking');

            try {
              const binaryText = atob(msg.audio);
              const len = binaryText.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryText.charCodeAt(i);
              }

              const numSamples = len / 2;
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
              if (startTime < curTime) startTime = curTime + 0.05;

              const source = outputCtxRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputCtxRef.current.destination);
              source.start(startTime);

              nextPlayTimeRef.current = startTime + audioBuffer.duration;
            } catch (err) {
              console.error('Error processing PCM audio streaming buffer', err);
            }
          }
        } catch (messageErr) {
          console.error('Error reading WebSocket live message', messageErr);
        }
      };

      wsRef.current.onerror = (e) => {
        console.error('WS Error', e);
        setTranscript('Voice connection failed');
        setStatus('idle');
      };

      wsRef.current.onclose = () => {
        cleanup();
        setStatus('idle');
        setIsOpen(false);
      };
    } catch (e) {
      console.error(e);
      cleanup();
      setIsOpen(false);
      setStatus('idle');
    }
  };

  const closeSession = () => {
    cleanup();
    setIsOpen(false);
    setStatus('idle');
    setTranscript('Ready for voice input');
  };

  useEffect(() => {
    return () => cleanup();
  }, []);

  const voiceContent = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Voice AI</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-on-surface">Talk to MB Sense</h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">Use speech for charging predictions, trip readiness, and schedule questions.</p>
        </div>
        {isOpen && (
          <button onClick={closeSession} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-outline-variant/45 bg-surface-container-low text-slate-400 hover:text-on-surface" aria-label="Stop voice session">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <div className="relative mb-8">
          {isOpen && <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />}
          <div
            className={cn(
              'relative flex h-28 w-28 items-center justify-center rounded-full border transition-all duration-500',
              status === 'listening' ? 'border-primary/30 bg-primary/15 shadow-ambient-lg' : status === 'speaking' ? 'border-emerald-400/30 bg-emerald-400/15 shadow-ambient-lg' : 'border-outline-variant/45 bg-surface-container'
            )}
          >
            <div
              className={cn(
                'flex h-16 w-16 items-center justify-center rounded-full transition-all',
                status === 'listening' ? 'bg-primary/25 text-primary' : status === 'speaking' ? 'bg-emerald-400/25 text-emerald-500' : 'bg-surface-container-high text-slate-500'
              )}
            >
              <Mic className="h-7 w-7" />
            </div>
          </div>
        </div>

        <p className={cn('max-w-sm text-xl font-bold leading-snug', status === 'listening' ? 'text-primary' : 'text-on-surface')}>{transcript}</p>
        {status === 'speaking' && <p className="mt-4 flex items-center justify-center gap-1 text-sm font-medium text-emerald-500"><Sparkles className="h-4 w-4" /> AI Responding...</p>}
        {status === 'analyzing' && <p className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Processing...</p>}
      </div>

      <div className="mt-auto flex flex-col items-center gap-6">
        <div className="flex h-12 items-center justify-center gap-1.5">
          {[...Array(7)].map((_, i) => (
            <motion.div key={i} animate={{ height: isOpen ? [8, 32, 8] : 8 }} transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.1 }} className="w-1.5 rounded-full bg-primary opacity-60" />
          ))}
        </div>
        <button onClick={isOpen ? closeSession : startVoiceSession} className={cn('flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black uppercase tracking-widest shadow-ambient transition active:scale-[0.98]', isOpen ? 'border border-rose-300/25 bg-rose-500/10 text-rose-500' : 'bg-primary text-on-primary')}>
          {isOpen ? <X className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
          {isOpen ? 'Stop voice' : 'Start voice'}
        </button>
      </div>
    </>
  );

  if (embedded) {
    return <section className={cn('flex h-full min-h-[520px] flex-col rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-6 shadow-ambient-lg', className)}>{voiceContent}</section>;
  }

  return (
    <>
      {showFab && !isOpen && (
        <button onClick={startVoiceSession} className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-ambient-lg transition-all hover:scale-105 active:scale-95" aria-label="Open voice assistant">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
          <Mic className="relative z-10 h-6 w-6 text-on-primary" />
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex flex-col bg-surface px-5 pb-6 pt-10">
            <div className="flex w-full justify-end">
              <button onClick={closeSession} className="flex h-12 w-12 items-center justify-center rounded-full border border-outline-variant/45 bg-surface-container-lowest text-slate-400 shadow-ambient transition-colors hover:text-on-surface" aria-label="Close voice assistant">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">{voiceContent}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}