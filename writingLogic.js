// writingLogic.js — pure functions behind goals, sessions, ratings and the
// personalized Home screen. No React Native imports here on purpose, so this
// file can be unit-tested with plain Node and reused by every screen.

import { feelingLabel } from './feelings';

// ---------------------------------------------------------------------------
// Dates. Everything is local time, so "today" resets at 12am on the phone.
// ---------------------------------------------------------------------------

export function dayKey(date = new Date()) {
  const d = new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseDayKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Sunday 00:00 of the week containing `date` (weeks run Sunday → Saturday,
// like a regular calendar).
export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

// The 7 day keys Mon..Sun of the current week.
export function weekDayKeys(date = new Date()) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return dayKey(d);
  });
}

export function msUntilMidnight(now = new Date()) {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

export function hourLabel(h) {
  const hr = ((Math.round(h) % 24) + 24) % 24;
  if (hr === 0) return '12am';
  if (hr === 12) return '12pm';
  return hr < 12 ? `${hr}am` : `${hr - 12}pm`;
}

export function partOfDay(h) {
  if (h >= 4 && h < 8) return 'early morning';
  if (h >= 8 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'late night';
}

export function greetingFor(h) {
  if (h >= 4 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 22) return 'Good evening';
  return 'Still up';
}

// ---------------------------------------------------------------------------
// Durations. Short sessions show seconds, long ones show hours, so a
// 5-second session never reads as "0 min" and 75 minutes reads "1 hr 15 min".
// ---------------------------------------------------------------------------

export function formatDuration(totalSeconds) {
  const t = Math.max(0, Math.round(totalSeconds || 0));
  if (t < 60) return `${t} sec`;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  if (h === 0) return m < 10 && sec ? `${m} min ${sec} sec` : `${m} min`;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

// For stat tiles: a big value plus a unit label underneath.
export function durationTile(totalSeconds) {
  const t = Math.max(0, Math.round(totalSeconds || 0));
  if (t < 60) return { value: String(t), unit: t === 1 ? 'second' : 'seconds' };
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  if (h === 0) return { value: String(m), unit: m === 1 ? 'minute' : 'minutes' };
  if (m === 0) return { value: String(h), unit: h === 1 ? 'hour' : 'hours' };
  return { value: `${h}h ${m}m`, unit: 'time' };
}

// The typer's stopwatch: 04:12, or 1:04:12 past an hour.
export function clock(totalSeconds) {
  const t = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(t / 3600);
  const mm = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const ss = String(t % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const WEEKDAYS = ['Sunday','Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---------------------------------------------------------------------------
// Words and pasting.
// ---------------------------------------------------------------------------

export function countWords(text) {
  const t = (text || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

// More characters than this arriving in a single keystroke is treated as a
// paste and rejected. A swiped or autocompleted word is well under this; a
// pasted paragraph is well over it.
export const PASTE_CHAR_LIMIT = 30;

export function looksLikePaste(prevText, nextText) {
  return nextText.length - prevText.length > PASTE_CHAR_LIMIT;
}

// ---------------------------------------------------------------------------
// Ratings. Four outcomes — "Something came up" is folded into "None of it".
// ---------------------------------------------------------------------------

export const OUTCOMES = [
  { key: 'exceeded', label: 'Exceeded' },
  { key: 'met', label: 'Met' },
  { key: 'some', label: 'Some of it' },
  { key: 'none', label: 'None of it', sub: 'Something came up — that still counts as showing up' },
];

export function outcomeLabel(key) {
  return OUTCOMES.find((o) => o.key === key)?.label ?? '—';
}

// At or above this % of today's goal the writer rates themselves; below it
// the app records its own rating.
export const SELF_RATE_THRESHOLD = 50;

export function appRatingFor(pct) {
  if (pct == null) return null;
  if (pct >= 110) return 'exceeded';
  if (pct >= 100) return 'met';
  if (pct > 0) return 'some';
  return 'none';
}

export function canSelfRate(pct) {
  // No daily goal set → nothing for the app to measure against, so the
  // writer rates themselves.
  return pct == null || pct >= SELF_RATE_THRESHOLD;
}

// The rating that counts: the writer's own if they gave one, else the app's.
export function finalRating(session) {
  return session.selfRating || session.appRating || null;
}

// ---------------------------------------------------------------------------
// Goals and progress.
// ---------------------------------------------------------------------------

export function summarize(sessions) {
  let words = 0;
  let seconds = 0;
  for (const s of sessions) {
    words += s.words || 0;
    seconds += s.seconds || 0;
  }
  return { words, minutes: Math.floor(seconds / 60), seconds, count: sessions.length };
}

export function sessionsOnDay(sessions, key) {
  return sessions.filter((s) => s.day === key);
}

export function sessionsThisWeek(sessions, date = new Date()) {
  const keys = new Set(weekDayKeys(date));
  return sessions.filter((s) => keys.has(s.day));
}

// ---------------------------------------------------------------------------
// Goals: three daily rings (minutes, words, sessions). Your usual goal applies
// every day; on days you can't write, pick "A lighter day" or "Rest today".
// (There are no set writing days and no weekly goal.)
//   usual goals  { words, minutes, sessions, light?: { words, minutes, sessions } }
//   a day's plan { plan: 'usual' | 'light', words, minutes, sessions } | { plan: 'rest' }
// Older saved day goals ({ type: 'word'|'time', target } / { skipped }) still work.
// ---------------------------------------------------------------------------

export const DEFAULT_GOALS = { words: 100, minutes: 15, sessions: 1 };
// The values the − / + buttons step through for each ring: small steps at the
// low end, bigger ones higher up.
export const GOAL_STEPS = {
  minutes: [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180],
  words: [25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000, 3000, 5000],
  sessions: [1, 2, 3, 4, 5],
};
export const GOAL_LIMITS = Object.fromEntries(
  Object.entries(GOAL_STEPS).map(([k, list]) => [k, { min: list[0], max: list[list.length - 1] }])
);

// Next value up (dir = 1) or down (dir = -1) from `value`. Works even if the
// value isn't one of the steps (e.g. a goal saved by an older version).
export function stepGoal(kind, value, dir) {
  const list = GOAL_STEPS[kind];
  if (dir > 0) return list.find((v) => v > value) ?? list[list.length - 1];
  return [...list].reverse().find((v) => v < value) ?? list[0];
}


export const RINGS = ['minutes', 'words', 'sessions'];

export function normalizeGoals(g) {
  // Older saves may have a `days` list (writing days); it's no longer used.
  const out = { ...DEFAULT_GOALS };
  for (const k of RINGS) {
    const v = Number(g?.[k]);
    if (v > 0) out[k] = Math.min(GOAL_LIMITS[k].max, Math.max(GOAL_LIMITS[k].min, v));
  }
  // Optional custom "A lighter day" ({ words, minutes, sessions }). Absent =
  // half of the usual. Never higher than the usual, so it's always lighter.
  if (g?.light && typeof g.light === 'object') {
    const light = {};
    for (const k of RINGS) {
      const v = Number(g.light[k]);
      light[k] = v > 0 ? Math.min(out[k], Math.max(GOAL_LIMITS[k].min, v)) : halfStep(k, out[k]);
    }
    out.light = light;
  }
  return out;
}

// Half of a usual target, rounded down to a step (never below the smallest).
function halfStep(kind, value) {
  const list = GOAL_STEPS[kind];
  return [...list].reverse().find((v) => v <= value / 2) ?? list[0];
}

// The lighter-day targets: your custom ones if set, else half of your usual.
export function lightTargets(goals) {
  const g = normalizeGoals(goals);
  if (g.light) return { ...g.light };
  return { words: halfStep('words', g.words), minutes: halfStep('minutes', g.minutes), sessions: halfStep('sessions', g.sessions) };
}


// "What's your goal today?" → My usual / A lighter day (half, never below the minimum) / Rest today.
export function planFor(kind, goals) {
  const g = normalizeGoals(goals);
  if (kind === 'rest') return { plan: 'rest' };
  if (kind === 'light') {
    // Your custom lighter day, or half of your usual rounded down to a step
    // (50 words · 5 min · 2 sessions → 25 words · 2 min · 1 session).
    return { plan: 'light', ...lightTargets(g) };
  }
  return { plan: 'usual', words: g.words, minutes: g.minutes, sessions: g.sessions };
}

export function isRestGoal(goal) {
  return !goal || goal.skipped || goal.plan === 'rest';
}

// The goal that applies to a day: the plan picked that day, else your usual
// goals (every day), or null when there are no goals yet.
export function goalForDay(dailyGoals, goals, key) {
  const stored = dailyGoals?.[key];
  if (stored) {
    // A one-ring goal saved by the old goal sheet (e.g. "50 words") for today
    // or later: keep that target and fill the other rings from your usual
    // goals, so all three rings have something to close. Past days keep
    // the goal they were judged by.
    if (goals && !stored.plan && !stored.skipped && stored.type && stored.target && key >= dayKey()) {
      const usual = planFor('usual', goals);
      if (stored.type === 'time') return { ...usual, minutes: stored.target, upgraded: true };
      if (stored.type === 'word') return { ...usual, words: stored.target, upgraded: true };
    }
    return stored;
  }
  if (goals) return { ...planFor('usual', goals), implied: true };
  return null;
}

// Ring targets for a day (null = rest day / no goal).
export function dayTargets(goal) {
  if (isRestGoal(goal)) return null;
  if (goal.plan) return { minutes: goal.minutes, words: goal.words, sessions: goal.sessions };
  if (goal.type === 'time') return { minutes: goal.target, words: null, sessions: null };
  if (goal.type === 'word') return { minutes: null, words: goal.target, sessions: null };
  return null;
}

// Each ring's % (uncapped; null when that ring has no target) and whether all closed.
export function ringProgress(goal, summary) {
  const t = dayTargets(goal);
  const pct = (done, target) => (target ? Math.round((done / target) * 100) : null);
  const r = t
    ? { minutes: pct(summary.seconds / 60, t.minutes), words: pct(summary.words, t.words), sessions: pct(summary.count, t.sessions) }
    : { minutes: null, words: null, sessions: null };
  const set = RINGS.map((k) => r[k]).filter((v) => v != null);
  return { ...r, targets: t, closed: set.length > 0 && set.every((v) => v >= 100) };
}

// One number for "how is today going": the LOWEST ring, so 100% = every ring closed.
export function dailyPct(goal, summary) {
  if (isRestGoal(goal)) return null;
  if (goal.plan) {
    const r = ringProgress(goal, summary);
    const set = RINGS.map((k) => r[k]).filter((v) => v != null);
    return set.length ? Math.min(...set) : null;
  }
  if (!goal.target) return null;
  const done = goal.type === 'time' ? summary.seconds / 60 : summary.words;
  return Math.round((done / goal.target) * 100);
}

// What's still left today, e.g. "25 words · 13 min".
export function toGoText(goal, summary) {
  const t = dayTargets(goal);
  if (!t) return '';
  const parts = [];
  if (t.words && summary.words < t.words) parts.push(`${(t.words - summary.words).toLocaleString()} words`);
  if (t.minutes && summary.seconds < t.minutes * 60) parts.push(`${Math.max(1, Math.ceil(t.minutes - summary.seconds / 60))} min`);
  if (t.sessions && summary.count < t.sessions) {
    const n = t.sessions - summary.count;
    parts.push(`${n} session${n === 1 ? '' : 's'}`);
  }
  return parts.join(' · ');
}

// This week, Sunday to Saturday, for the rings strip: each day against its own
// goal, plus plain totals of what you wrote (no weekly target).
export function weekSummary(sessions, dailyGoals, goals, date = new Date()) {
  const today = dayKey(date);
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const done = { words: 0, seconds: 0, count: 0 }; // what you wrote this week
  let closedDays = 0; // days with all rings closed
  const days = weekDayKeys(date).map((key, i) => {
    const goal = goalForDay(dailyGoals, goals, key);
    const sum = summarize(sessionsOnDay(sessions, key));
    const rings = ringProgress(goal, sum);
    if (rings.closed) closedDays += 1;
    done.words += sum.words;
    done.seconds += sum.seconds;
    done.count += sum.count;
    return { key, label: labels[i], isToday: key === today, future: key > today, off: !rings.targets, rings, ...sum };
  });
  return { days, done, closedDays };
}



export function describeDailyGoal(goal) {
  if (!goal) return 'No goal set yet';
  if (goal.skipped) return 'No goal today';
  if (goal.plan === 'rest') return 'Rest day';
  if (goal.plan) {
    return `${goal.words.toLocaleString()} words · ${goal.minutes} min · ${goal.sessions} session${goal.sessions === 1 ? '' : 's'}`;
  }
  return goal.type === 'time' ? `${goal.target} minutes today` : `${goal.target.toLocaleString()} words today`;
}

// ---------------------------------------------------------------------------
// One piece of writing per day. "Keep writing" reopens today's last piece and
// saves the next session with `continues: true` and the full, grown text — so
// the day reads as one document while each sitting is still its own session.
// ---------------------------------------------------------------------------

export function dayPieces(sessions, key) {
  const list = sessionsOnDay(sessions, key)
    .slice()
    .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
  const pieces = [];
  for (const s of list) {
    const last = pieces[pieces.length - 1];
    if (s.continues && last) {
      last.text = s.text || '';
      last.words += s.words || 0;
      last.seconds += s.seconds || 0;
      last.lastAt = s.endedAt || s.startedAt;
      last.rating = finalRating(s) || last.rating;
      last.sessionIds.push(s.id);
      if (s.prompt && !last.prompts.includes(s.prompt)) last.prompts.push(s.prompt);
      if (s.feeling) last.feelings.push({ at: s.endedAt || s.startedAt, feeling: s.feeling });
    } else {
      pieces.push({
        text: s.text || '',
        words: s.words || 0,
        seconds: s.seconds || 0,
        firstAt: s.startedAt,
        lastAt: s.endedAt || s.startedAt,
        rating: finalRating(s),
        sessionIds: [s.id],
        prompts: s.prompt ? [s.prompt] : [], // writing prompts used for this piece
        feelings: s.feeling ? [{ at: s.endedAt || s.startedAt, feeling: s.feeling }] : [],
      });
    }
  }
  return pieces;
}

// What today's writing page should open with ('' = a blank page).
export function textToContinue(sessions, key) {
  const pieces = dayPieces(sessions, key);
  return pieces.length ? pieces[pieces.length - 1] : null;
}

// Everything a day bubble shows.
export function daySummary(sessions, dailyGoals, key, goals) {
  const daySessions = sessionsOnDay(sessions, key);
  const sum = summarize(daySessions);
  const goal = goalForDay(dailyGoals, goals, key);
  const pct = dailyPct(goal, sum);
  const pieces = dayPieces(sessions, key);
  const lastPiece = pieces[pieces.length - 1];
  // The writer's own last rating wins; otherwise judge the day against its goal.
  const rating = lastPiece?.rating || appRatingFor(pct);
  // The most recent feeling picked that day (shown on the day bubble).
  const felt = daySessions
    .filter((s) => s.feeling)
    .sort((a, b) => String(b.endedAt || b.startedAt).localeCompare(String(a.endedAt || a.startedAt)));
  const feeling = felt.length ? felt[0].feeling : null;
  const rings = ringProgress(goal, sum);
  return { key, goal, pct, rating, feeling, rings, pieces, preview: lastPiece?.text?.trim() || '', ...sum };
}

// The Start writing button, which changes with the day.
//   'setGoal'  no goal chosen yet today  → ask "What's your goal today?" first
//   'start'    goal set (or skipped), nothing written today
//   'continue' wrote today, goal not met yet (or no goal)
//   'met'      today's goal reached
export function startButtonState(sessions, dailyGoals, key, goals) {
  const stored = dailyGoals[key] || null;
  const goal = goalForDay(dailyGoals, goals, key);
  const sum = summarize(sessionsOnDay(sessions, key));
  const pct = dailyPct(goal, sum);
  const wrote = sum.count > 0;
  let state = 'start';
  if (!stored && !wrote) state = 'setGoal';
  else if (wrote && pct != null && pct >= 100) state = 'met';
  else if (wrote) state = 'continue';

  let title = 'Start writing';
  let sub = isRestGoal(goal) ? 'Rest day — anything you write is a bonus' : `Goal: ${describeDailyGoal(goal)}`;
  if (state === 'setGoal') {
    title = "Set today's goal & start";
    sub = "We'll ask “What's your goal today?” first";
  } else if (state === 'continue') {
    title = 'Keep writing';
    const left = pct != null ? toGoText(goal, sum) : '';
    sub = left
      ? `${left} to go · picks up where you left off`
      : `${sum.words.toLocaleString()} words so far · picks up where you left off`;
  } else if (state === 'met') {
    title = 'Goal met — write a little more?';
    sub = `All rings closed · ${sum.words.toLocaleString()} words today · anything extra is a bonus`;
  }
  return { state, title, sub, pct };
}

// Plain-text version of a day for "Send to myself".
export function dayShareText(summary) {
  const date = parseDayKey(summary.key).toDateString();
  const goalBit = summary.goal && !summary.goal.skipped ? ` · goal ${describeDailyGoal(summary.goal)}` : '';
  const ratingBit = summary.feeling ? ` · felt ${feelingLabel(summary.feeling).toLowerCase()}` : '';
  const head = `${date} · ${summary.words.toLocaleString()} words · ${formatDuration(summary.seconds)}${goalBit}${ratingBit}`;
  const body = summary.pieces.map((p) => p.text.trim()).filter(Boolean).join('\n\n— — —\n\n');
  return `${head}\n\n${body}`;
}


// ---------------------------------------------------------------------------
// Personalization — the Home screen learns after 10 and 100 sessions.
// ---------------------------------------------------------------------------

export const TIER_LEARNING = 10;
export const TIER_DEEP = 100;

function median(nums) {
  if (!nums.length) return null;
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

export function streakDays(sessions, date = new Date()) {
  const days = new Set(sessions.map((s) => s.day));
  const d = new Date(date);
  // Today not written yet doesn't break a streak that ran through yesterday.
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function longestStreak(sessions) {
  const keys = [...new Set(sessions.map((s) => s.day))].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const k of keys) {
    const d = parseDayKey(k);
    if (prev) {
      const gap = Math.round((d.getTime() - prev.getTime()) / 86400000);
      run = gap === 1 ? run + 1 : 1;
    } else run = 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function suggestedDailyGoal(sessions, type = 'word') {
  // Median of the last 14 days that had any writing, rounded to a friendly number.
  const byDay = {};
  for (const s of sessions) {
    byDay[s.day] = byDay[s.day] || { words: 0, seconds: 0 };
    byDay[s.day].words += s.words || 0;
    byDay[s.day].seconds += s.seconds || 0;
  }
  const recent = Object.keys(byDay).sort().slice(-14).map((k) => byDay[k]);
  if (recent.length < 3) return null;
  if (type === 'time') {
    const m = median(recent.map((d) => d.seconds / 60));
    return Math.max(5, Math.round(m / 5) * 5);
  }
  const m = median(recent.map((d) => d.words));
  return Math.max(50, Math.round(m / 50) * 50);
}

export function buildInsights(sessions, dailyGoals = {}, now = new Date(), goals = null) {
  const hour = now.getHours();
  const total = sessions.length;
  const today = dayKey(now);
  const todaySum = summarize(sessionsOnDay(sessions, today));
  const todayGoal = goalForDay(dailyGoals, goals, today);
  const todayPct = dailyPct(todayGoal, todaySum);
  const streak = streakDays(sessions, now);

  const tier = total >= TIER_DEEP ? 'deep' : total >= TIER_LEARNING ? 'learning' : 'new';
  const lines = [];
  let headline = `${greetingFor(hour)}.`;

  if (tier === 'new') {
    headline = total === 0 ? `${greetingFor(hour)}. Welcome in.` : `${greetingFor(hour)}.`;
    if (todaySum.count) lines.push(`${todaySum.words.toLocaleString()} words so far today.`);
    else lines.push('Set a small goal for today and write toward it — even ten minutes counts.');
    const left = TIER_LEARNING - total;
    lines.push(`${left} more session${left === 1 ? '' : 's'} and this screen starts learning your rhythm.`);
    return { tier, headline, lines, streak, todaySum, todayGoal, todayPct, total };
  }

  const hours = sessions.map((s) => s.hour).filter((h) => typeof h === 'number');
  const usual = median(hours);
  const avgWords = Math.round(summarize(sessions).words / total);
  const usualPart = usual != null ? partOfDay(usual) : null;

  if (streak > 1) headline = `${greetingFor(hour)}. Day ${streak} of your streak.`;

  // What to say depends on *when* they opened the app.
  if (todaySum.count) {
    const goalBit = todayPct != null ? ` — ${todayPct}% of today's goal` : '';
    lines.push(`${todaySum.words.toLocaleString()} words already today${goalBit}.`);
  } else if (usual != null && Math.abs(hour - usual) <= 1) {
    lines.push(`This is usually when you write (${hourLabel(usual)}). The page is ready.`);
  } else if (usual != null && hour > usual) {
    lines.push(`You usually write around ${hourLabel(usual)}. There's still time for a short one.`);
  } else if (usual != null) {
    lines.push(`Early start — you usually write around ${hourLabel(usual)}.`);
  }

  const PLURAL = {
    'early morning': 'Early mornings', morning: 'Mornings', afternoon: 'Afternoons',
    evening: 'Evenings', 'late night': 'Late nights',
  };
  if (usualPart) lines.push(`${PLURAL[usualPart]} are your time — about ${avgWords.toLocaleString()} words a session.`);

  if (tier === 'deep') {
    const lifetime = summarize(sessions).words;
    const byWeekday = Array(7).fill(0);
    for (const s of sessions) byWeekday[parseDayKey(s.day).getDay()] += s.words || 0;
    const best = byWeekday.indexOf(Math.max(...byWeekday));

    const last7 = [];
    const prev7 = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      (i < 7 ? last7 : prev7).push(dayKey(d));
    }
    const wLast = summarize(sessions.filter((s) => last7.includes(s.day))).words;
    const wPrev = summarize(sessions.filter((s) => prev7.includes(s.day))).words;

    lines.push(`${lifetime.toLocaleString()} words across ${total} sessions. ${WEEKDAYS[best]}s are your strongest day.`);
    if (wPrev > 0) {
      const change = Math.round(((wLast - wPrev) / wPrev) * 100);
      if (change >= 10) lines.push(`Up ${change}% on the week before.`);
      else if (change <= -10) lines.push(`A quieter week than the last — that's allowed.`);
    }
    const best_streak = longestStreak(sessions);
    if (best_streak > streak) lines.push(`Longest streak so far: ${best_streak} days.`);
  }

  return { tier, headline, lines, streak, todaySum, todayGoal, todayPct, total, usualHour: usual };
}

// ---------- Events calendar ----------

// Rolling calendar rows: `before` weeks earlier than this one, this week, and
// `after` weeks later. Each row is 7 day keys, Sunday first. Months run on
// across rows (late October and early November share a screen).
export function calendarWeeks(date = new Date(), before = 0, after = 11) {
  const start = startOfWeek(date);
  start.setDate(start.getDate() - before * 7);
  return Array.from({ length: before + 1 + after }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + w * 7 + i);
      return dayKey(d);
    })
  );
}

// Rings and totals for one calendar day.
export function calendarDay(sessions, dailyGoals, goals, key, today = dayKey()) {
  const goal = goalForDay(dailyGoals, goals, key);
  const sum = summarize(sessionsOnDay(sessions, key));
  const rings = ringProgress(goal, sum);
  return {
    key, goal, rings, ...sum,
    future: key > today,
    isToday: key === today,
    off: isRestGoal(goal),
  };
}

// "2.4×" when a ring is at least 1.1 times its goal, else null.
export function overMultiple(pct) {
  if (pct == null) return null;
  const x = Math.round(pct / 10) / 10;
  return x > 1 ? `${x}×` : null;
}

// One-time fix-up for goals saved by the old one-ring goal sheet
// ({ type: 'word', target: 50 }). For each such day:
//   • if a session that day was saved with a three-ring goal (sessions keep
//     the goal they were written against), use the latest one, which is the
//     goal you actually saw on the Today card that day;
//   • otherwise, for today or later, fill minutes and sessions from your usual goals.
// Older days with no three-ring session keep their words-only goal.
// Returns { dailyGoals, changed } so the caller can save it once.
export function upgradeOldGoals(dailyGoals, sessions, goals, today = dayKey()) {
  const out = { ...dailyGoals };
  let changed = false;
  for (const [key, g] of Object.entries(dailyGoals || {})) {
    if (!g || g.plan || g.skipped || !g.type) continue;
    const seen = (sessions || [])
      .filter((s) => s.day === key && s.dailyGoal && s.dailyGoal.plan && s.dailyGoal.plan !== 'rest')
      .sort((a, b) => String(a.endedAt || a.startedAt).localeCompare(String(b.endedAt || b.startedAt)));
    let next = null;
    if (seen.length) {
      const { plan, words, minutes, sessions: n } = seen[seen.length - 1].dailyGoal;
      next = { plan, words, minutes, sessions: n };
    } else if (goals && key >= today) {
      const usual = planFor('usual', goals);
      next = g.type === 'time' ? { ...usual, minutes: g.target } : { ...usual, words: g.target };
    }
    if (next) {
      out[key] = { ...next, upgradedFrom: { type: g.type, target: g.target }, setAt: g.setAt };
      changed = true;
    }
  }
  return { dailyGoals: out, changed };
}
