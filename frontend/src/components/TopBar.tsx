import { MapPin, Signal } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function TopBar() {
  const { user } = useAppStore();
  
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 w-full items-center justify-between border-b border-white/5 bg-slate-950/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 text-blue-400">
        <MapPin className="w-5 h-5" />
        <h1 className="text-lg font-bold tracking-widest uppercase sm:text-xl">AIDV</h1>
      </div>
      <div className="flex items-center gap-4">
        <Signal className="w-5 h-5 text-slate-400" />
        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 overflow-hidden">
          <span className="text-xs text-blue-400 font-bold uppercase">{user.name.slice(0,2)}</span>
        </div>
      </div>
    </header>
  );
}
