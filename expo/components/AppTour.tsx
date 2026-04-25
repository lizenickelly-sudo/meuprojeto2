import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Smartphone,
  Gift,
  Wallet,
  ArrowRight,
  X,
  ScanLine,
  TrendingUp,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface TourSlide {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: string[];
  accentColor: string;
  bgGradient: [string, string, string];
}

const SLIDES: TourSlide[] = [
  {
    id: 'welcome',
    icon: <Smartphone size={48} color="#FFF" />,
    title: 'Como funciona o App',
    subtitle: 'Seu guia rápido',
    bullets: [
      'Explore lojas e patrocinadores perto de você',
      'Veja promoções exclusivas no feed',
      'Escaneie cupons QR Code nas lojas parceiras',
      'Acumule saldo em PIX automaticamente',
    ],
    accentColor: '#3B82F6',
    bgGradient: ['#1E3A8A', '#2563EB', '#1E3A8A'],
  },
  {
    id: 'prizes',
    icon: <Gift size={48} color="#FFF" />,
    title: 'Grande Prêmio',
    subtitle: 'Como funciona a premiação',
    bullets: [
      'Cada cupom escaneado já tem número para participar do grande prêmio',
      'O sorteio é baseado na Loteria Federal, do 1º ao 5º prêmio',
      'Prêmio em PIX para os ganhadores',
      'Quanto mais cupons, mais chances de ganhar!',
    ],
    accentColor: '#DC2626',
    bgGradient: ['#991B1B', '#DC2626', '#991B1B'],
  },
  {
    id: 'pix',
    icon: <Wallet size={48} color="#FFF" />,
    title: 'Salvar e Receber PIX',
    subtitle: 'Seu dinheiro na conta',
    bullets: [
      'Cadastre sua chave PIX no perfil',
      'Saldo acumula a cada cupom escaneado',
      'Solicite saque a qualquer momento',
      'Receba direto na sua conta em minutos',
    ],
    accentColor: '#22C55E',
    bgGradient: ['#14532D', '#22C55E', '#14532D'],
  },
];

interface AppTourProps {
  onClose: () => void;
}

export default function AppTour({ onClose }: AppTourProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const scrollRef = useRef<ScrollView>(null);
  const dotAnim = useRef(SLIDES.map(() => new Animated.Value(0))).current;

  React.useEffect(() => {
    dotAnim.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: i === currentIndex ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    });
  }, [currentIndex]);

  const handleScroll = useCallback((e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (idx !== currentIndex && idx >= 0 && idx < SLIDES.length) {
      setCurrentIndex(idx);
    }
  }, [currentIndex]);

  const goNext = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      scrollRef.current?.scrollTo({ x: next * SCREEN_W, animated: true });
      setCurrentIndex(next);
    } else {
      onClose();
    }
  }, [currentIndex, onClose]);

  const handleClose = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }, [onClose]);

  const slide = SLIDES[currentIndex];
  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View style={[styles.container]}>
      <LinearGradient
        colors={slide.bgGradient as [string, string, string]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>{currentIndex + 1}/{SLIDES.length}</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
          <X size={20} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {SLIDES.map((s, idx) => (
          <View key={s.id} style={styles.slide}>
            <View style={styles.iconContainer}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <View style={[styles.iconInner, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  {s.icon}
                </View>
              </View>
            </View>

            <Text style={styles.slideSubtitle}>{s.subtitle}</Text>
            <Text style={styles.slideTitle}>{s.title}</Text>

            <View style={styles.bulletsContainer}>
              {s.bullets.map((bullet, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={[styles.bulletNumber, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Text style={styles.bulletNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>

            {idx === 0 && (
              <View style={styles.tipCard}>
                <ScanLine size={18} color={s.accentColor} />
                <Text style={styles.tipText}>Comece escaneando seu primeiro cupom!</Text>
              </View>
            )}
            {idx === 1 && (
              <View style={styles.tipCard}>
                <Gift size={18} color={s.accentColor} />
                <Text style={styles.tipText}>Sorteios em datas definidas pelo administrador!</Text>
              </View>
            )}
            {idx === 2 && (
              <View style={styles.tipCard}>
                <TrendingUp size={18} color={s.accentColor} />
                <Text style={styles.tipText}>Sem taxa! O valor vai direto pra você.</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const width = dotAnim[i].interpolate({
              inputRange: [0, 1],
              outputRange: [8, 28],
            });
            const opacity = dotAnim[i].interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 1],
            });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { width, opacity, backgroundColor: '#FFF' }]}
              />
            );
          })}
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.8}>
          <LinearGradient
            colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.1)']}
            style={styles.nextBtnGrad}
          >
            <Text style={styles.nextBtnText}>
              {isLast ? 'COMEÇAR' : 'PRÓXIMO'}
            </Text>
            {!isLast && <ChevronRight size={18} color="#FFF" />}
            {isLast && <ArrowRight size={18} color="#FFF" />}
          </LinearGradient>
        </TouchableOpacity>

        {!isLast && (
          <TouchableOpacity onPress={handleClose} style={styles.skipBtn} activeOpacity={0.7}>
            <Text style={styles.skipText}>Pular tour</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 999,
    elevation: 999,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  stepIndicator: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  stepText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width: SCREEN_W,
    paddingHorizontal: 28,
    justifyContent: 'center',
    paddingTop: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  slideTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900' as const,
    textAlign: 'center' as const,
    marginBottom: 32,
  },
  bulletsContainer: {
    gap: 14,
    marginBottom: 24,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bulletNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletNumberText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800' as const,
  },
  bulletText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '500' as const,
    flex: 1,
    lineHeight: 22,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tipText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600' as const,
    flex: 1,
  },
  bottomBar: {
    paddingHorizontal: 28,
    gap: 12,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  nextBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  nextBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
  },
  nextBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  skipBtn: {
    paddingVertical: 8,
  },
  skipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600' as const,
  },
});
