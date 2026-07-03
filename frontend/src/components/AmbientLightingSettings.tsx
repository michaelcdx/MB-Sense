import { useState } from 'react';
import { Check, Lightbulb, Palette, Power, Sliders } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';

type AmbientMode = 'comfort' | 'focus' | 'night' | 'custom';

const ambientModes: Array<{ id: AmbientMode; label: string; primary: string; secondary: string }> = [
  { id: 'comfort', label: 'Comfort', primary: '#8b5cf6', secondary: '#3b82f6' },
  { id: 'focus', label: 'Focus', primary: '#06b6d4', secondary: '#10b981' },
  { id: 'night', label: 'Night', primary: '#f97316', secondary: '#eab308' },
  { id: 'custom', label: 'Custom', primary: '#ec4899', secondary: '#f43f5e' },
];

const cabinZones = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'doors', label: 'Doors' },
  { key: 'footwell', label: 'Footwell' },
  { key: 'console', label: 'Console' },
] as const;

export default function AmbientLightingSettings() {
  const { addRecentAction } = useAppStore();
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<AmbientMode>('comfort');
  const [brightness, setBrightness] = useState(72);
  const [zones, setZones] = useState<Record<typeof cabinZones[number]['key'], boolean>>({
    dashboard: true,
    doors: true,
    footwell: true,
    console: false,
  });

  const activeMode = ambientModes.find((item) => item.id === mode) ?? ambientModes[0];

  const toggleZone = (zone: keyof typeof zones) => {
    setZones((current) => ({ ...current, [zone]: !current[zone] }));
  };

  const syncLighting = () => {
    addRecentAction({
      icon: 'ac_unit',
      title: 'Ambient Light Synced',
      description: `${activeMode.label} at ${brightness}% brightness`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-outline-variant/45 bg-surface-container-lowest shadow-ambient" id="ambient-lighting-settings-panel">
      <div
        className="h-1.5 transition-all"
        style={{
          background: enabled ? `linear-gradient(90deg, ${activeMode.primary}, ${activeMode.secondary})` : '#64748b',
          opacity: enabled ? brightness / 100 : 0.35,
        }}
      />

      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Ambient light</p>
            <h2 className="mt-1 text-xl font-black text-on-surface">Cabin lighting</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">Set the active interior lighting mode, zones, and brightness.</p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled((current) => !current)}
            className={cn(
              'flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-black uppercase tracking-widest transition',
              enabled ? 'border-amber-300/30 bg-amber-400/10 text-amber-500' : 'border-outline-variant/45 bg-surface-container-low text-slate-500'
            )}
          >
            <Power className="h-3.5 w-3.5" />
            {enabled ? 'On' : 'Off'}
          </button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
              <Palette className="h-4 w-4 text-primary" />
              Mode
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ambientModes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  disabled={!enabled}
                  className={cn(
                    'min-h-20 rounded-2xl border p-3 text-left transition disabled:opacity-50',
                    mode === item.id ? 'border-primary/45 bg-primary/10' : 'border-outline-variant/45 bg-surface-container-low hover:border-primary/35'
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-on-surface">{item.label}</span>
                    {mode === item.id && <Check className="h-4 w-4 text-primary" />}
                  </span>
                  <span className="mt-3 flex h-2 overflow-hidden rounded-full">
                    <span className="flex-1" style={{ backgroundColor: item.primary }} />
                    <span className="flex-1" style={{ backgroundColor: item.secondary }} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                  <Sliders className="h-4 w-4 text-primary" />
                  Brightness
                </span>
                <span className="text-sm font-black text-on-surface">{brightness}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={brightness}
                disabled={!enabled}
                onChange={(event) => setBrightness(Number(event.target.value))}
                className="mt-3 w-full accent-primary disabled:opacity-50"
                aria-label="Ambient light brightness"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                <Lightbulb className="h-4 w-4 text-primary" />
                Zones
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {cabinZones.map((zone) => (
                  <button
                    key={zone.key}
                    type="button"
                    disabled={!enabled}
                    onClick={() => toggleZone(zone.key)}
                    className={cn(
                      'h-10 rounded-xl border text-xs font-black transition disabled:opacity-50',
                      zones[zone.key] ? 'border-primary/35 bg-primary/10 text-primary' : 'border-outline-variant/45 bg-surface-container-low text-slate-500'
                    )}
                  >
                    {zone.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={!enabled}
          onClick={syncLighting}
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-black uppercase tracking-widest text-on-primary transition hover:bg-primary-dim disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Sync ambient light
        </button>
      </div>
    </section>
  );
}
