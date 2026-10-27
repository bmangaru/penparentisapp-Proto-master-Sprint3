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

function Cell({ name, color, value, goal, pct }) {
  const done = pct != null && pct >= 100;
  return (
    <View style={s.cell}>
      <Text style={[s.name, { color }]}>{name}</Text>
      <Text style={[s.value, done && s.done]} numberOfLines={1}>
        {value}
        {goal != null ? <Text style={s.goal}> / {goal}</Text> : null}
        {done ? ' ✓' : ''}
      </Text>
    </View>
  );
}

// totals: { seconds, words, count } for today, including this session.
export default function LiveRings({ goal, totals }) {
  const r = ringProgress(goal, totals);
  const t = r.targets || {};
  return (
    <View style={s.card} accessibilityRole="summary">
      <Rings minutes={r.minutes} words={r.words} sessions={r.sessions} size={44} />
      <View style={s.cells}>
        <Cell name="MIN" color="#B07A1C" value={timeClock(totals.seconds)} goal={t.minutes ? `${t.minutes} min` : null} pct={r.minutes} />
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
});
