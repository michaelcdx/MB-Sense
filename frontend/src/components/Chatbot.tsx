import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, BrainCircuit, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import Markdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatbotProps {
  embedded?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

export default function Chatbot({ embedded = false, defaultOpen = false, className }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(embedded || defaultOpen);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Hello Michael. I can help with MB Sense battery predictions, charging windows, and schedule-aware mobility planning.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [highThinking, setHighThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          usePro: highThinking,
          history: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
        })
      });

      const data = await res.json();
      if (data.text) {
        setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'assistant', content: data.text }]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'assistant', content: "I'm having trouble connecting to the MB Sense AI service right now." }]);
    } finally {
      setLoading(false);
    }
  };

  const chatPanel = (
    <motion.div
      initial={{ opacity: 0, y: embedded ? 12 : 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: embedded ? 12 : 100 }}
      className={cn(
        'flex flex-col overflow-hidden border border-outline-variant/45 bg-surface-container-lowest shadow-ambient-lg',
        embedded ? 'h-full min-h-[520px] rounded-3xl' : 'fixed inset-x-0 bottom-0 z-50 h-[80vh] rounded-t-3xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[600px] sm:w-[400px] sm:rounded-3xl',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-outline-variant/45 bg-surface-container-low px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
            <BrainCircuit className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-bold uppercase leading-tight tracking-wide text-on-surface">MB Sense Assistant</h3>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Online</span>
            </div>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant/45 bg-surface-container-lowest text-slate-400 transition hover:text-on-surface" aria-label="Close chatbot">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5 pb-20">
        {messages.map((m) => (
          <div key={m.id} className={cn('flex w-full', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                m.role === 'user' ? 'rounded-tr-sm bg-primary text-on-primary' : 'markdown-body rounded-tl-sm border border-outline-variant/45 bg-surface-container-low text-on-surface'
              )}
            >
              {m.role === 'user' ? m.content : <Markdown>{m.content}</Markdown>}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex w-full justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-outline-variant/45 bg-surface-container-low px-4 py-3 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Processing...
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-outline-variant/45 bg-surface-container-low p-4">
        <form onSubmit={handleSend} className="relative">
          <div className="mb-3 flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 transition-colors hover:text-amber-500">
              <input type="checkbox" className="sr-only" checked={highThinking} onChange={(e) => setHighThinking(e.target.checked)} />
              <div className={cn('flex h-3 w-3 items-center justify-center rounded border transition-all', highThinking ? 'border-amber-500 bg-amber-500' : 'border-outline-variant bg-surface-container-lowest')}>
                {highThinking && <div className="h-1.5 w-1.5 rounded-sm bg-on-surface" />}
              </div>
              High Thinking
            </label>
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about charging predictions..."
            className="w-full rounded-xl border border-outline-variant/55 bg-surface-container-lowest py-3 pl-4 pr-12 text-sm text-on-surface transition-colors focus:border-primary/50 focus:outline-none"
          />
          <button type="submit" disabled={!input.trim() || loading} className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center text-primary hover:text-primary-dim disabled:opacity-50" aria-label="Send message">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </motion.div>
  );

  if (embedded) {
    return (
      <div className={cn('h-full', className)}>
        <AnimatePresence mode="wait">
          {isOpen ? (
            chatPanel
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full min-h-[520px] flex-col items-center justify-center rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-8 text-center shadow-ambient-lg">
              <MessageSquare className="mb-4 h-10 w-10 text-primary" />
              <h3 className="text-2xl font-black text-on-surface">Chat closed</h3>
              <p className="mt-2 max-w-sm text-sm font-semibold leading-relaxed text-slate-500">Open the MB Sense assistant when you need prediction or charging guidance.</p>
              <button onClick={() => setIsOpen(true)} className="mt-6 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-on-primary active:scale-95">
                Open chat
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <>
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} className="fixed bottom-24 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-2xl border border-outline-variant/45 bg-surface-container-lowest shadow-ambient-lg transition-all hover:bg-surface-container-low active:scale-95" aria-label="Open chatbot">
          <MessageSquare className="h-6 w-6 text-primary" />
        </button>
      )}

      <AnimatePresence>{isOpen && chatPanel}</AnimatePresence>
    </>
  );
}