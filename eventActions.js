// eventActions.js — what you can do with an Eventbrite event:
//   • Are you attending?  a switch the app fully owns (saved on this phone)
//   • Add to calendar     always available; checks the phone's calendar itself
//                         for the same event so it never adds a duplicate, and
//                         works again if you deleted the copy in Calendar
//   • Share               the phone's share sheet with a ready-made message
//
// Calendar uses expo-calendar's legacy API (`expo-calendar/legacy`), the
// version included in Expo Go for SDK 58. (The newer class-based API needs a
// development build.)

import { useEffect, useState } from 'react';
import { Platform, Share, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar/legacy';

// ---------------------------------------------------------------------------
// Are you attending?
// ---------------------------------------------------------------------------

export const ATTENDING_KEY = 'pp.attending.v1'; // { eventbriteId: true }

let attending = null; // in-memory copy, shared by every screen
const listeners = new Set();

async function readAttending() {
  if (attending) return attending;
  try {
    const raw = await AsyncStorage.getItem(ATTENDING_KEY);
    attending = raw ? JSON.parse(raw) : {};
  } catch {
    attending = {};
  }
  return attending;
}

export async function setAttending(eventId, going) {
  const cur = { ...(await readAttending()) };
  if (going) cur[eventId] = true;
  else delete cur[eventId];
  attending = cur;
  await AsyncStorage.setItem(ATTENDING_KEY, JSON.stringify(cur));
  for (const fn of listeners) fn(cur);
}

// Hook: { [eventId]: true } kept in sync between Home and Events.
export function useAttending() {
  const [map, setMap] = useState(attending || {});
  useEffect(() => {
    let live = true;
    readAttending().then((m) => live && setMap(m));
    listeners.add(setMap);
    return () => { live = false; listeners.delete(setMap); };
  }, []);
  return map;
}

// The soonest upcoming event you're going to, else null. `events` must be
// upcoming events sorted by start.
export function nextAttending(events, map) {
  return events.find((e) => map[e.id]) || null;
}

// ---------------------------------------------------------------------------
// Countdown (pure — tested in Node)
// ---------------------------------------------------------------------------

const MIN = 60000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// { phase: 'soon' | 'today' | 'live' | 'over', days, hours, minutes, label }
//   soon  → more than today away: days / hours / minutes
//   today → same calendar day: hours / minutes ("TONIGHT" from 5 PM)
//   live  → between start and end: "HAPPENING NOW"
export function countdownParts(event, now = new Date()) {
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : new Date(start.getTime() + 75 * MIN);
  const t = now.getTime();
  if (t >= end.getTime()) return { phase: 'over', days: 0, hours: 0, minutes: 0, label: '' };
  if (t >= start.getTime()) return { phase: 'live', days: 0, hours: 0, minutes: 0, label: 'HAPPENING NOW' };
  const left = start.getTime() - t;
  const sameDay = start.toDateString() === now.toDateString();
  const days = Math.floor(left / DAY);
  const hours = Math.floor((left % DAY) / HOUR);
  const minutes = Math.floor((left % HOUR) / MIN);
  if (sameDay) {
    return {
      phase: 'today', days: 0, hours: Math.floor(left / HOUR), minutes,
      label: start.getHours() >= 17 ? 'TONIGHT' : 'TODAY',
    };
  }
  return { phase: 'soon', days, hours, minutes, label: "YOU'RE GOING" };
}

// ---------------------------------------------------------------------------
// Add to calendar
// ---------------------------------------------------------------------------

const REMINDER_MINUTES = 60;

// A calendar we're allowed to add to. iOS has a default; Android doesn't, so
// pick the account's primary writable calendar (or any writable one).
async function writableCalendar() {
  if (Platform.OS === 'ios') return Calendar.getDefaultCalendarAsync();
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return cals.find((c) => c.allowsModifications && c.isPrimary) || cals.find((c) => c.allowsModifications) || null;
}

// Is this event already in any of the phone's calendars? Looks for an entry
// with the same title starting at the same time. Asking the calendar every
// time means a copy you deleted in Calendar no longer counts.
async function alreadyInCalendar(event, start, end) {
  try {
    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const ids = cals.map((c) => c.id);
    if (!ids.length) return false;
    const found = await Calendar.getEventsAsync(ids, new Date(start.getTime() - MIN), new Date(end.getTime() + MIN));
    return found.some((x) => x.title === event.name && Math.abs(new Date(x.startDate).getTime() - start.getTime()) < MIN);
  } catch {
    return false; // can't check: adding is the safer choice
  }
}

// Returns 'added' | 'already' | 'denied' | 'error'.
export async function addEventToCalendar(event) {
  try {
    const perm = await Calendar.requestCalendarPermissionsAsync();
    if (!perm.granted) return 'denied';

    const start = new Date(event.start);
    const end = event.end ? new Date(event.end) : new Date(start.getTime() + 75 * MIN);
    if (await alreadyInCalendar(event, start, end)) return 'already';

    const cal = await writableCalendar();
    if (!cal?.id) return 'error';

    const alarm = { relativeOffset: -REMINDER_MINUTES };
    if (Platform.OS === 'android') alarm.method = Calendar.AlarmMethod.ALERT;

    await Calendar.createEventAsync(cal.id, {
      title: event.name,
      startDate: start,
      endDate: end,
      location: event.online ? 'Online' : event.venue || '',
      notes: `${event.summary ? `${event.summary}\n\n` : ''}Register / join: ${event.url}`,
      url: event.url, // iOS shows this as a link; Android has it in the notes
      alarms: [alarm],
    });
    return 'added';
  } catch {
    return 'error';
  }
}

export function openPhoneSettings() {
  Linking.openSettings().catch(() => {});
}

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

// "Tue, Dec 8 at 7:00 PM ET": Pen Parentis events run on New York time, so
// friends elsewhere aren't confused. Falls back to the phone's own time zone.
export function shareWhen(event) {
  const d = new Date(event.start);
  try {
    const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
    return `${date} at ${time} ET`;
  } catch {
    return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }
}

// The event name is sent exactly as Eventbrite has it.
export function shareMessage(event) {
  const where = event.online ? ' (online)' : event.venue ? ` at ${event.venue}` : '';
  return `Join me at a Pen Parentis event for writer-parents: “${event.name}”, ${shareWhen(event)}${where}. Free to register: ${event.url}`;
}

export function shareEvent(event) {
  return Share.share({ message: shareMessage(event), title: event.name }).catch(() => {});
}
