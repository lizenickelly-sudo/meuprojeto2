import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { Camera, FileText, CheckCircle, Shield, Upload } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useUser } from '@/providers/UserProvider';

export default function IdentityVerifyScreen() {
  console.log("[IdentityVerify] Verification screen initialized");
  const router = useRouter();
  const { profile, saveProfile } = useUser();
  const [step, setStep] = useState<number>(0);
  const [selfieOk, setSelfieOk] = useState<boolean>(false);
  const [docOk, setDocOk] = useState<boolean>(false);

  const simulateSelfie = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelfieOk(true);
    setStep(1);
  }, []);

  const simulateDoc = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDocOk(true);
    setStep(2);
  }, []);

  const handleVerify = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    saveProfile({ ...profile, identityVerified: true, selfieUrl: 'verified', documentUrl: 'verified' });
    setStep(3);
  }, [profile, saveProfile]);

  if (step === 3) {
    return (
      <View style={v.ctr}>
        <Stack.Screen options={{ title: 'Verificacao' }} />
        <View style={v.successWrap}>
          <View style={v.successIcon}><CheckCircle size={72} color={Colors.dark.neonGreen} /></View>
          <Text style={v.successTtl}>Verificado!</Text>
          <Text style={v.successDesc}>Sua identidade foi verificada com sucesso. Agora voce pode realizar saques via PIX.</Text>
          <TouchableOpacity style={v.doneBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={v.doneBtnG}>
              <Text style={v.doneBtnT}>CONCLUIR</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={v.ctr}>
      <Stack.Screen options={{ title: 'Verificacao de Identidade' }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={v.sc}>
        <View style={v.headerCard}>
          <Shield size={32} color={Colors.dark.neonGreen} />
          <Text style={v.headerTtl}>Verificacao de Identidade</Text>
          <Text style={v.headerDesc}>Para sua seguranca, precisamos verificar sua identidade antes de permitir saques.</Text>
        </View>

        <View style={v.stepsRow}>
          {['Selfie', 'Documento', 'Confirmar'].map((label, i) => (
            <View key={label} style={v.stepItem}>
              <View style={[v.stepCircle, step >= i && v.stepCircleActive]}>
                <Text style={[v.stepNum, step >= i && v.stepNumActive]}>{i + 1}</Text>
              </View>
              <Text style={[v.stepLabel, step >= i && v.stepLabelActive]}>{label}</Text>
            </View>
          ))}
        </View>

        {step === 0 && (
          <View style={v.card}>
            <View style={v.cardIcon}><Camera size={40} color={Colors.dark.neonGreen} /></View>
            <Text style={v.cardTtl}>Tire uma selfie</Text>
            <Text style={v.cardDesc}>Posicione seu rosto centralizado na camera, em um ambiente bem iluminado.</Text>
            <TouchableOpacity style={v.actionBtn} onPress={simulateSelfie} activeOpacity={0.8} testID="selfie-btn">
              <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={v.actionBtnG}>
                <Camera size={18} color="#000" /><Text style={v.actionBtnT}>TIRAR SELFIE</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {step === 1 && (
          <View style={v.card}>
            <View style={v.cardIcon}><FileText size={40} color={Colors.dark.neonGreen} /></View>
            <Text style={v.cardTtl}>Envie seu documento</Text>
            <Text style={v.cardDesc}>Fotografe a frente do seu RG ou CNH. O documento deve estar legivel.</Text>
            <TouchableOpacity style={v.actionBtn} onPress={simulateDoc} activeOpacity={0.8} testID="doc-btn">
              <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={v.actionBtnG}>
                <Upload size={18} color="#000" /><Text style={v.actionBtnT}>ENVIAR DOCUMENTO</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={v.card}>
            <View style={v.confirmRow}>
              <View style={v.confirmItem}><CheckCircle size={24} color={Colors.dark.success} /><Text style={v.confirmTxt}>Selfie enviada</Text></View>
              <View style={v.confirmItem}><CheckCircle size={24} color={Colors.dark.success} /><Text style={v.confirmTxt}>Documento enviado</Text></View>
            </View>
            <Text style={v.cardDesc}>Revise e confirme o envio dos seus dados para verificacao.</Text>
            <TouchableOpacity style={v.actionBtn} onPress={handleVerify} activeOpacity={0.8} testID="verify-btn">
              <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={v.actionBtnG}>
                <Shield size={18} color="#000" /><Text style={v.actionBtnT}>VERIFICAR AGORA</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const v = StyleSheet.create({
  ctr: { flex: 1, backgroundColor: Colors.dark.background },
  sc: { paddingBottom: 20, paddingTop: 16 },
  headerCard: { alignItems: 'center', marginHorizontal: 16, marginBottom: 24, gap: 8 },
  headerTtl: { color: Colors.dark.text, fontSize: 22, fontWeight: '800' as const, textAlign: 'center' },
  headerDesc: { color: Colors.dark.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  stepsRow: { flexDirection: 'row', justifyContent: 'center', gap: 32, marginBottom: 28 },
  stepItem: { alignItems: 'center', gap: 6 },
  stepCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.dark.card, borderWidth: 2, borderColor: Colors.dark.cardBorder, alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: Colors.dark.neonGreenFaint, borderColor: Colors.dark.neonGreen },
  stepNum: { color: Colors.dark.textMuted, fontSize: 14, fontWeight: '800' as const },
  stepNumActive: { color: Colors.dark.neonGreen },
  stepLabel: { color: Colors.dark.textMuted, fontSize: 11, fontWeight: '600' as const },
  stepLabelActive: { color: Colors.dark.neonGreen },
  card: { marginHorizontal: 16, backgroundColor: Colors.dark.card, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.cardBorder },
  cardIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.dark.neonGreenFaint, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: Colors.dark.neonGreenBorder },
  cardTtl: { color: Colors.dark.text, fontSize: 20, fontWeight: '800' as const, marginBottom: 8 },
  cardDesc: { color: Colors.dark.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  actionBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', shadowColor: '#00FF87', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 },
  actionBtnG: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  actionBtnT: { color: '#000', fontSize: 15, fontWeight: '900' as const, letterSpacing: 0.5 },
  confirmRow: { gap: 12, marginBottom: 16, width: '100%' },
  confirmItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,255,135,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.dark.neonGreenBorder },
  confirmTxt: { color: Colors.dark.success, fontSize: 14, fontWeight: '600' as const },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  successIcon: { marginBottom: 20 },
  successTtl: { color: Colors.dark.neonGreen, fontSize: 28, fontWeight: '900' as const },
  successDesc: { color: Colors.dark.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 22 },
  doneBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginTop: 32 },
  doneBtnG: { paddingVertical: 16, alignItems: 'center' },
  doneBtnT: { color: '#000', fontSize: 16, fontWeight: '800' as const },
});
