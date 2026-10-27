// components/WeekRings.js — "This week": seven small ring sets, Sunday to
// Saturday (each day against its own goal), plus plain totals of what you
// wrote this week. A day you chose to rest is labelled "rest".

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Rings from './Rings';
import { colors, lift } from '../theme';
import { formatDuration } from '../writingLogic';

export default function WeekRings({ week, onPressDay }) {
  const { days, done, closedDays } = week;
  return (
    <View style={[s.card, lift]}>
      <View style={s.head}>
        <Text style={s.h}>This week</Text>
        <Text style={s.meta}>{closedDays} day{closedDays === 1 ? '' : 's'} with all rings closed</Text>
      </View>
      <View style={s.row}>
        {days.map((d) => (
          <Pressable
            key={d.key}
            style={s.day}
            onPress={() => onPressDay?.(d)}
            disabled={!d.count}
            accessibilityRole="button"
            accessibilityLabel={`${d.key}${d.off ? ', rest day' : ''}${d.rings.closed ? ', all rings closed' : ''}`}
          >
            <Text style={[s.label, d.isToday && s.labelToday]}>{d.label}</Text>
            <Rings
              minutes={d.rings.minutes} words={d.rings.words} sessions={d.rings.sessions}
              faded={d.future} size={38}
            />
            <Text style={s.note}>{d.isToday ? 'today' : d.off ? 'rest' : ''}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.rule} />
      <View style={s.totals}>
        <Total n={done.words.toLocaleString()} label={done.words === 1 ? 'word' : 'words'} />
        <Total n={formatDuration(done.seconds)} label="writing" divider />
        <Total n={String(done.count)} label={done.count === 1 ? 'session' : 'sessions'} divider />
      </View>
    </View>
  );
}

function Total({ n, label, divider }) {
  return (
    <View style={[s.totalBox, divider && s.divider]}>
      <Text style={s.totalN} numberOfLines={1}>{n}</Text>
      <Text style={s.totalL}>{label}</Text>
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
  totals: { flexDirection: 'row' },
  totalBox: { flex: 1, alignItems: 'center' },
  divider: { borderLeftWidth: 1, borderLeftColor: colors.line },
  totalN: { fontSize: 17, fontWeight: '800', color: colors.ink },
  totalL: { fontSize: 11.5, color: colors.muted, marginTop: 1 },
});

