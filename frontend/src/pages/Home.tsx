import { motion } from 'motion/react';
import { useAppStore } from '../store/useAppStore';
import { 
  Search, Mic, Navigation, MoreHorizontal, Calendar as CalendarIcon, 
  Thermometer, Battery, CircleCheck, Info, Car,
  CloudRain, CloudFog, CloudSnow, Sun, Wind, Droplets, Eye, ShieldAlert, AlertTriangle, MapPin
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import Markdown from 'react-markdown';

export default function Home() {
  const { user, weather, vehicle, events, addRecentAction } = useAppStore();
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

  const upcomingEvent = events.length > 0 ? events[0] : null;

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
        <div className="flex items-center gap-3 bg-slate-900 border border-white/5 px-4 py-2 rounded-xl">
          <div className="text-right">
            <p className="text-xs text-slate-300 font-medium">Palo Alto</p>
            <p className="text-lg font-semibold text-blue-400">{weather.temp}°C</p>
          </div>
        </div>
      </section>

      {/* Search Bar */}
      <section>
        <div className="bg-slate-900 border border-white/5 rounded-2xl flex items-center px-4 py-3 gap-3 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
          <Search className="w-5 h-5 text-blue-400" />
          <input 
            type="text" 
            placeholder="Where to?" 
            className="bg-transparent border-none flex-1 focus:ring-0 text-white placeholder:text-slate-500" 
          />
          <Mic className="w-5 h-5 text-slate-400" />
        </div>
      </section>

      {/* Suggested Destination Card */}
      <section>
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-slate-900 border border-white/10 rounded-3xl p-6">
          <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          <div className="relative z-10">
            <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-widest mb-4">
              Suggested Now
            </span>
            <h2 className="text-3xl font-bold text-white mb-2">Work</h2>
            <p className="text-sm text-white/80 flex items-center gap-2 font-medium">
              <Info className="w-4 h-4" />
              15 min commute • Normal traffic
            </p>
          </div>
          <div className="mt-8 flex gap-3 relative z-10">
            <Link to="/map" className="flex-1 bg-white hover:bg-slate-200 text-slate-950 py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
              <Navigation className="w-4 h-4" />
              Start Navigation
            </Link>
            <button className="w-14 h-14 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center transition-colors">
              <MoreHorizontal className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </section>

      {/* Geolocation Weather & Driving Safety Center Widget */}
      <section className="bg-slate-900 border border-white/5 rounded-3xl p-5 flex flex-col gap-4 relative overflow-hidden">
        {/* Decorative Top Accent Glow */}
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
        
        {/* Title and Geolocation Trigger */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-sky-400" />
            <h3 className="font-extrabold text-sm text-slate-200 uppercase tracking-wider">Drive Conditions Watch</h3>
          </div>
          
          <button
            onClick={handleGetLocation}
            disabled={isLocating || isLoadingAdvisory}
            className={cn(
              "px-3 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all",
              isLocating 
                ? "bg-slate-800 border-white/5 text-slate-400 cursor-not-allowed" 
                : "bg-white/5 hover:bg-white/10 active:scale-98 border-white/10 text-white hover:border-white/20"
            )}
          >
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
            {isLocating ? "Syncing GPS..." : "Detect Location"}
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
          <div className="grid grid-cols-5 gap-1 p-1 bg-slate-950 rounded-xl border border-white/5">
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
                    ? "bg-blue-600/25 border border-blue-500/40 text-blue-300" 
                    : "text-slate-400 hover:text-white bg-transparent border border-transparent"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Advisory main content panel */}
        {isLoadingAdvisory ? (
          <div className="h-44 bg-slate-950/50 rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
            <p className="text-xs text-slate-400 font-bold tracking-widest uppercase">Querying Weather Telemetry...</p>
          </div>
        ) : advisory ? (
          <div className="flex flex-col gap-3.5 bg-slate-950 p-4 rounded-2xl border border-white/5">
            {/* Bottom row: Condition overview & Dial score */}
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-xl border border-white/5">
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
                  <div className="w-14 h-14 rounded-full border-4 border-white/5 flex items-center justify-center">
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
            <div className="grid grid-cols-4 gap-2 py-2 border-t border-b border-white/5">
              <div className="flex flex-col items-center">
                <Thermometer className="w-3.5 h-3.5 text-slate-500 mb-1" />
                <span className="text-xs font-bold text-white">{advisory.temp}°C</span>
                <span className="text-[9px] text-slate-500 uppercase font-semibold">Temp</span>
              </div>
              <div className="flex flex-col items-center border-l border-white/5">
                <Droplets className="w-3.5 h-3.5 text-slate-500 mb-1" />
                <span className="text-xs font-bold text-white">{advisory.humidity}%</span>
                <span className="text-[9px] text-slate-500 uppercase font-semibold">Humidity</span>
              </div>
              <div className="flex flex-col items-center border-l border-white/5">
                <Eye className="w-3.5 h-3.5 text-slate-500 mb-1" />
                <span className="text-xs font-bold text-white">{advisory.visibility}</span>
                <span className="text-[9px] text-slate-500 uppercase font-semibold">Visibility</span>
              </div>
              <div className="flex flex-col items-center border-l border-white/5">
                <Wind className="w-3.5 h-3.5 text-slate-500 mb-1" />
                <span className="text-xs font-bold text-white">{advisory.windSpeed}</span>
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
                <p className="mt-0.5 font-semibold text-slate-200">{advisory.drivingAlert}</p>
              </div>
            </div>

            {/* Mercedes-Benz Safety Assists Auto-Activated */}
            <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5">
              <span className="text-[9px] font-black text-sky-400 uppercase tracking-widest mb-2 block">
                ⭐ Proactive Safety Interventions Pre-Biased
              </span>
              <ul className="space-y-1.5 ml-0.5 text-slate-300 text-[10.5px] font-semibold">
                {advisory.mbFeaturesActive.map((feat, fidx) => (
                  <li key={fidx} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
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
              "snap-start flex-shrink-0 w-64 bg-slate-900 border border-white/5 rounded-2xl p-4 flex flex-col gap-3",
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
                <p className="font-semibold text-white truncate text-base">{event.title}</p>
                <p className="text-xs text-slate-400 mt-1 truncate">{event.location}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Vehicle Summary */}
      <section className="pb-8">
         <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Car className="w-6 h-6 text-blue-400" />
              <h3 className="font-bold text-lg text-slate-100">Model S-X Active</h3>
            </div>
            <div className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full flex items-center gap-1.5 border border-blue-500/20">
              <CircleCheck className="w-3.5 h-3.5" />
              <span className="text-xs font-bold uppercase tracking-wider">{vehicle.locked ? 'Locked' : 'Unlocked'}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 flex flex-col items-center gap-2">
              <Thermometer className="w-5 h-5 text-slate-400" />
              <p className="text-xl font-bold text-white">{vehicle.cabinTemp}°C</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Cabin</p>
            </div>
            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 flex flex-col items-center gap-2">
              <Battery className="w-5 h-5 text-amber-400" />
              <p className="text-xl font-bold text-white">{vehicle.batteryLevel}%</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Charge</p>
            </div>
            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 flex flex-col items-center gap-2">
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
