// components/GoalsSheet.js — the ONE place to set goals: a daily target for
// each ring (minutes, words, sessions) and which days of the week you write.
// The week's totals are worked out from those, so there's no separate weekly goal.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Sheet from './Sheet';
import Rings, { RING_COLORS } from './Rings';
import { colors, radius, space } from '../theme';
import { GOAL_LIMITS, normalizeGoals, stepGoal } from '../writingLogic';

const ROWS = [
  { k: 'minutes', name: 'Minutes', sub: 'Time writing each day', unit: ' min' },
  { k: 'words', name: 'Words', sub: 'Words typed each day', unit: '' },
  { k: 'sessions', name: 'Sessions', sub: 'Times you sit down to write', unit: '' },
];
const DAYS = [['M', 'Monday'], ['T', 'Tuesday'], ['W', 'Wednesday'], ['T', 'Thursday'], ['F', 'Friday'], ['S', 'Saturday'], ['S', 'Sunday']];

export default function GoalsSheet({ visible, goals, firstTime, onSave, onClose }) {
  const [g, setG] = useState(normalizeGoals(goals));
  useEffect(() => { if (visible) setG(normalizeGoals(goals)); }, [visible]);

  const step = (k, dir) => {
    setG((cur) => ({ ...cur, [k]: stepGoal(k, cur[k], dir) }));
  };
  const toggleDay = (i) => setG((cur) => {
    const days = cur.days.slice();
    days[i] = !days[i];
    return { ...cur, days };
  });

  const n = g.days.filter(Boolean).length;
  const week = n === 0
    ? 'Pick at least one writing day.'
    : `Writing ${n} day${n === 1 ? '' : 's'} a week: ${(g.words * n).toLocaleString()} words, ${g.minutes * n} minutes and ${g.sessions * n} session${g.sessions * n === 1 ? '' : 's'}. Days off never break your week.`;

  return (
    <Sheet
      visible={visible}
      onClose={firstTime ? () => {} : onClose}
      title="Your writing goals"
      subtitle="One goal per ring. Close them on your writing days."
    >
      <View style={s.ringsRow}>
        <Rings minutes={75} words={75} sessions={100} size={60} />
      </View>

      <View style={s.card}>
        {ROWS.map((r, i) => (
          <View key={r.k} style={[s.row, i < ROWS.length - 1 && s.rowRule]}>
            <View style={[s.dot, { backgroundColor: RING_COLORS.light[r.k] }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowName}>{r.name}</Text>
              <Text style={s.rowSub}>{r.sub}</Text>
            </View>
            <Pressable
              onPress={() => step(r.k, -1)}
              disabled={g[r.k] <= GOAL_LIMITS[r.k].min}
              style={[s.stepBtn, g[r.k] <= GOAL_LIMITS[r.k].min && s.stepOff]}
              accessibilityRole="button"
              accessibilityLabel={`Less ${r.name.toLowerCase()}`}
            >
              <Text style={s.stepText}>−</Text>
            </Pressable>
            <Text style={s.value}>{g[r.k].toLocaleString()}{r.unit}</Text>
            <Pressable
              onPress={() => step(r.k, 1)}
              disabled={g[r.k] >= GOAL_LIMITS[r.k].max}
              style={[s.stepBtn, g[r.k] >= GOAL_LIMITS[r.k].max && s.stepOff]}
              accessibilityRole="button"
              accessibilityLabel={`More ${r.name.toLowerCase()}`}
            >
              <Text style={s.stepText}>+</Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Text style={s.h}>My writing days</Text>
      <View style={s.days}>
        {DAYS.map(([short, full], i) => {
          const on = g.days[i];
          return (
            <Pressable
              key={full}
              onPress={() => toggleDay(i)}
              style={[s.day, on && s.dayOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={full}
            >
              <Text style={[s.dayText, on && s.dayTextOn]}>{short}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.week}>
        <Text style={s.weekKicker}>YOUR WEEK, WORKED OUT FOR YOU</Text>
        <Text style={s.weekText}>{week}</Text>
      </View>

      <Pressable style={[s.save, n === 0 && { opacity: 0.5 }]} disabled={n === 0} onPress={() => onSave(g)}>
        <Text style={s.saveText}>Save goals</Text>
      </Pressable>
    </Sheet>
  );
}

const s = StyleSheet.create({
  ringsRow: { alignItems: 'center', marginBottom: space.sm },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rowRule: { borderBottomWidth: 1, borderBottomColor: colors.line },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowName: { fontSize: 14.5, fontWeight: '700', color: colors.ink },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(10,22,51,0.2)', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  stepOff: { opacity: 0.3 },
  stepText: { fontSize: 20, color: colors.ink, lineHeight: 22 },
  value: { minWidth: 58, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.ink },
  h: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: space.md, marginBottom: 8 },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(10,22,51,0.2)', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  dayOn: { backgroundColor: colors.royal, borderColor: colors.royal },
  dayText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  dayTextOn: { color: '#FFFFFF' },
  week: { backgroundColor: colors.cream, borderRadius: radius.md, padding: 12, marginTop: space.md },
  weekKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: '#8A5E12' },
  weekText: { fontSize: 14, lineHeight: 20, color: colors.ink, marginTop: 4 },
  save: { backgroundColor: colors.royal, borderRadius: radius.md, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: space.md },
  saveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14.5 },
});
