import { motion } from 'motion/react';
import { useAppStore } from '../store/useAppStore';
import { BatteryCharging, Clock, Gauge, Zap, Battery, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function Home() {
  const { user, location, weather, vehicle, events } = useAppStore();
  const [time, setTime] = useState('');
  

  useEffect(() => {
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingEvent = [...events]
    .filter((event) => event.carNeeded && new Date(event.date).getTime() >= today.getTime())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? events.find((event) => event.carNeeded) ?? events[0] ?? null;
  const currentBattery = vehicle.batteryLevel;
  const idealMinBattery = 20;
  const idealMaxBattery = 80;
  const recommendedTarget = 80;
  const estimatedTomorrowUse = 16;
  const dayAfterTomorrowUse = 40;
  const estimatedEnergyUsePercent = estimatedTomorrowUse + dayAfterTomorrowUse;
  const projectedBatteryAfterTrips = currentBattery - estimatedEnergyUsePercent;
  const minimumBatteryNeeded = estimatedEnergyUsePercent + idealMinBattery;
  const recommendedTopUp = Math.max(recommendedTarget - currentBattery, 0);
  const isChargeRecommended = currentBattery < minimumBatteryNeeded;
  const chargeStart = new Date();
  chargeStart.setDate(chargeStart.getDate() + 1);
  chargeStart.setHours(20, 30, 0, 0);
  const chargeEnd = new Date(chargeStart);
  chargeEnd.setHours(22, 0, 0, 0);
  const highDemandDate = new Date();
  highDemandDate.setDate(highDemandDate.getDate() + 2);
  const formatPlanDate = (date: Date) => date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
  const formatPlanTime = (date: Date) => date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
  const chargeWindow = `${formatPlanDate(chargeStart)}, ${formatPlanTime(chargeStart)}-${formatPlanTime(chargeEnd)}`;
  const highDemandLabel = formatPlanDate(highDemandDate);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col gap-6"
    >
      {/* Greeting */}
      <section className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Hello, {user.name.split(' ')[0]}</h1>
          <p className="text-sm text-slate-400 mt-1 font-medium tracking-wide">{time}</p>
        </div>
        <div className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant/45 px-4 py-2 rounded-xl shadow-ambient">
          <div className="text-right">
            <p className="text-xs text-slate-300 font-medium">{location}</p>
            <p className="text-lg font-semibold text-blue-400">{weather.temp}°C</p>
          </div>
        </div>
      </section>

      {/* Predictive Charging Card */}
      <section>
        <div className="relative overflow-hidden bg-surface-container-lowest border border-outline-variant/45 rounded-3xl p-5 shadow-ambient-lg">
          <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
          <div className="relative z-10 flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                  isChargeRecommended
                    ? "bg-amber-950/70 text-amber-500 border-amber-500/25"
                    : "bg-emerald-950/70 text-emerald-500 border-emerald-500/25"
                )}>
                  <Zap className="w-3.5 h-3.5" />
                  {isChargeRecommended ? 'Charge recommended' : 'Battery ready'}
                </span>
                <h2 className="mt-3 text-2xl font-extrabold text-slate-100 leading-tight">Predictive EV charging</h2>
                <p className="mt-1 text-xs font-semibold text-slate-400 leading-relaxed">
                  MB Sense predicts charging before the battery becomes a problem.
                </p>
              </div>

              <div className="shrink-0 rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 text-center">
                <Battery className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="font-mono text-3xl font-black text-primary leading-none">{currentBattery}%</p>
                <p className="mt-1 text-[9px] font-black text-slate-500 uppercase tracking-widest">Battery</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span>Current charge</span>
                <span>Ideal daily span {idealMinBattery}-{idealMaxBattery}%</span>
              </div>
              <div className="relative h-3 rounded-full bg-surface-container-low border border-outline-variant/45 overflow-hidden">
                <div className="absolute left-[20%] top-0 h-full w-[60%] bg-emerald-400/15" />
                <div
                  className={cn(
                    "relative h-full rounded-full transition-all duration-500",
                    currentBattery < idealMinBattery ? "bg-rose-500" : currentBattery > idealMaxBattery ? "bg-amber-400" : "bg-primary"
                  )}
                  style={{ width: `${Math.min(currentBattery, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-500">
                <span>0%</span>
                <span>20% reserve</span>
                <span>80% target</span>
                <span>100%</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-surface-container-low border border-outline-variant/45 p-3">
                <Clock className="w-4 h-4 text-primary mb-2" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Best charge</p>
                <p className="mt-1 text-xs font-extrabold text-slate-100 leading-snug">{chargeWindow}</p>
              </div>
              <div className="rounded-2xl bg-surface-container-low border border-outline-variant/45 p-3">
                <Gauge className="w-4 h-4 text-amber-500 mb-2" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Need by {highDemandLabel}</p>
                <p className="mt-1 text-xs font-extrabold text-slate-100 leading-snug">{minimumBatteryNeeded}% incl. reserve</p>
              </div>
              <div className="rounded-2xl bg-surface-container-low border border-outline-variant/45 p-3">
                <BatteryCharging className="w-4 h-4 text-emerald-500 mb-2" />
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Charge target</p>
                <p className="mt-1 text-xs font-extrabold text-slate-100 leading-snug">{recommendedTarget}% daily target</p>
              </div>
            </div>

            <div className={cn(
              "rounded-2xl border p-4 flex gap-3",
              isChargeRecommended
                ? "bg-amber-950/60 border-amber-500/25"
                : "bg-emerald-950/60 border-emerald-500/20"
            )}>
              <AlertTriangle className={cn(
                "w-5 h-5 shrink-0 mt-0.5",
                isChargeRecommended ? "text-amber-500" : "text-emerald-500"
              )} />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reason to charge</p>
                <p className="mt-1 text-sm font-semibold text-slate-100 leading-relaxed">
                  {upcomingEvent ? `${upcomingEvent.title} is part of the forecast. ` : ''}
                  The next two days are estimated to use {estimatedEnergyUsePercent}% battery, including a {dayAfterTomorrowUse}% high-demand day after tomorrow ({highDemandLabel}). At {currentBattery}%, you would finish near {Math.max(projectedBatteryAfterTrips, 0)}%, below the {idealMinBattery}% reserve target.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link to="/vehicle" className="bg-primary text-on-primary py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-98 flex items-center justify-center gap-2 shadow-ambient">
                <BatteryCharging className="w-4 h-4" />
                Plan charge
              </Link>
              <div className="bg-surface-container-low border border-outline-variant/45 rounded-xl px-3 py-2 flex items-center justify-center text-center">
                <p className="text-[10px] font-bold text-slate-500 leading-snug">
                  Add {recommendedTopUp}% to reach the battery-friendly {recommendedTarget}% daily target.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
