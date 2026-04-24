import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Platform, Modal, RefreshControl, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Wallet, ArrowUpRight, ArrowDownLeft, Star, Shield, Clock, X, FileText, CheckCircle, Copy, Users, Send, Ticket, Trash2, Hash, Edit3 } from 'lucide-react-native';
import Svg, { Defs, Ellipse, G, LinearGradient as SvgLinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '@/constants/colors';
import { useScrollToTopOnFocus } from '@/lib/useScrollToTopOnFocus';
import { hasPendingUserVerification, isUserVerificationApproved } from '@/lib/userVerification';
import { useUser } from '@/providers/UserProvider';
import { useCoupon } from '@/providers/CouponProvider';
import { useAdmin } from '@/providers/AdminProvider';
import type { Transaction } from '@/types';

const SHARED_PROMOTIONS_KEY = 'cashboxpix_shared_promotions';

const WALLET_THEME = {
  textPrimary: '#F8FAFC',
  textSecondary: 'rgba(226,232,240,0.84)',
  textMuted: 'rgba(226,232,240,0.62)',
  titleShadow: 'rgba(0,0,0,0.32)',
};

function getSafeAmount(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getSafeDate(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function BalanceCardBackground() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 340 200"
      preserveAspectRatio="xMidYMid slice"
      style={StyleSheet.absoluteFillObject}
    >
      <Defs>
        <SvgLinearGradient id="walletCardBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#FF2B1D" />
          <Stop offset="55%" stopColor="#F11710" />
          <Stop offset="100%" stopColor="#B80D0D" />
        </SvgLinearGradient>
        <SvgLinearGradient id="walletChipBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#FFF8BF" />
          <Stop offset="100%" stopColor="#D9A72F" />
        </SvgLinearGradient>
        <SvgLinearGradient id="walletHoloBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#DDE7F1" />
          <Stop offset="50%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#A7B6C6" />
        </SvgLinearGradient>
      </Defs>

      <Rect x="0" y="0" width="340" height="200" rx="24" fill="url(#walletCardBg)" />

      <G opacity={0.18}>
        {Array.from({ length: 18 }).map((_, index) => (
          <Rect
            key={`scan-${index}`}
            x="0"
            y={62 + index * 6}
            width="340"
            height="1.1"
            fill="#FFFFFF"
            opacity={index % 2 === 0 ? 0.18 : 0.1}
          />
        ))}
      </G>

      <G opacity={0.14} fill="#FFFFFF">
        <Ellipse cx="78" cy="38" rx="34" ry="12" />
        <Ellipse cx="118" cy="44" rx="18" ry="10" />
        <Ellipse cx="156" cy="35" rx="24" ry="9" />
        <Ellipse cx="206" cy="46" rx="60" ry="18" />
        <Ellipse cx="262" cy="44" rx="24" ry="10" />
      </G>

      <SvgText x="34" y="38" fill="#FFFFFF" fontSize="18" fontWeight="800">
        CreditCard
      </SvgText>
      <SvgText x="256" y="42" fill="#FFFFFF" fontSize="18" fontWeight="900">
        BANK
      </SvgText>

      <Rect x="34" y="68" width="44" height="30" rx="5" fill="url(#walletChipBg)" />
      <Path d="M49 68V98" stroke="rgba(150,93,18,0.45)" strokeWidth="1.2" />
      <Path d="M63 68V98" stroke="rgba(150,93,18,0.45)" strokeWidth="1.2" />
      <Path d="M34 83H78" stroke="rgba(150,93,18,0.45)" strokeWidth="1.2" />

      <G transform="translate(282 74)" fill="none" stroke="#FFFFFF" strokeLinecap="round" opacity={0.92}>
        <Path d="M0 10C5 13 5 21 0 24" strokeWidth="2.4" />
        <Path d="M8 4C16 11 16 23 8 30" strokeWidth="2.4" />
        <Path d="M16 -2C27 9 27 25 16 36" strokeWidth="2.4" />
      </G>

      <SvgText x="36" y="136" fill="#FFFFFF" fontSize="20" fontWeight="700" letterSpacing="3.2">
        1234 5678 9012 3456
      </SvgText>
      <SvgText x="36" y="154" fill="#FFE8E6" fontSize="10" fontWeight="700">
        0123
      </SvgText>
      <SvgText x="34" y="178" fill="#FFFFFF" fontSize="15" fontWeight="600" letterSpacing="1.2">
        Name Surname
      </SvgText>
      <SvgText x="176" y="170" fill="#FFE8E6" fontSize="7" fontWeight="700">
        VALID
      </SvgText>
      <SvgText x="176" y="179" fill="#FFE8E6" fontSize="7" fontWeight="700">
        THRU
      </SvgText>
      <SvgText x="210" y="178" fill="#FFFFFF" fontSize="17" fontWeight="700">
        09/28
      </SvgText>

      <Rect x="258" y="156" width="46" height="26" rx="4" fill="url(#walletHoloBg)" opacity={0.95} />
      <Ellipse cx="272" cy="169" rx="10" ry="6" fill="rgba(255,255,255,0.5)" />
      <Ellipse cx="289" cy="169" rx="8" ry="5" fill="rgba(154,169,191,0.65)" />
    </Svg>
  );
}

function ReceiptModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const isCr = tx.type === 'credit';
  const date = getSafeDate(tx.date);
  const amount = getSafeAmount(tx.amount);
  return (
    <Modal visible animationType="slide" transparent>
      <View style={r.overlay}>
        <View style={r.card}>
          <TouchableOpacity style={r.close} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={20} color={Colors.dark.textMuted} />
          </TouchableOpacity>
          <View style={r.header}>
            <View style={[r.icon, { backgroundColor: isCr ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }]}>
              {isCr ? <ArrowDownLeft size={28} color={Colors.dark.success} /> : <ArrowUpRight size={28} color={Colors.dark.danger} />}
            </View>
            <Text style={r.title}>{isCr ? 'Credito Recebido' : 'Saque PIX'}</Text>
            <Text style={[r.amount, { color: isCr ? Colors.dark.success : Colors.dark.danger }]}>
              {isCr ? '+' : '-'}R$ {amount.toFixed(2)}
            </Text>
          </View>
          <View style={r.divider} />
          <View style={r.details}>
            <View style={r.detailRow}><Text style={r.detailLabel}>Descricao</Text><Text style={r.detailValue}>{tx.description}</Text></View>
            <View style={r.detailRow}><Text style={r.detailLabel}>Data</Text><Text style={r.detailValue}>{date.toLocaleDateString('pt-BR')}</Text></View>
            <View style={r.detailRow}><Text style={r.detailLabel}>Hora</Text><Text style={r.detailValue}>{date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text></View>
            <View style={r.detailRow}>
              <Text style={r.detailLabel}>Status</Text>
              <View style={[r.statusBadge, { backgroundColor: tx.status === 'completed' ? 'rgba(0,255,135,0.1)' : tx.status === 'pending' ? 'rgba(255,190,11,0.1)' : 'rgba(255,71,87,0.1)' }]}>
                <View style={[r.statusDot, { backgroundColor: tx.status === 'completed' ? Colors.dark.success : tx.status === 'pending' ? Colors.dark.warning : Colors.dark.danger }]} />
                <Text style={[r.statusText, { color: tx.status === 'completed' ? Colors.dark.success : tx.status === 'pending' ? Colors.dark.warning : Colors.dark.danger }]}>
                  {tx.status === 'completed' ? 'Concluido' : tx.status === 'pending' ? 'Pendente' : 'Falhou'}
                </Text>
              </View>
            </View>
            {tx.pixKey && <View style={r.detailRow}><Text style={r.detailLabel}>Chave PIX</Text><Text style={r.detailValue}>{tx.pixKey}</Text></View>}
            <View style={r.detailRow}><Text style={r.detailLabel}>ID</Text><Text style={r.detailValueMono}>{tx.receiptId || tx.id}</Text></View>
          </View>
          <View style={r.secNote}>
            <Shield size={14} color={Colors.dark.success} />
            <Text style={r.secNoteTxt}>Comprovante protegido por Caca ao Tesouro PIX</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const r = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.dark.overlay, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 12, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  close: { position: 'absolute', top: 16, right: 16, zIndex: 5 },
  header: { alignItems: 'center', marginBottom: 20 },
  icon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: Colors.dark.textSecondary, fontSize: 14, fontWeight: '600' as const },
  amount: { fontSize: 32, fontWeight: '900' as const, marginTop: 4 },
  divider: { height: 1, backgroundColor: Colors.dark.cardBorder, marginBottom: 16 },
  details: { gap: 14 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { color: Colors.dark.textMuted, fontSize: 13, fontWeight: '500' as const },
  detailValue: { color: Colors.dark.text, fontSize: 13, fontWeight: '600' as const, textAlign: 'right', flex: 1, marginLeft: 16 },
  detailValueMono: { color: Colors.dark.textMuted, fontSize: 11, fontWeight: '500' as const },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' as const },
  secNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.15)' },
  secNoteTxt: { color: Colors.dark.textSecondary, fontSize: 11, flex: 1 },
});

