// screens/EventsScreen.js — Pen Parentis events + your writing calendar.
//   • Coming up: Eventbrite events, top to bottom. One is open at a time
//     (gold border, description, Register); tap another and it opens in place
//     while the first folds down. Leaving the app resets it to the next event.
//   • the selected day: its three rings, and any event that day
//   • a scrollable rolling calendar that opens on this week, can show earlier
//     weeks, and runs across months. Each day shows its rings (minutes, words,
//     sessions); a big gold star marks event days.
// Tapping a past day you wrote on opens what you wrote that day.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Animated, AppState, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Screen, Header, openLink } from '../components/ui';
import Rings, { RING_COLORS } from '../components/Rings';
import { colors, lift, radius, space } from '../theme';
import { LINKS } from '../links';
import { eventWhen, eventsByDay, loadEvents, upcoming } from '../eventsService';
import { addEventToCalendar, loadAddedEvents, openPhoneSettings, shareEvent } from '../eventActions';
import {
  DEFAULT_GOALS, calendarDay, calendarWeeks, describeDailyGoal, formatDuration, parseDayKey,
} from '../writingLogic';
import { loadAll, useDataChange, useToday } from '../writingStore';

const ROW_H = 64;
const VISIBLE_WEEKS = 4;
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // Sunday first, like a regular calendar
const STAR = '#E0AE45';

// Older Android builds need this switched on for LayoutAnimation.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
// The fold / unfold when switching the open event.
const SWAP = {
  duration: 320,
  create: { type: 'easeInEaseOut', property: 'opacity' },
  update: { type: 'easeInEaseOut' },
  delete: { type: 'easeInEaseOut', property: 'opacity' },
};

