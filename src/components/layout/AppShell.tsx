import React from 'react';
import { DesktopSidebar } from './DesktopSidebar';
import { TopUtilityBar } from './TopUtilityBar';
import { OmnisearchModal } from './OmnisearchModal';
import { AuthModal } from '../../features/auth/AuthModal';
import { ProfileModal } from '../../features/auth/ProfileModal';
import { AuthGuard } from '../../features/auth/AuthGuard';
import { SearchPage } from '../../features/catalog/SearchPage';
import { TitleDetailPage } from '../../features/catalog/TitleDetailPage';
import { LibraryView } from '../../features/library/LibraryView';
import { DashboardStats } from '../../features/dashboard/DashboardStats';
import { HistoryTimeline } from '../../features/history/HistoryTimeline';
import { ImportExportView } from '../../features/import-export/ImportExportView';
import { SocialFeedView } from '../../features/social/SocialFeedView';
import { RecommendationsView } from '../../features/catalog/RecommendationsView';
import { ReleaseCalendarView } from '../../features/calendar/ReleaseCalendarView';
import { useUIStore } from '../../stores/uiStore';
import { useAuth } from '../../features/auth/AuthContext';
import {
  useUserLibrary,
  useIncrementEpisode,
  useIncrementChapter,
} from '../../features/library/useLibrary';
import {
  Sparkles,
  ArrowRight,
  Plus,
  PlayCircle,
} from 'lucide-react';

const EMPTY_LIBRARY: any[] = [];

