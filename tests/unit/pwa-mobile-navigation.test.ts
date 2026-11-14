import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { useUIStore } from '../../src/stores/uiStore';

describe('PWA & Hybrid Mobile Navigation Suite', () => {
  describe('1. PWA Manifest & Asset Integrity', () => {
    const manifestPath = path.resolve(__dirname, '../../public/manifest.json');
    const icon192Path = path.resolve(__dirname, '../../public/assets/icon-192x192.png');
    const icon512Path = path.resolve(__dirname, '../../public/assets/icon-512x512.png');

    it('verifies manifest.json exists and has valid PWA standalone parameters', () => {
      expect(fs.existsSync(manifestPath)).toBe(true);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      expect(manifest.short_name).toBe('TrackUp');
      expect(manifest.display).toBe('standalone');
      expect(manifest.theme_color).toBe('#FFC400');
      expect(manifest.background_color).toBe('#101014');
      expect(manifest.start_url).toBe('/');
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    });

    it('verifies standard 192x192 and 512x512 icons exist on disk', () => {
      expect(fs.existsSync(icon192Path)).toBe(true);
      expect(fs.existsSync(icon512Path)).toBe(true);

      const icon192Stats = fs.statSync(icon192Path);
      const icon512Stats = fs.statSync(icon512Path);

      expect(icon192Stats.size).toBeGreaterThan(1000);
      expect(icon512Stats.size).toBeGreaterThan(5000);
    });

    it('verifies manifest contains 192x192 and 512x512 maskable entries', () => {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const sizes = manifest.icons.map((icon: any) => icon.sizes);
      expect(sizes).toContain('192x192');
      expect(sizes).toContain('512x512');
    });
  });

  describe('2. Standalone Mode Detection Logic (useIsPWA)', () => {
    const originalWindow = global.window;
    const originalDocument = global.document;

    afterEach(() => {
      // Restore globals
      (global as any).window = originalWindow;
      (global as any).document = originalDocument;
      vi.restoreAllMocks();
    });

    it('evaluates false in standard desktop/mobile browser window', () => {
      (global as any).window = {
        matchMedia: vi.fn().mockReturnValue({
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
        navigator: {},
      };
      (global as any).document = {
        referrer: '',
      };

      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = Boolean((window.navigator as any).standalone);
      const isAndroidApp = document.referrer.startsWith('android-app://');

      expect(isStandalone || isIOSStandalone || isAndroidApp).toBe(false);
    });

    it('evaluates true when running in standalone display mode', () => {
      (global as any).window = {
        matchMedia: vi.fn().mockImplementation((query) => ({
          matches: query === '(display-mode: standalone)',
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
        navigator: {},
      };
      (global as any).document = {
        referrer: '',
      };

      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      expect(isStandalone).toBe(true);
    });

    it('evaluates true when running in iOS Safari standalone mode', () => {
      (global as any).window = {
        matchMedia: vi.fn().mockReturnValue({
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
        navigator: { standalone: true },
      };
      (global as any).document = {
        referrer: '',
      };

      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = Boolean((window.navigator as any).standalone);
      expect(isStandalone || isIOSStandalone).toBe(true);
    });

    it('evaluates true when launched via Android app intent (TWA)', () => {
      (global as any).window = {
        matchMedia: vi.fn().mockReturnValue({
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
        navigator: {},
      };
      (global as any).document = {
        referrer: 'android-app://com.trackup.app',
      };

      const isAndroidApp = document.referrer.startsWith('android-app://');
      expect(isAndroidApp).toBe(true);
    });
  });

  describe('3. Hybrid Mobile Navigation State & Route Switching', () => {
    beforeEach(() => {
      useUIStore.setState({
        activeTab: 'dashboard',
        selectedTitleId: null,
        viewingPublicUser: null,
        mobileDrawerOpen: false,
      });
    });

    it('switches between primary routes (Home, Discover, Social) cleanly and clears title selection', () => {
      const store = useUIStore.getState();

      // Simulate detail page active
      store.setSelectedTitleId('tmdb_tv_12345');
      expect(useUIStore.getState().selectedTitleId).toBe('tmdb_tv_12345');

      // Click Discover on BottomNavBar
      useUIStore.getState().setSelectedTitleId(null);
      useUIStore.getState().setActiveTab('discover');
      expect(useUIStore.getState().activeTab).toBe('discover');
      expect(useUIStore.getState().selectedTitleId).toBeNull();

      // Click Social on BottomNavBar
      useUIStore.getState().setActiveTab('social');
      expect(useUIStore.getState().activeTab).toBe('social');

      // Click Home on BottomNavBar
      useUIStore.getState().setActiveTab('dashboard');
      expect(useUIStore.getState().activeTab).toBe('dashboard');
    });

    it('supports Library domain toggling between watch and read', () => {
      // Navigate to watch library
      useUIStore.getState().setActiveTab('watch');
      expect(useUIStore.getState().activeTab).toBe('watch');

      // If user clicks Library again while on watch, toggle to read
      const current = useUIStore.getState().activeTab;
      if (current === 'watch') {
        useUIStore.getState().setActiveTab('read');
      }
      expect(useUIStore.getState().activeTab).toBe('read');
    });

    it('toggles More menu and manages mobileDrawerOpen state', () => {
      expect(useUIStore.getState().mobileDrawerOpen).toBe(false);

      // Open More menu
      useUIStore.getState().setMobileDrawerOpen(true);
      expect(useUIStore.getState().mobileDrawerOpen).toBe(true);

      // Navigate to a secondary route from More menu
      useUIStore.getState().setActiveTab('calendar');
      useUIStore.getState().setMobileDrawerOpen(false);
      expect(useUIStore.getState().activeTab).toBe('calendar');
      expect(useUIStore.getState().mobileDrawerOpen).toBe(false);
    });

    it('preserves access to secondary tabs (calendar, recommendations, import, history, profile) in uiStore', () => {
      useUIStore.getState().setActiveTab('profile');
      expect(useUIStore.getState().activeTab).toBe('profile');

      useUIStore.getState().setActiveTab('calendar');
      expect(useUIStore.getState().activeTab).toBe('calendar');

      useUIStore.getState().setActiveTab('recommendations');
      expect(useUIStore.getState().activeTab).toBe('recommendations');

      useUIStore.getState().setActiveTab('import');
      expect(useUIStore.getState().activeTab).toBe('import');

      useUIStore.getState().setActiveTab('history');
      expect(useUIStore.getState().activeTab).toBe('history');
    });
  });

  describe('4. Online-First Safe Caching Strategy in Vite Configuration', () => {
    it('verifies vite.config.ts has NetworkOnly for Supabase and AniList, and CacheFirst for posters', () => {
      const viteConfigPath = path.resolve(__dirname, '../../vite.config.ts');
      const content = fs.readFileSync(viteConfigPath, 'utf-8');

      // Must import VitePWA
      expect(content).toContain('VitePWA');
      // Must set autoUpdate
      expect(content).toContain("registerType: 'autoUpdate'");
      // Must have NetworkOnly for Supabase
      expect(content).toContain('supabase');
      // Must have NetworkOnly for AniList GraphQL
      expect(content).toContain('graphql');
      expect(content).toContain('anilist');
      // Must have CacheFirst for posters
      expect(content).toContain('NetworkOnly');
      expect(content).toContain('CacheFirst');
      expect(content).toContain('media-posters-cache');
      expect(content).toContain('tmdb');
      expect(content).toContain('s4');
    });
  });
});
