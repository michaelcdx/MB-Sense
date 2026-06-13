import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gauge, 
  Wrench, 
  Activity, 
  Battery, 
  Check, 
  Trash2, 
  Plus, 
  AlertTriangle, 
  Play, 
  Square, 
  TrendingUp, 
  Wifi, 
  HelpCircle, 
  Info, 
  Clock, 
  Milestone,
  Thermometer,
  Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';

interface ServiceReminder {
  id: string;
  title: string;
  category: 'fluid' | 'electrical' | 'mechanical' | 'software' | 'general';
  severity: 'info' | 'warning' | 'critical';
  mileageDue: number; // e.g. 15400
  percentageHealth: number; // e.g. 78% remaining
  completed: boolean;
}

export default function TelemetryWidget() {
  const { vehicle, addRecentAction } = useAppStore();

  // Load custom service reminders from localStorage or fallback
  const [reminders, setReminders] = useState<ServiceReminder[]>(() => {
    const saved = localStorage.getItem('vanguard_service_reminders');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return [
      { id: 'rem-1', title: 'Rear Brake Pad Inspection', category: 'mechanical', severity: 'warning', mileageDue: 4500, percentageHealth: 34, completed: false },
      { id: 'rem-2', title: 'MB OS Navigation OTA Update 4.3', category: 'software', severity: 'info', mileageDue: 1200, percentageHealth: 92, completed: false },
      { id: 'rem-3', title: 'Battery Coolant Level Flush', category: 'fluid', severity: 'critical', mileageDue: 800, percentageHealth: 12, completed: false },
      { id: 'rem-4', title: 'Drive Unit Calibration', category: 'electrical', severity: 'info', mileageDue: 12000, percentageHealth: 88, completed: false }
    ];
  });

  // Save reminders to localStorage on modify
  useEffect(() => {
    localStorage.setItem('vanguard_service_reminders', JSON.stringify(reminders));
  }, [reminders]);

  // Telemetry status variables
  const [speed, setSpeed] = useState(0);
  const [motorTemp, setMotorTemp] = useState(54); // °C
  const [gForceX, setGForceX] = useState(0.0);
  const [gForceY, setGForceY] = useState(0.0);
  const [powerOutput, setPowerOutput] = useState(0); // kW
  const [batteryStateOfHealth, setBatteryStateOfHealth] = useState(96.8); // %
  const [batteryTemp, setBatteryTemp] = useState(32.5); // °C

  // Drive simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationMetric, setSimulationMetric] = useState('Standby');

  // Interactive custom reminders form
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'fluid' | 'electrical' | 'mechanical' | 'software' | 'general'>('general');
  const [newSeverity, setNewSeverity] = useState<'info' | 'warning' | 'critical'>('info');
  const [newMileage, setNewMileage] = useState('5000');
  const [newHealth, setNewHealth] = useState('100');
  const [showAddForm, setShowAddForm] = useState(false);

  // Tire pressure inputs for tweaking
  const [tireFL, setTireFL] = useState(33);
  const [tireFR, setTireFR] = useState(34);
  const [tireRL, setTireRL] = useState(32);
  const [tireRR, setTireRR] = useState(33);

  // Simulate Drive Task Loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSimulating) {
      setSimulationMetric('Active Run');
      interval = setInterval(() => {
        // Randomize speed fluctuation
        setSpeed((prev) => {
          const delta = Math.floor(Math.random() * 25) - 10;
          const nextSpeed = Math.max(0, Math.min(134, prev + delta));
          
          // Speed-related variables
          setPowerOutput(Math.round(nextSpeed * 2.2 + (Math.random() * 20 - 10)));
          setGForceX(parseFloat((Math.sin(Date.now() / 800) * (nextSpeed / 100) + (Math.random() * 0.1 - 0.05)).toFixed(2)));
          setGForceY(parseFloat((Math.cos(Date.now() / 1500) * (nextSpeed / 120) + (Math.random() * 0.1 - 0.05)).toFixed(2)));
          return nextSpeed;
        });

        // Motor/Battery heating
        setMotorTemp((prev) => {
          const thermalDelta = Math.sin(Date.now() / 15000) > 0 ? 0.3 : -0.1;
          return parseFloat(Math.min(98, Math.max(45, prev + thermalDelta)).toFixed(1));
        });

        setBatteryTemp((prev) => {
          const thermalDelta = Math.sin(Date.now() / 25000) > 0 ? 0.15 : -0.05;
          return parseFloat(Math.min(48, Math.max(28, prev + thermalDelta)).toFixed(1));
        });

        // Small tire temperature expansion raising PSI up to 36-37
        setTireFL(prev => Math.min(38, prev + (Math.random() > 0.85 ? 1 : 0)));
        setTireFR(prev => Math.min(38, prev + (Math.random() > 0.85 ? 1 : 0)));
        setTireRL(prev => Math.min(38, prev + (Math.random() > 0.85 ? 1 : 0)));
        setTireRR(prev => Math.min(38, prev + (Math.random() > 0.85 ? 1 : 0)));

      }, 800);
    } else {
      setSimulationMetric('Standby');
      // Cooldown loop
      interval = setInterval(() => {
        setSpeed(0);
        setPowerOutput(0);
        setGForceX(0);
        setGForceY(0);
        setMotorTemp(prev => parseFloat(Math.max(54, prev - 0.5).toFixed(1)));
        setBatteryTemp(prev => parseFloat(Math.max(32, prev - 0.1).toFixed(1)));
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isSimulating]);

  // Form submit handler
  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const parsedMileage = parseInt(newMileage) || 3000;
    const parsedHealth = Math.max(0, Math.min(100, parseInt(newHealth) || 100));

    const reminder: ServiceReminder = {
      id: `rem-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      severity: newSeverity,
      mileageDue: parsedMileage,
      percentageHealth: parsedHealth,
      completed: false
    };

    setReminders(prev => [reminder, ...prev]);
    setNewTitle('');
    setShowAddForm(false);

    addRecentAction({
      icon: 'power_settings_new',
      title: 'Reminder Created',
      description: `Added "${reminder.title}" to vehicle task manager`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  };

  // Toggle complete service reminder
  const handleToggleComplete = (id: string) => {
    setReminders(prev => prev.map(rem => {
      if (rem.id === id) {
        const nextState = !rem.completed;
        if (nextState) {
          addRecentAction({
            icon: 'power_settings_new',
            title: 'Service Done',
            description: `Completed: ${rem.title}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
        }
        return { ...rem, completed: nextState, percentageHealth: nextState ? 100 : rem.percentageHealth };
      }
      return rem;
    }));
  };

  // Delete reminder completely
  const handleDeleteReminder = (id: string, name: string) => {
    setReminders(prev => prev.filter(rem => rem.id !== id));
    addRecentAction({
      icon: 'power_settings_new',
      title: 'Reminder Removed',
      description: `Dismissed: ${name}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  };

  // Quick helper to categorize colors
  const getSeverityStyle = (severity: 'info' | 'warning' | 'critical', completed: boolean) => {
    if (completed) return 'border-slate-800 text-slate-500 bg-slate-900/30';
    switch (severity) {
      case 'critical':
        return 'border-rose-500/20 text-rose-400 bg-rose-500/5 hover:border-rose-500/40';
      case 'warning':
        return 'border-amber-500/20 text-amber-400 bg-amber-500/5 hover:border-amber-500/40';
      case 'info':
      default:
        return 'border-blue-500/20 text-blue-400 bg-blue-500/5 hover:border-blue-500/40';
    }
  };

  const getHealthColor = (health: number, completed: boolean) => {
    if (completed) return 'bg-slate-700';
    if (health < 25) return 'bg-rose-500';
    if (health < 60) return 'bg-amber-500';
    return 'bg-emerald-400';
  };

  return (
    <div className="flex flex-col gap-6" id="realtime-telemetry-panel">
      {/* Container Header */}
      <div className="flex flex-col gap-1.5 px-1">
        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] block">
          Telemetry & Service Cockpit
        </span>
        <div className="flex justify-between items-center flex-wrap gap-3">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Gauge className="w-5 h-5 text-blue-400 animate-pulse" /> Live Instrument Cluster
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-white/5">
              <span className={cn("w-1.5 h-1.5 rounded-full", isSimulating ? "bg-emerald-400 animate-ping" : "bg-slate-500")} />
              SIMULATOR: <span className="font-bold text-slate-205">{simulationMetric.toUpperCase()}</span>
            </span>
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={cn(
                "px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-all duration-300",
                isSimulating 
                  ? "bg-rose-500/20 border-rose-500/30 text-rose-400 hover:bg-rose-500/30" 
                  : "bg-blue-600/20 border-blue-500/30 text-blue-400 hover:bg-blue-600/30"
              )}
            >
              {isSimulating ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" /> Stop Test
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> Drive Test
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Grid: 3-column Layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        
        {/* Dynamic Telemetry Feed */}
        <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden h-full">
          {/* Subtle Corner Graphic */}
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-blue-500/10 via-transparent to-transparent pointer-events-none" />
          
          <div className="flex flex-col gap-4">
            <div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block leading-3">Section 01</span>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                <Activity className="w-4 h-4 text-blue-400" /> Propulsion Metrics
              </h4>
            </div>

            {/* Speeder Widget and Stats */}
            <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center relative py-6">
              <div className="relative text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Ground Velocity</span>
                <div className="flex items-baseline justify-center font-mono">
                  <span className="text-5xl font-black text-white tracking-tighter tabular-nums transition-all">
                    {speed}
                  </span>
                  <span className="text-slate-400 text-xs ml-1 font-bold">KMH</span>
                </div>
              </div>

              {/* Simple grid values */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 w-full mt-5 pt-4 border-t border-white/5 text-xs font-mono">
                <div className="flex flex-col">
                  <span className="text-slate-500 font-sans text-[9px] font-black uppercase">Power Delivery</span>
                  <span className="text-white font-extrabold mt-0.5 tabular-nums">
                    {powerOutput} <span className="text-[9px] text-slate-400">kW</span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500 font-sans text-[9px] font-black uppercase">Motor Temp</span>
                  <span className="text-white font-extrabold mt-0.5 tabular-nums">
                    {motorTemp}°C
                  </span>
                </div>
              </div>
            </div>

            {/* Custom Interactive G-Force Field */}
            <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-3.5 flex flex-col gap-2">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Gravitational Load (G)</span>
                <span className="text-blue-400 font-mono tracking-normal">
                  X:{gForceX.toFixed(2)} Y:{gForceY.toFixed(2)}
                </span>
              </div>
              <div className="h-20 bg-slate-950 rounded-xl border border-white/5 relative flex items-center justify-center overflow-hidden">
                {/* Crosshairs */}
                <div className="absolute inset-x-0 h-px bg-slate-800/45" />
                <div className="absolute inset-y-0 w-px bg-slate-800/45" />
                <div className="absolute w-8 h-8 rounded-full border border-slate-800/80" />
                <div className="absolute w-14 h-14 rounded-full border border-slate-800/50" />
                
                {/* Responsive dynamic dot */}
                <motion.div
                  animate={{
                    x: gForceX * 35,
                    y: gForceY * -35
                  }}
                  transition={{ type: 'spring', stiffness: 120, damping: 10 }}
                  className="w-3.5 h-3.5 rounded-full bg-blue-500 border border-white/25 shadow-glow relative z-10 flex items-center justify-center"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                </motion.div>
                
                <span className="absolute bottom-1 right-2 text-[7.5px] font-bold text-slate-600 uppercase tracking-widest font-mono">
                  G-Vector HUD
                </span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 mt-4 pt-3 border-t border-white/5 flex justify-between items-center font-medium leading-none">
            <span>CAN-Bus Interface OK</span>
            <span className="text-emerald-400">● 100 Hz Live</span>
          </div>
        </div>

        {/* Tire Pressure Diagnostics */}
        <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden h-full">
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
          
          <div className="flex flex-col gap-4">
            <div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block leading-3">Section 02</span>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                <Thermometer className="w-4 h-4 text-emerald-400" /> Tire Thermo-Matrix
              </h4>
            </div>

            {/* Wireframe display */}
            <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center relative min-h-[155px]">
              
              {/* Car Body Visual Accent */}
              <div className="absolute w-10 h-24 border border-dashed border-slate-800/80 rounded-[20px] flex flex-col justify-between py-5 px-1 bg-slate-950/10">
                <div className="h-6 w-full border-b border-slate-900" />
                <div className="h-6 w-full border-t border-slate-900" />
              </div>

              {/* 4 Tires arrangement */}
              <div className="grid grid-cols-2 gap-x-12 gap-y-10 relative z-10 w-full max-w-[190px]">
                
                {/* FL Tire */}
                <div className="flex flex-col items-start pl-1">
                  <span className="text-[8px] font-bold text-slate-500">FL</span>
                  <div className="flex items-center gap-1">
                    <div className={cn(
                      "w-3 h-5.5 rounded border my-0.5",
                      tireFL < 31 || tireFL > 36 ? "border-amber-400 bg-amber-500/15" : "border-emerald-500/30 bg-emerald-500/5"
                    )} />
                    <span className={cn("text-xs font-mono font-extrabold", tireFL < 31 ? "text-amber-400 animate-pulse" : "text-white")}>
                      {tireFL} <span className="text-[9px] text-slate-500 font-normal">psi</span>
                    </span>
                  </div>
                  <div className="flex gap-0.5 mt-1">
                    <button 
                      onClick={() => setTireFL(prev => Math.max(25, prev - 1))}
                      className="w-4 h-4 rounded bg-slate-900 border border-white/5 hover:bg-slate-800 text-[9px] text-slate-400 font-bold flex items-center justify-center transition-colors"
                    >-</button>
                    <button 
                      onClick={() => setTireFL(prev => Math.min(42, prev + 1))}
                      className="w-4 h-4 rounded bg-slate-900 border border-white/5 hover:bg-slate-800 text-[9px] text-slate-400 font-bold flex items-center justify-center transition-colors"
                    >+</button>
                  </div>
                </div>

                {/* FR Tire */}
                <div className="flex flex-col items-end pr-1">
                  <span className="text-[8px] font-bold text-slate-500">FR</span>
                  <div className="flex items-center gap-1">
                    <span className={cn("text-xs font-mono font-extrabold", tireFR < 31 ? "text-amber-400 animate-pulse" : "text-white")}>
                      {tireFR} <span className="text-[9px] text-slate-500 font-normal">psi</span>
                    </span>
                    <div className={cn(
                      "w-3 h-5.5 rounded border my-0.5",
                      tireFR < 31 || tireFR > 36 ? "border-amber-400 bg-amber-500/15" : "border-emerald-500/30 bg-emerald-500/5"
                    )} />
                  </div>
                  <div className="flex gap-0.5 mt-1">
                    <button 
                      onClick={() => setTireFR(prev => Math.max(25, prev - 1))}
                      className="w-4 h-4 rounded bg-slate-900 border border-white/5 hover:bg-slate-800 text-[9px] text-slate-400 font-bold flex items-center justify-center transition-colors"
                    >-</button>
                    <button 
                      onClick={() => setTireFR(prev => Math.min(42, prev + 1))}
                      className="w-4 h-4 rounded bg-slate-900 border border-white/5 hover:bg-slate-800 text-[9px] text-slate-400 font-bold flex items-center justify-center transition-colors"
                    >+</button>
                  </div>
                </div>

                {/* RL Tire */}
                <div className="flex flex-col items-start pl-1">
                  <span className="text-[8px] font-bold text-slate-500">RL</span>
                  <div className="flex items-center gap-1">
                    <div className={cn(
                      "w-3 h-5.5 rounded border my-0.5",
                      tireRL < 31 || tireRL > 36 ? "border-amber-400 bg-amber-500/15" : "border-emerald-500/30 bg-emerald-500/5"
                    )} />
                    <span className={cn("text-xs font-mono font-extrabold", tireRL < 31 ? "text-amber-400 animate-pulse" : "text-white")}>
                      {tireRL} <span className="text-[9px] text-slate-500 font-normal">psi</span>
                    </span>
                  </div>
                  <div className="flex gap-0.5 mt-1">
                    <button 
                      onClick={() => setTireRL(prev => Math.max(25, prev - 1))}
                      className="w-4 h-4 rounded bg-slate-900 border border-white/5 hover:bg-slate-800 text-[9px] text-slate-400 font-bold flex items-center justify-center transition-colors"
                    >-</button>
                    <button 
                      onClick={() => setTireRL(prev => Math.min(42, prev + 1))}
                      className="w-4 h-4 rounded bg-slate-900 border border-white/5 hover:bg-slate-800 text-[9px] text-slate-400 font-bold flex items-center justify-center transition-colors"
                    >+</button>
                  </div>
                </div>

                {/* RR Tire */}
                <div className="flex flex-col items-end pr-1">
                  <span className="text-[8px] font-bold text-slate-500">RR</span>
                  <div className="flex items-center gap-1">
                    <span className={cn("text-xs font-mono font-extrabold", tireRR < 31 ? "text-amber-400 animate-pulse" : "text-white")}>
                      {tireRR} <span className="text-[9px] text-slate-500 font-normal">psi</span>
                    </span>
                    <div className={cn(
                      "w-3 h-5.5 rounded border my-0.5",
                      tireRR < 31 || tireRR > 36 ? "border-amber-400 bg-amber-500/15" : "border-emerald-500/30 bg-emerald-500/5"
                    )} />
                  </div>
                  <div className="flex gap-0.5 mt-1">
                    <button 
                      onClick={() => setTireRR(prev => Math.max(25, prev - 1))}
                      className="w-4 h-4 rounded bg-slate-900 border border-white/5 hover:bg-slate-800 text-[9px] text-slate-400 font-bold flex items-center justify-center transition-colors"
                    >-</button>
                    <button 
                      onClick={() => setTireRR(prev => Math.min(42, prev + 1))}
                      className="w-4 h-4 rounded bg-slate-900 border border-white/5 hover:bg-slate-800 text-[9px] text-slate-400 font-bold flex items-center justify-center transition-colors"
                    >+</button>
                  </div>
                </div>

              </div>
            </div>

            {/* Tire inflation alert warnings */}
            <div className="bg-slate-950/40 border border-white/5 p-3 rounded-2xl flex flex-col gap-1.5 text-xs">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[8.5px]">Tire Thermal Appraisal</span>
              <div className="flex justify-between items-center text-[11px] text-slate-450 leading-tight">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> All inflation states normal
                </span>
                <span className="text-slate-500 font-mono">Cold target: 33 psi</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 mt-4 pt-3 border-t border-white/5 flex justify-between items-center font-medium leading-none">
            <span>Dunlop Sport Maxx Active</span>
            <span className="text-emerald-400">Target Balanced</span>
          </div>
        </div>

        {/* Battery Health Analysis */}
        <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden h-full">
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-amber-500/10 via-transparent to-transparent pointer-events-none" />
          
          <div className="flex flex-col gap-4">
            <div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block leading-3">Section 03</span>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                <Zap className="w-4 h-4 text-amber-400" /> Battery Health & Diagnostics
              </h4>
            </div>

            {/* Custom SOH and chemistry view */}
            <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-3.5">
              <div className="flex justify-between items-baseline">
                <div className="flex flex-col">
                  <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest leading-none">Electro-Chemical Health</span>
                  <span className="text-2xl font-black text-white mt-1 tabular-nums">
                    {batteryStateOfHealth}% <span className="text-xs text-emerald-400 font-bold ml-1">SOH</span>
                  </span>
                </div>
                <span className="text-slate-400 text-[10px] font-bold bg-white/5 px-2 py-0.5 rounded-md border border-white/5 uppercase">
                  Li-NMC Cell
                </span>
              </div>

              {/* Multi-layered health meter */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-medium text-slate-400">
                  <span>Anode/Cathode Degradation</span>
                  <span className="text-slate-300 font-bold text-[9px] font-mono">3.2% loss</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: '96.8%' }} />
                </div>
              </div>

              {/* Details table */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 border-t border-white/5 text-[10.5px] font-mono">
                <div className="flex flex-col">
                  <span className="text-slate-500 font-sans text-[8.5px] font-black uppercase">Bus Voltage</span>
                  <span className="text-slate-300 font-extrabold mt-0.5">
                    {isSimulating ? `${Math.round(394 + Math.random() * 4)} V` : '396.4 V'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500 font-sans text-[8.5px] font-black uppercase">Core Temperature</span>
                  <span className="text-slate-300 font-extrabold mt-0.5">
                    {batteryTemp}°C
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500 font-sans text-[8.5px] font-black uppercase">Self-Discharge Rate</span>
                  <span className="text-slate-300 font-extrabold mt-0.5">0.05% / day</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500 font-sans text-[8.5px] font-black uppercase">Active Cycles</span>
                  <span className="text-slate-350 font-extrabold mt-0.5">142 Cycles</span>
                </div>
              </div>
            </div>

            {/* Quick SOH verification action */}
            <button
              onClick={() => {
                setBatteryStateOfHealth(96.8);
                addRecentAction({
                  icon: 'power_settings_new',
                  title: 'Cell Health Calibrated',
                  description: 'All 8,400 cells audited individually • Result 96.8% perfect SOH',
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
              }}
              className="w-full bg-slate-905 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/5 hover:border-amber-500/20 rounded-xl py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              Re-Audit Chemistry SOH
            </button>
          </div>

          <div className="text-[10px] text-slate-500 mt-4 pt-3 border-t border-white/5 flex justify-between items-center font-medium leading-none">
            <span>Active balancing BMS</span>
            <span className="text-amber-400">96.8% Perfect</span>
          </div>
        </div>

      </div>

      {/* service reminders list with CRUD */}
      <div className="bg-slate-900 border border-white/5 p-5 rounded-3xl" id="service-reminders-subwidget">
        
        {/* Header inside status panel */}
        <div className="flex flex-col items-start justify-between gap-3 mb-4 border-b border-white/5 pb-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Wrench className="w-4.5 h-4.5 text-amber-400" />
            <div>
              <h4 className="text-base font-bold text-slate-100">Scheduled Service task Manager</h4>
              <p className="text-xs text-slate-500">Add or manage required vehicle services, mileage milestones, and health reminders</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 border border-white/5 hover:border-amber-500/30 text-white text-xs font-semibold flex items-center gap-1.5 self-start sm:self-center transition-all"
          >
            {showAddForm ? 'Cancel Form' : (
              <>
                <Plus className="w-3.5 h-3.5 text-amber-400" /> Create Custom Reminder
              </>
            )}
          </button>
        </div>

        {/* Custom form for adding reminders */}
        <AnimatePresence>
          {showAddForm && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleAddReminder}
              className="bg-slate-950/60 border border-white/5 p-4 rounded-2xl mb-4 overflow-hidden flex flex-col gap-3 font-sans"
            >
              <div className="grid grid-cols-1 gap-3 text-xs text-slate-100 sm:grid-cols-2 lg:grid-cols-4">
                
                {/* Title */}
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-[10px] text-slate-450 font-bold uppercase pl-1">Reminder Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Brake Caliper Balance Check"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Category */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-455 font-bold uppercase pl-1">Component Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  >
                    <option value="fluid">💧 Fluid / Cooling</option>
                    <option value="electrical">⚡ Electrical Systems</option>
                    <option value="mechanical">⚙️ Mechanical Parts</option>
                    <option value="software">💾 Software OTA</option>
                    <option value="general">🛠️ General Maintenance</option>
                  </select>
                </div>

                {/* Severity */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-455 font-bold uppercase pl-1">Security Severity</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as any)}
                    className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  >
                    <option value="info">🔵 Information (Normal)</option>
                    <option value="warning">🟡 warning alert</option>
                    <option value="critical">🔴 critical hazard</option>
                  </select>
                </div>

                {/* Mileage Count */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-455 font-bold uppercase pl-1">Target Mileage (mi)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="3000"
                    value={newMileage}
                    onChange={(e) => setNewMileage(e.target.value)}
                    className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Current Health */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-455 font-bold uppercase pl-1">Initial health SOH (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="100"
                    value={newHealth}
                    onChange={(e) => setNewHealth(e.target.value)}
                    className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Submit button */}
                <div className="flex items-end col-span-2">
                  <button
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-450 text-slate-950 font-extrabold uppercase rounded-xl tracking-wider py-2 transition-all mt-1"
                  >
                    Insert scheduled task reminder
                  </button>
                </div>

              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Reminders List rendering */}
        {reminders.length === 0 ? (
          <div className="bg-slate-950/40 rounded-2xl border border-white/5 p-6 flex flex-col items-center justify-center text-center gap-2">
            <Check className="w-8 h-8 text-emerald-400" />
            <p className="text-sm font-bold text-white">No pending system reminders or alerts</p>
            <p className="text-xs text-slate-500">Perfect! Create a custom reminder or task to populate cockpit timeline metrics.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {reminders.map((rem) => (
              <div 
                key={rem.id}
                className={cn(
                  "border rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 relative overflow-hidden",
                  getSeverityStyle(rem.severity, rem.completed)
                )}
              >
                {/* Complete / Uncomplete background bar indicator status */}
                {rem.completed && (
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                )}

                <div className="flex justify-between items-start gap-2.5">
                  <div className="flex items-start gap-2.5">
                    {/* Checkbox button */}
                    <button
                      onClick={() => handleToggleComplete(rem.id)}
                      className={cn(
                        "w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 mt-0.5",
                        rem.completed 
                          ? "bg-emerald-500 border-emerald-450 text-slate-950" 
                          : "border-slate-750 hover:border-slate-650 hover:bg-white/5"
                      )}
                    >
                      {rem.completed && <Check className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />}
                    </button>

                    <div>
                      <h5 className={cn(
                        "text-xs font-bold leading-snug",
                        rem.completed ? "text-slate-500 line-through" : "text-slate-100"
                      )}>{rem.title}</h5>

                      {/* Info description labels */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-white/5 text-slate-400 uppercase">
                          {rem.category.toUpperCase()}
                        </span>
                        
                        {!rem.completed && rem.severity === 'critical' && (
                          <span className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 uppercase flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" /> High Hazard
                          </span>
                        )}

                        <span className="text-[8.5px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-white/5">
                          {rem.completed ? 'Service Met' : `due in ~${rem.mileageDue} mi`}
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteReminder(rem.id, rem.title)}
                    className="text-slate-500 hover:text-rose-400 p-1.5 bg-slate-900/40 border border-white/5 hover:border-rose-500/20 rounded-lg transition-all"
                    title="Dismiss reminder"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Subsystem Health Progress status bar */}
                <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10.5px]">
                    <span className="text-slate-500 font-medium">Estimated remaining life:</span>
                    <span className={cn(
                      "font-bold font-mono",
                      rem.completed ? "text-emerald-400" : rem.percentageHealth < 25 ? "text-rose-400" : rem.percentageHealth < 60 ? "text-amber-400" : "text-emerald-400"
                    )}>
                      {rem.completed ? '100% (RENEWED)' : `${rem.percentageHealth}%`}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all duration-300", getHealthColor(rem.percentageHealth, rem.completed))} 
                      style={{ width: rem.completed ? '100%' : `${rem.percentageHealth}%` }}
                    />
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>

    </div>
  );
}
