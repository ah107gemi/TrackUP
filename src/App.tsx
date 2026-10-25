import React from 'react';
import { AuthProvider } from './features/auth/AuthContext';
import { AppShell } from './components/layout/AppShell';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
};

export default App;
