/**
 * Only keys meant for browsers may be used by the app: the publishable key
 * (sb_publishable_…) or the legacy anon JWT. A secret key (sb_secret_…) or a
 * service_role JWT bypasses Row Level Security, so the app refuses to start
 * with one even if it is put in the settings by mistake.
 */
export function isBrowserSafeKey(key: string): boolean {
  const k = key.trim();
  if (k.startsWith('sb_publishable_')) return true;
  if (k.startsWith('sb_secret_')) return false;
  const parts = k.split('.');
  if (parts.length === 3) {
    try {
      const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json).role === 'anon';
    } catch {
      return false;
    }
  }
  return false;
}
