import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

const demoEmail = 'employee@example.com';

export default function SignIn() {
  const [email, setEmail] = useState(demoEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const login = useAppStore((state) => state.login);
  const navigate = useNavigate();
  const location = useLocation();
  const from = typeof location.state === 'object' && location.state && 'from' in location.state
    ? String((location.state as { from?: string }).from || '/')
    : '/';

  const handleSignIn = (event: React.FormEvent) => {
    event.preventDefault();
    const isValid = login(email, password);
    if (!isValid) {
      setError('Use employee@example.com and password mercedesbenz.');
      return;
    }
    setError('');
    navigate(from === '/signin' || from === '/register' ? '/' : from, { replace: true });
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-5 py-8 text-on-surface">
      <div className="w-full max-w-sm rounded-3xl border border-outline-variant/45 bg-surface-container-lowest/88 p-7 shadow-ambient-lg backdrop-blur-xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/12">
            <LockKeyhole className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-black tracking-wide text-on-surface">MB Sense Employee Login</h1>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-400">Sign in to access the vehicle intelligence dashboard.</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-black uppercase tracking-widest text-slate-500">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 w-full rounded-xl border border-outline-variant/55 bg-surface-container-lowest px-4 text-sm font-semibold text-on-surface outline-none transition focus:border-primary/45 focus:ring-2 focus:ring-primary/20"
              placeholder="employee@example.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-black uppercase tracking-widest text-slate-500">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 w-full rounded-xl border border-outline-variant/55 bg-surface-container-lowest px-4 pr-12 text-sm font-semibold text-on-surface outline-none transition focus:border-primary/45 focus:ring-2 focus:ring-primary/20"
                placeholder="mercedesbenz"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-surface-container-low hover:text-slate-200"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-rose-500/25 bg-rose-950/45 px-3 py-2 text-xs font-bold text-rose-300" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="h-12 w-full rounded-xl bg-primary text-sm font-black uppercase tracking-widest text-on-primary shadow-ambient transition hover:bg-primary-dim active:scale-[0.98]"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
