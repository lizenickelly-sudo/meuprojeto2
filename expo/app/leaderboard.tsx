import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { Trophy, TrendingUp, TrendingDown, Minus, Crown, Medal, Share2, Flame, Gift } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useUser } from '@/providers/UserProvider';
import { mockLeaderboard, WEEKLY_PRIZES } from '@/mocks/leaderboard';
import type { LeaderboardEntry } from '@/mocks/leaderboard';

const PODIUM_COLORS = ['#00FF87', '#94A3B8', '#FFD700'] as const;
const PODIUM_BG = ['rgba(0,255,135,0.10)', 'rgba(148,163,184,0.10)', 'rgba(255,215,0,0.10)'] as const;

function PodiumCard({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1, friction: 6, tension: 80, delay: index * 150, useNativeDriver: true,
    }).start();
  }, []);

  const isFirst = index === 0;
  const height = isFirst ? 130 : index === 1 ? 105 : 90;

  return (
    <Animated.View style={[pd.col, { transform: [{ scale: scaleAnim }] }]}>
      <View style={[pd.avatar, { borderColor: PODIUM_COLORS[index] }]}>
        <Text style={[pd.initials, { color: PODIUM_COLORS[index] }]}>{entry.avatarInitials}</Text>
        {isFirst && <View style={pd.crownWrap}><Crown size={14} color={Colors.dark.neonGreen} fill={Colors.dark.neonGreen} /></View>}
      </View>
      <Text style={pd.name} numberOfLines={1}>{entry.name}</Text>
      <Text style={pd.shares}>{entry.shares} comp.</Text>
      <View style={[pd.bar, { height, backgroundColor: PODIUM_BG[index], borderColor: PODIUM_COLORS[index] }]}>
        <Text style={[pd.rank, { color: PODIUM_COLORS[index] }]}>{entry.rank}o</Text>
        <Text style={[pd.pts, { color: PODIUM_COLORS[index] }]}>{entry.points} pts</Text>
      </View>
    </Animated.View>
  );
}

const pd = StyleSheet.create({
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2.5, backgroundColor: Colors.dark.card, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  initials: { fontSize: 16, fontWeight: '800' as const },
  crownWrap: { position: 'absolute', top: -12 },
  name: { color: Colors.dark.text, fontSize: 12, fontWeight: '700' as const, textAlign: 'center', maxWidth: 90 },
  shares: { color: Colors.dark.textSecondary, fontSize: 10, marginTop: 2, marginBottom: 6 },
  bar: { width: '85%', borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  rank: { fontSize: 22, fontWeight: '900' as const },
  pts: { fontSize: 10, fontWeight: '600' as const, marginTop: 2 },
});

function LeaderboardRow({ entry, isCurrentUser }: { entry: LeaderboardEntry; isCurrentUser: boolean }) {
  const slideAnim = useRef(new Animated.Value(40)).current;
  const opAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: entry.rank * 60, useNativeDriver: true }),
      Animated.timing(opAnim, { toValue: 1, duration: 400, delay: entry.rank * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const TrendIcon = entry.trend === 'up' ? TrendingUp : entry.trend === 'down' ? TrendingDown : Minus;
  const trendColor = entry.trend === 'up' ? Colors.dark.success : entry.trend === 'down' ? Colors.dark.danger : Colors.dark.textMuted;

  return (
    <Animated.View style={[lr.row, isCurrentUser && lr.rowHL, { transform: [{ translateX: slideAnim }], opacity: opAnim }]}>
      <View style={lr.rankWrap}><Text style={lr.rankNum}>{entry.rank}</Text></View>
      <View style={[lr.avatar, isCurrentUser && { borderColor: Colors.dark.neonGreen }]}>
        <Text style={[lr.initials, isCurrentUser && { color: Colors.dark.neonGreen }]}>{entry.avatarInitials}</Text>
      </View>
      <View style={lr.info}>
        <Text style={[lr.name, isCurrentUser && { color: Colors.dark.neonGreen }]} numberOfLines={1}>{entry.name}</Text>
        <Text style={lr.city}>{entry.city}</Text>
      </View>
      <View style={lr.stats}>
        <View style={lr.shareRow}><Share2 size={11} color={Colors.dark.textSecondary} /><Text style={lr.shareVal}>{entry.shares}</Text></View>
        <Text style={lr.ptsVal}>{entry.points} pts</Text>
      </View>
      <TrendIcon size={16} color={trendColor} />
    </Animated.View>
  );
}

const lr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.card, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  rowHL: { borderColor: Colors.dark.neonGreenBorder, backgroundColor: Colors.dark.neonGreenFaint },
  rankWrap: { width: 28, alignItems: 'center' },
  rankNum: { color: Colors.dark.textSecondary, fontSize: 14, fontWeight: '800' as const },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: Colors.dark.cardBorder, backgroundColor: Colors.dark.surfaceLight, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  initials: { color: Colors.dark.text, fontSize: 13, fontWeight: '700' as const },
  info: { flex: 1, marginLeft: 10 },
  name: { color: Colors.dark.text, fontSize: 14, fontWeight: '700' as const },
  city: { color: Colors.dark.textMuted, fontSize: 11, marginTop: 1 },
  stats: { alignItems: 'flex-end', marginRight: 10 },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  shareVal: { color: Colors.dark.textSecondary, fontSize: 12, fontWeight: '600' as const },
  ptsVal: { color: Colors.dark.gold, fontSize: 11, fontWeight: '700' as const, marginTop: 2 },
});

