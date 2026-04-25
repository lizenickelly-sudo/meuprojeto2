import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Tabs, useRouter } from 'expo-router';
import {
  ScanLine,
  ChevronRight,
  DollarSign,
  Heart,
  Star,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useScrollToTopOnFocus } from '@/lib/useScrollToTopOnFocus';
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

const STAR_RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

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
  container: { height: 36, overflow: 'hidden', backgroundColor: 'rgba(9,14,28,0.48)', borderRadius: 8, marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  row: { flexDirection: 'row', alignItems: 'center', height: 36 },
  item: { flexDirection: 'row', alignItems: 'center', marginRight: 24, gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.dark.primary },
  name: { color: '#F8FAFC', fontSize: 12, fontWeight: '600' as const },
  city: { color: 'rgba(226,232,240,0.72)', fontSize: 11 },
  amt: { color: Colors.dark.primary, fontSize: 12, fontWeight: '800' as const },
});

function SponsorListItem({
  sponsor,
  onPress,
  liked,
  starred,
  averageStars,
  ratingCount,
  rank,
  onToggleLike,
  onToggleStar,
}: {
  sponsor: Sponsor;
  onPress: () => void;
  liked: boolean;
  starred: boolean;
  averageStars: number;
  ratingCount: number;
  rank: number;
  onToggleLike: () => void;
  onToggleStar: () => void;
}) {
  const starsLabel = ratingCount > 0 ? `${ratingCount} avaliac${ratingCount === 1 ? 'ao' : 'oes'}` : 'Avaliar';
  const hasRatings = ratingCount > 0;
  const averageStarsLabel = hasRatings
    ? averageStars.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : 'Sem avaliacoes';

  return (
    <LinearGradient
      colors={['rgba(244,247,250,0.94)', 'rgba(221,228,236,0.9)', 'rgba(186,197,209,0.88)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={sl.card}
      testID={`sponsor-list-${sponsor.id}`}
    >
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
            {hasRatings ? (
              <>
                <Text style={sl.metaStrong}>{averageStarsLabel}</Text>
                <Text style={sl.metaText}>({ratingCount})</Text>
              </>
            ) : (
              <Text style={sl.metaText}>{averageStarsLabel}</Text>
            )}
            <Text style={sl.metaDot}>•</Text>
            <Text style={sl.metaText}>{sponsor.city}</Text>
          </View>

          <View style={sl.bottomRow}>
            <Text style={sl.categoryText} numberOfLines={1}>{sponsor.category}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={sl.rightActions}>
        <TouchableOpacity style={sl.iconBtn} onPress={onToggleLike} activeOpacity={0.8}>
          <Heart size={16} color={liked ? '#DC2626' : '#475569'} fill={liked ? '#DC2626' : 'transparent'} />
        </TouchableOpacity>
        <TouchableOpacity style={sl.iconBtn} onPress={onToggleStar} activeOpacity={0.8}>
          <Star size={16} color={starred ? '#D97706' : '#475569'} fill={starred ? '#D97706' : 'transparent'} />
        </TouchableOpacity>
        <Text style={sl.starsTiny}>{starsLabel}</Text>
      </View>
    </LinearGradient>
  );
}

const sl = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: 'rgba(15,23,42,0.24)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
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
    backgroundColor: 'rgba(255,255,255,0.56)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
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
    color: '#BE123C',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  verifiedBadge: {
    color: 'rgba(51,65,85,0.76)',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  name: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800' as const,
    flexShrink: 1,
    marginBottom: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaStrong: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '800' as const,
  },
  metaDot: {
    color: 'rgba(71,85,105,0.58)',
    fontSize: 10,
  },
  metaText: {
    color: 'rgba(51,65,85,0.82)',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  categoryText: {
    color: 'rgba(30,41,59,0.82)',
    fontSize: 11,
    fontWeight: '700' as const,
    flex: 1,
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
    borderColor: 'rgba(148,163,184,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.44)',
  },
  starsTiny: {
    color: 'rgba(51,65,85,0.78)',
    fontSize: 9,
    fontWeight: '700' as const,
    maxWidth: 56,
    textAlign: 'center',
  },
});

export default function HomeScreen() {
  console.log("[HomeScreen] Rendering home screen");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView | null>(null);
  const { profile, balance, isLoading: userLoading } = useUser();
  const {
    sponsors,
    sponsorsByCity,
    toggleLikeSponsor,
    toggleSponsorStar,
    isSponsorLiked,
    isSponsorStarred,
    getSponsorStars,
    getSponsorAverageStars,
    getSponsorRatingCount,
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
      const averageDiff = getSponsorAverageStars(b.id) - getSponsorAverageStars(a.id);
      if (averageDiff !== 0) return averageDiff;

      const countDiff = getSponsorRatingCount(b.id) - getSponsorRatingCount(a.id);
      if (countDiff !== 0) return countDiff;

      return a.name.localeCompare(b.name);
    });
  }, [citySponsors, getSponsorAverageStars, getSponsorRatingCount]);

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
  const [ratingSponsor, setRatingSponsor] = useState<Sponsor | null>(null);

  useScrollToTopOnFocus(scrollRef);

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
    router.push('/reels');
  }, [router]);

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

  const handleOpenSponsorRating = useCallback((sponsor: Sponsor) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRatingSponsor(sponsor);
  }, []);

  const handleCloseSponsorRating = useCallback(() => {
    setRatingSponsor(null);
  }, []);

  const handleSelectSponsorRating = useCallback((value: number) => {
    if (!ratingSponsor) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleSponsorStar(ratingSponsor.id, value);
    setRatingSponsor(null);
  }, [ratingSponsor, toggleSponsorStar]);

  const handleClearSponsorRating = useCallback(() => {
    if (!ratingSponsor) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleSponsorStar(ratingSponsor.id, 0);
    setRatingSponsor(null);
  }, [ratingSponsor, toggleSponsorStar]);

  const selectedSponsorStars = ratingSponsor ? getSponsorStars(ratingSponsor.id) : 0;

  if (showSplash) {
    if (userLoading) {
      return (
        <>
          <Tabs.Screen options={{ tabBarStyle: { display: 'none' } }} />
          <View style={s.container}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: Colors.dark.textMuted, fontSize: 14 }}>Carregando...</Text>
            </View>
          </View>
        </>
      );
    }
    return (
      <>
        <Tabs.Screen options={{ tabBarStyle: { display: 'none' } }} />
        <WelcomeSplash
          userCity={userCity || undefined}
          grandPrizeConfig={userCity ? (cityPrize || grandPrizeConfig) : grandPrizeConfig}
          cityImage={userCity ? cityImage : undefined}
          onContinue={handleDismissSplash}
        />
      </>
    );
  }

  return (
    <View style={s.container}>
      <Tabs.Screen options={{ tabBarStyle: showSplash ? { display: 'none' } : undefined }} />

      <ScrollView
        ref={scrollRef}
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
                  averageStars={getSponsorAverageStars(sp.id)}
                  ratingCount={getSponsorRatingCount(sp.id)}
                  rank={index + 1}
                  onToggleLike={() => toggleLikeSponsor(sp.id)}
                  onToggleStar={() => handleOpenSponsorRating(sp)}
                />
              ))}
            </View>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal
        visible={Boolean(ratingSponsor)}
        transparent
        animationType="fade"
        onRequestClose={handleCloseSponsorRating}
      >
        <View style={s.ratingOverlay}>
          <TouchableOpacity style={s.ratingBackdrop} activeOpacity={1} onPress={handleCloseSponsorRating} />
          <View style={s.ratingCard}>
            <Text style={s.ratingEyebrow}>Avaliar loja</Text>
            <Text style={s.ratingTitle}>{ratingSponsor?.name}</Text>
            <Text style={s.ratingSubtitle}>Escolha quantas estrelas você quer dar para esta loja.</Text>

            <View style={s.ratingOptions}>
              {STAR_RATING_OPTIONS.map((value) => {
                const active = selectedSponsorStars === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[s.ratingOption, active && s.ratingOptionActive]}
                    activeOpacity={0.82}
                    onPress={() => handleSelectSponsorRating(value)}
                  >
                    <View style={s.ratingStarsRow}>
                      {STAR_RATING_OPTIONS.map((starValue) => (
                        <Star
                          key={`${value}-${starValue}`}
                          size={16}
                          color={starValue <= value ? '#F59E0B' : 'rgba(148,163,184,0.5)'}
                          fill={starValue <= value ? '#F59E0B' : 'transparent'}
                        />
                      ))}
                    </View>
                    <Text style={[s.ratingOptionText, active && s.ratingOptionTextActive]}>{value} estrela{value === 1 ? '' : 's'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={s.ratingActions}>
              {selectedSponsorStars > 0 && (
                <TouchableOpacity style={s.ratingGhostBtn} onPress={handleClearSponsorRating} activeOpacity={0.82}>
                  <Text style={s.ratingGhostTxt}>Remover avaliação</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.ratingCloseBtn} onPress={handleCloseSponsorRating} activeOpacity={0.82}>
                <Text style={s.ratingCloseTxt}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginHorizontal: 16, marginBottom: 12, paddingVertical: 16, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(7,11,22,0.38)' },
  greeting: { color: 'rgba(226,232,240,0.82)', fontSize: 16 },
  nameAccent: { color: '#F8FAFC', fontWeight: '800' as const, fontSize: 18 },
  subtitle: { color: 'rgba(241,245,249,0.84)', fontSize: 12, marginTop: 2 },
  balanceChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  balanceTxt: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' as const },
  quickRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  quickBtn: { flex: 1, borderRadius: 14, overflow: 'hidden', shadowColor: '#F97316', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  quickGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  quickTxt: { color: '#FFF', fontSize: 14, fontWeight: '900' as const, letterSpacing: 0.5 },
  sponsorsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 4, marginBottom: 4 },
  sponsorsTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '800' as const },
  sponsorsSubTitle: { color: 'rgba(226,232,240,0.72)', fontSize: 11, marginTop: 1 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAll: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' as const },
  sponsorsList: { marginBottom: 8 },
  ratingOverlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.48)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  ratingBackdrop: { ...StyleSheet.absoluteFillObject },
  ratingCard: { width: '100%', maxWidth: 380, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(10,15,28,0.96)', padding: 20, gap: 12 },
  ratingEyebrow: { color: '#F59E0B', fontSize: 11, fontWeight: '800' as const, letterSpacing: 1.1, textTransform: 'uppercase' as const },
  ratingTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '800' as const },
  ratingSubtitle: { color: 'rgba(226,232,240,0.78)', fontSize: 13, lineHeight: 19 },
  ratingOptions: { gap: 10, marginTop: 4 },
  ratingOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14, paddingVertical: 12 },
  ratingOptionActive: { borderColor: 'rgba(245,158,11,0.48)', backgroundColor: 'rgba(245,158,11,0.12)' },
  ratingStarsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingOptionText: { color: '#E2E8F0', fontSize: 13, fontWeight: '700' as const },
  ratingOptionTextActive: { color: '#F8FAFC' },
  ratingActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 6 },
  ratingGhostBtn: { paddingVertical: 10, paddingHorizontal: 12 },
  ratingGhostTxt: { color: 'rgba(226,232,240,0.76)', fontSize: 13, fontWeight: '700' as const },
  ratingCloseBtn: { marginLeft: 'auto', borderRadius: 14, backgroundColor: '#F59E0B', paddingHorizontal: 16, paddingVertical: 10 },
  ratingCloseTxt: { color: '#111827', fontSize: 13, fontWeight: '900' as const, letterSpacing: 0.3 },
});
