// eventsService.js — Pen Parentis events for the Events tab.
//
// Order of preference:
//   1. live list from EVENTS_API_URL (our server function that talks to Eventbrite)
//   2. the last live list saved on this phone (works offline)
//   3. the built-in list below
// Every event has the same shape:
//   { id, name, start (ISO), end (ISO), day ('YYYY-MM-DD' local), online, venue, url, summary }

import AsyncStorage from '@react-native-async-storage/async-storage';
import { EVENTS_API_URL, LINKS } from './links';
import { dayKey } from './writingLogic';

export const EVENTS_KEY = 'pp.events.v1';
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // refresh at most every 6 hours

// Used until the server function is live. Update by hand if dates change.
export const FALLBACK_EVENTS = [
  {
    id: 'salon-2026-11-10',
    name: 'Pen Parentis Literary Salon',
    start: '2026-11-10T19:00:00-05:00',
    end: '2026-11-10T20:30:00-05:00',
    online: true,
    venue: 'Online',
    url: LINKS.eventbrite,
    summary: 'Three writer-parents read new work, then talk craft and family life.',
  },
  {
    id: 'salon-2026-12-08',
    name: 'Pen Parentis Literary Salon',
    start: '2026-12-08T19:00:00-05:00',
    end: '2026-12-08T20:30:00-05:00',
    online: true,
    venue: 'Online',
    url: LINKS.eventbrite,
    summary: 'Three writer-parents read new work, then talk craft and family life.',
  },
];

// Fill in `day` (the phone's local date) and drop anything malformed.
export function normalizeEvents(list) {
  return (Array.isArray(list) ? list : [])
    .filter((e) => e && e.name && e.start && !isNaN(new Date(e.start)))
    .map((e) => ({ ...e, id: String(e.id || e.start), day: dayKey(new Date(e.start)), url: e.url || LINKS.eventbrite }))
    .sort((a, b) => new Date(a.start) - new Date(b.start));
}

// Events that haven't ended yet.
export function upcoming(events, now = new Date()) {
  return events.filter((e) => new Date(e.end || e.start) >= now);
}

// { 'YYYY-MM-DD': [event, ...] } for the calendar's gold stars.
export function eventsByDay(events) {
  const map = {};
  for (const e of events) (map[e.day] = map[e.day] || []).push(e);
  return map;
}

// "Tue, Nov 10 · 7:00 PM"
export function eventWhen(e) {
  const d = new Date(e.start);
  const date = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

async function readCache() {
  try {
    const raw = await AsyncStorage.getItem(EVENTS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Returns { events, source: 'live' | 'saved' | 'built-in' }.
export async function loadEvents({ force = false } = {}) {
  const cached = await readCache();
  const fresh = cached && Date.now() - cached.savedAt < MAX_AGE_MS;
  if (cached && fresh && !force) return { events: normalizeEvents(cached.events), source: 'saved' };

  if (EVENTS_API_URL) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(EVENTS_API_URL, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const body = await res.json();
        const events = normalizeEvents(body.events || body);
        await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify({ savedAt: Date.now(), events }));
        return { events, source: 'live' };
      }
    } catch {
      // offline or server down — fall through
    }
  }
  if (cached) return { events: normalizeEvents(cached.events), source: 'saved' };
  return { events: normalizeEvents(FALLBACK_EVENTS), source: 'built-in' };
}
