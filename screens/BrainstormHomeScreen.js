// screens/BrainstormHomeScreen.js — the landing screen:
//   • Today: your three rings (minutes, words, sessions) + "Edit goals"
//   • a Start writing button that changes with the day
//   • This week: seven small ring sets, Sun–Sat, and the week's totals
//   • one white bubble per day of writing this week (tap to read it)
//   • the Medals card
// Goals are set in ONE place (GoalsSheet). "What's your goal today?" is asked
// once a day (TodayPlanSheet) and resets at midnight.

import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Screen, Header } from '../components/ui';
import RingStats from '../components/RingStats';
import WeekRings from '../components/WeekRings';
import GoalsSheet from '../components/GoalsSheet';
import TodayPlanSheet from '../components/TodayPlanSheet';
import DayBubble from '../components/DayBubble';
import MedalsCard from '../components/MedalsCard';
import NewMedalSheet from '../components/NewMedalSheet';
import { colors, gradients, lift, radius, space } from '../theme';
import {
  DEFAULT_GOALS, daySummary, describeDailyGoal, goalForDay, isRestGoal, parseDayKey, ringProgress,
  sessionsOnDay, startButtonState, summarize, weekDayKeys, weekSummary,
} from '../writingLogic';
import { loadAll, saveDailyGoal, saveGoals, syncMedals, useToday } from '../writingStore';
import PromptCard from '../components/PromptCard';

