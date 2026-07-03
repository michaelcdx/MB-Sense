import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import Logo from '../components/Logo';

export default function CreateAccount() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register } = useAppStore();
  const navigate = useNavigate();

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    register();
    navigate('/');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8 rounded-3xl border border-outline-variant/45 bg-surface-container-lowest/82 p-7 shadow-ambient-lg backdrop-blur-xl">
        
        {/* Logo */}
        <div className="text-center flex flex-col items-center">
          <Logo className="h-16 w-16 text-primary mb-2" />
          <h1 className="text-3xl font-black tracking-wide uppercase text-primary mb-2">MB SENSE</h1>
          <h2 className="text-xl font-bold text-on-surface">Create Account</h2>
        </div>

        {/* Form */}
        <form onSubmit={handleCreateAccount} className="w-full space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold text-on-surface tracking-wide">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full bg-surface-container-lowest border border-outline-variant/55 rounded-xl px-4 py-3 text-on-surface placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-on-surface tracking-wide">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                required
                className="w-full bg-surface-container-lowest border border-outline-variant/55 rounded-xl pl-4 pr-12 py-3 text-on-surface placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all"
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

          <div className="space-y-2">
            <label className="text-sm font-bold text-on-surface tracking-wide">Confirm Password</label>
            <div className="relative">
              <input 
                type={showConfirmPassword ? "text" : "password"}
                required
                className="w-full bg-surface-container-lowest border border-outline-variant/55 rounded-xl pl-4 pr-12 py-3 text-on-surface placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/45 transition-all"
                placeholder="••••••••"
              />
              <button 
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input 
              type="checkbox" 
              id="terms" 
              required
              className="w-4 h-4 rounded border-outline-variant bg-surface-container-lowest text-primary focus:ring-primary focus:ring-offset-surface"
            />
            <label htmlFor="terms" className="text-sm text-slate-400">
              I agree to the <a href="#" className="text-primary hover:text-primary-dim transition-colors">Terms of Service</a>
            </label>
          </div>

          <button 
            type="submit"
            className="w-full bg-primary text-on-primary font-bold text-base py-3.5 rounded-xl mt-6 hover:bg-primary-dim transition-colors active:scale-[0.98]"
          >
            Create Account
          </button>
        </form>

        <div className="text-sm text-slate-400 mt-2">
          Already have an account? <Link to="/signin" className="text-primary font-bold hover:text-primary-dim transition-colors">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
