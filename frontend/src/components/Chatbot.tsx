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

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Hello Alex. How can I assist you with your mobility and schedule today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [highThinking, setHighThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMsg, 
          usePro: highThinking,
          // History can be passed here if implemented fully on backend
          history: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
        })
      });

      const data = await res.json();
      if (data.text) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: data.text }]);
      }
    } catch(err) {
      console.error(err);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: "I'm having trouble connecting to my neural core right now." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 left-6 w-14 h-14 bg-slate-800 border border-white/10 rounded-2xl shadow-lg flex items-center justify-center hover:bg-slate-700 active:scale-95 transition-all z-40"
        >
          <MessageSquare className="w-6 h-6 text-blue-400" />
        </button>
      )}

      {/* Chat Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-x-0 bottom-0 z-50 flex h-[80vh] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-slate-900 shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[600px] sm:w-[400px] sm:rounded-3xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                  <BrainCircuit className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 leading-tight">AIDV Assistant</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">Online</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 pb-20 space-y-4">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex w-full", m.role === 'user' ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    m.role === 'user' ? "bg-blue-500 text-white rounded-tr-sm" : "bg-slate-800 border border-white/5 text-slate-200 rounded-tl-sm markdown-body"
                  )}>
                    {m.role === 'user' ? m.content : <Markdown>{m.content}</Markdown>}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start w-full">
                  <div className="bg-slate-800 border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    Processing...
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="absolute bottom-0 inset-x-0 bg-slate-950 p-4 border-t border-white/5">
              <form onSubmit={handleSend} className="relative">
                <div className="absolute left-3 top-[-36px] flex items-center gap-2">
                  <label className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-slate-400 cursor-pointer hover:text-amber-400 transition-colors">
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={highThinking}
                      onChange={(e) => setHighThinking(e.target.checked)}
                    />
                    <div className={cn("w-3 h-3 rounded flex items-center justify-center border transition-all", highThinking ? "bg-amber-500 border-amber-500" : "bg-slate-800 border-white/20")}>
                      {highThinking && <div className="w-1.5 h-1.5 bg-slate-950 rounded-sm" />}
                    </div>
                    High Thinking
                  </label>
                </div>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me anything..."
                  className="w-full bg-slate-900 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                />
                <button 
                  type="submit" 
                  disabled={!input.trim() || loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-blue-400 hover:text-blue-300 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
