// components/Rings.js — the three daily rings, used everywhere goals show:
// minutes (outer, gold), words (middle, blue), sessions (inner, light blue).
// Pass each ring's % (over 100 just shows full; null = that ring has no goal).
// `off` draws a dotted, faded set for a rest day / day off; `faded` for future days.

import React from 'react';
import Svg, { Circle, G } from 'react-native-svg';

export const RING_COLORS = {
  light: { minutes: '#C8912B', words: '#1B3FA0', sessions: '#5FA8D3', trackOpacity: 0.2 },
  // On the dark blue Today card.
  dark: { minutes: '#F2C14E', words: '#FFFFFF', sessions: '#9AD8FF', trackOpacity: 0.3 },
};

const RADII = { minutes: 19, words: 14, sessions: 9 };

export default function Rings({ minutes, words, sessions, size = 44, off = false, faded = false, variant = 'light' }) {
  const c = RING_COLORS[variant];
  const values = { minutes, words, sessions };
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44" opacity={faded ? 0.45 : 1} accessibilityElementsHidden importantForAccessibility="no">
      <G rotation={-90} origin="22, 22">
        {Object.keys(RADII).map((k) => {
          const r = RADII[k];
          const circ = 2 * Math.PI * r;
          const pct = values[k];
          const len = pct == null ? 0 : (Math.min(100, Math.max(0, pct)) / 100) * circ;
          return (
            <React.Fragment key={k}>
              <Circle
                cx="22" cy="22" r={r} fill="none" stroke={c[k]} strokeWidth={4.2}
                strokeOpacity={off ? 0.45 : c.trackOpacity}
                strokeDasharray={off ? '2 4' : undefined}
              />
              {!off && len > 0 ? (
                <Circle
                  cx="22" cy="22" r={r} fill="none" stroke={c[k]} strokeWidth={4.2} strokeLinecap="round"
                  strokeDasharray={`${len} ${circ}`}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </G>
    </Svg>
  );
}
