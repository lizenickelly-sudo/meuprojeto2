import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Modal, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Wallet, ArrowUpRight, ArrowDownLeft, Star, DollarSign, Share2, Shield, Clock, X, FileText, CheckCircle, Gift, Lock, Copy, Users, Send, Ticket, Trash2, Hash } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import Colors from '@/constants/colors';
import { useUser } from '@/providers/UserProvider';
import { useCoupon } from '@/providers/CouponProvider';
import type { Transaction } from '@/types';

function ReceiptModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const isCr = tx.type === 'credit';
  const date = new Date(tx.date);
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
              {isCr ? '+' : '-'}R$ {tx.amount.toFixed(2)}
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
  const date = new Date(tx.date);
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
          {isCr ? '+' : '-'}R$ {tx.amount.toFixed(2)}
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
  const { balance, points, transactions, profile, redeemPoints, redeemPointsPending, getPointsRedeemInfo, referralCount, getReferralCode } = useUser();
  const { lotteryNumbers, clearLotteryNumbers } = useCoupon();
  const [copiedRef, setCopiedRef] = useState<boolean>(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const onRefresh = useCallback(() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1500); }, []);

  const handleWd = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/withdraw');
  }, [router]);

  const handleVerify = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/identity-verify');
  }, [router]);

  return (
    <View style={w.ctr}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[w.sc, { paddingTop: ins.top }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.dark.primary} colors={[Colors.dark.primary]} />}
      >
        <View style={w.hdr}><Text style={w.ttl}>Carteira</Text><Text style={w.sub}>Gerencie seu saldo e pontos</Text></View>
        <View style={w.balCard}>
          <LinearGradient colors={['#F97316', '#EA580C']} style={w.balOverlay}>
            <View style={w.balHdr}><Wallet size={20} color="#FFF" /><Text style={w.balLbl}>SALDO DISPONIVEL</Text></View>
            <Text style={w.balVal}>R$ {balance.toFixed(2)}</Text>
            <TouchableOpacity style={w.wdBtn} onPress={handleWd} activeOpacity={0.8} testID="wd-btn">
              <LinearGradient colors={['#FFFFFF', '#F3F4F6']} style={w.wdInner}>
                <DollarSign size={18} color="#F97316" /><Text style={w.wdTxt}>SACAR VIA PIX</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {!profile.identityVerified && (
          <TouchableOpacity style={w.verifyBanner} onPress={handleVerify} activeOpacity={0.8} testID="verify-banner">
            <Shield size={18} color={Colors.dark.warning} />
            <View style={w.verifyInfo}>
              <Text style={w.verifyTtl}>Verificacao Pendente</Text>
              <Text style={w.verifySub}>Verifique sua identidade para sacar</Text>
            </View>
            <View style={w.verifyBtn}><Text style={w.verifyBtnTxt}>Verificar</Text></View>
          </TouchableOpacity>
        )}

        {profile.identityVerified && (
          <View style={w.verifiedBanner}>
            <CheckCircle size={16} color={Colors.dark.success} />
            <Text style={w.verifiedTxt}>Identidade verificada</Text>
          </View>
        )}

        <View style={w.statsR}>
          <View style={w.stat}><Star size={20} color={Colors.dark.gold} /><Text style={w.stVal}>{points}</Text><Text style={w.stLbl}>Pontos</Text></View>
          <View style={w.stat}><Share2 size={20} color={Colors.dark.neonGreen} /><Text style={w.stVal}>{Math.floor(points / 10)}</Text><Text style={w.stLbl}>Compartilh.</Text></View>
          <TouchableOpacity
            style={[w.stat, w.statRedeemable, getPointsRedeemInfo().canRedeem && w.statCanRedeem]}
            onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); if (getPointsRedeemInfo().canRedeem) redeemPoints(); }}
            activeOpacity={0.7} disabled={redeemPointsPending} testID="redeem-pts-btn"
          >
            {getPointsRedeemInfo().canRedeem ? <Gift size={20} color={Colors.dark.success} /> : <Lock size={20} color={Colors.dark.warning} />}
            <Text style={[w.stVal, getPointsRedeemInfo().canRedeem && { color: Colors.dark.success }]}>R$ {(points * 0.1).toFixed(2)}</Text>
            {getPointsRedeemInfo().canRedeem ? (
              <Text style={[w.stLbl, { color: Colors.dark.success, fontWeight: '700' as const }]}>RESGATAR</Text>
            ) : (
              <Text style={[w.stLbl, { color: Colors.dark.warning, fontSize: 9 }]}>Falta R$ {getPointsRedeemInfo().remaining.toFixed(2)}</Text>
            )}
          </TouchableOpacity>
        </View>

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
                <View style={lt.numbersGrid}>
                  {lotteryNumbers.map((ln, idx) => (
                    <View key={ln.couponId} style={lt.numberItem}>
                      <View style={lt.numberBadge}>
                        <Text style={lt.numberText}>{ln.lotteryCode}</Text>
                      </View>
                      <Text style={lt.numberSponsor} numberOfLines={1}>{ln.sponsorName}</Text>
                      <Text style={lt.numberDate}>{new Date(ln.scannedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={lt.clearBtn}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    clearLotteryNumbers();
                  }}
                  activeOpacity={0.7}
                  testID="clear-lottery-btn"
                >
                  <Trash2 size={14} color={Colors.dark.danger} />
                  <Text style={lt.clearBtnTxt}>Limpar após sorteio realizado</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <View style={w.refSection}>
          <View style={w.refHeader}><Users size={18} color={Colors.dark.primary} /><Text style={w.refHeaderTitle}>Programa de Indicação</Text></View>
          <View style={w.refCard}>
            <View style={w.refTop}><Gift size={20} color={Colors.dark.primary} /><Text style={w.refTitle}>Convide amigos, ganhe pontos!</Text></View>
            <Text style={w.refDesc}>Compartilhe seu código e ganhe 50 pontos por cada amigo.</Text>
            <View style={w.refCodeRow}>
              <Text style={w.refCode}>{getReferralCode()}</Text>
              <TouchableOpacity style={w.refCopyBtn} onPress={async () => {
                const code = getReferralCode();
                if (Platform.OS !== 'web') { await Clipboard.setStringAsync(code); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }
                setCopiedRef(true); setTimeout(() => setCopiedRef(false), 2000);
              }}>
                {copiedRef ? <CheckCircle size={16} color={Colors.dark.success} /> : <Copy size={16} color={Colors.dark.primary} />}
                <Text style={[w.refCopyTxt, copiedRef && { color: Colors.dark.success }]}>{copiedRef ? 'Copiado!' : 'Copiar'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={w.shareBtn} onPress={async () => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              try { await Share.share({ message: `🎁 Use meu código ${getReferralCode()} no Caça ao Tesouro PIX!`, title: 'Caça ao Tesouro PIX' }); } catch {}
            }} activeOpacity={0.8} testID="share-referral-btn">
              <Send size={16} color="#FFF" /><Text style={w.shareBtnTxt}>COMPARTILHAR CÓDIGO</Text>
            </TouchableOpacity>
            <View style={w.refStats}>
              <View style={w.refStat}><Text style={w.refStatVal}>{referralCount}</Text><Text style={w.refStatLbl}>Indicações</Text></View>
              <View style={w.refStatDiv} />
              <View style={w.refStat}><Text style={w.refStatVal}>{referralCount * 50}</Text><Text style={w.refStatLbl}>Pontos ganhos</Text></View>
            </View>
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
    </View>
  );
}

const w = StyleSheet.create({
  ctr: { flex: 1, backgroundColor: Colors.dark.background },
  sc: { paddingBottom: 20 },
  hdr: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  ttl: { fontSize: 28, fontWeight: '800' as const, color: Colors.dark.text },
  sub: { fontSize: 13, color: Colors.dark.textSecondary, marginTop: 2 },
  balCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 20, overflow: 'hidden', shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 },
  balOverlay: { padding: 24, alignItems: 'center', borderRadius: 20 },
  balHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  balLbl: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' as const, letterSpacing: 1.5 },
  balVal: { color: '#fff', fontSize: 44, fontWeight: '900' as const, marginBottom: 20 },
  wdBtn: { width: '100%', borderRadius: 14, overflow: 'hidden' },
  wdInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  wdTxt: { color: '#F97316', fontSize: 15, fontWeight: '800' as const, letterSpacing: 0.5 },
  verifyBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, backgroundColor: 'rgba(255,190,11,0.08)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,190,11,0.2)', gap: 10 },
  verifyInfo: { flex: 1 },
  verifyTtl: { color: Colors.dark.warning, fontSize: 13, fontWeight: '700' as const },
  verifySub: { color: Colors.dark.textSecondary, fontSize: 11, marginTop: 1 },
  verifyBtn: { backgroundColor: Colors.dark.warning, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  verifyBtnTxt: { color: '#000', fontSize: 12, fontWeight: '700' as const },
  verifiedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.15)' },
  verifiedTxt: { color: Colors.dark.success, fontSize: 13, fontWeight: '600' as const },
  statsR: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginTop: 16 },
  stat: { flex: 1, backgroundColor: Colors.dark.card, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.cardBorder },
  statRedeemable: { borderColor: 'rgba(255,190,11,0.3)', backgroundColor: 'rgba(255,190,11,0.04)' },
  statCanRedeem: { borderColor: 'rgba(16,185,129,0.2)', backgroundColor: 'rgba(16,185,129,0.06)', shadowColor: '#10B981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6 },
  stVal: { color: Colors.dark.text, fontSize: 16, fontWeight: '800' as const, marginTop: 6 },
  stLbl: { color: Colors.dark.textSecondary, fontSize: 10, marginTop: 4, fontWeight: '500' as const, textAlign: 'center' },
  secHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 24, marginBottom: 12 },
  secTtl: { color: Colors.dark.text, fontSize: 17, fontWeight: '700' as const },
  txCount: { color: Colors.dark.textMuted, fontSize: 12 },
  txList: { paddingHorizontal: 16 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  eTtl: { color: Colors.dark.textSecondary, fontSize: 16, fontWeight: '600' as const },
  eSub: { color: Colors.dark.textMuted, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 },
  refSection: { marginHorizontal: 16, marginTop: 20 },
  refHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  refHeaderTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.dark.text },
  refCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(249,115,22,0.15)' },
  refTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  refTitle: { color: Colors.dark.text, fontSize: 14, fontWeight: '700' as const },
  refDesc: { color: Colors.dark.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  refCodeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.surfaceLight, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: Colors.dark.cardBorder, marginBottom: 12 },
  refCode: { flex: 1, color: Colors.dark.primary, fontSize: 16, fontWeight: '800' as const, letterSpacing: 1 },
  refCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.dark.primaryFaint },
  refCopyTxt: { color: Colors.dark.primary, fontSize: 12, fontWeight: '600' as const },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.dark.primary, borderRadius: 12, paddingVertical: 12, marginBottom: 12 },
  shareBtnTxt: { color: '#FFF', fontSize: 13, fontWeight: '800' as const, letterSpacing: 0.5 },
  refStats: { flexDirection: 'row', alignItems: 'center' },
  refStat: { flex: 1, alignItems: 'center' },
  refStatVal: { color: Colors.dark.primary, fontSize: 18, fontWeight: '800' as const },
  refStatLbl: { color: Colors.dark.textSecondary, fontSize: 10, marginTop: 2 },
  refStatDiv: { width: 1, height: 28, backgroundColor: Colors.dark.cardBorder },
});

