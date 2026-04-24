import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, ArrowLeft, KeyRound, Lock, Eye, EyeOff, CheckCircle, ShieldCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';

type Step = 'email' | 'code' | 'newPassword' | 'success';

export default function ForgotPasswordScreen() {
  console.log('[ForgotPassword] Screen initialized');
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    recoverPassword, resetPassword, recoverPending, recoverError, recoverSuccess,
    recoverData, resetPending, resetError, resetSuccess, resetRecoverMutation, resetResetMutation,
  } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  const animateTransition = useCallback(() => {
    fadeAnim.setValue(0); slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  useEffect(() => {
    if (recoverSuccess && recoverData) {
      setGeneratedCode(recoverData.code); setStep('code'); animateTransition();
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [recoverSuccess, recoverData, animateTransition]);

  useEffect(() => {
    if (resetSuccess) {
      setStep('success'); animateTransition();
      Animated.spring(successScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }).start();
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [resetSuccess, animateTransition, successScale]);

  const handleSendCode = useCallback(() => {
    setLocalError(null); resetRecoverMutation.reset();
    if (!email.trim()) { setLocalError('Digite seu e-mail'); triggerShake(); if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    recoverPassword(email.trim());
  }, [email, recoverPassword, triggerShake, resetRecoverMutation]);

  const handleVerifyCode = useCallback(() => {
    setLocalError(null);
    if (!code.trim() || code.length !== 6) { setLocalError('Digite o código de 6 dígitos'); triggerShake(); return; }
    if (code !== generatedCode) { setLocalError('Código inválido.'); triggerShake(); return; }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('newPassword'); animateTransition();
  }, [code, generatedCode, triggerShake, animateTransition]);

  const handleResetPassword = useCallback(() => {
    setLocalError(null); resetResetMutation.reset();
    if (!newPassword.trim() || newPassword.length < 6) { setLocalError('Senha deve ter no mínimo 6 caracteres'); triggerShake(); return; }
    if (newPassword !== confirmPassword) { setLocalError('As senhas não coincidem'); triggerShake(); return; }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resetPassword(email.trim(), code, newPassword);
  }, [newPassword, confirmPassword, email, code, resetPassword, triggerShake, resetResetMutation]);

  const displayError = localError || recoverError || resetError;

  const renderEmailStep = () => (
    <>
      <View style={s.iconWrap}><View style={s.iconCircle}><Mail size={28} color={Colors.dark.neonGreen} /></View></View>
      <Text style={s.stepTitle}>Recuperar Senha</Text>
      <Text style={s.stepDesc}>Digite o e-mail cadastrado na sua conta.</Text>
      <View style={s.inputWrap}><View style={s.inputIcon}><Mail size={18} color={Colors.dark.textMuted} /></View>
        <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="seu@email.com" placeholderTextColor={Colors.dark.textMuted} keyboardType="email-address" autoCapitalize="none" autoFocus testID="recover-email" />
      </View>
      {displayError && <View style={s.errorBox}><Text style={s.errorText}>{displayError}</Text></View>}
      <TouchableOpacity style={[s.actionBtn, recoverPending && s.actionBtnDisabled]} onPress={handleSendCode} activeOpacity={0.85} disabled={recoverPending} testID="send-code-btn">
        <LinearGradient colors={recoverPending ? [Colors.dark.textMuted, Colors.dark.textMuted] : [Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={s.actionGrad}>
          <Text style={s.actionText}>{recoverPending ? 'Enviando...' : 'ENVIAR CÓDIGO'}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </>
  );

  const renderCodeStep = () => (
    <>
      <View style={s.iconWrap}><View style={s.iconCircle}><KeyRound size={28} color={Colors.dark.neonGreen} /></View></View>
      <Text style={s.stepTitle}>Verificar Código</Text>
      <Text style={s.stepDesc}>Enviamos um código para{'\n'}<Text style={s.emailHighlight}>{email}</Text></Text>
      {generatedCode && <View style={s.codeDisplay}><ShieldCheck size={16} color={Colors.dark.success} /><Text style={s.codeDisplayText}>Seu código: <Text style={s.codeDisplayCode}>{generatedCode}</Text></Text></View>}
      <View style={s.inputWrap}><View style={s.inputIcon}><KeyRound size={18} color={Colors.dark.textMuted} /></View>
        <TextInput style={s.input} value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} placeholder="000000" placeholderTextColor={Colors.dark.textMuted} keyboardType="number-pad" maxLength={6} autoFocus testID="recover-code" />
      </View>
      {displayError && <View style={s.errorBox}><Text style={s.errorText}>{displayError}</Text></View>}
      <TouchableOpacity style={s.actionBtn} onPress={handleVerifyCode} activeOpacity={0.85} testID="verify-code-btn">
        <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={s.actionGrad}><Text style={s.actionText}>VERIFICAR</Text></LinearGradient>
      </TouchableOpacity>
      <TouchableOpacity style={s.resendBtn} onPress={handleSendCode} disabled={recoverPending}><Text style={s.resendText}>{recoverPending ? 'Reenviando...' : 'Reenviar código'}</Text></TouchableOpacity>
    </>
  );

  const renderNewPasswordStep = () => (
    <>
      <View style={s.iconWrap}><View style={s.iconCircle}><Lock size={28} color={Colors.dark.neonGreen} /></View></View>
      <Text style={s.stepTitle}>Nova Senha</Text>
      <Text style={s.stepDesc}>Crie uma nova senha com no mínimo 6 caracteres.</Text>
      <View style={s.inputWrap}><View style={s.inputIcon}><Lock size={18} color={Colors.dark.textMuted} /></View>
        <TextInput style={s.input} value={newPassword} onChangeText={setNewPassword} placeholder="Nova senha" placeholderTextColor={Colors.dark.textMuted} secureTextEntry={!showPassword} autoCapitalize="none" autoFocus testID="new-password" />
        <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword((p) => !p)}>{showPassword ? <EyeOff size={18} color={Colors.dark.textMuted} /> : <Eye size={18} color={Colors.dark.textMuted} />}</TouchableOpacity>
      </View>
      <View style={s.inputWrap}><View style={s.inputIcon}><Lock size={18} color={Colors.dark.textMuted} /></View>
        <TextInput style={s.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirmar nova senha" placeholderTextColor={Colors.dark.textMuted} secureTextEntry={!showPassword} autoCapitalize="none" testID="confirm-new-password" />
      </View>
      {displayError && <View style={s.errorBox}><Text style={s.errorText}>{displayError}</Text></View>}
      <TouchableOpacity style={[s.actionBtn, resetPending && s.actionBtnDisabled]} onPress={handleResetPassword} activeOpacity={0.85} disabled={resetPending} testID="reset-password-btn">
        <LinearGradient colors={resetPending ? [Colors.dark.textMuted, Colors.dark.textMuted] : [Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={s.actionGrad}>
          <Text style={s.actionText}>{resetPending ? 'Salvando...' : 'REDEFINIR SENHA'}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </>
  );

  const renderSuccessStep = () => (
    <>
      <Animated.View style={[s.iconWrap, { transform: [{ scale: successScale }] }]}><View style={[s.iconCircle, { backgroundColor: 'rgba(0,255,135,0.12)' }]}><CheckCircle size={32} color={Colors.dark.success} /></View></Animated.View>
      <Text style={s.stepTitle}>Senha Redefinida!</Text>
      <Text style={s.stepDesc}>Sua senha foi alterada com sucesso.</Text>
      <TouchableOpacity style={s.actionBtn} onPress={() => router.replace('/login')} activeOpacity={0.85} testID="go-login-btn">
        <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={s.actionGrad}><Text style={s.actionText}>IR PARA LOGIN</Text></LinearGradient>
      </TouchableOpacity>
    </>
  );

  const renderStep = () => {
    switch (step) {
      case 'email': return renderEmailStep();
      case 'code': return renderCodeStep();
      case 'newPassword': return renderNewPasswordStep();
      case 'success': return renderSuccessStep();
    }
  };

  const stepLabels: Record<Step, string> = { email: 'Etapa 1 de 3', code: 'Etapa 2 de 3', newPassword: 'Etapa 3 de 3', success: 'Concluído' };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.bgFill} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        <View style={s.topBar}>
          <TouchableOpacity style={s.backBtn} onPress={() => { if (step === 'code') { setStep('email'); setLocalError(null); animateTransition(); } else if (step === 'newPassword') { setStep('code'); setLocalError(null); animateTransition(); } else { router.back(); } }} activeOpacity={0.7}><ArrowLeft size={22} color={Colors.dark.text} /></TouchableOpacity>
          <Text style={s.stepLabel}>{stepLabels[step]}</Text>
          <View style={s.backBtn} />
        </View>
        {step !== 'success' && <View style={s.progressBar}><View style={s.progressTrack}><View style={[s.progressFill, { width: step === 'email' ? '33%' : step === 'code' ? '66%' : '100%' }]} /></View></View>}
        <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { translateX: shakeAnim }] }]}>{renderStep()}</Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  bgFill: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.dark.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.dark.cardBorder },
  stepLabel: { color: Colors.dark.textMuted, fontSize: 13, fontWeight: '600' as const },
  progressBar: { marginBottom: 28 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: Colors.dark.surfaceLight, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.dark.neonGreen, borderRadius: 2 },
  card: { backgroundColor: Colors.dark.surface, borderRadius: 24, padding: 28, borderWidth: 1, borderColor: Colors.dark.cardBorder, shadowColor: '#00FF87', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 4 },
  iconWrap: { alignItems: 'center', marginBottom: 20 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark.neonGreenFaint, borderWidth: 1, borderColor: Colors.dark.neonGreenBorder },
  stepTitle: { fontSize: 22, fontWeight: '800' as const, color: Colors.dark.text, textAlign: 'center' as const, marginBottom: 8 },
  stepDesc: { fontSize: 14, color: Colors.dark.textMuted, textAlign: 'center' as const, lineHeight: 20, marginBottom: 28 },
  emailHighlight: { color: Colors.dark.neonGreen, fontWeight: '700' as const },
  codeDisplay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(0,255,135,0.08)', borderRadius: 12, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: Colors.dark.neonGreenBorder },
  codeDisplayText: { color: Colors.dark.text, fontSize: 13, fontWeight: '500' as const },
  codeDisplayCode: { color: Colors.dark.success, fontSize: 18, fontWeight: '900' as const, letterSpacing: 3 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.inputBg, borderRadius: 14, borderWidth: 1, borderColor: Colors.dark.inputBorder, marginBottom: 14, overflow: 'hidden' },
  inputIcon: { paddingLeft: 14, paddingRight: 4 },
  input: { flex: 1, paddingVertical: 14, paddingHorizontal: 8, fontSize: 15, color: Colors.dark.text },
  eyeBtn: { padding: 14 },
  errorBox: { backgroundColor: 'rgba(255,71,87,0.1)', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,71,87,0.2)' },
  errorText: { color: '#FF4757', fontSize: 13, fontWeight: '500' as const, textAlign: 'center' as const },
  actionBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 6 },
  actionBtnDisabled: { opacity: 0.7 },
  actionGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  actionText: { color: '#000', fontSize: 15, fontWeight: '800' as const, letterSpacing: 0.5 },
  resendBtn: { alignItems: 'center', marginTop: 18 },
  resendText: { color: Colors.dark.neonGreen, fontSize: 13, fontWeight: '600' as const },
});
