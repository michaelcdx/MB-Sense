import { useAppStore } from '../store/useAppStore';
import { motion } from 'motion/react';
import { Settings, Shield, ChevronRight, Zap, TrendingUp, History } from 'lucide-react';
import { useState } from 'react';

export default function Profile() {
  const { user } = useAppStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile');

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-8 pb-32"
    >
      {/* Profile Header */}
      <section className="flex flex-col items-center mt-4">
        <div className="relative mb-4">
           <div className="w-24 h-24 rounded-full border-2 border-blue-500 p-1">
             <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop" alt={user.name} className="w-full h-full rounded-full object-cover" />
           </div>
           <div className="absolute bottom-0 right-[-4px] bg-emerald-500 rounded-full border-4 border-slate-950 p-1">
             <Shield className="w-3 h-3 text-emerald-950" fill="currentColor" />
           </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">{user.name}</h2>
        <p className="text-slate-400 text-sm font-medium">{user.email}</p>
      </section>

      {/* Tabs */}
      <div className="bg-slate-900 p-1 flex rounded-xl border border-white/5 mx-auto w-full max-w-sm">
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'profile' ? 'bg-white text-slate-950' : 'text-slate-400'}`}
        >
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'settings' ? 'bg-white text-slate-950' : 'text-slate-400'}`}
        >
          Settings
        </button>
      </div>

      {activeTab === 'profile' ? (
        <>
            {/* Driving Habits */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Driving Habits</h3>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">AI Active</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Home */}
              <div className="bg-slate-900 border border-white/5 p-5 rounded-3xl flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-400 font-bold uppercase tracking-widest">Home Location</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-400 font-medium pb-2 border-b border-white/5">124 Bluebird Lane, Austin</p>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <History className="w-4 h-4" />
                  <span className="text-xs font-medium">Avg Departure: 08:15 AM</span>
                </div>
              </div>

               {/* Work */}
               <div className="bg-slate-900 border border-white/5 p-5 rounded-3xl flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-400 font-bold uppercase tracking-widest">Work Location</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-400 font-medium pb-2 border-b border-white/5">Silicon Plaza Bldg 4, Austin</p>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <History className="w-4 h-4" />
                  <span className="text-xs font-medium">Avg Return: 05:45 PM</span>
                </div>
              </div>
            </div>
          </section>

          {/* AI Optimizer summary */}
          <section className="bg-blue-500/5 border border-blue-500/20 p-6 rounded-3xl">
            <h3 className="text-lg font-bold text-white mb-2">Routine Synergy</h3>
            <p className="text-sm text-slate-400 font-medium mb-4 leading-relaxed">Your AI has optimized your commute times by 14% this week. Maintaining your current 8:15 AM departure is recommended.</p>
            <div className="flex gap-4">
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold uppercase tracking-widest">
                <TrendingUp className="w-4 h-4" /> Efficiency +4%
              </span>
              <span className="flex items-center gap-1 text-xs text-amber-400 font-bold uppercase tracking-widest">
                <Zap className="w-4 h-4" /> Energy Saved
              </span>
            </div>
          </section>
        </>
      ) : (
         <div className="space-y-6">
           <section className="space-y-4">
            <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest px-1">Notifications</h3>
            <div className="bg-slate-900 border border-white/5 rounded-3xl overflow-hidden divide-y divide-white/5">
              <div className="flex items-center justify-between p-5 hover:bg-slate-800/50 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-white">Departure Alerts</p>
                  <p className="text-xs text-slate-500 mt-1">Get notified when it's time to head to vehicle</p>
                </div>
                <div className="w-10 h-6 bg-blue-500 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 bg-white w-4 h-4 rounded-full"></div>
                </div>
              </div>
              <div className="flex items-center justify-between p-5 hover:bg-slate-800/50 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-white">Pre-cool confirmations</p>
                  <p className="text-xs text-slate-500 mt-1">Confirmed cabin temp optimizations</p>
                </div>
                <div className="w-10 h-6 bg-blue-500 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 bg-white w-4 h-4 rounded-full"></div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8 pt-8 border-t border-white/5">
            <h3 className="text-xs font-bold text-rose-500 uppercase tracking-widest px-1 mb-4">Danger Zone</h3>
            <div className="bg-rose-500/5 border border-rose-500/20 p-5 flex flex-col items-center justify-between gap-4 rounded-3xl sm:flex-row">
              <div>
                <p className="text-sm font-bold text-white">Delete Account</p>
                <p className="text-xs text-slate-400 mt-1">Permanently remove vehicle data and history</p>
              </div>
              <button className="px-6 py-2.5 bg-rose-500/10 text-rose-500 border border-rose-500/50 rounded-xl text-xs font-bold tracking-widest uppercase hover:bg-rose-500 hover:text-white transition-colors text-nowrap w-full w-full">
                Delete Account
              </button>
            </div>
          </section>
         </div>
      )}
    </motion.div>
  );
}
