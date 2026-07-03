import { useAppStore } from '../store/useAppStore';
import { Battery, Lock, LockOpen, Power, Snowflake, Thermometer } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import VehicleStatus from '../components/VehicleStatus';
import AmbientLightingSettings from '../components/AmbientLightingSettings';

const vehicleImageSrc = '/vehicle-eqs-suv.webp';

export default function Vehicle() {
  const { vehicle, toggleLock, toggleEngine, togglePreCool } = useAppStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col gap-5 pb-24 sm:pb-8"
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-primary">Vehicle</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-on-surface sm:text-4xl">EQS 580 4MATIC</h1>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-outline-variant/45 bg-surface-container-lowest px-4 py-3 text-sm font-black text-on-surface shadow-ambient">
          <span className={cn('h-2.5 w-2.5 rounded-full', vehicle.engineOn ? 'bg-emerald-400' : 'bg-slate-500')} />
          {vehicle.engineOn ? 'Drive system active' : 'Vehicle standby'}
        </div>
      </header>

      <section className="overflow-hidden rounded-3xl border border-outline-variant/45 bg-surface-container-lowest shadow-ambient">
        <div className="relative h-44 bg-[#e5e5e7] sm:h-56 lg:h-64">
          <img
            src={vehicleImageSrc}
            alt="Black Mercedes-Benz EQS SUV"
            className="h-full w-full object-contain mix-blend-multiply"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-surface-container-lowest/70 to-transparent" />
          <div className="absolute left-4 top-4 rounded-2xl border border-outline-variant/35 bg-surface-container-lowest/82 px-3 py-2 backdrop-blur-xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Vehicle view</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">Mercedes-Benz EQS SUV</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex min-h-44 flex-col justify-between rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient">
          <div>
            <Thermometer className="mb-3 h-6 w-6 text-emerald-400" />
            <p className="text-sm font-semibold text-slate-500">Cabin temperature</p>
            <p className="mt-1 text-3xl font-black text-on-surface">{vehicle.cabinTemp} C</p>
          </div>
          <button
            type="button"
            onClick={togglePreCool}
            className={cn(
              'mt-4 flex h-10 items-center justify-center gap-2 rounded-xl border text-xs font-black uppercase tracking-widest transition',
              vehicle.preCooling ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-500' : 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/15'
            )}
          >
            <Snowflake className="h-3.5 w-3.5" />
            {vehicle.preCooling ? 'Pre-cooling' : 'Pre-cool'}
          </button>
        </div>

        <div className="flex min-h-44 flex-col justify-between rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient">
          <div>
            <Battery className="mb-3 h-6 w-6 text-amber-400" />
            <p className="text-sm font-semibold text-slate-500">Battery level</p>
            <div className="mt-1 flex items-end gap-2">
              <p className="text-3xl font-black text-on-surface">{vehicle.batteryLevel}%</p>
              <p className="pb-1 text-xs font-semibold text-slate-500">{Math.round(vehicle.batteryLevel * 3.8)} km est.</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-container-high">
            <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${vehicle.batteryLevel}%` }} />
          </div>
        </div>

        <div className="flex min-h-44 flex-col justify-between rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient">
          <div>
            {vehicle.locked ? <Lock className="mb-3 h-6 w-6 text-primary" /> : <LockOpen className="mb-3 h-6 w-6 text-slate-500" />}
            <p className="text-sm font-semibold text-slate-500">Locked status</p>
            <p className="mt-1 text-3xl font-black text-on-surface">{vehicle.locked ? 'Locked' : 'Unlocked'}</p>
          </div>
          <button
            type="button"
            onClick={toggleLock}
            className={cn(
              'mt-4 h-10 rounded-xl border text-xs font-black uppercase tracking-widest transition',
              vehicle.locked ? 'border-primary bg-primary text-on-primary hover:bg-primary-dim' : 'border-outline-variant/45 bg-surface-container-low text-on-surface hover:bg-surface-container'
            )}
          >
            {vehicle.locked ? 'Unlock' : 'Lock'}
          </button>
        </div>

        <div className="flex min-h-44 flex-col justify-between rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient">
          <div>
            <Power className={cn('mb-3 h-6 w-6', vehicle.engineOn ? 'text-emerald-400' : 'text-rose-400')} />
            <p className="text-sm font-semibold text-slate-500">Engine status</p>
            <p className="mt-1 text-3xl font-black text-on-surface">{vehicle.engineOn ? 'Running' : 'Off'}</p>
          </div>
          <button
            type="button"
            onClick={toggleEngine}
            className="mt-4 flex h-10 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/10 text-xs font-black uppercase tracking-widest text-primary transition hover:bg-primary/15"
          >
            <span className={cn('h-2 w-2 rounded-full', vehicle.engineOn ? 'bg-emerald-400' : 'bg-slate-500')} />
            {vehicle.engineOn ? 'Stop engine' : 'Start engine'}
          </button>
        </div>
      </section>

      <VehicleStatus />
      <AmbientLightingSettings />
    </motion.div>
  );
}
