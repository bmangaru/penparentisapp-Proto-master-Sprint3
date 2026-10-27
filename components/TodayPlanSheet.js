// components/TodayPlanSheet.js — "What's your goal today?", asked once a day
// (resets at midnight), now one tap: My usual / A lighter day / Rest today.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Sheet from './Sheet';
import Rings from './Rings';
import { colors, radius, space } from '../theme';
import { describeDailyGoal, isWritingDay, planFor } from '../writingLogic';

const OPTIONS = [
  { id: 'usual', title: 'My usual', cta: 'Start with my usual' },
  { id: 'light', title: 'A lighter day', cta: 'Start a lighter day' },
  { id: 'rest', title: 'Rest today', cta: 'Take the day off' },
];

export default function TodayPlanSheet({ visible, goals, today, current, onPick, onEditGoals, onClose }) {
  const writingDay = isWritingDay(goals, today);
  const [picked, setPicked] = useState('usual');
  useEffect(() => {
    if (visible) setPicked(current?.plan || (writingDay ? 'usual' : 'rest'));
  }, [visible]);

  const weekday = new Date().toLocaleDateString(undefined, { weekday: 'long' });
  const subtitle = writingDay
    ? `${weekday} is one of your writing days. Resets at midnight.`
    : `${weekday} is usually a day off — write anyway if you like.`;
  const cta = OPTIONS.find((o) => o.id === picked).cta;

  return (
    <Sheet visible={visible} onClose={onClose} title="What’s your goal today?" subtitle={subtitle}>
      <View style={{ gap: 10 }}>
        {OPTIONS.map((o) => {
          const plan = planFor(o.id, goals);
          const rest = o.id === 'rest';
          const on = picked === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => setPicked(o.id)}
              style={[s.option, on && s.optionOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Rings minutes={100} words={100} sessions={100} off={rest} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{o.title}</Text>
                <Text style={s.sub}>{rest ? 'Counts as a day off. Your week stays on track.' : describeDailyGoal(plan)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Pressable onPress={onEditGoals} style={s.link}>
        <Text style={s.linkText}>Change my usual goals</Text>
      </Pressable>
      <Pressable style={s.cta} onPress={() => onPick(planFor(picked, goals))}>
        <Text style={s.ctaText}>{cta}</Text>
      </Pressable>
    </Sheet>
  );
}

const s = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: radius.md, borderWidth: 2, borderColor: colors.line, backgroundColor: '#FFFFFF' },
  optionOn: { borderColor: colors.royal, backgroundColor: '#EEF2FB' },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: space.xs },
  linkText: { color: colors.royal, fontWeight: '700', fontSize: 13 },
  cta: { backgroundColor: colors.royal, borderRadius: radius.md, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14.5 },
});
