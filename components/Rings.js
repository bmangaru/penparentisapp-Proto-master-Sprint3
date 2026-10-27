// components/Rings.js — the three daily rings, used everywhere goals show:
// minutes (outer, gold), words (middle, blue), sessions (inner, light blue).
// Pass each ring's % (null = that ring has no goal).
//   • up to 100%: the ring fills
//   • over 100%: it keeps going for a second lap in a slightly darker shade,
//     with a small shadow at the tip so the overlap shows (capped just under
//     two full laps; the "2.4×" chip next to the numbers says the rest)
// `off` draws a dotted, faded set (the "Rest today" picture); `faded` for future days.
// This component never animates by itself (calendars draw dozens of them);
// RingStats animates by redrawing it with growing values.

import React from 'react';
import Svg, { Circle, G } from 'react-native-svg';

export const RING_COLORS = {
  light: { minutes: '#C8912B', words: '#1B3FA0', sessions: '#5FA8D3', trackOpacity: 0.2 },
  // On the dark blue cards (Today, day page).
  dark: { minutes: '#F2C14E', words: '#FFFFFF', sessions: '#9AD8FF', trackOpacity: 0.3 },
};

// Second-lap shades: close to the ring colour, a little deeper.
const LAP2 = {
  light: { minutes: '#B07A1C', words: '#16338A', sessions: '#4795C4' },
  dark: { minutes: '#E3AE34', words: '#E6ECFF', sessions: '#82CBF7' },
};

const RADII = { minutes: 19, words: 14, sessions: 9 };
const STROKE = 4.2;

function Ring({ k, pct, off, c, lap2 }) {
  const r = RADII[k];
  const circ = 2 * Math.PI * r;
  const p = pct == null ? 0 : Math.max(0, pct);
  const lap1 = (Math.min(100, p) / 100) * circ;
  const extraFrac = p > 100 ? Math.min(p - 100, 99.5) / 100 : 0;
  // Tip of the second lap (inside the rotated group, angle 0 = 12 o'clock).
  const a = extraFrac * 2 * Math.PI;
  const tipX = 22 + r * Math.cos(a);
  const tipY = 22 + r * Math.sin(a);
  const ahead = 0.9; // shadow sits just ahead of the tip, along the ring
  return (
    <>
      <Circle
        cx="22" cy="22" r={r} fill="none" stroke={c[k]} strokeWidth={STROKE}
        strokeOpacity={off ? 0.45 : c.trackOpacity}
        strokeDasharray={off ? '2 4' : undefined}
      />
      {!off && lap1 > 0 ? (
        <Circle
          cx="22" cy="22" r={r} fill="none" stroke={c[k]} strokeWidth={STROKE} strokeLinecap="round"
          strokeDasharray={`${lap1} ${circ}`}
        />
      ) : null}
      {!off && extraFrac > 0 ? (
        <>
          <Circle
            cx="22" cy="22" r={r} fill="none" stroke={lap2[k]} strokeWidth={STROKE} strokeLinecap="round"
            strokeDasharray={`${extraFrac * circ} ${circ}`}
          />
          <Circle
            cx={tipX + ahead * Math.cos(a + Math.PI / 2)} cy={tipY + ahead * Math.sin(a + Math.PI / 2)}
            r={2.6} fill="#000000" fillOpacity={0.4}
          />
          <Circle cx={tipX} cy={tipY} r={STROKE / 2} fill={lap2[k]} />
        </>
      ) : null}
    </>
  );
}

export default function Rings({ minutes, words, sessions, size = 44, off = false, faded = false, variant = 'light' }) {
  const c = RING_COLORS[variant];
  const lap2 = LAP2[variant];
  const values = { minutes, words, sessions };
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44" opacity={faded ? 0.45 : 1} accessibilityElementsHidden importantForAccessibility="no">
      <G rotation={-90} origin="22, 22">
        {Object.keys(RADII).map((k) => (
          <Ring key={k} k={k} pct={values[k]} off={off} c={c} lap2={lap2} />
        ))}
      </G>
    </Svg>
  );
}
