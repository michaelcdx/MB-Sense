import { useAppStore } from '../store/useAppStore';
import { motion } from 'motion/react';
import { Settings, Shield, ChevronRight, Zap, TrendingUp, History, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

export default function Profile() {
  const { user, updateUser } = useAppStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'settings'>('profile');
  
  // Settings Form State
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState('password123');
  const [newPassword, setNewPassword] = useState('password123');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [notifyPrefs, setNotifyPrefs] = useState(user.notifications.preferences);
  const [notifyPhotos, setNotifyPhotos] = useState(user.notifications.photos);

  const handleSaveChanges = () => {
    updateUser({
      name,
      email,
      notifications: {
        preferences: notifyPrefs,
        photos: notifyPhotos
      }
    });
    // Normally you'd also handle password change here
  };

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
           <div className="w-24 h-24 rounded-full border-2 border-primary p-1 bg-surface-container-lowest shadow-ambient">
             <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop" alt={user.name} className="w-full h-full rounded-full object-cover" />
           </div>
           <div className="absolute bottom-0 right-[-4px] bg-emerald-500 rounded-full border-4 border-surface p-1">
             <Shield className="w-3 h-3 text-emerald-950" fill="currentColor" />
           </div>
        </div>
        <h2 className="text-2xl font-bold text-on-surface mb-1">{user.name}</h2>
        <p className="text-slate-400 text-sm font-medium">{user.email}</p>
      </section>

      {/* Tabs */}
      <div className="bg-surface-container-low p-1 flex rounded-xl border border-outline-variant/45 mx-auto w-full max-w-sm shadow-ambient">
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'profile' ? 'bg-primary text-on-primary shadow-ambient' : 'text-slate-400'}`}
        >
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === 'settings' ? 'bg-primary text-on-primary shadow-ambient' : 'text-slate-400'}`}
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
              <div className="bg-surface-container-lowest border border-outline-variant/45 p-5 rounded-3xl flex flex-col gap-4 shadow-ambient">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-primary font-bold uppercase tracking-widest">Home Location</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-400 font-medium pb-2 border-b border-outline-variant/45">124 Bluebird Lane, Austin</p>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <History className="w-4 h-4" />
                  <span className="text-xs font-medium">Avg Departure: 08:15 AM</span>
                </div>
              </div>

               {/* Work */}
               <div className="bg-surface-container-lowest border border-outline-variant/45 p-5 rounded-3xl flex flex-col gap-4 shadow-ambient">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-primary font-bold uppercase tracking-widest">Work Location</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-400 font-medium pb-2 border-b border-outline-variant/45">Silicon Plaza Bldg 4, Austin</p>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <History className="w-4 h-4" />
                  <span className="text-xs font-medium">Avg Return: 05:45 PM</span>
                </div>
              </div>
            </div>
          </section>

          {/* AI Optimizer summary */}
          <section className="bg-primary/5 border border-primary/20 p-6 rounded-3xl shadow-ambient">
            <h3 className="text-lg font-bold text-on-surface mb-2">Routine Synergy</h3>
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
           <section className="flex flex-col items-center sm:flex-row sm:items-center sm:justify-start gap-4 mb-8">
             <div className="w-16 h-16 rounded-full border-2 border-outline-variant overflow-hidden">
               <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop" alt={user.name} className="w-full h-full object-cover" />
             </div>
             <button className="text-sm font-bold text-primary bg-primary/10 hover:bg-primary/15 border border-primary/20 px-4 py-2 rounded-lg transition-colors">
               Upload New Photo
             </button>
           </section>

           <section className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface tracking-wide px-1">Full Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface-container-lowest border border-primary/30 rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface tracking-wide px-1">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-container-lowest border border-primary/30 rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface tracking-wide px-1">Current Password</label>
              <div className="relative">
                <input 
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-primary/30 rounded-xl pl-4 pr-12 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
                />
                <button 
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface tracking-wide px-1">New Password</label>
              <div className="relative">
                <input 
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-primary/30 rounded-xl pl-4 pr-12 py-2.5 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors"
                />
                <button 
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
           </section>

           <section className="space-y-4 pt-4">
            <h3 className="text-xs font-bold text-on-surface px-1">Notification Preferences</h3>
            
            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-slate-300">Notification Preferences</span>
              <button 
                onClick={() => setNotifyPrefs(!notifyPrefs)}
                className={`w-10 h-6 rounded-full relative transition-colors ${notifyPrefs ? 'bg-primary' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${notifyPrefs ? 'right-1 bg-on-primary' : 'left-1 bg-white'}`}></div>
              </button>
            </div>

            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-slate-300">Notification Photos</span>
              <button 
                onClick={() => setNotifyPhotos(!notifyPhotos)}
                className={`w-10 h-6 rounded-full relative transition-colors ${notifyPhotos ? 'bg-primary' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${notifyPhotos ? 'right-1 bg-on-primary' : 'left-1 bg-white'}`}></div>
              </button>
            </div>
           </section>

           <button 
             onClick={handleSaveChanges}
             className="w-full bg-primary text-on-primary font-bold text-sm py-3 rounded-xl mt-8 hover:bg-primary-dim transition-colors active:scale-[0.98]"
           >
             Save Changes
           </button>
         </div>
      )}
    </motion.div>
  );
}
