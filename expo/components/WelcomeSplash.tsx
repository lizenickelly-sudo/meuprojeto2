import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { MapPin, Trophy, Clock, Gift } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { GrandPrize } from '@/types';
import { mockGrandPrize } from '@/mocks/winners';

const { width, height } = Dimensions.get('window');

interface WelcomeSplashProps {
  userName: string;
  userCity?: string;
  grandPrizeConfig?: GrandPrize | null;
  cityImage?: string | null;
  onContinue: () => void;
}

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
        secs: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [targetDate]);

  return (
    <View style={ct.row}>
      {[
        { v: timeLeft.days, l: 'DIAS' },
        { v: timeLeft.hours, l: 'HRS' },
        { v: timeLeft.mins, l: 'MIN' },
        { v: timeLeft.secs, l: 'SEG' },
      ].map((item, i) => (
        <React.Fragment key={item.l}>
          {i > 0 && <Text style={ct.sep}>:</Text>}
          <View style={ct.box}>
            <Text style={ct.val}>{String(item.v).padStart(2, '0')}</Text>
            <Text style={ct.lbl}>{item.l}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const ct = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  sep: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' as const, marginBottom: 14, textShadowColor: 'rgba(255,255,255,0.8)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  box: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, minWidth: 54, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  val: { color: '#FFFFFF', fontSize: 26, fontWeight: '900' as const, textShadowColor: 'rgba(255,255,255,0.9)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  lbl: { color: 'rgba(255,255,255,0.85)', fontSize: 9, fontWeight: '700' as const, marginTop: 3, letterSpacing: 1.5 },
});

export default function WelcomeSplash({ userName, userCity, grandPrizeConfig, cityImage, onContinue }: WelcomeSplashProps) {
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const titleOp = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(30)).current;
  const msgOp = useRef(new Animated.Value(0)).current;
  const msgY = useRef(new Animated.Value(20)).current;
  const btnOp = useRef(new Animated.Value(0)).current;
  const btnY = useRef(new Animated.Value(20)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
        Animated.timing(logoRotate, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(msgOp, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(msgY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(btnOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(btnY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    const p = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    p.start();

    const glow = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowOpacity, { toValue: 0.7, duration: 1500, useNativeDriver: true }),
          Animated.timing(glowScale, { toValue: 1.3, duration: 1500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(glowOpacity, { toValue: 0.2, duration: 1500, useNativeDriver: true }),
          Animated.timing(glowScale, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ]),
      ])
    );
    glow.start();

    return () => { p.stop(); glow.stop(); };
  }, []);

  const spin = logoRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFFFFF', '#FFF7ED', '#FFFFFF']}
        style={styles.bg}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <View style={styles.particles}>
        {Array.from({ length: 8 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.particle,
              {
                left: (i * 67) % width,
                top: 100 + (i * 113) % (height * 0.5),
                width: 2 + (i % 3) * 2,
                height: 2 + (i % 3) * 2,
                opacity: 0.15 + (i % 3) * 0.1,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.content}>
        <Animated.View style={[styles.logoWrap, { transform: [{ scale: Animated.multiply(logoScale, pulse) }, { rotate: spin }] }]}>
          <Animated.View style={[styles.glowRing, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
          <Image
            source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/vwancwzc86f4m7bld7wt3.png' }}
            style={styles.treasureIcon}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </Animated.View>

        <Animated.View style={{ opacity: titleOp, transform: [{ translateY: titleY }] }}>
          <Text style={styles.greeting}>Ola, <Text style={styles.name}>{userName.split(' ')[0]}!</Text></Text>
          <Text style={styles.brand}>
            Bem-vindo ao <Text style={styles.brandAccent}>Caca ao Tesouro PIX</Text>
          </Text>
          {userCity ? (
            <View style={styles.cityRow}>
              <MapPin size={14} color={'#F97316'} />
              <Text style={styles.cityText}>em {userCity}</Text>
            </View>
          ) : null}
        </Animated.View>

        <Animated.View style={[styles.prizeBox, { opacity: msgOp, transform: [{ translateY: msgY }] }]}>
          {(() => {
            const prize = grandPrizeConfig ?? mockGrandPrize;
            const bgUrl = prize.backgroundImageUrl || prize.imageUrl || cityImage || null;
            const hasCityPhoto = !!bgUrl;
            const prizeValue = prize.value ?? mockGrandPrize.value;
            const lotteryRef = prize.lotteryReference ?? mockGrandPrize.lotteryReference;
            const drawDate = prize.drawDate ?? mockGrandPrize.drawDate;
            const prizeCity = prize.city || userCity || '';
            const prizeState = prize.state || '';

            if (!hasCityPhoto) {
              return (
                <View style={styles.prizeBgWrap}>
                  <LinearGradient
                    colors={['#FFF7ED', '#FFF1E6']}
                    style={styles.prizeGrad}
                  >
                    <View style={styles.prizeHeader}>
                      <Gift size={22} color="#F97316" />
                      <Text style={styles.prizeTtl}>GRANDE PREMIO</Text>
                    </View>
                    <Text style={styles.comingSoon}>Premio em Breve</Text>
                    <Text style={styles.comingSoonSub}>Fique atento! O premio da sua cidade sera divulgado em breve.</Text>
                  </LinearGradient>
                </View>
              );
            }

            return (
              <View style={styles.prizeBgWrap}>
                <Image source={{ uri: bgUrl }} style={styles.prizeBgImgTall} contentFit="cover" cachePolicy="memory-disk" />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.9)']}
                  locations={[0, 0.5, 1]}
                  style={styles.prizeGradOverlay}
                >
                  <View style={styles.timerHighlight}>
                    <View style={styles.timerHighlightHeader}>
                      <Clock size={16} color={'#FFFFFF'} />
                      <Text style={styles.timerHighlightLabel}>Sorteio em:</Text>
                    </View>
                    <CountdownTimer targetDate={drawDate} />
                  </View>
                </LinearGradient>
              </View>
            );
          })()}
        </Animated.View>

        <Animated.View style={{ opacity: btnOp, transform: [{ translateY: btnY }, { scale: pulse }] }}>
          <TouchableOpacity style={styles.btn} onPress={onContinue} activeOpacity={0.85} testID="welcome-btn">
            <LinearGradient colors={['#F97316', '#EA580C']} style={styles.btnGrad}>
              <Text style={styles.btnTxt}>EXPLORAR</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bg: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  particles: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  particle: {
    position: 'absolute' as const,
    borderRadius: 50,
    backgroundColor: '#F97316',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoWrap: {
    marginBottom: 32,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  treasureIcon: {
    width: 110,
    height: 110,
    borderRadius: 16,
  },
  glowRing: {
    position: 'absolute' as const,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#F97316',
    top: -10,
    left: -10,
  },
  greeting: {
    fontSize: 30,
    fontWeight: '300' as const,
    color: '#6B7280',
    textAlign: 'center',
  },
  name: {
    fontWeight: '800' as const,
    color: '#1A1A2E',
  },
  brand: {
    fontSize: 17,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 24,
  },
  brandAccent: {
    color: '#F97316',
    fontWeight: '700' as const,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
  },
  cityText: {
    color: '#F97316',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  prizeBox: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 28,
    marginBottom: 36,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
    width: '100%',
  },
  prizeBgWrap: {
    position: 'relative' as const,
  },
  prizeBgImg: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  prizeBgImgTall: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  prizeGrad: {
    padding: 20,
    alignItems: 'center',
  },
  prizeGradOverlay: {
    paddingTop: 120,
    paddingBottom: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  prizeHeaderNew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  prizeTtlNew: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  timerHighlight: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  timerHighlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  timerHighlightLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 1,
    textShadowColor: 'rgba(255,255,255,0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  prizeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  prizeCityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  prizeCityText: {
    color: '#F97316',
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  prizeImageWrap: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative' as const,
  },
  prizeImage: {
    width: '100%',
    height: '100%',
  },
  prizeImageOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  prizeImageBadge: {
    position: 'absolute' as const,
    bottom: 6,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  prizeImageBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  prizeTtl: {
    color: '#F97316',
    fontSize: 12,
    fontWeight: '900' as const,
    letterSpacing: 2,
  },
  prizeTtlLight: {
    color: '#FFFFFF',
  },
  prizeVal: {
    color: '#1A1A2E',
    fontSize: 32,
    fontWeight: '900' as const,
    marginBottom: 4,
  },
  prizeValLight: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  prizeRef: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    marginBottom: 12,
  },
  prizeRefLight: {
    color: 'rgba(255,255,255,0.85)',
  },
  prizeDivider: {
    width: '100%',
    height: 1,
    backgroundColor: Colors.dark.cardBorder,
    marginBottom: 10,
  },
  prizeTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  prizeTimerLabel: {
    color: Colors.dark.textMuted,
    fontSize: 12,
  },
  comingSoon: {
    color: '#F97316',
    fontSize: 26,
    fontWeight: '900' as const,
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  comingSoonSub: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  btn: {
    borderRadius: 16,
    overflow: 'hidden',
    minWidth: 220,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  btnGrad: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  btnTxt: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800' as const,
    letterSpacing: 1.5,
  },
});
