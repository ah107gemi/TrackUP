import React from 'react';
import { Lock, LogIn } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useUIStore } from '../../stores/uiStore';

interface AuthGuardProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  fallbackTitle = 'Authentication Required',
  fallbackDescription = 'Please sign in or create an account to view and manage this section.',
}) => {
  const { user, loading } = useAuth();
  const { setAuthModalOpen } = useUIStore();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div
        data-testid="auth-guard-fallback"
        className="flex flex-col items-center justify-center p-8 max-w-md mx-auto my-12 bg-surface border border-surface-elevated rounded-2xl text-center shadow-xl"
      >
        <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-accent" />
        </div>
        <h3 className="text-lg font-bold text-text-primary mb-2">{fallbackTitle}</h3>
        <p className="text-xs text-text-secondary mb-6 leading-relaxed">
          {fallbackDescription}
        </p>
        <button
          onClick={() => setAuthModalOpen(true)}
          data-testid="auth-guard-signin-button"
          className="px-6 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-background font-semibold text-xs transition-all shadow-md flex items-center gap-2"
        >
          <LogIn className="w-4 h-4" />
          <span>Sign In / Register</span>
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
