// components/TodayPlanSheet.js — the one goals sheet.
//   • Today: My usual / A lighter day / Rest today (resets at midnight)
//   • Your usual goals: a summary with "Edit" (opens the full goals screen)
// Opened by "Edit goals" on the Today card (mode 'edit', title "Your goals"),
// and once a day as "What's your goal today?" (mode 'daily').

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

export default function TodayPlanSheet({ visible, goals, today, current, onPick, onEditGoals, onClose, mode = 'daily' }) {
  const writingDay = isWritingDay(goals, today);
  const [picked, setPicked] = useState('usual');
  useEffect(() => {
    if (visible) setPicked(current?.plan || (writingDay ? 'usual' : 'rest'));
  }, [visible]);

  const weekday = new Date().toLocaleDateString(undefined, { weekday: 'long' });
  const subtitle = writingDay
    ? `${weekday} is one of your writing days. Resets at midnight.`
    : `${weekday} is usually a day off — write anyway if you like.`;
  const edit = mode === 'edit';
  const cta = edit ? "Save today's goal" : OPTIONS.find((o) => o.id === picked).cta;
  const days = goals.days.filter(Boolean).length;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={edit ? 'Your goals' : 'What’s your goal today?'}
      subtitle={edit ? 'Today resets at midnight. Your usual goals apply every writing day.' : subtitle}
    >
      {edit ? <Text style={s.section}>TODAY · {weekday.toUpperCase()}</Text> : null}
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
      <Text style={[s.section, { marginTop: space.md }]}>YOUR USUAL GOALS</Text>
      <View style={s.usual}>
        <View style={{ flex: 1 }}>
          <Text style={s.usualTitle}>{describeDailyGoal(planFor('usual', goals))}</Text>
          <Text style={s.sub}>Writing {days} day{days === 1 ? '' : 's'} a week</Text>
        </View>
        <Pressable onPress={onEditGoals} style={s.edit} accessibilityRole="button" accessibilityLabel="Edit your usual goals">
          <Text style={s.editText}>Edit</Text>
        </Pressable>
      </View>
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
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: colors.muted, marginBottom: 8 },
  usual: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12 },
  usualTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  edit: { borderWidth: 1.5, borderColor: colors.royal, borderRadius: 999, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' },
  editText: { color: colors.royal, fontWeight: '700', fontSize: 13 },
  cta: { backgroundColor: colors.royal, borderRadius: radius.md, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: space.md },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14.5 },
});