export const AppShell: React.FC = () => {
  const { activeTab, setActiveTab, selectedTitleId, setSelectedTitleId } = useUIStore();
  const { user } = useAuth();
  const { data: userLibrary = EMPTY_LIBRARY } = useUserLibrary(user?.id);

  const incrementEpisode = useIncrementEpisode();
  const incrementChapter = useIncrementChapter();

  const handleSelectTitle = (id: string) => {
    setSelectedTitleId(id);
  };

  const handleBackFromDetail = () => {
    setSelectedTitleId(null);
  };

  // Up Next: Active titles in library
  const upNextItems = userLibrary.filter(
    (item) => item.status === 'active' || item.status === 'planned'
  );

  return (
    <div className="flex h-screen w-full bg-background text-text-primary overflow-hidden font-sans">
      {/* 1. Desktop Sidebar */}
      <DesktopSidebar />

      {/* 2. Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Utility Bar */}
        <TopUtilityBar />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 pb-8">
          {selectedTitleId ? (
            <TitleDetailPage
              titleId={selectedTitleId}
              onBack={handleBackFromDetail}
              onSelectTitle={handleSelectTitle}
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <div data-testid="dashboard-view" className="max-w-6xl mx-auto space-y-8">
                  {/* Hero Banner */}
                  <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-surface to-surface-elevated border border-surface-elevated p-6 md:p-10 shadow-2xl">
                    <div className="max-w-xl relative z-10">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-semibold mb-4">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Phase 7 Smart Recommendations & Airing Calendar Active</span>
                      </div>
                      <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-text-primary mb-3">
                        Track what you <span className="text-accent">love.</span>
                      </h1>
                      <p className="text-text-secondary text-sm md:text-base leading-relaxed mb-6">
                        Hosted entertainment and reading tracker for Movies, TV Shows, Anime Series, Anime Films, Manga, and Manhwa.
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={() => setActiveTab('discover')}
                          data-testid="hero-explore-button"
                          className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-background font-bold text-xs transition-all shadow-md inline-flex items-center gap-2"
                        >
                          <span>Explore Catalog</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setActiveTab('recommendations')}
                          data-testid="hero-recommendations-button"
                          className="px-4 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-elevated text-text-primary font-semibold text-xs transition-all inline-flex items-center gap-2"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-accent" />
                          <span>For You</span>
                        </button>
                        <button
                          onClick={() => setActiveTab('calendar')}
                          data-testid="hero-calendar-button"
                          className="px-4 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-elevated text-text-primary font-semibold text-xs transition-all inline-flex items-center gap-2"
                        >
                          <span>Airing Calendar</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Up Next & Continue Tracking Strip */}
                  {user && upNextItems.length > 0 && (
                    <section data-testid="dashboard-up-next-section" className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <PlayCircle className="w-5 h-5 text-accent" />
                          <h2 className="text-lg font-bold text-text-primary">
                            Continue Tracking (&quot;Up Next&quot;)
                          </h2>
                        </div>
                        <span className="text-xs text-text-muted">
                          {upNextItems.length} In Progress
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {upNextItems.map((item) => {
                          const isEpisodic =
                            item.title.media_type === 'tv' ||
                            item.title.media_type === 'anime_series';
                          const isReading =
                            item.title.media_type === 'manga' ||
                            item.title.media_type === 'manhwa';

                          return (
                            <div
                              key={item.id}
                              onClick={() => handleSelectTitle(item.title_id)}
                              data-testid={`up-next-card-${item.id}`}
                              className="p-3.5 rounded-2xl bg-surface border border-surface-elevated hover:border-accent/40 transition-all flex items-center gap-3.5 cursor-pointer group shadow"
                            >
                              <img
                                src={item.title.poster_url || '/assets/trackup-logo.jpg'}
                                alt={item.title.title}
                                className="w-14 h-20 rounded-xl object-cover shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-[10px] font-bold uppercase text-accent tracking-wider">
                                  {item.title.media_type.replace('_', ' ')}
                                </span>
                                <h3 className="text-sm font-bold text-text-primary truncate group-hover:text-accent transition-colors">
                                  {item.title.title}
                                </h3>

                                <div className="mt-2 flex items-center justify-between">
                                  <span className="font-mono text-xs font-semibold text-text-secondary">
                                    {isEpisodic && `${item.episodes_watched.length} eps watched`}
                                    {isReading && `Ch. ${item.last_chapter_read}`}
                                    {!isEpisodic && !isReading && item.status}
                                  </span>

                                  {/* Quick +1 Action */}
                                  {isEpisodic && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        incrementEpisode.mutate({
                                          libraryId: item.id,
                                          userId: user.id,
                                          episodeId: `ep_${item.episodes_watched.length + 1}`,
                                          watched: true,
                                        });
                                      }}
                                      data-testid={`up-next-plus-episode-${item.id}`}
                                      className="px-2.5 py-1 rounded-lg bg-accent text-background font-bold text-xs flex items-center gap-1 hover:bg-accent-hover transition-colors shadow"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>+1 Ep</span>
                                    </button>
                                  )}
                                  {isReading && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        incrementChapter.mutate({
                                          libraryId: item.id,
                                          userId: user.id,
                                          chapter: item.last_chapter_read + 1,
                                        });
                                      }}
                                      data-testid={`up-next-plus-chapter-${item.id}`}
                                      className="px-2.5 py-1 rounded-lg bg-accent text-background font-bold text-xs flex items-center gap-1 hover:bg-accent-hover transition-colors shadow"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>+1 Ch</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Dashboard Statistics & Analytics Overview */}
                  <DashboardStats userLibrary={userLibrary} />
                </div>
              )}

              {activeTab === 'discover' && (
                <SearchPage onSelectTitle={handleSelectTitle} />
              )}

              {activeTab === 'watch' && (
                <AuthGuard fallbackTitle="Sign In to Access Your Watch Library" fallbackDescription="Track your movies, TV shows, and anime series with granular season and episode progress.">
                  <LibraryView domain="watch" onSelectTitle={handleSelectTitle} />
                </AuthGuard>
              )}

              {activeTab === 'read' && (
                <AuthGuard fallbackTitle="Sign In to Access Your Reading Library" fallbackDescription="Track your Manga and South Korean Manhwa with chapter and volume steppers.">
                  <LibraryView domain="read" onSelectTitle={handleSelectTitle} />
                </AuthGuard>
              )}

              {activeTab === 'calendar' && (
                <ReleaseCalendarView onSelectTitle={handleSelectTitle} />
              )}

              {activeTab === 'recommendations' && (
                <RecommendationsView onSelectTitle={handleSelectTitle} />
              )}

              {activeTab === 'history' && (
                <div data-testid="history-view" className="max-w-6xl mx-auto space-y-4">
                  <AuthGuard fallbackTitle="Sign In to View Tracking History" fallbackDescription="Chronological log of watched episodes and read chapters.">
                    <HistoryTimeline userId={user?.id} onSelectTitle={handleSelectTitle} />
                  </AuthGuard>
                </div>
              )}

              {activeTab === 'import' && (
                <div data-testid="import-view" className="max-w-6xl mx-auto space-y-4">
                  <AuthGuard fallbackTitle="Sign In to Import or Export Libraries" fallbackDescription="Letterboxd, IMDb, Trakt, and MAL import pipeline.">
                    <ImportExportView />
                  </AuthGuard>
                </div>
              )}

              {activeTab === 'social' && (
                <div data-testid="social-view" className="max-w-6xl mx-auto space-y-4">
                  <AuthGuard fallbackTitle="Sign In to Join the Community" fallbackDescription="Follow friends, share tracking activity, and compare ratings.">
                    <SocialFeedView onSelectTitle={handleSelectTitle} />
                  </AuthGuard>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Global Modals */}
      <OmnisearchModal onSelectTitle={handleSelectTitle} />
      <AuthModal />
      <ProfileModal onSelectTitle={handleSelectTitle} />
    </div>
  );
};
