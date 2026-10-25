import React from 'react';

export const App: React.FC = () => {
  return (
    <main className="min-h-screen bg-background text-text-primary flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface border border-surface-elevated rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl">
        <div className="relative mb-6">
          <img
            src="/assets/trackup-logo.jpg"
            alt="TrackUp Logo"
            className="w-20 h-20 rounded-2xl object-cover shadow-lg border border-surface-elevated"
          />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-2">
          Track<span className="text-accent">Up</span>
        </h1>
        <p className="text-text-secondary text-sm font-medium mb-6">
          Track what you love.
        </p>
        <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-surface-elevated text-xs font-medium text-accent border border-accent/20">
          Phase 0 Foundation Ready
        </div>
      </div>
    </main>
  );
};

export default App;
