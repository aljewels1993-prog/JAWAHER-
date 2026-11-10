import { create } from 'zustand';

/**
 * "Install the game" support. Android/Chrome/Edge fire `beforeinstallprompt`,
 * which we keep so our own Install button can open the system dialog.
 * iPhone/iPad Safari has no such event: there we show the steps
 * (Share → Add to Home Screen).
 */
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && typeof document !== 'undefined' && 'ontouchend' in document);
const standalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: fullscreen)').matches || window.navigator.standalone === true);

export const useInstall = create((set, get) => ({
  prompt: null,
  installed: standalone(),
  isIOS,
  // Inside a sandboxed preview (e.g. an embedded frame) installing is impossible.
  supported: typeof window !== 'undefined' && window.self === window.top && 'serviceWorker' in navigator,
  showHelp: false,
  async install() {
    const p = get().prompt;
    if (p) {
      p.prompt();
      const choice = await p.userChoice.catch(() => null);
      set({ prompt: null, installed: choice?.outcome === 'accepted' || get().installed });
    } else set({ showHelp: true });
  },
  closeHelp() { set({ showHelp: false }); },
}));

/** Register the offline service worker and listen for install events. */
export function setupInstall() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); useInstall.setState({ prompt: e }); });
  window.addEventListener('appinstalled', () => useInstall.setState({ installed: true, prompt: null }));
  if (import.meta.env.PROD && 'serviceWorker' in navigator && window.self === window.top && location.protocol !== 'file:') {
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
  }
}
