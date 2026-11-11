import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { ApiError } from '../api/types';
import type { MessageKey } from '../i18n/en';

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return <div role="status" aria-live="polite"><div className="spinner" /><span className="sr-only">{label ?? t('common.loading')}</span></div>;
}

export function Empty({ icon, children, action }: { icon: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="big" aria-hidden="true">{icon}</div>
      <div>{children}</div>
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function errorText(t: (k: MessageKey) => string, e: unknown): string {
  const code = e instanceof ApiError ? e.code : 'unknown';
  const key = `error.${code}` as MessageKey;
  return t(key) === key ? t('error.unknown') : t(key);
}

export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="alert error" role="alert" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
      <span>⚠️ {error instanceof ApiError && error.code !== 'unknown' ? errorText(t, error) : t('common.loadError')}</span>
      <button className="btn small danger" onClick={onRetry}>{t('common.retry')}</button>
    </div>
  );
}

export function ProgressRing({ value, size = 120, stroke = 12, color = 'url(#ringGrad)', track = '#efeaff', children, label }: {
  value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode; label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring-wrap" style={{ width: size, height: size }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8f78e8" /><stop offset="100%" stopColor="#f07aa6" />
          </linearGradient>
          <linearGradient id="ringMint" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7fdcb6" /><stop offset="100%" stopColor="#4c8fd9" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset 0.5s linear' }} />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

export function Bar({ value, tone, label }: { value: number; tone?: 'mint' | 'gold'; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={`bar ${tone ?? ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <span style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function Stat({ icon, value, label, tone }: { icon: string; value: ReactNode; label: string; tone: 'purple' | 'pink' | 'mint' | 'blue' | 'gold' }) {
  return (
    <div className={`stat c-${tone}`}>
      <div className="ico" aria-hidden="true">{icon}</div>
      <div className="val">{value}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

/** Accessible dialog: focus moves in, Escape closes, focus returns on close. */
export function Modal({ title, onClose, children, labelledBy }: { title?: string; onClose: () => void; children: ReactNode; labelledBy?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button');
    first?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} aria-labelledby={labelledBy} ref={ref}>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

const COLORS = ['#b9a7f0', '#ffc7dc', '#a8e6cf', '#a9cdf5', '#ffd56b', '#f07aa6', '#8f78e8'];
export function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 60 }, (_, i) => (
        <i key={i} style={{
          left: `${(i * 37) % 100}%`, background: COLORS[i % COLORS.length],
          animationDelay: `${(i % 12) * 0.08}s`, animationDuration: `${1.8 + (i % 5) * 0.25}s`,
          transform: `rotate(${i * 23}deg)`,
        }} />
      ))}
    </div>
  );
}
