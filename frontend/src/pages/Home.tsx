import { motion } from 'motion/react';
import { useAppStore } from '../store/useAppStore';
import { 
  Search, Mic, Calendar as CalendarIcon, BatteryCharging, Clock, Gauge, Zap,
  Thermometer, Battery, CircleCheck, Info, Car,
  CloudRain, CloudFog, CloudSnow, Sun, Wind, Droplets, Eye, ShieldAlert, AlertTriangle, MapPin
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import Markdown from 'react-markdown';

export default function Home() {
  const { user, location, weather, vehicle, events, addRecentAction } = useAppStore();
  const [time, setTime] = useState('');
  
  // Weather condition alerts and geolocation states
  const [lat, setLat] = useState(37.4419);
  const [lng, setLng] = useState(-122.1430);
  const [preset, setPreset] = useState<'clear' | 'fog' | 'rain' | 'ice' | 'gale'>('clear');
  const [isLocating, setIsLocating] = useState(false);
  const [isLoadingAdvisory, setIsLoadingAdvisory] = useState(false);
  const [advisoryError, setAdvisoryError] = useState<string | null>(null);
  const [advisory, setAdvisory] = useState<{
    locationName: string;
    temp: number;
    humidity: number;
    visibility: string;
    windSpeed: string;
    weatherDescription: string;
    safetyRating: number;
    alertLevel: string;
    drivingAlert: string;
    mbFeaturesActive: string[];
  } | null>(null);

  const fetchAdvisory = async (latitude: number, longitude: number, currentPreset: string) => {
    setIsLoadingAdvisory(true);
    setAdvisoryError(null);
    try {
      const res = await fetch('/api/weather-advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: latitude, lng: longitude, weatherPreset: currentPreset })
      });
      if (!res.ok) {
        throw new Error('Failed to fetch weather advisory');
      }
      const data = await res.json();
      setAdvisory(data);
    } catch (err: any) {
      console.error(err);
      setAdvisoryError('Could not contact MB Weather telemetry. Displaying safety cache.');
    } finally {
      setIsLoadingAdvisory(false);
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setAdvisoryError('Geolocation is not supported by this browser.');
      return;
    }
    setIsLocating(true);
    setAdvisoryError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const uLat = position.coords.latitude;
        const uLng = position.coords.longitude;
        setLat(uLat);
        setLng(uLng);
        setIsLocating(false);
        fetchAdvisory(uLat, uLng, preset);
        addRecentAction({
          icon: 'explore',
          title: 'Location Synchronized',
          description: `Telemetry updated to ${uLat.toFixed(3)}°N, ${uLng.toFixed(3)}°W`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      },
      (error) => {
        console.warn('Geolocation failed:', error);
        setIsLocating(false);
        setAdvisoryError('Location access denied. Utilizing standard Peninsula telemetry.');
        fetchAdvisory(lat, lng, preset);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  useEffect(() => {
    fetchAdvisory(lat, lng, preset);
  }, [preset]);

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

      {/* Search Bar */}
      <section>
        <div className="bg-surface-container-lowest border border-outline-variant/45 rounded-2xl flex items-center px-4 py-3 gap-3 shadow-ambient focus-within:ring-2 focus-within:ring-primary/35 transition-all">
          <Search className="w-5 h-5 text-primary" />
          <input 
            type="text" 
            placeholder="Where to?" 
            className="bg-transparent border-none flex-1 focus:ring-0 text-on-surface placeholder:text-slate-500" 
          />
          <Mic className="w-5 h-5 text-slate-400" />
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
      {/* Geolocation Weather & Driving Safety Center Widget */}
      <section className="bg-surface-container-lowest border border-outline-variant/45 rounded-3xl p-5 flex flex-col gap-4 relative overflow-hidden shadow-ambient">
        {/* Decorative Top Accent Glow */}
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
        
        {/* Title and Geolocation Trigger */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            <h3 className="font-extrabold text-sm text-slate-200 uppercase tracking-wider">Drive Conditions Watch</h3>
          </div>
          
          <button
            onClick={handleGetLocation}
            disabled={isLocating || isLoadingAdvisory}
            className={cn(
              "px-3 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all",
              isLocating 
                ? "bg-surface-container border-outline-variant/45 text-slate-400 cursor-not-allowed" 
                : "bg-primary/10 hover:bg-primary/15 active:scale-98 border-primary/20 text-primary hover:border-primary/30"
            )}
          >
            <MapPin className="w-3.5 h-3.5 text-primary" />
            {isLocating ? (
              <>
                <span className="sm:hidden">Syncing</span>
                <span className="hidden sm:inline">Syncing GPS...</span>
              </>
            ) : (
              <>
                <span className="sm:hidden">Detect</span>
                <span className="hidden sm:inline">Detect Location</span>
              </>
            )}
          </button>
        </div>

        {advisoryError && (
          <div className="bg-amber-950/40 border border-amber-500/20 text-amber-350 text-[11px] px-3 py-2 rounded-xl flex items-center gap-1.5 font-medium leading-tight">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>{advisoryError}</span>
          </div>
        )}

        {/* Forecast / Custom Simulation presets selection */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-0.5">Simulate Driving Scenario Weather</span>
          <div className="grid grid-cols-5 gap-1 p-1 bg-surface-container-low rounded-xl border border-outline-variant/45">
            {([
              { key: 'clear', label: 'Clear' },
              { key: 'fog', label: 'Fog' },
              { key: 'rain', label: 'Rain' },
              { key: 'ice', label: 'Ice' },
              { key: 'gale', label: 'Wind' }
            ] as const).map((opt) => (
              <button
                key={opt.key}
                disabled={isLoadingAdvisory}
                onClick={() => setPreset(opt.key)}
                className={cn(
                  "py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  preset === opt.key 
                    ? "bg-primary/15 border border-primary/35 text-primary" 
                    : "text-slate-400 hover:text-on-surface bg-transparent border border-transparent"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Advisory main content panel */}
        {isLoadingAdvisory ? (
          <div className="h-44 bg-surface-container-low rounded-2xl border border-outline-variant/45 flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-xs text-slate-400 font-bold tracking-widest uppercase">Querying Weather Telemetry...</p>
          </div>
        ) : advisory ? (
          <div className="flex flex-col gap-3.5 bg-surface-container-low p-4 rounded-2xl border border-outline-variant/45">
            {/* Bottom row: Condition overview & Dial score */}
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-surface-container-lowest rounded-xl border border-outline-variant/45 shadow-ambient">
                  {preset === 'clear' && <Sun className="w-8 h-8 text-amber-400" />}
                  {preset === 'fog' && <CloudFog className="w-8 h-8 text-sky-300" />}
                  {preset === 'rain' && <CloudRain className="w-8 h-8 text-blue-400" />}
                  {preset === 'ice' && <CloudSnow className="w-8 h-8 text-violet-300" />}
                  {preset === 'gale' && <Wind className="w-8 h-8 text-teal-300" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    {advisory.weatherDescription}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-500" /> {advisory.locationName}
                  </p>
                </div>
              </div>

              {/* Safety Index Dial */}
              <div className="flex flex-col items-center shrink-0">
                <div className="relative flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full border-4 border-primary/10 bg-surface-container-lowest flex items-center justify-center">
                    <span className={cn(
                      "text-sm font-black font-mono",
                      advisory.safetyRating >= 85 ? "text-emerald-400" :
                      advisory.safetyRating >= 60 ? "text-amber-400" : "text-rose-500"
                    )}>
                      {advisory.safetyRating}
                    </span>
                  </div>
                  {/* Glowing progress underlay */}
                  <div className={cn(
                    "absolute inset-0 rounded-full blur-md opacity-25",
                    advisory.safetyRating >= 85 ? "bg-emerald-500" :
                    advisory.safetyRating >= 60 ? "bg-amber-500" : "bg-rose-500"
                  )} />
                </div>
                <span className="text-[8px] font-extrabold text-slate-500 uppercase tracking-widest mt-1">Driving Safety</span>
              </div>
            </div>

            {/* Weather specs grid */}
            <div className="grid grid-cols-4 gap-2 py-2 border-t border-b border-outline-variant/45">
              <div className="flex flex-col items-center">
                <Thermometer className="w-3.5 h-3.5 text-slate-500 mb-1" />
                <span className="text-xs font-bold text-on-surface">{advisory.temp}°C</span>
                <span className="text-[9px] text-slate-500 uppercase font-semibold">Temp</span>
              </div>
              <div className="flex flex-col items-center border-l border-outline-variant/45">
                <Droplets className="w-3.5 h-3.5 text-slate-500 mb-1" />
                <span className="text-xs font-bold text-on-surface">{advisory.humidity}%</span>
                <span className="text-[9px] text-slate-500 uppercase font-semibold">Humidity</span>
              </div>
              <div className="flex flex-col items-center border-l border-outline-variant/45">
                <Eye className="w-3.5 h-3.5 text-slate-500 mb-1" />
                <span className="text-xs font-bold text-on-surface">{advisory.visibility}</span>
                <span className="text-[9px] text-slate-500 uppercase font-semibold">Visibility</span>
              </div>
              <div className="flex flex-col items-center border-l border-outline-variant/45">
                <Wind className="w-3.5 h-3.5 text-slate-500 mb-1" />
                <span className="text-xs font-bold text-on-surface">{advisory.windSpeed}</span>
                <span className="text-[9px] text-slate-500 uppercase font-semibold">Wind Speed</span>
              </div>
            </div>

            {/* Hazard alert banner */}
            <div className={cn(
              "p-3 rounded-xl flex gap-2 font-medium text-xs border leading-relaxed",
              advisory.alertLevel === 'critical' 
                ? "bg-rose-950/40 border-rose-500/25 text-rose-300"
                : advisory.alertLevel === 'warning'
                ? "bg-amber-950/40 border-amber-500/20 text-amber-300"
                : advisory.alertLevel === 'info'
                ? "bg-blue-950/40 border-blue-500/20 text-blue-300"
                : "bg-slate-900/40 border-slate-800 text-slate-350"
            )}>
              <AlertTriangle className={cn(
                "w-4.5 h-4.5 shrink-0 mt-0.5",
                advisory.alertLevel === 'critical' ? "text-rose-450" :
                advisory.alertLevel === 'warning' ? "text-amber-450" :
                "text-slate-400"
              )} />
              <div>
                <p className="font-extrabold uppercase tracking-wide text-[10px] opacity-90">
                  {advisory.alertLevel === 'none' ? 'General Advisory' : `${advisory.alertLevel} alert`}
                </p>
                <p className="mt-0.5 font-semibold text-on-surface">{advisory.drivingAlert}</p>
              </div>
            </div>

            {/* Mercedes-Benz Safety Assists Auto-Activated */}
            <div className="bg-primary/5 p-3 rounded-xl border border-primary/15">
              <span className="text-[9px] font-black text-primary uppercase tracking-widest mb-2 block">
                ⭐ Proactive Safety Interventions Pre-Biased
              </span>
              <ul className="space-y-1.5 ml-0.5 text-slate-300 text-[10.5px] font-semibold">
                {advisory.mbFeaturesActive.map((feat, fidx) => (
                  <li key={fidx} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-500">Wait telemetry...</div>
        )}
      </section>

      {/* Events */}
      <section className="flex flex-col gap-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs uppercase tracking-widest font-bold text-slate-400">Upcoming Events</h3>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 -mx-1 snap-x no-scrollbar">
          {events.map((event, idx) => (
            <div key={event.id} className={cn(
              "snap-start flex-shrink-0 w-64 bg-surface-container-lowest border border-outline-variant/45 rounded-2xl p-4 flex flex-col gap-3 shadow-ambient",
              idx > 0 && "opacity-60"
            )}>
              <div className="flex justify-between items-start">
                <span className={cn(
                  "px-2 py-1 rounded text-xs font-bold",
                  event.type === 'Morning' ? 'bg-emerald-500/20 text-emerald-400' :
                  event.type === 'Afternoon' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-blue-500/20 text-blue-400'
                )}>
                  {event.time}
                </span>
                <CalendarIcon className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <p className="font-semibold text-on-surface truncate text-base">{event.title}</p>
                <p className="text-xs text-slate-400 mt-1 truncate">{event.location}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Vehicle Summary */}
      <section className="pb-8">
         <div className="bg-surface-container-lowest border border-outline-variant/45 rounded-3xl p-6 flex flex-col gap-6 shadow-ambient">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Car className="w-6 h-6 text-primary" />
              <h3 className="font-bold text-lg text-slate-100">Model S-X Active</h3>
            </div>
            <div className="px-3 py-1 bg-primary/10 text-primary rounded-full flex items-center gap-1.5 border border-primary/20">
              <CircleCheck className="w-3.5 h-3.5" />
              <span className="text-xs font-bold uppercase tracking-wider">{vehicle.locked ? 'Locked' : 'Unlocked'}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/45 flex flex-col items-center gap-2">
              <Thermometer className="w-5 h-5 text-slate-400" />
              <p className="text-xl font-bold text-on-surface">{vehicle.cabinTemp}°C</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Cabin</p>
            </div>
            <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/45 flex flex-col items-center gap-2">
              <Battery className="w-5 h-5 text-amber-400" />
              <p className="text-xl font-bold text-on-surface">{vehicle.batteryLevel}%</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Charge</p>
            </div>
            <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/45 flex flex-col items-center gap-2">
              <Info className="w-5 h-5 text-slate-400" />
              <p className="text-xl font-bold text-emerald-400">{vehicle.tirePressure}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Tires</p>
            </div>
          </div>
         </div>
      </section>

    </motion.div>
  );
}
