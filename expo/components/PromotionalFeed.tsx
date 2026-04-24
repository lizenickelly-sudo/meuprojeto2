import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, FlatList, Platform } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useSponsor } from '@/providers/SponsorProvider';
import OfferDetailModal from '@/components/OfferDetailModal';
import type { Offer, Sponsor } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 64;
const CARD_GAP = 12;
const SNAP_INTERVAL = CARD_W + CARD_GAP;
const AUTO_SCROLL_INTERVAL = 4000;
const CARD_BORDER_BLUE = '#3B82F6';

interface PromotionalItem {
  offer: Offer;
  sponsor: Sponsor;
}

function PromotionalCard({
  item,
  onOpenOffer,
}: {
  item: PromotionalItem;
  onOpenOffer: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const sponsorAddress = [item.sponsor.address, `${item.sponsor.city} - ${item.sponsor.state}`]
    .filter(Boolean)
    .join(' • ');

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.97, friction: 8, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={[pc.cardOuter, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={pc.card}
        activeOpacity={0.95}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onOpenOffer}
      >
        <Image
          source={{ uri: item.offer.imageUrl }}
          style={pc.backgroundImage}
          contentFit="cover"
          contentPosition="center"
          cachePolicy="memory-disk"
          placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          transition={400}
        />
        <View style={pc.infoStrip}>
          <Image
            source={{ uri: item.sponsor.logoUrl }}
            style={pc.sponsorAvatar}
            contentFit="cover"
            cachePolicy="memory-disk"
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            transition={300}
          />
          <View style={pc.infoTextWrap}>
            <Text style={pc.sponsorName} numberOfLines={1}>{item.sponsor.name}</Text>
            <Text style={pc.sponsorAddress} numberOfLines={1}>{sponsorAddress}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const pc = StyleSheet.create({
  cardOuter: {
    width: CARD_W,
    marginHorizontal: CARD_GAP / 2,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: CARD_BORDER_BLUE,
    minHeight: 240,
    justifyContent: 'space-between',
    shadowColor: CARD_BORDER_BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
  },
  infoStrip: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    zIndex: 1,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  sponsorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.75)',
  },
  infoTextWrap: {
    flex: 1,
  },
  sponsorName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700' as const,
    textShadowColor: 'rgba(15,23,42,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sponsorAddress: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    marginTop: 1,
  },
});

