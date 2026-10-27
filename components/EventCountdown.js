// components/EventCountdown.js — Home's event card.
//   • Going to an event → a countdown (days / hours / minutes; "TONIGHT" on
//     the day; "HAPPENING NOW" with Join while it's on), with Details + Share.
//   • Not going to any → the next event with a one-tap "I'm going".
// Updates every 30 seconds while it's on screen.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { openLink } from './ui';
import { colors, gradients, lift, radius } from '../theme';
import { countdownParts, nextAttending, setAttending, shareEvent } from '../eventActions';

function useNow(ms = 30000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

function shortWhen(e) {
  const d = new Date(e.start);
  return `${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function Box({ n, label }) {
  return (
    <View style={s.box}>
      <Text style={s.boxN}>{n}</Text>
      <Text style={s.boxL}>{label}</Text>
    </View>
  );
}

// events: upcoming events sorted by start. attending: { id: true }.
export default function EventCountdown({ events, attending, onDetails }) {
  const now = useNow();
  // Ended events drop off as soon as they're over, even before the list reloads.
  const live = events.filter((e) => countdownParts(e, now).phase !== 'over');
  const going = nextAttending(live, attending);
  const next = live[0];
  if (!going && !next) return null;

  if (!going) {
    return (
      <View style={[s.ask, lift]}>
        <View style={{ flex: 1 }}>
          <Text style={s.askTitle}>Next: {shortWhen(next)}</Text>
          <Text style={s.askSub} numberOfLines={2}>{next.name} · free on Eventbrite</Text>
          <Pressable onPress={() => onDetails(next)} hitSlop={6}>
            <Text style={s.askLink}>Details  ›</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => setAttending(next.id, true)} style={s.goBtn} accessibilityRole="button">
          <Text style={s.goText}>I'm going</Text>
        </Pressable>
      </View>
    );
  }

  const c = countdownParts(going, now);
  return (
    <LinearGradient colors={gradients.header} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[s.card, lift]}>
      <LinearGradient
        colors={['rgba(224,174,69,0.35)', 'rgba(12,34,101,0)']}
        start={{ x: 1, y: 0 }} end={{ x: 0.3, y: 0.7 }}
        style={StyleSheet.absoluteFill} pointerEvents="none"
      />
      <Text style={s.kick}>★ {c.label}</Text>
      <Text style={s.name} numberOfLines={3}>{going.name}</Text>

      {c.phase === 'soon' && (
        <View style={s.boxes}>
          <Box n={c.days} label={c.days === 1 ? 'day' : 'days'} />
          <Box n={c.hours} label={c.hours === 1 ? 'hour' : 'hours'} />
          <Box n={c.minutes} label="min" />
        </View>
      )}
      {c.phase === 'today' && (
        <View style={s.boxes}>
          <Box n={c.hours} label={c.hours === 1 ? 'hour' : 'hours'} />
          <Box n={c.minutes} label="min" />
        </View>
      )}

      <Text style={s.when}>{shortWhen(going)}{going.online ? ' · Online' : going.venue ? ` · ${going.venue}` : ''}</Text>

      <View style={s.btns}>
        {c.phase === 'live' ? (
          <Pressable onPress={() => openLink(going.url)} style={[s.btn, s.btnGold]} accessibilityRole="link">
            <Text style={[s.btnText, { color: '#2A1A00' }]}>Join on Eventbrite</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => onDetails(going)} style={[s.btn, s.btnWhite]} accessibilityRole="button">
            <Text style={[s.btnText, { color: colors.royal }]}>Details</Text>
          </Pressable>
        )}
        <Pressable onPress={() => shareEvent(going)} style={[s.btn, s.btnGhost]} accessibilityRole="button" accessibilityLabel="Share this event">
          <Ionicons name="share-outline" size={15} color="#FFFFFF" />
          <Text style={[s.btnText, { color: '#FFFFFF' }]}>Share</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: 16, overflow: 'hidden' },
  kick: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, color: '#F2C14E' },
  name: { fontSize: 14.5, fontWeight: '700', color: '#FFFFFF', marginTop: 4, marginBottom: 12, lineHeight: 20 },
  boxes: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  box: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  boxN: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  boxL: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  when: { fontSize: 12.5, color: 'rgba(255,255,255,0.85)' },
  btns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, minHeight: 42, borderRadius: radius.md, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  btnWhite: { backgroundColor: '#FFFFFF' },
  btnGold: { backgroundColor: '#F2C14E' },
  btnGhost: { backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  btnText: { fontSize: 13, fontWeight: '700' },
  ask: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.cream, borderRadius: radius.md, padding: 14 },
  askTitle: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  askSub: { fontSize: 12, color: '#5C4A2A', marginTop: 2 },
  askLink: { fontSize: 12.5, fontWeight: '700', color: colors.royal, marginTop: 6 },
  goBtn: { backgroundColor: '#1E7B3A', borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  goText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
});
