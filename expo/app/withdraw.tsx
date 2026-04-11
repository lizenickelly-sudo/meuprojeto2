import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform, KeyboardAvoidingView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { DollarSign, CheckCircle, AlertTriangle, XCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useUser } from '@/providers/UserProvider';

export default function WithdrawScreen() {
  console.log("[Withdraw] Withdraw screen initialized");
  const router = useRouter();
  const { balance, profile, withdraw, withdrawPending } = useUser();
  const [amount, setAmount] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorOpacity = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.parallel([
      Animated.timing(errorOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]),
    ]).start();
  }, [errorOpacity, shakeAnim]);

  const clearError = useCallback(() => {
    Animated.timing(errorOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setErrorMsg(null));
  }, [errorOpacity]);

  useEffect(() => {
    if (errorMsg) { const timer = setTimeout(clearError, 4000); return () => clearTimeout(timer); }
  }, [errorMsg, clearError]);

  const handleWithdraw = useCallback(() => {
    clearError();
    const val = parseFloat(amount.replace(',', '.'));
    if (isNaN(val) || val <= 0) { showError('Informe um valor válido para saque'); return; }
    if (val < 1) { showError('O valor mínimo para saque é R$ 1,00'); return; }
    if (val > balance) { showError(`Saldo insuficiente. Seu saldo é R$ ${balance.toFixed(2)}`); return; }
    if (!profile.pixKey) { showError('Cadastre sua chave PIX no perfil antes de sacar'); return; }
    if (!profile.identityVerified) { showError('Verifique sua identidade antes de sacar'); return; }
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    withdraw(val);
    setSuccess(true);
  }, [amount, balance, profile, withdraw, showError, clearError]);

  const quickAmounts = [10, 25, 50, 100];

  if (success) {
    return (
      <View style={w.ctr}>
        <Stack.Screen options={{ title: 'Saque PIX' }} />
        <View style={w.successWrap}>
          <View style={w.successIcon}><CheckCircle size={64} color={Colors.dark.neonGreen} /></View>
          <Text style={w.successTtl}>Saque Solicitado!</Text>
          <Text style={w.successVal}>R$ {parseFloat(amount).toFixed(2)}</Text>
          <Text style={w.successDesc}>O PIX sera enviado para sua chave cadastrada em ate 24 horas.</Text>
          <Text style={w.successPix}>Chave: {profile.pixKey}</Text>
          <TouchableOpacity style={w.successBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={w.successBtnG}>
              <Text style={w.successBtnT}>VOLTAR</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={w.ctr} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Sacar PIX' }} />
      <View style={w.content}>
        <View style={w.balCard}>
          <Text style={w.balLabel}>Saldo disponivel</Text>
          <Text style={w.balVal}>R$ {balance.toFixed(2)}</Text>
        </View>

        {!profile.identityVerified && (
          <View style={w.warnCard}>
            <AlertTriangle size={18} color={Colors.dark.warning} />
            <Text style={w.warnTxt}>Verifique sua identidade no perfil antes de sacar</Text>
          </View>
        )}

        <Text style={w.inputLabel}>Valor do saque</Text>
        <View style={w.inputWrap}>
          <Text style={w.inputPrefix}>R$</Text>
          <TextInput style={w.input} value={amount} onChangeText={setAmount} placeholder="0,00" placeholderTextColor={Colors.dark.textMuted} keyboardType="numeric" testID="withdraw-amount" />
        </View>

        <View style={w.quickRow}>
          {quickAmounts.map((val) => (
            <TouchableOpacity key={val} style={[w.quickChip, parseFloat(amount) === val && w.quickChipOn]} onPress={() => setAmount(val.toString())}>
              <Text style={[w.quickTxt, parseFloat(amount) === val && w.quickTxtOn]}>R$ {val}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {profile.pixKey ? (
          <View style={w.pixInfo}><DollarSign size={16} color={Colors.dark.neonGreen} /><Text style={w.pixTxt}>PIX: {profile.pixKey}</Text></View>
        ) : (
          <View style={w.pixWarn}><Text style={w.pixWarnTxt}>Cadastre sua chave PIX no perfil</Text></View>
        )}

        {errorMsg && (
          <Animated.View style={[w.errorBanner, { opacity: errorOpacity, transform: [{ translateX: shakeAnim }] }]}>
            <XCircle size={18} color={Colors.dark.danger} />
            <Text style={w.errorTxt}>{errorMsg}</Text>
            <TouchableOpacity onPress={clearError} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><XCircle size={16} color={Colors.dark.textMuted} /></TouchableOpacity>
          </Animated.View>
        )}

        <TouchableOpacity
          style={[w.btn, (!profile.pixKey || !profile.identityVerified) && w.btnDisabled]}
          onPress={handleWithdraw} activeOpacity={0.8}
          disabled={withdrawPending || !profile.pixKey || !profile.identityVerified} testID="withdraw-btn"
        >
          <LinearGradient
            colors={(!profile.pixKey || !profile.identityVerified) ? [Colors.dark.textMuted, Colors.dark.textMuted] : [Colors.dark.neonGreen, Colors.dark.neonGreenDim]}
            style={w.btnG}
          >
            <DollarSign size={18} color={(!profile.pixKey || !profile.identityVerified) ? Colors.dark.background : '#000'} />
            <Text style={[w.btnT, (!profile.pixKey || !profile.identityVerified) && { color: Colors.dark.background }]}>
              {withdrawPending ? 'PROCESSANDO...' : 'SACAR VIA PIX'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const w = StyleSheet.create({
  ctr: { flex: 1, backgroundColor: Colors.dark.background },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  balCard: { alignItems: 'center', backgroundColor: Colors.dark.card, borderRadius: 18, padding: 24, borderWidth: 1, borderColor: Colors.dark.neonGreenBorder, marginBottom: 20 },
  balLabel: { color: Colors.dark.textMuted, fontSize: 13, fontWeight: '600' as const },
  balVal: { color: Colors.dark.neonGreen, fontSize: 36, fontWeight: '900' as const, marginTop: 4 },
  warnCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,190,11,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,190,11,0.2)', marginBottom: 20 },
  warnTxt: { color: Colors.dark.warning, fontSize: 13, flex: 1 },
  inputLabel: { color: Colors.dark.textSecondary, fontSize: 13, fontWeight: '600' as const, marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.card, borderRadius: 14, borderWidth: 1, borderColor: Colors.dark.neonGreenBorder, paddingHorizontal: 16 },
  inputPrefix: { color: Colors.dark.neonGreen, fontSize: 20, fontWeight: '800' as const, marginRight: 8 },
  input: { flex: 1, color: Colors.dark.text, fontSize: 24, fontWeight: '800' as const, paddingVertical: 16 },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 20 },
  quickChip: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.dark.card, alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.cardBorder },
  quickChipOn: { backgroundColor: Colors.dark.neonGreenFaint, borderColor: Colors.dark.neonGreen },
  quickTxt: { color: Colors.dark.textSecondary, fontSize: 13, fontWeight: '600' as const },
  quickTxtOn: { color: Colors.dark.neonGreen },
  pixInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.dark.neonGreenFaint, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.dark.neonGreenBorder, marginBottom: 24 },
  pixTxt: { color: Colors.dark.neonGreen, fontSize: 13, fontWeight: '600' as const },
  pixWarn: { backgroundColor: 'rgba(255,71,87,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,71,87,0.2)', marginBottom: 24, alignItems: 'center' },
  pixWarnTxt: { color: Colors.dark.danger, fontSize: 13, fontWeight: '600' as const },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,71,87,0.1)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,71,87,0.25)', marginBottom: 16 },
  errorTxt: { color: Colors.dark.danger, fontSize: 13, fontWeight: '600' as const, flex: 1 },
  btn: { borderRadius: 14, overflow: 'hidden', shadowColor: '#00FF87', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 },
  btnDisabled: { opacity: 0.5 },
  btnG: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  btnT: { color: '#000', fontSize: 16, fontWeight: '900' as const, letterSpacing: 0.5 },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  successIcon: { marginBottom: 20 },
  successTtl: { color: Colors.dark.neonGreen, fontSize: 24, fontWeight: '800' as const },
  successVal: { color: Colors.dark.text, fontSize: 40, fontWeight: '900' as const, marginTop: 8 },
  successDesc: { color: Colors.dark.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 16, lineHeight: 20 },
  successPix: { color: Colors.dark.textMuted, fontSize: 12, marginTop: 8 },
  successBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginTop: 32 },
  successBtnG: { paddingVertical: 16, alignItems: 'center' },
  successBtnT: { color: '#000', fontSize: 16, fontWeight: '800' as const },
});
