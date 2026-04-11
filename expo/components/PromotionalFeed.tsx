import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { ShoppingBag, MapPin, Heart, MessageCircle, Share2, ChevronRight, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useSponsor } from '@/providers/SponsorProvider';
import { useUser } from '@/providers/UserProvider';
import type { Offer, Sponsor } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 64;
const CARD_GAP = 12;
const SNAP_INTERVAL = CARD_W + CARD_GAP;
const AUTO_SCROLL_INTERVAL = 4000;

interface PromotionalItem {
  offer: Offer;
  sponsor: Sponsor;
}

function openExternalMap(lat: number, lon: number, label: string) {
  const encoded = encodeURIComponent(label);
  if (Platform.OS === 'ios') {
    Linking.openURL(`maps:0,0?q=${encoded}&ll=${lat},${lon}`).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`);
    });
  } else if (Platform.OS === 'android') {
    Linking.openURL(`geo:${lat},${lon}?q=${lat},${lon}(${encoded})`).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`);
    });
  } else {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`);
  }
}

function PromotionalCard({
  item,
  onGoToStore,
  onGoToLocation,
  onLike,
  onShare,
  isLiked,
  isShared,
}: {
  item: PromotionalItem;
  onGoToStore: () => void;
  onGoToLocation: () => void;
  onLike: () => void;
  onShare: () => void;
  isLiked: boolean;
  isShared: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const shareScale = useRef(new Animated.Value(1)).current;

  const handleLike = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onLike();
  }, [onLike, heartScale]);

  const handleShare = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(shareScale, { toValue: 1.3, duration: 120, useNativeDriver: true }),
      Animated.timing(shareScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onShare();
  }, [onShare, shareScale]);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.97, friction: 8, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={[pc.cardOuter, { transform: [{ scale: scaleAnim }] }]}>
      <View style={pc.card}>
        <View style={pc.headerRow}>
          <Image
            source={{ uri: item.sponsor.logoUrl }}
            style={pc.sponsorAvatar}
            contentFit="cover"
            cachePolicy="memory-disk"
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            transition={300}
          />
          <View style={pc.headerInfo}>
            <Text style={pc.sponsorName} numberOfLines={1}>{item.sponsor.name}</Text>
            <Text style={pc.sponsorCat}>{item.sponsor.category} • {item.sponsor.city}</Text>
          </View>
          {item.offer.discount && (
            <View style={pc.discountPill}>
              <Text style={pc.discountTxt}>{item.offer.discount}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.95}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={onGoToStore}
        >
          <View style={pc.imageWrap}>
            <Image
              source={{ uri: item.offer.imageUrl }}
              style={pc.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              transition={400}
            />
            <View style={pc.imageOverlay}>
              <Text style={pc.offerTitle} numberOfLines={2}>{item.offer.title}</Text>
              <Text style={pc.offerDesc} numberOfLines={1}>{item.offer.description}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={pc.actionsRow}>
          <View style={pc.socialRow}>
            <TouchableOpacity style={pc.socialBtn} onPress={handleLike} activeOpacity={0.7}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Heart
                  size={22}
                  color={isLiked ? '#EF4444' : Colors.dark.textMuted}
                  fill={isLiked ? '#EF4444' : 'transparent'}
                />
              </Animated.View>
              <Text style={pc.socialCount}>{item.offer.likes + (isLiked ? 1 : 0)}</Text>
              {isLiked && <Check size={10} color={Colors.dark.success} />}
            </TouchableOpacity>
            <TouchableOpacity style={pc.socialBtn} activeOpacity={0.7}>
              <MessageCircle size={20} color={Colors.dark.textMuted} />
              <Text style={pc.socialCount}>{item.offer.comments}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={pc.socialBtn} onPress={handleShare} activeOpacity={0.7}>
              <Animated.View style={{ transform: [{ scale: shareScale }] }}>
                <Share2 size={20} color={isShared ? Colors.dark.neonGreen : Colors.dark.textMuted} />
              </Animated.View>
              <Text style={pc.socialCount}>{item.offer.shares + (isShared ? 1 : 0)}</Text>
              {isShared && <Check size={10} color={Colors.dark.success} />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={pc.buttonsRow}>
          <TouchableOpacity style={pc.goStoreBtn} onPress={onGoToStore} activeOpacity={0.8}>
            <ShoppingBag size={16} color="#FFF" />
            <Text style={pc.goStoreTxt}>Ir pra Loja</Text>
            <ChevronRight size={14} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={pc.goLocationBtn} onPress={onGoToLocation} activeOpacity={0.8}>
            <MapPin size={16} color="#F97316" />
            <Text style={pc.goLocationTxt}>Ir para Local</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const pc = StyleSheet.create({
  cardOuter: {
    width: CARD_W,
    marginHorizontal: CARD_GAP / 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  sponsorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 2,
    borderColor: 'rgba(249,115,22,0.18)',
  },
  headerInfo: {
    flex: 1,
  },
  sponsorName: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  sponsorCat: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  discountPill: {
    backgroundColor: '#F97316',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  discountTxt: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800' as const,
  },
  imageWrap: {
    width: '100%',
    height: 200,
    position: 'relative' as const,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.dark.surfaceLight,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    paddingTop: 40,
    backgroundColor: 'transparent',
    backgroundImage: undefined,
  },
  offerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800' as const,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  offerDesc: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  actionsRow: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  socialCount: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  buttonsRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 6,
    gap: 10,
  },
  goStoreBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F97316',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  goStoreTxt: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  goLocationBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249,115,22,0.1)',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.25)',
  },
  goLocationTxt: {
    color: '#F97316',
    fontSize: 13,
    fontWeight: '700' as const,
  },
});

export default function PromotionalFeed({
  onGoToStore,
  userCity,
}: {
  onGoToStore: (sponsorId: string) => void;
  userCity?: string;
}) {
  const { sponsors, toggleLikeOffer: rawToggleLike, shareOffer: rawShare, isOfferLiked, isOfferShared } = useSponsor();
  const { addPoints } = useUser();
  const toggleLikeOffer = useCallback((offerId: string) => rawToggleLike(offerId, (pts) => addPoints(pts)), [rawToggleLike, addPoints]);
  const shareOffer = useCallback((offerId: string) => rawShare(offerId, (pts) => addPoints(pts)), [rawShare, addPoints]);
  const flatListRef = useRef<FlatList>(null);
  const currentIndex = useRef<number>(0);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const allItems: PromotionalItem[] = useMemo(() => {
    const items: PromotionalItem[] = [];
    const filtered = userCity ? sponsors.filter((sp) => sp.city === userCity) : sponsors;
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

  const handleGoToStore = useCallback((sponsorId: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onGoToStore(sponsorId);
  }, [onGoToStore]);

  const handleGoToLocation = useCallback((sponsor: Sponsor) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openExternalMap(sponsor.latitude, sponsor.longitude, sponsor.name);
  }, []);

  const renderItem = useCallback(({ item }: { item: PromotionalItem }) => (
    <PromotionalCard
      item={item}
      onGoToStore={() => handleGoToStore(item.sponsor.id)}
      onGoToLocation={() => handleGoToLocation(item.sponsor)}
      onLike={() => {
        const success = toggleLikeOffer(item.offer.id);
        if (!success) {
          console.log('[PromotionalFeed] Already liked offer:', item.offer.id);
        }
      }}
      onShare={() => {
        const success = shareOffer(item.offer.id);
        if (!success) {
          console.log('[PromotionalFeed] Already shared offer:', item.offer.id);
        }
      }}
      isLiked={isOfferLiked(item.offer.id)}
      isShared={isOfferShared(item.offer.id)}
    />
  ), [handleGoToStore, handleGoToLocation, toggleLikeOffer, shareOffer, isOfferLiked, isOfferShared]);

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
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: '800' as const,
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
