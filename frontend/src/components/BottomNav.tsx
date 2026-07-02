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
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-xl items-center justify-around rounded-t-3xl border border-b-0 border-outline-variant/55 bg-surface-container-lowest/88 px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-ambient-lg backdrop-blur-xl sm:hidden">
      {tabs.map((tab) => {
        const isActive = path === tab.path;
        return (
          <Link
            key={tab.name}
            to={tab.path}
            className={cn(
              "relative flex flex-1 min-h-[64px] flex-col items-center justify-center p-1.5 transition-all duration-300",
              isActive ? "text-primary" : "text-on-surface-variant hover:text-primary"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="mobile-nav-bg"
                className="absolute inset-1 bg-primary-container/35 backdrop-blur-md rounded-2xl border border-primary/20 shadow-ambient"
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
