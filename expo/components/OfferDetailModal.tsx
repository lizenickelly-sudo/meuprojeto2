import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Share,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Heart,
  MessageCircle,
  Send,
  X,
  Bookmark,
  MoreHorizontal,
  Share2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import type { Offer } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');

interface Comment {
  id: string;
  username: string;
  text: string;
  timestamp: string;
  avatar: string;
}

const MOCK_COMMENTS: Comment[] = [
  { id: 'c1', username: 'Maria S.', text: 'Amei essa oferta! Ja aproveitei semana passada', timestamp: '2h', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60' },
  { id: 'c2', username: 'Joao P.', text: 'Melhor preco da regiao mesmo!', timestamp: '5h', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60' },
  { id: 'c3', username: 'Ana L.', text: 'Vou la hoje aproveitar', timestamp: '1d', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=60' },
];

interface OfferDetailModalProps {
  visible: boolean;
  offer: Offer | null;
  onClose: () => void;
}

export default function OfferDetailModal({ visible, offer, onClose }: OfferDetailModalProps) {
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [comments, setComments] = useState<Comment[]>(MOCK_COMMENTS);
  const [newComment, setNewComment] = useState<string>('');
  const [showComments, setShowComments] = useState<boolean>(false);
  const heartScale = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (offer) {
      setLikeCount(offer.likes || 0);
      setIsLiked(offer.isLiked || false);
      setShowComments(false);
      setNewComment('');
    }
  }, [offer]);

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible]);

  const handleLike = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLiked((prev) => {
      setLikeCount((c) => prev ? c - 1 : c + 1);
      return !prev;
    });
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, friction: 3 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, friction: 5 }),
    ]).start();
  }, [heartScale]);

  const handleDoubleTap = useCallback(() => {
    if (!isLiked) {
      handleLike();
    }
  }, [isLiked, handleLike]);

  const lastTap = useRef<number>(0);
  const handleImagePress = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      handleDoubleTap();
    }
    lastTap.current = now;
  }, [handleDoubleTap]);

  const handleShare = useCallback(async () => {
    if (!offer) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Confira essa oferta: ${offer.title} - ${offer.description} | ${offer.discount} de desconto! Baixe o app Caca ao Tesouro PIX!`,
      });
    } catch {
      console.log('Share cancelled');
    }
  }, [offer]);

  const handleSave = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSaved((prev) => !prev);
  }, []);

  const handleSendComment = useCallback(() => {
    if (!newComment.trim()) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const comment: Comment = {
      id: `c_${Date.now()}`,
      username: 'Voce',
      text: newComment.trim(),
      timestamp: 'agora',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60',
    };
    setComments((prev) => [comment, ...prev]);
    setNewComment('');
  }, [newComment]);

  const toggleComments = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowComments((prev) => !prev);
  }, []);

  if (!offer) return null;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0],
  });

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={cs.commentRow}>
      <Image source={{ uri: item.avatar }} style={cs.commentAvatar} contentFit="cover" cachePolicy="memory-disk" placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} transition={200} />
      <View style={cs.commentContent}>
        <Text style={cs.commentUser}>{item.username} <Text style={cs.commentTime}>{item.timestamp}</Text></Text>
        <Text style={cs.commentText}>{item.text}</Text>
      </View>
    </View>
  );

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
            <Image source={{ uri: offer.imageUrl }} style={ms.sponsorMini} contentFit="cover" cachePolicy="memory-disk" placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} transition={200} />
            <View>
              <Text style={ms.sponsorName} numberOfLines={1}>{offer.sponsorName}</Text>
              <Text style={ms.offerLocation}>Patrocinador</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={ms.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <X size={22} color={Colors.dark.text} />
          </TouchableOpacity>
        </View>

        <Animated.View style={[ms.contentWrap, { opacity: slideAnim, transform: [{ translateY }] }]}>
          {!showComments ? (
            <FlatList
              data={[]}
              renderItem={null}
              ListHeaderComponent={
                <>
                  <TouchableOpacity activeOpacity={0.95} onPress={handleImagePress}>
                    <View style={ms.imageWrap}>
                      <Image source={{ uri: offer.imageUrl }} style={ms.offerImage} contentFit="cover" cachePolicy="memory-disk" placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} transition={400} />
                      {offer.discount && (
                        <View style={ms.discountTag}>
                          <Text style={ms.discountText}>{offer.discount}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>

                  <View style={ms.actionsRow}>
                    <View style={ms.actionsLeft}>
                      <TouchableOpacity onPress={handleLike} style={ms.actionBtn} activeOpacity={0.7}>
                        <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                          <Heart
                            size={26}
                            color={isLiked ? '#EF4444' : Colors.dark.text}
                            fill={isLiked ? '#EF4444' : 'transparent'}
                          />
                        </Animated.View>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={toggleComments} style={ms.actionBtn} activeOpacity={0.7}>
                        <MessageCircle size={25} color={Colors.dark.text} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleShare} style={ms.actionBtn} activeOpacity={0.7}>
                        <Share2 size={24} color={Colors.dark.text} />
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
                    <Text style={ms.likeCount}>{likeCount.toLocaleString('pt-BR')} curtidas</Text>
                    <Text style={ms.offerTitle}>
                      <Text style={ms.offerTitleBold}>{offer.sponsorName}</Text>
                      {'  '}{offer.title}
                    </Text>
                    <Text style={ms.offerDesc}>{offer.description}</Text>

                    <TouchableOpacity onPress={toggleComments} activeOpacity={0.7}>
                      <Text style={ms.viewComments}>
                        Ver todos os {offer.comments || comments.length} comentarios
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              }
              keyExtractor={() => 'header'}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={cs.commentsContainer}>
              <View style={cs.commentsHeader}>
                <TouchableOpacity onPress={toggleComments} style={cs.backBtn}>
                  <Text style={cs.backTxt}>Voltar</Text>
                </TouchableOpacity>
                <Text style={cs.commentsTitle}>Comentarios</Text>
                <View style={{ width: 60 }} />
              </View>
              <FlatList
                data={comments}
                renderItem={renderComment}
                keyExtractor={(item) => item.id}
                contentContainerStyle={cs.commentsList}
                showsVerticalScrollIndicator={false}
              />
            </View>
          )}
        </Animated.View>

        <View style={ms.commentInputWrap}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60' }}
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
  imageWrap: {
    position: 'relative' as const,
    width: SCREEN_W,
    height: SCREEN_W * 0.85,
    backgroundColor: Colors.dark.surfaceLight,
  },
  offerImage: {
    width: '100%',
    height: '100%',
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
});
