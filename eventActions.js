// eventActions.js — "Add to calendar" and "Share" for Eventbrite events.
//
// Calendar: uses expo-calendar's legacy API (`expo-calendar/legacy`), which is
// the version included in Expo Go for SDK 58. (The newer class-based API needs
// a development build.) Events we add are remembered on the phone so the
// button can say "✓ In your calendar" and never adds a second copy.
//
// Share: the phone's own share sheet with a ready-made message + link.

import { Platform, Share, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar/legacy';

export const CALENDAR_ADDED_KEY = 'pp.calendarAdded.v1'; // { eventbriteId: phoneCalendarEventId }
const REMINDER_MINUTES = 60;

export async function loadAddedEvents() {
  try {
    const raw = await AsyncStorage.getItem(CALENDAR_ADDED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveAdded(map) {
  await AsyncStorage.setItem(CALENDAR_ADDED_KEY, JSON.stringify(map));
}

// A calendar we're allowed to add to. iOS has a default; Android doesn't, so
// pick the account's primary writable calendar (or any writable one).
async function writableCalendarId() {
  if (Platform.OS === 'ios') {
    const cal = await Calendar.getDefaultCalendarAsync();
    return cal?.id || null;
  }
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const pick = cals.find((c) => c.allowsModifications && c.isPrimary) || cals.find((c) => c.allowsModifications);
  return pick?.id || null;
}

// Is a previously added copy still in the phone's calendar? (The user may have deleted it.)
async function stillThere(calendarEventId) {
  try {
    const ev = await Calendar.getEventAsync(calendarEventId);
    return !!ev;
  } catch {
    return false;
  }
}

// Returns { status: 'added' | 'already' | 'denied' | 'error', added (updated map) }
export async function addEventToCalendar(event) {
  const added = await loadAddedEvents();
  try {
    const perm = await Calendar.requestCalendarPermissionsAsync();
    if (!perm.granted) return { status: 'denied', added };

    if (added[event.id] && (await stillThere(added[event.id]))) {
      return { status: 'already', added };
    }

    const calendarId = await writableCalendarId();
    if (!calendarId) return { status: 'error', added };

    const start = new Date(event.start);
    const end = event.end ? new Date(event.end) : new Date(start.getTime() + 75 * 60000);
    const alarm = { relativeOffset: -REMINDER_MINUTES };
    if (Platform.OS === 'android') alarm.method = Calendar.AlarmMethod.ALERT;

    const id = await Calendar.createEventAsync(calendarId, {
      title: event.name,
      startDate: start,
      endDate: end,
      location: event.online ? 'Online' : event.venue || '',
      notes: `${event.summary ? `${event.summary}\n\n` : ''}Register / join: ${event.url}`,
      url: event.url, // iOS shows this as a link; Android has it in the notes
      alarms: [alarm],
    });
    const next = { ...added, [event.id]: id };
    await saveAdded(next);
    return { status: 'added', added: next };
  } catch {
    return { status: 'error', added };
  }
}

export function openPhoneSettings() {
  Linking.openSettings().catch(() => {});
}

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
