import { useEffect } from 'react';

// Adds body classes to reflect current orientation and coarse device type
// - body.orientation-portrait | body.orientation-landscape
// - body.device-phone | body.device-tablet | body.device-desktop
export function useOrientation() {
  useEffect(() => {
    const update = () => {
      const isLandscape = window.matchMedia('(orientation: landscape)').matches;
      document.body.classList.toggle('orientation-landscape', isLandscape);
      document.body.classList.toggle('orientation-portrait', !isLandscape);

      const w = window.innerWidth;
      const h = window.innerHeight;
      const min = Math.min(w, h);
      const max = Math.max(w, h);

      const isPhone = min < 641; // < sm
      const isTablet = min >= 641 && max <= 1024;

      document.body.classList.toggle('device-phone', isPhone);
      document.body.classList.toggle('device-tablet', !isPhone && isTablet);
      document.body.classList.toggle('device-desktop', !isPhone && !isTablet);
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update as any);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update as any);
    };
  }, []);
}
