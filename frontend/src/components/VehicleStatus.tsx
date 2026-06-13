import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gauge, Wrench, Activity, ShieldCheck, AlertTriangle, RefreshCw, Droplet, Cpu, Check, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';

interface TireState {
  fl: number; // front left
  fr: number; // front right
  rl: number; // rear left
  rr: number; // rear right
}

interface ServiceAlert {
  id: string;
  title: string;
  severity: 'warning' | 'info' | 'critical';
  details: string;
  countdown: string;
}

export default function VehicleStatus() {
  const { vehicle, addRecentAction } = useAppStore();
  
  // Real-time tire state
  const [tires, setTires] = useState<TireState>({
    fl: 31,
    fr: 34,
    rl: 32,
    rr: 35,
  });

  // Battery metrics extension (dynamic flow)
  const [charging, setCharging] = useState(false);
  const [voltage, setVoltage] = useState(382); // Volts
  const [currentBattery, setCurrentBattery] = useState(vehicle.batteryLevel);
  const [isCalibratingTires, setIsCalibratingTires] = useState(false);
  const [diagnosticState, setDiagnosticState] = useState<'idle' | 'scanning' | 'passed'>('idle');
  const [diagnosticProgress, setDiagnosticProgress] = useState(0);

  // Sync state if store updates battery level
  useEffect(() => {
    setCurrentBattery(vehicle.batteryLevel);
  }, [vehicle.batteryLevel]);

  // Charging mock interval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (charging) {
      interval = setInterval(() => {
        setCurrentBattery((prev) => {
          if (prev >= 100) {
            setCharging(false);
            return 100;
          }
          return prev + 1;
        });
        setVoltage((prev) => prev + Math.floor(Math.random() * 3) - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [charging]);

  // Calibration animation
  const handleCalibrateTires = () => {
    setIsCalibratingTires(true);
    let currentTires = { ...tires };
    
    const interval = setInterval(() => {
      let fl = Math.min(35, currentTires.fl + 1);
      let fr = Math.min(35, currentTires.fr + 1);
      let rl = Math.min(35, currentTires.rl + 1);
      let rr = Math.min(35, currentTires.rr + 1);
      
      const nextTires = { fl, fr, rl, rr };
      currentTires = nextTires;
      setTires(nextTires);

      if (fl === 35 && fr === 35 && rl === 35 && rr === 35) {
        clearInterval(interval);
        setIsCalibratingTires(false);
        addRecentAction({
          icon: 'explore',
          title: 'Tires Calibrated',
          description: 'All tires balanced to 35 PSI optimally',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }
    }, 200);
  };

  // Run full system scan mock
  const runDiagnosticScan = () => {
    setDiagnosticState('scanning');
    setDiagnosticProgress(0);
    let progress = 0;
    
    const interval = setInterval(() => {
      progress += 4;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setDiagnosticProgress(100);
        setDiagnosticState('passed');
        
        addRecentAction({
          icon: 'power_settings_new',
          title: 'Full Diagnostics Scan Passed',
          description: '0 issues found across all subsystems',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      } else {
        setDiagnosticProgress(progress);
      }
    }, 80);
  };

  // Service alerts array
  const [alerts, setAlerts] = useState<ServiceAlert[]>([
    {
      id: 'alert-1',
      title: 'Brake Fluid Inspection',
      severity: 'warning',
      details: 'Inspect and flush brake fluid reservoir',
      countdown: 'due in 1,200 mi'
    },
    {
      id: 'alert-2',
      title: 'OTA Software Update',
      severity: 'info',
      details: 'MB OS Navigation 4.2 patch is available to schedule',
      countdown: 'v4.2 Ready'
    },
    {
      id: 'alert-3',
      title: 'Cabin HEPA Filter Refresh',
      severity: 'info',
      details: 'Replace high efficiency cabin air filtration unit',
      countdown: 'due in 3,450 mi'
    }
  ]);

  const dismissAlert = (id: string, name: string) => {
    setAlerts((prev) => prev.filter(a => a.id !== id));
    addRecentAction({
      icon: 'ac_unit',
      title: 'Alert Acknowledged',
      description: `Cleared notification: ${name}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  };

  return (
    <div className="flex flex-col gap-6" id="vehicle-status-dashboard">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-bold text-white uppercase tracking-wider">Telemetry & Status</h3>
        </div>
        <button
          onClick={runDiagnosticScan}
          disabled={diagnosticState === 'scanning'}
          className={cn(
            "text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 border tracking-wider uppercase transition-colors",
            diagnosticState === 'scanning'
              ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
              : "bg-blue-500/15 border-blue-500/30 text-blue-400 hover:bg-blue-500/25"
          )}
        >
          <RefreshCw className={cn("w-3.5 h-3.5", diagnosticState === 'scanning' && "animate-spin")} />
          {diagnosticState === 'scanning' ? `SCANNING: ${diagnosticProgress}%` : "Run Diagnostic Scan"}
        </button>
      </div>

      {/* Diagnostics Alerts Overlay when passing */}
      <AnimatePresence>
        {diagnosticState !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "p-4 rounded-2xl border text-xs flex justify-between items-center transition-all",
              diagnosticState === 'scanning'
                ? "bg-amber-950/40 border-amber-500/25 text-amber-350"
                : "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
            )}
          >
            <div className="flex items-center gap-2.5">
              {diagnosticState === 'scanning' ? (
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <div>
                <p className="font-bold">
                  {diagnosticState === 'scanning' 
                    ? `Verifying powertrain, safety restraints, and sensor topology...` 
                    : `Active diagnostics scan complete. 100% check cleared.`}
                </p>
                {diagnosticState === 'scanning' && (
                  <div className="mt-1.5 w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${diagnosticProgress}%` }} />
                  </div>
                )}
              </div>
            </div>
            {diagnosticState === 'passed' && (
              <button 
                onClick={() => setDiagnosticState('idle')} 
                className="font-bold uppercase text-[10px] bg-emerald-500/20 px-2 py-1 rounded hover:bg-emerald-500/35"
              >
                Dismiss
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        
        {/* Interactive Tire Pressure Panel */}
        <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden" id="tire-pressure-widget">
          <div>
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Subsystem</span>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-emerald-400" /> Tire Pressure Matrix
                </h4>
              </div>
              <button
                disabled={isCalibratingTires}
                onClick={handleCalibrateTires}
                className={cn(
                  "text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md border tracking-wider transition-all",
                  isCalibratingTires 
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" 
                    : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
                )}
              >
                {isCalibratingTires ? "INFLATING..." : "Calibrate / Balance"}
              </button>
            </div>

            {/* Wireframe Car Layout */}
            <div className="flex items-center justify-center py-4 bg-slate-950/40 rounded-2xl border border-white/5 relative h-32 my-2">
              
              {/* Minimal Car Outline */}
              <div className="absolute w-12 h-24 border-2 border-slate-700 rounded-3xl opacity-35 flex flex-col justify-between p-2">
                <div className="h-6 w-full border-b border-slate-700" />
                <div className="h-8 w-full border-t border-slate-700" />
              </div>

              {/* Tires Matrix Map */}
              <div className="grid grid-cols-2 gap-x-20 gap-y-12 relative z-10">
                {/* FL */}
                <div className="flex flex-col items-center">
                  <div className={cn("w-4 h-7 rounded bg-slate-800 border flex items-center justify-center", tires.fl < 33 || tires.fl > 37 ? "border-amber-400 bg-amber-500/10" : "border-emerald-500/30")}>
                    <span className="text-[7px] font-bold text-slate-400">FL</span>
                  </div>
                  <span className={cn("text-xs font-extrabold mt-1", tires.fl < 33 ? "text-amber-400" : "text-white")}>{tires.fl} PSI</span>
                </div>

                {/* FR */}
                <div className="flex flex-col items-center">
                  <div className={cn("w-4 h-7 rounded bg-slate-800 border flex items-center justify-center", tires.fr < 33 || tires.fr > 37 ? "border-amber-400 bg-amber-500/10" : "border-emerald-500/30")}>
                    <span className="text-[7px] font-bold text-slate-400">FR</span>
                  </div>
                  <span className={cn("text-xs font-extrabold mt-1", tires.fr < 33 ? "text-amber-400" : "text-white")}>{tires.fr} PSI</span>
                </div>

                {/* RL */}
                <div className="flex flex-col items-center">
                  <div className={cn("w-4 h-7 rounded bg-slate-800 border flex items-center justify-center", tires.rl < 33 || tires.rl > 37 ? "border-amber-400 bg-amber-500/10" : "border-emerald-500/30")}>
                    <span className="text-[7px] font-bold text-slate-400">RL</span>
                  </div>
                  <span className={cn("text-xs font-extrabold mt-1", tires.rl < 33 ? "text-amber-400" : "text-white")}>{tires.rl} PSI</span>
                </div>

                {/* RR */}
                <div className="flex flex-col items-center">
                  <div className={cn("w-4 h-7 rounded bg-slate-800 border flex items-center justify-center", tires.rr < 33 || tires.rr > 37 ? "border-amber-400 bg-amber-500/10" : "border-emerald-500/30")}>
                    <span className="text-[7px] font-bold text-slate-400">RR</span>
                  </div>
                  <span className={cn("text-xs font-extrabold mt-1", tires.rr < 33 ? "text-amber-400" : "text-white")}>{tires.rr} PSI</span>
                </div>
              </div>

            </div>
          </div>
          
          <div className="text-[11px] text-slate-500 flex justify-between items-center px-1 mt-1 font-medium">
            <span>Target Pressure: 35 PSI</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ready
            </span>
          </div>
        </div>

        {/* Electro-Chemical Battery & Power Dashboard */}
        <div className="bg-slate-900 border border-white/5 rounded-3xl p-5 flex flex-col justify-between relative overflow-hidden" id="power-subsystem-widget">
          <div>
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Powertrain</span>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-amber-400" /> Dynamic Power Subsystem
                </h4>
              </div>
              <button
                onClick={() => setCharging(!charging)}
                className={cn(
                  "text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md border tracking-wider transition-all flex items-center gap-1",
                  charging
                    ? "bg-amber-500 text-slate-950 border-amber-400 font-bold"
                    : "bg-white/5 hover:bg-white/10 text-slate-350 border-white/10"
                )}
              >
                {charging ? "PLUGGED IN" : "PLUG CHARGER"}
              </button>
            </div>

            {/* Battery state meter with custom detailed metrics */}
            <div className="bg-slate-950/40 border border-white/5 p-4 rounded-2xl flex flex-col gap-3">
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-extrabold text-white">{currentBattery}%</span>
                <span className="text-xs text-slate-400 font-medium">Est. Range: {Math.round(currentBattery * 3.8)} mi</span>
              </div>
              
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden relative">
                {charging && (
                  <div className="absolute inset-y-0 right-0 left-0 bg-blue-500/25 animate-pulse" />
                )}
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-300", 
                    charging ? "bg-blue-400" : currentBattery > 35 ? "bg-emerald-400" : "bg-amber-500"
                  )} 
                  style={{ width: `${currentBattery}%` }} 
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-[11px] border-t border-white/5">
                <div className="flex flex-col">
                  <span className="text-slate-500 font-semibold uppercase text-[9px] tracking-wider">Bus Voltage</span>
                  <span className="font-mono text-slate-300 mt-0.5">{voltage} V</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500 font-semibold uppercase text-[9px] tracking-wider">Cell Temperature</span>
                  <span className="text-slate-300 mt-0.5 font-medium">31.4 °C</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500 font-semibold uppercase text-[9px] tracking-wider">Battery Health (SOH)</span>
                  <span className="text-emerald-400 mt-0.5 font-bold">94% Perfect</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500 font-semibold uppercase text-[9px] tracking-wider">Power Stream Flow</span>
                  <span className="text-slate-300 mt-0.5 font-medium">{charging ? "+22 kW / Recipient" : "-0.15 kW / Discharging"}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-[11px] text-slate-500 flex justify-between items-center px-1 mt-3 font-medium">
            <span>Electrolytic Solid State Cells</span>
            <span>Type: EV Standard</span>
          </div>
        </div>

      </div>

      {/* service alerts lists */}
      <div className="bg-slate-900 border border-white/5 p-5 rounded-3xl relative" id="diagnostics-alerts-widget">
        <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 mb-4">
          <Wrench className="w-4 h-4 text-amber-400" /> Upcoming Service & Diagnostics Alerts
        </h4>

        {alerts.length === 0 ? (
          <div className="bg-slate-950/50 rounded-2xl border border-white/5 p-6 flex flex-col items-center justify-center text-center gap-2">
            <ShieldCheck className="w-8 h-8 text-emerald-400/80" />
            <p className="text-xs font-bold text-slate-200">System Reports 100% Integrity</p>
            <p className="text-[11px] text-slate-500 max-w-sm">No scheduled maintenance alarms or fluid depletion states detected at present.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {alerts.map((alert) => (
              <div 
                key={alert.id}
                className="bg-slate-950/50 rounded-2xl border border-white/5 p-3.5 flex justify-between items-start gap-3 hover:border-white/10 transition-colors"
              >
                <div className="flex gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                    alert.severity === 'warning' ? "bg-amber-500/10 text-amber-400" : "bg-blue-500/10 text-blue-400"
                  )}>
                    {alert.severity === 'warning' ? <AlertCircle className="w-4.5 h-4.5" /> : <Droplet className="w-4.5 h-4.5" />}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-100">{alert.title}</h5>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{alert.details}</p>
                    <span className="inline-block mt-1.5 bg-white/5 px-2 py-0.5 rounded text-[10px] text-slate-400 font-bold border border-white/5 uppercase">
                      {alert.countdown}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => dismissAlert(alert.id, alert.title)}
                  className="text-[10px] font-bold text-slate-500 hover:text-white uppercase transition-colors shrink-0 bg-white/5 px-2.5 py-1 rounded"
                >
                  Clear Status
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
