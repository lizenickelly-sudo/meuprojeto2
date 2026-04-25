import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Share,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { usePathname, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Heart, MessageCircle, Share2, Send } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useSponsor } from '@/providers/SponsorProvider';
import { useUser } from '@/providers/UserProvider';
import type { Offer, Sponsor } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');
const MODAL_MEDIA_HEIGHT = SCREEN_W * 0.85;

interface OfferDetailModalProps {
  visible: boolean;
  offer: Offer | null;
  sponsor: Sponsor | null;
  offerList?: Offer[];
  initialIndex?: number;
  startWithComments?: boolean;
  presentationMode?: 'default' | 'product-card';
  onClose: () => void;
}

interface OfferComment {
  id: string;
  username: string;
  avatar: string;
  text: string;
  createdAt: string;
}

interface OfferModalEntry {
  offer: Offer;
  sponsor: Sponsor | null;
}

const OFFER_COMMENTS_KEY = 'cashboxpix_offer_comments_v1';

export default function OfferDetailModal({
  visible,
  offer,
  sponsor,
  offerList,
  initialIndex = 0,
  startWithComments = false,
  presentationMode = 'default',
  onClose,
}: OfferDetailModalProps) {
  const isProductCard = presentationMode === 'product-card';
  const router = useRouter();
  const pathname = usePathname();
  const { sponsors, toggleLikeOffer: rawToggleLike, shareOffer: rawShare, addOfferComment, isOfferLiked, isOfferShared } = useSponsor();
  const { addPoints, profile } = useUser();
  const toggleLikeOffer = useCallback((offerId: string) => rawToggleLike(offerId, (pts) => addPoints(pts)), [rawToggleLike, addPoints]);
  const shareOfferFn = useCallback((offerId: string) => rawShare(offerId, (pts) => addPoints(pts)), [rawShare, addPoints]);

  const [showComments, setShowComments] = useState<boolean>(false);
  const [newComment, setNewComment] = useState<string>('');
  const [comments, setComments] = useState<OfferComment[]>([]);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [commentCount, setCommentCount] = useState<number>(0);
  const [shareCount, setShareCount] = useState<number>(0);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [contentHeight, setContentHeight] = useState<number>(MODAL_MEDIA_HEIGHT + 180);
  const heartScale = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const offerPagerRef = useRef<FlatList>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 75 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { index: number | null; isViewable?: boolean }[] }) => {
    const nextItem = viewableItems.find((item) => item.isViewable && typeof item.index === 'number');
    if (typeof nextItem?.index === 'number') {
      setActiveIndex(nextItem.index);
    }
  }).current;

  const modalOffers = React.useMemo(() => {
    if (offerList && offerList.length > 0) return offerList;
    return offer ? [offer] : [];
  }, [offerList, offer]);

  const modalEntries = React.useMemo<OfferModalEntry[]>(() => {
    return modalOffers.map((entry) => ({
      offer: entry,
      sponsor: sponsors.find((item) => item.id === entry.sponsorId) || sponsor || null,
    }));
  }, [modalOffers, sponsors, sponsor]);

  const currentEntry = modalEntries[activeIndex] || modalEntries[0] || null;
  const currentOffer = currentEntry?.offer || offer;
  const currentSponsor = currentEntry?.sponsor || sponsor;
  const currentSponsorAddress = [currentSponsor?.address, currentSponsor ? `${currentSponsor.city} - ${currentSponsor.state}` : '']
    .filter(Boolean)
    .join(' • ');

  React.useEffect(() => {
    if (visible && modalEntries.length > 0) {
      const safeInitial = Math.min(Math.max(initialIndex, 0), modalEntries.length - 1);
      setActiveIndex(safeInitial);
    }
  }, [visible, initialIndex, modalEntries.length]);

  React.useEffect(() => {
    if (!visible || modalEntries.length === 0 || contentHeight <= 0) return;

    const safeInitial = Math.min(Math.max(initialIndex, 0), modalEntries.length - 1);
    const timeoutId = setTimeout(() => {
      offerPagerRef.current?.scrollToOffset({ offset: safeInitial * contentHeight, animated: false });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [visible, initialIndex, modalEntries.length, contentHeight]);

  React.useEffect(() => {
    if (currentOffer) {
      setShowComments(startWithComments);
      setNewComment('');
      setLikeCount(currentOffer.likes || 0);
      setCommentCount(currentOffer.comments || 0);
      setShareCount(currentOffer.shares || 0);
    }
  }, [currentOffer, startWithComments]);

  React.useEffect(() => {
    let mounted = true;
    const loadComments = async () => {
      if (!currentOffer?.id) {
        if (mounted) setComments([]);
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(OFFER_COMMENTS_KEY);
        if (!raw) {
          if (mounted) setComments([]);
          return;
        }
        const parsed = JSON.parse(raw) as Record<string, OfferComment[]>;
        const fromOffer = Array.isArray(parsed?.[currentOffer.id]) ? parsed[currentOffer.id] : [];
        if (mounted) setComments(fromOffer);
      } catch (error) {
        console.log('[OfferDetailModal] Failed to load comments:', error);
        if (mounted) setComments([]);
      }
    };
    loadComments();
    return () => { mounted = false; };
  }, [currentOffer?.id]);

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible]);

  const handleLike = useCallback(() => {
    if (!currentOffer) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const changed = toggleLikeOffer(currentOffer.id);
    if (changed) setLikeCount((prev) => prev + 1);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, friction: 3 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, friction: 5 }),
    ]).start();
  }, [currentOffer, heartScale, toggleLikeOffer]);

  const handleDoubleTap = useCallback(() => {
    if (!currentOffer || isOfferLiked(currentOffer.id)) return;
    handleLike();
  }, [currentOffer, isOfferLiked, handleLike]);

  const lastTap = useRef<number>(0);
  const handleImagePress = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      handleDoubleTap();
    }
    lastTap.current = now;
  }, [handleDoubleTap]);

  const handleShare = useCallback(async () => {
    if (!currentOffer) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const changed = shareOfferFn(currentOffer.id);
      if (changed) setShareCount((prev) => prev + 1);
      await Share.share({
        message: `Confira essa oferta: ${currentOffer.title} - ${currentOffer.description} | ${currentOffer.discount} de desconto! Baixe o app Caca ao Tesouro PIX!`,
      });
    } catch {
      console.log('Share cancelled');
    }
  }, [currentOffer, shareOfferFn]);

  const handleOpenSponsor = useCallback(() => {
    if (!currentSponsor?.id) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (pathname === '/sponsor-detail' && sponsor?.id === currentSponsor.id) {
      onClose();
      return;
    }

    onClose();
    router.push({ pathname: '/sponsor-detail', params: { sponsorId: currentSponsor.id } });
  }, [currentSponsor?.id, currentSponsor, onClose, pathname, router, sponsor?.id]);

  const handleSendComment = useCallback(() => {
    if (!newComment.trim() || !currentOffer || !currentSponsor) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const comment: OfferComment = {
      id: `c_${Date.now()}`,
      username: profile.name?.trim() || 'Voce',
      avatar: profile.avatarUrl || profile.selfieUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60',
      text: newComment.trim(),
      createdAt: new Date().toISOString(),
    };
    const nextComments = [comment, ...comments];
    setComments(nextComments);
    addOfferComment(currentOffer.id);
    setCommentCount((prev) => prev + 1);
    setShowComments(true);
    console.log('[OfferDetailModal] Comment sent for offer:', currentOffer.id);
    setNewComment('');

    AsyncStorage.getItem(OFFER_COMMENTS_KEY)
      .then((raw) => {
        let parsed: Record<string, OfferComment[]> = {};
        if (raw) {
          try {
            parsed = JSON.parse(raw) as Record<string, OfferComment[]>;
          } catch {
            parsed = {};
          }
        }
        parsed[currentOffer.id] = nextComments;
        return AsyncStorage.setItem(OFFER_COMMENTS_KEY, JSON.stringify(parsed));
      })
      .catch((error) => {
        console.log('[OfferDetailModal] Failed to persist comments:', error);
      });
  }, [newComment, currentOffer, currentSponsor, addOfferComment, profile.name, profile.avatarUrl, profile.selfieUrl, comments]);

  const toggleComments = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowComments((prev) => !prev);
  }, []);

  if (!currentOffer) return null;

  const currentUserAvatar = profile.avatarUrl || profile.selfieUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60';
  const modalPageHeight = isProductCard ? SCREEN_W : contentHeight;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });

  const scale = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.84, 1],
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={isProductCard ? 'overFullScreen' : 'pageSheet'}
      transparent={isProductCard}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[ms.container, isProductCard && ms.containerCompact]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <Animated.View
          style={[ms.contentWrap, isProductCard && ms.contentWrapCompact, { opacity: slideAnim, transform: [{ scale }, { translateY }] }]}
          onLayout={(event) => {
            if (isProductCard) return;
            const nextHeight = event.nativeEvent.layout.height;
            if (nextHeight > 0 && Math.abs(nextHeight - contentHeight) > 1) {
              setContentHeight(nextHeight);
            }
          }}
        >
          {!showComments ? (
            <View style={ms.feedContainer}>
              <View style={ms.overlayTopControls}>
                <TouchableOpacity onPress={onClose} style={ms.overlayCloseBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <X size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <FlatList
                ref={offerPagerRef}
                data={modalEntries}
                keyExtractor={(item, index) => `${item.offer.id}-${index}`}
                renderItem={({ item }) => (
                  <TouchableOpacity activeOpacity={0.95} onPress={handleImagePress}>
                    <View style={[ms.reelPage, { height: modalPageHeight }]}>
                      <Image
                        source={{ uri: item.offer.imageUrl }}
                        style={ms.reelImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                        transition={400}
                      />
                      <LinearGradient
                        colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.84)']}
                        style={ms.reelFade}
                      />
                    </View>
                  </TouchableOpacity>
                )}
                pagingEnabled
                showsVerticalScrollIndicator={false}
                decelerationRate="fast"
                snapToAlignment="start"
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                getItemLayout={(_, index) => ({ length: modalPageHeight, offset: modalPageHeight * index, index })}
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                windowSize={3}
              />

              <View style={ms.overlayContent}>
                {modalEntries.length > 1 && (
                  <View style={ms.carouselDots}>
                    {modalEntries.map((_, idx) => (
                      <View key={`dot-${idx}`} style={[ms.dot, idx === activeIndex && ms.dotActive]} />
                    ))}
                  </View>
                )}

                <View style={ms.bottomRow}>
                  <View style={ms.detailsSection}>
                    <Text style={ms.offerDesc}>{currentOffer.description}</Text>
                  </View>

                  <View style={ms.actionsRail}>
                    <TouchableOpacity onPress={handleLike} style={ms.actionRailBtn} activeOpacity={0.7}>
                      <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                        <Heart
                          size={28}
                          color={isOfferLiked(currentOffer.id) ? '#EF4444' : '#FFFFFF'}
                          fill={isOfferLiked(currentOffer.id) ? '#EF4444' : 'transparent'}
                        />
                      </Animated.View>
                      <Text style={ms.actionRailText}>{likeCount.toLocaleString('pt-BR')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={toggleComments} style={ms.actionRailBtn} activeOpacity={0.7}>
                      <MessageCircle size={26} color="#FFFFFF" />
                      <Text style={ms.actionRailText}>{commentCount.toLocaleString('pt-BR')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleShare} style={ms.actionRailBtn} activeOpacity={0.7}>
                      <Share2 size={25} color={isOfferShared(currentOffer.id) ? Colors.dark.neonGreen : '#FFFFFF'} />
                      <Text style={ms.actionRailText}>{shareCount.toLocaleString('pt-BR')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={ms.overlaySponsorChip} onPress={handleOpenSponsor} activeOpacity={0.85}>
                  <Image
                    source={{ uri: currentSponsor?.logoUrl || currentSponsor?.imageUrl || currentOffer.imageUrl }}
                    style={ms.overlaySponsorAvatar}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                    transition={200}
                  />
                  <View style={ms.overlaySponsorInfo}>
                    <Text style={ms.overlaySponsorName} numberOfLines={1}>{currentSponsor?.name || currentOffer.sponsorName}</Text>
                    <Text style={ms.overlaySponsorAddress} numberOfLines={2}>{currentSponsorAddress || 'Patrocinador parceiro'}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={cs.commentsContainer}>
              <View style={cs.commentsHeader}>
                <TouchableOpacity onPress={toggleComments} style={cs.backBtn}>
                  <Text style={cs.backTxt}>Voltar</Text>
                </TouchableOpacity>
                <Text style={cs.commentsTitle}>Comentarios</Text>
                <View style={{ width: 60 }} />
              </View>
              {comments.length > 0 ? (
                <FlatList
                  data={comments}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={cs.commentsList}
                  renderItem={({ item }) => (
                    <View style={cs.commentRow}>
                      <Image source={{ uri: item.avatar }} style={cs.commentAvatar} contentFit="cover" cachePolicy="memory-disk" />
                      <View style={cs.commentContent}>
                        <Text style={cs.commentUser}>{item.username}</Text>
                        <Text style={cs.commentText}>{item.text}</Text>
                      </View>
                    </View>
                  )}
                />
              ) : (
                <View style={cs.emptyCommentsContainer}>
                  <Text style={cs.emptyCommentsTxt}>Sem comentarios ainda. Seja o primeiro a comentar.</Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>

        <View style={[ms.commentInputWrap, isProductCard && ms.commentInputWrapCompact]}>
          <Image
            source={{ uri: currentUserAvatar }}
            style={ms.inputAvatar}
            contentFit="cover"
            cachePolicy="memory-disk"
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            transition={200}
          />
          <TextInput
            style={ms.commentInput}
            placeholder="Adicione um comentario..."
            placeholderTextColor={Colors.dark.textMuted}
            value={newComment}
            onChangeText={setNewComment}
            onFocus={() => { if (!showComments) setShowComments(true); }}
          />
          {newComment.trim().length > 0 && (
            <TouchableOpacity onPress={handleSendComment} style={ms.sendBtn} activeOpacity={0.7}>
              <Send size={20} color={Colors.dark.primary} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ms = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  containerCompact: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  contentWrap: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: Colors.dark.background,
  },
  contentWrapCompact: {
    flex: 0,
    flexGrow: 0,
    flexShrink: 0,
    height: SCREEN_W,
    width: SCREEN_W,
  },
  feedContainer: {
    flex: 1,
    backgroundColor: '#050505',
  },
  overlayTopControls: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 3,
  },
  overlayCloseBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  reelPage: {
    width: SCREEN_W,
    backgroundColor: '#050505',
  },
  reelImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050505',
  },
  reelFade: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayContent: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    gap: 12,
  },
  overlaySponsorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.36)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  overlaySponsorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  overlaySponsorInfo: {
    flex: 1,
    gap: 2,
  },
  overlaySponsorName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800' as const,
  },
  overlaySponsorAddress: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 12,
    width: '100%',
    lineHeight: 17,
  },
  carouselDots: {
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 18,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 18,
    paddingTop: 14,
  },
  actionsRail: {
    alignItems: 'center',
    gap: 18,
  },
  actionRailBtn: {
    alignItems: 'center',
    gap: 6,
    minWidth: 48,
  },
  actionRailText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700' as const,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  detailsSection: {
    flex: 1,
    paddingBottom: 8,
  },
  offerDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 20,
    maxWidth: '92%',
  },
  commentInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.cardBorder,
    backgroundColor: Colors.dark.surface,
    gap: 10,
  },
  commentInputWrapCompact: {
    width: SCREEN_W,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.surfaceLight,
  },
  commentInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.dark.text,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.dark.inputBg,
    borderRadius: 20,
  },
  sendBtn: {
    padding: 6,
  },
});

const cs = StyleSheet.create({
  commentsContainer: {
    flex: 1,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.cardBorder,
  },
  backBtn: {
    width: 60,
  },
  backTxt: {
    color: Colors.dark.primary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  commentsList: {
    paddingVertical: 8,
  },
  commentRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.surfaceLight,
  },
  commentContent: {
    flex: 1,
  },
  commentUser: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 2,
  },
  commentTime: {
    fontWeight: '400' as const,
    color: Colors.dark.textMuted,
    fontSize: 12,
  },
  commentText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 19,
  },
  emptyCommentsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyCommentsTxt: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
