// components/Medal.js — one round medal around an icon or a short glyph
// like "Ae" or "?!". Each tier has its own look so they're easy to tell apart:
//   not yet  — a pale dashed outline, faded icon and a small lock (clearly "locked")
//   bronze   — warm copper ring
//   silver   — real metallic ring: bright highlight, darker edge, dark icon
//   gold     — warm gold ring
//   diamond  — icy blue-violet ring with a soft glow and a small gem on top
//              (the top tier; it used to be called platinum)

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export const TIER_STYLE = {
  bronze: { ring: ['#EDBB8A', '#A8632F'], inner: '#FFF6EC', ink: '#6B3A12', label: '#8A4F1E', chip: '#F6E3D0', dot: '#B87A45' },
  silver: {
    ring: ['#FFFFFF', '#D9DEE7', '#8E98AB', '#C9CFDA', '#6C7588'], locations: [0, 0.3, 0.62, 0.8, 1],
    inner: '#F7F8FB', innerEdge: 'rgba(108,117,136,0.28)', ink: '#2B3346', label: '#4A5366', chip: '#E6E9F0', dot: '#A3ACBD',
  },
  gold: { ring: ['#F6DD93', '#C8912B'], inner: '#FFF8E6', ink: '#6E4A07', label: '#8A5E12', chip: '#FBEFD2', dot: '#E0AE45' },
  diamond: {
    ring: ['#E6FBFF', '#8FE3FF', '#7C9BFF', '#B89CFF', '#F2E9FF'], locations: [0, 0.3, 0.6, 0.85, 1],
    inner: '#F7FAFF', ink: '#3B3FA8', label: '#4B3FB8', chip: '#ECE7FF', dot: '#9DB2FF', glow: true, gem: true,
  },
  locked: { ring: null, inner: 'transparent', ink: '#B5BCCB', label: '#8A93AE', chip: '#EEF0F5', dot: '#CDD2DD', lock: true },
};

export default function Medal({ medal, tier, size = 86 }) {
  const t = TIER_STYLE[tier || 'locked'];
  const inner = Math.round(size * 0.77);
  const content = medal.glyph ? (
    <Text style={{ fontSize: Math.round(size * 0.22), fontWeight: '800', letterSpacing: -0.5, color: t.ink }}>{medal.glyph}</Text>
  ) : (
    <Ionicons name={medal.icon} size={Math.round(size * 0.36)} color={t.ink} />
  );

  // Not earned yet: no metal at all, just a dashed outline and a lock.
  if (!t.ring) {
    const badge = Math.max(16, Math.round(size * 0.26));
    return (
      <View style={[s.locked, { width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(2, size * 0.028) }]}>
        {content}
        <View style={[s.lock, { width: badge, height: badge, borderRadius: badge / 2, right: size * 0.02, bottom: size * 0.02 }]}>
          <Ionicons name="lock-closed" size={Math.round(badge * 0.55)} color="#8A93AE" />
        </View>
      </View>
    );
  }

  const gem = Math.max(10, Math.round(size * 0.19));
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={t.ring}
        locations={t.locations}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[s.ring, t.glow && s.glow, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <View
          style={[
            s.inner,
            { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: t.inner },
            t.innerEdge && { borderWidth: 2, borderColor: t.innerEdge },
          ]}
        >
          {content}
        </View>
      </LinearGradient>
      {t.gem ? (
        <LinearGradient
          colors={['#FFFFFF', '#8FE3FF', '#A88BFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.gem, { width: gem, height: gem, top: -gem * 0.45, left: size / 2 - gem / 2 }]}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  ring: {
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0C2265', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  glow: { shadowColor: '#6E5ADC', shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  inner: { alignItems: 'center', justifyContent: 'center' },
  locked: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FB', borderColor: '#CBD1DC', borderStyle: 'dashed' },
  lock: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#D5DAE4' },
  gem: {
    position: 'absolute', transform: [{ rotate: '45deg' }], borderRadius: 3, borderWidth: 2, borderColor: '#FFFFFF',
    shadowColor: '#5038B4', shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
});
