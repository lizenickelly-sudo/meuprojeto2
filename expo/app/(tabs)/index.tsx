import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  ScanLine,
  Trophy,
  ChevronRight,
  Star,
  Heart,
  DollarSign,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useUser } from '@/providers/UserProvider';
import { useSponsor } from '@/providers/SponsorProvider';
import { useAdmin } from '@/providers/AdminProvider';
import { useAuth } from '@/providers/AuthProvider';
import { mockWinners } from '@/mocks/winners';
import { fetchWinners } from '@/services/database';
import SponsorStories from '@/components/SponsorStories';
import PromotionalFeed from '@/components/PromotionalFeed';
import WelcomeSplash from '@/components/WelcomeSplash';
import type { Sponsor } from "@/types";
import { useMemo } from 'react';

console.log("[HomeScreen] Mounting home screen");
const { width: SCREEN_W } = Dimensions.get('window');

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
        secs: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [targetDate]);

  return (
    <View style={cd.row}>
      {[
        { v: timeLeft.days, l: 'DIAS' },
        { v: timeLeft.hours, l: 'HRS' },
        { v: timeLeft.mins, l: 'MIN' },
        { v: timeLeft.secs, l: 'SEG' },
      ].map((item, i) => (
        <React.Fragment key={item.l}>
          {i > 0 && <Text style={cd.sep}>:</Text>}
          <View style={cd.box}>
            <Text style={cd.val}>{String(item.v).padStart(2, '0')}</Text>
            <Text style={cd.lbl}>{item.l}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const cd = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  sep: { color: Colors.dark.primary, fontSize: 20, fontWeight: '800' as const, marginBottom: 12 },
  box: { alignItems: 'center', backgroundColor: Colors.dark.primaryFaint, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, minWidth: 48, borderWidth: 1, borderColor: Colors.dark.primaryBorder },
  val: { color: Colors.dark.primary, fontSize: 22, fontWeight: '900' as const },
  lbl: { color: Colors.dark.textMuted, fontSize: 8, fontWeight: '700' as const, marginTop: 2, letterSpacing: 1 },
});

function WinnerTicker() {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [winners, setWinners] = useState([...mockWinners, ...mockWinners]);

  useEffect(() => {
    fetchWinners().then((data) => {
      if (data.length > 0) setWinners([...data, ...data]);
    });
  }, []);

  useEffect(() => {
    const totalWidth = winners.length * 220;
    const anim = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -totalWidth / 2,
        duration: totalWidth * 25,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={wt.container}>
      <Animated.View style={[wt.row, { transform: [{ translateX: scrollX }] }]}>
        {winners.map((w, i) => (
          <View key={`${w.id}-${i}`} style={wt.item}>
            <View style={wt.dot} />
            <Text style={wt.name}>{w.name}</Text>
            <Text style={wt.city}>({w.city})</Text>
            <Text style={wt.amt}>R$ {w.amount.toFixed(2)}</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const wt = StyleSheet.create({
  container: { height: 36, overflow: 'hidden', backgroundColor: Colors.dark.primaryFaint, borderRadius: 8, marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.dark.primaryBorder },
  row: { flexDirection: 'row', alignItems: 'center', height: 36 },
  item: { flexDirection: 'row', alignItems: 'center', marginRight: 24, gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.dark.primary },
  name: { color: Colors.dark.text, fontSize: 12, fontWeight: '600' as const },
  city: { color: Colors.dark.textMuted, fontSize: 11 },
  amt: { color: Colors.dark.primary, fontSize: 12, fontWeight: '800' as const },
});

function SponsorListItem({ sponsor, onPress }: { sponsor: Sponsor; onPress: () => void }) {
  const rating = (4.3 + (sponsor.id.charCodeAt(1) % 6) * 0.1).toFixed(1);
  const reviewCount = 80 + sponsor.id.charCodeAt(1) * 47;
  const deliveryTime = `${30 + (sponsor.id.charCodeAt(1) % 4) * 10}-${50 + (sponsor.id.charCodeAt(1) % 4) * 10} min`;
  const isFavorited = sponsor.id === 's1' || sponsor.id === 's3';

  const tags: { label: string; color: string; bgColor: string }[] = [];
  if (sponsor.verified) {
    tags.push({ label: 'Mais Pedido', color: Colors.dark.accent, bgColor: Colors.dark.accentFaint });
  }
  if (sponsor.couponValue && sponsor.couponValue >= 15) {
    tags.push({ label: `R$ ${sponsor.couponValue} off`, color: Colors.dark.primary, bgColor: Colors.dark.primaryFaint });
  }
  if (sponsor.couponValue && sponsor.couponValue >= 10) {
    tags.push({ label: `Até R$ ${sponsor.couponValue}`, color: Colors.dark.primary, bgColor: Colors.dark.primaryFaint });
  }

  return (
    <TouchableOpacity
      style={sl.card}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`sponsor-list-${sponsor.id}`}
    >
      <View style={sl.logoWrap}>
        <Image source={{ uri: sponsor.logoUrl }} style={sl.logo} contentFit="cover" cachePolicy="memory-disk" />
      </View>
      <View style={sl.content}>
        <View style={sl.topRow}>
          <View style={sl.tagsRow}>
            {tags.map((tag, i) => (
              <View key={i} style={[sl.tag, { backgroundColor: tag.bgColor }]}>
                <Text style={[sl.tagTxt, { color: tag.color }]}>{tag.label}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={sl.nameRow}>
          <Text style={sl.name} numberOfLines={1}>{sponsor.name}</Text>
        </View>
        <View style={sl.metaRow}>
          <Star size={12} color="#FFD700" fill="#FFD700" />
          <Text style={sl.rating}>{rating}</Text>
          <Text style={sl.reviewCount}>({reviewCount})</Text>
          <Text style={sl.metaDot}>•</Text>
          <Text style={sl.metaText}>{deliveryTime}</Text>
          <Text style={sl.metaDot}>•</Text>
          <Text style={sl.metaText}>R$ {sponsor.minPurchaseValue?.toFixed(2)}</Text>
        </View>
        {tags.length > 0 && (
          <View style={sl.offersRow}>
            {sponsor.couponValue && sponsor.couponValue >= 10 && (
              <Text style={sl.offerGreen}>R$ {sponsor.couponValue} off</Text>
            )}
          </View>
        )}
      </View>
      <TouchableOpacity style={sl.heartBtn} activeOpacity={0.6}>
        <Heart size={20} color={isFavorited ? '#FF4757' : Colors.dark.textMuted} fill={isFavorited ? '#FF4757' : 'transparent'} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const sl = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    marginLeft: 12,
    gap: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagTxt: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700' as const,
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  reviewCount: {
    color: Colors.dark.textMuted,
    fontSize: 11,
  },
  metaDot: {
    color: Colors.dark.textMuted,
    fontSize: 11,
  },
  metaText: {
    color: Colors.dark.textMuted,
    fontSize: 12,
  },
  offersRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  offerGreen: {
    color: Colors.dark.primary,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  heartBtn: {
    padding: 8,
    marginLeft: 4,
  },
});

export default function HomeScreen() {
  console.log("[HomeScreen] Rendering home screen");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, balance, isLoading: userLoading } = useUser();
  const { sponsors, sponsorsByCity } = useSponsor();
  const { grandPrizeConfig, getCityPrize, getCityImage } = useAdmin();
  const { userEmail } = useAuth();
  const userCity = profile.city || '';
  const cityPrize = getCityPrize(userCity);
  const cityImage = getCityImage(userCity);

  const citySponsors = useMemo(() => {
    return sponsorsByCity[userCity] || [];
  }, [sponsorsByCity, userCity]);

  const cityOffers = useMemo(() => {
    return citySponsors.flatMap((sp) => sp.offers);
  }, [citySponsors]);

  const hasCityStores = citySponsors.length > 0;
  const hasCityOffers = cityOffers.length > 0;
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [splashEmail, setSplashEmail] = useState<string>('');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    if (userEmail && userEmail !== splashEmail) {
      console.log('[HomeScreen] User changed, resetting splash. Old:', splashEmail, 'New:', userEmail);
      setSplashEmail(userEmail);
      setShowSplash(true);
    }
  }, [userEmail, splashEmail]);

  const handleDismissSplash = useCallback(() => {
    setShowSplash(false);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);
  const handleScan = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(tabs)/scanner');
  }, [router]);

  const handleSponsorPress = useCallback((sponsorId: string) => {
    router.push({ pathname: '/sponsor-detail', params: { sponsorId } });
  }, [router]);

  if (showSplash) {
    if (userLoading) {
      return (
        <View style={s.container}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: Colors.dark.textMuted, fontSize: 14 }}>Carregando...</Text>
          </View>
        </View>
      );
    }
    return (
      <WelcomeSplash
        userName={profile.name || 'Visitante'}
        userCity={userCity || undefined}
        grandPrizeConfig={userCity ? (cityPrize || grandPrizeConfig) : grandPrizeConfig}
        cityImage={userCity ? cityImage : undefined}
        onContinue={handleDismissSplash}
      />
    );
  }

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 8 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.dark.primary}
            colors={[Colors.dark.primary]}
          />
        }
      >
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>Ola, <Text style={s.nameAccent}>{profile.name || 'Visitante'}</Text></Text>
            <Text style={s.subtitle}>Explore ofertas e ganhe PIX</Text>
          </View>
          <TouchableOpacity style={s.balanceChip} onPress={() => router.push('/(tabs)/wallet')}>
            <DollarSign size={14} color={Colors.dark.primary} />
            <Text style={s.balanceTxt}>R$ {balance.toFixed(2)}</Text>
          </TouchableOpacity>
        </View>

        <SponsorStories onSponsorPress={handleSponsorPress} userCity={userCity || undefined} />

        <WinnerTicker />

        {hasCityOffers && (
          <PromotionalFeed onGoToStore={handleSponsorPress} userCity={userCity || undefined} />
        )}

        <View style={s.quickRow}>
          <TouchableOpacity style={s.quickBtn} onPress={handleScan} activeOpacity={0.8} testID="scan-btn">
            <LinearGradient colors={['#F97316', '#EA580C']} style={s.quickGrad}>
              <ScanLine size={22} color="#000" />
              <Text style={s.quickTxt}>ESCANEAR CUPOM</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {hasCityStores && (
          <>
            <View style={s.sponsorsHeader}>
              <Text style={s.sponsorsTitle}>Lojas{userCity ? ` em ${userCity}` : ''}</Text>
              <TouchableOpacity style={s.seeAllBtn} onPress={() => handleSponsorPress(citySponsors[0]?.id || '')}>
                <Text style={s.seeAll}>Ver todas</Text>
                <ChevronRight size={12} color={Colors.dark.primary} />
              </TouchableOpacity>
            </View>
            <View style={s.sponsorsList}>
              {citySponsors.map((sp) => (
                <SponsorListItem
                  key={sp.id}
                  sponsor={sp}
                  onPress={() => handleSponsorPress(sp.id)}
                />
              ))}
            </View>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  scroll: { paddingBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  greeting: { color: Colors.dark.textSecondary, fontSize: 16 },
  nameAccent: { color: Colors.dark.text, fontWeight: '800' as const, fontSize: 18 },
  subtitle: { color: Colors.dark.textMuted, fontSize: 12, marginTop: 2 },
  balanceChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.dark.primaryFaint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.dark.primaryBorder },
  balanceTxt: { color: Colors.dark.primary, fontSize: 14, fontWeight: '800' as const },
  quickRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  quickBtn: { flex: 1, borderRadius: 14, overflow: 'hidden', shadowColor: '#F97316', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  quickGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  quickTxt: { color: '#FFF', fontSize: 14, fontWeight: '900' as const, letterSpacing: 0.5 },
  sponsorsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 4, marginBottom: 4 },
  sponsorsTitle: { color: Colors.dark.text, fontSize: 20, fontWeight: '800' as const },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAll: { color: Colors.dark.primary, fontSize: 13, fontWeight: '600' as const },
  sponsorsList: { marginBottom: 8 },
});
