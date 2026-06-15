import { motion } from 'motion/react';
import { useAppStore } from '../store/useAppStore';
import { Car, Video, MapPin, Clock, BrainCircuit } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState } from 'react';

export default function Calendar() {
  const { events } = useAppStore();
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events })
      });
      // In a real app we would update the store with AI insights
      await res.json();
      setTimeout(() => setAnalyzing(false), 800);
    } catch(e) {
      console.error(e);
      setAnalyzing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-6 pb-20"
    >
      <section className="mt-2 mb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">September 2026</h2>
            <p className="text-sm text-slate-400 mt-1 font-medium">{events.filter(e => e.carNeeded).length} pending vehicle assignments</p>
          </div>
          <div className="bg-slate-900 p-1 flex gap-1 rounded-full border border-white/5">
     			<button className="px-4 py-1.5 rounded-full text-sm font-bold bg-blue-500/20 text-blue-400">Month</button>
            <button className="px-4 py-1.5 rounded-full text-sm font-medium text-slate-400 hover:text-slate-200">Week</button>
          </div>
        </div>

        {/* Simplified Bento Grid Calendar Header */}
        <div className="grid grid-cols-7 gap-2 p-4 bg-slate-900 border border-white/5 rounded-3xl">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} className="text-center text-[10px] text-slate-500 font-bold uppercase">{d}</div>
          ))}
          {/* Mock days */}
          {[28,29,30,31].map(d => <div key={d} className="h-10 flex items-center justify-center text-slate-600 text-sm">{d}</div>)}
          <div className="h-10 flex items-center justify-center text-white text-sm bg-blue-500/20 rounded-xl border border-blue-500/30 relative">
            1 <span className="absolute bottom-1 w-1 h-1 bg-emerald-400 rounded-full"></span>
          </div>
          <div className="h-10 flex items-center justify-center text-slate-300 text-sm">2</div>
          <div className="h-10 flex items-center justify-center text-slate-300 text-sm relative">
            3 <span className="absolute bottom-1 w-1 h-1 bg-amber-400 rounded-full"></span>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-blue-400 tracking-widest uppercase">Upcoming Agenda</h3>
          <button onClick={handleAnalyze} className="text-slate-400 hover:text-white transition-colors" title="Analyze with AI">
            <BrainCircuit className={cn("w-5 h-5", analyzing && "text-blue-400 animate-pulse")} />
          </button>
        </div>

        {events.map((event, i) => (
            <div key={event.id} className={cn(
              "bg-slate-900 border rounded-3xl p-6 relative group transition-all duration-300",
              event.carNeeded ? "border-white/5 hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]" : "border-white/5",
              event.category === 'other' ? "border-amber-500/20" : ""
            )}>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5",
                    event.carNeeded ? "bg-blue-500/20 text-blue-400" : "bg-slate-800 text-slate-400"
                  )}>
                    {event.carNeeded ? <Car className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                    {event.status || (event.carNeeded ? 'Vehicle Required' : 'Remote / No Car')}
                  </span>
                </div>
                
                <h4 className="text-xl font-bold text-slate-100">{event.title}</h4>
                
                <div className="flex flex-col items-start gap-2 text-slate-400 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Clock className="w-4 h-4" />
                    {event.time}
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 bg-slate-950 rounded-full w-fit border border-white/5">
                    {event.carNeeded ? <MapPin className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                    {event.location}
                  </div>
                </div>
              </div>
            </div>
        ))}
        
        {/* Mock uncertain event */}
        <div className="bg-slate-900 border border-amber-500/20 rounded-3xl p-6 relative group hover:shadow-[0_0_30px_rgba(245,166,35,0.1)] transition-all duration-300">
             <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-lg text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5 animate-pulse">
                    <BrainCircuit className="w-3.5 h-3.5" />
                    AI Analyzing Need
                  </span>
                </div>
                <h4 className="text-xl font-bold text-slate-100">Client Site Visit</h4>
                <div className="flex flex-col items-start gap-2 text-slate-400 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Clock className="w-4 h-4" />
                    04:30 - 06:00 PM
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 bg-slate-950 rounded-full w-fit border border-white/5">
                    <MapPin className="w-4 h-4" />
                    Location Pending
                  </div>
                </div>
              </div>
        </div>

      </section>
    </motion.div>
  );
}
