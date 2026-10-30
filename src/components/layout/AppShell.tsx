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
import { FriendsPage } from '../../features/social/FriendsPage';
import { RecommendationsView } from '../../features/catalog/RecommendationsView';
import { ReleaseCalendarView } from '../../features/calendar/ReleaseCalendarView';
import { ProfilePage } from '../../features/profile/ProfilePage';
import { useUIStore } from '../../stores/uiStore';
import { useAuth } from '../../features/auth/AuthContext';
import {
  useUserLibrary,
  useIncrementEpisode,
  useIncrementChapter,
} from '../../features/library/useLibrary';
import {
  Plus,
  PlayCircle,
  Compass,
} from 'lucide-react';
import { formatRuntime } from '../../lib/dateUtils';

const EMPTY_LIBRARY: any[] = [];

export const AppShell: React.FC = () => {
  const { activeTab, setActiveTab, selectedTitleId, setSelectedTitleId } = useUIStore();
  const { user } = useAuth();
  const { data: userLibrary = EMPTY_LIBRARY } = useUserLibrary(user?.id);

  const incrementEpisode = useIncrementEpisode();
  const incrementChapter = useIncrementChapter();

  const handleSelectTitle = (id: string) => {
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({ titleId: id }, '', window.location.href);
    }
    setSelectedTitleId(id);
  };

  const handleBackFromDetail = () => {
    setSelectedTitleId(null);
    if (typeof window !== 'undefined' && window.history?.state?.titleId) {
      window.history.back();
    }
  };

  React.useEffect(() => {
    const handlePopState = () => {
      if (selectedTitleId) {
        setSelectedTitleId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedTitleId, setSelectedTitleId]);

  // Continue Watching / Currently Reading: Active media or where progress > 0
  const continueItems = userLibrary.filter((item) => {
    if (item.status === 'active') return true;
    if (item.episodes_watched && item.episodes_watched.length > 0) return true;
    if (item.last_chapter_read && item.last_chapter_read > 0) return true;
    return false;
  });

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
                  {/* Continue Watching / Currently Reading Section */}
                  <section
                    data-testid="continue-watching-section"
                    className="space-y-4"
                  >
                    <div data-testid="dashboard-up-next-section" className="space-y-4">
                      <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <PlayCircle className="w-6 h-6 text-accent" />
                        <h2 className="text-xl font-extrabold text-text-primary tracking-tight">
                          Continue Watching / Currently Reading
                        </h2>
                      </div>
                      {continueItems.length > 0 && (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30 font-mono">
                          {continueItems.length} In Progress
                        </span>
                      )}
                    </div>

                    {continueItems.length === 0 ? (
                      <div className="p-8 rounded-3xl bg-surface border border-surface-elevated text-center space-y-3 shadow-xl">
                        <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto text-accent">
                          <PlayCircle className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-text-primary">
                          No Active Media In Progress
                        </h3>
                        <p className="text-xs text-text-secondary max-w-md mx-auto">
                          Mark any movie, TV show, anime, manga, or manhwa as &quot;Watching&quot; or update your progress to resume right here on your dashboard.
                        </p>
                        <button
                          onClick={() => setActiveTab('discover')}
                          className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-background font-bold text-xs transition-all shadow inline-flex items-center gap-1.5"
                        >
                          <Compass className="w-4 h-4" />
                          <span>Explore Discover Catalog</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {continueItems.map((item) => {
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
                              className="p-3.5 rounded-2xl bg-surface border border-surface-elevated hover:border-accent/40 transition-all flex items-center gap-3.5 cursor-pointer group shadow hover:-translate-y-0.5"
                            >
                              <img
                                src={item.title.poster_url || '/assets/trackup-logo.jpg'}
                                alt={item.title.title}
                                loading="lazy"
                                decoding="async"
                                className="w-14 h-20 rounded-xl object-cover shrink-0 bg-[#16161D]"
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
                                    {isEpisodic && (item.status === 'completed' ? `${item.title.total_episodes || (item.title as any).episodes || item.episodes_watched.length || 1} eps` : `${item.episodes_watched.length} eps watched`)}
                                    {isReading && `Ch. ${item.last_chapter_read}`}
                                    {!isEpisodic && !isReading && (formatRuntime(item.title.runtime_minutes) || item.status)}
                                  </span>

                                  {/* Quick +1 Action */}
                                  {isEpisodic && user && (
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

                                  {isReading && user && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        incrementChapter.mutate({
                                          libraryId: item.id,
                                          userId: user.id,
                                          chapter: (item.last_chapter_read || 0) + 1,
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
                    )}
                    </div>
                  </section>

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
                <AuthGuard fallbackTitle="Sign In to Access Your Reading Library" fallbackDescription="Track your Manga and South Korean Manhwa with chapter reading steppers.">
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

              {activeTab === 'profile' && (
                <div data-testid="profile-view" className="max-w-6xl mx-auto space-y-4">
                  <AuthGuard fallbackTitle="Sign In to View Your Profile" fallbackDescription="View your tracking statistics, showcases, and profile details.">
                    <ProfilePage onSelectTitle={handleSelectTitle} />
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
                    <FriendsPage onSelectTitle={handleSelectTitle} />
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
