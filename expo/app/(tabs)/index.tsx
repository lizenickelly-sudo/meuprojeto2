import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  ScanLine,
  ChevronRight,
  DollarSign,
  Heart,
  Star,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useUser } from '@/providers/UserProvider';
import { useSponsor } from '@/providers/SponsorProvider';
import { useAdmin } from '@/providers/AdminProvider';
import { useAuth } from '@/providers/AuthProvider';
import { fetchWinners } from '@/services/database';
import SponsorStories from '@/components/SponsorStories';
import PromotionalFeed from '@/components/PromotionalFeed';
import WelcomeSplash from '@/components/WelcomeSplash';
import type { Sponsor } from "@/types";

console.log("[HomeScreen] Mounting home screen");

function WinnerTicker() {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [winners, setWinners] = useState<{ id: string; name: string; city: string; amount: number }[]>([]);

  useEffect(() => {
    fetchWinners().then((data) => {
      if (data.length > 0) {
        setWinners([...data, ...data]);
        return;
      }
      setWinners([]);
    });
  }, []);

  useEffect(() => {
    if (winners.length === 0) return;
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
  }, [scrollX, winners.length]);

  if (winners.length === 0) {
    return (
      <View style={wt.container}>
        <View style={[wt.row, { justifyContent: 'center' }]}>
          <Text style={wt.city}>Sem ganhadores confirmados no momento</Text>
        </View>
      </View>
    );
  }

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

function SponsorListItem({
  sponsor,
  onPress,
  liked,
  starred,
  stars,
  rank,
  onToggleLike,
  onToggleStar,
}: {
  sponsor: Sponsor;
  onPress: () => void;
  liked: boolean;
  starred: boolean;
  stars: number;
  rank: number;
  onToggleLike: () => void;
  onToggleStar: () => void;
}) {
  const hasCoupon = Boolean(sponsor.couponValue && sponsor.couponValue >= 5);
  const starsLabel = `${stars} estrela${stars === 1 ? '' : 's'}`;

  return (
    <View style={sl.card} testID={`sponsor-list-${sponsor.id}`}>
      <TouchableOpacity style={sl.mainTap} onPress={onPress} activeOpacity={0.75}>
        <View style={sl.logoWrap}>
          <Image source={{ uri: sponsor.logoUrl }} style={sl.logo} contentFit="cover" cachePolicy="memory-disk" />
        </View>
        <View style={sl.content}>
          <View style={sl.topRow}>
            <View style={sl.topBadgesRow}>
              {rank === 1 && <Text style={sl.hotBadge}>Mais Pedida</Text>}
              {sponsor.verified && <Text style={sl.verifiedBadge}>Verificada</Text>}
            </View>
          </View>

          <Text style={sl.name} numberOfLines={1}>{sponsor.name}</Text>

          <View style={sl.metaRow}>
            <Star size={11} color="#F59E0B" fill="#F59E0B" />
            <Text style={sl.metaStrong}>{stars > 0 ? stars.toFixed(1) : '4.5'}</Text>
            <Text style={sl.metaText}>({Math.max(stars * 12, 12)})</Text>
            <Text style={sl.metaDot}>•</Text>
            <Text style={sl.metaText}>{sponsor.city}</Text>
            <Text style={sl.metaDot}>•</Text>
            <Text style={sl.metaText}>R$ {sponsor.minPurchaseValue?.toFixed(2)}</Text>
          </View>

          <View style={sl.bottomRow}>
            <Text style={sl.categoryText} numberOfLines={1}>{sponsor.category}</Text>
            {hasCoupon && <Text style={sl.couponTag}>R$ {sponsor.couponValue?.toFixed(0)} off</Text>}
            <Text style={sl.rankTag}>#{rank}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={sl.rightActions}>
        <TouchableOpacity style={sl.iconBtn} onPress={onToggleLike} activeOpacity={0.8}>
          <Heart size={16} color={liked ? '#EF4444' : '#9CA3AF'} fill={liked ? '#EF4444' : 'transparent'} />
        </TouchableOpacity>
        <TouchableOpacity style={sl.iconBtn} onPress={onToggleStar} activeOpacity={0.8}>
          <Star size={16} color={starred ? '#F59E0B' : '#9CA3AF'} fill={starred ? '#F59E0B' : 'transparent'} />
        </TouchableOpacity>
        <Text style={sl.starsTiny}>{starsLabel}</Text>
      </View>
    </View>
  );
}

const sl = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  mainTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWrap: {
    width: 58,
    height: 58,
    borderRadius: 12,
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
    marginLeft: 10,
    gap: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 2,
  },
  topBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hotBadge: {
    color: '#FB7185',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  verifiedBadge: {
    color: Colors.dark.textMuted,
    fontSize: 10,
  },
  name: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700' as const,
    flexShrink: 1,
    marginBottom: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaStrong: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  metaDot: {
    color: Colors.dark.textMuted,
    fontSize: 10,
  },
  metaText: {
    color: Colors.dark.textMuted,
    fontSize: 11,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  categoryText: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    flex: 1,
  },
  couponTag: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  rankTag: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  rightActions: {
    marginLeft: 8,
    alignItems: 'center',
    gap: 5,
    paddingTop: 2,
  },
  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surface,
  },
  starsTiny: {
    color: Colors.dark.textMuted,
    fontSize: 9,
    maxWidth: 44,
    textAlign: 'center',
  },
});

