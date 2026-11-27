import {useState} from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import type {AdminUser, AuthStatusResponse} from '../../types/admin';
import {
  loginAdminAccount,
  requestAdminPasswordReset,
  setupOwnerAccount,
} from '../../services/adminApi';

interface AdminAuthViewProps {
  authStatus: AuthStatusResponse;
  onAuthenticated: (token: string, user: AdminUser) => void;
  onNavigatePublic: () => void;
}

export function AdminAuthView({
  authStatus,
  onAuthenticated,
  onNavigatePublic,
}: AdminAuthViewProps) {
  const [mode, setMode] = useState<'login' | 'setup' | 'reset'>(
    authStatus.requiresSetup ? 'setup' : 'login'
  );
  const [email, setEmail] = useState(authStatus.adminEmailHint || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (mode === 'reset') {
      setLoading(true);
      try {
        const res = await requestAdminPasswordReset(email);
        if (res.ok) {
          setInfoMessage(res.message);
        } else {
          setError(res.message);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'setup') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      setLoading(true);
      try {
        const res = await setupOwnerAccount(email, password);
        onAuthenticated(res.token, res.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Setup failed.');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const res = await loginAdminAccount(email, password);
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col justify-between px-4 py-8">
      <div className="max-w-md w-full mx-auto">
        <button
          type="button"
          onClick={onNavigatePublic}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Wedding Invitation</span>
        </button>
      </div>

      <main className="w-full max-w-md mx-auto my-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">
                {mode === 'setup'
                  ? 'First-Time Owner Setup'
                  : mode === 'reset'
                    ? 'Reset Owner Password'
                    : 'Wedding CMS Sign In'}
              </h1>
              <p className="text-xs text-slate-500">
                {mode === 'setup'
                  ? 'Claim the single owner account to manage wedding content.'
                  : mode === 'reset'
                    ? 'Request a verified password reset email.'
                    : 'Private owner access · Public registration is disabled.'}
              </p>
            </div>
          </div>

          {/* Honest Environment / Supabase Status Notice */}
          {!authStatus.supabaseConfigured && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-1">
              <p className="font-semibold">Supabase Credentials Not Configured</p>
              <p className="text-amber-800 leading-relaxed">
                Missing server environment variables:{' '}
                <code className="font-mono">
                  {authStatus.supabaseMissingVars.join(', ')}
                </code>
                . Running in server-side local owner auth and persistent file mode until
                Supabase is configured.
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div
              role="status"
              className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{infoMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Owner Email Address
              </label>
              <input
                id="admin-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@example.com"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={
                      mode === 'setup' ? 'new-password' : 'current-password'
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      mode === 'setup' ? 'Minimum 8 characters' : 'Enter password'
                    }
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm border border-slate-200 rounded-lg text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {mode === 'setup' && (
              <div>
                <label
                  htmlFor="admin-confirm-password"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Confirm Password
                </label>
                <input
                  id="admin-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer min-h-[44px]"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : mode === 'setup' ? (
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              ) : (
                <KeyRound className="w-4 h-4" aria-hidden="true" />
              )}
              <span>
                {loading
                  ? 'Verifying…'
                  : mode === 'setup'
                    ? 'Create Owner Account'
                    : mode === 'reset'
                      ? 'Send Password Reset Email'
                      : 'Sign In to Dashboard'}
              </span>
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setInfoMessage(null);
                  setMode('reset');
                }}
                className="text-slate-600 hover:text-slate-900 underline underline-offset-4 cursor-pointer"
              >
                Forgot password?
              </button>
            )}
            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setInfoMessage(null);
                  setMode('login');
                }}
                className="text-slate-600 hover:text-slate-900 underline underline-offset-4 cursor-pointer"
              >
                Back to sign in
              </button>
            )}
            {mode === 'setup' && (
              <span className="text-slate-500">
                One-time setup locks automatically after claiming.
              </span>
            )}
          </div>
        </div>
      </main>

      <p className="text-center text-[11px] text-slate-400">
        Protected Wedding Invitation Management Console
      </p>
    </div>
  );
}
