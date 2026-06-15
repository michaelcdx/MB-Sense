import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Map as MapIcon, Car, User } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useAppStore } from '../store/useAppStore';

export default function BottomNav() {
  const location = useLocation();
  const path = location.pathname;
  const { isAuthenticated } = useAppStore();

  const tabs = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Calendar', path: '/calendar', icon: Calendar },
    { name: 'Map', path: '/map', icon: MapIcon },
    { name: 'Vehicle', path: '/vehicle', icon: Car },
    { name: 'Profile', path: isAuthenticated ? '/profile' : '/signin', icon: User },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-xl items-center justify-around rounded-t-3xl border border-b-0 border-white/10 bg-slate-950/50 px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_32px_0_rgba(0,0,0,0.36)] backdrop-blur-xl sm:hidden">
      {tabs.map((tab) => {
        const isActive = path === tab.path;
        return (
          <Link
            key={tab.name}
            to={tab.path}
            className={cn(
              "relative flex flex-1 min-h-[64px] flex-col items-center justify-center p-1.5 transition-all duration-300",
              isActive ? "text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" : "text-slate-400 hover:text-blue-300"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="mobile-nav-bg"
                className="absolute inset-1 bg-blue-500/20 backdrop-blur-md rounded-2xl border border-white/20 shadow-[0_4px_16px_rgba(59,130,246,0.3),inset_0_1px_2px_rgba(255,255,255,0.4)]"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{ willChange: "transform" }}
              />
            )}
            <div className="z-10 flex flex-col items-center justify-center">
              <tab.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              <span className={cn(
                "text-[10px] uppercase tracking-tighter mt-1",
                isActive ? "font-bold" : "font-medium"
              )}>
                {tab.name}
              </span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
