'use client';

import { useEffect } from 'react';

export default function ServiceWorker() {
  useEffect(() => {
    // Desktop Electron already runs offline-local; a SW can cache stale UI and
    // interfere with input/focus. Keep SW for browser/PWA only.
    const isElectron = !!(window as any).mylab;
    if (isElectron) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister());
        });
      }
      return;
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  }, []);
  return null;
}
