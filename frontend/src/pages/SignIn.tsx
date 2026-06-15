import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

export default function SignIn() {
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAppStore();
  const navigate = useNavigate();

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    login();
    navigate('/');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-5xl font-black tracking-widest uppercase text-blue-500 mb-6 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">MB SENSE</h1>
          <h2 className="text-2xl font-bold text-white">Sign In</h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSignIn} className="w-full space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-white tracking-wide">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full bg-slate-900 border border-white/5 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-white tracking-wide">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                required
                className="w-full bg-slate-900 border border-white/5 rounded-xl pl-4 pr-12 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="••••••••"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-white text-slate-950 font-bold text-base py-3.5 rounded-xl mt-4 hover:bg-slate-200 transition-colors active:scale-[0.98]"
          >
            Sign In
          </button>
        </form>

        <div className="text-sm text-slate-400 mt-2">
          Don't have an account? <Link to="/register" className="text-blue-400 font-bold hover:text-blue-300 transition-colors">Register</Link>
        </div>
      </div>
    </div>
  );
}