export default function PromotionalFeed({
  userCity,
}: {
  userCity?: string;
}) {
  const { sponsors } = useSponsor();
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [selectedOfferList, setSelectedOfferList] = useState<Offer[]>([]);
  const [selectedOfferIndex, setSelectedOfferIndex] = useState<number>(0);
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const flatListRef = useRef<FlatList>(null);
  const currentIndex = useRef<number>(0);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const allItems: PromotionalItem[] = useMemo(() => {
    const items: PromotionalItem[] = [];
    const normalizedUserCity = (userCity || '').trim().toLowerCase();
    const filtered = normalizedUserCity
      ? sponsors.filter((sp) => sp.city.trim().toLowerCase() === normalizedUserCity)
      : [];
    filtered.forEach((sp) => {
      sp.offers.forEach((offer) => {
        items.push({ offer, sponsor: sp });
      });
    });
    return items;
  }, [sponsors, userCity]);

  const loopedItems = useMemo(() => {
    if (allItems.length === 0) return [];
    return [...allItems, ...allItems, ...allItems];
  }, [allItems]);

  const startIndex = allItems.length;

  useEffect(() => {
    if (loopedItems.length === 0) return;
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: startIndex * SNAP_INTERVAL, animated: false });
      currentIndex.current = startIndex;
    }, 100);
    return () => clearTimeout(timer);
  }, [loopedItems.length, startIndex]);

  const startAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
    autoScrollTimer.current = setInterval(() => {
      if (loopedItems.length === 0) return;
      currentIndex.current += 1;
      if (currentIndex.current >= startIndex + allItems.length) {
        flatListRef.current?.scrollToOffset({ offset: startIndex * SNAP_INTERVAL, animated: false });
        currentIndex.current = startIndex;
        setTimeout(() => {
          currentIndex.current += 1;
          flatListRef.current?.scrollToOffset({
            offset: currentIndex.current * SNAP_INTERVAL,
            animated: true,
          });
        }, 50);
      } else {
        flatListRef.current?.scrollToOffset({
          offset: currentIndex.current * SNAP_INTERVAL,
          animated: true,
        });
      }
    }, AUTO_SCROLL_INTERVAL);
  }, [loopedItems.length, allItems.length, startIndex]);

  useEffect(() => {
    startAutoScroll();
    return () => {
      if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
    };
  }, [startAutoScroll]);

  const handleScrollBeginDrag = useCallback(() => {
    if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
  }, []);

  const handleScrollEndDrag = useCallback(() => {
    startAutoScroll();
  }, [startAutoScroll]);

  const handleMomentumScrollEnd = useCallback((e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offsetX / SNAP_INTERVAL);
    currentIndex.current = idx;

    if (idx < allItems.length / 2) {
      const newIdx = idx + allItems.length;
      flatListRef.current?.scrollToOffset({ offset: newIdx * SNAP_INTERVAL, animated: false });
      currentIndex.current = newIdx;
    } else if (idx >= allItems.length * 2 + allItems.length / 2) {
      const newIdx = idx - allItems.length;
      flatListRef.current?.scrollToOffset({ offset: newIdx * SNAP_INTERVAL, animated: false });
      currentIndex.current = newIdx;
    }
  }, [allItems.length]);

  const handleOpenOffer = useCallback((item: PromotionalItem) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const idx = allItems.findIndex((it) => it.offer.id === item.offer.id && it.sponsor.id === item.sponsor.id);
    setSelectedOfferList(allItems.map((it) => it.offer));
    setSelectedOfferIndex(idx >= 0 ? idx : 0);
    setSelectedOffer(item.offer);
    setSelectedSponsor(item.sponsor);
    setModalVisible(true);
  }, [allItems]);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedOffer(null);
    setSelectedOfferList([]);
    setSelectedOfferIndex(0);
    setSelectedSponsor(null);
  }, []);

  const renderItem = useCallback(({ item }: { item: PromotionalItem }) => (
    <PromotionalCard
      item={item}
      onOpenOffer={() => handleOpenOffer(item)}
    />
  ), [handleOpenOffer]);

  const keyExtractor = useCallback((_: PromotionalItem, index: number) => `promo-${index}`, []);

  const getItemLayout = useCallback((_: unknown, index: number) => ({
    length: SNAP_INTERVAL,
    offset: SNAP_INTERVAL * index,
    index,
  }), []);

  if (allItems.length === 0) return null;

  const dotCount = Math.min(allItems.length, 8);
  const activeDot = currentIndex.current % allItems.length;

  return (
    <View style={pf.container}>
      <View style={pf.headerRow}>
        <Text style={pf.title}>Promoções</Text>
        <View style={pf.dotsRow}>
          {Array.from({ length: dotCount }).map((_, i) => (
            <View
              key={i}
              style={[pf.dot, i === (activeDot % dotCount) && pf.dotActive]}
            />
          ))}
        </View>
      </View>
      <FlatList
        ref={flatListRef}
        data={loopedItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP_INTERVAL}
        decelerationRate="fast"
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        getItemLayout={getItemLayout}
        contentContainerStyle={pf.listContent}
        initialNumToRender={3}
        maxToRenderPerBatch={5}
        windowSize={5}
      />
      <OfferDetailModal
        visible={modalVisible}
        offer={selectedOffer}
        sponsor={selectedSponsor}
        offerList={selectedOfferList}
        initialIndex={selectedOfferIndex}
        onClose={handleCloseModal}
      />
    </View>
  );
}

const pf = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 21,
    fontWeight: '800' as const,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.32)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.cardBorder,
  },
  dotActive: {
    backgroundColor: Colors.dark.primary,
    width: 18,
    borderRadius: 3,
  },
  listContent: {
    paddingHorizontal: 32 - CARD_GAP / 2,
  },
});
