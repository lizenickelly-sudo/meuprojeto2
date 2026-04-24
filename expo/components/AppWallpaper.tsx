import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

export default function AppWallpaper() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        source={require('../assets/images/home-wallpaper.jpg')}
        style={s.wallpaper}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'rgba(125,211,252,0.1)', 'rgba(255,255,255,0)']}
        locations={[0, 0.35, 1]}
        start={{ x: 0.92, y: 0 }}
        end={{ x: 0.14, y: 0.86 }}
        style={s.wallpaperLight}
      />
      <LinearGradient
        colors={['rgba(236,72,153,0)', 'rgba(236,72,153,0.12)', 'rgba(56,189,248,0.2)', 'rgba(255,255,255,0)']}
        locations={[0, 0.35, 0.68, 1]}
        start={{ x: 0.18, y: 0.78 }}
        end={{ x: 0.96, y: 0.08 }}
        style={s.wallpaperGlow}
      />
      <LinearGradient
        colors={['rgba(4,6,14,0.08)', 'rgba(7,9,18,0.28)', 'rgba(5,7,14,0.5)']}
        locations={[0, 0.45, 1]}
        style={s.wallpaperOverlay}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wallpaper: { ...StyleSheet.absoluteFillObject },
  wallpaperLight: { ...StyleSheet.absoluteFillObject },
  wallpaperGlow: { ...StyleSheet.absoluteFillObject },
  wallpaperOverlay: { ...StyleSheet.absoluteFillObject },
});