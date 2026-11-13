import { useState, useEffect } from 'react';

/**
 * Hook to detect whether TrackUp is running in standalone PWA mode
 * (installed to home screen or desktop application window).
 * 
 * Note: Per architecture specifications, responsive layouts MUST rely on
 * standard viewport media queries, not PWA standalone status.
 */
export function useIsPWA(): boolean {
  const [isPWA, setIsPWA] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    
    // Check standard standalone display mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    // Check iOS standalone mode
    const isIOSStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    // Check Android TWA / app launch referrer
    const isAndroidApp = typeof document !== 'undefined' && document.referrer.startsWith('android-app://');

    return Boolean(isStandalone || isIOSStandalone || isAndroidApp);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e: MediaQueryListEvent) => {
      const isIOSStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      const isAndroidApp = typeof document !== 'undefined' && document.referrer.startsWith('android-app://');
      setIsPWA(Boolean(e.matches || isIOSStandalone || isAndroidApp));
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return isPWA;
}

export default useIsPWA;
