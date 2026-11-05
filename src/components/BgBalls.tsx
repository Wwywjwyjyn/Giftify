/**
 * پس‌زمینه مشکی با توپ‌های ریزِ در حال تکون خوردن — کاملاً CSS و GPU-friendly.
 * فقط transform/opacity انیمیت می‌شود و با prefers-reduced-motion خاموش می‌شود.
 */
type Orb = { x: string; y: string; size: number; color: string; o0: number; o1: number; dur: number; del: number; dx: string; dy: string; s0: number; s1: number };
type Dot = { x: string; y: string; size: number; color: string; dur: number; del: number; dx: string; dy: string; o0: number };

const ORBS: Orb[] = [
  { x: '4%',  y: '6%',  size: 320, color: '#0d5e86', o0: 0.16, o1: 0.26, dur: 34, del: 0,  dx: '7vw',  dy: '8vh',  s0: 1,    s1: 1.2 },
  { x: '70%', y: '2%',  size: 260, color: '#1691c4', o0: 0.13, o1: 0.22, dur: 27, del: -6, dx: '-6vw', dy: '9vh',  s0: 1,    s1: 1.15 },
  { x: '82%', y: '48%', size: 220, color: '#2cb2e0', o0: 0.10, o1: 0.2,  dur: 31, del: -12, dx: '-8vw', dy: '-7vh', s0: 0.9, s1: 1.25 },
  { x: '8%',  y: '62%', size: 300, color: '#0c7a93', o0: 0.14, o1: 0.24, dur: 38, del: -9, dx: '9vw',  dy: '-9vh', s0: 1.1, s1: 0.9 },
  { x: '38%', y: '34%', size: 180, color: '#134a6b', o0: 0.12, o1: 0.18, dur: 24, del: -3, dx: '5vw',  dy: '6vh',  s0: 1,    s1: 1.3 },
  { x: '55%', y: '80%', size: 240, color: '#1691c4', o0: 0.10, o1: 0.17, dur: 29, del: -15, dx: '-7vw', dy: '-8vh', s0: 1,   s1: 1.12 },
  { x: '20%', y: '88%', size: 170, color: '#2cb2e0', o0: 0.08, o1: 0.15, dur: 26, del: -20, dx: '6vw',  dy: '-5vh', s0: 0.95, s1: 1.2 },
  { x: '92%', y: '14%', size: 140, color: '#1ba6dc', o0: 0.10, o1: 0.16, dur: 21, del: -2, dx: '-4vw', dy: '7vh',  s0: 1,    s1: 1.18 },
];

const DOTS: Dot[] = [
  { x: '12%', y: '22%', size: 3, color: '#4dc7f0', dur: 16, del: 0,  dx: '34px',  dy: '-110px', o0: 0.5 },
  { x: '30%', y: '70%', size: 2, color: '#8ddcf5', dur: 21, del: -5, dx: '-40px', dy: '-130px', o0: 0.45 },
  { x: '48%', y: '12%', size: 3, color: '#4dc7f0', dur: 18, del: -9, dx: '46px',  dy: '-90px',  o0: 0.4 },
  { x: '63%', y: '58%', size: 2, color: '#ffffff', dur: 24, del: -2, dx: '-30px', dy: '-150px', o0: 0.35 },
  { x: '74%', y: '30%', size: 3, color: '#8ddcf5', dur: 17, del: -12, dx: '38px', dy: '-120px', o0: 0.5 },
  { x: '88%', y: '72%', size: 2, color: '#4dc7f0', dur: 22, del: -7, dx: '-36px', dy: '-100px', o0: 0.4 },
  { x: '6%',  y: '46%', size: 2, color: '#ffffff', dur: 19, del: -14, dx: '30px', dy: '-140px', o0: 0.3 },
  { x: '42%', y: '88%', size: 3, color: '#8ddcf5', dur: 20, del: -3, dx: '40px',  dy: '-80px',  o0: 0.45 },
  { x: '57%', y: '42%', size: 2, color: '#4dc7f0', dur: 23, del: -16, dx: '-42px', dy: '-110px', o0: 0.35 },
  { x: '80%', y: '90%', size: 2, color: '#ffffff', dur: 25, del: -10, dx: '28px', dy: '-120px', o0: 0.3 },
];

export function BgBalls() {
  return (
    <div className="orbs" aria-hidden="true">
      {ORBS.map((o, i) => (
        <div
          key={`o${i}`}
          className="orb"
          style={{
            left: o.x, top: o.y, width: o.size, height: o.size,
            background: `radial-gradient(circle at 35% 35%, ${o.color}, transparent 68%)`,
            ['--o0' as string]: o.o0, ['--o1' as string]: o.o1,
            ['--dur' as string]: `${o.dur}s`, ['--del' as string]: `${o.del}s`,
            ['--dx' as string]: o.dx, ['--dy' as string]: o.dy,
            ['--s0' as string]: o.s0, ['--s1' as string]: o.s1,
          }}
        />
      ))}
      {DOTS.map((d, i) => (
        <div
          key={`d${i}`}
          className="orb-dot"
          style={{
            left: d.x, top: d.y, width: d.size, height: d.size, background: d.color,
            ['--dur' as string]: `${d.dur}s`, ['--del' as string]: `${d.del}s`,
            ['--dx' as string]: d.dx, ['--dy' as string]: d.dy,
            ['--o0' as string]: d.o0, ['--o1' as string]: d.o0 * 0.5,
          }}
        />
      ))}
    </div>
  );
}
