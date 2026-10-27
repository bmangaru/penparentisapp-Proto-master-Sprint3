// components/GoalsSheet.js — set a daily target for each ring (minutes,
// words, sessions). Your usual goal applies every day; there are no set
// writing days and no weekly goal.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Sheet from './Sheet';
import Rings, { RING_COLORS } from './Rings';
import { colors, radius, space } from '../theme';
import { GOAL_LIMITS, lightTargets, normalizeGoals, stepGoal } from '../writingLogic';

const ROWS = [
  { k: 'minutes', name: 'Minutes', sub: 'Time writing each day', unit: ' min' },
  { k: 'words', name: 'Words', sub: 'Words typed each day', unit: '' },
  { k: 'sessions', name: 'Sessions', sub: 'Times you sit down to write', unit: '' },
];

// kind 'usual': the three rings (first run, and Edit on "My usual").
// kind 'light': just the three rings for "A lighter day" (never above your usual),
//   with "Use half of my usual". Saves goals.light, or removes it to go back to half.
// onBack: show "‹ Your goals" (when opened from the goals sheet).
export default function GoalsSheet({ visible, goals, firstTime, kind = 'usual', onSave, onClose, onBack }) {
  const light = kind === 'light';
  const start = () => {
    const base = normalizeGoals(goals);
    return light ? { ...base, ...lightTargets(base) } : base;
  };
  const [g, setG] = useState(start);
  const [custom, setCustom] = useState(false); // lighter day: edited (vs. half of usual)
  const usual = normalizeGoals(goals);
  useEffect(() => {
    if (visible) { setG(start()); setCustom(!!usual.light); }
  }, [visible, kind]);

  const max = (k) => (light ? usual[k] : GOAL_LIMITS[k].max);
  const step = (k, dir) => {
    setG((cur) => ({ ...cur, [k]: Math.min(max(k), stepGoal(k, cur[k], dir)) }));
    if (light) setCustom(true);
  };
  const half = lightTargets({ ...usual, light: undefined });
  function useHalf() {
    setG((cur) => ({ ...cur, ...half }));
    setCustom(false);
  }

  function save() {
    if (light) {
      onSave({ ...usual, light: custom ? { words: g.words, minutes: g.minutes, sessions: g.sessions } : undefined });
    } else {
      // Keep a custom lighter day, but never above the new usual (normalizeGoals caps it).
      onSave({ ...g, light: usual.light });
    }
  }


  const title = light ? 'A lighter day' : firstTime ? 'Your writing goals' : 'My usual';
  const subtitle = light
    ? 'For busy days. Pick it any day from “Your goals”.'
    : firstTime ? 'One goal per ring, every day. On busy days pick a lighter day or rest.' : 'Your goal on a normal day.';

  return (
    <Sheet visible={visible} onClose={firstTime ? () => {} : onClose} title={title} subtitle={subtitle}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={8} style={s.back} accessibilityRole="button">
          <Text style={s.backText}>‹ Your goals</Text>
        </Pressable>
      ) : null}
      {firstTime ? (
        <View style={s.ringsRow}>
          <Rings minutes={75} words={75} sessions={100} size={60} />
        </View>
      ) : null}

      <View style={s.card}>
        {ROWS.map((r, i) => {
          const atMin = g[r.k] <= GOAL_LIMITS[r.k].min;
          const atMax = g[r.k] >= max(r.k);
          return (
            <View key={r.k} style={[s.row, i < ROWS.length - 1 && s.rowRule]}>
              <View style={[s.dot, { backgroundColor: RING_COLORS.light[r.k] }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.rowName}>{r.name}</Text>
                <Text style={s.rowSub}>{r.sub}</Text>
              </View>
              <Pressable
                onPress={() => step(r.k, -1)}
                disabled={atMin}
                style={[s.stepBtn, atMin && s.stepOff]}
                accessibilityRole="button"
                accessibilityLabel={`Less ${r.name.toLowerCase()}`}
              >
                <Text style={s.stepText}>−</Text>
              </Pressable>
              <Text style={s.value}>{g[r.k].toLocaleString()}{r.unit}</Text>
              <Pressable
                onPress={() => step(r.k, 1)}
                disabled={atMax}
                style={[s.stepBtn, atMax && s.stepOff]}
                accessibilityRole="button"
                accessibilityLabel={`More ${r.name.toLowerCase()}`}
              >
                <Text style={s.stepText}>+</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {light ? (
        <>
          <Text style={s.lightNote}>
            {custom ? 'Your own lighter day. It stays like this when you change your usual.' : 'Half of your usual. It follows your usual if you change it.'}
          </Text>
          {custom ? (
            <Pressable onPress={useHalf} style={s.reset} accessibilityRole="button">
              <Text style={s.resetText}>
                ↺ Use half of my usual ({half.words} words · {half.minutes} min · {half.sessions} session{half.sessions === 1 ? '' : 's'})
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      <Pressable style={s.save} onPress={save}>
        <Text style={s.saveText}>{firstTime ? 'Save goals' : 'Save'}</Text>
      </Pressable>
    </Sheet>
  );
}

const s = StyleSheet.create({
  back: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', marginTop: -6, marginBottom: 6 },
  backText: { color: colors.royal, fontWeight: '700', fontSize: 13.5 },
  lightNote: { fontSize: 12.5, color: colors.muted, marginTop: space.sm, lineHeight: 18 },
  reset: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  resetText: { color: colors.royal, fontWeight: '700', fontSize: 13, textAlign: 'center' },
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
  save: { backgroundColor: colors.royal, borderRadius: radius.md, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: space.md },
  saveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14.5 },
});
