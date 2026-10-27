// components/RingStats.js — big rings + the minutes / words / sessions lines,
// on a dark blue card. Used by the Brainstorm Today card and the day page.
//
// Animation: whenever `playKey` changes (e.g. each time the screen comes into
// focus) the rings start empty and fill in order — minutes, words, sessions —
// in about 1.3 s, with the numbers counting up. A ring past its goal runs into
// its second lap and a gold "2.4×" chip pops in. With the phone's Reduce
// Motion setting on, everything appears already filled.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, AccessibilityInfo } from 'react-native';
import Rings, { RING_COLORS } from './Rings';
import { formatDuration, overMultiple } from '../writingLogic';

export const FILL_MS = 1300;
const STAGGER = { minutes: [0, 700], words: [200, 900], sessions: [400, 800] }; // [start, length] ms
const ease = (x) => 1 - Math.pow(1 - x, 3);
const frac = (t, k) => ease(Math.max(0, Math.min(1, (t - STAGGER[k][0]) / STAGGER[k][1])));

// Elapsed ms of the current fill (FILL_MS = finished). Restarts when playKey changes.
function useFill(playKey) {
  const [t, setT] = useState(playKey == null ? FILL_MS : 0);
  useEffect(() => {
    if (playKey == null) return undefined;
    let cancelled = false;
    let raf;
    setT(0);
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) { setT(FILL_MS); return; }
        const start = Date.now();
        const tick = () => {
          if (cancelled) return;
          const e = Math.min(Date.now() - start, FILL_MS);
          setT(e);
          if (e < FILL_MS) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      });
    return () => { cancelled = true; if (raf) cancelAnimationFrame(raf); };
  }, [playKey]);
  return t;
}

// Gold "2.4×" pill that pops in when it first appears.
function Chip({ text }) {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 160, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[s.chip, { transform: [{ scale }] }]}>
      <Text style={s.chipText}>{text}</Text>
    </Animated.View>
  );
}

function Line({ name, color, value, of, pct, noGoal }) {
  const closed = pct != null && pct >= 100;
  const chip = overMultiple(pct);
  return (
    <View>
      <Text style={[s.name, { color }]}>{name}</Text>
      <View style={s.valueRow}>
        <Text style={s.value} numberOfLines={1}>
          {value}
          <Text style={s.of}>{of != null ? ` of ${of}` : noGoal ? `  ·  ${noGoal}` : ''}{closed ? '  ✓' : ''}</Text>
        </Text>
        {chip ? <Chip text={chip} /> : null}
      </View>
    </View>
  );
}

// summary: { seconds, words, count }   rings: ringProgress(...) result
// noGoal: text for a ring with no target (e.g. "no goal that day"), or ''.
export default function RingStats({ summary, rings, playKey, off = false, size = 112, noGoal = '' }) {
  const t = useFill(playKey);
  const fm = frac(t, 'minutes');
  const fw = frac(t, 'words');
  const fs = frac(t, 'sessions');
  const tg = rings.targets || {};
  const grow = (v, f) => (v == null ? null : v * f);
  const c = RING_COLORS.dark;

  return (
    <View style={s.body}>
      <Rings
        minutes={grow(rings.minutes, fm)} words={grow(rings.words, fw)} sessions={grow(rings.sessions, fs)}
        off={off && !summary.count} size={size} variant="dark"
      />
      <View style={s.lines}>
        <Line
          name="MINUTES" color={c.minutes}
          value={formatDuration(Math.round(summary.seconds * fm))}
          of={tg.minutes ? `${tg.minutes} min` : null} pct={grow(rings.minutes, fm)} noGoal={noGoal}
        />
        <Line
          name="WORDS" color={c.words}
          value={Math.round(summary.words * fw).toLocaleString()}
          of={tg.words ? tg.words.toLocaleString() : null} pct={grow(rings.words, fw)} noGoal={noGoal}
        />
        <Line
          name="SESSIONS" color={c.sessions}
          value={String(Math.round(summary.count * fs))}
          of={tg.sessions ? String(tg.sessions) : null} pct={grow(rings.sessions, fs)} noGoal={noGoal}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  body: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  lines: { flex: 1, gap: 8 },
  name: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  value: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  of: { fontWeight: '500', color: 'rgba(255,255,255,0.75)' },
  chip: { backgroundColor: '#F2C14E', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  chipText: { fontSize: 11, fontWeight: '800', color: '#2A1A00' },
});
