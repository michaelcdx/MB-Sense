import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Map as MapIcon, Car, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const tabs = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Calendar', path: '/calendar', icon: Calendar },
    { name: 'Map', path: '/map', icon: MapIcon },
    { name: 'Vehicle', path: '/vehicle', icon: Car },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-xl items-center justify-around rounded-t-3xl border border-b-0 border-white/5 bg-slate-950/95 px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-2xl backdrop-blur sm:bottom-4 sm:rounded-3xl sm:border">
      {tabs.map((tab) => {
        const isActive = path === tab.path;
        return (
          <Link
            key={tab.name}
            to={tab.path}
            className={cn(
              "relative flex min-h-12 min-w-12 flex-col items-center justify-center p-1.5 transition-all duration-300",
              isActive ? "text-blue-400" : "text-slate-400 hover:text-blue-300"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="nav-bg"
                className="absolute inset-0 bg-blue-500/10 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <tab.icon className="w-6 h-6 z-10" strokeWidth={isActive ? 2.5 : 2} />
            <span className={cn(
              "text-[10px] uppercase tracking-tighter mt-1 z-10",
              isActive ? "font-bold" : "font-medium"
            )}>
              {tab.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
