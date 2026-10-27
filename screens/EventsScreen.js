// screens/EventsScreen.js — Pen Parentis events + your writing calendar.
//   • Coming up: Eventbrite events, top to bottom (next one highlighted)
//   • the selected day: its three rings, and any event that day
//   • a scrollable rolling calendar that opens on this week, can show earlier
//     weeks, and runs across months. Each day shows its rings (minutes, words,
//     sessions); a big gold star marks event days.
// Tapping a past day you wrote on opens what you wrote that day.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Screen, Header, openLink } from '../components/ui';
import Rings, { RING_COLORS } from '../components/Rings';
import Sheet from '../components/Sheet';
import { colors, lift, radius, space } from '../theme';
import { LINKS } from '../links';
import { eventWhen, eventsByDay, loadEvents, upcoming } from '../eventsService';
import {
  DEFAULT_GOALS, calendarDay, calendarWeeks, describeDailyGoal, formatDuration, parseDayKey,
} from '../writingLogic';
import { loadAll, useToday } from '../writingStore';

const ROW_H = 64;
const VISIBLE_WEEKS = 4;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const STAR = '#E0AE45';

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
  const [openEvent, setOpenEvent] = useState(null);
  const [earlier, setEarlier] = useState(0);

  const calRef = useRef(null);
  const calHeight = useRef(0);
  const pendingShift = useRef(false);

  useFocusEffect(useCallback(() => { loadAll().then(setData); }, [today]));
  useEffect(() => { setSelected(today); }, [today]);

  // Refresh: the list fades out and clears, "Getting the latest events…"
  // shows, then whatever the events server returns fades back in. (A short
  // minimum wait so the reload is visible even on fast Wi-Fi.)
  const refreshEvents = useCallback(async (force = false) => {
    setLoadingEvents(true);
    setRefreshFailed(false);
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
  useEffect(() => { refreshEvents(); }, []);

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

  function showEarlier() {
    pendingShift.current = true;
    setEarlier((n) => n + 4);
  }

  // Keep the same weeks in view after adding earlier ones above them.
  function onCalSize(_, h) {
    if (pendingShift.current && calHeight.current) {
      calRef.current?.scrollTo({ y: h - calHeight.current, animated: false });
      pendingShift.current = false;
    }
    calHeight.current = h;
  }

  const next = coming[0];
  const rest = coming.slice(1);

  return (
    <Screen>
      <Header title="Events & Calendar" subtitle="What’s coming up, and every day you showed up to write" />
      <View style={s.pad}>
        {/* ---------- Coming up (top to bottom) ---------- */}
        <View style={s.titleRow}>
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

        {next && (
          <Pressable onPress={() => setOpenEvent(next)} style={[s.next, lift]} accessibilityRole="button">
            <View style={s.nextHead}>
              <Ionicons name="star" size={15} color={STAR} />
              <Text style={s.kicker}>NEXT EVENT</Text>
            </View>
            <View style={s.eventRow}>
              <DateBadge iso={next.start} big />
              <View style={{ flex: 1 }}>
                <Text style={s.nextName}>{next.name}</Text>
                <Text style={s.when}>{eventWhen(next)}</Text>
                <Text style={s.venue}>{next.online ? 'Online' : next.venue}</Text>
              </View>
            </View>
            <Pressable onPress={() => openLink(next.url)} style={s.register} accessibilityRole="link">
              <Text style={s.registerText}>Register on Eventbrite</Text>
            </Pressable>
          </Pressable>
        )}

        {rest.map((e) => (
          <Pressable key={e.id} onPress={() => setOpenEvent(e)} style={[s.row, lift]} accessibilityRole="button">
            <DateBadge iso={e.start} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowName} numberOfLines={2}>{e.name}</Text>
              <Text style={s.when}>{eventWhen(e)}{e.online ? ' · Online' : e.venue ? ` · ${e.venue}` : ''}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
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
            off={sel.off && !sel.count} faded={sel.future} size={70}
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
              <Pressable key={e.id} onPress={() => setOpenEvent(e)} style={s.dayEvent}>
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
          <ScrollView
            ref={calRef}
            style={{ height: ROW_H * VISIBLE_WEEKS + 6 }}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            onContentSizeChange={onCalSize}
          >
            <Pressable onPress={showEarlier} style={s.earlier} accessibilityRole="button">
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
          <Text style={s.hint}>Tap a past day to read what you wrote.</Text>
        </View>
      </View>

      <Sheet
        visible={!!openEvent}
        onClose={() => setOpenEvent(null)}
        title={openEvent?.name || ''}
        subtitle={openEvent ? `${eventWhen(openEvent)} · ${openEvent.online ? 'Online' : openEvent.venue || ''}` : ''}
      >
        {openEvent?.summary ? <Text style={[s.body, { marginBottom: space.md }]}>{openEvent.summary}</Text> : null}
        <Pressable onPress={() => openEvent && openLink(openEvent.url)} style={s.register} accessibilityRole="link">
          <Text style={s.registerText}>Register on Eventbrite</Text>
        </Pressable>
      </Sheet>
    </Screen>
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
          off={day.off && !day.count} faded={day.future} size={34}
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
  venue: { fontSize: 12, color: colors.muted, marginTop: 1 },
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
  hint: { fontSize: 11.5, color: colors.muted, textAlign: 'center', marginTop: 8 },
});
