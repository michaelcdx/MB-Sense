import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lightbulb, Sliders, Power, Layers, Sparkles, Check, RefreshCw, 
  Tv, Compass, Palette, Sun, Heart, Flame
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';

interface ColorMapping {
  primary: string;
  secondary: string;
  name: string;
}

interface DrivingModeTheme {
  sport: ColorMapping;
  eco: ColorMapping;
  relax: ColorMapping;
  custom: ColorMapping;
}

export default function AmbientLightingSettings() {
  const { addRecentAction } = useAppStore();

  // Primary states
  const [ambientEnabled, setAmbientEnabled] = useState(true);
  const [activeMode, setActiveMode] = useState<'sport' | 'eco' | 'relax' | 'custom'>('relax');
  const [autoDriveSync, setAutoDriveSync] = useState(true);
  const [brightness, setBrightness] = useState(75);
  const [multiZoneEnabled, setMultiZoneEnabled] = useState(true);
  
  // Custom states for each driving mode color linkage
  const [modeThemes, setModeThemes] = useState<DrivingModeTheme>({
    sport: { primary: '#f43f5e', secondary: '#f97316', name: 'AMG Redline' },   // Red to Orange
    eco: { primary: '#10b981', secondary: '#06b6d4', name: 'Solar Mint' },     // Green to Cyan
    relax: { primary: '#8b5cf6', secondary: '#3b82f6', name: 'Miami Lavender' }, // Purple to Blue
    custom: { primary: '#ec4899', secondary: '#eab308', name: 'Infrared Sunrise' }, // Pink to Gold
  });

  // Hot zones selection state
  const [zones, setZones] = useState({
    dashboard: true,
    doorTrims: true,
    footwells: true,
    centerConsole: false,
  });

  // API advice states
  const [aiAdvisory, setAiAdvisory] = useState('');
  const [advisoryLoading, setAdvisoryLoading] = useState(false);

  // Curated premium preset colors
  const presetColors = [
    { hex: '#f43f5e', label: 'Crimson' },
    { hex: '#f97316', label: 'Orange' },
    { hex: '#eab308', label: 'Gold' },
    { hex: '#10b981', label: 'Emerald' },
    { hex: '#06b6d4', label: 'Cyan' },
    { hex: '#3b82f6', label: 'Cobalt' },
    { hex: '#8b5cf6', label: 'Amethyst' },
    { hex: '#ec4899', label: 'Magenta' },
  ];

  // Retrieve current active color mapping
  const currentTheme = modeThemes[activeMode];

  // Fetch AI dynamics recommendation
  const fetchAdvisory = async (
    mode: string, 
    pri: string, 
    sec: string, 
    bright: number, 
    multizone: boolean
  ) => {
    setAdvisoryLoading(true);
    try {
      const res = await fetch('/api/ambient-lighting-advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drivingMode: mode,
          primaryColor: pri,
          secondaryColor: sec,
          brightness: bright,
          multiZoneEnabled: multizone,
        }),
      });

      if (!res.ok) throw new Error('API down');
      const data = await res.json();
      setAiAdvisory(data.aiCoachingTip);
    } catch (e) {
      // Fallback response inside client if API fails
      let msg = "";
      if (mode === 'sport') {
        msg = "High-contrast dynamic red emissions stimulate neural optical response times on technical pathways. Restrict dash luminosity below 50% at night to prevent windshield refraction.";
      } else if (mode === 'eco') {
        msg = "Cohesive emerald and cyan projection mirrors organic wavelengths, lowering cardiac rhythm metrics inside slow-moving traffic. Best paired with an adaptive 21°C cabin cooling preset.";
      } else if (mode === 'relax') {
        msg = "Ethereal violet-blue washes increase brain wave calming frequencies and relieve physical fatigue along the spine. We recommend enabling multi-zone distribution to blend these spectrums perfectly.";
      } else {
        msg = "Custom dual-spectral mapping offers a tailored psychological sanctuary. Soft warm-gold footwell accents mixed with muted magenta dashboard sweeps help shield night vision from oncoming headlights.";
      }
      setAiAdvisory(msg);
    } finally {
      setAdvisoryLoading(false);
    }
  };

  // Debounced API feedback loop
  useEffect(() => {
    if (!ambientEnabled) return;
    const timer = setTimeout(() => {
      fetchAdvisory(
        activeMode, 
        currentTheme.primary, 
        currentTheme.secondary, 
        brightness, 
        multiZoneEnabled
      );
    }, 450);

    return () => clearTimeout(timer);
  }, [activeMode, currentTheme.primary, currentTheme.secondary, brightness, multiZoneEnabled, ambientEnabled]);

  // Handle color change for current mode linkage
  const updateLinkedColor = (type: 'primary' | 'secondary', hex: string) => {
    setModeThemes(prev => {
      const updatedTheme = { ...prev[activeMode], [type]: hex };
      // Auto-name if custom setup matches presets or stays unique
      if (activeMode === 'custom') {
        updatedTheme.name = 'AMG Custom Mix';
      }
      return { ...prev, [activeMode]: updatedTheme };
    });
  };

  const handleApplyPresetGroup = (themeName: string, pri: string, sec: string) => {
    setModeThemes(prev => ({
      ...prev,
      [activeMode]: { primary: pri, secondary: sec, name: themeName }
    }));
    addRecentAction({
      icon: 'ac_unit',
      title: 'Preset Applied',
      description: `Ambient theme: ${themeName} synchronized with ${activeMode.toUpperCase()} mode`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  };

  const handleToggleZone = (zoneKey: keyof typeof zones) => {
    setZones(prev => ({ ...prev, [zoneKey]: !prev[zoneKey] }));
  };

  const handleSyncToCockpit = () => {
    addRecentAction({
      icon: 'ac_unit',
      title: 'Color Matrix Synced',
      description: `Pushed "${currentTheme.name}" mapping (${currentTheme.primary} / ${currentTheme.secondary}) to vehicle overhead LEDs`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  };

  return (
    <section className="bg-slate-900 border border-white/5 rounded-3xl p-5 flex flex-col gap-5 overflow-hidden relative" id="ambient-lighting-settings-panel">
      {/* Visual Top Highlight */}
      <div 
        className="absolute inset-x-0 top-0 h-1.5 transition-all duration-1000"
        style={{ 
          background: ambientEnabled 
            ? `linear-gradient(90deg, ${currentTheme.primary} 0%, ${multiZoneEnabled ? currentTheme.secondary : currentTheme.primary} 100%)` 
            : '#475569',
          opacity: (brightness / 100) * 0.9,
          filter: 'blur(3px)'
        }} 
      />

      {/* Header and Master Power Toggle */}
      <div className="flex justify-between items-start mt-1">
        <div>
          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block font-sans">Interior Experience Center</span>
          <h4 className="text-sm font-extrabold text-slate-100 flex items-center gap-1.5 mt-0.5">
            <Lightbulb className={cn(
              "w-4 h-4 transition-all",
              ambientEnabled ? "text-amber-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.5)] animate-pulse" : "text-slate-500"
            )} /> 
            Ambient Lighting Dynamics
          </h4>
        </div>

        <button
          onClick={() => setAmbientEnabled(!ambientEnabled)}
          className={cn(
            "text-[10px] font-extrabold uppercase px-3 py-1.5 rounded-xl border tracking-widest transition-all flex items-center gap-1.5",
            ambientEnabled 
              ? "bg-amber-400 text-slate-950 border-amber-300 font-bold shadow-[0_0_12px_rgba(253,224,71,0.15)]" 
              : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
          )}
        >
          <Power className="w-3.5 h-3.5" />
          {ambientEnabled ? "SYSTEM ACTIVE" : "SYSTEM SHUTDOWN"}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!ambientEnabled ? (
          <motion.div 
            initial={{ opacity: 0, height: 120 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 120 }}
            className="bg-slate-950/40 border border-white/5 rounded-2xl p-6 text-center flex flex-col items-center justify-center gap-2 py-8"
          >
            <Lightbulb className="w-8 h-8 text-slate-600 mb-1" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ambient Lighting offline</p>
            <p className="text-[10.5px] text-slate-500 max-w-xs leading-relaxed">
              Enable the system master toggle at the top right to light up your cabin LED circuitry and experience drive sync modeling.
            </p>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-5"
          >
            {/* Driving Mode Linkage Selector */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[9.5px]">Link Drive Profile to Ambient Theme</span>
                <button
                  type="button"
                  onClick={() => setAutoDriveSync(!autoDriveSync)}
                  className={cn(
                    "text-[9px] font-black uppercase px-2 py-0.5 rounded transition-all",
                    autoDriveSync 
                      ? "text-emerald-400 bg-emerald-500/15 border border-emerald-500/20" 
                      : "text-slate-500 bg-white/5 border border-white/5"
                  )}
                  title="If enabled, selecting drive profiles links mapping automatically!"
                >
                  {autoDriveSync ? "Sync Linkage: Arm" : "Sync Linkage: Off"}
                </button>
              </div>

              {/* Grid of Driving Modes to bind */}
              <div className="grid grid-cols-4 gap-2">
                {([
                  { key: 'sport', label: 'SPORT', icon: Flame, color: 'text-rose-450' },
                  { key: 'eco', label: 'ECO', icon: Compass, color: 'text-emerald-450' },
                  { key: 'relax', label: 'RELAX', icon: Heart, color: 'text-purple-450' },
                  { key: 'custom', label: 'INDIVIDUAL', icon: Sliders, color: 'text-pink-450' },
                ] as const).map((m) => {
                  const Icon = m.icon;
                  const isSelected = activeMode === m.key;
                  const linkedColors = modeThemes[m.key];
                  
                  return (
                    <button
                      key={m.key}
                      onClick={() => setActiveMode(m.key)}
                      className={cn(
                        "p-2.5 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all outline-none",
                        isSelected 
                          ? "bg-slate-950 border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
                          : "bg-slate-900/40 border-white/5 hover:border-white/10"
                      )}
                    >
                      <Icon className={cn("w-4 h-4", isSelected ? m.color : "text-slate-500")} />
                      <span className={cn(
                        "text-[9.5px] font-black uppercase tracking-wider",
                        isSelected ? "text-slate-100" : "text-slate-400"
                      )}>
                        {m.label}
                      </span>

                      {/* Mini color link bubble indicator */}
                      <div className="flex gap-0.5 justify-center mt-1">
                        <span 
                          className="w-1.5 h-1.5 rounded-full block border border-white/10" 
                          style={{ backgroundColor: linkedColors.primary }} 
                        />
                        {multiZoneEnabled && (
                          <span 
                            className="w-1.5 h-1.5 rounded-full block border border-white/10" 
                            style={{ backgroundColor: linkedColors.secondary }} 
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dashboard Mockup Representation */}
            <div className="bg-slate-950/60 rounded-3xl border border-white/5 p-4 flex flex-col gap-3 relative overflow-hidden h-44 justify-center items-center">
              
              {/* LED Lighting Ambient Glow Elements depending on active selections */}
              {zones.dashboard && (
                <div 
                  className="absolute inset-x-0 top-0 h-10 filter blur-[28px] opacity-25"
                  style={{
                    background: `linear-gradient(90deg, ${currentTheme.primary} 0%, ${multiZoneEnabled ? currentTheme.secondary : currentTheme.primary} 100%)`,
                    transform: 'translateY(-10px)'
                  }}
                />
              )}
              {zones.footwells && (
                <div 
                  className="absolute inset-x-0 bottom-0 h-12 filter blur-[32px] opacity-30"
                  style={{
                    background: `linear-gradient(90deg, ${currentTheme.secondary} 0%, ${currentTheme.primary} 100%)`
                  }}
                />
              )}
              {zones.doorTrims && (
                <>
                  <div 
                    className="absolute left-0 inset-y-0 w-8 filter blur-[24px] opacity-20"
                    style={{ backgroundColor: currentTheme.primary }}
                  />
                  <div 
                    className="absolute right-0 inset-y-0 w-8 filter blur-[24px] opacity-20"
                    style={{ backgroundColor: multiZoneEnabled ? currentTheme.secondary : currentTheme.primary }}
                  />
                </>
              )}

              {/* Graphical representation of high-tech dashboard structure */}
              <div className="relative z-10 w-full max-w-[280px] flex flex-col items-center gap-1.5">
                
                {/* Windshield edge line */}
                <div className="w-full h-0.5 bg-slate-800 opacity-50 rounded" />
                
                {/* Dash Console Line (Interactive glow based on dash zone selection) */}
                <div className="w-full flex justify-between items-center px-4 relative">
                  
                  {/* Left Door line */}
                  <div 
                    className="absolute left-0 h-12 w-1.5 rounded-full transition-all duration-700" 
                    style={{ 
                      backgroundColor: currentTheme.primary,
                      boxShadow: zones.doorTrims ? `0 0 10px ${currentTheme.primary}` : 'none',
                      opacity: zones.doorTrims ? (brightness / 100) : 0.15
                    }} 
                  />

                  {/* Left Air vent shape */}
                  <div className="w-4 h-4 rounded bg-slate-850 border border-slate-700 opacity-40 flex items-center justify-center">
                    <span className="text-[6px] text-slate-400">⚡</span>
                  </div>

                  {/* Main Digital Cockpit screen */}
                  <div className="flex-1 mx-2.5 bg-slate-900 border border-white/10 rounded-xl p-2 relative flex flex-col items-center gap-1 overflow-hidden shadow-xl">
                    
                    {/* Tiny visual representation inside HUD */}
                    <div className="w-full flex justify-between text-[6px] text-slate-500 font-mono">
                      <span>D-DYNAMIC</span>
                      <span>{brightness}% BRT</span>
                    </div>
                    
                    {/* Speed indicator */}
                    <span className="text-base font-black font-mono tracking-tight text-white leading-none mt-1">
                      {activeMode === 'sport' ? 'AMG SPORT' : activeMode === 'eco' ? 'EQ ECO' : activeMode === 'relax' ? 'RELAX' : 'CUSTOM'}
                    </span>
                    
                    {/* Led bar under the screen */}
                    <div 
                      className="w-full h-1 mt-1 rounded-full transition-all duration-700" 
                      style={{ 
                        background: `linear-gradient(90deg, ${currentTheme.primary} 0%, ${multiZoneEnabled ? currentTheme.secondary : currentTheme.primary} 100%)`,
                        boxShadow: zones.dashboard ? `0 0 8px ${currentTheme.secondary}` : 'none',
                        opacity: zones.dashboard ? (brightness / 100) : 0.15
                      }} 
                    />
                  </div>

                  {/* Right Air vent */}
                  <div className="w-4 h-4 rounded bg-slate-850 border border-slate-700 opacity-40 flex items-center justify-center">
                    <span className="text-[6px] text-slate-400">⚡</span>
                  </div>

                  {/* Right Door line */}
                  <div 
                    className="absolute right-0 h-12 w-1.5 rounded-full transition-all duration-700" 
                    style={{ 
                      backgroundColor: multiZoneEnabled ? currentTheme.secondary : currentTheme.primary,
                      boxShadow: zones.doorTrims ? `0 0 10px ${multiZoneEnabled ? currentTheme.secondary : currentTheme.primary}` : 'none',
                      opacity: zones.doorTrims ? (brightness / 100) : 0.15
                    }} 
                  />
                </div>

                {/* Dashboard accent list line */}
                <div 
                  className="w-11/12 h-1 rounded-full transition-all duration-700 mt-1" 
                  style={{
                    background: `linear-gradient(90deg, ${currentTheme.primary} 10%, ${multiZoneEnabled ? currentTheme.secondary : currentTheme.primary} 90%)`,
                    boxShadow: zones.centerConsole ? `0 0 12px ${currentTheme.primary}` : 'none',
                    opacity: zones.centerConsole ? (brightness / 100) : 0.2
                  }}
                />

                {/* Footwell lights represent */}
                <div className="w-10/12 flex justify-between px-6 mt-1.5">
                  <div 
                    className="w-5 h-2 rounded transition-all duration-700"
                    style={{ 
                      backgroundColor: currentTheme.primary,
                      boxShadow: zones.footwells ? `0 0 12px ${currentTheme.primary}` : 'none',
                      opacity: zones.footwells ? (brightness / 100) * 0.7 : 0.1
                    }}
                  />
                  <div 
                    className="w-5 h-2 rounded transition-all duration-700"
                    style={{ 
                      backgroundColor: multiZoneEnabled ? currentTheme.secondary : currentTheme.primary,
                      boxShadow: zones.footwells ? `0 0 12px ${multiZoneEnabled ? currentTheme.secondary : currentTheme.primary}` : 'none',
                      opacity: zones.footwells ? (brightness / 100) * 0.7 : 0.1
                    }}
                  />
                </div>

              </div>

              {/* Title description of colors inside mockup */}
              <div className="absolute bottom-2 left-4 text-[9px] font-bold text-slate-400 flex items-center gap-1">
                <Palette className="w-3 h-3 text-slate-500" />
                Theme: <span className="text-white font-black">{currentTheme.name}</span>
              </div>
            </div>

            {/* Color Customizer Controls */}
            <div className="grid grid-cols-1 gap-4 bg-slate-900/40 border border-white/5 p-4 rounded-3xl md:grid-cols-2">
              
              {/* Primary Color selection */}
              <div className="space-y-2">
                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Primary LED Zone</span>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-6 h-6 rounded-xl border border-white/10 shrink-0 shadow-lg"
                    style={{ backgroundColor: currentTheme.primary }} 
                  />
                  <span className="text-xs font-mono font-bold uppercase text-slate-200">{currentTheme.primary}</span>
                </div>
                
                {/* Tiny Swatches */}
                <div className="flex gap-1.5 flex-wrap">
                  {presetColors.map((col) => (
                    <button
                      key={`pri-${col.hex}`}
                      onClick={() => updateLinkedColor('primary', col.hex)}
                      className={cn(
                        "w-4.5 h-4.5 rounded-full border hover:scale-110 active:scale-90 transition-all block",
                        currentTheme.primary === col.hex ? "border-white" : "border-transparent"
                      )}
                      style={{ backgroundColor: col.hex }}
                      title={col.label}
                    />
                  ))}
                </div>
              </div>

              {/* Secondary Color selecting */}
              <div className="space-y-2 border-t border-white/5 pt-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Secondary LED Accent</span>
                  <button
                    onClick={() => setMultiZoneEnabled(!multiZoneEnabled)}
                    className={cn(
                      "text-[8.5px] font-extrabold uppercase px-1.5 py-0.5 rounded",
                      multiZoneEnabled ? "text-blue-450 bg-blue-500/15" : "text-slate-500 hover:text-slate-350"
                    )}
                  >
                    {multiZoneEnabled ? "Duo-Zone" : "Mono-Zone"}
                  </button>
                </div>

                {multiZoneEnabled ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded-xl border border-white/10 shrink-0 shadow-lg"
                        style={{ backgroundColor: currentTheme.secondary }} 
                      />
                      <span className="text-xs font-mono font-bold uppercase text-slate-200">{currentTheme.secondary}</span>
                    </div>
                    {/* Tiny Swatches */}
                    <div className="flex gap-1.5 flex-wrap">
                      {presetColors.map((col) => (
                        <button
                          key={`sec-${col.hex}`}
                          onClick={() => updateLinkedColor('secondary', col.hex)}
                          className={cn(
                            "w-4.5 h-4.5 rounded-full border hover:scale-110 active:scale-90 transition-all block",
                            currentTheme.secondary === col.hex ? "border-white" : "border-transparent"
                          )}
                          style={{ backgroundColor: col.hex }}
                          title={col.label}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-2.5 text-[10px] text-slate-550 leading-relaxed font-semibold italic">
                    Configure Duo-Zone multi-channel routing to unlock independent upper and lower floor accent colors.
                  </div>
                )}
              </div>
            </div>

            {/* Brightness Controller & Zones Selectors */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              
              {/* Luminance Brightness */}
              <div className="bg-slate-900/40 border border-white/5 p-3.5 rounded-2xl flex flex-col gap-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[9.5px] flex items-center gap-1">
                    <Sun className="w-3.5 h-3.5 text-slate-400" /> LED Grid Intensity
                  </span>
                  <span className="font-mono font-black text-white">{brightness}%</span>
                </div>
                
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer h-1 rounded bg-slate-950 border border-white/5"
                />
                
                <div className="flex justify-between text-[8px] text-slate-550 uppercase font-bold px-0.5">
                  <span>Silent Dim</span>
                  <span>Co-Pilot Glare Guard</span>
                  <span>Max Flare</span>
                </div>
              </div>

              {/* Zone Mapping Selection */}
              <div className="bg-slate-900/40 border border-white/5 p-3.5 rounded-2xl flex flex-col gap-2">
                <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Active Luminary Zones</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { key: 'dashboard', label: 'Dashboard' },
                    { key: 'doorTrims', label: 'Door Liners' },
                    { key: 'footwells', label: 'Footwells' },
                    { key: 'centerConsole', label: 'Bridge Grid' },
                  ].map((z) => {
                    const active = zones[z.key as keyof typeof zones];
                    return (
                      <button
                        key={z.key}
                        onClick={() => handleToggleZone(z.key as keyof typeof zones)}
                        className={cn(
                          "py-1.5 text-[10px] rounded-lg tracking-wide uppercase font-bold border font-semibold text-center transition-all",
                          active
                            ? "bg-slate-950 text-white border-white/10 shadow-sm"
                            : "bg-transparent text-slate-500 border-transparent hover:text-slate-350"
                        )}
                      >
                        {z.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Curated Mercedes Ambient Collections */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans flex items-center gap-1">
                <Palette className="w-3.5 h-3.5 text-blue-400" /> Mercedes Signature Catalogs
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { name: 'Miami Nights', pri: '#8b5cf6', sec: '#ec4899', desc: 'Neon Cyberpunk' },
                  { name: 'AMG Redline', pri: '#ef4444', sec: '#1e293b', desc: 'Race Precision' },
                  { name: 'EQ Ocean Flow', pri: '#06b6d4', sec: '#3b82f6', desc: 'Luminous Hydro' },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPresetGroup(preset.name, preset.pri, preset.sec)}
                    className="p-2 bg-slate-950/70 border border-white/5 hover:border-white/10 rounded-xl transition-all text-left flex flex-col gap-0.5"
                  >
                    <span className="text-[10px] font-black text-white truncate block">{preset.name}</span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase truncate block mb-1">{preset.desc}</span>
                    <div className="flex gap-1 items-center mt-auto">
                      <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: preset.pri }} />
                      <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: preset.sec }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cognitive Biometrics Specialist Feedback Box */}
            <div className="bg-slate-950/75 border border-white/15 p-4 rounded-3xl relative overflow-hidden flex flex-col gap-2">
              <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
              
              <div className="flex justify-between items-start">
                <span className="text-[9.5px] font-black text-amber-300 uppercase tracking-widest flex items-center gap-1 font-sans">
                  🧠 COCKPIT COGNITIVE PSCHOLOGY EXPERTISE
                </span>
                {advisoryLoading && (
                  <RefreshCw className="w-3 h-3 text-amber-300 animate-spin" />
                )}
              </div>
              
              <p className="text-[10.5px] text-slate-350 leading-relaxed font-sans italic min-h-[40px]">
                {advisoryLoading && !aiAdvisory ? (
                  "Initiating synaptic color-atmosphere projection review..."
                ) : (
                  `"${aiAdvisory}"`
                )}
              </p>
            </div>

            {/* Bottom Primary Sync Activation Button */}
            <div className="pt-1.5">
              <button
                type="button"
                onClick={handleSyncToCockpit}
                className="w-full h-11 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-widest transition-all active:scale-98 flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(234,179,8,0.25)]"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                ACTIVATE INTUITIVE LIGHTING BOUNDARIES
              </button>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </section>
  );
}
