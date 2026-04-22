import React, { useEffect } from 'react';
import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { BadgeCheck, MapPin, ShoppingBag } from 'lucide-react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '@/constants/colors';
import type { Sponsor, SponsorVideo } from '@/types';

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
    gap: 10,
  },
  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    alignSelf: 'flex-start',
    maxWidth: '92%',
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
    maxWidth: '86%',
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
});