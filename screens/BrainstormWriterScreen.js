// screens/BrainstormWriterScreen.js — "a typer": minimal chrome, full-screen,
// a fresh stopwatch each time you enter, nothing between you and the page.
//
// Every session is logged and saved (text included) the moment you leave —
// via "Finish & check in", the ×, or the Android back button. Finishing opens
// ONE sheet: saved, today's goal, any new medal, and "How do you feel?". Pasting is
// blocked so the word count only ever reflects words actually typed.
// A writing prompt (from Brainstorm's "Write with this", or "Stuck? Try a
// prompt" on an empty page) sits above the page. It's never part of the text,
// so it never counts toward your words, and it's saved with the session.
// The ✦ button in the top bar shows one any time; after 45 seconds without
// typing, a gentle "Stuck?" card offers one too (it goes away when you type).

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, AppState, Animated, LayoutAnimation,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SessionDoneSheet from '../components/SessionDoneSheet';
import LiveRings from '../components/LiveRings';
import { colors, radius, space } from '../theme';
import {
  appRatingFor, countWords, dayKey, dailyPct, goalForDay, looksLikePaste, sessionsOnDay, summarize, textToContinue,
} from '../writingLogic';
import { loadAll, saveSession, shareWriting, syncMedals } from '../writingStore';
import { nextPrompt, promptForDay } from '../prompts';

