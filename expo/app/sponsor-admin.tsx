import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle2, Clock3, LogOut, QrCode, ScanLine, ShieldCheck, TriangleAlert, Wallet } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useSponsor } from '@/providers/SponsorProvider';
import { useSponsorPortal } from '@/providers/SponsorPortalProvider';
import { formatPixKeyValue } from '@/lib/formatters';
import type { SponsorTicketRecord } from '@/types';

const PANEL_THEME = {
  textPrimary: '#F8FAFC',
  textSecondary: 'rgba(241,245,249,0.86)',
  textMuted: 'rgba(226,232,240,0.76)',
  titleShadow: 'rgba(0,0,0,0.32)',
};

const STATUS_META: Record<SponsorTicketRecord['status'], { label: string; color: string; bg: string }> = {
  available: { label: 'Disponivel', color: Colors.dark.textMuted, bg: 'rgba(148,163,184,0.12)' },
  pending_payment: { label: 'Aguardando pagamento', color: Colors.dark.warning, bg: 'rgba(245,158,11,0.12)' },
  paid: { label: 'Pago', color: Colors.dark.success, bg: 'rgba(16,185,129,0.12)' },
  refused: { label: 'Recusado', color: Colors.dark.danger, bg: 'rgba(239,68,68,0.12)' },
};