export default function LeaderboardScreen() {
  console.log("[Leaderboard] Leaderboard screen initialized");
  const { profile } = useUser();
  const top3 = mockLeaderboard.slice(0, 3);
  const podiumOrder = [top3[1], top3[0], top3[2]];
  const rest = mockLeaderboard.slice(3);

  return (
    <View style={s.ctr}>
      <Stack.Screen options={{ title: 'Ranking Semanal' }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.sc}>
        <View style={s.headerCard}>
          <LinearGradient colors={['#00FF87', '#00CC6A', '#0A2E1A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.headerGrad}>
            <View style={s.headerRow}><Flame size={20} color="#000" /><Text style={s.headerTtl}>TOP COMPARTILHADORES</Text><Flame size={20} color="#000" /></View>
            <Text style={s.headerSub}>Ranking semanal - Compartilhe ofertas e ganhe pontos extras!</Text>
            <View style={s.prizeRow}>
              {WEEKLY_PRIZES.map((p) => (
                <View key={p.rank} style={s.prizeItem}><Gift size={14} color="#000" /><Text style={s.prizeTxt}>{p.rank}o: +{p.bonus} pts</Text></View>
              ))}
            </View>
          </LinearGradient>
        </View>

        <View style={s.podium}>
          {podiumOrder.map((entry, i) => entry ? <PodiumCard key={entry.id} entry={entry} index={i === 1 ? 0 : i === 0 ? 1 : 2} /> : null)}
        </View>

        <View style={s.listSection}>
          <Text style={s.listTtl}>Classificacao Geral</Text>
          {rest.map((entry) => <LeaderboardRow key={entry.id} entry={entry} isCurrentUser={profile.name === entry.name} />)}
        </View>

        <View style={s.infoCard}>
          <Medal size={20} color={Colors.dark.gold} />
          <View style={s.infoContent}>
            <Text style={s.infoTtl}>Como subir no ranking?</Text>
            <Text style={s.infoDesc}>Compartilhe ofertas dos patrocinadores nas redes sociais. Cada compartilhamento vale 10 pontos. Os 3 primeiros ganham pontos extras toda semana!</Text>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  ctr: { flex: 1, backgroundColor: 'transparent' },
  sc: { paddingBottom: 20, paddingTop: 12 },
  headerCard: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', shadowColor: '#00FF87', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  headerGrad: { padding: 18, alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  headerTtl: { color: '#000', fontSize: 14, fontWeight: '900' as const, letterSpacing: 1.5 },
  headerSub: { color: 'rgba(0,0,0,0.6)', fontSize: 12, textAlign: 'center', marginBottom: 12 },
  prizeRow: { flexDirection: 'row', gap: 16 },
  prizeItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  prizeTxt: { color: '#000', fontSize: 11, fontWeight: '700' as const },
  podium: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 24, alignItems: 'flex-end', height: 220 },
  listSection: { paddingHorizontal: 16, marginTop: 24 },
  listTtl: { color: Colors.dark.text, fontSize: 17, fontWeight: '800' as const, marginBottom: 12 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: Colors.dark.card, borderRadius: 14, padding: 16, marginHorizontal: 16, marginTop: 20, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  infoContent: { flex: 1 },
  infoTtl: { color: Colors.dark.text, fontSize: 14, fontWeight: '700' as const, marginBottom: 4 },
  infoDesc: { color: Colors.dark.textSecondary, fontSize: 12, lineHeight: 18 },
});
