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
    id: '1997639471434',
    name: "BUILDING WRITER-PARENT COMMUNITY: Meet The Author's Guild",
    start: '2026-11-11T00:00:00Z',
    end: '2026-11-11T01:15:00Z',
    online: true,
    venue: 'Online',
    url: 'https://www.eventbrite.com/e/building-writer-parent-community-meet-the-authors-guild-registration-1997639471434',
    summary: 'How do you succeed if you have kids? Pen Parentis has real life answers - readings and lived experiences of authors - in community!',
  },
  {
    id: '1997641492479',
    name: 'BUILDING WRITER-PARENT COMMUNITY: Meet RAWI',
    start: '2026-12-09T00:00:00Z',
    end: '2026-12-09T01:15:00Z',
    online: true,
    venue: 'Online',
    url: 'https://www.eventbrite.com/e/building-writer-parent-community-meet-rawi-registration-1997641492479',
    summary: 'How do you succeed if you have kids? Pen Parentis has real life answers - readings and lived experiences of authors - in community!',
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

// Returns { events, source: 'live' | 'saved' | 'built-in', updatedAt (ms or null) }.
export async function loadEvents({ force = false } = {}) {
  const cached = await readCache();
  const fresh = cached && Date.now() - cached.savedAt < MAX_AGE_MS;
  if (cached && fresh && !force) return { events: normalizeEvents(cached.events), source: 'saved', updatedAt: cached.savedAt };

  if (EVENTS_API_URL) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      // A refresh skips every cache (phone and server) so it's truly live.
      const url = force ? `${EVENTS_API_URL}${EVENTS_API_URL.includes('?') ? '&' : '?'}t=${Date.now()}` : EVENTS_API_URL;
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store', headers: force ? { 'Cache-Control': 'no-cache' } : {} });
      clearTimeout(timer);
      if (res.ok) {
        const body = await res.json();
        const events = normalizeEvents(body.events || body);
        const savedAt = Date.now();
        await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify({ savedAt, events }));
        return { events, source: 'live', updatedAt: savedAt };
      }
    } catch {
      // offline or server down — fall through
    }
  }
  if (cached) return { events: normalizeEvents(cached.events), source: 'saved', updatedAt: cached.savedAt };
  return { events: normalizeEvents(FALLBACK_EVENTS), source: 'built-in', updatedAt: null };
}
