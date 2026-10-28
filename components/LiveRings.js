// components/LiveRings.js — today's three rings at the top of the writing page.
// Shows today's totals (earlier sessions + this one), so it matches the Today
// card on Brainstorm, and updates live: minutes every second, words with each
// new word. A ring that's closed turns its number green with a ✓.
// No animation of its own — it just redraws as the numbers change.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Rings from './Rings';
import { colors, radius, space } from '../theme';
import { ringProgress, timeClock } from '../writingLogic';

function Cell({ name, color, value, goal, pct, clock }) {
  const done = pct != null && pct >= 100;
  const stopped = clock === 'paused';
  return (
    <View style={s.cell}>
      <Text style={[s.name, { color }]}>{name}</Text>
      <View style={s.valueRow}>
        <Text style={[s.value, done && s.done, stopped && s.stopped]} numberOfLines={1}>
          {value}
          {goal != null && !stopped ? <Text style={s.goal}> / {goal}</Text> : null}
          {done && !stopped ? ' ✓' : ''}
        </Text>
        {clock === 'running' ? <View style={s.live} accessibilityLabel="Clock running" /> : null}
        {stopped ? <Text style={s.pausedTag}>PAUSED</Text> : null}
      </View>
    </View>
  );
}

// totals: { seconds, words, count } for today, including this session.
// clock: 'running' (small green dot) | 'paused' (grey time + PAUSED) | undefined.
export default function LiveRings({ goal, totals, clock }) {
  const r = ringProgress(goal, totals);
  const t = r.targets || {};
  return (
    <View style={s.card} accessibilityRole="summary">
      <Rings minutes={r.minutes} words={r.words} sessions={r.sessions} size={44} />
      <View style={s.cells}>
        <Cell name="MIN" color="#B07A1C" value={timeClock(totals.seconds)} goal={t.minutes ? `${t.minutes} min` : null} pct={r.minutes} clock={clock} />
        <Cell name="WORDS" color={colors.royal} value={totals.words.toLocaleString()} goal={t.words ? t.words.toLocaleString() : null} pct={r.words} />
        <Cell name="SESSIONS" color="#3C8BBF" value={String(totals.count)} goal={t.sessions || null} pct={r.sessions} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: space.lg, marginBottom: 8,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF',
  },
  cells: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  cell: { flexShrink: 1 },
  name: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  value: { fontSize: 14, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  goal: { fontSize: 12, fontWeight: '500', color: colors.muted },
  done: { color: '#1E7B3A' },
  stopped: { color: '#8A93AE' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  live: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2E9150' },
  pausedTag: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4, color: colors.muted, backgroundColor: '#EEF1F7', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, overflow: 'hidden' },
});