export default function BrainstormWriterScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  // One session per visit to this screen. Its day is the day it *started*,
  // so a session that runs past midnight still counts toward the day you began.
  const session = useRef({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    startedAt: new Date().toISOString(),
    day: dayKey(),
    hour: new Date().getHours() + new Date().getMinutes() / 60,
  }).current;

  const [text, setText] = useState('');
  const [seconds, setSeconds] = useState(0);
  const secondsRef = useRef(0);
  secondsRef.current = seconds;
  const [effortWords, setEffortWords] = useState(0); // counts words you later deleted
  const [blockedPastes, setBlockedPastes] = useState(0);
  const [notice, setNotice] = useState('');
  const [paused, setPaused] = useState(false);
  const [prompt, setPrompt] = useState(route?.params?.prompt || null);
  // Stopwatch second of the last keystroke, for the "Stuck?" nudge.
  const lastTypedAt = useRef(0);
  const [nudgeOff, setNudgeOff] = useState(false); // × on the nudge: no more nudges this session

  const [dailyGoal, setDailyGoal] = useState(null);
  const [earlierToday, setEarlierToday] = useState({ words: 0, seconds: 0, count: 0 });

  // The one end-of-session sheet: saved + goal + new medal + "How do you feel?".
  const [sheet, setSheet] = useState(null); // null | 'done'
  const [newMedals, setNewMedals] = useState([]);
  const [feeling, setFeeling] = useState(null);
  const finishedRec = useRef(null);

  const highestThisEntry = useRef(0);
  const textRef = useRef('');
  const latest = useRef({});
  const saved = useRef(false);
  const noticeTimer = useRef(null);

  // "Keep writing": if there's writing from earlier today, open with it in
  // the box. Only words typed beyond it count toward this session.
  const [ready, setReady] = useState(false);
  const [resumedAt, setResumedAt] = useState(null);
  // "Picking up where you left off": fades out after 4 s, or tap ✕.
  const [showResume, setShowResume] = useState(true);
  const resumeFade = useRef(new Animated.Value(1)).current;
  function hideResume() {
    Animated.timing(resumeFade, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setShowResume(false);
    });
  }
  useEffect(() => {
    if (!resumedAt) return undefined;
    const id = setTimeout(hideResume, 4000);
    return () => clearTimeout(id);
  }, [resumedAt]);
  const continues = useRef(false);

  useEffect(() => {
    loadAll().then(({ goals, dailyGoals, sessions }) => {
      setDailyGoal(goalForDay(dailyGoals, goals, session.day));
      setEarlierToday(summarize(sessionsOnDay(sessions, session.day)));
      const piece = textToContinue(sessions, session.day);
      if (piece && piece.text.trim()) {
        const t = piece.text.replace(/\s*$/, ' ');
        textRef.current = t;
        highestThisEntry.current = countWords(t);
        continues.current = true;
        setText(t);
        setResumedAt(piece.lastAt);
      }
      setReady(true);
    });
  }, []);

  // Stopwatch. Stops while the app is in the background or the check-in is open.
  const [appActive, setAppActive] = useState(true);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setAppActive(st === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (paused || !appActive || sheet) return undefined;
    const id = setInterval(() => setSeconds((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [paused, appActive, sheet]);

  function flash(msg) {
    setNotice(msg);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 3200);
  }

  function onChangeText(t) {
    const prev = textRef.current;
    if (looksLikePaste(prev, t)) {
      // Let the native input take the change for one frame, then put the old
      // text back — setting the same value twice in a row wouldn't re-sync it.
      setText(t);
      requestAnimationFrame(() => setText(prev));
      setBlockedPastes((n) => n + 1);
      flash("Pasting is off in the typer — type it in and it'll count.");
      return;
    }
    textRef.current = t;
    setText(t);
    lastTypedAt.current = secondsRef.current;
    const words = countWords(t);
    if (words > highestThisEntry.current) {
      const delta = words - highestThisEntry.current;
      highestThisEntry.current = words;
      setEffortWords((w) => w + delta);
    }
    // Deleting text does NOT reduce the count — effort already spent stays counted.
  }

  const todayTotals = {
    words: earlierToday.words + effortWords,
    seconds: earlierToday.seconds + seconds,
    count: earlierToday.count + 1, // this session counts toward the sessions ring
  };
  const pct = dailyPct(dailyGoal, todayTotals);
  const STUCK_AFTER = 45; // seconds without typing
  const showNudge = ready && !prompt && !nudgeOff && !paused && !sheet && seconds - lastTypedAt.current >= STUCK_AFTER;

  function showPrompt() {
    setPrompt((p) => p || promptForDay(session.day));
  }
  // Goal status (exceeded / met / some / none). Not shown as a rating any more;
  // it only colours the weekly chart and the day bubble's progress bar.
  const appRating = appRatingFor(pct);

  function buildRecord(extra = {}) {
    return {
      ...session,
      endedAt: new Date().toISOString(),
      seconds,
      words: effortWords,
      finalWords: countWords(textRef.current),
      text: textRef.current,
      blockedPastes,
      dailyGoal,
      pct,
      appRating,
      feeling: null,
      continues: continues.current,
      prompt: prompt || null,
      ...extra,
    };
  }
  latest.current = buildRecord;

  // Safety net: however the screen is left, the session gets saved.
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', () => {
      if (saved.current) return;
      const rec = latest.current();
      if (rec.words > 0 || rec.seconds >= 60) {
        saved.current = true;
        saveSession(rec);
      }
    });
    return unsub;
  }, [navigation]);

  async function finish() {
    // Opened the page and left without writing anything new: nothing to log.
    if (effortWords === 0 && seconds < 60) {
      saved.current = true;
      navigation.goBack();
      return;
    }
    const rec = buildRecord();
    finishedRec.current = rec;
    saved.current = true;
    await saveSession(rec);
    const { newlyEarned } = await syncMedals();
    setNewMedals(newlyEarned);
    setSheet('done');
  }

  // Saved straight away, so the choice sticks even if the app is closed next.
  function pickFeeling(id) {
    setFeeling(id);
    finishedRec.current = { ...finishedRec.current, feeling: id };
    saveSession(finishedRec.current);
  }

  function done() {
    setSheet(null);
    navigation.goBack();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.topBar, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={s.close}>×</Text>
        </Pressable>
        <View style={s.barRight}>
          <Pressable
            onPress={() => (prompt ? setPrompt(nextPrompt(prompt)) : showPrompt())}
            hitSlop={6}
            style={[s.promptBtn, prompt && s.promptBtnOn]}
            accessibilityRole="button"
            accessibilityLabel={prompt ? 'Another prompt' : 'Show a writing prompt'}
          >
            <Text style={[s.promptBtnText, prompt && { color: '#2A1A00' }]}>✦ Prompt</Text>
          </Pressable>
          <Pressable onPress={() => setPaused((p) => !p)} hitSlop={8} style={s.pauseBtn} accessibilityRole="button">
            <Text style={s.pauseText}>{paused ? 'Resume' : 'Pause'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Today's rings, live: earlier writing today + this session. */}
      <LiveRings goal={dailyGoal} totals={todayTotals} />

      {notice ? (
        <View style={s.notice}><Text style={s.noticeText}>{notice}</Text></View>
      ) : resumedAt && showResume ? (
        <Animated.View style={[s.notice, s.noticeRow, { opacity: resumeFade }]}>
          <Text style={[s.noticeText, { flex: 1 }]}>
            Picking up where you left off at {new Date(resumedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </Text>
          <Pressable onPress={hideResume} hitSlop={10} style={s.noticeX} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={s.noticeXText}>✕</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {prompt ? (
        <View style={s.prompt}>
          <Text style={s.promptKick}>✦ PROMPT</Text>
          <Text style={s.promptText}>“{prompt}”</Text>
          <View style={s.promptLinks}>
            <Pressable onPress={() => setPrompt(nextPrompt(prompt))} hitSlop={8} accessibilityRole="button">
              <Text style={s.promptLink}>↻ Another</Text>
            </Pressable>
            <Pressable onPress={() => setPrompt(null)} hitSlop={8} accessibilityRole="button">
              <Text style={[s.promptLink, { color: colors.muted }]}>Hide</Text>
            </Pressable>
          </View>
        </View>
      ) : ready && !text.trim() ? (
        <Pressable onPress={() => setPrompt(promptForDay(session.day))} style={s.chip} accessibilityRole="button">
          <Text style={s.chipText}>✦ Stuck? Try a prompt</Text>
        </Pressable>
      ) : null}

      {ready ? (
        <TextInput
          value={text}
          onChangeText={onChangeText}
          multiline
          autoFocus
          contextMenuHidden // hides Copy / Paste on long-press (iOS + Android)
          placeholder="Start typing…"
          placeholderTextColor={colors.muted}
          style={s.editor}
          textAlignVertical="top"
        />
      ) : (
        <View style={s.editor} />
      )}

      {showNudge ? (
        <View style={s.nudge}>
          <Text style={s.nudgeIcon}>✦</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.nudgeTitle}>Stuck?</Text>
            <Text style={s.nudgeSub}>Try a prompt to keep going</Text>
          </View>
          <Pressable onPress={showPrompt} style={s.nudgeBtn} accessibilityRole="button">
            <Text style={s.nudgeBtnText}>Show me one</Text>
          </Pressable>
          <Pressable onPress={() => setNudgeOff(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Not now">
            <Text style={s.nudgeX}>×</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable style={s.finishBtn} onPress={finish}>
          <Text style={s.finishText}>Finish &amp; check in</Text>
        </Pressable>
      </View>

      <SessionDoneSheet
        visible={sheet === 'done'}
        words={effortWords}
        seconds={seconds}
        dailyGoal={dailyGoal}
        todayTotals={todayTotals}
        pct={pct}
        newMedals={newMedals}
        feeling={feeling}
        onPickFeeling={pickFeeling}
        onShare={() => shareWriting(finishedRec.current || buildRecord())}
        onDone={done}
        onMedalPress={() => { setSheet(null); navigation.replace('Medals'); }}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: 10 },
  close: { fontSize: 28, color: colors.muted, lineHeight: 28 },
  nudge: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: space.lg, marginBottom: 10,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: colors.karmaLight, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12,
  },
  nudgeIcon: { fontSize: 18, color: '#8A5E12' },
  nudgeTitle: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  nudgeSub: { fontSize: 11.5, color: colors.muted },
  nudgeBtn: { backgroundColor: colors.royal, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 10, minHeight: 36, justifyContent: 'center' },
  nudgeBtnText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  nudgeX: { fontSize: 20, color: colors.muted, paddingHorizontal: 2 },
  barRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promptBtn: {
    minHeight: 32, paddingHorizontal: 12, borderRadius: radius.pill, justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.karmaLight, backgroundColor: '#FFF8E6',
  },
  promptBtnOn: { backgroundColor: colors.karmaLight },
  promptBtnText: { fontSize: 12.5, fontWeight: '800', color: '#8A5E12' },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  noticeX: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,22,51,0.07)' },
  noticeXText: { fontSize: 13, color: colors.muted, fontWeight: '700' },
  pauseBtn: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.cream },
  pauseText: { fontSize: 12, fontWeight: '700', color: colors.royalDeep },
  notice: { marginHorizontal: space.lg, marginBottom: 6, backgroundColor: colors.cream, borderRadius: radius.sm, padding: 10 },
  noticeText: { fontSize: 12.5, color: colors.body },
  prompt: { backgroundColor: '#FFF8E6', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EAD9B6', paddingHorizontal: space.lg, paddingVertical: 12, marginBottom: 8 },
  promptKick: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, color: '#8A5E12' },
  promptText: { fontSize: 16, lineHeight: 23, color: colors.ink, marginTop: 4, fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }) },
  promptLinks: { flexDirection: 'row', gap: 18, marginTop: 8 },
  promptLink: { fontSize: 13, fontWeight: '700', color: colors.royal, minHeight: 24 },
  chip: {
    alignSelf: 'flex-start', marginLeft: space.lg, marginBottom: 8, minHeight: 36, justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.karmaLight, backgroundColor: '#FFF8E6', borderRadius: 999, paddingHorizontal: 12,
  },
  chipText: { fontSize: 12.5, fontWeight: '700', color: '#8A5E12' },
  editor: { flex: 1, paddingHorizontal: space.lg, fontSize: 17, lineHeight: 26, color: colors.ink },
  bottomBar: { paddingHorizontal: space.lg, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  finishBtn: { backgroundColor: colors.royal, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center' },
  finishText: { color: '#fff', fontWeight: '700', fontSize: 14.5 },
});
