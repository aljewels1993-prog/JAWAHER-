import { useState } from 'react';
import { useI18n } from '../i18n';

export interface BarDatum { key: string; label: string; value: number; valueLabel: string; highlight?: boolean }

/**
 * Single-series column chart (one hue, rounded data-end anchored to the
 * baseline, recessive grid, hover/focus tooltip, table for screen readers).
 */
export function BarChart({ data: input, title, unitLabel }: { data: BarDatum[]; title: string; unitLabel: string }) {
  const { dir } = useI18n();
  // Time reads right-to-left in Arabic.
  const data = dir === 'rtl' ? [...input].reverse() : input;
  const [active, setActive] = useState<string | null>(null);
  const W = 400;
  const H = 220;
  const pad = { top: 26, bottom: 32, side: 6 };
  const max = Math.max(30, ...data.map((d) => d.value));
  const nice = Math.ceil(max / 30) * 30;
  const plotH = H - pad.top - pad.bottom;
  const slot = (W - pad.side * 2) / data.length;
  const barW = Math.min(46, slot * 0.58);
  const y = (v: number) => pad.top + plotH - (v / nice) * plotH;
  const peak = data.reduce((m, d) => (d.value > m.value ? d : m), data[0]);
  const ticks = [0, nice / 2, nice];

  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={pad.side} x2={W - pad.side} y1={y(tk)} y2={y(tk)} stroke="#e4e8ef" strokeWidth={1} strokeDasharray={tk ? '4 4' : undefined} />
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.side + slot * i + slot / 2;
          const h = Math.max(0, y(0) - y(d.value));
          const r = Math.min(4, h);
          const x0 = cx - barW / 2;
          const top = y(d.value);
          const path = h > 0
            ? `M ${x0} ${y(0)} L ${x0} ${top + r} Q ${x0} ${top} ${x0 + r} ${top} L ${x0 + barW - r} ${top} Q ${x0 + barW} ${top} ${x0 + barW} ${top + r} L ${x0 + barW} ${y(0)} Z`
            : '';
          const showLabel = active === d.key || (d === peak && d.value > 0 && !active);
          return (
            <g key={d.key}>
              {/* hit target larger than the mark */}
              <rect x={cx - slot / 2} y={pad.top} width={slot} height={plotH + 4} fill="transparent" tabIndex={0}
                onMouseEnter={() => setActive(d.key)} onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(d.key)} onBlur={() => setActive(null)} aria-label={`${d.label}: ${d.valueLabel}`} />
              {active === d.key && <rect x={cx - slot / 2 + 3} y={pad.top - 6} width={slot - 6} height={plotH + 10} rx={10} fill="#e9eff6" pointerEvents="none" />}
              {path && <path className="bar-rect" d={path} fill="#2f6aa8" pointerEvents="none" />}
              {h === 0 && <rect x={x0} y={y(0) - 2} width={barW} height={2} rx={1} fill="#c9d4e2" pointerEvents="none" />}
              {showLabel && (
                <text x={cx} y={top - 8} textAnchor="middle" fontSize={14} style={{ fill: 'var(--navy)' }} pointerEvents="none">{d.valueLabel}</text>
              )}
              <text x={cx} y={H - 10} textAnchor="middle" fontSize={14} style={{ fill: d.highlight ? 'var(--purple-deep)' : 'var(--ink-2)', fontWeight: d.highlight ? 800 : 700 }} pointerEvents="none">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 700, textAlign: 'center' }}>{unitLabel}</figcaption>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>{data.map((d) => <tr key={d.key}><th scope="row">{d.label}</th><td>{d.valueLabel}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
