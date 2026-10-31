import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './features/auth/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

/**
 * Global Route Specification:
 * - #/user/:username or #/user/:userId -> Dedicated read-only Public Profile view for social discovery
 * - #/watch & #/read -> Watch and Read domain libraries
 * - #/profile/favorites/:category -> Profile showcase favorites
 */
export const PUBLIC_PROFILE_ROUTE_PATTERN = '#/user/:username';
export const matchPublicProfileRoute = (url: string): string | null => {
  const match = url.match(/(?:#|\/)?\/user\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary
      fallbackTitle="Application Error"
      fallbackMessage="Something went wrong loading TrackUP. Please refresh or try again."
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
