import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform, KeyboardAvoidingView, Animated, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { DollarSign, CheckCircle, AlertTriangle, XCircle, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { formatPixKeyValue } from '@/lib/formatters';
import { hasPendingUserVerification, isUserVerificationApproved } from '@/lib/userVerification';
import { useUser } from '@/providers/UserProvider';

const WITHDRAW_THEME = {
  textPrimary: '#F8FAFC',
  textSecondary: 'rgba(226,232,240,0.84)',
  textMuted: 'rgba(226,232,240,0.62)',
  titleShadow: 'rgba(0,0,0,0.32)',
};

export default function WithdrawScreen() {
  console.log("[Withdraw] Withdraw screen initialized");
  const router = useRouter();
  const { balance, profile, withdraw, withdrawPending } = useUser();
  const [amount, setAmount] = useState<string>('');
  const [success, setSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorOpacity = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const isIdentityVerified = useMemo(() => isUserVerificationApproved(profile), [profile.isActive, profile.adminReviewStatus]);
  const hasPendingIdentityVerification = useMemo(() => hasPendingUserVerification(profile), [profile.isActive, profile.adminReviewStatus, profile.selfieUrl, profile.documentUrl, profile.cpf]);

  const pixKeyLabel = (type: string) => {
    const labels: Record<string, string> = { cpf: 'CPF', phone: 'Telefone', email: 'E-mail', random: 'Chave Aleatória' };
    return labels[type] ?? type;
  };

  const availableKeys = useMemo(() => {
    const keys: { type: string; value: string; label: string; displayValue: string }[] = [];
    if (profile.pixKeys && profile.pixKeys.length > 0) {
      profile.pixKeys.forEach((k) => keys.push({ type: k.type, value: k.value, label: pixKeyLabel(k.type), displayValue: formatPixKeyValue(k.type, k.value) }));
    } else {
      if (profile.pixCpf) keys.push({ type: 'cpf', value: profile.pixCpf, label: 'CPF', displayValue: formatPixKeyValue('cpf', profile.pixCpf) });
      if (profile.pixPhone) keys.push({ type: 'phone', value: profile.pixPhone, label: 'Telefone', displayValue: formatPixKeyValue('phone', profile.pixPhone) });
      if (profile.pixEmail) keys.push({ type: 'email', value: profile.pixEmail, label: 'E-mail', displayValue: formatPixKeyValue('email', profile.pixEmail) });
      if (profile.pixRandom) keys.push({ type: 'random', value: profile.pixRandom, label: 'Chave Aleatória', displayValue: formatPixKeyValue('random', profile.pixRandom) });
      if (profile.pixKey && keys.length === 0) keys.push({ type: profile.pixKeyType ?? 'random', value: profile.pixKey, label: pixKeyLabel(profile.pixKeyType ?? 'random'), displayValue: formatPixKeyValue(profile.pixKeyType ?? 'random', profile.pixKey) });
    }
    return keys;
  }, [profile]);

  const selectedPixKeyDisplay = useMemo(() => {
    const selected = availableKeys.find((key) => key.value === selectedPixKey);
    if (selected) return selected.displayValue;
    return formatPixKeyValue(profile.pixKeyType ?? 'random', selectedPixKey ?? profile.pixKey);
  }, [availableKeys, profile.pixKey, profile.pixKeyType, selectedPixKey]);

  const [selectedPixKey, setSelectedPixKey] = useState<string | null>(null);

  useEffect(() => {
    if (availableKeys.length > 0 && selectedPixKey === null) {
      setSelectedPixKey(availableKeys[0].value);
    }
  }, [availableKeys, selectedPixKey]);

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
    if (!selectedPixKey) { showError('Selecione uma chave PIX para sacar'); return; }
    if (!isIdentityVerified) { showError(hasPendingIdentityVerification ? 'Sua verificacao esta em analise. Aguarde a ativacao da conta pelo administrador.' : 'Verifique sua identidade e aguarde a ativacao da conta antes de sacar'); return; }
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    withdraw(val, selectedPixKey);
    setSuccess(true);
  }, [amount, balance, selectedPixKey, isIdentityVerified, hasPendingIdentityVerification, withdraw, showError, clearError]);

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
          <Text style={w.successPix}>Chave: {selectedPixKeyDisplay}</Text>
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
        <View style={w.hdr}>
          <Text style={w.ttl}>Sacar PIX</Text>
          <Text style={w.sub}>Transfira seu saldo para uma chave cadastrada</Text>
        </View>

        <View style={w.balCard}>
          <Text style={w.balLabel}>Saldo disponivel</Text>
          <Text style={w.balVal}>R$ {balance.toFixed(2)}</Text>
        </View>

        {!isIdentityVerified && (
          <View style={w.warnCard}>
            <AlertTriangle size={18} color={Colors.dark.warning} />
            <Text style={w.warnTxt}>{hasPendingIdentityVerification ? 'Seus documentos estao em analise. O saque sera liberado quando a conta for ativada.' : 'Verifique sua identidade no perfil e aguarde a ativacao da conta antes de sacar'}</Text>
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

        {isIdentityVerified ? (
          availableKeys.length > 0 ? (
            <View style={w.pixSection}>
              <Text style={w.pixSectionLabel}>Chave PIX para receber</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={w.pixKeyScroll} contentContainerStyle={w.pixKeyScrollContent}>
                {availableKeys.map((key) => {
                  const isSelected = selectedPixKey === key.value;
                  return (
                    <TouchableOpacity
                      key={key.value}
                      style={[w.pixKeyChip, isSelected && w.pixKeyChipSelected]}
                      onPress={() => setSelectedPixKey(key.value)}
                      activeOpacity={0.75}
                    >
                      <DollarSign size={13} color={isSelected ? '#000' : Colors.dark.neonGreen} />
                      <View>
                        <Text style={[w.pixKeyChipType, isSelected && w.pixKeyChipTypeSelected]}>{key.label}</Text>
                        <Text style={[w.pixKeyChipVal, isSelected && w.pixKeyChipValSelected]} numberOfLines={1}>{key.displayValue}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            <TouchableOpacity style={w.pixWarn} onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.8}>
              <AlertTriangle size={16} color={Colors.dark.warning} />
              <Text style={w.pixWarnTxt}>Nenhuma chave PIX cadastrada</Text>
              <View style={w.pixWarnAction}><Text style={w.pixWarnActionTxt}>Configurar no Perfil</Text><ChevronRight size={14} color={Colors.dark.neonGreen} /></View>
            </TouchableOpacity>
          )
        ) : (
          <View style={w.pixLockedCard}>
            <AlertTriangle size={16} color={Colors.dark.warning} />
            <Text style={w.pixLockedText}>{hasPendingIdentityVerification ? 'As chaves PIX ficarão disponíveis após a aprovação do administrador.' : 'As chaves PIX só aparecem depois que sua identidade for verificada e a conta for ativada.'}</Text>
          </View>
        )}

        {errorMsg && (
          <Animated.View style={[w.errorBanner, { opacity: errorOpacity, transform: [{ translateX: shakeAnim }] }]}>
            <XCircle size={18} color={Colors.dark.danger} />
            <Text style={w.errorTxt}>{errorMsg}</Text>
            <TouchableOpacity onPress={clearError} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><XCircle size={16} color={Colors.dark.textMuted} /></TouchableOpacity>
          </Animated.View>
        )}

        <TouchableOpacity
          style={[w.btn, (!selectedPixKey || !isIdentityVerified) && w.btnDisabled]}
          onPress={handleWithdraw} activeOpacity={0.8}
          disabled={withdrawPending || !selectedPixKey || !isIdentityVerified} testID="withdraw-btn"
        >
          <LinearGradient
            colors={(!selectedPixKey || !isIdentityVerified) ? [Colors.dark.textMuted, Colors.dark.textMuted] : [Colors.dark.neonGreen, Colors.dark.neonGreenDim]}
            style={w.btnG}
          >
            <DollarSign size={18} color={(!selectedPixKey || !isIdentityVerified) ? Colors.dark.background : '#000'} />
            <Text style={[w.btnT, (!selectedPixKey || !isIdentityVerified) && { color: Colors.dark.background }]}>
              {withdrawPending ? 'PROCESSANDO...' : 'SACAR VIA PIX'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const w = StyleSheet.create({
  ctr: { flex: 1, backgroundColor: 'transparent' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  hdr: { paddingBottom: 8 },
  ttl: { fontSize: 30, fontWeight: '900' as const, letterSpacing: 0.3, color: WITHDRAW_THEME.textPrimary, textShadowColor: WITHDRAW_THEME.titleShadow, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  sub: { fontSize: 14, color: WITHDRAW_THEME.textSecondary, fontWeight: '600' as const, marginTop: 2 },
  balCard: { alignItems: 'center', backgroundColor: Colors.dark.card, borderRadius: 18, padding: 24, borderWidth: 1, borderColor: Colors.dark.neonGreenBorder, marginBottom: 20 },
  balLabel: { color: Colors.dark.textSecondary, fontSize: 11, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  balVal: { color: Colors.dark.neonGreen, fontSize: 36, fontWeight: '900' as const, marginTop: 4 },
  warnCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,190,11,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,190,11,0.2)', marginBottom: 20 },
  warnTxt: { color: Colors.dark.warning, fontSize: 13, fontWeight: '600' as const, lineHeight: 19, flex: 1 },
  inputLabel: { color: WITHDRAW_THEME.textSecondary, fontSize: 11, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 8 },
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
  pixWarn: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, backgroundColor: 'rgba(255,190,11,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,190,11,0.2)', marginBottom: 24 },
  pixWarnTxt: { color: Colors.dark.warning, fontSize: 13, fontWeight: '600' as const, flex: 1 },
  pixWarnAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pixWarnActionTxt: { color: Colors.dark.neonGreen, fontSize: 12, fontWeight: '700' as const },
  pixLockedCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,190,11,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,190,11,0.2)', marginBottom: 24 },
  pixLockedText: { color: Colors.dark.warning, fontSize: 13, fontWeight: '600' as const, flex: 1 },
  pixSection: { marginBottom: 24 },
  pixSectionLabel: { color: WITHDRAW_THEME.textSecondary, fontSize: 11, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 10 },
  pixKeyScroll: { flexGrow: 0 },
  pixKeyScrollContent: { gap: 10, paddingRight: 4 },
  pixKeyChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.dark.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, borderColor: Colors.dark.neonGreenBorder },
  pixKeyChipSelected: { backgroundColor: Colors.dark.neonGreen, borderColor: Colors.dark.neonGreen },
  pixKeyChipType: { color: Colors.dark.neonGreen, fontSize: 11, fontWeight: '700' as const, textTransform: 'uppercase' as const },
  pixKeyChipTypeSelected: { color: '#000' },
  pixKeyChipVal: { color: Colors.dark.text, fontSize: 13, fontWeight: '600' as const, maxWidth: 160 },
  pixKeyChipValSelected: { color: '#000' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,71,87,0.1)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,71,87,0.25)', marginBottom: 16 },
  errorTxt: { color: Colors.dark.danger, fontSize: 13, fontWeight: '600' as const, flex: 1 },
  btn: { borderRadius: 14, overflow: 'hidden', shadowColor: '#00FF87', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 },
  btnDisabled: { opacity: 0.5 },
  btnG: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  btnT: { color: '#000', fontSize: 16, fontWeight: '900' as const, letterSpacing: 0.5 },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  successIcon: { marginBottom: 20 },
  successTtl: { color: Colors.dark.neonGreen, fontSize: 26, fontWeight: '900' as const, letterSpacing: 0.2 },
  successVal: { color: Colors.dark.text, fontSize: 40, fontWeight: '900' as const, marginTop: 8 },
  successDesc: { color: Colors.dark.textSecondary, fontSize: 14, fontWeight: '600' as const, textAlign: 'center', marginTop: 16, lineHeight: 20 },
  successPix: { color: Colors.dark.textMuted, fontSize: 12, fontWeight: '600' as const, marginTop: 8 },
  successBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginTop: 32 },
  successBtnG: { paddingVertical: 16, alignItems: 'center' },
  successBtnT: { color: '#000', fontSize: 16, fontWeight: '800' as const },
});
