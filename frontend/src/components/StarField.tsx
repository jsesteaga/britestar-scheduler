import { useMemo, type CSSProperties } from "react";

type StarFieldProps = {
  // Any string — the same seed always produces the same sky. The schedule
  // passes the visible week's Monday, so each week has its own unique
  // layout (and drift direction) that's identical every time you return.
  seed: string;
};

type Star = {
  x: number; // start position, % of viewport
  y: number;
  dx: number; // how far it drifts over one loop, in vw/vh
  dy: number;
  size: number; // px
  opacity: number;
  color: string;
  shape: "star" | "sparkle";
  duration: number; // s, one full drift
  delay: number; // s (negative = already partway through when the page loads)
  twinkle: boolean;
  spin: boolean;
};

type ShootingStar = {
  x: number;
  y: number;
  angle: number; // deg
  length: number; // px it travels
  cycle: number; // s between streaks
  delay: number;
};

const COLORS = [
  "var(--color-brite-red-bright)",
  "var(--color-brite-amber)",
  "var(--color-brite-tan)",
  "var(--color-brite-amber)",
];

const PATHS = {
  star: "M12 1.5l3.1 6.9 7.4.7-5.6 5 1.7 7.4L12 17.6l-6.6 3.9 1.7-7.4-5.6-5 7.4-.7z",
  sparkle: "M12 0c.9 7.4 3.7 10.2 12 12-8.3 1.8-11.1 4.6-12 12-.9-7.4-3.7-10.2-12-12 8.3-1.8 11.1-4.6 12-12z",
};

// Depth layers: far stars are small, faint and slow; near ones are bigger
// and faster, which reads as parallax depth.
const LAYERS = [
  { count: 24, size: [5, 10], opacity: [0.16, 0.32], distance: 22, duration: [80, 120] },
  { count: 14, size: [10, 18], opacity: [0.18, 0.32], distance: 34, duration: [55, 80] },
  { count: 6, size: [20, 40], opacity: [0.09, 0.16], distance: 48, duration: [40, 60] },
] as const;

/** Turns a string into a 32-bit number, so a date like "2026-09-28" can seed the generator. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A tiny seeded random number generator (mulberry32): same seed, same sequence of numbers in [0, 1). */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateSky(seed: string): { stars: Star[]; shooting: ShootingStar[] } {
  const rand = seededRandom(hashString(seed));
  const between = (min: number, max: number) => min + rand() * (max - min);

  // One "wind" direction for the whole sky this week; each star wanders a
  // little off it so they don't move in lockstep.
  const wind = rand() * Math.PI * 2;

  const stars: Star[] = [];
  for (const layer of LAYERS) {
    for (let i = 0; i < layer.count; i++) {
      const angle = wind + between(-0.4, 0.4);
      const distance = layer.distance * between(0.8, 1.2);
      const duration = between(layer.duration[0], layer.duration[1]);
      stars.push({
        // Start a bit beyond the edges too, so stars drift in from off-screen.
        x: between(-10, 110),
        y: between(-10, 110),
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        size: between(layer.size[0], layer.size[1]),
        opacity: between(layer.opacity[0], layer.opacity[1]),
        color: COLORS[Math.floor(rand() * COLORS.length)],
        shape: rand() < 0.3 ? "sparkle" : "star",
        duration,
        delay: -rand() * duration,
        twinkle: rand() < 0.45,
        spin: rand() < 0.35,
      });
    }
  }

  const shooting: ShootingStar[] = Array.from({ length: 2 }, () => ({
    x: between(5, 70),
    y: between(0, 45),
    angle: between(15, 40),
    length: between(260, 420),
    cycle: between(13, 22),
    delay: between(2, 12),
  }));

  return { stars, shooting };
}

export function StarField({ seed }: StarFieldProps) {
  // Only regenerate when the week changes, not on every schedule edit.
  const { stars, shooting } = useMemo(() => generateSky(seed), [seed]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* key={seed} remounts this layer on week change, replaying the fade-in. */}
      <div key={seed} className="starfield-fade absolute inset-0">
        {stars.map((star, i) => (
          <div
            key={i}
            className="starfield-drift absolute"
            style={
              {
                left: `${star.x}%`,
                top: `${star.y}%`,
                "--dx": `${star.dx}vw`,
                "--dy": `${star.dy}vh`,
                animationDuration: `${star.duration}s`,
                animationDelay: `${star.delay}s`,
              } as CSSProperties
            }
          >
            <svg
              viewBox="0 0 24 24"
              width={star.size}
              height={star.size}
              className={[star.twinkle && "starfield-twinkle", star.spin && "starfield-spin"]
                .filter(Boolean)
                .join(" ")}
              style={{ opacity: star.opacity, animationDelay: `${star.delay / 7}s` }}
            >
              <path d={PATHS[star.shape]} fill={star.color} />
            </svg>
          </div>
        ))}

        {shooting.map((s, i) => (
          <div
            key={`shoot-${i}`}
            className="starfield-shooting absolute"
            style={
              {
                left: `${s.x}%`,
                top: `${s.y}%`,
                "--angle": `${s.angle}deg`,
                "--len": `${s.length}px`,
                animationDuration: `${s.cycle}s`,
                animationDelay: `${s.delay}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
