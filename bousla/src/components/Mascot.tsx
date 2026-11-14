import mascotUrl from '../assets/mascot.webp';

export type Mood = 'idle' | 'joy' | 'star' | 'love' | 'wink' | 'focus' | 'sleepy';

/* Face geometry measured on mascot.png (389 × 600 px). */
const NAVY = '#0b2f53';
const L = { x: 140, y: 261 };
const R = { x: 256, y: 260 };
const MOUTH = { x: 199, y: 318 };

const coverEye = (e: { x: number; y: number }) => <ellipse cx={e.x} cy={e.y} rx={41} ry={44} fill={NAVY} />;
const happyEye = (e: { x: number; y: number }) => (
  <path d={`M ${e.x - 26} ${e.y + 8} Q ${e.x} ${e.y - 26} ${e.x + 26} ${e.y + 8}`} stroke="#fff" strokeWidth={11} strokeLinecap="round" fill="none" />
);
const star = (e: { x: number; y: number }, r = 30) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    return `${e.x + rr * Math.cos(a)},${e.y + rr * Math.sin(a)}`;
  }).join(' ');
  return <polygon points={pts} fill="#ffd34d" stroke="#fff" strokeWidth={4} strokeLinejoin="round" />;
};
const heart = (e: { x: number; y: number }) => (
  <path transform={`translate(${e.x - 28} ${e.y - 26}) scale(1.75)`} d="M16 29 C 6 21 0 15 0 8.5 A 8 8 0 0 1 16 5 A 8 8 0 0 1 32 8.5 C 32 15 26 21 16 29 Z" fill="#ff7aa8" stroke="#fff" strokeWidth={2.2} />
);
const coverMouth = <ellipse cx={MOUTH.x} cy={MOUTH.y} rx={44} ry={21} fill={NAVY} />;
const openSmile = (
  <g>
    <path d={`M ${MOUTH.x - 32} ${MOUTH.y - 10} Q ${MOUTH.x} ${MOUTH.y + 40} ${MOUTH.x + 32} ${MOUTH.y - 10} Z`} fill="#fff" />
    <path d={`M ${MOUTH.x - 16} ${MOUTH.y + 10} Q ${MOUTH.x} ${MOUTH.y + 26} ${MOUTH.x + 16} ${MOUTH.y + 10} Q ${MOUTH.x} ${MOUTH.y + 2} ${MOUTH.x - 16} ${MOUTH.y + 10}`} fill="#ff8fb3" />
  </g>
);

function Face({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'joy':
      return <>{coverEye(L)}{coverEye(R)}{happyEye(L)}{happyEye(R)}{coverMouth}{openSmile}</>;
    case 'star':
      return <>{coverEye(L)}{coverEye(R)}{star(L)}{star(R)}{coverMouth}{openSmile}</>;
    case 'love':
      return <>{coverEye(L)}{coverEye(R)}{heart(L)}{heart(R)}{coverMouth}{openSmile}</>;
    case 'wink':
      return <>{coverEye(R)}{happyEye(R)}</>;
    case 'sleepy':
      return (
        <>
          {coverEye(L)}{coverEye(R)}
          {[L, R].map((e, i) => (
            <path key={i} d={`M ${e.x - 24} ${e.y} Q ${e.x} ${e.y + 18} ${e.x + 24} ${e.y}`} stroke="#fff" strokeWidth={10} strokeLinecap="round" fill="none" />
          ))}
        </>
      );
    case 'focus':
      return (
        <>
          <path d={`M ${L.x - 30} ${L.y - 50} L ${L.x + 22} ${L.y - 40}`} stroke="#fff" strokeWidth={9} strokeLinecap="round" />
          <path d={`M ${R.x + 30} ${R.y - 50} L ${R.x - 22} ${R.y - 40}`} stroke="#fff" strokeWidth={9} strokeLinecap="round" />
        </>
      );
    default:
      return null;
  }
}

const FX: Partial<Record<Mood, string[]>> = {
  joy: ['✨', '⭐', '✨'],
  star: ['🌟', '✨', '🏅'],
  love: ['💖', '💕', '✨'],
  sleepy: ['💤'],
  focus: ['📚'],
};

/**
 * Bousla, the compass study buddy. Expressions are drawn over the artwork,
 * so the same character can be happy, proud, in love with learning or sleepy.
 */
export function Mascot({ mood = 'idle', size, onClick, label }: { mood?: Mood; size?: number; onClick?: () => void; label?: string }) {
  const fx = FX[mood] ?? [];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`mascot m-${mood}`}
      style={{ width: size, ...(onClick ? { border: 0, background: 'none', padding: 0, cursor: 'pointer' } : null) }}
      onClick={onClick}
      aria-label={label}
      key={mood}
      type={onClick ? 'button' : undefined}
    >
      <img src={mascotUrl} alt="" draggable={false} />
      <svg className="face" viewBox="0 0 389 600" aria-hidden="true"><Face mood={mood} /></svg>
      {fx.map((e, i) => (
        <span key={i} className="fx" style={{ top: `${8 + i * 14}%`, insetInlineStart: i % 2 ? '-6%' : '86%', animationDelay: `${i * 0.35}s` }} aria-hidden="true">{e}</span>
      ))}
    </Tag>
  );
}
