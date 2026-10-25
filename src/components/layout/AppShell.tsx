import React, { useState } from 'react';
import { DesktopSidebar } from './DesktopSidebar';
import { TopUtilityBar } from './TopUtilityBar';
import { MobileBottomNav } from './MobileBottomNav';
import { OmnisearchModal } from './OmnisearchModal';
import { AuthModal } from '../../features/auth/AuthModal';
import { ProfileModal } from '../../features/auth/ProfileModal';
import { AuthGuard } from '../../features/auth/AuthGuard';
import { SearchPage } from '../../features/catalog/SearchPage';
import { TitleDetailPage } from '../../features/catalog/TitleDetailPage';
import { useUIStore } from '../../stores/uiStore';
import { Film, BookOpen, Clock, Compass, Sparkles, ArrowRight } from 'lucide-react';

export const AppShell: React.FC = () => {
  const { activeTab, setActiveTab } = useUIStore();
  const [selectedTitleId, setSelectedTitleId] = useState<string | null>(null);

  const handleSelectTitle = (id: string) => {
    setSelectedTitleId(id);
  };

  const handleBackFromDetail = () => {
    setSelectedTitleId(null);
  };

  return (
    <div className="flex h-screen w-full bg-background text-text-primary overflow-hidden font-sans">
      {/* 1. Desktop Sidebar */}
      <DesktopSidebar />

      {/* 2. Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Utility Bar */}
        <TopUtilityBar />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 pb-24 md:pb-8">
          {selectedTitleId ? (
            <TitleDetailPage
              titleId={selectedTitleId}
              onBack={handleBackFromDetail}
              onSelectTitle={handleSelectTitle}
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <div data-testid="dashboard-view" className="max-w-6xl mx-auto space-y-6">
                  {/* Hero Banner */}
                  <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-surface to-surface-elevated border border-surface-elevated p-6 md:p-10 shadow-2xl">
                    <div className="max-w-xl relative z-10">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-semibold mb-4">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Phase 2 Catalog & Detail Pages Active</span>
                      </div>
                      <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-text-primary mb-3">
                        Track what you <span className="text-accent">love.</span>
                      </h1>
                      <p className="text-text-secondary text-sm md:text-base leading-relaxed mb-6">
                        Hosted entertainment and reading tracker for Movies, TV Shows, Anime Series, Anime Films, Manga, and Manhwa.
                      </p>
                      <button
                        onClick={() => setActiveTab('discover')}
                        data-testid="hero-explore-button"
                        className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-background font-bold text-xs transition-all shadow-md inline-flex items-center gap-2"
                      >
                        <span>Explore Catalog</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Stats Strip */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Watch Library', val: '0 Titles', icon: Film },
                      { label: 'Reading Library', val: '0 Titles', icon: BookOpen },
                      { label: 'Total Hours', val: '0.0 hrs', icon: Clock },
                      { label: 'Catalog Engine', val: '6 Formats', icon: Compass },
                    ].map((stat, i) => {
                      const Icon = stat.icon;
                      return (
                        <div
                          key={i}
                          className="p-5 rounded-2xl bg-surface border border-surface-elevated flex items-center gap-4"
                        >
                          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                            <Icon className="w-5 h-5 text-accent" />
                          </div>
                          <div>
                            <p className="text-xs text-text-muted font-medium">{stat.label}</p>
                            <p className="text-lg font-bold text-text-primary mt-0.5">{stat.val}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'discover' && (
                <SearchPage onSelectTitle={handleSelectTitle} />
              )}

              {activeTab === 'watch' && (
                <div data-testid="watch-view" className="max-w-6xl mx-auto space-y-4">
                  <h2 className="text-2xl font-bold">Watch Library</h2>
                  <AuthGuard fallbackTitle="Sign In to Access Your Watch Library" fallbackDescription="Track your movies, TV shows, and anime series with granular season and episode progress.">
                    <div className="p-8 rounded-2xl bg-surface border border-surface-elevated text-center">
                      <p className="text-sm text-text-secondary">Your watch library is ready for titles (Phase 3 tracking engine).</p>
                    </div>
                  </AuthGuard>
                </div>
              )}

              {activeTab === 'read' && (
                <div data-testid="read-view" className="max-w-6xl mx-auto space-y-4">
                  <h2 className="text-2xl font-bold">Reading Library</h2>
                  <AuthGuard fallbackTitle="Sign In to Access Your Reading Library" fallbackDescription="Track your Manga and Manhwa with chapter and volume steppers.">
                    <div className="p-8 rounded-2xl bg-surface border border-surface-elevated text-center">
                      <p className="text-sm text-text-secondary">Your reading library is ready for titles (Phase 3 tracking engine).</p>
                    </div>
                  </AuthGuard>
                </div>
              )}

              {activeTab === 'history' && (
                <div data-testid="history-view" className="max-w-6xl mx-auto space-y-4">
                  <h2 className="text-2xl font-bold">History & Analytics</h2>
                  <AuthGuard fallbackTitle="Sign In to View Tracking History" fallbackDescription="Chronological log of watched episodes and read chapters.">
                    <div className="p-8 rounded-2xl bg-surface border border-surface-elevated text-center">
                      <p className="text-sm text-text-secondary">Watch and reading history timelines activate in Phase 4.</p>
                    </div>
                  </AuthGuard>
                </div>
              )}

              {activeTab === 'import' && (
                <div data-testid="import-view" className="max-w-6xl mx-auto space-y-4">
                  <h2 className="text-2xl font-bold">CSV Import & Export Engine</h2>
                  <AuthGuard fallbackTitle="Sign In to Import or Export Libraries" fallbackDescription="Letterboxd, IMDb, Trakt, and MAL import pipeline.">
                    <div className="p-8 rounded-2xl bg-surface border border-surface-elevated text-center">
                      <p className="text-sm text-text-secondary">Import & Export migration pipeline activates in Phase 5.</p>
                    </div>
                  </AuthGuard>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* 3. Mobile Bottom Navigation Bar */}
      <MobileBottomNav />

      {/* 4. Global Modals */}
      <OmnisearchModal onSelectTitle={handleSelectTitle} />
      <AuthModal />
      <ProfileModal />
    </div>
  );
};