export default function EventsScreen({ navigation }) {
  const today = useToday();
  const [data, setData] = useState({ goals: DEFAULT_GOALS, dailyGoals: {}, sessions: [] });
  const [events, setEvents] = useState([]);
  const [eventsSource, setEventsSource] = useState(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const listFade = useRef(new Animated.Value(0)).current;
  const [selected, setSelected] = useState(today);
  // Which event card is open (null = the next upcoming one).
  const [openId, setOpenId] = useState(null);
  // Events already put in the phone's calendar, and a short note under the buttons.
  const [inCalendar, setInCalendar] = useState({});
  const [calNote, setCalNote] = useState(null); // { id, text, settings? }
  const noteTimer = useRef(null);
  const scrollRef = useRef(null);
  const padY = useRef(0);
  const listY = useRef(0);
  const [earlier, setEarlier] = useState(0);

  const calRef = useRef(null);
  const calHeight = useRef(0);
  const calY = useRef(0);
  const earlierH = useRef(40);      // height of the "↑ Earlier weeks" row
  const pendingShift = useRef(0);   // + px to keep in place after adding weeks, − after removing
  const scrolledUp = useRef(false); // has the user scrolled up into the earlier weeks yet?

  const reloadData = useCallback(() => { loadAll().then(setData); }, []);
  // Reload on focus, and whenever goals / plans / sessions are saved anywhere,
  // so the calendar never draws with old goal settings.
  useFocusEffect(useCallback(() => {
    reloadData();
    // Leaving the tab folds earlier weeks away again.
    return () => { setEarlier(0); scrolledUp.current = false; };
  }, [today]));
  useDataChange(reloadData);
  useEffect(() => { setSelected(today); }, [today]);

  // Refresh: the list fades out and clears, "Getting the latest events…"
  // shows, then whatever the events server returns fades back in. (A short
  // minimum wait so the reload is visible even on fast Wi-Fi.)
  const refreshEvents = useCallback(async (force = false) => {
    setLoadingEvents(true);
    setRefreshFailed(false);
    setOpenId(null);
    if (force) {
      await new Promise((done) => Animated.timing(listFade, { toValue: 0, duration: 200, useNativeDriver: true }).start(done));
      setEvents([]);
    }
    const [r] = await Promise.all([loadEvents({ force }), new Promise((done) => setTimeout(done, force ? 900 : 0))]);
    setEvents(r.events);
    setEventsSource(r.source);
    setUpdatedAt(r.updatedAt);
    setRefreshFailed(force && r.source !== 'live');
    setLoadingEvents(false);
    listFade.setValue(0);
    Animated.timing(listFade, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, []);
  useEffect(() => { refreshEvents(); loadAddedEvents().then(setInCalendar); }, []);

  async function onAddToCalendar(e) {
    const r = await addEventToCalendar(e);
    setInCalendar(r.added);
    const text = {
      added: 'Added to your calendar · reminder 1 hour before',
      already: "It's already in your calendar.",
      denied: 'Calendar access is off for this app.',
      error: "Couldn't add it to your calendar. Try again in a moment.",
    }[r.status];
    clearTimeout(noteTimer.current);
    setCalNote({ id: e.id, text, settings: r.status === 'denied', ok: r.status === 'added' || r.status === 'already' });
    noteTimer.current = setTimeout(() => setCalNote(null), 4500);
  }

  // Leaving the app (not just switching tabs) puts the next event back on top.
  useEffect(() => {
    let wasAway = false;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') wasAway = true;
      if (state === 'active' && wasAway) {
        wasAway = false;
        setOpenId(null);
      }
    });
    return () => sub.remove();
  }, []);

  const byDay = useMemo(() => eventsByDay(events), [events]);
  const coming = useMemo(() => upcoming(events), [events]);
  const weeks = useMemo(() => calendarWeeks(parseDayKey(today), earlier, 11), [today, earlier]);
  const days = useMemo(() => {
    const map = {};
    for (const w of weeks) for (const k of w) map[k] = calendarDay(data.sessions, data.dailyGoals, data.goals, k, today);
    return map;
  }, [weeks, data, today]);

  const sel = days[selected] || calendarDay(data.sessions, data.dailyGoals, data.goals, selected, today);
  const selEvents = byDay[selected] || [];

  function openDay(key) {
    navigation.navigate('Brainstorm', { screen: 'BrainstormDay', params: { day: key }, initial: false });
  }

  function onPressDay(d) {
    setSelected(d.key);
    if (!d.future && !d.isToday && d.count > 0) openDay(d.key);
  }

  // Where this week's row starts inside the calendar scroll.
  const thisWeekY = () => earlierH.current + earlier * ROW_H;

  function showEarlier() {
    scrolledUp.current = false;
    pendingShift.current = 4 * ROW_H;
    setEarlier((n) => n + 4);
  }

  // Fold the earlier weeks away, keeping what's on screen in place.
  function foldEarlier() {
    if (!earlier) return;
    pendingShift.current = -earlier * ROW_H;
    scrolledUp.current = false;
    setEarlier(0);
  }

  function backToThisWeek() {
    calRef.current?.scrollTo({ y: thisWeekY(), animated: true });
    setTimeout(foldEarlier, 350);
  }

  function onCalSize(_, h) {
    const shift = pendingShift.current;
    if (shift && calHeight.current) {
      pendingShift.current = 0;
      const y = Math.max(0, calY.current + shift);
      calRef.current?.scrollTo({ y, animated: false });
      calY.current = y;
      // Just added weeks: glide up so they come into view.
      if (shift > 0) setTimeout(() => calRef.current?.scrollTo({ y: 0, animated: true }), 30);
    }
    calHeight.current = h;
  }

  // Scrolling back down to this week folds the earlier weeks away.
  function onCalScroll(e) {
    const y = e.nativeEvent.contentOffset.y;
    calY.current = y;
    if (!earlier) return;
    if (y < thisWeekY() - ROW_H) scrolledUp.current = true;
    else if (scrolledUp.current && y >= thisWeekY() - 4) foldEarlier();
  }

  const activeId = coming.some((e) => e.id === openId) ? openId : coming[0]?.id;

  function openEventCard(id) {
    if (id === activeId) return;
    LayoutAnimation.configureNext(SWAP);
    setOpenId(id);
  }

  // From the calendar: scroll up to the list and open that event there.
  function showEvent(id) {
    scrollRef.current?.scrollTo({ y: Math.max(0, padY.current + listY.current - 8), animated: true });
    setTimeout(() => openEventCard(id), 250);
  }

  return (
    <Screen scrollRef={scrollRef}>
      <Header title="Events & Calendar" subtitle="What’s coming up, and every day you showed up to write" />
      <View style={s.pad} onLayout={(e) => { padY.current = e.nativeEvent.layout.y; }}>
        {/* ---------- Coming up (top to bottom) ---------- */}
        <View style={s.titleRow} onLayout={(e) => { listY.current = e.nativeEvent.layout.y; }}>
          <Text style={s.h}>Coming up</Text>
          <Pressable
            onPress={() => refreshEvents(true)}
            disabled={loadingEvents}
            style={[s.refresh, loadingEvents && { opacity: 0.45 }]}
            accessibilityRole="button"
            accessibilityLabel="Refresh events from Eventbrite"
          >
            <Ionicons name="refresh" size={15} color={colors.royal} />
            <Text style={s.refreshText}>{loadingEvents ? 'Refreshing' : 'Refresh'}</Text>
          </Pressable>
        </View>

        {loadingEvents && (
          <View style={[s.card, s.loadingCard]}>
            <ActivityIndicator size="small" color={colors.royal} />
            <Text style={s.body}>Getting the latest events from Eventbrite…</Text>
          </View>
        )}

        <Animated.View style={{ opacity: listFade, gap: space.md }}>
        {!loadingEvents && coming.length === 0 && (
          <View style={[s.card, lift]}>
            <Text style={s.body}>No events listed right now. New salons are posted on Eventbrite.</Text>
          </View>
        )}

        {coming.map((e, i) => (
          <EventCard
            key={e.id}
            event={e}
            open={e.id === activeId}
            isNext={i === 0}
            onOpen={() => openEventCard(e.id)}
            inCalendar={!!inCalendar[e.id]}
            onAddToCalendar={() => onAddToCalendar(e)}
            onShare={() => shareEvent(e)}
            note={calNote?.id === e.id ? calNote : null}
          />
        ))}

        {!loadingEvents && (
          <Text style={s.note}>
            {refreshFailed
              ? "Couldn't reach Eventbrite, so these are the last saved events."
              : eventsSource === 'built-in'
                ? 'Showing saved salon dates. Live Eventbrite updates turn on once the events server is set up.'
                : `Live from Eventbrite${updatedAt ? ` · updated ${new Date(updatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}`}
          </Text>
        )}
        </Animated.View>

        <Pressable onPress={() => openLink(LINKS.eventbrite)} style={s.allLink}>
          <Text style={s.link}>See all events on Eventbrite  ›</Text>
        </Pressable>

        {/* ---------- Selected day ---------- */}
        <View style={[s.card, lift, s.dayCard]}>
          <Rings
            minutes={sel.rings.minutes} words={sel.rings.words} sessions={sel.rings.sessions}
            faded={sel.future} size={70}
          />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={s.dayTitle}>
              {sel.isToday ? 'Today · ' : ''}
              {parseDayKey(selected).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
            <Text style={s.body}>
              {sel.future
                ? sel.off ? 'Day off' : `Plan: ${describeDailyGoal(sel.goal)}`
                : sel.count
                  ? `${sel.words.toLocaleString()} words · ${formatDuration(sel.seconds)} · ${sel.count} session${sel.count === 1 ? '' : 's'}${sel.rings.closed ? ' · all rings closed' : ''}`
                  : sel.off ? 'Day off' : 'No writing this day'}
            </Text>
            {selEvents.map((e) => (
              <Pressable key={e.id} onPress={() => showEvent(e.id)} style={s.dayEvent} accessibilityRole="button">
                <Ionicons name="star" size={14} color={STAR} />
                <Text style={s.dayEventText} numberOfLines={1}>{e.name}</Text>
              </Pressable>
            ))}
            {!sel.future && sel.count > 0 && (
              <Pressable onPress={() => openDay(selected)} hitSlop={6}>
                <Text style={s.link}>Read what you wrote  ›</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* ---------- Rolling calendar ---------- */}
        <View style={[s.card, lift, { paddingHorizontal: 10 }]}>
          <View style={s.titleRow}>
            <Text style={s.h}>Your writing calendar</Text>
          </View>
          <View style={s.legend}>
            <Legend color={RING_COLORS.light.minutes} label="Minutes" />
            <Legend color={RING_COLORS.light.words} label="Words" />
            <Legend color={RING_COLORS.light.sessions} label="Sessions" />
            <View style={s.legendItem}>
              <Ionicons name="star" size={12} color={STAR} />
              <Text style={s.legendText}>Event</Text>
            </View>
          </View>
          <View style={s.weekHead}>
            {WEEKDAYS.map((d, i) => <Text key={i} style={s.weekHeadText}>{d}</Text>)}
          </View>
          <View>
          <ScrollView
            ref={calRef}
            style={{ height: ROW_H * VISIBLE_WEEKS + 6 }}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            onContentSizeChange={onCalSize}
            onScroll={onCalScroll}
            scrollEventThrottle={32}
          >
            <Pressable
              onPress={showEarlier}
              onLayout={(e) => { earlierH.current = e.nativeEvent.layout.height; }}
              style={s.earlier}
              accessibilityRole="button"
            >
              <Text style={s.earlierText}>↑  Earlier weeks</Text>
            </Pressable>
            {weeks.map((w) => (
              <View key={w[0]} style={s.week}>
                {w.map((k) => (
                  <DayCell
                    key={k}
                    day={days[k]}
                    selected={k === selected}
                    hasEvent={!!byDay[k]}
                    onPress={() => onPressDay(days[k])}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
          {earlier > 0 && (
            <Pressable onPress={backToThisWeek} style={s.backPill} accessibilityRole="button">
              <Text style={s.backPillText}>↓  Back to this week</Text>
            </Pressable>
          )}
          </View>
          <Text style={s.hint}>Tap a past day to read what you wrote.</Text>
        </View>
      </View>

    </Screen>
  );
}

// One event. Open: gold border, label, full name, description, Register.
// Closed: a slim row; tapping it opens it (and folds the other one).
function EventCard({ event: e, open, isNext, onOpen, inCalendar, onAddToCalendar, onShare, note }) {
  const where = e.online ? 'Online' : e.venue;
  if (!open) {
    return (
      <Pressable onPress={onOpen} style={[s.row, lift]} accessibilityRole="button" accessibilityHint="Shows details and Register">
        <DateBadge iso={e.start} />
        <View style={{ flex: 1 }}>
          <Text style={s.rowName} numberOfLines={2}>{e.name}</Text>
          <Text style={s.when}>{eventWhen(e)}{where ? ` · ${where}` : ''}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
    );
  }
  return (
    <View style={[s.next, lift]}>
      <View style={s.nextHead}>
        <Ionicons name="star" size={15} color={STAR} />
        <Text style={s.kicker}>{isNext ? 'NEXT EVENT' : 'COMING UP'}</Text>
      </View>
      <View style={s.eventRow}>
        <DateBadge iso={e.start} big />
        <View style={{ flex: 1 }}>
          <Text style={s.nextName}>{e.name}</Text>
          <Text style={s.when}>{eventWhen(e)}{where ? ` · ${where}` : ''}</Text>
        </View>
      </View>
      {e.summary ? <Text style={s.body}>{e.summary}</Text> : null}
      <Pressable onPress={() => openLink(e.url)} style={s.register} accessibilityRole="link">
        <Text style={s.registerText}>Register on Eventbrite</Text>
      </Pressable>
      <View style={s.actions}>
        <Pressable
          onPress={onAddToCalendar}
          style={[s.action, inCalendar && s.actionDone]}
          accessibilityRole="button"
          accessibilityLabel={inCalendar ? 'In your calendar' : 'Add to calendar'}
        >
          <Ionicons name={inCalendar ? 'checkmark' : 'calendar-outline'} size={16} color={inCalendar ? '#1E7B3A' : colors.royal} />
          <Text style={[s.actionText, inCalendar && { color: '#1E7B3A' }]}>{inCalendar ? 'In your calendar' : 'Add to calendar'}</Text>
        </Pressable>
        <Pressable onPress={onShare} style={s.action} accessibilityRole="button" accessibilityLabel="Share this event">
          <Ionicons name="share-outline" size={16} color={colors.royal} />
          <Text style={s.actionText}>Share</Text>
        </Pressable>
      </View>
      {note ? (
        <View style={[s.calNote, note.ok && s.calNoteOk]}>
          <Text style={[s.calNoteText, note.ok && { color: '#1E5E33' }]}>{note.text}</Text>
          {note.settings ? (
            <Pressable onPress={openPhoneSettings} hitSlop={6}>
              <Text style={s.calNoteLink}>Open Settings</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function DateBadge({ iso, big }) {
  const d = new Date(iso);
  return (
    <View style={[s.badge, big && s.badgeBig]}>
      <Text style={s.badgeMonth}>{d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text>
      <Text style={[s.badgeDay, big && { fontSize: 24 }]}>{d.getDate()}</Text>
    </View>
  );
}

function DayCell({ day, selected, hasEvent, onPress }) {
  const date = parseDayKey(day.key);
  const n = date.getDate();
  const monthTag = n === 1 ? date.toLocaleDateString(undefined, { month: 'short' }) : null;
  return (
    <Pressable
      onPress={onPress}
      style={[s.cell, selected && s.cellSelected, day.isToday && s.cellToday]}
      accessibilityRole="button"
      accessibilityLabel={`${date.toDateString()}${hasEvent ? ', event' : ''}${day.count ? `, ${day.words} words` : ''}`}
    >
      <Text style={[s.cellNum, day.isToday && s.cellNumToday, day.future && { color: colors.muted }]}>
        {monthTag ? <Text style={s.monthTag}>{monthTag} </Text> : null}{n}
      </Text>
      <View>
        <Rings
          minutes={day.rings.minutes} words={day.rings.words} sessions={day.rings.sessions}
          faded={day.future} size={34}
        />
        {hasEvent && (
          <View style={s.star} pointerEvents="none">
            <Ionicons name="star" size={22} color={STAR} style={s.starIcon} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

function Legend({ color, label }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.legendDot, { backgroundColor: color }]} />
      <Text style={s.legendText}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pad: { padding: space.lg, gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h: { fontSize: 16, fontWeight: '700', color: colors.ink },
  body: { fontSize: 13, color: colors.body, lineHeight: 18 },
  note: { fontSize: 11.5, color: colors.muted, textAlign: 'center' },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: colors.royal, backgroundColor: '#FFFFFF' },
  refreshText: { fontSize: 12.5, fontWeight: '700', color: colors.royal },
  loadingCard: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64 },
  card: { backgroundColor: '#FFFFFF', borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 14 },

  next: { backgroundColor: '#FFFFFF', borderRadius: radius.lg, borderWidth: 2, borderColor: colors.karmaLight, padding: 14, gap: 12 },
  nextHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: '#8A5E12' },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextName: { fontSize: 16, fontWeight: '700', color: colors.ink },
  when: { fontSize: 12.5, color: colors.body, marginTop: 2 },
  register: { backgroundColor: colors.royal, borderRadius: radius.md, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  registerText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 12, minHeight: 64 },
  rowName: { fontSize: 14.5, fontWeight: '700', color: colors.ink },

  badge: { width: 46, paddingVertical: 5, borderRadius: 10, backgroundColor: colors.cream, alignItems: 'center' },
  badgeBig: { width: 56, paddingVertical: 7 },
  badgeMonth: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: '#8A5E12' },
  badgeDay: { fontSize: 19, fontWeight: '800', color: colors.ink },

  allLink: { alignItems: 'center', minHeight: 40, justifyContent: 'center' },
  link: { color: colors.royal, fontSize: 13, fontWeight: '700' },

  dayCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dayTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  dayEvent: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 26 },
  dayEventText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#8A5E12' },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6, marginBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 11.5, color: colors.muted },
  weekHead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 6 },
  weekHeadText: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.muted },
  earlier: { alignItems: 'center', justifyContent: 'center', minHeight: 40 },
  earlierText: { fontSize: 12.5, fontWeight: '700', color: colors.royal },
  week: { flexDirection: 'row', height: ROW_H },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent' },
  cellSelected: { backgroundColor: '#EEF2FB' },
  cellToday: { borderColor: colors.royal },
  cellNum: { fontSize: 11, fontWeight: '600', color: colors.ink },
  cellNumToday: { color: colors.royal, fontWeight: '800' },
  monthTag: { fontSize: 10, fontWeight: '800', color: '#8A5E12' },
  star: { position: 'absolute', top: -9, right: -11 },
  starIcon: { textShadowColor: 'rgba(138,94,18,0.45)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } },
  actions: { flexDirection: 'row', gap: 8, marginTop: -4 },
  action: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.royal, backgroundColor: '#FFFFFF',
  },
  actionDone: { borderColor: '#1E7B3A', backgroundColor: '#EEF8F1' },
  actionText: { fontSize: 13, fontWeight: '700', color: colors.royal },
  calNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: '#FDECEA', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  calNoteOk: { backgroundColor: '#EEF8F1' },
  calNoteText: { flex: 1, fontSize: 12.5, color: '#8C1D18' },
  calNoteLink: { fontSize: 12.5, fontWeight: '700', color: colors.royal },
  backPill: {
    position: 'absolute', alignSelf: 'center', bottom: 10, backgroundColor: colors.royal, borderRadius: 999,
    paddingHorizontal: 14, minHeight: 34, justifyContent: 'center',
    shadowColor: colors.royalDeep, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  backPillText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  hint: { fontSize: 11.5, color: colors.muted, textAlign: 'center', marginTop: 8 },
});
