// components/TodayPlanSheet.js — the one goals sheet.
//   • Today: My usual / A lighter day / Rest today (resets at midnight)
//   • "Edit" on My usual and on A lighter day (the three rings)
// Opened by "Edit goals" on the Today card (mode 'edit', title "Your goals"),
// and once a day as "What's your goal today?" (mode 'daily').

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Sheet from './Sheet';
import Rings from './Rings';
import { colors, radius, space } from '../theme';
import { describeDailyGoal, planFor } from '../writingLogic';

const OPTIONS = [
  { id: 'usual', title: 'My usual', cta: 'Start with my usual' },
  { id: 'light', title: 'A lighter day', cta: 'Start a lighter day' },
  { id: 'rest', title: 'Rest today', cta: 'Take the day off' },
];

export default function TodayPlanSheet({ visible, goals, current, onPick, onEdit, onClose, mode = 'daily', openKey }) {
  const [picked, setPicked] = useState('usual');
  useEffect(() => {
    // Only when opened fresh, so coming back from an Edit keeps your pick.
    setPicked(current?.plan || 'usual');
  }, [openKey]);

  const weekday = new Date().toLocaleDateString(undefined, { weekday: 'long' });
  const subtitle = `Pick a goal for ${weekday}. Resets at midnight.`;
  const edit = mode === 'edit';
  const cta = edit ? "Save today's goal" : OPTIONS.find((o) => o.id === picked).cta;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={edit ? 'Your goals' : 'What’s your goal today?'}
      subtitle={edit ? 'Today resets at midnight.' : subtitle}
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
              {!rest ? (
                <Pressable
                  onPress={() => onEdit(o.id)}
                  hitSlop={6}
                  style={s.edit}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${o.title}`}
                >
                  <Text style={s.editText}>Edit</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}
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
  edit: { borderWidth: 1.5, borderColor: colors.royal, borderRadius: 999, paddingHorizontal: 12, minHeight: 34, justifyContent: 'center', backgroundColor: '#FFFFFF' },
  editText: { color: colors.royal, fontWeight: '700', fontSize: 13 },
  cta: { backgroundColor: colors.royal, borderRadius: radius.md, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: space.md },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14.5 },
});
