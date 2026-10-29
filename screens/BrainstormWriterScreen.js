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
// ✦ Prompt in the top bar shows / hides it; after 45 seconds without typing, a
// gentle "Stuck?" card offers one too (it goes away when you type). The prompt
// card is tinted in its level's colour (Simple / Thoughtful / Deep).
//
// Autosave: a draft is saved about 2 s after you stop typing (and when the app
// goes to the background); the cloud by ✕ shows "Saving…" then "✓ Saved".
// Aa: text size (5 steps, remembered) and Focus mode (just your words).
//
// The clock: after a minute with no typing or scrolling it auto-pauses (that
// quiet minute still counts — thinking is writing). Typing always resumes it,
// whether it was auto-paused or paused with the button. Scrolling, and using
// the prompt (show, Refresh, level), keep a running clock alive — but only
// within 3 minutes of your last typing — and never restart a paused one.

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, AppState, Animated, LayoutAnimation, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SessionDoneSheet from '../components/SessionDoneSheet';
import LiveRings from '../components/LiveRings';
import { colors, radius, space } from '../theme';
import {
  appRatingFor, countWords, creditWords, editPoint, wordBag, dayKey, dailyPct, goalForDay, looksLikePaste, sessionsOnDay, summarize, textToContinue,
} from '../writingLogic';
import { loadAll, saveSession, shareWriting, syncMedals } from '../writingStore';
import { LEVEL_LABEL, nextLevel, nextPrompt, promptForDay } from '../prompts';
import usePromptLevel, { LEVEL_STYLE } from '../components/usePromptLevel';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

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
  // Words credited this session: every word typed counts, even if later
  // deleted or reworded; retyping a word already credited doesn't (see
  // creditWords in writingLogic). The word being typed is added live below.
  const [effortWords, setEffortWords] = useState(0);
  const bestWords = useRef({}); // per word: most times it's been on the page
  // Was the last edit adding text? Used at Finish: a last word you were still
  // typing (no space after it yet) counts — but not a fragment left mid-delete.
  const typingForward = useRef(false);
  const [blockedPastes, setBlockedPastes] = useState(0);
  const [notice, setNotice] = useState('');
  const [paused, setPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState(null); // null | 'you' | 'idle'
  // Last time you typed or scrolled (ms). A minute without either auto-pauses.
  const lastActive = useRef(Date.now());
  // Last time you typed (ms). Scrolling and prompt taps only keep the clock
  // alive within BROWSE_GRACE_MS of this, so they can't run it forever.
  const lastTyped = useRef(Date.now());
  const [backToast, setBackToast] = useState(false);
  const toastTimer = useRef(null);
  function pauseClock(reason) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPaused(true);
    setPauseReason(reason);
  }
  function resumeClock(withToast) {
    lastActive.current = Date.now();
    lastTyped.current = Date.now(); // a fresh start: browsing counts again
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPaused(false);
    setPauseReason(null);
    if (withToast) {
      setBackToast(true);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setBackToast(false), 1800);
    }
  }
  // Scrolling / prompt taps: count as activity only if you've typed recently.
  function markActive() {
    if (Date.now() - lastTyped.current < BROWSE_GRACE_MS) lastActive.current = Date.now();
  }
  const [prompt, setPrompt] = useState(route?.params?.prompt || null);
  // Simple / Thoughtful / Deep — shared with Brainstorm and Home.
  const [level, setLevel] = usePromptLevel();
  function pickLevel(l) {
    markActive();
    setLevel(l);
    setPrompt(promptForDay(session.day, l));
  }
  const ls = LEVEL_STYLE[level];

  // Autosave status shown by ✕: null (nothing to save yet) | 'saving' | 'saved'.
  const [saveState, setSaveState] = useState(null);
  // Aa menu: text size + focus mode.
  const [menuOpen, setMenuOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [sizeIdx, setSizeIdx] = useState(DEFAULT_SIZE);
  useEffect(() => {
    AsyncStorage.getItem(TEXT_SIZE_KEY).then((v) => {
      const n = Number(v);
      if (v != null && n >= 0 && n < TEXT_SIZES.length) setSizeIdx(n);
    }).catch(() => {});
  }, []);
  function changeSize(dir) {
    setSizeIdx((i) => {
      const n = Math.min(TEXT_SIZES.length - 1, Math.max(0, i + dir));
      AsyncStorage.setItem(TEXT_SIZE_KEY, String(n)).catch(() => {});
      return n;
    });
  }
  function toggleFocus(on) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFocus(on);
    setMenuOpen(false);
  }

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
        bestWords.current = wordBag(t); // earlier writing is already counted
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
    const sub = AppState.addEventListener('change', (st) => {
      setAppActive(st === 'active');
      // Coming back to the app gives you a fresh minute before auto-pause.
      if (st === 'active') { lastActive.current = Date.now(); lastTyped.current = Date.now(); }
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (paused || !appActive || sheet) return undefined;
    const id = setInterval(() => {
      // A full minute with no typing or scrolling: stop the clock. The quiet
      // minute itself was already counted second by second.
      if (Date.now() - lastActive.current >= IDLE_PAUSE_MS) {
        pauseClock('idle');
        return;
      }
      setSeconds((x) => x + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [paused, appActive, sheet]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

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
    lastTyped.current = Date.now();
    lastActive.current = Date.now();
    if (paused) resumeClock(true); // typing always picks the clock back up
    typingForward.current = t.length > prev.length;
    // Credit finished words that are new to this entry (not the one being typed).
    const { best, gained } = creditWords(bestWords.current, wordBag(t, editPoint(prev, t)));
    bestWords.current = best;
    if (gained > 0) setEffortWords((w) => w + gained);
    // Deleting text does NOT reduce the count — effort already spent stays counted.
  }

  // The live count only moves when a word is finished (space or punctuation),
  // so it never blinks up or down while you type or delete letters.
  const liveWords = effortWords;
  // At Finish / save: plus the last word if you were still typing it.
  function finalWords() {
    const pending = typingForward.current ? creditWords(bestWords.current, wordBag(textRef.current)).gained : 0;
    return effortWords + pending;
  }
  const todayTotals = {
    words: earlierToday.words + liveWords,
    seconds: earlierToday.seconds + seconds,
    count: earlierToday.count + 1, // this session counts toward the sessions ring
  };
  const pct = dailyPct(dailyGoal, todayTotals);
  const STUCK_AFTER = 45; // seconds without typing
  const showNudge = ready && !prompt && !nudgeOff && !paused && !sheet && seconds - lastTypedAt.current >= STUCK_AFTER;

  function showPrompt() {
    markActive();
    setPrompt((p) => p || promptForDay(session.day, level));
  }
  // ✦ Prompt: tap to show, tap again to hide.
  function togglePrompt() {
    markActive();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (prompt) setPrompt(null);
    else showPrompt();
  }
  // Goal status (exceeded / met / some / none). Not shown as a rating any more;
  // it only colours the weekly chart and the day bubble's progress bar.
  const appRating = appRatingFor(pct);

  function buildRecord(extra = {}) {
    return {
      ...session,
      endedAt: new Date().toISOString(),
      seconds,
      words: finalWords(),
      finalWords: countWords(textRef.current),
      text: textRef.current,
      blockedPastes,
      dailyGoal,
      pct,
      appRating,
      feeling: null,
      continues: continues.current,
      prompt: prompt || null,
      draft: false,
      ...extra,
    };
  }
  latest.current = buildRecord;

  // Autosave: once there are new words, save a draft ~2 s after typing stops.
  // It's the same session (same id), so Finish just updates it.
  const autosave = useRef(null);
  const draftSaving = useRef(Promise.resolve()); // so the final save never races a draft
  async function saveDraft() {
    if (saved.current) return; // already finished
    const rec = latest.current({ draft: true });
    if (rec.words <= 0) return;
    setSaveState('saving');
    draftSaving.current = draftSaving.current.then(() => (saved.current ? null : saveSession(rec))).catch(() => {});
    await draftSaving.current;
    setSaveState('saved');
  }
  useEffect(() => {
    if (!ready || liveWords <= 0 || saved.current) return undefined;
    setSaveState('saving');
    clearTimeout(autosave.current);
    autosave.current = setTimeout(saveDraft, 2000);
    return () => clearTimeout(autosave.current);
  }, [text, prompt]);
  // Leaving the app (home screen, a call…) saves straight away too.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') { clearTimeout(autosave.current); saveDraft(); }
    });
    return () => sub.remove();
  }, []);

  // Safety net: however the screen is left, the session gets saved.
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', () => {
      if (saved.current) return;
      const rec = latest.current();
      if (rec.words > 0 || rec.seconds >= 60) {
        saved.current = true;
        clearTimeout(autosave.current);
        draftSaving.current.then(() => saveSession(rec));
      }
    });
    return unsub;
  }, [navigation]);

  async function finish() {
    // Opened the page and left without writing anything new: nothing to log.
    if (finalWords() === 0 && seconds < 60) {
      saved.current = true;
      navigation.goBack();
      return;
    }
    const rec = buildRecord();
    finishedRec.current = rec;
    saved.current = true;
    clearTimeout(autosave.current);
    await draftSaving.current;
    await saveSession(rec);
    setSaveState('saved');
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
        <View style={s.barLeft}>
          {!focus ? (
            <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={s.close}>×</Text>
            </Pressable>
          ) : null}
          <SaveBadge state={saveState} />
        </View>
        {focus ? (
          <Pressable onPress={() => toggleFocus(false)} hitSlop={8} style={s.exitFocus} accessibilityRole="button">
            <Text style={s.exitFocusText}>⤡ Exit focus</Text>
          </Pressable>
        ) : (
          <View style={s.barRight}>
            <Pressable
              onPress={togglePrompt}
              hitSlop={6}
              style={[s.promptBtn, prompt && { backgroundColor: ls.solid, borderColor: ls.solid }]}
              accessibilityRole="button"
              accessibilityLabel={prompt ? 'Hide the prompt' : 'Show a writing prompt'}
            >
              <Text style={[s.promptBtnText, prompt && { color: '#FFFFFF' }]}>✦ Prompt</Text>
            </Pressable>
            <Pressable
              onPress={() => setMenuOpen((o) => !o)}
              hitSlop={6}
              style={[s.aaBtn, menuOpen && s.aaBtnOn]}
              accessibilityRole="button"
              accessibilityLabel="Text size and focus mode"
            >
              <Text style={s.aaText}>Aa</Text>
            </Pressable>
            <Pressable
              onPress={() => (paused ? resumeClock(false) : pauseClock('you'))}
              hitSlop={8}
              style={[s.pauseBtn, paused && s.resumeBtn]}
              accessibilityRole="button"
            >
              <Text style={[s.pauseText, paused && { color: '#FFFFFF' }]}>{paused ? 'Resume' : 'Pause'}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Today's rings, live: earlier writing today + this session. */}
      {!focus ? <LiveRings goal={dailyGoal} totals={todayTotals} clock={paused ? 'paused' : 'running'} /> : null}

      {/* Paused (by you or after a quiet minute): typing picks it back up.
          Shown even in Focus mode, since the clock matters there too. */}
      {paused && !sheet ? (
        <View style={s.pauseNote} accessibilityLiveRegion="polite">
          <View style={s.pauseIcon}><Ionicons name="pause" size={13} color={colors.muted} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.pauseTitle}>{pauseReason === 'idle' ? 'Paused, you’ve been quiet a minute' : 'Paused'}</Text>
            <Text style={s.pauseSub}>{pauseReason === 'idle' ? 'Start typing and the clock picks up.' : 'Typing picks it back up, or tap Resume.'}</Text>
          </View>
        </View>
      ) : null}

      {focus ? null : notice ? (
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

      {focus ? null : prompt ? (
        <View style={[s.prompt, { backgroundColor: ls.tint, borderLeftColor: ls.solid }]}>
          <View style={s.promptTop}>
            <Pressable
              onPress={() => pickLevel(nextLevel(level))}
              hitSlop={6}
              style={[s.levelChip, { borderColor: ls.solid }]}
              accessibilityRole="button"
              accessibilityLabel={`Prompt level: ${LEVEL_LABEL[level]}. Tap to change`}
            >
              <Text style={[s.levelChipText, { color: ls.fg }]}>✦ {LEVEL_LABEL[level]} ▾</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => { markActive(); setPrompt(nextPrompt(prompt, level)); }} hitSlop={6} style={s.promptAct} accessibilityRole="button" accessibilityLabel="Refresh prompt">
              <Text style={[s.promptActText, { color: ls.fg }]}>↻ Refresh</Text>
            </Pressable>
            <Pressable onPress={togglePrompt} hitSlop={6} style={s.promptAct} accessibilityRole="button" accessibilityLabel="Hide the prompt">
              <Text style={[s.promptActText, { color: colors.muted }]}>✕</Text>
            </Pressable>
          </View>
          <Text style={s.promptText}>“{prompt}”</Text>
        </View>
      ) : ready && !text.trim() ? (
        <Pressable onPress={showPrompt} style={s.chip} accessibilityRole="button">
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
          onScroll={markActive} // rereading keeps a running clock alive (never restarts a paused one)
          onSelectionChange={markActive}
          style={[s.editor, { fontSize: TEXT_SIZES[sizeIdx], lineHeight: Math.round(TEXT_SIZES[sizeIdx] * 1.53) }]}
          textAlignVertical="top"
        />
      ) : (
        <View style={s.editor} />
      )}

      {showNudge && !focus ? (
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

      {backToast ? (
        <View style={s.toastWrap} pointerEvents="none">
          <View style={s.toast}><Text style={s.toastText}><Text style={{ color: '#9BE3B0' }}>▶</Text>  Back on the clock</Text></View>
        </View>
      ) : null}

      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable style={s.finishBtn} onPress={finish}>
          <Text style={s.finishText}>Finish &amp; check in</Text>
        </Pressable>
      </View>

      {menuOpen ? (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} accessibilityLabel="Close menu" />
          <View style={[s.menu, { top: insets.top + 56 }]}>
            <Text style={s.menuLabel}>TEXT SIZE</Text>
            <View style={s.sizeRow}>
              <Pressable onPress={() => changeSize(-1)} disabled={sizeIdx === 0} style={[s.sizeBtn, sizeIdx === 0 && { opacity: 0.35 }]} accessibilityRole="button" accessibilityLabel="Smaller text">
                <Text style={[s.sizeBtnText, { fontSize: 13 }]}>A−</Text>
              </Pressable>
              <View style={s.dots}>
                {TEXT_SIZES.map((_, i) => <View key={i} style={[s.dot, i === sizeIdx && s.dotOn]} />)}
              </View>
              <Pressable onPress={() => changeSize(1)} disabled={sizeIdx === TEXT_SIZES.length - 1} style={[s.sizeBtn, sizeIdx === TEXT_SIZES.length - 1 && { opacity: 0.35 }]} accessibilityRole="button" accessibilityLabel="Larger text">
                <Text style={[s.sizeBtnText, { fontSize: 17 }]}>A+</Text>
              </Pressable>
            </View>
            <View style={s.focusRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.focusTitle}>Focus mode</Text>
                <Text style={s.focusSub}>Hide everything but your words</Text>
              </View>
              <Switch
                value={focus}
                onValueChange={toggleFocus}
                trackColor={{ false: '#D9DDE7', true: colors.royal }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#D9DDE7"
                accessibilityLabel="Focus mode"
              />
            </View>
          </View>
        </>
      ) : null}

      <SessionDoneSheet
        visible={sheet === 'done'}
        words={finishedRec.current ? finishedRec.current.words : liveWords}
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

// A minute with no typing or scrolling pauses the clock.
const IDLE_PAUSE_MS = 60 * 1000;
// Scrolling and prompt taps keep the clock alive only within 3 minutes of
// your last typing (or of opening / resuming the page).
const BROWSE_GRACE_MS = 3 * 60 * 1000;

// Writing text sizes (A− / A+), remembered on the phone.
const TEXT_SIZES = [15, 17, 19, 22, 25];
const DEFAULT_SIZE = 1;
const TEXT_SIZE_KEY = 'pp.writerTextSize.v1';

// The little cloud by ✕: "Saving…" while you type, "✓ Saved" once stored.
function SaveBadge({ state }) {
  if (!state) return null;
  const saving = state === 'saving';
  const color = saving ? '#8A93AE' : '#1E7B3A';
  return (
    <View style={s.save} accessibilityLiveRegion="polite" accessibilityLabel={saving ? 'Saving' : 'Saved'}>
      <Ionicons name={saving ? 'cloud-upload-outline' : 'cloud-done-outline'} size={15} color={color} />
      <Text style={[s.saveText, { color }]}>{saving ? 'Saving…' : 'Saved'}</Text>
    </View>
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
  barLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
  save: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  saveText: { fontSize: 11.5, fontWeight: '700' },
  exitFocus: { backgroundColor: '#EEF1F7', borderRadius: radius.pill, paddingHorizontal: 12, minHeight: 32, justifyContent: 'center' },
  exitFocusText: { fontSize: 12.5, fontWeight: '700', color: colors.muted },
  aaBtn: { minHeight: 32, paddingHorizontal: 11, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: '#EEF1F7', borderWidth: 1.5, borderColor: 'transparent' },
  aaBtnOn: { borderColor: colors.royal, backgroundColor: '#E6ECFA' },
  aaText: { fontSize: 12.5, fontWeight: '800', color: colors.royalDeep },
  prompt: { marginHorizontal: space.lg, marginBottom: 8, borderRadius: radius.md, borderLeftWidth: 4, paddingVertical: 10, paddingLeft: 12, paddingRight: 10 },
  promptTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  levelChip: { backgroundColor: '#FFFFFF', borderRadius: radius.pill, borderWidth: 1.5, paddingHorizontal: 10, minHeight: 28, justifyContent: 'center' },
  levelChipText: { fontSize: 12, fontWeight: '800' },
  promptAct: { minHeight: 30, paddingHorizontal: 9, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.75)' },
  promptActText: { fontSize: 12.5, fontWeight: '800' },
  promptText: { fontSize: 16, lineHeight: 23, color: colors.ink, marginTop: 8, fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }) },
  menu: {
    position: 'absolute', right: space.lg, width: 250, backgroundColor: '#FFFFFF', borderRadius: radius.md, padding: 12,
    borderWidth: 1, borderColor: colors.line,
    shadowColor: colors.royalDeep, shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  menuLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6, color: colors.muted, marginBottom: 6 },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sizeBtn: { width: 44, height: 40, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(10,22,51,0.18)', alignItems: 'center', justifyContent: 'center' },
  sizeBtnText: { fontWeight: '800', color: colors.royalDeep },
  dots: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D5DAE4' },
  dotOn: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.royal },
  focusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  focusTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  focusSub: { fontSize: 11.5, color: colors.muted },
  barRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promptBtn: {
    minHeight: 32, paddingHorizontal: 12, borderRadius: radius.pill, justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.karmaLight, backgroundColor: '#FFF8E6',
  },
  promptBtnText: { fontSize: 12.5, fontWeight: '800', color: '#8A5E12' },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  noticeX: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,22,51,0.07)' },
  noticeXText: { fontSize: 13, color: colors.muted, fontWeight: '700' },
  pauseBtn: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.cream },
  pauseText: { fontSize: 12, fontWeight: '700', color: colors.royalDeep },
  resumeBtn: { backgroundColor: colors.royal },
  pauseNote: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: space.lg, marginBottom: 8,
    backgroundColor: '#EEF1F7', borderWidth: 1, borderColor: '#D7DDEA', borderRadius: radius.md, paddingVertical: 9, paddingHorizontal: 12,
  },
  pauseIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7DDEA', alignItems: 'center', justifyContent: 'center' },
  pauseTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  pauseSub: { fontSize: 12, color: colors.body },
  toastWrap: { alignItems: 'center', marginBottom: 8 },
  toast: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 },
  toastText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  notice: { marginHorizontal: space.lg, marginBottom: 6, backgroundColor: colors.cream, borderRadius: radius.sm, padding: 10 },
  noticeText: { fontSize: 12.5, color: colors.body },
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
