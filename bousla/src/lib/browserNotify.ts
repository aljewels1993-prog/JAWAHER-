/** Browser/system notifications with graceful fallback (the app always shows in-app reminders too). */
export type NotifySupport = 'granted' | 'denied' | 'default' | 'unsupported';

export function notifySupport(): NotifySupport {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotifySupport;
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export async function requestNotifyPermission(): Promise<NotifySupport> {
  if (notifySupport() === 'unsupported') return 'unsupported';
  try {
    return (await Notification.requestPermission()) as NotifySupport;
  } catch {
    return notifySupport();
  }
}

/** Shows a system notification if allowed. Returns false when it could not. */
export async function showSystemNotification(title: string, body: string, url = '/', tag?: string): Promise<boolean> {
  if (notifySupport() !== 'granted') return false;
  const options: NotificationOptions = { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag, data: { url } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(title, options); return true; }
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