export default function HomeScreen() {
  console.log("[HomeScreen] Rendering home screen");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, balance, isLoading: userLoading } = useUser();
  const {
    sponsors,
    sponsorsByCity,
    toggleLikeSponsor,
    toggleSponsorStar,
    isSponsorLiked,
    isSponsorStarred,
    getSponsorStars,
  } = useSponsor();
  const { grandPrizeConfig, getCityPrize, getCityImage } = useAdmin();
  const { userEmail } = useAuth();
  const userCity = profile.city || '';
  const normalizedUserCity = userCity
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const cityPrize = getCityPrize(userCity);
  const cityImage = getCityImage(userCity);

  const citySponsors = useMemo(() => {
    if (!normalizedUserCity) return sponsors;
    const byMap = sponsorsByCity[userCity] || [];
    if (byMap.length > 0) return byMap;
    return sponsors.filter((sp) => (
      sp.city
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase() === normalizedUserCity
    ));
  }, [sponsorsByCity, userCity, normalizedUserCity, sponsors]);

  const rankedCitySponsors = useMemo(() => {
    return [...citySponsors].sort((a, b) => {
      const starsDiff = getSponsorStars(b.id) - getSponsorStars(a.id);
      if (starsDiff !== 0) return starsDiff;
      return a.name.localeCompare(b.name);
    });
  }, [citySponsors, getSponsorStars]);

  const cityOffers = useMemo(() => {
    return citySponsors.flatMap((sp) => sp.offers);
  }, [citySponsors]);

  const hasCityStores = citySponsors.length > 0;
  const hasCityOffers = cityOffers.length > 0;
  const shouldShowCityPromotions = Boolean(userCity && hasCityOffers);
  const shouldShowWelcomeSplash = Platform.OS !== 'web';
  const [showSplash, setShowSplash] = useState<boolean>(shouldShowWelcomeSplash);
  const [splashEmail, setSplashEmail] = useState<string>('');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    if (!shouldShowWelcomeSplash) return;

    if (userEmail && userEmail !== splashEmail) {
      console.log('[HomeScreen] User changed, resetting splash. Old:', splashEmail, 'New:', userEmail);
      setSplashEmail(userEmail);
      setShowSplash(true);
    }
  }, [userEmail, splashEmail, shouldShowWelcomeSplash]);

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

        {shouldShowCityPromotions && (
          <PromotionalFeed
            userCity={userCity || undefined}
          />
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
              <View>
                <Text style={s.sponsorsTitle}>Lojas{userCity ? ` em ${userCity}` : ''}</Text>
                <Text style={s.sponsorsSubTitle}>Ranking por estrelas</Text>
              </View>
              <TouchableOpacity style={s.seeAllBtn} onPress={() => handleSponsorPress(citySponsors[0]?.id || '')}>
                <Text style={s.seeAll}>Ver todas</Text>
                <ChevronRight size={12} color={Colors.dark.primary} />
              </TouchableOpacity>
            </View>
            <View style={s.sponsorsList}>
              {rankedCitySponsors.map((sp, index) => (
                <SponsorListItem
                  key={sp.id}
                  sponsor={sp}
                  onPress={() => handleSponsorPress(sp.id)}
                  liked={isSponsorLiked(sp.id)}
                  starred={isSponsorStarred(sp.id)}
                  stars={getSponsorStars(sp.id)}
                  rank={index + 1}
                  onToggleLike={() => toggleLikeSponsor(sp.id)}
                  onToggleStar={() => toggleSponsorStar(sp.id)}
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
  sponsorsSubTitle: { color: Colors.dark.textMuted, fontSize: 11, marginTop: 1 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAll: { color: Colors.dark.primary, fontSize: 13, fontWeight: '600' as const },
  sponsorsList: { marginBottom: 8 },
});