function StatusBadge({ status }: { status: SponsorTicketRecord['status'] }) {
  const meta = STATUS_META[status];
  return (
    <View style={[s.statusBadge, { backgroundColor: meta.bg }]}>
      <Text style={[s.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <View style={s.summaryCard}>
      <View style={[s.summaryIcon, { backgroundColor: `${color}1A` }]}>
        <Icon size={18} color={color} />
      </View>
      <Text style={s.summaryValue}>{value}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
    </View>
  );
}

export default function SponsorAdminScreen() {
  const { sponsorId } = useLocalSearchParams<{ sponsorId?: string }>();
  const { sponsors } = useSponsor();
  const {
    isSponsorLoggedIn,
    currentSponsor,
    sponsorTickets,
    login,
    logout,
    registerTicketFromQr,
    markTicketPaid,
  } = useSponsorPortal();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [manualPayload, setManualPayload] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [loginPending, setLoginPending] = useState<boolean>(false);
  const [scanLocked, setScanLocked] = useState<boolean>(false);
  const [payingTicketId, setPayingTicketId] = useState<string>('');

  const requestedSponsor = useMemo(() => {
    if (!sponsorId) return null;
    return sponsors.find((item) => item.id === sponsorId) ?? null;
  }, [sponsorId, sponsors]);

  const visibleTickets = useMemo(() => sponsorTickets.slice().sort((left, right) => {
    const leftDate = left.paymentRequestedAt || left.registeredAt || left.createdAt;
    const rightDate = right.paymentRequestedAt || right.registeredAt || right.createdAt;
    return new Date(rightDate).getTime() - new Date(leftDate).getTime();
  }), [sponsorTickets]);

  const pendingTickets = useMemo(() => visibleTickets.filter((ticket) => ticket.status === 'pending_payment'), [visibleTickets]);
  const paidTickets = useMemo(() => visibleTickets.filter((ticket) => ticket.status === 'paid'), [visibleTickets]);
  const registeredTickets = useMemo(() => visibleTickets.filter((ticket) => Boolean(ticket.registeredAt)), [visibleTickets]);

  const handleLogin = useCallback(async () => {
    setLoginPending(true);
    setFeedback('');
    try {
      const result = await login(email, password);
      if (!result.ok) {
        setFeedback(result.message || 'Nao foi possivel entrar no painel do patrocinador.');
        return;
      }
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setPassword('');
      setFeedback('Acesso liberado para o patrocinador.');
    } finally {
      setLoginPending(false);
    }
  }, [email, login, password]);

  const handleRegisterPayload = useCallback(async (rawPayload: string) => {
    const normalized = rawPayload.trim();
    if (!normalized) return;
    const result = await registerTicketFromQr(normalized);
    setFeedback(result.message);
    if (result.ok) {
      setManualPayload('');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [registerTicketFromQr]);

  const handleBarcodeScanned = useCallback(async ({ data }: { data?: string }) => {
    if (!data || scanLocked) return;
    setScanLocked(true);
    try {
      let normalized = data;
      try {
        normalized = decodeURIComponent(data);
      } catch {
        normalized = data;
      }
      await handleRegisterPayload(normalized);
    } finally {
      setTimeout(() => setScanLocked(false), 1200);
    }
  }, [handleRegisterPayload, scanLocked]);

  const handlePayTicket = useCallback(async (ticket: SponsorTicketRecord) => {
    if (!ticket.customerPixKey) {
      Alert.alert('PIX nao encontrado', 'Este cliente ainda nao informou uma chave PIX para receber.');
      return;
    }

    setPayingTicketId(ticket.id);
    try {
      await markTicketPaid(ticket.id);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert('Bilhete pago', 'Este bilhete foi pago pelo patrocinador.');
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel marcar o bilhete como pago.');
    } finally {
      setPayingTicketId('');
    }
  }, [markTicketPaid]);

  const handleRequestPermission = useCallback(async () => {
    await requestCameraPermission();
  }, [requestCameraPermission]);

  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: 'Painel do Patrocinador', presentation: 'modal' }} />

      {!isSponsorLoggedIn ? (
        <ScrollView contentContainerStyle={s.loginScroll} keyboardShouldPersistTaps="handled">
          <View style={s.heroCard}>
            <View style={s.heroIconWrap}>
              <ShieldCheck size={28} color={Colors.dark.primary} />
            </View>
            <Text style={s.heroEyebrow}>Acesso da loja</Text>
            <Text style={s.heroTitle}>Painel do Patrocinador</Text>
            <Text style={s.heroSubtitle}>
              {requestedSponsor
                ? `Acesse a area da loja ${requestedSponsor.name} com o e-mail e a senha definidos no admin principal.`
                : 'Acesse com o e-mail e a senha configurados no admin principal para escanear bilhetes e confirmar pagamentos.'}
            </Text>
          </View>

          <View style={s.formCard}>
            <Text style={s.label}>E-mail do patrocinador</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="loja@empresa.com"
              placeholderTextColor={Colors.dark.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={s.label}>Senha</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Senha do painel"
              placeholderTextColor={Colors.dark.textMuted}
              secureTextEntry
            />

            {feedback ? <Text style={s.feedbackText}>{feedback}</Text> : null}

            <TouchableOpacity style={s.loginButton} onPress={handleLogin} activeOpacity={0.8} disabled={loginPending}>
              <LinearGradient colors={[Colors.dark.primary, Colors.dark.primaryDim]} style={s.loginButtonGradient}>
                <ShieldCheck size={18} color="#000" />
                <Text style={s.loginButtonText}>{loginPending ? 'ENTRANDO...' : 'ENTRAR NO PAINEL'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.panelScroll} keyboardShouldPersistTaps="handled">
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.panelEyebrow}>Painel do patrocinador</Text>
              <Text style={s.panelTitle}>{currentSponsor?.name || 'Patrocinador'}</Text>
              <Text style={s.panelSubtitle}>Bilhetes da loja, pagamentos pendentes e QR codes do admin principal.</Text>
            </View>
            <TouchableOpacity style={s.logoutButton} onPress={logout} activeOpacity={0.8}>
              <LogOut size={16} color={Colors.dark.text} />
              <Text style={s.logoutButtonText}>Sair</Text>
            </TouchableOpacity>
          </View>

          <View style={s.summaryRow}>
            <SummaryCard label="Salvos" value={registeredTickets.length.toString()} icon={QrCode} color={Colors.dark.primary} />
            <SummaryCard label="Pendentes" value={pendingTickets.length.toString()} icon={Clock3} color={Colors.dark.warning} />
            <SummaryCard label="Pagos" value={paidTickets.length.toString()} icon={CheckCircle2} color={Colors.dark.success} />
          </View>

          <View style={s.sectionCard}>
            <Text style={s.sectionTitle}>Escanear e Salvar QR do Admin</Text>
            <Text style={s.sectionSubtitle}>Escaneie ou cole o QR gerado no admin principal para registrar o bilhete neste patrocinador.</Text>

            {Platform.OS === 'web' ? (
              <View style={s.webHintCard}>
                <ScanLine size={18} color={Colors.dark.primary} />
                <Text style={s.webHintText}>No web, cole abaixo o JSON do QR para salvar o bilhete.</Text>
              </View>
            ) : !cameraPermission?.granted ? (
              <TouchableOpacity style={s.permissionButton} onPress={handleRequestPermission} activeOpacity={0.8}>
                <ScanLine size={18} color={Colors.dark.primary} />
                <Text style={s.permissionButtonText}>Permitir camera para escanear QR</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.cameraCard}>
                <CameraView
                  style={s.camera}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={scanLocked ? undefined : handleBarcodeScanned}
                />
                <View style={s.cameraOverlay}>
                  <View style={s.scanFrame} />
                  <Text style={s.cameraHelp}>{scanLocked ? 'Bilhete lido. Aguarde...' : 'Aponte para o QR do bilhete'}</Text>
                </View>
              </View>
            )}

            <TextInput
              style={[s.input, s.payloadInput]}
              value={manualPayload}
              onChangeText={setManualPayload}
              placeholder='Cole aqui o JSON do QR gerado no admin principal'
              placeholderTextColor={Colors.dark.textMuted}
              multiline
            />

            <TouchableOpacity style={s.secondaryButton} onPress={() => handleRegisterPayload(manualPayload)} activeOpacity={0.8}>
              <Text style={s.secondaryButtonText}>Salvar bilhete no painel</Text>
            </TouchableOpacity>

            {feedback ? <Text style={s.feedbackText}>{feedback}</Text> : null}
          </View>

          <View style={s.sectionCard}>
            <Text style={s.sectionTitle}>Bilhetes aguardando pagamento</Text>
            <Text style={s.sectionSubtitle}>Quando o cliente escaneia um bilhete, o PIX dele aparece aqui para o patrocinador pagar.</Text>

            {pendingTickets.length === 0 ? (
              <View style={s.emptyState}>
                <Wallet size={24} color={Colors.dark.textMuted} />
                <Text style={s.emptyStateText}>Nenhum bilhete aguardando pagamento.</Text>
              </View>
            ) : (
              pendingTickets.map((ticket) => (
                <View key={ticket.id} style={s.ticketCard}>
                  <View style={s.ticketTopRow}>
                    <Text style={s.ticketCode}>{ticket.code}</Text>
                    <StatusBadge status={ticket.status} />
                  </View>
                  <Text style={s.ticketMeta}>PIX do cliente: {ticket.customerPixKey ? formatPixKeyValue(ticket.customerPixKeyType || 'random', ticket.customerPixKey) : 'Nao informado'}</Text>
                  <Text style={s.ticketMeta}>Cliente: {ticket.customerName || ticket.customerEmail || 'Nao informado'}</Text>
                  <Text style={s.ticketMeta}>Valor: R$ {ticket.value.toFixed(2)}</Text>
                  <TouchableOpacity
                    style={[s.payButton, payingTicketId === ticket.id && s.payButtonDisabled]}
                    onPress={() => handlePayTicket(ticket)}
                    disabled={payingTicketId === ticket.id}
                    activeOpacity={0.8}
                  >
                    <Text style={s.payButtonText}>{payingTicketId === ticket.id ? 'PAGANDO...' : 'Pagar bilhete'}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          <View style={s.sectionCard}>
            <Text style={s.sectionTitle}>Todos os bilhetes do patrocinador</Text>
            <Text style={s.sectionSubtitle}>Visao geral do que foi gerado no admin principal e do que ja foi pago ou nao.</Text>

            {visibleTickets.length === 0 ? (
              <View style={s.emptyState}>
                <TriangleAlert size={22} color={Colors.dark.textMuted} />
                <Text style={s.emptyStateText}>Nenhum bilhete disponivel para este patrocinador.</Text>
              </View>
            ) : (
              visibleTickets.map((ticket) => (
                <View key={ticket.id} style={s.compactTicketRow}>
                  <View style={{ flex: 1 }}>
                    <View style={s.ticketTopRow}>
                      <Text style={s.ticketCode}>{ticket.code}</Text>
                      <StatusBadge status={ticket.status} />
                    </View>
                    <Text style={s.ticketMeta}>Lote: {ticket.batchId}</Text>
                    <Text style={s.ticketMeta}>Criado em: {new Date(ticket.createdAt).toLocaleString('pt-BR')}</Text>
                    {ticket.paidAt ? <Text style={s.ticketMeta}>Pago em: {new Date(ticket.paidAt).toLocaleString('pt-BR')}</Text> : null}
                    {ticket.refusalReason ? <Text style={s.ticketWarning}>{ticket.refusalReason}</Text> : null}
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loginScroll: {
    padding: 20,
    gap: 16,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: 'rgba(7,11,22,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 10,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.dark.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: {
    color: PANEL_THEME.textMuted,
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: PANEL_THEME.textPrimary,
    fontSize: 26,
    fontWeight: '800' as const,
    letterSpacing: 0.3,
    textShadowColor: PANEL_THEME.titleShadow,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  heroSubtitle: {
    color: PANEL_THEME.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 19,
  },
  formCard: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: 'rgba(7,11,22,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  label: {
    color: PANEL_THEME.textMuted,
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: Colors.dark.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.inputBorder,
    color: PANEL_THEME.textPrimary,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  payloadInput: {
    minHeight: 96,
    textAlignVertical: 'top',
    marginTop: 14,
  },
  feedbackText: {
    color: Colors.dark.primary,
    fontSize: 13,
    fontWeight: '600' as const,
    marginTop: 12,
    lineHeight: 19,
  },
  loginButton: {
    marginTop: 16,
    borderRadius: 14,
    overflow: 'hidden',
  },
  loginButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  loginButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  panelScroll: {
    padding: 16,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  panelEyebrow: {
    color: PANEL_THEME.textMuted,
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  panelTitle: {
    color: PANEL_THEME.textPrimary,
    fontSize: 25,
    fontWeight: '900' as const,
    lineHeight: 28,
  },
  panelSubtitle: {
    color: PANEL_THEME.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
    marginTop: 4,
    lineHeight: 19,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  logoutButtonText: {
    color: PANEL_THEME.textPrimary,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(7,11,22,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  summaryValue: {
    color: PANEL_THEME.textPrimary,
    fontSize: 25,
    fontWeight: '900' as const,
    lineHeight: 28,
  },
  summaryLabel: {
    color: PANEL_THEME.textMuted,
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  sectionCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(7,11,22,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    color: PANEL_THEME.textPrimary,
    fontSize: 16,
    fontWeight: '800' as const,
    letterSpacing: 0.2,
  },
  sectionSubtitle: {
    color: PANEL_THEME.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
    marginTop: 6,
    lineHeight: 19,
  },
  webHintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.dark.primaryFaint,
    borderWidth: 1,
    borderColor: Colors.dark.neonGreenBorder,
    marginTop: 14,
  },
  webHintText: {
    flex: 1,
    color: Colors.dark.primary,
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 19,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.neonGreenBorder,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: Colors.dark.primary,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  cameraCard: {
    marginTop: 14,
    borderRadius: 18,
    overflow: 'hidden',
    height: 260,
    backgroundColor: '#020617',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2,6,23,0.16)',
  },
  scanFrame: {
    width: 180,
    height: 180,
    borderWidth: 2,
    borderColor: Colors.dark.primary,
    borderRadius: 22,
    backgroundColor: 'transparent',
  },
  cameraHelp: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
    marginTop: 18,
  },
  secondaryButton: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.neonGreenBorder,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.dark.primary,
    fontSize: 15,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  emptyStateText: {
    color: PANEL_THEME.textMuted,
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 19,
  },
  ticketCard: {
    marginTop: 14,
    borderRadius: 14,
    padding: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  compactTicketRow: {
    marginTop: 12,
    borderRadius: 14,
    padding: 14,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  ticketTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  ticketCode: {
    flex: 1,
    color: PANEL_THEME.textPrimary,
    fontSize: 15,
    fontWeight: '800' as const,
    letterSpacing: 0.2,
  },
  ticketMeta: {
    color: PANEL_THEME.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 19,
    marginTop: 6,
  },
  ticketWarning: {
    color: Colors.dark.warning,
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 8,
  },
  payButton: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: Colors.dark.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  payButtonDisabled: {
    opacity: 0.7,
  },
  payButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.6,
  },
});