import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Mail, Lock, Eye, EyeOff, ArrowRight, UserPlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'expo-router';

const { width: SCREEN_W } = Dimensions.get('window');

export default function LoginScreen() {
  console.log('[LoginScreen] Login screen initialized');
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    login, register, loginPending, loginError, registerPending, registerError,
    isLoggedIn, resetLoginMutation, resetRegisterMutation,
  } = useAuth();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const logoScale = useRef(new Animated.Value(0)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const formY = useRef(new Animated.Value(40)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;
  const glowScale = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(logoScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(formOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(formY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();

    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
    ]));
    p.start();

    const glow = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 0.6, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1.25, duration: 1500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(glowOpacity, { toValue: 0.2, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ]),
    ]));
    glow.start();

    return () => { p.stop(); glow.stop(); };
  }, []);

  useEffect(() => {
    if (isLoggedIn) router.replace('/(tabs)');
  }, [isLoggedIn, router]);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleSubmit = useCallback(() => {
    setLocalError(null);
    resetLoginMutation.reset();
    resetRegisterMutation.reset();
    if (!email.trim()) { setLocalError('Digite seu e-mail'); triggerShake(); if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setLocalError('Formato de e-mail inválido'); triggerShake(); if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    if (!password.trim() || password.length < 6) { setLocalError('A senha deve ter no mínimo 6 caracteres'); triggerShake(); if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    if (isRegisterMode && password !== confirmPassword) { setLocalError('As senhas não coincidem'); triggerShake(); if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isRegisterMode) register(email.trim(), password);
    else login(email.trim(), password);
  }, [email, password, confirmPassword, isRegisterMode, login, register, triggerShake, resetLoginMutation, resetRegisterMutation]);

  const toggleMode = useCallback(() => {
    setIsRegisterMode((prev) => !prev); setLocalError(null); setConfirmPassword('');
    resetLoginMutation.reset(); resetRegisterMutation.reset();
  }, [resetLoginMutation, resetRegisterMutation]);

  const displayError = localError || (isRegisterMode ? registerError : loginError);
  const isPending = isRegisterMode ? registerPending : loginPending;

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.bgFill} />
      <View style={s.particles}>
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={[s.particle, { left: (i * 73) % SCREEN_W, top: 60 + (i * 97) % 400, width: 2 + (i % 3) * 2, height: 2 + (i % 3) * 2, opacity: 0.15 + (i % 3) * 0.1 }]} />
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <Animated.View style={[s.logoWrap, { transform: [{ scale: Animated.multiply(logoScale, pulse) }] }]}>
          <Animated.View style={[s.glowRing, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
          <Image
            source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/8zchp84xabi8l90h56tiq.png' }}
            style={s.logo}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </Animated.View>

        <Animated.View style={[s.titleWrap, { opacity: formOpacity }]}>
          <Text style={s.title}>Caça ao Tesouro</Text>
          <Text style={s.titleAccent}>PIX</Text>
        </Animated.View>

        <Animated.View style={[s.formCard, { opacity: formOpacity, transform: [{ translateY: formY }, { translateX: shakeAnim }] }]}>
          <Text style={s.formTitle}>{isRegisterMode ? 'Criar Conta' : 'Entrar'}</Text>
          <Text style={s.formSubtitle}>{isRegisterMode ? 'Preencha seus dados para começar' : 'Acesse sua conta para continuar'}</Text>

          <View style={s.inputWrap}>
            <View style={s.inputIcon}><Mail size={18} color={Colors.dark.textMuted} /></View>
            <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="seu@email.com" placeholderTextColor={Colors.dark.textMuted} keyboardType="email-address" autoCapitalize="none" autoComplete="email" testID="login-email" />
          </View>

          <View style={s.inputWrap}>
            <View style={s.inputIcon}><Lock size={18} color={Colors.dark.textMuted} /></View>
            <TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="Sua senha" placeholderTextColor={Colors.dark.textMuted} secureTextEntry={!showPassword} autoCapitalize="none" testID="login-password" />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword((p) => !p)}>
              {showPassword ? <EyeOff size={18} color={Colors.dark.textMuted} /> : <Eye size={18} color={Colors.dark.textMuted} />}
            </TouchableOpacity>
          </View>

          {isRegisterMode && (
            <View style={s.inputWrap}>
              <View style={s.inputIcon}><Lock size={18} color={Colors.dark.textMuted} /></View>
              <TextInput style={s.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirmar senha" placeholderTextColor={Colors.dark.textMuted} secureTextEntry={!showPassword} autoCapitalize="none" testID="login-confirm-password" />
            </View>
          )}

          {displayError && <View style={s.errorBox}><Text style={s.errorText}>{displayError}</Text></View>}

          {!isRegisterMode && (
            <TouchableOpacity style={s.forgotBtn} onPress={() => router.push('/forgot-password')} activeOpacity={0.7} testID="forgot-password-btn">
              <Text style={s.forgotText}>Esqueceu sua senha?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[s.submitBtn, isPending && s.submitBtnDisabled]} onPress={handleSubmit} activeOpacity={0.85} disabled={isPending} testID="login-submit">
            <LinearGradient colors={isPending ? [Colors.dark.textMuted, Colors.dark.textMuted] : [Colors.dark.primary, Colors.dark.primaryDim]} style={s.submitGrad}>
              {isRegisterMode ? <UserPlus size={18} color="#FFF" /> : <ArrowRight size={18} color="#FFF" />}
              <Text style={s.submitText}>{isPending ? 'Aguarde...' : isRegisterMode ? 'CRIAR CONTA' : 'ENTRAR'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={s.switchRow}>
            <Text style={s.switchLabel}>{isRegisterMode ? 'Já tem conta?' : 'Não tem conta?'}</Text>
            <TouchableOpacity onPress={toggleMode} activeOpacity={0.7}>
              <Text style={s.switchLink}>{isRegisterMode ? 'Entrar' : 'Criar conta'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  bgFill: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.dark.background },
  particles: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
  particle: { position: 'absolute' as const, borderRadius: 50, backgroundColor: '#F97316' },
  scroll: { alignItems: 'center', paddingHorizontal: 24 },
  logoWrap: { alignItems: 'center', marginBottom: 16 },
  glowRing: { position: 'absolute' as const, width: 130, height: 130, borderRadius: 65, backgroundColor: '#F97316', top: -10, left: -10 },
  logo: { width: 110, height: 110, borderRadius: 16 },
  titleWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 32 },
  title: { fontSize: 24, fontWeight: '300' as const, color: Colors.dark.textSecondary },
  titleAccent: { fontSize: 28, fontWeight: '900' as const, color: Colors.dark.primary },
  formCard: { width: '100%', maxWidth: 400, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6 },
  formTitle: { fontSize: 22, fontWeight: '800' as const, color: Colors.dark.text, marginBottom: 4 },
  formSubtitle: { fontSize: 13, color: Colors.dark.textMuted, marginBottom: 24 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.inputBg, borderRadius: 14, borderWidth: 1, borderColor: Colors.dark.inputBorder, marginBottom: 14, overflow: 'hidden' },
  inputIcon: { paddingLeft: 14, paddingRight: 4 },
  input: { flex: 1, paddingVertical: 14, paddingHorizontal: 8, fontSize: 15, color: Colors.dark.text },
  eyeBtn: { padding: 14 },
  errorBox: { backgroundColor: 'rgba(255,71,87,0.1)', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,71,87,0.2)' },
  errorText: { color: '#FF4757', fontSize: 13, fontWeight: '500' as const, textAlign: 'center' as const },
  forgotBtn: { alignSelf: 'flex-end' as const, marginBottom: 20, marginTop: -4 },
  forgotText: { color: Colors.dark.primary, fontSize: 13, fontWeight: '600' as const },
  submitBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 20 },
  submitBtnDisabled: { opacity: 0.7 },
  submitGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  submitText: { color: '#FFF', fontSize: 15, fontWeight: '800' as const, letterSpacing: 0.5 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  switchLabel: { color: Colors.dark.textMuted, fontSize: 13 },
  switchLink: { color: Colors.dark.primary, fontSize: 13, fontWeight: '700' as const },
});
