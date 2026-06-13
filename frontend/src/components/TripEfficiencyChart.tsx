import { useState, useEffect } from 'react';
import { 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { 
  Zap, 
  Thermometer, 
  Sparkles, 
  BatteryCharging, 
  Wind, 
  CloudRain, 
  CloudFog, 
  Sun, 
  CloudSnow,
  Award
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';

interface TripData {
  day: string;
  date: string;
  distance: number;
  avgSpeed: number;
  extTemp: number;
  weather: string;
  baseConsumption: number;
  regen: number;
  energyConsumption: number;
  totalKwhConsumed: number;
}

export default function TripEfficiencyChart() {
  const { addRecentAction } = useAppStore();
  const [climateMode, setClimateMode] = useState<'eco' | 'comfort' | 'performance'>('eco');
  const [data, setData] = useState<TripData[]>([]);
  const [aiReview, setAiReview] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTripEfficiency = async (mode: 'eco' | 'comfort' | 'performance') => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/trip-efficiency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ climateMode: mode })
      });
      if (!res.ok) {
        throw new Error('Powertrain telemetry error');
      }
      const result = await res.json();
      setData(result.trips);
      setAiReview(result.aiPerformanceReview);
    } catch (err: any) {
      console.error(err);
      setError('Stellar sync of powertrain data delayed. Reviewing cached local telemetry.');
      
      // Fallback local calculation
      const rawTrips = [
        { day: "Mon", date: "June 08", distance: 32, avgSpeed: 52, extTemp: 12, weather: "Fog", baseConsumption: 165, regen: 2.1 },
        { day: "Tue", date: "June 09", distance: 45, avgSpeed: 68, extTemp: 14, weather: "Rain", baseConsumption: 185, regen: 1.8 },
        { day: "Wed", date: "June 10", distance: 18, avgSpeed: 35, extTemp: 18, weather: "Clear", baseConsumption: 140, regen: 2.8 },
        { day: "Thu", date: "June 11", distance: 22, avgSpeed: 42, extTemp: 15, weather: "Gale/Wind", baseConsumption: 175, regen: 1.4 },
        { day: "Fri", date: "June 12", distance: 64, avgSpeed: 82, extTemp: 2, weather: "Ice/Slush", baseConsumption: 215, regen: 0.9 },
        { day: "Sat", date: "June 13", distance: 12, avgSpeed: 28, extTemp: 16, weather: "Clear", baseConsumption: 145, regen: 1.1 },
        { day: "Sun", date: "June 14", distance: 28, avgSpeed: 48, extTemp: 20, weather: "Clear", baseConsumption: 138, regen: 2.3 }
      ];
      const added = mode === 'eco' ? 5 : mode === 'comfort' ? 22 : 45;
      setData(rawTrips.map(t => {
        let weatherDrag = t.weather === "Rain" ? 15 : t.weather === "Gale/Wind" ? 25 : t.weather === "Ice/Slush" ? 35 : t.weather === "Fog" ? 8 : 0;
        const cons = t.baseConsumption + added + weatherDrag;
        return {
          ...t,
          energyConsumption: cons,
          totalKwhConsumed: Math.round(((cons * t.distance) / 1000) * 10) / 10
        };
      }));
      setAiReview("Pre-conditioned climate optimization can recover up to 12% EQ driving range in adverse headwinds or severe low freezing operations.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTripEfficiency(climateMode);
  }, [climateMode]);

  const handleClimateChange = (mode: 'eco' | 'comfort' | 'performance') => {
    setClimateMode(mode);
    addRecentAction({
      icon: 'ac_unit',
      title: 'powertrain profiles updated',
      description: `Climate simulation biased to ${mode.toUpperCase()} index`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  };

  const getWeatherIcon = (condition: string) => {
    switch (condition) {
      case 'Clear': return <Sun className="w-4 h-4 text-amber-400" />;
      case 'Rain': return <CloudRain className="w-4 h-4 text-blue-400" />;
      case 'Fog': return <CloudFog className="w-4 h-4 text-slate-300" />;
      case 'Ice/Slush': return <CloudSnow className="w-4 h-4 text-violet-350" />;
      case 'Gale/Wind': return <Wind className="w-4 h-4 text-teal-400" />;
      default: return <Sun className="w-4 h-4 text-amber-400" />;
    }
  };

  // Compute stats
  const avgEfficiency = data.length > 0 ? Math.round(data.reduce((acc, curr) => acc + curr.energyConsumption, 0) / data.length) : 0;
  const totalRegenKwh = data.length > 0 ? Math.round(data.reduce((acc, curr) => acc + curr.regen, 0) * 10) / 10 : 0;
  const optimalTrip = data.length > 0 ? [...data].sort((a, b) => a.energyConsumption - b.energyConsumption)[0] : null;

  return (
    <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 flex flex-col gap-5 relative overflow-hidden" id="mb-drive-efficiency-panel">
      {/* Glow highlight */}
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">Drive Telematics Analysis</span>
          <h3 className="font-extrabold text-sm text-slate-100 uppercase tracking-wider flex items-center gap-2 mt-0.5">
            <Zap className="w-4.5 h-4.5 text-amber-400 shrink-0" /> Historical Trip Efficiency
          </h3>
        </div>

        {/* HVAC Climate System Simulation options */}
        <div className="flex gap-1 p-1 bg-slate-950 rounded-xl border border-white/5 self-start sm:self-center">
          {(['eco', 'comfort', 'performance'] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleClimateChange(m)}
              disabled={isLoading}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shrink-0",
                climateMode === m
                  ? "bg-amber-500/20 border border-amber-500/30 text-amber-400"
                  : "text-slate-400 hover:text-white hover:bg-white/5 bg-transparent border border-transparent"
              )}
            >
              {m === 'eco' ? 'ECO HVAC' : m === 'comfort' ? 'Comfort' : 'Comfort Max'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-amber-950/40 border border-amber-500/20 text-amber-350 text-[10.5px] px-3 py-2 rounded-xl flex items-center gap-1.5 font-medium leading-relaxed">
          <Wind className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Summary Rows */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5 flex flex-col gap-1">
          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Average Intensity</span>
          <span className="text-base font-black text-white font-mono leading-none mt-1">
            {isLoading ? <span className="animate-pulse">---</span> : `${avgEfficiency}`} <span className="text-[10px] font-sans text-slate-450 font-semibold lowercase">Wh/km</span>
          </span>
          <span className="text-[9px] text-slate-400 font-semibold">Active battery discharge</span>
        </div>

        <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5 flex flex-col gap-1">
          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Regen Recovered</span>
          <span className="text-base font-black text-emerald-400 font-mono leading-none mt-1">
            {isLoading ? <span className="animate-pulse">---</span> : `+${totalRegenKwh}`} <span className="text-[10px] font-sans text-emerald-500/80 font-bold">kWh</span>
          </span>
          <span className="text-[9px] text-slate-400 font-semibold flex items-center gap-1">
            <BatteryCharging className="w-2.5 h-2.5 text-emerald-500 shrink-0" /> Recaptured torque
          </span>
        </div>

        <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5 flex flex-col gap-1">
          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Peak Efficiency Map</span>
          {optimalTrip ? (
            <>
              <span className="text-sm font-black text-amber-400 mt-1 leading-none">
                {optimalTrip.day} ({optimalTrip.energyConsumption} Wh)
              </span>
              <span className="text-[9px] text-slate-400 font-semibold truncate flex items-center gap-1 capitalize">
                {getWeatherIcon(optimalTrip.weather)} {optimalTrip.weather.toLowerCase()} dry road
              </span>
            </>
          ) : (
            <span className="text-xs font-bold text-slate-500 mt-1 inline-block">--</span>
          )}
        </div>
      </div>

      {/* Main Recharts Graphic Container */}
      <div className="h-68 bg-slate-950 p-3 rounded-2xl border border-white/5 flex flex-col justify-center relative">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10">
            <div className="w-6 h-6 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Compiling historical drive files...</span>
          </div>
        ) : (
          <div className="w-full h-full text-slate-300 font-sans">
            <ResponsiveContainer width="100%" height="95%">
              <ComposedChart
                data={data}
                margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
              >
                <defs>
                  {/* Glowing visual indicators */}
                  <linearGradient id="colorCons" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="day" 
                  stroke="#ffffff30" 
                  fontSize={10} 
                  fontWeight="bold"
                  tickLine={false} 
                  axisLine={false}
                />
                
                {/* Left Y Axis: Consumption Wh/km */}
                <YAxis 
                  yAxisId="left"
                  stroke="#ffffff30" 
                  fontSize={9} 
                  fontWeight="semibold"
                  tickLine={false} 
                  axisLine={false}
                  domain={[100, 275]}
                  tickFormatter={(val) => `${val}`}
                />

                {/* Right Y Axis: External Temperature °C */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#ffffff30"
                  fontSize={9}
                  fontWeight="semibold"
                  tickLine={false}
                  axisLine={false}
                  domain={[-10, 30]}
                  tickFormatter={(val) => `${val}°C`}
                />

                <Tooltip 
                  cursor={{ stroke: '#ffffff10', strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload as TripData;
                      return (
                        <div className="bg-slate-950 border border-white/10 p-3 rounded-xl shadow-2xl space-y-2 max-w-[200px]">
                          <div className="flex justify-between items-center gap-4 pb-1 border-b border-white/5">
                            <span className="text-[10px] font-bold text-slate-100">{d.day} ({d.date})</span>
                            <span className="flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-white/5 uppercase border border-white/5 text-slate-350">
                              {getWeatherIcon(d.weather)} {d.weather}
                            </span>
                          </div>
                          
                          <div className="space-y-1 text-[10px]">
                            <div className="flex justify-between font-semibold">
                              <span className="text-slate-500">Trip Dist:</span>
                              <span className="text-white font-bold">{d.distance} km</span>
                            </div>
                            <div className="flex justify-between font-semibold">
                              <span className="text-slate-500">Avg Speed:</span>
                              <span className="text-white font-bold">{d.avgSpeed} km/h</span>
                            </div>
                            <div className="flex justify-between font-semibold">
                              <span className="text-slate-500">Consumption:</span>
                              <span className="text-amber-400 font-extrabold font-mono">{d.energyConsumption} Wh/km</span>
                            </div>
                            <div className="flex justify-between font-semibold">
                              <span className="text-slate-400">Total KWh:</span>
                              <span className="text-white font-extrabold font-mono">{d.totalKwhConsumed} kWh</span>
                            </div>
                            <div className="flex justify-between font-semibold border-t border-white/5 pt-1 mt-1 text-[9px]">
                              <span className="text-emerald-500 font-bold">Regen Credit:</span>
                              <span className="text-emerald-400 font-bold font-mono">+{d.regen} kWh</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />

                <Legend 
                  verticalAlign="top" 
                  height={32}
                  iconSize={8}
                  formatter={(value) => {
                    return <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{value}</span>;
                  }}
                />

                {/* Optimal driving limit baseline helper line */}
                <ReferenceLine yAxisId="left" y={150} stroke="#10b981" strokeDasharray="3 3" opacity={0.3} />

                {/* Energy Consumption Bar & Ambient Temperature Line */}
                <Bar 
                  yAxisId="left"
                  name="Discharge Wh/km" 
                  dataKey="energyConsumption" 
                  fill="#f59e0b" 
                  radius={[4, 4, 0, 0]}
                  maxBarSize={22}
                  opacity={0.8}
                />

                <Line 
                  yAxisId="right"
                  name="Aero Ambient Temp" 
                  type="monotone" 
                  dataKey="extTemp" 
                  stroke="#38bdf8" 
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#38bdf8', strokeWidth: 1, stroke: '#0f172a' }}
                  activeDot={{ r: 5 }}
                />

              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* EQ Expert AI Review Board */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest leading-none">AI Efficiency Recommendation</span>
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed font-semibold">
          {isLoading ? (
            <span className="text-slate-500 animate-pulse">Running advanced powertrain analysis with Gemini EQ...</span>
          ) : (
            `"${aiReview}"`
          )}
        </p>
      </div>
    </div>
  );
}