function TxRow({ tx, onPress }: { tx: Transaction; onPress: () => void }) {
  const isCr = tx.type === 'credit';
  const isPt = tx.type === 'points';
  const date = getSafeDate(tx.date);
  const amount = getSafeAmount(tx.amount);
  return (
    <TouchableOpacity style={t.item} testID={`tx-${tx.id}`} onPress={onPress} activeOpacity={0.7}>
      <View style={[t.ic, { backgroundColor: isCr ? 'rgba(16,185,129,0.1)' : isPt ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)' }]}>
        {isCr ? <ArrowDownLeft size={18} color={Colors.dark.success} /> : isPt ? <Star size={18} color={Colors.dark.gold} /> : <ArrowUpRight size={18} color={Colors.dark.danger} />}
      </View>
      <View style={t.info}>
        <Text style={t.desc} numberOfLines={1}>{tx.description}</Text>
        <View style={t.metaRow}>
          <Clock size={10} color={Colors.dark.textMuted} />
          <Text style={t.dt}>{date.toLocaleDateString('pt-BR')} {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Text>
          <View style={[t.statusDot, { backgroundColor: tx.status === 'completed' ? Colors.dark.success : tx.status === 'pending' ? Colors.dark.warning : Colors.dark.danger }]} />
        </View>
      </View>
      <View style={t.right}>
        <Text style={[t.amt, { color: isCr ? Colors.dark.success : isPt ? Colors.dark.gold : Colors.dark.danger }]}>
          {isCr ? '+' : '-'}R$ {amount.toFixed(2)}
        </Text>
        <FileText size={12} color={Colors.dark.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const t = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.card, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  ic: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  info: { flex: 1 },
  desc: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' as const },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  dt: { color: Colors.dark.textMuted, fontSize: 10 },
  statusDot: { width: 5, height: 5, borderRadius: 3, marginLeft: 4 },
  right: { alignItems: 'flex-end', gap: 4 },
  amt: { fontSize: 15, fontWeight: '800' as const },
});

export default function WalletScreen() {
  console.log("[WalletScreen] Wallet screen initialized");
  const ins = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView | null>(null);
  const { balance, points, transactions, profile, referralCount, getReferralCode, addTransactionRaw } = useUser();
  const {
    lotteryNumbers,
    editLotteryNumbers,
    clearNonWinningCheckedTickets,
    federalLotteryResults,
    checkLotteryTicket,
    requestPrizeClaim,
    confirmPrizeClaim,
  } = useCoupon();
  const { addNotification, notifications, cityPrizes, grandPrizeConfig } = useAdmin();
  const [copiedRef, setCopiedRef] = useState<boolean>(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [showEditLottery, setShowEditLottery] = useState<boolean>(false);
  const [showLotteryResultsModal, setShowLotteryResultsModal] = useState<boolean>(false);
  const [editingNumbers, setEditingNumbers] = useState<string[]>([]);
  const [customLotteryNumber, setCustomLotteryNumber] = useState<string>('');
  const [selectedDrawId, setSelectedDrawId] = useState<string>('');
  const [sharedPromotions, setSharedPromotions] = useState<Array<{ id: string; title: string; likes: number; shares: number; sharedAt: string }>>([]);
  const isIdentityVerified = useMemo(() => isUserVerificationApproved(profile), [profile.isActive, profile.adminReviewStatus]);
  const hasPendingIdentityVerification = useMemo(() => hasPendingUserVerification(profile), [profile.isActive, profile.adminReviewStatus, profile.selfieUrl, profile.documentUrl, profile.cpf]);

  const currentCityPrize = profile.city ? cityPrizes[profile.city]?.value : undefined;
  const totalPrizeValue = useMemo(() => {
    if (typeof currentCityPrize === 'number' && Number.isFinite(currentCityPrize) && currentCityPrize > 0) return currentCityPrize;
    if (typeof grandPrizeConfig?.value === 'number' && Number.isFinite(grandPrizeConfig.value) && grandPrizeConfig.value > 0) return grandPrizeConfig.value;
    return 10000;
  }, [currentCityPrize, grandPrizeConfig?.value]);

  useScrollToTopOnFocus(scrollRef);

  const onRefresh = useCallback(() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1500); }, []);

  useEffect(() => {
    let mounted = true;
    const loadSharedPromotions = async () => {
      try {
        const stored = await AsyncStorage.getItem(SHARED_PROMOTIONS_KEY);
        if (stored && mounted) {
          const parsed = JSON.parse(stored) as unknown;
          if (!Array.isArray(parsed)) {
            setSharedPromotions([]);
            return;
          }
          setSharedPromotions(
            parsed
              .filter((item) => item && typeof item === 'object')
              .map((item) => {
                const share = item as { id?: unknown; title?: unknown; likes?: unknown; shares?: unknown; sharedAt?: unknown };
                return {
                  id: typeof share.id === 'string' ? share.id : `share_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  title: typeof share.title === 'string' ? share.title : 'Compartilhamento',
                  likes: typeof share.likes === 'number' && Number.isFinite(share.likes) ? share.likes : 0,
                  shares: typeof share.shares === 'number' && Number.isFinite(share.shares) ? share.shares : 1,
                  sharedAt: typeof share.sharedAt === 'string' ? share.sharedAt : new Date().toISOString(),
                };
              })
          );
        }
      } catch (error) {
        console.log('[Wallet] Failed to load shared promotions:', error);
      }
    };

    loadSharedPromotions();

    return () => {
      mounted = false;
    };
  }, [setSharedPromotions]);

  useEffect(() => {
    AsyncStorage.setItem(SHARED_PROMOTIONS_KEY, JSON.stringify(sharedPromotions)).catch((error) => {
      console.log('[Wallet] Failed to save shared promotions:', error);
    });
  }, [sharedPromotions]);

  useEffect(() => {
    if (!selectedDrawId && federalLotteryResults.length > 0) {
      setSelectedDrawId(federalLotteryResults[0].id);
    }
  }, [selectedDrawId, federalLotteryResults]);

  useEffect(() => {
    const targetEmail = profile.email.trim().toLowerCase();
    if (!targetEmail) return;

    notifications.forEach((notif) => {
      if (
        notif.metadata?.kind === 'lottery_claim' &&
        notif.metadata?.status === 'confirmed' &&
        notif.metadata?.userEmail?.toLowerCase() === targetEmail &&
        notif.metadata?.ticketId
      ) {
        confirmPrizeClaim(notif.metadata.ticketId);
      }
    });
  }, [notifications, profile.email, confirmPrizeClaim]);

  const handleWd = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/withdraw');
  }, [router]);

  const handleVerify = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/identity-verify');
  }, [router]);

  const handleSharePromotion = useCallback(async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (points < 10) {
        Alert.alert('Pontos insuficientes', 'Você precisa de 10 pontos para compartilhar');
        return;
      }
      const message = `🎁 Use meu código ${getReferralCode()} no Caça ao Tesouro PIX!`;
      await Share.share({ message, title: 'Caça ao Tesouro PIX' });
      const tx: Transaction = {
        id: `share_${Date.now()}`,
        type: 'debit',
        amount: 10,
        description: 'Compartilhamento de código de referência',
        date: new Date().toISOString(),
        status: 'completed',
        receiptId: `SHARE_${Date.now()}`,
      };
      await addTransactionRaw(tx);
      setSharedPromotions((current) => [
        {
          id: `share_${Date.now()}`,
          title: 'Código de Referência',
          likes: 0,
          shares: 1,
          sharedAt: new Date().toISOString(),
        },
        ...current,
      ]);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.log('[Wallet] Share error:', err);
    }
  }, [points, getReferralCode, addTransactionRaw, setSharedPromotions]);

  const handleEditLottery = useCallback(() => {
    setEditingNumbers([...lotteryNumbers.map(ln => ln.lotteryCode)]);
    setCustomLotteryNumber('');
    setShowEditLottery(true);
  }, [lotteryNumbers]);

  const handleAddCustomLotteryNumber = useCallback(() => {
    const normalized = customLotteryNumber.replace(/\D/g, '').slice(0, 5);
    if (normalized.length !== 5) {
      Alert.alert('Número inválido', 'Informe um número com 5 dígitos.');
      return;
    }
    if (editingNumbers.includes(normalized)) {
      Alert.alert('Número repetido', 'Esse número já está na sua lista.');
      return;
    }
    setEditingNumbers((current) => [...current, normalized]);
    setCustomLotteryNumber('');
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [customLotteryNumber, editingNumbers]);

  const handleSaveLottery = useCallback(() => {
    if (editingNumbers.length > 0) {
      editLotteryNumbers(editingNumbers);
      setShowEditLottery(false);
      setCustomLotteryNumber('');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Sucesso', 'Números atualizados com sucesso');
      return;
    }
    Alert.alert('Lista vazia', 'Adicione pelo menos um número para salvar.');
  }, [editingNumbers, editLotteryNumbers]);

  const handleClearCheckedNonWinners = useCallback(() => {
    clearNonWinningCheckedTickets();
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Limpeza concluída', 'Bilhetes conferidos e não premiados foram removidos.');
  }, [clearNonWinningCheckedTickets]);

  const handleRequestPrize = useCallback((ticketId: string, lotteryCode: string, drawId: string, amount: number) => {
    const normalizedEmail = profile.email.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert('Erro', 'Não foi possível identificar o e-mail do usuário para solicitar o prêmio.');
      return;
    }

    const existingClaim = notifications.find((notif) => (
      notif.metadata?.kind === 'lottery_claim' &&
      notif.metadata?.ticketId === ticketId &&
      notif.metadata?.status &&
      ['requested', 'confirmed'].includes(notif.metadata.status)
    ));

    if (existingClaim) {
      Alert.alert('Solicitação já enviada', 'Este bilhete já possui solicitação em andamento ou confirmada.');
      return;
    }

    requestPrizeClaim(ticketId);
    addNotification({
      id: `claim_${ticketId}_${Date.now()}`,
      title: 'Solicitação de prêmio - Loteria Federal',
      message: `Usuário ${profile.name || normalizedEmail} solicitou conferência do bilhete ${lotteryCode}. Valor estimado: R$ ${amount.toFixed(2)}.`,
      type: 'prize',
      createdAt: new Date().toISOString(),
      sent: false,
      metadata: {
        kind: 'lottery_claim',
        ticketId,
        drawId,
        lotteryCode,
        amount,
        userEmail: normalizedEmail,
        status: 'requested',
      },
    });

    Alert.alert('Solicitação enviada', 'O admin recebeu sua solicitação para conferência do prêmio.');
  }, [addNotification, notifications, profile.email, profile.name, requestPrizeClaim]);

  const handleCheckLotteryNumber = useCallback((ticketId: string, lotteryCode: string) => {
    if (!selectedDrawId) {
      Alert.alert('Selecione um resultado', 'Abra o popup de resultados e selecione um sorteio para conferir.');
      return;
    }

    const check = checkLotteryTicket(ticketId, selectedDrawId, totalPrizeValue);
    if (!check.ok) {
      Alert.alert('Erro', 'Não foi possível conferir este bilhete agora.');
      return;
    }

    if (check.status === 'still_competing') {
      Alert.alert('Conferência', 'Você ainda está concorrendo ao próximo sorteio.');
      return;
    }

    if (check.status === 'not_won') {
      Alert.alert('Conferência', 'Este número não foi sorteado.');
      return;
    }

    const prizeAmount = check.prizeAmount;
    if (check.status === 'claim_confirmed') {
      Alert.alert('Prêmio confirmado', `Parabéns! Seu prêmio de R$ ${prizeAmount.toFixed(2)} já foi conferido pelo admin.`);
      return;
    }

    if (check.status === 'claim_requested') {
      Alert.alert('Solicitação em análise', `Seu bilhete está premiado e a solicitação já foi enviada. Valor estimado: R$ ${prizeAmount.toFixed(2)}.`);
      return;
    }

    Alert.alert(
      'Bilhete premiado',
      `Parabéns, você ganhou R$ ${prizeAmount.toFixed(2)}.\n\nDivisão considerada entre ${check.winnersCount} bilhete(s) premiado(s).`,
      [
        { text: 'Agora não', style: 'cancel' },
        {
          text: 'Solicitar prêmio',
          onPress: () => handleRequestPrize(ticketId, lotteryCode, selectedDrawId, prizeAmount),
        },
      ],
    );
  }, [checkLotteryTicket, handleRequestPrize, selectedDrawId, totalPrizeValue]);

  return (
    <View style={w.ctr}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={[w.sc, { paddingTop: ins.top }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.dark.primary} colors={[Colors.dark.primary]} />}
      >
        <View style={w.hdr}><Text style={w.ttl}>Carteira</Text><Text style={w.sub}>Gerencie seu saldo e pontos</Text></View>
        <View style={w.balCard}>
          <View style={w.balOverlay}>
            <BalanceCardBackground />
            <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.22)']} style={w.balShade} />
            <View style={w.balContent}>
              <View style={w.balHdr}><Wallet size={20} color="#FFF" /></View>
              <Text style={w.balVal}>R$ {balance.toFixed(2)}</Text>
              <TouchableOpacity style={w.wdBtn} onPress={handleWd} activeOpacity={0.8} testID="wd-btn">
                <LinearGradient colors={['#FFFFFF', '#F3F4F6']} style={w.wdInner}>
                  <Text style={w.wdTxt}>Sacar</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {isIdentityVerified && (
          <View style={w.verifiedBanner}>
            <CheckCircle size={16} color={Colors.dark.success} />
            <Text style={w.verifiedTxt}>Identidade verificada</Text>
          </View>
        )}

        {!isIdentityVerified && !hasPendingIdentityVerification && (
          <View style={w.verifyBanner}>
            <Shield size={16} color={Colors.dark.warning} />
            <View style={w.verifyInfo}>
              <Text style={w.verifyTtl}>Verificação pendente</Text>
              <Text style={w.verifySub}>Verifique sua identidade para liberar a conta e os saques.</Text>
            </View>
            <TouchableOpacity style={w.verifyBtn} onPress={handleVerify} activeOpacity={0.8}>
              <Text style={w.verifyBtnTxt}>Verificar</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={lt.section}>
          <View style={lt.header}>
            <Ticket size={18} color="#8B5CF6" />
            <Text style={lt.headerTitle}>Números do Sorteio</Text>
            <Text style={lt.headerCount}>{lotteryNumbers.length} número{lotteryNumbers.length !== 1 ? 's' : ''}</Text>
          </View>
          <View style={lt.card}>
            {lotteryNumbers.length === 0 ? (
              <View style={lt.empty}>
                <Hash size={32} color={Colors.dark.textMuted} />
                <Text style={lt.emptyTitle}>Nenhum número ainda</Text>
                <Text style={lt.emptyDesc}>Escaneie cupons para receber números e participar do sorteio pela Loteria Federal</Text>
              </View>
            ) : (
              <>
                <Text style={lt.info}>Seus números para o próximo sorteio da Loteria Federal:</Text>
                <View style={lt.actionsRow}>
                  <TouchableOpacity style={lt.secondaryBtn} onPress={() => setShowLotteryResultsModal(true)} activeOpacity={0.8}>
                    <Text style={lt.secondaryBtnTxt}>Ver últimos resultados</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[lt.secondaryBtn, lt.clearBtn]} onPress={handleClearCheckedNonWinners} activeOpacity={0.8}>
                    <Text style={[lt.secondaryBtnTxt, lt.clearBtnTxt]}>Limpar números</Text>
                  </TouchableOpacity>
                </View>
                <View style={lt.numbersList}>
                  {lotteryNumbers.map((ln) => (
                    <TouchableOpacity
                      key={ln.couponId}
                      style={lt.numberItem}
                      activeOpacity={0.8}
                      onPress={() => handleCheckLotteryNumber(ln.couponId, ln.lotteryCode)}
                    >
                      <View style={lt.ticketHoleLeft} />
                      <View style={lt.ticketHoleRight} />
                      <View
                        style={[
                          lt.numberBadge,
                          ln.status === 'still_competing' && lt.numberBadgeCompeting,
                          ln.status === 'not_won' && lt.numberBadgeNotWon,
                          (ln.status === 'won_pending_claim' || ln.status === 'claim_requested' || ln.status === 'claim_confirmed') && lt.numberBadgeWon,
                        ]}
                      >
                        <Text
                          style={[lt.numberText, ln.status === 'claim_confirmed' && lt.numberTextClaimed]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}
                        >
                          {ln.lotteryCode}
                        </Text>
                      </View>
                      <View style={lt.ticketDivider} />
                      <View style={lt.numberMeta}>
                        <View style={lt.numberTopRow}>
                          <Text style={lt.numberSponsor} numberOfLines={1}>{ln.sponsorName}</Text>
                          <Text style={lt.numberDate}>{getSafeDate(ln.scannedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</Text>
                        </View>
                        {ln.status === 'not_won' && <Text style={lt.numberStatusNotWon}>Nao sorteado</Text>}
                        {ln.status === 'still_competing' && <Text style={lt.numberStatusCompeting}>Concorrendo</Text>}
                        {ln.status === 'won_pending_claim' && <Text style={lt.numberStatusWon}>Premiado</Text>}
                        {ln.status === 'claim_requested' && <Text style={lt.numberStatusRequested}>Em analise</Text>}
                        {ln.status === 'claim_confirmed' && <Text style={lt.numberStatusClaimed}>Premio pago</Text>}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>

        <View style={w.secHdr}>
          <Text style={w.secTtl}>Historico de Transacoes</Text>
          {transactions.length > 0 && <Text style={w.txCount}>{transactions.length} itens</Text>}
        </View>

        {transactions.length === 0 ? (
          <View style={w.empty}><Wallet size={48} color={Colors.dark.textMuted} /><Text style={w.eTtl}>Nenhuma transacao</Text><Text style={w.eSub}>Escaneie cupons para comecar!</Text></View>
        ) : (
          <View style={w.txList}>{transactions.map((tx) => <TxRow key={tx.id} tx={tx} onPress={() => setSelectedTx(tx)} />)}</View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
      {selectedTx && <ReceiptModal tx={selectedTx} onClose={() => setSelectedTx(null)} />}

      <Modal visible={showLotteryResultsModal} animationType="slide" transparent>
        <View style={lt.modalOverlay}>
          <View style={lt.modalContent}>
            <View style={lt.modalHeader}>
              <TouchableOpacity onPress={() => setShowLotteryResultsModal(false)}>
                <X size={24} color={Colors.dark.text} />
              </TouchableOpacity>
              <Text style={lt.modalTitle}>Últimos Resultados Federal</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView style={lt.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={lt.resultsObs}>
                Obs: nos resultados da Loteria Federal o usuário concorre do 1º ao 5º prêmio. Se houver mais de um ganhador, o prêmio é dividido em partes iguais.
              </Text>
              {federalLotteryResults.map((result) => (
                <TouchableOpacity
                  key={result.id}
                  style={[lt.resultCard, selectedDrawId === result.id && lt.resultCardActive]}
                  onPress={() => setSelectedDrawId(result.id)}
                  activeOpacity={0.8}
                >
                  <View style={lt.resultHeader}>
                    <Text style={lt.resultContest}>{result.contest}</Text>
                    <Text style={lt.resultDate}>{getSafeDate(result.drawDate).toLocaleDateString('pt-BR')}</Text>
                  </View>
                  <View style={lt.resultPrizes}>
                    {result.prizeNumbers.map((num, idx) => (
                      <View key={`${result.id}_${num}_${idx}`} style={lt.resultPrizeRow}>
                        <Text style={lt.resultPrizeLabel}>{idx + 1}º prêmio</Text>
                        <Text style={lt.resultPrizeValue}>{num}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showEditLottery} animationType="slide" transparent>
        <View style={lt.modalOverlay}>
          <View style={lt.modalContent}>
            <View style={lt.modalHeader}>
              <TouchableOpacity onPress={() => setShowEditLottery(false)}>
                <X size={24} color={Colors.dark.text} />
              </TouchableOpacity>
              <Text style={lt.modalTitle}>Personalizar Números</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView style={lt.modalBody} showsVerticalScrollIndicator={false}>
              <View style={lt.addRow}>
                <TextInput
                  value={customLotteryNumber}
                  onChangeText={(value) => setCustomLotteryNumber(value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="Digite 5 dígitos"
                  placeholderTextColor={Colors.dark.textMuted}
                  keyboardType="number-pad"
                  maxLength={5}
                  style={lt.input}
                />
                <TouchableOpacity style={lt.addBtn} onPress={handleAddCustomLotteryNumber} activeOpacity={0.8}>
                  <Text style={lt.addBtnTxt}>Adicionar</Text>
                </TouchableOpacity>
              </View>
              {editingNumbers.length === 0 ? (
                <View style={lt.emptyEditList}>
                  <Text style={lt.emptyEditTxt}>Nenhum número selecionado</Text>
                </View>
              ) : (
                <View style={lt.editList}>
                  {editingNumbers.map((num, idx) => (
                    <View key={idx} style={lt.editItem}>
                      <Text style={lt.editNum}>{num}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          const updated = editingNumbers.filter((_, i) => i !== idx);
                          setEditingNumbers(updated);
                          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <Trash2 size={18} color={Colors.dark.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
            <View style={lt.modalFooter}>
              <TouchableOpacity
                style={[lt.modalBtn, lt.modalBtnCancel]}
                onPress={() => setShowEditLottery(false)}
              >
                <Text style={lt.modalBtnTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[lt.modalBtn, lt.modalBtnSave]}
                onPress={handleSaveLottery}
              >
                <Text style={lt.modalBtnTxtSave}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const w = StyleSheet.create({
  ctr: { flex: 1, backgroundColor: 'transparent' },
  sc: { paddingBottom: 20 },
  hdr: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  ttl: { fontSize: 30, fontWeight: '900' as const, letterSpacing: 0.3, color: WALLET_THEME.textPrimary, textShadowColor: WALLET_THEME.titleShadow, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  sub: { fontSize: 14, color: WALLET_THEME.textSecondary, fontWeight: '600' as const, marginTop: 2 },
  balCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 20, overflow: 'hidden', shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 18, elevation: 10 },
  balOverlay: { position: 'relative', borderRadius: 20, overflow: 'hidden', minHeight: 206 },
  balShade: { ...StyleSheet.absoluteFillObject },
  balContent: { minHeight: 206, padding: 24, alignItems: 'center' },
  balHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  balLbl: { color: 'rgba(255,255,255,0.92)', fontSize: 12, fontWeight: '800' as const, letterSpacing: 1.8, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  balVal: { color: '#fff', fontSize: 44, fontWeight: '900' as const, marginBottom: 20, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  wdBtn: { position: 'absolute', right: 16, bottom: 16, borderRadius: 12, overflow: 'hidden' },
  wdInner: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 10 },
  wdTxt: { color: '#F97316', fontSize: 14, fontWeight: '800' as const, letterSpacing: 0.2 },
  verifyBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, backgroundColor: 'rgba(255,190,11,0.08)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,190,11,0.2)', gap: 10 },
  verifyInfo: { flex: 1 },
  verifyTtl: { color: Colors.dark.warning, fontSize: 14, fontWeight: '800' as const },
  verifySub: { color: Colors.dark.textSecondary, fontSize: 12, fontWeight: '600' as const, lineHeight: 18, marginTop: 3 },
  verifyBtn: { backgroundColor: Colors.dark.warning, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  verifyBtnTxt: { color: '#000', fontSize: 12, fontWeight: '700' as const },
  verifyBtnDisabled: { backgroundColor: 'rgba(245,158,11,0.18)' },
  verifyBtnTxtDisabled: { color: Colors.dark.warning },
  verifiedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.15)' },
  verifiedTxt: { color: Colors.dark.success, fontSize: 13, fontWeight: '600' as const },
  statsR: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginTop: 16 },
  stat: { flex: 1, backgroundColor: Colors.dark.card, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.cardBorder },
  statRedeemable: { borderColor: 'rgba(255,190,11,0.3)', backgroundColor: 'rgba(255,190,11,0.04)' },
  statCanRedeem: { borderColor: 'rgba(16,185,129,0.2)', backgroundColor: 'rgba(16,185,129,0.06)', shadowColor: '#10B981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6 },
  stVal: { color: Colors.dark.text, fontSize: 18, fontWeight: '900' as const, marginTop: 6 },
  stLbl: { color: Colors.dark.textSecondary, fontSize: 10, marginTop: 4, fontWeight: '700' as const, letterSpacing: 0.4, textAlign: 'center' },
  secHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 24, marginBottom: 12 },
  secTtl: { color: WALLET_THEME.textPrimary, fontSize: 18, fontWeight: '800' as const, letterSpacing: 0.2, textShadowColor: WALLET_THEME.titleShadow, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  txCount: { color: WALLET_THEME.textSecondary, fontSize: 12, fontWeight: '600' as const },
  txList: { paddingHorizontal: 16 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  eTtl: { color: WALLET_THEME.textPrimary, fontSize: 17, fontWeight: '700' as const },
  eSub: { color: WALLET_THEME.textSecondary, fontSize: 13, fontWeight: '600' as const, textAlign: 'center', paddingHorizontal: 40 },
  refSection: { marginHorizontal: 16, marginTop: 20 },
  refHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  refHeaderTitle: { fontSize: 16, fontWeight: '800' as const, letterSpacing: 0.2, color: WALLET_THEME.textPrimary, textShadowColor: WALLET_THEME.titleShadow, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  refCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(249,115,22,0.15)' },
  refTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  refTitle: { color: Colors.dark.text, fontSize: 15, fontWeight: '800' as const },
  refDesc: { color: Colors.dark.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  refCodeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.surfaceLight, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.dark.cardBorder, marginBottom: 12 },
  refCode: { flex: 1, color: Colors.dark.primary, fontSize: 16, fontWeight: '800' as const, letterSpacing: 1 },
  refCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.dark.primaryFaint },
  refCopyTxt: { color: Colors.dark.primary, fontSize: 12, fontWeight: '600' as const },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.dark.primary, borderRadius: 12, paddingVertical: 12, marginBottom: 12 },
  shareBtnTxt: { color: '#FFF', fontSize: 13, fontWeight: '800' as const, letterSpacing: 0.5 },
  refStats: { flexDirection: 'row', alignItems: 'center' },
  refStat: { flex: 1, alignItems: 'center' },
  refStatVal: { color: Colors.dark.primary, fontSize: 18, fontWeight: '800' as const },
  refStatLbl: { color: Colors.dark.textSecondary, fontSize: 11, marginTop: 2, fontWeight: '600' as const },
  refStatDiv: { width: 1, height: 28, backgroundColor: Colors.dark.cardBorder },
  sharesSection: { marginHorizontal: 16, marginTop: 20 },
  sharesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sharesTitle: { fontSize: 16, fontWeight: '800' as const, letterSpacing: 0.2, color: WALLET_THEME.textPrimary, textShadowColor: WALLET_THEME.titleShadow, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  sharesList: { gap: 10 },
  shareItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  shareInfo: { flex: 1 },
  shareTitle: { color: Colors.dark.text, fontSize: 14, fontWeight: '700' as const },
  shareDate: { color: Colors.dark.textMuted, fontSize: 11, fontWeight: '600' as const, marginTop: 2 },
  shareMeta: { color: Colors.dark.textSecondary, fontSize: 11, fontWeight: '600' as const, marginTop: 2 },
  shareL: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.15)' },
  shareLikeCount: { color: Colors.dark.danger, fontSize: 12, fontWeight: '600' as const },
});

const lt = StyleSheet.create({
  section: { marginHorizontal: 16, marginTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  headerTitle: { fontSize: 16, fontWeight: '800' as const, letterSpacing: 0.2, color: WALLET_THEME.textPrimary, textShadowColor: WALLET_THEME.titleShadow, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8, flex: 1 },
  headerCount: { color: WALLET_THEME.textSecondary, fontSize: 12, fontWeight: '600' as const },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(139,92,246,0.15)' },
  info: { color: Colors.dark.textSecondary, fontSize: 13, fontWeight: '500' as const, lineHeight: 19, marginBottom: 14 },
  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  secondaryBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingVertical: 9, backgroundColor: 'rgba(139,92,246,0.1)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)' },
  secondaryBtnTxt: { color: '#6D28D9', fontSize: 12, fontWeight: '700' as const },
  clearBtn: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.18)' },
  clearBtnTxt: { color: Colors.dark.danger },
  empty: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyTitle: { color: Colors.dark.text, fontSize: 15, fontWeight: '700' as const },
  emptyDesc: { color: Colors.dark.textSecondary, fontSize: 12, fontWeight: '500' as const, textAlign: 'center' as const, lineHeight: 18, paddingHorizontal: 10 },
  numbersList: { gap: 10 },
  numberItem: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.cardBorder, backgroundColor: Colors.dark.card, paddingVertical: 10, paddingHorizontal: 12, position: 'relative', overflow: 'hidden' },
  ticketHoleLeft: { position: 'absolute', left: -7, top: '50%', marginTop: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.dark.background },
  ticketHoleRight: { position: 'absolute', right: -7, top: '50%', marginTop: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.dark.background },
  numberBadge: { backgroundColor: 'rgba(139,92,246,0.1)', borderWidth: 1.5, borderColor: 'rgba(139,92,246,0.3)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, width: 104, alignItems: 'center' },
  ticketDivider: { width: 1, alignSelf: 'stretch', borderRightWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(148,163,184,0.45)' },
  numberBadgeCompeting: { backgroundColor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)' },
  numberBadgeNotWon: { backgroundColor: 'rgba(148,163,184,0.14)', borderColor: 'rgba(100,116,139,0.34)' },
  numberBadgeWon: { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.35)' },
  numberText: { color: '#8B5CF6', fontSize: 22, fontWeight: '900' as const, letterSpacing: 1, fontVariant: ['tabular-nums'] as const },
  numberTextClaimed: { textDecorationLine: 'line-through' as const, color: Colors.dark.success },
  numberMeta: { flex: 1 },
  numberTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  numberSponsor: { color: Colors.dark.text, fontSize: 12, fontWeight: '700' as const, flex: 1 },
  numberDate: { color: Colors.dark.textSecondary, fontSize: 11, fontWeight: '600' as const },
  numberStatusNotWon: { marginTop: 4, fontSize: 11, color: Colors.dark.danger, fontWeight: '700' as const },
  numberStatusCompeting: { marginTop: 4, fontSize: 11, color: '#2563EB', fontWeight: '700' as const },
  numberStatusWon: { marginTop: 4, fontSize: 11, color: Colors.dark.success, fontWeight: '700' as const },
  numberStatusRequested: { marginTop: 4, fontSize: 11, color: Colors.dark.warning, fontWeight: '700' as const },
  numberStatusClaimed: { marginTop: 4, fontSize: 11, color: Colors.dark.success, fontWeight: '700' as const },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(0,255,135,0.08)', borderWidth: 1, borderColor: 'rgba(0,255,135,0.15)' },
  editBtnTxt: { color: Colors.dark.neonGreen, fontSize: 12, fontWeight: '600' as const },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.dark.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingTop: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.dark.cardBorder },
  modalTitle: { fontSize: 19, fontWeight: '800' as const, color: Colors.dark.text },
  modalBody: { paddingHorizontal: 16, paddingVertical: 16, maxHeight: 300 },
  resultsObs: { color: Colors.dark.textSecondary, fontSize: 13, fontWeight: '500' as const, lineHeight: 19, marginBottom: 12 },
  resultCard: { backgroundColor: Colors.dark.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.dark.cardBorder, padding: 12, marginBottom: 10 },
  resultCardActive: { borderColor: Colors.dark.neonGreen, backgroundColor: 'rgba(16,185,129,0.08)' },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  resultContest: { color: Colors.dark.text, fontSize: 14, fontWeight: '800' as const },
  resultDate: { color: Colors.dark.textSecondary, fontSize: 11, fontWeight: '600' as const },
  resultPrizes: { gap: 6 },
  resultPrizeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultPrizeLabel: { color: Colors.dark.textSecondary, fontSize: 11, fontWeight: '600' as const },
  resultPrizeValue: { color: Colors.dark.gold, fontSize: 14, fontWeight: '800' as const, letterSpacing: 1.2 },
  addRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  input: { flex: 1, backgroundColor: Colors.dark.card, borderRadius: 10, borderWidth: 1, borderColor: Colors.dark.cardBorder, paddingHorizontal: 12, paddingVertical: 12, color: Colors.dark.text, fontSize: 14, fontWeight: '600' as const },
  addBtn: { backgroundColor: Colors.dark.primary, borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  addBtnTxt: { color: '#FFF', fontSize: 13, fontWeight: '700' as const },
  emptyEditList: { alignItems: 'center', paddingVertical: 40 },
  emptyEditTxt: { color: Colors.dark.textSecondary, fontSize: 13, fontWeight: '600' as const },
  editList: { gap: 8 },
  editItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.card, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  editNum: { flex: 1, color: Colors.dark.text, fontSize: 16, fontWeight: '700' as const, letterSpacing: 1 },
  modalFooter: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.dark.cardBorder },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalBtnCancel: { backgroundColor: Colors.dark.card, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  modalBtnSave: { backgroundColor: Colors.dark.neonGreen },
  modalBtnTxt: { fontSize: 14, fontWeight: '700' as const, color: Colors.dark.text },
  modalBtnTxtSave: { fontSize: 14, fontWeight: '700' as const, color: Colors.dark.background },
});
