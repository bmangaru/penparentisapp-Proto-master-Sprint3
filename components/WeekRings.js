// components/WeekRings.js — "This week": seven small ring sets, Monday to
// Sunday, with days off dotted, plus the week's totals against what you planned.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Rings from './Rings';
import { colors, lift } from '../theme';
import { formatDuration } from '../writingLogic';

export default function WeekRings({ week, onPressDay }) {
  const { days, planned, done, writingDays, closedDays } = week;
  return (
    <View style={[s.card, lift]}>
      <View style={s.head}>
        <Text style={s.h}>This week</Text>
        <Text style={s.meta}>{closedDays} of {writingDays} writing day{writingDays === 1 ? '' : 's'} closed</Text>
      </View>
      <View style={s.row}>
        {days.map((d) => (
          <Pressable
            key={d.key}
            style={s.day}
            onPress={() => onPressDay?.(d)}
            disabled={!d.count}
            accessibilityRole="button"
            accessibilityLabel={`${d.key}${d.off ? ', day off' : ''}${d.rings.closed ? ', all rings closed' : ''}`}
          >
            <Text style={[s.label, d.isToday && s.labelToday]}>{d.label}</Text>
            <Rings
              minutes={d.rings.minutes} words={d.rings.words} sessions={d.rings.sessions}
              off={d.off && !d.count} faded={d.future} size={38}
            />
            <Text style={s.note}>{d.isToday ? 'today' : d.off ? 'off' : ''}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.rule} />
      <View style={s.totals}>
        <Text style={s.total}><Text style={s.bold}>{done.words.toLocaleString()}</Text> of {planned.words.toLocaleString()} words</Text>
        <Text style={s.total}><Text style={s.bold}>{formatDuration(done.seconds)}</Text> of {planned.minutes} min</Text>
        <Text style={s.total}><Text style={s.bold}>{done.count}</Text> of {planned.sessions} sessions</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  h: { fontSize: 16, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 12, color: colors.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { flex: 1, alignItems: 'center', gap: 4, minHeight: 44 },
  label: { fontSize: 11, fontWeight: '600', color: colors.muted },
  labelToday: { color: colors.royal, fontWeight: '800' },
  note: { fontSize: 10, color: colors.muted, height: 13 },
  rule: { height: 1, backgroundColor: colors.line },
  totals: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  total: { fontSize: 12.5, color: colors.body },
  bold: { fontWeight: '700', color: colors.ink },
});

