import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, FlatList, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { ArrowLeft, PlayCircle, Volume2, VolumeX } from 'lucide-react-native';
import SponsorReelFeedItem from '@/components/SponsorReelFeedItem';
import Colors from '@/constants/colors';
import { useSponsor } from '@/providers/SponsorProvider';
import { useUser } from '@/providers/UserProvider';
import type { Sponsor, SponsorVideo } from '@/types';

type ReelEntry = {
  id: string;
  sponsor: Sponsor;
  video: SponsorVideo;
};

function normalizeText(value?: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export default function ReelsScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { sponsors } = useSponsor();
  const { profile } = useUser();
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      setAppState(nextState);
    });

    return () => subscription.remove();
  }, []);

  const reelsVisible = isFocused && appState === 'active';

  const normalizedCity = normalizeText(profile.city);
  const normalizedState = normalizeText(profile.state);

  const reels = useMemo<ReelEntry[]>(() => {
    if (!normalizedCity) return [];

    return sponsors
      .filter((sponsor) => {
        if (normalizeText(sponsor.city) !== normalizedCity) return false;
        if (normalizedState && normalizeText(sponsor.state) !== normalizedState) return false;
        return (sponsor.promotionalVideos || []).length > 0;
      })
      .flatMap((sponsor) => (sponsor.promotionalVideos || []).map((video) => ({
        id: `${sponsor.id}:${video.id}`,
        sponsor,
        video,
      })))
      .sort((a, b) => new Date(b.video.createdAt).getTime() - new Date(a.video.createdAt).getTime());
  }, [normalizedCity, normalizedState, sponsors]);

  const citySponsorCount = useMemo(() => {
    if (!normalizedCity) return 0;

    return sponsors.filter((sponsor) => {
      if (normalizeText(sponsor.city) !== normalizedCity) return false;
      if (normalizedState && normalizeText(sponsor.state) !== normalizedState) return false;
      return true;
    }).length;
  }, [normalizedCity, normalizedState, sponsors]);

  const handleOpenSponsor = useCallback((sponsorId: string) => {
    router.push({ pathname: '/sponsor-detail', params: { sponsorId } });
  }, [router]);

  const renderItem = useCallback(({ item, index }: { item: ReelEntry; index: number }) => (
    <SponsorReelFeedItem
      sponsor={item.sponsor}
      video={item.video}
      active={index === activeIndex}
      visible={reelsVisible}
      soundEnabled={soundEnabled}
      height={height}
      onOpenSponsor={() => handleOpenSponsor(item.sponsor.id)}
    />
  ), [activeIndex, handleOpenSponsor, height, reelsVisible, soundEnabled]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 75 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { index: number | null; isViewable?: boolean }[] }) => {
    const nextItem = viewableItems.find((item) => item.isViewable && typeof item.index === 'number');
    if (typeof nextItem?.index === 'number') {
      setActiveIndex(nextItem.index);
    }
  }).current;

  if (!normalizedCity) {
    return (
      <View style={s.emptyScreen}>
        <StatusBar style="light" />
        <Text style={s.emptyEyebrow}>Reels da sua cidade</Text>
        <Text style={s.emptyTitle}>Defina sua cidade primeiro</Text>
        <Text style={s.emptyText}>Complete seu perfil para filtrar os reels dos patrocinadores da sua regiao atual.</Text>
        <TouchableOpacity style={s.emptyButton} onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.85}>
          <Text style={s.emptyButtonText}>Ir para perfil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (reels.length === 0) {
    return (
      <View style={s.emptyScreen}>
        <StatusBar style="light" />
        <Text style={s.emptyEyebrow}>Reels em {profile.city}</Text>
        <Text style={s.emptyTitle}>Ainda nao ha videos nessa cidade</Text>
        <Text style={s.emptyText}>
          Encontramos {citySponsorCount} patrocinador{citySponsorCount === 1 ? '' : 'es'} em {profile.city}, mas nenhum com reel publicado ainda.
        </Text>
        <TouchableOpacity style={s.emptyButton} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={s.emptyButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <StatusBar style="light" />

      <FlatList
        data={reels}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToAlignment="start"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
      />

      <View style={[s.topBar, { paddingTop: insets.top + 10 }]}> 
        <TouchableOpacity style={s.overlayButton} onPress={() => router.back()} activeOpacity={0.85}>
          <ArrowLeft size={18} color="#FFF" />
        </TouchableOpacity>

        <View style={s.topBarCenter}>
          <Text style={s.topBarTitle}>Reels em {profile.city}</Text>
          <Text style={s.topBarSubtitle}>{activeIndex + 1} de {reels.length}</Text>
        </View>

        <TouchableOpacity
          style={s.overlayButton}
          onPress={() => setSoundEnabled((current) => !current)}
          activeOpacity={0.85}
        >
          {soundEnabled ? <Volume2 size={18} color="#FFF" /> : <VolumeX size={18} color="#FFF" />}
        </TouchableOpacity>
      </View>

      <View style={[s.hintWrap, { bottom: insets.bottom + 16 }]}> 
        <View style={s.hintChip}>
          <PlayCircle size={14} color={Colors.dark.primary} />
          <Text style={s.hintText}>Deslize para cima para ver mais reels da sua cidade</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarCenter: {
    alignItems: 'center',
    gap: 2,
  },
  topBarTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800' as const,
  },
  topBarSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  overlayButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  hintWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  hintChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  hintText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  emptyScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#050505',
  },
  emptyEyebrow: {
    color: Colors.dark.primary,
    fontSize: 12,
    fontWeight: '800' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900' as const,
    textAlign: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 22,
  },
  emptyButton: {
    backgroundColor: '#FFF',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  emptyButtonText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800' as const,
  },
});