export default function BrainstormHomeScreen({ navigation }) {
  const today = useToday();
  const [data, setData] = useState({ goals: DEFAULT_GOALS, hasGoals: true, dailyGoals: {}, sessions: [] });

  const [goalsOpen, setGoalsOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const dismissedFor = useRef(null);
  // Bumped every time Brainstorm comes into view, so the Today rings fill again.
  const [playKey, setPlayKey] = useState(null);
  const startAfterPlan = useRef(false);

  // Medals: progress for the card, plus any tier earned since the last check
  // (e.g. a session closed with × instead of Finish) to celebrate here.
  const [medalState, setMedalState] = useState({ medals: [], record: {} });
  const [newMedals, setNewMedals] = useState([]);

  const reload = useCallback(async () => {
    const d = await loadAll();
    setData(d);
    const m = await syncMedals(d);
    setMedalState({ medals: m.medals, record: m.record });
    if (m.newlyEarned.length) setNewMedals(m.newlyEarned);
    return d;
  }, []);

  // First run → set goals once. After that, ask "What's your goal today?" once a day.
  function maybePrompt(d) {
    if (!d.hasGoals) setGoalsOpen(true);
    else if (!d.dailyGoals[today] && dismissedFor.current !== today) setPlanOpen(true);
  }

  // Reload whenever this screen regains focus (e.g. back from the typer), and
  // again when the clock passes midnight while it's open (`today` changes).
  useFocusEffect(
    useCallback(() => {
      // Start the fill once today's numbers are loaded.
      reload().then((d) => {
        setPlayKey((n) => n + 1);
        maybePrompt(d);
      });
    }, [today])
  );

  async function onSaveGoals(g) {
    const goals = await saveGoals(g);
    const next = { ...data, goals, hasGoals: true };
    setData(next);
    setGoalsOpen(false);
    if (!next.dailyGoals[today]) setTimeout(() => setPlanOpen(true), 350);
  }

  async function onPickPlan(plan) {
    const dailyGoals = await saveDailyGoal(plan, today);
    setData((d) => ({ ...d, dailyGoals }));
    setPlanOpen(false);
    // Came from "Set today's goal & start" → go straight to the page.
    if (startAfterPlan.current) {
      startAfterPlan.current = false;
      setTimeout(() => navigation.navigate('BrainstormWriter'), 300);
    }
  }

  function closePlan() {
    dismissedFor.current = today;
    startAfterPlan.current = false;
    setPlanOpen(false);
  }

  function onStartPress() {
    if (button.state === 'setGoal') {
      startAfterPlan.current = true;
      setPlanOpen(true);
    } else {
      navigation.navigate('BrainstormWriter');
    }
  }

  const { goals, dailyGoals, sessions } = data;
  const todayGoal = goalForDay(dailyGoals, goals, today);
  const todaySum = summarize(sessionsOnDay(sessions, today));
  const rings = ringProgress(todayGoal, todaySum);
  const rest = isRestGoal(todayGoal);
  const button = startButtonState(sessions, dailyGoals, today, goals);
  const week = weekSummary(sessions, dailyGoals, goals);
  // This week's days, newest first, up to today. A day only gets a white
  // bubble once something was written; earlier empty days show as dashed rows
  // and today shows nothing until the first session.
  const weekDays = weekDayKeys()
    .filter((k) => k <= today)
    .reverse()
    .map((k) => daySummary(sessions, dailyGoals, k, goals))
    .filter((d) => d.count > 0 || d.key !== today);

  const todayLabel = parseDayKey(today).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <Screen>
      <Header title="Brainstorm" subtitle="Small goals, kept quietly" />
      <View style={s.pad}>
        {/* Today: the three rings */}
        <LinearGradient colors={gradients.header} style={[s.today, lift]}>
          <View style={s.todayHead}>
            <Text style={s.todayLabel}>Today · {todayLabel}{rest ? ' · rest day' : ''}</Text>
            <Pressable onPress={() => setPlanOpen(true)} hitSlop={8}>
              <Text style={s.todayLink}>{rest ? 'Plan today' : 'Change today'}</Text>
            </Pressable>
          </View>
          <RingStats summary={todaySum} rings={rings} off={rest} playKey={playKey} />
          <Pressable onPress={() => setGoalsOpen(true)} style={s.editGoals}>
            <Text style={s.editGoalsText}>Edit goals</Text>
          </Pressable>
        </LinearGradient>

        {/* Start writing — label and action change with the day */}
        <Pressable onPress={onStartPress} style={({ pressed }) => [lift, s.startWrap, pressed && { opacity: 0.92 }]}>
          <LinearGradient colors={button.state === 'met' ? gradients.gold : gradients.button} style={s.start}>
            <Text style={[s.startTitle, button.state === 'met' && { color: '#231702' }]}>{button.title}</Text>
            <Text style={[s.startSub, button.state === 'met' && { color: '#3D2A05' }]}>{button.sub}</Text>
          </LinearGradient>
        </Pressable>

        {/* Today's prompt (same card as Home) */}
        <PromptCard onWrite={(prompt) => navigation.navigate('BrainstormWriter', { prompt })} />

        {/* This week: seven ring sets */}
        <WeekRings
          week={week}
          onPressDay={(d) => navigation.navigate('BrainstormDay', { day: d.key })}
        />

        {/* One bubble per day */}
        <View style={s.titleRow}>
          <Text style={s.h}>Your writing</Text>
          <Text style={s.meta}>tap a day to read it</Text>
        </View>
        {weekDays.length === 0 && (
          <Text style={s.empty}>Your first day of writing this week will show up here.</Text>
        )}
        {weekDays.map((d) => (
          <DayBubble
            key={d.key}
            day={d}
            isToday={d.key === today}
            onPress={() => navigation.navigate('BrainstormDay', { day: d.key })}
          />
        ))}
        <Pressable onPress={() => navigation.navigate('MyWriting')} style={s.allLink}>
          <Text style={s.link}>See all my writing  ›</Text>
        </Pressable>

        <MedalsCard medals={medalState.medals} record={medalState.record} onPress={() => navigation.navigate('Medals')} />
      </View>

      <GoalsSheet
        visible={goalsOpen}
        goals={goals}
        firstTime={!data.hasGoals}
        onSave={onSaveGoals}
        onClose={() => setGoalsOpen(false)}
      />

      <TodayPlanSheet
        visible={planOpen && !goalsOpen}
        goals={goals}
        today={today}
        current={dailyGoals[today]}
        onPick={onPickPlan}
        onEditGoals={() => { setPlanOpen(false); setTimeout(() => setGoalsOpen(true), 300); }}
        onClose={closePlan}
      />

      {newMedals.length > 0 && !planOpen && !goalsOpen && (
        <NewMedalSheet
          earned={newMedals}
          onClose={() => setNewMedals([])}
          onSeeAll={() => { setNewMedals([]); navigation.navigate('Medals'); }}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.lg, gap: space.md },
  today: { borderRadius: radius.lg, padding: 18, gap: 14 },
  todayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  todayLabel: { fontSize: 12.5, fontWeight: '700', color: 'rgba(255,255,255,0.88)' },
  todayLink: { fontSize: 12.5, fontWeight: '700', color: colors.cream, textDecorationLine: 'underline' },
  editGoals: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  editGoalsText: { color: colors.cream, fontSize: 12.5, fontWeight: '700', textDecorationLine: 'underline' },
  startWrap: { borderRadius: radius.md },
  start: { borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', gap: 3 },
  startTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  startSub: { fontSize: 12, color: 'rgba(255,255,255,0.88)', textAlign: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.xs },
  h: { fontSize: 15, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 12, color: colors.muted },
  empty: { fontSize: 13, color: colors.muted },
  allLink: { alignItems: 'center', paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  link: { color: colors.royal, fontSize: 13, fontWeight: '700' },
});

export { describeDailyGoal };
