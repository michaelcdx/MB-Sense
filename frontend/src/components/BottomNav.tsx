import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Calendar, Map as MapIcon, Car, BrainCircuit } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const tabs = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Calendar', path: '/calendar', icon: Calendar },
    { name: 'Map', path: '/map', icon: MapIcon },
    { name: 'Vehicle', path: '/vehicle', icon: Car },
    { name: 'AI', path: '/ai', icon: BrainCircuit }
  ];

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-3 pb-[env(safe-area-inset-bottom)] sm:hidden" aria-label="Mobile navigation">
      <div className="glass-selection-pane pointer-events-auto w-full max-w-[420px] justify-between px-1.5 py-1.5">
        {tabs.map((tab) => {
          const isActive = path === tab.path;
          return (
            <button
              key={tab.name}
              type="button"
              onClick={() => navigate(tab.path)}
              className={cn('glass-selection-item min-w-0 flex-1 flex-col gap-0.5 px-1.5 py-2', isActive && 'is-active')}
            >
              {isActive && <motion.span layoutId="mobile-glass-selection" className="glass-selection-active" transition={{ type: 'spring', stiffness: 320, damping: 32 }} />}
              <tab.icon className="relative z-10 h-[18px] w-[18px]" />
              <span className="relative z-10 text-[9px] leading-none">{tab.name}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
