import React, { useCallback, useEffect, useState } from 'react';
import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { BadgeCheck, Heart, MapPin, MessageCircle, Send, Share2, ShoppingBag, X } from 'lucide-react-native';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Colors from '@/constants/colors';
import { useSponsor } from '@/providers/SponsorProvider';
import { useUser } from '@/providers/UserProvider';
import type { Sponsor, SponsorVideo } from '@/types';

interface ReelComment {
  id: string;
  username: string;
  avatar: string;
  text: string;
  createdAt: string;
}

const REEL_COMMENTS_KEY = 'cashboxpix_reel_comments_v1';
const REEL_SHARES_KEY = 'cashboxpix_reel_shares_v1';

export default function SponsorReelFeedItem({
  sponsor,
  video,
  active,
  visible,
  soundEnabled,
  height,
  bottomInset,
  onOpenSponsor,
}: {
  sponsor: Sponsor;
  video: SponsorVideo;
  active: boolean;
  visible: boolean;
  soundEnabled: boolean;
  height: number;
  bottomInset: number;
  onOpenSponsor: () => void;
}) {
  const { likePromotionalVideo, isPromotionalVideoLiked } = useSponsor();
  const { profile } = useUser();
  const commentThreadKey = `${sponsor.id}:${video.id}`;
  const player = useVideoPlayer({
    uri: video.url,
    metadata: {
      title: video.title || `Reel de ${sponsor.name}`,
      artist: sponsor.name,
    },
    useCaching: true,
  }, (instance) => {
    instance.loop = true;
    instance.staysActiveInBackground = false;
    instance.muted = !soundEnabled || !visible;
  });

  const { status, error } = useEvent(player, 'statusChange', { status: player.status, error: undefined });
  const videoLiked = isPromotionalVideoLiked(video.id);
  const [showComments, setShowComments] = useState<boolean>(false);
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [newComment, setNewComment] = useState<string>('');
  const [shareCount, setShareCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;

    const loadReelEngagement = async () => {
      try {
        const [commentsRaw, sharesRaw] = await Promise.all([
          AsyncStorage.getItem(REEL_COMMENTS_KEY),
          AsyncStorage.getItem(REEL_SHARES_KEY),
        ]);

        const parsedComments = commentsRaw ? JSON.parse(commentsRaw) as Record<string, ReelComment[]> : {};
        const parsedShares = sharesRaw ? JSON.parse(sharesRaw) as Record<string, number> : {};
        const nextComments = Array.isArray(parsedComments?.[commentThreadKey]) ? parsedComments[commentThreadKey] : [];
        const nextShares = typeof parsedShares?.[commentThreadKey] === 'number' && Number.isFinite(parsedShares[commentThreadKey])
          ? parsedShares[commentThreadKey]
          : 0;

        if (mounted) {
          setComments(nextComments);
          setShareCount(nextShares);
        }
      } catch (loadError) {
        console.log('[SponsorReelFeedItem] Failed to load reel engagement:', loadError);
        if (mounted) {
          setComments([]);
          setShareCount(0);
        }
      }
    };

    void loadReelEngagement();

    return () => {
      mounted = false;
    };
  }, [commentThreadKey]);

  const handleLikePress = () => {
    likePromotionalVideo(video.id);
  };

  const handleOpenComments = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowComments(true);
  }, []);

  const handleCloseComments = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowComments(false);
    setNewComment('');
  }, []);

  const handleSendComment = useCallback(() => {
    const trimmedComment = newComment.trim();
    if (!trimmedComment) return;

    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const comment: ReelComment = {
      id: `reel_comment_${Date.now()}`,
      username: profile.name?.trim() || 'Voce',
      avatar: profile.avatarUrl || profile.selfieUrl || sponsor.logoUrl || sponsor.imageUrl,
      text: trimmedComment,
      createdAt: new Date().toISOString(),
    };

    const nextComments = [comment, ...comments];
    setComments(nextComments);
    setNewComment('');

    AsyncStorage.getItem(REEL_COMMENTS_KEY)
      .then((raw) => {
        let parsed: Record<string, ReelComment[]> = {};
        if (raw) {
          try {
            parsed = JSON.parse(raw) as Record<string, ReelComment[]>;
          } catch {
            parsed = {};
          }
        }

        parsed[commentThreadKey] = nextComments;
        return AsyncStorage.setItem(REEL_COMMENTS_KEY, JSON.stringify(parsed));
      })
      .catch((persistError) => {
        console.log('[SponsorReelFeedItem] Failed to persist comments:', persistError);
      });
  }, [commentThreadKey, comments, newComment, profile.avatarUrl, profile.name, profile.selfieUrl, sponsor.imageUrl, sponsor.logoUrl]);

  const handleSharePress = async () => {
    try {
      const result = await Share.share({
        message: `Confira ${sponsor.name} em ${sponsor.city} - ${sponsor.state} no Caca ao Tesouro PIX.${sponsor.address ? ` Endereco: ${sponsor.address}.` : ''}`,
      });

      if (result.action === Share.dismissedAction) {
        return;
      }

      const nextShareCount = shareCount + 1;
      setShareCount(nextShareCount);

      AsyncStorage.getItem(REEL_SHARES_KEY)
        .then((raw) => {
          let parsed: Record<string, number> = {};
          if (raw) {
            try {
              parsed = JSON.parse(raw) as Record<string, number>;
            } catch {
              parsed = {};
            }
          }

          parsed[commentThreadKey] = nextShareCount;
          return AsyncStorage.setItem(REEL_SHARES_KEY, JSON.stringify(parsed));
        })
        .catch((persistError) => {
          console.log('[SponsorReelFeedItem] Failed to persist shares:', persistError);
        });
    } catch {
      Alert.alert('Erro', 'Nao foi possivel compartilhar esta loja agora.');
    }
  };

  useEffect(() => {
    player.muted = !soundEnabled || !visible;

    if (active && visible) {
      player.play();
      return;
    }

    player.pause();
    if (!active) {
      player.currentTime = 0;
    }
  }, [active, player, soundEnabled, visible]);

  return (
    <View style={[s.container, { height }]}> 
      <VideoView
        style={s.video}
        player={player}
        nativeControls={false}
        playsInline
        contentFit="cover"
        surfaceType="textureView"
      />

      <LinearGradient
        colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.82)']}
        style={s.fade}
      />

      <View style={[s.content, { paddingBottom: Math.max(bottomInset, 18) + 28 }]}>
        <View style={s.overlayRow}>
          <View style={s.copyColumn}>
            <View style={s.headerChip}>
              <Image source={{ uri: sponsor.logoUrl || sponsor.imageUrl }} style={s.logo} contentFit="cover" cachePolicy="memory-disk" />
              <View style={s.headerInfo}>
                <View style={s.titleRow}>
                  <Text style={s.sponsorName} numberOfLines={1}>{sponsor.name}</Text>
                  {sponsor.verified ? <BadgeCheck size={14} color={Colors.dark.primary} /> : null}
                </View>
                <Text style={s.category} numberOfLines={1}>{sponsor.category}</Text>
              </View>
            </View>

            <View style={s.metaRow}>
              <View style={s.metaBadge}>
                <MapPin size={12} color="#FFF" />
                <Text style={s.metaText}>{sponsor.city}, {sponsor.state}</Text>
              </View>
              <View style={s.metaBadge}>
                <ShoppingBag size={12} color="#FFF" />
                <Text style={s.metaText}>{sponsor.offers.length} oferta{sponsor.offers.length === 1 ? '' : 's'}</Text>
              </View>
            </View>

            {sponsor.address ? (
              <Text style={s.reelSubtitle} numberOfLines={2}>
                {sponsor.address}
              </Text>
            ) : null}

            <TouchableOpacity style={s.ctaButton} onPress={onOpenSponsor} activeOpacity={0.85}>
              <Text style={s.ctaText}>Abrir loja</Text>
            </TouchableOpacity>

            {status === 'loading' ? <Text style={s.feedback}>Carregando reel...</Text> : null}
            {status === 'error' || error?.message ? <Text style={[s.feedback, s.feedbackError]}>Nao foi possivel carregar este reel.</Text> : null}
          </View>

          <View style={s.actionsRail}>
            <TouchableOpacity style={s.actionButton} onPress={handleLikePress} activeOpacity={0.82}>
              <View style={s.actionIconWrap}>
                <Heart size={24} color={videoLiked ? '#FB7185' : '#FFFFFF'} fill={videoLiked ? '#FB7185' : 'transparent'} />
              </View>
              <Text style={s.actionMetric}>{(video.likes || 0).toLocaleString('pt-BR')}</Text>
              <Text style={s.actionLabel}>Curtidas</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionButton} onPress={handleOpenComments} activeOpacity={0.82}>
              <View style={s.actionIconWrap}>
                <MessageCircle size={24} color="#FFFFFF" />
              </View>
              <Text style={s.actionMetric}>{comments.length.toLocaleString('pt-BR')}</Text>
              <Text style={s.actionLabel}>Comentarios</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionButton} onPress={() => { void handleSharePress(); }} activeOpacity={0.82}>
              <View style={s.actionIconWrap}>
                <Share2 size={24} color="#FFFFFF" />
              </View>
              <Text style={s.actionMetric}>{shareCount.toLocaleString('pt-BR')}</Text>
              <Text style={s.actionLabel}>Compartilhamentos</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal visible={showComments} animationType="slide" transparent onRequestClose={handleCloseComments}>
        <View style={s.commentsOverlay}>
          <TouchableOpacity style={s.commentsBackdrop} activeOpacity={1} onPress={handleCloseComments} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.commentsKeyboardWrap}>
            <View style={s.commentsSheet}>
              <View style={s.commentsSheetHandle} />
              <View style={s.commentsHeader}>
                <Text style={s.commentsTitle}>Comentarios</Text>
                <TouchableOpacity style={s.commentsCloseBtn} onPress={handleCloseComments} activeOpacity={0.8}>
                  <X size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {comments.length > 0 ? (
                <FlatList
                  data={comments}
                  keyExtractor={(item) => item.id}
                  style={[s.commentsList, { maxHeight: Math.min(height * 0.45, 360) }]}
                  contentContainerStyle={s.commentsListContent}
                  renderItem={({ item }) => (
                    <View style={s.commentRow}>
                      <Image source={{ uri: item.avatar }} style={s.commentAvatar} contentFit="cover" cachePolicy="memory-disk" />
                      <View style={s.commentBubble}>
                        <Text style={s.commentAuthor}>{item.username}</Text>
                        <Text style={s.commentText}>{item.text}</Text>
                      </View>
                    </View>
                  )}
                />
              ) : (
                <View style={s.emptyCommentsWrap}>
                  <Text style={s.emptyCommentsText}>Sem comentarios ainda. Seja o primeiro a comentar.</Text>
                </View>
              )}

              <View style={s.commentComposer}>
                <TextInput
                  style={s.commentInput}
                  placeholder="Escreva um comentario..."
                  placeholderTextColor="rgba(255,255,255,0.42)"
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                />
                <TouchableOpacity
                  style={[s.sendCommentBtn, !newComment.trim() && s.sendCommentBtnDisabled]}
                  onPress={handleSendComment}
                  activeOpacity={0.82}
                  disabled={!newComment.trim()}
                >
                  <Send size={18} color={newComment.trim() ? '#000000' : 'rgba(255,255,255,0.42)'} />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: '#050505',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050505',
  },
  fade: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    paddingHorizontal: 18,
  },
  overlayRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
  },
  copyColumn: {
    flex: 1,
    gap: 10,
  },
  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  headerInfo: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sponsorName: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800' as const,
    flexShrink: 1,
  },
  category: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  metaText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  reelSubtitle: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 13,
    lineHeight: 19,
    maxWidth: '100%',
  },
  ctaButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  ctaText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800' as const,
  },
  feedback: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700' as const,
  },
  feedbackError: {
    color: '#FCA5A5',
  },
  actionsRail: {
    width: 76,
    alignItems: 'center',
    gap: 14,
    paddingBottom: 6,
  },
  actionButton: {
    alignItems: 'center',
    gap: 6,
  },
  actionIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  actionMetric: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800' as const,
    textAlign: 'center',
    minWidth: 34,
  },
  commentsOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.44)',
  },
  commentsBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  commentsKeyboardWrap: {
    justifyContent: 'flex-end',
  },
  commentsSheet: {
    backgroundColor: 'rgba(8,10,18,0.98)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  commentsSheetHandle: {
    alignSelf: 'center',
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 14,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  commentsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800' as const,
  },
  commentsCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  commentsList: {
    marginBottom: 14,
  },
  commentsListContent: {
    gap: 12,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  commentAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  commentBubble: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  commentAuthor: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  commentText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCommentsWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 26,
    paddingHorizontal: 10,
  },
  emptyCommentsText: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  commentComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  commentInput: {
    flex: 1,
    minHeight: 52,
    maxHeight: 116,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sendCommentBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.neonGreen,
  },
  sendCommentBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});