import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import Logo from '../components/Logo';

export default function CreateAccount() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAppStore();
  const navigate = useNavigate();

  const handleCreateAccount = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const result = await register(email, password);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.message ?? 'Unable to create account.');
      return;
    }

    setError('');
    navigate('/');
  };

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-3xl border border-outline-variant/45 bg-surface-container-lowest/82 p-7 shadow-ambient-lg backdrop-blur-xl">
        <div className="flex flex-col items-center text-center">
          <Logo className="mb-2 h-16 w-16 text-primary" />
          <h1 className="mb-2 text-3xl font-black uppercase tracking-wide text-primary">MB SENSE</h1>
          <h2 className="text-xl font-bold text-on-surface">Create Account</h2>
        </div>

        <form onSubmit={handleCreateAccount} className="w-full space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold tracking-wide text-on-surface">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-outline-variant/55 bg-surface-container-lowest px-4 py-3 text-on-surface placeholder:text-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-primary/45"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold tracking-wide text-on-surface">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-outline-variant/55 bg-surface-container-lowest py-3 pl-4 pr-12 text-on-surface placeholder:text-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-primary/45"
                placeholder="Password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold tracking-wide text-on-surface">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-outline-variant/55 bg-surface-container-lowest py-3 pl-4 pr-12 text-on-surface placeholder:text-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-primary/45"
                placeholder="Confirm password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="terms"
              required
              className="h-4 w-4 rounded border-outline-variant bg-surface-container-lowest text-primary focus:ring-primary focus:ring-offset-surface"
            />
            <label htmlFor="terms" className="text-sm text-slate-400">
              I agree to the <a href="#" className="text-primary transition-colors hover:text-primary-dim">Terms of Service</a>
            </label>
          </div>

          {error && (
            <p className="rounded-xl border border-rose-500/25 bg-rose-950/45 px-3 py-2 text-xs font-bold text-rose-300" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full rounded-xl bg-primary py-3.5 text-base font-bold text-on-primary transition-colors hover:bg-primary-dim active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-65"
          >
            {isSubmitting ? 'Creating Account' : 'Create Account'}
          </button>
        </form>

        <div className="mt-2 text-sm text-slate-400">
          Already have an account? <Link to="/signin" className="font-bold text-primary transition-colors hover:text-primary-dim">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
