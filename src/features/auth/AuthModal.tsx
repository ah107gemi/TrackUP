import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User as UserIcon } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAuth } from './AuthContext';

type AuthMode = 'login' | 'register' | 'reset';

export const AuthModal: React.FC = () => {
  const { authModalOpen, setAuthModalOpen } = useUIStore();
  const { signIn, signUp, resetPassword } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authModalOpen) {
      setMode('login');
      setError(null);
      setSuccess(null);
      setEmail('');
      setPassword('');
      setUsername('');
      setDisplayName('');
    }
  }, [authModalOpen]);

  if (!authModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await signIn(email, password);
        if (res.error) {
          setError(res.error);
        } else {
          setAuthModalOpen(false);
        }
      } else if (mode === 'register') {
        if (!username.trim()) {
          setError('Username is required');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        const res = await signUp(email, password, username.trim(), displayName.trim() || undefined);
        if (res.error) {
          setError(res.error);
        } else {
          setAuthModalOpen(false);
        }
      } else if (mode === 'reset') {
        await resetPassword(email);
        setSuccess('Password reset link has been dispatched to your email.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="auth-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={() => setAuthModalOpen(false)}
    >
      <div
        className="w-full max-w-md bg-surface border border-surface-elevated rounded-2xl shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-surface-elevated">
          <div className="flex items-center gap-2">
            <img
              src="/assets/trackup-logo.jpg"
              alt="TrackUp Logo"
              className="w-8 h-8 rounded-lg object-cover"
            />
            <h2 className="text-xl font-bold text-text-primary">
              {mode === 'login' && 'Welcome Back'}
              {mode === 'register' && 'Create Account'}
              {mode === 'reset' && 'Reset Password'}
            </h2>
          </div>
          <button
            onClick={() => setAuthModalOpen(false)}
            data-testid="auth-close-button"
            aria-label="Close authentication modal"
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        {mode !== 'reset' && (
          <div className="flex p-1 mt-4 bg-surface-elevated rounded-xl">
            <button
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              data-testid="auth-tab-login"
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-accent text-background shadow'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              data-testid="auth-tab-register"
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-accent text-background shadow'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div
              data-testid="auth-error-message"
              className="p-3 text-xs rounded-xl bg-status-dropped/10 border border-status-dropped/20 text-status-dropped font-medium"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              data-testid="auth-success-message"
              className="p-3 text-xs rounded-xl bg-status-completed/10 border border-status-completed/20 text-status-completed font-medium"
            >
              {success}
            </div>
          )}

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Username *
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-text-muted absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. otaku_prime"
                    data-testid="auth-username-input"
                    className="w-full pl-9 pr-3 py-2 bg-surface-elevated border border-surface-elevated rounded-xl text-text-primary text-sm focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Display Name
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-text-muted absolute left-3 top-3" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Alex Tracker"
                    data-testid="auth-displayname-input"
                    className="w-full pl-9 pr-3 py-2 bg-surface-elevated border border-surface-elevated rounded-xl text-text-primary text-sm focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              {mode === 'login' ? 'Email or Username *' : 'Email Address *'}
            </label>
            <div className="relative">
              {mode === 'login' ? (
                <UserIcon className="w-4 h-4 text-text-muted absolute left-3 top-3" />
              ) : (
                <Mail className="w-4 h-4 text-text-muted absolute left-3 top-3" />
              )}
              <input
                type={mode === 'login' ? 'text' : 'email'}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={mode === 'login' ? 'name@example.com or @username' : 'name@example.com'}
                data-testid="auth-email-input"
                className="w-full pl-9 pr-3 py-2 bg-surface-elevated border border-surface-elevated rounded-xl text-text-primary text-sm focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {mode !== 'reset' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-text-secondary">Password *</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setError(null);
                    }}
                    className="text-[11px] text-accent hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-text-muted absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  data-testid="auth-password-input"
                  className="w-full pl-9 pr-3 py-2 bg-surface-elevated border border-surface-elevated rounded-xl text-text-primary text-sm focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="auth-submit-button"
            className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-background font-semibold text-sm transition-all shadow-md mt-2 disabled:opacity-50"
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link'}
          </button>

          {mode === 'reset' && (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className="w-full py-2 text-xs text-text-secondary hover:text-text-primary"
            >
              Back to Sign In
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
