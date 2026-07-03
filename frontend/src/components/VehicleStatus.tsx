import { useState } from 'react';
import { AlertCircle, Check, Gauge, ShieldCheck, Wrench } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';

type TireState = {
  fl: number;
  fr: number;
  rl: number;
  rr: number;
};

type ServiceTask = {
  id: string;
  title: string;
  severity: 'warning' | 'info';
  details: string;
  due: string;
};

const tireLabels: Array<{ key: keyof TireState; label: string }> = [
  { key: 'fl', label: 'Front left' },
  { key: 'fr', label: 'Front right' },
  { key: 'rl', label: 'Rear left' },
  { key: 'rr', label: 'Rear right' },
];

function tireTone(value: number) {
  if (value < 33 || value > 37) return 'border-amber-300/30 bg-amber-500/10 text-amber-500';
  return 'border-emerald-300/25 bg-emerald-500/10 text-emerald-500';
}

export default function VehicleStatus() {
  const { addRecentAction } = useAppStore();
  const [tires, setTires] = useState<TireState>({ fl: 31, fr: 34, rl: 32, rr: 35 });
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [tasks, setTasks] = useState<ServiceTask[]>([
    {
      id: 'brake-fluid',
      title: 'Brake fluid inspection',
      severity: 'warning',
      details: 'Inspect and flush brake fluid reservoir.',
      due: 'Due in 1,200 mi',
    },
    {
      id: 'software-update',
      title: 'OTA software update',
      severity: 'info',
      details: 'Schedule MB OS Navigation 4.2 patch.',
      due: 'Ready',
    },
    {
      id: 'hepa-filter',
      title: 'Cabin HEPA filter refresh',
      severity: 'info',
      details: 'Replace high-efficiency cabin filter.',
      due: 'Due in 3,450 mi',
    },
  ]);

  const calibrateTires = () => {
    setIsCalibrating(true);
    let current = { ...tires };

    const interval = window.setInterval(() => {
      current = {
        fl: Math.min(35, current.fl + 1),
        fr: Math.min(35, current.fr + 1),
        rl: Math.min(35, current.rl + 1),
        rr: Math.min(35, current.rr + 1),
      };
      setTires(current);

      if (Object.values(current).every((value) => value === 35)) {
        window.clearInterval(interval);
        setIsCalibrating(false);
        addRecentAction({
          icon: 'explore',
          title: 'Tires Calibrated',
          description: 'All tires balanced to 35 PSI',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      }
    }, 180);
  };

  const completeTask = (task: ServiceTask) => {
    setTasks((current) => current.filter((item) => item.id !== task.id));
    addRecentAction({
      icon: 'power_settings_new',
      title: 'Service Task Completed',
      description: task.title,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  };

  return (
    <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" id="vehicle-status-dashboard">
      <div className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Tire pressure</p>
            <h2 className="mt-1 text-xl font-black text-on-surface">Pressure matrix</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">Target pressure is 35 PSI.</p>
          </div>
          <Gauge className="h-6 w-6 shrink-0 text-primary" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {tireLabels.map(({ key, label }) => (
            <div key={key} className={cn('rounded-2xl border p-4', tireTone(tires[key]))}>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p>
              <p className="mt-2 text-2xl font-black text-on-surface">{tires[key]} PSI</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={isCalibrating}
          onClick={calibrateTires}
          className={cn(
            'mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-xl border text-xs font-black uppercase tracking-widest transition',
            isCalibrating ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-500' : 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/15'
          )}
        >
          <Check className="h-3.5 w-3.5" />
          {isCalibrating ? 'Calibrating' : 'Calibrate tires'}
        </button>
      </div>

      <div className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Schedule service</p>
            <h2 className="mt-1 text-xl font-black text-on-surface">Task manager</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">Track active maintenance items.</p>
          </div>
          <Wrench className="h-6 w-6 shrink-0 text-primary" />
        </div>

        <div className="mt-5 divide-y divide-outline-variant/45">
          {tasks.length ? (
            tasks.map((task) => (
              <div key={task.id} className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('flex h-8 w-8 items-center justify-center rounded-full', task.severity === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary')}>
                      {task.severity === 'warning' ? <AlertCircle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-on-surface">{task.title}</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-500">{task.details}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <span className="rounded-xl border border-outline-variant/45 bg-surface-container-low px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">{task.due}</span>
                  <button
                    type="button"
                    onClick={() => completeTask(task)}
                    className="h-9 rounded-xl border border-primary/20 bg-primary/10 px-3 text-[10px] font-black uppercase tracking-widest text-primary transition hover:bg-primary/15"
                  >
                    Done
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ShieldCheck className="h-8 w-8 text-emerald-500" />
              <p className="mt-3 text-sm font-black text-on-surface">No scheduled service tasks</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Maintenance queue is clear.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
