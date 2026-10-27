import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  Copy,
  Layers,
  RefreshCw,
  Film,
  Sparkles,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import type { ImportPipelineStep, PlatformPreset, StagedImportItem } from './types';
import {
  parseCsvFile,
  stageAndResolveRows,
  commitImportBatch,
  exportUserLibraryToCsv,
  downloadCsvFile,
  clearUserLibrary,
  clearImportedDummyTitles,
} from './importService';
import { useAuth } from '../auth/AuthContext';
import { useUserLibrary } from '../library/useLibrary';
import { useQueryClient } from '@tanstack/react-query';

export const ImportExportView: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const activeUserId = user?.id || 'local_tracker';
  const { data: userLibrary = [] } = useUserLibrary(activeUserId);

  const [step, setStep] = useState<ImportPipelineStep>('idle');
  const [platform, setPlatform] = useState<PlatformPreset>('generic');
  const [fileName, setFileName] = useState<string>('');
  const [stagedItems, setStagedItems] = useState<StagedImportItem[]>([]);
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip' | 'fill' | 'merge' | 'overwrite'>('fill');
  const [dragActive, setDragActive] = useState(false);
  const [importResult, setImportResult] = useState<{ committed: number; skipped: number } | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const dummyCount = userLibrary.filter(
    (item) => item.title_id.startsWith('imported_') || item.title_id.startsWith('generic_')
  ).length;

  const handleClearLibrary = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to clear your library? This will delete all tracked and imported titles so you can re-import cleanly.'
    );
    if (!confirmed) return;

    setClearing(true);
    const count = await clearUserLibrary(activeUserId);
    queryClient.invalidateQueries({ queryKey: ['library', activeUserId] });
    queryClient.invalidateQueries({ queryKey: ['user_library', activeUserId] });
    setStagedItems([]);
    setStep('idle');
    setClearMessage(`Successfully cleared ${count} titles from your library.`);
    setClearing(false);
  };

  const handleClearDummyRecords = async () => {
    setClearing(true);
    const count = await clearImportedDummyTitles(activeUserId);
    queryClient.invalidateQueries({ queryKey: ['library', activeUserId] });
    queryClient.invalidateQueries({ queryKey: ['user_library', activeUserId] });
    setClearMessage(`Removed ${count} unverified dummy titles from your library.`);
    setClearing(false);
  };

  const handleProcessCsvString = async (csvText: string, name: string) => {
    setFileName(name);
    setClearMessage(null);
    setStep('uploading');

    setTimeout(async () => {
      try {
        setStep('parsing');
        const { preset, rows } = await parseCsvFile(csvText, name);
        setPlatform(preset);

        setStep('resolving');
        const staged = await stageAndResolveRows(rows, userLibrary);
        setStagedItems(staged);

        setStep('preview');
      } catch (err: any) {
        alert(err.message || 'Failed to parse CSV');
        setStep('idle');
      }
    }, 400);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        handleProcessCsvString(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        handleProcessCsvString(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleCommit = async () => {
    setStep('importing');
    const result = await commitImportBatch({
      userId: activeUserId,
      items: stagedItems,
      duplicatePolicy,
    });
    setImportResult(result);
    // Invalidate react query cache
    queryClient.invalidateQueries({ queryKey: ['library', activeUserId] });
    queryClient.invalidateQueries({ queryKey: ['user_library', activeUserId] });
    setStep('complete');
  };

  const handleCancel = () => {
    setStagedItems([]);
    setStep('idle');
    setImportResult(null);
  };

  const handleExport = () => {
    const csv = exportUserLibraryToCsv(userLibrary);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCsvFile(csv, `trackup_library_export_${dateStr}.csv`);
  };

  // Sample CSV Presets for 1-Click Verification
  const sampleLetterboxd = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2024-03-01,Inception,2010,https://boxd.it/1s2k,4.5,No,Sci-Fi,2024-03-01
2024-03-05,Interstellar,2014,https://boxd.it/3Wk,5.0,No,Sci-Fi,2024-03-05`;

  const sampleMAL = `series_title,series_type,series_episodes,my_watched_episodes,my_score,my_status
Frieren: Beyond Journey's End,TV,28,28,10,2
Solo Leveling,Manhwa,179,120,9,1`;

  const sampleBinger = `Show,Year,Type,Binge Status,Episodes Seen,Rating
Breaking Bad,2008,TV,Completed,62,10
Yellowstone,2018,TV,Watching,25,9`;

  const matchedCount = stagedItems.filter((i) => i.status === 'exact_match').length;
  const duplicateCount = stagedItems.filter((i) => i.status === 'duplicate_in_library').length;
  const ambiguousCount = stagedItems.filter((i) => i.status === 'ambiguous_match').length;
  const unmatchedCount = stagedItems.filter((i) => i.status === 'unmatched').length;

  return (
    <div data-testid="import-export-engine" className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Engine Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-surface-elevated">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-semibold mb-2">
            <Layers className="w-3.5 h-3.5" />
            <span>Resilient 7-Step Import Pipeline</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Library Import & Export Engine
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Migrate seamlessly from Letterboxd, IMDb, Trakt, or MyAnimeList without duplicate records.
          </p>
        </div>

        {/* Action Buttons: Clear Library & Download Export */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleClearLibrary}
            data-testid="clear-library-button"
            disabled={clearing || userLibrary.length === 0}
            className="px-3.5 py-2.5 rounded-xl bg-status-dropped/10 hover:bg-status-dropped/20 border border-status-dropped/30 text-xs font-bold text-status-dropped flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            <span>{clearing ? 'Clearing...' : 'Clear Library'}</span>
          </button>

          <button
            onClick={handleExport}
            data-testid="export-library-button"
            className="px-4 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-elevated text-xs font-bold text-accent flex items-center gap-2 transition-all shadow-md shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Download Library Data (.csv)</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner for Clear Operation */}
      {clearMessage && (
        <div
          data-testid="clear-success-banner"
          className="p-3.5 rounded-xl bg-status-completed/15 border border-status-completed/30 text-xs font-semibold text-status-completed flex items-center justify-between animate-in fade-in"
        >
          <span>{clearMessage}</span>
          <button
            onClick={() => setClearMessage(null)}
            className="text-text-muted hover:text-text-primary px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Legacy Dummy / Unverified Records Cleanup Alert */}
      {dummyCount > 0 && (
        <div
          data-testid="dummy-cleanup-banner"
          className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs font-bold text-text-primary">
                Found {dummyCount} Unverified Legacy Records
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">
                These titles lack verified TMDB/AniList metadata and cause broken posters. Wipe them before re-importing.
              </p>
            </div>
          </div>
          <button
            onClick={handleClearDummyRecords}
            data-testid="cleanup-dummy-button"
            disabled={clearing}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-background font-bold text-xs hover:bg-amber-400 transition-all shrink-0"
          >
            {clearing ? 'Cleaning...' : `Wipe ${dummyCount} Broken Titles`}
          </button>
        </div>
      )}

      {/* Progress Stepper */}
      {step !== 'idle' && (
        <div data-testid="import-progress-stepper" className="p-4 rounded-2xl bg-surface border border-surface-elevated">
          <div className="flex items-center justify-between text-xs font-semibold">
            {[
              { id: 'uploading', label: '1. Uploading' },
              { id: 'parsing', label: '2. Parsing' },
              { id: 'resolving', label: '3. Resolving' },
              { id: 'preview', label: '4. Review' },
              { id: 'complete', label: '5. Complete' },
            ].map((s, idx) => {
              const isActive = step === s.id;
              const isPast =
                (s.id === 'uploading' && step !== 'uploading') ||
                (s.id === 'parsing' && !['uploading', 'parsing'].includes(step)) ||
                (s.id === 'resolving' && ['preview', 'importing', 'complete'].includes(step)) ||
                (s.id === 'preview' && ['importing', 'complete'].includes(step)) ||
                (s.id === 'complete' && step === 'complete');

              return (
                <div key={s.id} className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isPast
                        ? 'bg-status-completed text-background'
                        : isActive
                        ? 'bg-accent text-background animate-pulse'
                        : 'bg-surface-elevated text-text-muted'
                    }`}
                  >
                    {isPast ? '✓' : idx + 1}
                  </div>
                  <span
                    className={`hidden sm:inline ${
                      isActive ? 'text-accent font-bold' : isPast ? 'text-text-primary' : 'text-text-muted'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP: Idle Upload State */}
      {step === 'idle' && (
        <div className="space-y-6">
          {/* Drag & Drop Zone */}
          <div
            data-testid="csv-dropzone"
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`p-10 sm:p-14 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
              dragActive
                ? 'border-accent bg-accent/10 scale-[1.01]'
                : 'border-surface-elevated bg-surface hover:border-accent/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              data-testid="csv-file-input"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div className="w-16 h-16 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent mb-4">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-text-primary">
              Drag & Drop your CSV export here, or browse files
            </h3>
            <p className="text-xs text-text-muted mt-1 max-w-md">
              Supports official exports from Letterboxd (.csv), IMDb (.csv), Trakt (.csv), and MyAnimeList (.csv). Max 5,000 rows.
            </p>

            <button
              type="button"
              className="mt-6 px-4 py-2 rounded-xl bg-accent text-background text-xs font-bold shadow hover:bg-accent-hover transition-colors"
            >
              Choose File
            </button>
          </div>

          {/* Preset Sample Buttons for Quick Testing */}
          <div className="p-5 rounded-2xl bg-surface border border-surface-elevated space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                Quick Test with Sample Formats
              </h4>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => handleProcessCsvString(sampleLetterboxd, 'letterboxd_sample_diary.csv')}
                data-testid="sample-letterboxd-button"
                className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-accent/15 border border-surface-elevated hover:border-accent text-xs font-semibold text-text-primary transition-all flex items-center gap-1.5"
              >
                <Film className="w-3.5 h-3.5 text-accent" />
                <span>Test Letterboxd CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleProcessCsvString(sampleMAL, 'mal_sample_export.csv')}
                data-testid="sample-mal-button"
                className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-accent/15 border border-surface-elevated hover:border-accent text-xs font-semibold text-text-primary transition-all flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-accent" />
                <span>Test MyAnimeList CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleProcessCsvString(sampleBinger, 'binger_app_export.csv')}
                data-testid="sample-binger-button"
                className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-accent/15 border border-surface-elevated hover:border-accent text-xs font-semibold text-text-primary transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span>Test Binger App CSV</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP: Preview & Resolution State */}
      {step === 'preview' && (
        <div data-testid="import-preview-section" className="space-y-6">
          {/* Summary Banner */}
          <div className="p-6 rounded-2xl bg-surface border border-surface-elevated flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md text-xs font-extrabold uppercase bg-accent text-background">
                  {platform}
                </span>
                <span className="text-xs font-mono text-text-muted">{fileName}</span>
              </div>
              <h2 className="text-xl font-bold text-text-primary mt-1">
                {stagedItems.length} Records Analyzed & Staged
              </h2>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleCancel}
                data-testid="cancel-import-button"
                className="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCommit}
                data-testid="commit-import-button"
                className="px-5 py-2.5 rounded-xl bg-accent text-background font-bold text-xs hover:bg-accent-hover transition-all shadow-md flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Commit Import ({matchedCount} Ready)</span>
              </button>
            </div>
          </div>

          {/* 4 Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-xl bg-surface border border-surface-elevated flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-status-completed" />
              <div>
                <p className="text-[11px] text-text-muted font-semibold uppercase">Matched & Ready</p>
                <p className="text-xl font-bold text-text-primary font-mono">{matchedCount}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-surface-elevated flex items-center gap-3">
              <Copy className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-[11px] text-text-muted font-semibold uppercase">Already in Library</p>
                <p className="text-xl font-bold text-text-primary font-mono">{duplicateCount}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-surface-elevated flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-indigo-400" />
              <div>
                <p className="text-[11px] text-text-muted font-semibold uppercase">Needs Review</p>
                <p className="text-xl font-bold text-text-primary font-mono">{ambiguousCount}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-surface-elevated flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-text-muted" />
              <div>
                <p className="text-[11px] text-text-muted font-semibold uppercase">Unmatched</p>
                <p className="text-xl font-bold text-text-primary font-mono">{unmatchedCount}</p>
              </div>
            </div>
          </div>

          {/* Duplicate Handling Policy Selector */}
          <div className="p-4 rounded-xl bg-surface-elevated/60 border border-surface-elevated flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-text-primary">Duplicate Handling Policy</p>
              <p className="text-[11px] text-text-muted">
                Controls what happens when an imported title already exists in your library.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {(['skip', 'fill', 'merge', 'overwrite'] as const).map((pol) => (
                <button
                  key={pol}
                  onClick={() => setDuplicatePolicy(pol)}
                  data-testid={`duplicate-policy-${pol}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    duplicatePolicy === pol
                      ? 'bg-accent text-background shadow'
                      : 'bg-surface text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {pol === 'skip' && 'Skip Existing'}
                  {pol === 'fill' && 'Fill Missing'}
                  {pol === 'merge' && 'Merge Progress'}
                  {pol === 'overwrite' && 'Overwrite'}
                </button>
              ))}
            </div>
          </div>

          {/* Staged Items List */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary px-1">
              Staged Records Preview
            </h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {stagedItems.map((item) => (
                <div
                  key={item.id}
                  data-testid={`staged-item-${item.row.index}`}
                  className="p-3.5 rounded-xl bg-surface border border-surface-elevated flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-text-primary truncate">
                          {item.row.rawTitle}
                        </span>
                        {item.row.year && (
                          <span className="text-xs text-text-muted font-mono">
                            ({item.row.year})
                          </span>
                        )}
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-surface-elevated text-text-muted">
                          {item.row.mediaType.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                        <span className="font-semibold text-accent capitalize">{item.row.status}</span>
                        {item.row.rating && <span>• {item.row.rating}/10 pts</span>}
                        {item.row.episodesWatched && <span>• {item.row.episodesWatched} eps</span>}
                        {item.row.chaptersRead && <span>• Ch. {item.row.chaptersRead}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Resolution Badge */}
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize shrink-0 ${
                      item.status === 'exact_match'
                        ? 'bg-status-completed/15 text-status-completed border border-status-completed/30'
                        : item.status === 'duplicate_in_library'
                        ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                        : item.status === 'ambiguous_match'
                        ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                        : 'bg-status-dropped/15 text-status-dropped border border-status-dropped/30'
                    }`}
                  >
                    {item.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP: Complete State */}
      {step === 'complete' && importResult && (
        <div data-testid="import-complete-section" className="p-8 rounded-3xl bg-surface border border-surface-elevated text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-status-completed/20 border border-status-completed/40 flex items-center justify-center text-status-completed mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-text-primary">
            Import Completed Successfully!
          </h2>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            Added <strong className="text-accent">{importResult.committed}</strong> titles to your personal library ({importResult.skipped} skipped per duplicate policy).
          </p>

          <div className="pt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setStep('idle');
                setStagedItems([]);
              }}
              data-testid="import-another-button"
              className="px-5 py-2.5 rounded-xl bg-accent text-background font-bold text-xs hover:bg-accent-hover transition-all shadow"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
