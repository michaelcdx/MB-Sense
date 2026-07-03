import { MapPin, Home, Calendar, Map as MapIcon, Car, BrainCircuit } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import GlassButton from './GlassButton';

export default function TopBar() {
  const { user, isAuthenticated } = useAppStore();
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

  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between px-3 sm:px-5 lg:px-8">
      <div className="pointer-events-auto flex flex-1 justify-start">
        <GlassButton onClick={() => navigate('/')} wrapClassName="text-[13px]" className="glass-brand-button">
          <MapPin className="h-4 w-4" />
          MB Sense
        </GlassButton>
      </div>

      <nav className="pointer-events-auto absolute left-1/2 top-3 hidden -translate-x-1/2 sm:block" aria-label="Primary navigation">
        <div className="glass-selection-pane">
          {tabs.map((tab) => {
            const isActive = path === tab.path;
            return (
              <button
                key={tab.name}
                type="button"
                onClick={() => navigate(tab.path)}
                className={cn('glass-selection-item', isActive && 'is-active')}
              >
                {isActive && <motion.span layoutId="topbar-glass-selection" className="glass-selection-active" transition={{ type: 'spring', stiffness: 320, damping: 32 }} />}
                <tab.icon className="relative z-10 h-4 w-4" />
                <span className="relative z-10">{tab.name}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="pointer-events-auto flex flex-1 justify-end">
        <GlassButton onClick={() => navigate(isAuthenticated ? '/profile' : '/signin')} wrapClassName="text-[13px]" className="glass-avatar-button" aria-label="Open profile">
          {initials}
        </GlassButton>
      </div>
    </header>
  );
}