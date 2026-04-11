import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Animated, Dimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useSponsor } from '@/providers/SponsorProvider';
import type { SponsorStory } from '@/types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function useStories(userCity?: string) {
  const { sponsors } = useSponsor();
  return useMemo(() => {
    const filtered = userCity
      ? sponsors.filter((s) => s.city === userCity)
      : sponsors;
    return filtered
      .filter((s) => s.stories && s.stories.length > 0)
      .map((s) => ({
        sponsorId: s.id,
        sponsorName: s.name,
        sponsorLogo: s.logoUrl,
        verified: s.verified,
        stories: s.stories!,
      }));
  }, [sponsors, userCity]);
}

function StoryViewer({ sponsorIdx, onClose, allStories }: { sponsorIdx: number; onClose: () => void; allStories: ReturnType<typeof useStories> }) {
  const [currentSponsor, setCurrentSponsor] = useState<number>(sponsorIdx);
  const [currentStory, setCurrentStory] = useState<number>(0);
  const progress = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const sponsor = allStories[currentSponsor];
  const story = sponsor?.stories[currentStory];

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: 5000, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (finished) goNext();
    });
    return () => anim.stop();
  }, [currentSponsor, currentStory]);

  const goNext = useCallback(() => {
    if (!sponsor) return;
    if (currentStory < sponsor.stories.length - 1) {
      setCurrentStory((p) => p + 1);
    } else if (currentSponsor < allStories.length - 1) {
      setCurrentSponsor((p) => p + 1);
      setCurrentStory(0);
    } else {
      onClose();
    }
  }, [currentSponsor, currentStory, sponsor, onClose]);

  const goPrev = useCallback(() => {
    if (currentStory > 0) {
      setCurrentStory((p) => p - 1);
    } else if (currentSponsor > 0) {
      setCurrentSponsor((p) => p - 1);
      setCurrentStory(allStories[currentSponsor - 1]?.stories.length - 1 || 0);
    }
  }, [currentSponsor, currentStory]);

  if (!sponsor || !story) return null;

  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <Modal visible animationType="fade" statusBarTranslucent transparent>
      <Animated.View style={[sv.container, { opacity: fadeAnim }]}>
        <Image source={{ uri: story.imageUrl }} style={sv.image} contentFit="cover" cachePolicy="memory-disk" placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} transition={300} />
        <View style={sv.overlay} />

        <View style={sv.header}>
          <View style={sv.progressRow}>
            {sponsor.stories.map((_, i) => (
              <View key={i} style={sv.progressTrack}>
                <Animated.View
                  style={[
                    sv.progressFill,
                    i < currentStory
                      ? { width: '100%' }
                      : i === currentStory
                      ? { width: progressWidth }
                      : { width: '0%' },
                  ]}
                />
              </View>
            ))}
          </View>
          <View style={sv.sponsorRow}>
            <Image source={{ uri: sponsor.sponsorLogo }} style={sv.sponsorLogo} contentFit="cover" cachePolicy="memory-disk" placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} transition={200} />
            <View style={sv.sponsorInfo}>
              <Text style={sv.sponsorName}>{sponsor.sponsorName}</Text>
              {sponsor.verified && <View style={sv.verBadge}><Text style={sv.verTxt}>✓</Text></View>}
            </View>
            <TouchableOpacity onPress={onClose} style={sv.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <X size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={sv.titleWrap}>
          <Text style={sv.storyTitle}>{story.title}</Text>
        </View>

        <View style={sv.touchAreas}>
          <TouchableOpacity style={sv.touchLeft} onPress={goPrev} activeOpacity={1} />
          <TouchableOpacity style={sv.touchRight} onPress={goNext} activeOpacity={1} />
        </View>
      </Animated.View>
    </Modal>
  );
}

const sv = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  image: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, height: 160, backgroundColor: 'rgba(0,0,0,0.4)' },
  header: { paddingTop: 54, paddingHorizontal: 12 },
  progressRow: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  progressTrack: { flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#F97316', borderRadius: 2 },
  sponsorRow: { flexDirection: 'row', alignItems: 'center' },
  sponsorLogo: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#F97316' },
  sponsorInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10, gap: 6 },
  sponsorName: { color: '#FFF', fontSize: 14, fontWeight: '700' as const },
  verBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },
  verTxt: { color: '#000', fontSize: 10, fontWeight: '800' as const },
  closeBtn: { padding: 8 },
  titleWrap: { position: 'absolute', bottom: 100, left: 16, right: 16 },
  storyTitle: { color: '#FFF', fontSize: 22, fontWeight: '800' as const, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  touchAreas: { position: 'absolute', top: 120, bottom: 0, left: 0, right: 0, flexDirection: 'row' },
  touchLeft: { flex: 1 },
  touchRight: { flex: 2 },
});

export default function SponsorStories({ onSponsorPress, userCity }: { onSponsorPress?: (sponsorId: string) => void; userCity?: string }) {
  const allStories = useStories(userCity);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);

  const openStory = useCallback((idx: number) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewerIdx(idx);
  }, []);

  if (allStories.length === 0) return null;

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.list}>
        {allStories.map((s, idx) => (
          <TouchableOpacity key={s.sponsorId} style={st.item} onPress={() => openStory(idx)} activeOpacity={0.8}>
            <View style={st.ring}>
              <Image source={{ uri: s.sponsorLogo }} style={st.avatar} contentFit="cover" cachePolicy="memory-disk" placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} transition={200} />
            </View>
            <Text style={st.name} numberOfLines={1}>{s.sponsorName.split(' ')[0]}</Text>
            {s.verified && <View style={st.verDot} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
      {viewerIdx !== null && (
        <StoryViewer sponsorIdx={viewerIdx} onClose={() => setViewerIdx(null)} allStories={allStories} />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  list: { paddingHorizontal: 12, gap: 14, paddingVertical: 8 },
  item: { alignItems: 'center', width: 82 },
  ring: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2.5,
    borderColor: '#F97316',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#F0F1F3' },
  name: { color: Colors.dark.text, fontSize: 11, fontWeight: '600' as const, marginTop: 5, textAlign: 'center' },
  verDot: {
    position: 'absolute',
    top: 0,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F97316',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
