// writingStore.js — the one place that reads and writes Brainstorm data on the
// phone (AsyncStorage). Screens call these instead of touching keys directly.
//
//   pp.goals.v2       usual goals  { words, minutes, sessions, days: [Mon..Sun] }
//   pp.dailyGoals.v1  { 'YYYY-MM-DD': { plan: 'usual'|'light', words, minutes, sessions } | { plan: 'rest' } }
//                     (older entries { type: 'word'|'time', target } / { skipped } still read fine)
//   pp.sessions.v1    [session, ...] newest first — every session, with its text
//
// A session:
//   { id, day, startedAt, endedAt, hour, seconds, words, finalWords, text,
//     blockedPastes, dailyGoal, pct, appRating, continues, feeling }
//   `appRating` is the goal status (exceeded/met/some/none) used for bar colours.
//   `feeling` is what the writer picked in "How do you feel?" (feelings.js), or null.
//   `continues: true` = this session picked up today's earlier writing, so
//   its `text` is the whole day's piece and `words` counts only new words.

import { useEffect, useState } from 'react';
import { AppState, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { allMedalProgress, diffMedals } from './medals';
import { feelingLabel } from './feelings';
import { dayKey, dayShareText, formatDuration, msUntilMidnight, normalizeGoals, parseDayKey, upgradeOldGoals } from './writingLogic';

export const GOALS_KEY = 'pp.goals.v2'; // usual goals: three rings + writing days
export const DAILY_GOALS_KEY = 'pp.dailyGoals.v1';
export const SESSIONS_KEY = 'pp.sessions.v1';

async function readJSON(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Observer: screens subscribe and reload whenever goals, daily plans or
// sessions are saved, so no screen keeps drawing with old settings.
const listeners = new Set();
export function onDataChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  for (const fn of listeners) {
    try { fn(); } catch { /* a screen's handler failing shouldn't stop the others */ }
  }
}

// Hook: runs `reload` whenever saved data changes (while the screen is mounted).
export function useDataChange(reload) {
  useEffect(() => onDataChange(reload), [reload]);
}

export async function loadAll() {
  const [goals, dailyGoals, sessions] = await Promise.all([
    readJSON(GOALS_KEY, null),
    readJSON(DAILY_GOALS_KEY, {}),
    readJSON(SESSIONS_KEY, []),
  ]);
  // Old one-ring daily goals become three-ring goals, saved so they stay
  // the same after midnight.
  let daily = dailyGoals;
  if (goals) {
    const up = upgradeOldGoals(dailyGoals, sessions, normalizeGoals(goals));
    if (up.changed) {
      daily = up.dailyGoals;
      await AsyncStorage.setItem(DAILY_GOALS_KEY, JSON.stringify(daily));
    }
  }
  // `hasGoals` is false until the writer saves goals once (first-run setup).
  return { goals: normalizeGoals(goals), hasGoals: !!goals, dailyGoals: daily, sessions };
}

export async function saveGoals(goals) {
  const g = normalizeGoals(goals);
  await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(g));
  notify();
  return g;
}

export async function saveDailyGoal(goal, key = dayKey()) {
  const all = await readJSON(DAILY_GOALS_KEY, {});
  all[key] = { ...goal, setAt: new Date().toISOString() };
  await AsyncStorage.setItem(DAILY_GOALS_KEY, JSON.stringify(all));
  notify();
  return all;
}

export async function saveSession(session) {
  const list = await readJSON(SESSIONS_KEY, []);
  const i = list.findIndex((s) => s.id === session.id);
  if (i >= 0) list[i] = { ...list[i], ...session };
  else list.unshift(session);
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(list));
  notify();
  return list;
}

export async function deleteSession(id) {
  const list = (await readJSON(SESSIONS_KEY, [])).filter((s) => s.id !== id);
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(list));
  notify();
  return list;
}

// ---------------------------------------------------------------------------
// Medals. Progress is always recomputed from sessions; this key only remembers
// WHEN each tier was first reached, so we can show dates and celebrate once.
//   pp.medals.v1  { [medalId]: { tierIndex, dates: [iso per tier] } }
// ---------------------------------------------------------------------------

export const MEDALS_KEY = 'pp.medals.v1';

// Returns { medals, record, newlyEarned }. The very first run quietly records
// what's already earned (no pop-up for old writing); after that, any new tier
// comes back in `newlyEarned` exactly once.
export async function syncMedals(data) {
  const { sessions, dailyGoals, goals } = data || (await loadAll());
  const medals = allMedalProgress(sessions, dailyGoals, goals);
  const stored = await readJSON(MEDALS_KEY, null);
  const { record, newlyEarned } = diffMedals(medals, stored || {});
  if (!stored || newlyEarned.length) await AsyncStorage.setItem(MEDALS_KEY, JSON.stringify(record));
  return { medals, record, newlyEarned: stored ? newlyEarned : [] };
}

export async function deleteDay(key) {
  const list = (await readJSON(SESSIONS_KEY, [])).filter((s) => s.day !== key);
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(list));
  notify();
  return list;
}

// "Send to myself": opens the phone's share sheet (Mail, Messages, Notes,
// Drive…) already filled with the writing. No account or email server needed.
// Pass one day's summary (from daySummary) or a list of them, oldest first.
export function shareDays(summaries, title = 'My writing — Pen Parentis') {
  const list = Array.isArray(summaries) ? summaries : [summaries];
  const message = list.map(dayShareText).join('\n\n= = = = =\n\n');
  return Share.share({ title, message }).catch(() => {});
}

// After a single session (the "Saved" sheet in the typer).
export function shareWriting(session, title = 'My writing — Pen Parentis') {
  const when = parseDayKey(session.day).toDateString();
  const rating = session.feeling ? ` · felt ${feelingLabel(session.feeling).toLowerCase()}` : '';
  const message = `${when} · ${session.finalWords ?? session.words} words · ${formatDuration(session.seconds)}${rating}\n\n${session.text || ''}`;
  return Share.share({ title, message }).catch(() => {});
}

// Returns today's key and re-renders the component when the clock passes
// 12am (or when the app comes back to the foreground on a new day). That's
// what makes "What's your goal today?" reset at midnight.
export function useToday() {
  const [today, setToday] = useState(dayKey());
  useEffect(() => {
    let timer;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setToday(dayKey());
        arm();
      }, msUntilMidnight() + 1000);
    };
    arm();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        setToday(dayKey());
        arm();
      }
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
  return today;
}
