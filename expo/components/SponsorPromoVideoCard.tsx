import React from 'react';
import { useEvent } from 'expo';
import { StyleSheet, Text, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import Colors from '@/constants/colors';
import { formatVideoDuration } from '@/lib/sponsorMedia';
import type { SponsorVideo } from '@/types';

export default function SponsorPromoVideoCard({
  sponsorName,
  video,
}: {
  sponsorName: string;
  video: SponsorVideo;
}) {
  const player = useVideoPlayer({
    uri: video.url,
    metadata: {
      title: video.title || `Video promocional de ${sponsorName}`,
      artist: sponsorName,
    },
    useCaching: true,
  }, (instance) => {
    instance.loop = false;
    instance.staysActiveInBackground = false;
  });

  const { status, error } = useEvent(player, 'statusChange', { status: player.status, error: undefined });

  return (
    <View style={s.card}>
      <VideoView
        style={s.video}
        player={player}
        nativeControls
        playsInline
        contentFit="cover"
        surfaceType="textureView"
        fullscreenOptions={{ enable: true }}
      />
      <View style={s.meta}>
        <Text style={s.title} numberOfLines={1}>{video.title || 'Video promocional'}</Text>
        <Text style={s.subtitle} numberOfLines={1}>
          {formatVideoDuration(video.durationSeconds)}
          {video.fileName ? ` • ${video.fileName}` : ''}
        </Text>
        {status === 'loading' ? <Text style={s.loading}>Carregando video...</Text> : null}
        {status === 'error' || error?.message ? <Text style={s.error}>Nao foi possivel carregar este video.</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    width: 280,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  video: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.dark.surfaceLight,
  },
  meta: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 3,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  subtitle: {
    color: Colors.dark.textMuted,
    fontSize: 12,
  },
  loading: {
    color: Colors.dark.neonGreen,
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  error: {
    color: Colors.dark.danger,
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 2,
  },
});