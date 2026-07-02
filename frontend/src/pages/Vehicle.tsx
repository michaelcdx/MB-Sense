import { useAppStore } from '../store/useAppStore';
import { Thermometer, Battery, Lock, LockOpen, Power, Snowflake, ChevronRight, Navigation } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useState } from 'react';
import VehicleStatus from '../components/VehicleStatus';
import TripEfficiencyChart from '../components/TripEfficiencyChart';
import AmbientLightingSettings from '../components/AmbientLightingSettings';
import TelemetryWidget from '../components/TelemetryWidget';

export default function Vehicle() {
  const { vehicle, recentActions, toggleLock, toggleEngine, togglePreCool } = useAppStore();
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-8 pb-10"
    >
      {/* Hero Visual */}
      <div className="relative w-full aspect-[16/9] rounded-3xl overflow-hidden bg-surface-container-lowest border border-outline-variant/45 shadow-ambient-lg">
        <img 
          src="https://images.unsplash.com/photo-1560958089-b8a1929cea89?q=80&w=2071&auto=format&fit=crop" 
          alt="Vehicle" 
          className={cn(
            "w-full h-full object-cover transition-opacity duration-1000",
            imgLoaded ? "opacity-85" : "opacity-0"
          )}
          style={{ filter: 'saturate(0.9) contrast(1.05)' }}
          onLoad={() => setImgLoaded(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white/92 via-white/30 to-transparent" />
        <div className="absolute bottom-6 left-6">
          <p className="text-xs text-primary font-bold uppercase tracking-[0.2em] mb-1">Model S-X Active</p>
          <h2 className="text-3xl font-bold text-on-surface tracking-tight">Vanguard-01</h2>
        </div>
      </div>

      {/* Grid */}
      <section className="grid grid-cols-2 gap-4">
        {/* Cabin Temp */}
        <div className="bg-surface-container-lowest border border-outline-variant/45 p-5 rounded-3xl flex flex-col justify-between h-40 shadow-ambient">
          <div>
            <Thermometer className="w-6 h-6 text-emerald-400 mb-3" />
            <p className="text-sm font-medium text-slate-400">Cabin Temp</p>
            <p className="text-2xl font-bold text-on-surface leading-tight mt-1">{vehicle.cabinTemp}°C</p>
          </div>
          <button 
            onClick={togglePreCool}
            className={cn(
              "mt-auto w-full py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all",
              vehicle.preCooling ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/25" : "bg-primary/10 text-primary hover:bg-primary/15 border border-primary/15"
            )}
          >
            {vehicle.preCooling ? 'Cooling...' : 'Pre-cool'}
          </button>
        </div>

        {/* Fuel/Battery */}
        <div className="bg-surface-container-lowest border border-outline-variant/45 p-5 rounded-3xl flex flex-col justify-between h-40 shadow-ambient">
          <div>
            <Battery className="w-6 h-6 text-amber-400 mb-3" />
            <p className="text-sm font-medium text-slate-400">Battery Level</p>
            <div className="flex items-end gap-2 mt-1">
              <p className="text-2xl font-bold text-on-surface leading-tight">{vehicle.batteryLevel}%</p>
              <p className="text-xs text-slate-500 font-medium pb-1">420km</p>
            </div>
          </div>
          <div className="mt-auto w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 transition-all" style={{ width: `${vehicle.batteryLevel}%` }} />
          </div>
        </div>

        {/* Status (Lock) */}
        <div className={cn(
          "bg-surface-container-lowest p-5 rounded-3xl flex flex-col justify-between h-40 transition-all border shadow-ambient",
          vehicle.locked ? "border-primary/25" : "border-outline-variant/45"
        )}>
          <div>
            {vehicle.locked ? <Lock className="w-6 h-6 text-primary mb-3" /> : <LockOpen className="w-6 h-6 text-slate-400 mb-3" />}
            <p className="text-sm font-medium text-slate-400">Status</p>
            <p className="text-2xl font-bold text-on-surface leading-tight mt-1">{vehicle.locked ? 'Locked' : 'Unlocked'}</p>
          </div>
          <button 
            onClick={toggleLock}
            className={cn(
              "mt-auto w-full py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2",
              vehicle.locked ? "bg-primary text-on-primary hover:bg-primary-dim" : "bg-surface-container text-on-surface hover:bg-surface-container-high"
            )}
          >
            {vehicle.locked ? 'Unlock' : 'Lock'}
          </button>
        </div>

        {/* Engine Status */}
        <div className="bg-surface-container-lowest border border-outline-variant/45 p-5 rounded-3xl flex flex-col justify-between h-40 shadow-ambient">
          <div>
            <Power className={cn("w-6 h-6 mb-3", vehicle.engineOn ? "text-emerald-400" : "text-rose-400")} />
            <p className="text-sm font-medium text-slate-400">Engine</p>
            <p className="text-2xl font-bold text-on-surface leading-tight mt-1">{vehicle.engineOn ? 'Running' : 'Off'}</p>
          </div>
          <button 
             onClick={toggleEngine}
             className="w-full flex items-center justify-center gap-2 text-on-surface mt-auto bg-primary/10 py-2.5 rounded-xl hover:bg-primary/15 border border-primary/15"
          >
            <div className={cn("w-2 h-2 rounded-full", vehicle.engineOn ? "bg-emerald-400 animate-pulse" : "bg-slate-500")} />
            <span className="text-xs font-bold uppercase tracking-widest">{vehicle.engineOn ? 'Active' : 'Standby'}</span>
          </button>
        </div>
      </section>

      {/* Real-time Vehicle Cockpit Telemetry & Service Widget */}
      <TelemetryWidget />

      {/* Interactive Interior Ambient Lighting Settings Panel */}
      <AmbientLightingSettings />

      {/* Vehicle Telemetrics & Status Dashboard */}
      <VehicleStatus />

      {/* Recharts Trip Efficiency Data Visualization */}
      <TripEfficiencyChart />

      {/* Recent Actions */}
      <section>
        <h3 className="text-lg font-bold text-on-surface mb-4 px-1">Recent Actions</h3>
        <div className="bg-surface-container-lowest border border-outline-variant/45 rounded-3xl overflow-hidden divide-y divide-white/5 shadow-ambient">
          {recentActions.map((action, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-transparent hover:bg-surface-container-low transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-surface-container border border-outline-variant/45 flex items-center justify-center">
                  {action.icon === 'ac_unit' && <Snowflake className="w-5 h-5 text-emerald-400" />}
                  {action.icon === 'lock' && <Lock className="w-5 h-5 text-blue-400" />}
                  {action.icon === 'lock_open' && <LockOpen className="w-5 h-5 text-slate-400" />}
                  {action.icon === 'power_settings_new' && <Power className="w-5 h-5 text-rose-400" />}
                  {action.icon === 'explore' && <Navigation className="w-5 h-5 text-amber-400" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{action.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{action.description} • {action.time}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </div>
          ))}
        </div>
      </section>
    </motion.div>
  );
}
