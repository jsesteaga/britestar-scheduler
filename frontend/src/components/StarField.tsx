import { useMemo } from "react";

type StarFieldProps = {
  // Any string — the same seed always produces the same sky. The schedule
  // passes the visible week's Monday, so each week has its own unique
  // layout that's still identical every time you come back to it.
  seed: string;
};

type Star = {
  x: number; // % of viewport width
  y: number; // % of viewport height
  size: number; // px
  rotate: number;
  opacity: number;
  color: string;
  shape: "star" | "sparkle";
  twinkle: boolean;
  delay: number; // s
};

const COLORS = [
  "var(--color-brite-red-bright)",
  "var(--color-brite-amber)",
  "var(--color-brite-tan)",
  "var(--color-brite-amber)",
];

const PATHS = {
  // Classic five-point star.
  star: "M12 1.5l3.1 6.9 7.4.7-5.6 5 1.7 7.4L12 17.6l-6.6 3.9 1.7-7.4-5.6-5 7.4-.7z",
  // Four-point twinkle.
  sparkle: "M12 0c.9 7.4 3.7 10.2 12 12-8.3 1.8-11.1 4.6-12 12-.9-7.4-3.7-10.2-12-12 8.3-1.8 11.1-4.6 12-12z",
};

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

// The viewport is split into a grid and each cell gets at most one star,
// jittered around inside it — pure random placement tends to clump stars
// together and leave big empty patches.
const COLS = 8;
const ROWS = 5;

function generateStars(seed: string): Star[] {
  const rand = seededRandom(hashString(seed));
  const stars: Star[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (rand() < 0.35) continue;
      const big = rand() < 0.12;
      stars.push({
        x: ((col + 0.15 + rand() * 0.7) / COLS) * 100,
        y: ((row + 0.15 + rand() * 0.7) / ROWS) * 100,
        size: big ? 34 + rand() * 20 : 8 + rand() * 16,
        rotate: rand() * 72,
        opacity: big ? 0.07 + rand() * 0.05 : 0.1 + rand() * 0.12,
        color: COLORS[Math.floor(rand() * COLORS.length)],
        shape: rand() < 0.3 ? "sparkle" : "star",
        twinkle: rand() < 0.4,
        delay: rand() * 6,
      });
    }
  }
  return stars;
}

export function StarField({ seed }: StarFieldProps) {
  // useMemo: only regenerate when the seed (week) changes, not on every
  // re-render of the schedule (which happens on every edit).
  const stars = useMemo(() => generateStars(seed), [seed]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* key={seed} remounts this layer on week change, replaying the fade-in. */}
      <div key={seed} className="starfield-fade absolute inset-0">
        {stars.map((star, i) => (
          <svg
            key={i}
            viewBox="0 0 24 24"
            width={star.size}
            height={star.size}
            className={star.twinkle ? "starfield-twinkle" : undefined}
            style={{
              position: "absolute",
              left: `${star.x}%`,
              top: `${star.y}%`,
              opacity: star.opacity,
              rotate: `${star.rotate}deg`,
              animationDelay: `${star.delay}s`,
            }}
          >
            <path d={PATHS[star.shape]} fill={star.color} />
          </svg>
        ))}
      </div>
    </div>
  );
}
