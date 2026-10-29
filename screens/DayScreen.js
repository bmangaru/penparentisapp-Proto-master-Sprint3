// screens/DayScreen.js — what you see after tapping a day bubble: that day's
// goal and stats, everything written that day, "Send to myself", and (for
// today) "Keep writing", which reopens the writing page with this text in it.

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen, Button } from '../components/ui';
import { colors, gradients, radius, space } from '../theme';
import Face from '../components/Face';
import { dayKey, daySummary, describeDailyGoal, isRestGoal, parseDayKey, pieceSegments } from '../writingLogic';
import { LEVEL_LABEL, normalizeLevel } from '../prompts';
import { LEVEL_STYLE } from '../components/usePromptLevel';
import RingStats from '../components/RingStats';
import { feelingLabel } from '../feelings';
import { deleteDay, loadAll, shareDays } from '../writingStore';

function timeOf(iso) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
}

// A prompt shown above its answer, in its level's colour.
function PromptAbove({ prompt, level }) {
  const l = normalizeLevel(level);
  const ls = LEVEL_STYLE[l];
  return (
    <View style={[s.answerPrompt, { backgroundColor: ls.tint, borderLeftColor: ls.solid }]}>
      <Text style={[s.answerKick, { color: ls.fg }]}>✦ {LEVEL_LABEL[l].toUpperCase()} PROMPT</Text>
      <Text style={s.answerText}>“{prompt}”</Text>
    </View>
  );
}

export default function DayScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const key = route.params?.day || dayKey();
  const isToday = key === dayKey();
  const [day, setDay] = useState(null);
  // Bumped each time the page opens, so the rings fill again.
  const [playKey, setPlayKey] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadAll().then(({ goals, sessions, dailyGoals }) => {
        setDay(daySummary(sessions, dailyGoals, key, goals));
        setPlayKey((n) => (n || 0) + 1);
      });
    }, [key])
  );

  const fullDate = parseDayKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  function confirmDelete() {
    Alert.alert(`Delete ${fullDate}?`, "This day's writing and stats will be removed from this phone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteDay(key); navigation.goBack(); } },
    ]);
  }

  const goalLine = day
    ? [
        day.goal && day.goal.plan === 'rest' ? 'Rest day' : day.goal && !day.goal.skipped ? `Goal: ${describeDailyGoal(day.goal)}` : 'No goal set',
        day.feeling ? `Felt ${feelingLabel(day.feeling).toLowerCase()}` : null,
      ].filter(Boolean).join(' · ')
    : '';

  return (
    <Screen>
      <LinearGradient colors={gradients.header} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back}>
          <Text style={s.backText}>‹  Brainstorm</Text>
        </Pressable>
        <Text style={s.title}>{fullDate}</Text>
        <Text style={s.goalLine}>{goalLine}</Text>
        {day && (
          <View style={s.rings}>
            <RingStats
              summary={day} rings={day.rings} off={isRestGoal(day.goal)} size={92}
              noGoal="no goal that day" playKey={playKey}
            />
          </View>
        )}
      </LinearGradient>

      <View style={s.pad}>
        <Text style={s.h}>{isToday ? 'What you wrote today' : 'What you wrote'}</Text>

        {day && day.pieces.length === 0 && (
          <Text style={s.empty}>Nothing was written this day.</Text>
        )}

        {day?.pieces.map((p) => (
          <View key={p.sessionIds[0]} style={s.piece}>
            <View style={s.pieceHead}>
              <Text style={s.pieceMeta}>
                {p.sessionIds.length > 1 ? `Started ${timeOf(p.firstAt)} · last saved ${timeOf(p.lastAt)}` : `Saved ${timeOf(p.lastAt)}`}
              </Text>
            </View>
            {p.answers ? (
              // Newer saves: each prompt sits right above the writing that answers it.
              pieceSegments(p.text, p.answers).length ? (
                pieceSegments(p.text, p.answers).map((g, i) => (g.type === 'prompt' ? (
                  <PromptAbove key={`p${i}`} prompt={g.prompt} level={g.level} />
                ) : (
                  <Text key={`t${i}`} style={[s.pieceText, s.pieceSeg]} selectable>{g.text}</Text>
                )))
              ) : (
                <Text style={s.pieceText}>Time only — no text saved</Text>
              )
            ) : (
              <>
                {p.prompts?.map((pr) => (
                  <Text key={pr} style={s.piecePrompt}>✦ Prompt: “{pr}”</Text>
                ))}
                <Text style={s.pieceText} selectable>{p.text.trim() || 'Time only — no text saved'}</Text>
              </>
            )}
            {p.feelings.length > 0 && (
              <View style={s.feelRow}>
                <Text style={s.feelLabel}>How you felt:</Text>
                {p.feelings.map((f) => (
                  <View key={f.at} style={s.feelChip}>
                    <Face id={f.feeling} size={18} />
                    <Text style={s.feelChipText}>{timeOf(f.at)} · {feelingLabel(f.feeling)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {day && day.pieces.length > 0 && (
          <Text style={s.note}>
            {isToday
              ? 'Each time you tap Keep writing, you add to this, and it all shows here.'
              : 'Send it to yourself to keep a copy in your email, Notes or Drive.'}
          </Text>
        )}

        <View style={{ height: space.sm }} />
        {day && day.pieces.length > 0 && (
          <Button label={isToday ? "Send today's writing to myself" : "Send this day's writing to myself"} onPress={() => shareDays(day)} />
        )}
        {isToday && (
          <Button label="Keep writing today" variant="outline" onPress={() => navigation.navigate('BrainstormWriter')} />
        )}
        {day && day.count > 0 && (
          <Pressable onPress={confirmDelete}><Text style={s.delete}>Delete this day</Text></Pressable>
        )}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { color: colors.cream, fontSize: 14, fontWeight: '700' },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginTop: 2 },
  goalLine: { color: 'rgba(255,255,255,0.84)', fontSize: 13, marginTop: 6 },
  rings: {
    marginTop: 16, padding: 14, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  pad: { padding: space.lg },
  h: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: space.sm },
  empty: { fontSize: 13.5, color: colors.muted },
  piece: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 16, marginBottom: 12, gap: 10 },
  pieceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  pieceMeta: { fontSize: 12, fontWeight: '700', color: colors.royal, flexShrink: 1 },
  feelRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  feelLabel: { fontSize: 12, color: '#4F5878', marginRight: 2 },
  feelChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCE4F7', borderRadius: radius.pill, paddingVertical: 3, paddingLeft: 4, paddingRight: 9 },
  feelChipText: { fontSize: 12, fontWeight: '700', color: colors.royalDeep },
  piecePrompt: { fontSize: 13, lineHeight: 19, color: '#8A5E12', backgroundColor: '#FFF8E6', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  pieceSeg: { marginBottom: 10 },
  answerPrompt: { borderLeftWidth: 3, borderTopRightRadius: 10, borderBottomRightRadius: 10, paddingVertical: 7, paddingHorizontal: 10, marginTop: 2, marginBottom: 8 },
  answerKick: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  answerText: { fontSize: 14, lineHeight: 19, color: colors.ink, marginTop: 2, fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }) },
  pieceText: { fontSize: 16, lineHeight: 25, color: colors.ink },
  note: { fontSize: 12.5, lineHeight: 18, color: colors.muted },
  delete: { color: '#B3261E', fontSize: 13, fontWeight: '700', textAlign: 'center', paddingVertical: 14 },
});
