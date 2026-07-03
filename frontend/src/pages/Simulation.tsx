import { motion } from 'motion/react';
import { Battery, BatteryCharging, Minus, Plus, SlidersHorizontal } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';

function batteryColors(level: number) {
  if (level < 20) return { fill: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-300/30' };
  if (level < 45) return { fill: 'bg-amber-400', text: 'text-amber-500', border: 'border-amber-300/30' };
  return { fill: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-300/30' };
}

export default function Simulation() {
  const { vehicle, setBatteryLevel } = useAppStore();
  const level = vehicle.batteryLevel;
  const colors = batteryColors(level);
  const estimatedRange = Math.round((level / 100) * 420);

  const adjustBattery = (delta: number) => {
    setBatteryLevel(level + delta);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-5 pb-24 sm:pb-8">
      <section className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient-lg sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-primary">
              <SlidersHorizontal className="h-4 w-4" />
              Simulation
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-on-surface sm:text-4xl">Vehicle Simulation</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-500">Adjust the shared vehicle battery level used across MB Sense.</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-black text-primary">
            <BatteryCharging className="h-4 w-4" />
            Live vehicle state
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
        <div className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient-lg sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Battery Level</p>
              <h2 className="mt-2 text-2xl font-black text-on-surface">{level}%</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Estimated range {estimatedRange} km</p>
            </div>
            <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl border bg-surface-container-low', colors.text, colors.border)}>
              <Battery className="h-7 w-7" />
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
              <span>0%</span>
              <span>100%</span>
            </div>
            <div className="h-4 overflow-hidden rounded-full border border-outline-variant/45 bg-surface-container-low">
              <div className={cn('h-full rounded-full transition-all duration-200', colors.fill)} style={{ width: `${level}%` }} />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient-lg sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Control</p>
              <h2 className="mt-1 text-xl font-black text-on-surface">Battery simulator</h2>
            </div>
            <span className="rounded-full border border-outline-variant/45 bg-surface-container-low px-3 py-1 text-xs font-black text-on-surface">{level}%</span>
          </div>

          <div className="mt-7 flex items-center gap-3">
            <button type="button" onClick={() => adjustBattery(-5)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-outline-variant/45 bg-surface-container-low text-on-surface" aria-label="Decrease battery level">
              <Minus className="h-5 w-5" />
            </button>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={level}
              onChange={(event) => setBatteryLevel(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-primary"
              aria-label="Battery level"
            />
            <button type="button" onClick={() => adjustBattery(5)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-outline-variant/45 bg-surface-container-low text-on-surface" aria-label="Increase battery level">
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-2">
            {[20, 50, 80, 100].map((value) => (
              <button key={value} type="button" onClick={() => setBatteryLevel(value)} className={cn('h-10 rounded-xl border text-xs font-black transition', level === value ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/45 bg-surface-container-low text-on-surface')}>
                {value}%
              </button>
            ))}
          </div>
        </div>
      </section>
    </motion.div>
  );
}