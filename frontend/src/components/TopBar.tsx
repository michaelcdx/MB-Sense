import { MapPin, Home, Calendar, Map as MapIcon, Car, User } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export default function TopBar() {
  const { user, isAuthenticated } = useAppStore();
  const location = useLocation();
  const path = location.pathname;

  const tabs = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Calendar', path: '/calendar', icon: Calendar },
    { name: 'Map', path: '/map', icon: MapIcon },
    { name: 'Vehicle', path: '/vehicle', icon: Car },
    { name: 'Profile', path: isAuthenticated ? '/profile' : '/signin', icon: User },
  ];
  
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 w-full items-center justify-between border-b border-white/5 bg-slate-950/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex-1 flex justify-start">
        <Link to="/" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors">
          <MapPin className="w-5 h-5" />
          <h1 className="text-lg font-bold tracking-widest uppercase sm:text-xl">MB SENSE</h1>
        </Link>
      </div>

      {/* Desktop Navigation */}
      <nav className="hidden sm:flex justify-center items-center gap-6 lg:gap-10 h-16">
        {tabs.map((tab) => {
          const isActive = path === tab.path;
          return (
            <Link
              key={tab.name}
              to={tab.path}
              className={cn(
                "relative flex h-full items-center justify-center transition-all duration-300",
                isActive ? "text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "text-slate-300 hover:text-white"
              )}
            >
              <span className={cn(
                "text-sm lg:text-base tracking-wide font-medium",
                isActive && "font-bold"
              )}>
                {tab.name}
              </span>
              {isActive && (
                <motion.div
                  layoutId="desktop-nav-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-500 shadow-[0_-2px_8px_rgba(59,130,246,0.8)] rounded-t-full"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  style={{ willChange: "transform" }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1 flex justify-end items-center gap-4">
        <Link 
          to={isAuthenticated ? "/profile" : "/signin"}
          className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer"
        >
          <span className="text-sm text-blue-400 font-bold uppercase">{user.name.slice(0,2)}</span>
        </Link>
      </div>
    </header>
  );
}