const lt = StyleSheet.create({
  section: { marginHorizontal: 16, marginTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  headerTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.dark.text, flex: 1 },
  headerCount: { color: Colors.dark.textMuted, fontSize: 12, fontWeight: '500' as const },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(139,92,246,0.15)' },
  info: { color: Colors.dark.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  empty: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  emptyTitle: { color: Colors.dark.textSecondary, fontSize: 14, fontWeight: '600' as const },
  emptyDesc: { color: Colors.dark.textMuted, fontSize: 12, textAlign: 'center' as const, lineHeight: 18, paddingHorizontal: 10 },
  numbersGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  numberItem: { alignItems: 'center', width: 80 },
  numberBadge: { backgroundColor: 'rgba(139,92,246,0.1)', borderWidth: 1.5, borderColor: 'rgba(139,92,246,0.3)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, width: 80, alignItems: 'center' },
  numberText: { color: '#8B5CF6', fontSize: 18, fontWeight: '900' as const, letterSpacing: 2 },
  numberSponsor: { color: Colors.dark.textSecondary, fontSize: 9, fontWeight: '600' as const, marginTop: 4, textAlign: 'center' as const },
  numberDate: { color: Colors.dark.textMuted, fontSize: 9, marginTop: 1 },
  clearBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.12)' },
  clearBtnTxt: { color: Colors.dark.danger, fontSize: 12, fontWeight: '600' as const },
});
