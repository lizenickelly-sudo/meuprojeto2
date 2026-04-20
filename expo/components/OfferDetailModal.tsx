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
import { Image } from 'expo-image';
import { X, Heart, MessageCircle, Share2, Bookmark, Send } from 'lucide-react-native';
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
  onClose: () => void;
}

interface OfferComment {
  id: string;
  username: string;
  avatar: string;
  text: string;
  createdAt: string;
}

const OFFER_COMMENTS_KEY = 'cashboxpix_offer_comments_v1';

export default function OfferDetailModal({
  visible,
  offer,
  sponsor,
  offerList,
  initialIndex = 0,
  startWithComments = false,
  onClose,
}: OfferDetailModalProps) {
  const { toggleLikeOffer: rawToggleLike, shareOffer: rawShare, addOfferComment, isOfferLiked, isOfferShared } = useSponsor();
  const { addPoints, profile } = useUser();
  const toggleLikeOffer = useCallback((offerId: string) => rawToggleLike(offerId, (pts) => addPoints(pts)), [rawToggleLike, addPoints]);
  const shareOfferFn = useCallback((offerId: string) => rawShare(offerId, (pts) => addPoints(pts)), [rawShare, addPoints]);
  
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [showComments, setShowComments] = useState<boolean>(false);
  const [newComment, setNewComment] = useState<string>('');
  const [comments, setComments] = useState<OfferComment[]>([]);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [commentCount, setCommentCount] = useState<number>(0);
  const [shareCount, setShareCount] = useState<number>(0);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const heartScale = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const modalOffers = React.useMemo(() => {
    if (offerList && offerList.length > 0) return offerList;
    return offer ? [offer] : [];
  }, [offerList, offer]);

  const currentOffer = modalOffers[activeIndex] || offer;

  React.useEffect(() => {
    if (visible && modalOffers.length > 0) {
      const safeInitial = Math.min(Math.max(initialIndex, 0), modalOffers.length - 1);
      setActiveIndex(safeInitial);
    }
  }, [visible, initialIndex, modalOffers.length]);

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

  const handleSave = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSaved((prev) => !prev);
  }, []);

  const handleSendComment = useCallback(() => {
    if (!newComment.trim() || !currentOffer || !sponsor) return;
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
  }, [newComment, currentOffer, sponsor, addOfferComment, profile.name, profile.avatarUrl, profile.selfieUrl, comments]);

  const toggleComments = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowComments((prev) => !prev);
  }, []);

  if (!currentOffer) return null;

  const currentUserAvatar = profile.avatarUrl || profile.selfieUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60';

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0],
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={ms.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={ms.handleBar}>
          <View style={ms.handle} />
        </View>

        <View style={ms.topBar}>
          <View style={ms.topBarLeft}>
            <Image source={{ uri: currentOffer.imageUrl }} style={ms.sponsorMini} contentFit="cover" cachePolicy="memory-disk" placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} transition={200} />
            <View>
              <Text style={ms.sponsorName} numberOfLines={1}>{currentOffer.sponsorName}</Text>
              <Text style={ms.offerLocation}>Patrocinador</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={ms.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <X size={22} color={Colors.dark.text} />
          </TouchableOpacity>
        </View>

        <Animated.View style={[ms.contentWrap, { opacity: slideAnim, transform: [{ translateY }] }]}>
          {!showComments ? (
            <View style={ms.feedContainer}>
              <View style={ms.imageWrap}>
                <FlatList
                  data={modalOffers}
                  keyExtractor={(item) => item.id}
                  horizontal={false}
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={MODAL_MEDIA_HEIGHT}
                  decelerationRate="fast"
                  initialScrollIndex={Math.min(activeIndex, Math.max(0, modalOffers.length - 1))}
                  getItemLayout={(_, index) => ({ length: MODAL_MEDIA_HEIGHT, offset: MODAL_MEDIA_HEIGHT * index, index })}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.y / MODAL_MEDIA_HEIGHT);
                    setActiveIndex(Math.min(Math.max(idx, 0), modalOffers.length - 1));
                  }}
                  renderItem={({ item }) => (
                    <TouchableOpacity activeOpacity={0.95} onPress={handleImagePress}>
                      <View style={ms.imageWrap}>
                        <Image source={{ uri: item.imageUrl }} style={ms.offerImage} contentFit="cover" cachePolicy="memory-disk" placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} transition={400} />
                        {item.discount && (
                          <View style={ms.discountTag}>
                            <Text style={ms.discountText}>{item.discount}</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  )}
                />
                {modalOffers.length > 1 && (
                  <View style={ms.carouselDots}>
                    {modalOffers.map((_, idx) => (
                      <View key={`dot-${idx}`} style={[ms.dot, idx === activeIndex && ms.dotActive]} />
                    ))}
                  </View>
                )}
              </View>

              <View style={ms.actionsRow}>
                <View style={ms.actionsLeft}>
                  <TouchableOpacity onPress={handleLike} style={ms.actionBtn} activeOpacity={0.7}>
                    <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                      <Heart
                        size={26}
                        color={isOfferLiked(currentOffer.id) ? '#EF4444' : Colors.dark.text}
                        fill={isOfferLiked(currentOffer.id) ? '#EF4444' : 'transparent'}
                      />
                    </Animated.View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={toggleComments} style={ms.actionBtn} activeOpacity={0.7}>
                    <MessageCircle size={25} color={Colors.dark.text} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleShare} style={ms.actionBtn} activeOpacity={0.7}>
                    <Share2 size={24} color={isOfferShared(currentOffer.id) ? Colors.dark.neonGreen : Colors.dark.text} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={handleSave} style={ms.actionBtn} activeOpacity={0.7}>
                  <Bookmark
                    size={25}
                    color={isSaved ? Colors.dark.primary : Colors.dark.text}
                    fill={isSaved ? Colors.dark.primary : 'transparent'}
                  />
                </TouchableOpacity>
              </View>

              <View style={ms.detailsSection}>
                <Text style={ms.likeCount}>{likeCount.toLocaleString('pt-BR')} curtidas • {shareCount.toLocaleString('pt-BR')} compartilhamentos</Text>
                <Text style={ms.offerTitle}>
                  <Text style={ms.offerTitleBold}>{currentOffer.sponsorName}</Text>
                  {'  '}{currentOffer.title}
                </Text>
                <Text style={ms.offerDesc}>{currentOffer.description}</Text>

                <TouchableOpacity onPress={toggleComments} activeOpacity={0.7}>
                  <Text style={ms.viewComments}>
                    Ver todos os {commentCount.toLocaleString('pt-BR')} comentarios
                  </Text>
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

        <View style={ms.commentInputWrap}>
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
  handleBar: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.textMuted,
    opacity: 0.4,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.cardBorder,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sponsorMini: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  sponsorName: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  offerLocation: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  closeBtn: {
    padding: 6,
  },
  contentWrap: {
    flex: 1,
  },
  feedContainer: {
    flex: 1,
  },
  imageWrap: {
    position: 'relative' as const,
    width: SCREEN_W,
    height: MODAL_MEDIA_HEIGHT,
    backgroundColor: Colors.dark.surfaceLight,
  },
  offerImage: {
    width: '100%',
    height: '100%',
  },
  carouselDots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
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
  discountTag: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  discountText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900' as const,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionBtn: {
    padding: 4,
  },
  detailsSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  likeCount: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 6,
  },
  offerTitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  offerTitleBold: {
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  offerDesc: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    lineHeight: 18,
    marginBottom: 8,
  },
  viewComments: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginTop: 4,
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
