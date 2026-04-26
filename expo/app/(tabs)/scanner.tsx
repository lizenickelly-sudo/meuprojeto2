import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated, ScrollView, Modal, Alert, RefreshControl, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { CheckCircle, XCircle, Clock, Camera, FlashlightOff, Flashlight, RefreshCw, ArrowRight, Wallet, DollarSign, Ticket, ScanLine, AlertTriangle, Gift, MapPin, Store, ShoppingBag, Settings } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Colors from '@/constants/colors';
import { useScrollToTopOnFocus } from '@/lib/useScrollToTopOnFocus';
import { useUser } from '@/providers/UserProvider';
import { useSponsor } from '@/providers/SponsorProvider';
import { useCoupon } from '@/providers/CouponProvider';
import { useAdmin } from '@/providers/AdminProvider';
import type { Coupon, PromotionalQR, CouponBatch } from '@/types';

console.log('[Scanner] expo-camera imported successfully');

const STATUS_CFG = {
  valid: { I: CheckCircle, c: Colors.dark.success, l: 'Ativo' },
  used: { I: Clock, c: Colors.dark.warning, l: 'Usado' },
  expired: { I: XCircle, c: Colors.dark.danger, l: 'Expirado' },
};

function CouponRow({ coupon }: { coupon: Coupon }) {
  const cfg = STATUS_CFG[coupon.status];
  return (
    <View style={cr.item} testID={`coupon-${coupon.id}`}>
      <View style={cr.iconWrap}>
        <DollarSign size={18} color={Colors.dark.primary} />
      </View>
      <View style={cr.info}>
        <Text style={cr.sp} numberOfLines={1}>{coupon.sponsorName}</Text>
        <Text style={cr.dt}>{new Date(coupon.scannedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
      <View style={cr.rt}>
        <Text style={[cr.val, { color: Colors.dark.primary }]}>R$ {coupon.value.toFixed(2)}</Text>
        <View style={[cr.badge, { borderColor: cfg.c }]}>
          <cfg.I size={10} color={cfg.c} />
          <Text style={[cr.badgeTxt, { color: cfg.c }]}>{cfg.l}</Text>
        </View>
      </View>
    </View>
  );
}

const cr = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(8,12,24,0.76)', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(249,115,22,0.16)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  info: { flex: 1 },
  sp: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' as const },
  dt: { color: 'rgba(226,232,240,0.72)', fontSize: 11, marginTop: 3 },
  rt: { alignItems: 'flex-end', gap: 6, marginLeft: 8 },
  val: { fontSize: 15, fontWeight: '800' as const },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  badgeTxt: { fontSize: 9, fontWeight: '600' as const },
});

function SimulatedScanner({ onScan }: { onScan: () => void }) {
  const sla = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(sla, { toValue: 1, duration: 2000, useNativeDriver: true }),
      Animated.timing(sla, { toValue: 0, duration: 2000, useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, []);

  const sly = sla.interpolate({ inputRange: [0, 1], outputRange: [-60, 60] });

  return (
    <TouchableOpacity style={sc.area} onPress={onScan} activeOpacity={0.8} testID="scan-area">
      <View style={sc.aGrad}>
        <View style={sc.frame}>
          <View style={[sc.corner, sc.cTL]} /><View style={[sc.corner, sc.cTR]} />
          <View style={[sc.corner, sc.cBL]} /><View style={[sc.corner, sc.cBR]} />
          <Animated.View style={[sc.line, { transform: [{ translateY: sly }] }]} />
          <Camera size={40} color={Colors.dark.neonGreen} style={{ opacity: 0.5 }} />
        </View>
        <Text style={sc.hint}>Toque para simular escaneamento</Text>
        <Text style={sc.hintS}>No dispositivo, a câmera será usada automaticamente</Text>
      </View>
    </TouchableOpacity>
  );
}

function NativeScanner({ onScan, isScanning }: { onScan: (data: string) => void; isScanning: boolean }) {
  const [torch, setTorch] = useState<boolean>(false);
  const [scanned, setScanned] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [cameraKey, setCameraKey] = useState<number>(0);
  const sla = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(sla, { toValue: 1, duration: 2000, useNativeDriver: true }),
      Animated.timing(sla, { toValue: 0, duration: 2000, useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, []);

  useEffect(() => {
    if (isScanning) {
      setScanned(false);
      setCameraReady(false);
    }
  }, [isScanning]);

  const handleBarcode = useCallback((result: any) => {
    if (scanned || !result) return;
    try {
      const data = result?.data ?? result?.nativeEvent?.data ?? '';
      if (!data) return;
      console.log('[Scanner] Barcode scanned:', data);
      setScanned(true);
      onScan(data);
    } catch (err) {
      console.log('[Scanner] Error processing barcode:', err);
    }
  }, [scanned, onScan]);

  const resetScan = useCallback(() => {
    setScanned(false);
  }, []);

  const retryCam = useCallback(() => {
    setCameraError(null);
    setCameraReady(false);
    setCameraKey(k => k + 1);
  }, []);

  const sly = sla.interpolate({ inputRange: [0, 1], outputRange: [-80, 80] });

  if (cameraError) {
    return (
      <View style={sc.permBox}>
        <AlertTriangle size={48} color={Colors.dark.warning} />
        <Text style={sc.permTitle}>Erro na Câmera</Text>
        <Text style={sc.permTxt}>{cameraError}</Text>
        <TouchableOpacity style={sc.permBtn} onPress={retryCam} testID="retry-camera">
          <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={sc.permBtnG}>
            <RefreshCw size={16} color="#000" />
            <Text style={sc.permBtnT}>TENTAR NOVAMENTE</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={cam.container}>
      <CameraView
        key={`cam-${cameraKey}`}
        style={cam.camera}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcode}
        onCameraReady={() => { console.log('[Scanner] Camera ready'); setCameraReady(true); }}
        onMountError={(event: any) => { console.log('[Scanner] Mount error:', event); setCameraError(event?.nativeEvent?.message ?? event?.message ?? 'Erro ao iniciar câmera'); }}
      />
      <View style={cam.overlay}>
        <View style={cam.overlayTop} />
        <View style={cam.overlayMiddle}>
          <View style={cam.overlaySide} />
          <View style={cam.scanArea}>
            <View style={[cam.corner, cam.cTL]} /><View style={[cam.corner, cam.cTR]} />
            <View style={[cam.corner, cam.cBL]} /><View style={[cam.corner, cam.cBR]} />
            {!scanned && <Animated.View style={[cam.scanLine, { transform: [{ translateY: sly }] }]} />}
          </View>
          <View style={cam.overlaySide} />
        </View>
        <View style={cam.overlayBottom}>
          {!cameraReady && !scanned && <Text style={cam.instructions}>Inicializando câmera...</Text>}
          {cameraReady && !scanned && <Text style={cam.instructions}>Aponte a câmera para o QR Code</Text>}
          {scanned && <Text style={cam.instructions}>QR Code escaneado!</Text>}
          <View style={cam.controls}>
            <TouchableOpacity style={cam.controlBtn} onPress={() => setTorch(t => !t)} testID="toggle-torch">
              {torch ? <Flashlight size={22} color={Colors.dark.neonGreen} /> : <FlashlightOff size={22} color="#fff" />}
              <Text style={[cam.controlTxt, torch && { color: Colors.dark.neonGreen }]}>{torch ? 'Desligar' : 'Lanterna'}</Text>
            </TouchableOpacity>
            {scanned && (
              <TouchableOpacity style={cam.controlBtn} onPress={resetScan} testID="reset-scan">
                <RefreshCw size={22} color="#fff" />
                <Text style={cam.controlTxt}>Escanear novamente</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

export default function ScannerScreen() {
  console.log("[ScannerScreen] Scanner screen initialized");
  const ins = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const { coupons, addCouponRaw, addScannedMessage, markCodeRedeemed, isCodeRedeemed } = useCoupon();
  const { sponsors: allSponsors } = useSponsor();
  const { addBalance, addTransaction } = useUser();
  const { promoQRCodes, couponBatches } = useAdmin();

  const addCoupon = useCallback((c: Coupon) => {
    addCouponRaw(c);
    addBalance(c.value);
    const tx = {
      id: `tx_${Date.now()}`,
      type: 'credit' as const,
      description: `Cupom ${c.sponsorName} - ${c.code}`,
      amount: c.value,
      date: new Date().toISOString(),
      status: 'completed' as const,
    };
    addTransaction(tx);
  }, [addCouponRaw, addBalance, addTransaction]);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [show, setShow] = useState<boolean>(false);
  const [showPromo, setShowPromo] = useState<boolean>(false);
  const [showError, setShowError] = useState<boolean>(false);
  const [errorInfo, setErrorInfo] = useState<{ title: string; message: string; type: 'duplicate' | 'invalid' | 'expired' }>({ title: '', message: '', type: 'invalid' });
  const [last, setLast] = useState<Coupon | null>(null);
  const [lastPromo, setLastPromo] = useState<PromotionalQR | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const sa = useRef(new Animated.Value(0)).current;
  const promoAnim = useRef(new Animated.Value(0)).current;
  const errorAnim = useRef(new Animated.Value(0)).current;

  const isNative = Platform.OS !== 'web';

  const handleRequestPermission = useCallback(async () => {
    try {
      console.log('[Scanner] Requesting camera permission...');
      const result = await requestCameraPermission();
      console.log('[Scanner] Permission result:', result);
      if (!result.granted && !result.canAskAgain) {
        Alert.alert('Permissão Necessária', 'Habilite nas configurações do dispositivo.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Configurações', onPress: () => Linking.openSettings() },
        ]);
      }
    } catch (err) {
      console.log('[Scanner] Permission request error:', err);
      Alert.alert('Erro', 'Não foi possível solicitar permissão da câmera.');
    }
  }, [requestCameraPermission]);

  const showPromoModal = useCallback((promo: PromotionalQR) => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLastPromo(promo);
    setShowPromo(true);
    setIsScanning(false);
    promoAnim.setValue(0);
    Animated.spring(promoAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    addScannedMessage({
      id: `msg_${Date.now()}`, code: promo.id, sponsorId: promo.sponsorId, sponsorName: promo.sponsorName,
      sponsorAddress: promo.sponsorAddress, backgroundImageUrl: promo.backgroundImageUrl, message: promo.message, couponValue: promo.couponValue,
      minPurchase: promo.minPurchase, scannedAt: new Date().toISOString(), status: 'pending',
    });
  }, [promoAnim, addScannedMessage]);

  const showErrorModal = useCallback((title: string, message: string, type: 'duplicate' | 'invalid' | 'expired') => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setErrorInfo({ title, message, type });
    setShowError(true);
    setIsScanning(false);
    errorAnim.setValue(0);
    Animated.spring(errorAnim, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [errorAnim]);

  const closeError = useCallback(() => { errorAnim.setValue(0); setShowError(false); setIsScanning(true); }, [errorAnim]);

  const validateRealCoupon = useCallback((parsed: { type: string; code: string; value: number; sponsorId?: string; sponsorName?: string; batchId?: string }) => {
    const code = parsed.code;
    if (isCodeRedeemed(code)) return { valid: false, errorTitle: 'Cupom Já Utilizado', errorMsg: `O código ${code} já foi escaneado.`, errorType: 'duplicate' as const };
    const existingCoupon = coupons.find((c) => c.code === code);
    if (existingCoupon) return { valid: false, errorTitle: 'Cupom Já Salvo', errorMsg: `Este cupom já está na sua conta.`, errorType: 'duplicate' as const };
    if (parsed.batchId) {
      const batch = couponBatches.find((b) => b.id === parsed.batchId);
      if (batch) {
        if (!batch.codes.includes(code)) return { valid: false, errorTitle: 'Cupom Inválido', errorMsg: 'Código não pertence ao lote.', errorType: 'invalid' as const };
        return { valid: true, batch };
      }
    }
    let matchedBatch: CouponBatch | undefined;
    for (const b of couponBatches) { if (b.codes.includes(code)) { matchedBatch = b; break; } }
    if (matchedBatch) return { valid: true, batch: matchedBatch };
    if (parsed.value > 0 && parsed.sponsorName) return { valid: true };
    return { valid: false, errorTitle: 'Cupom Não Encontrado', errorMsg: 'QR Code não corresponde a nenhum cupom válido.', errorType: 'invalid' as const };
  }, [isCodeRedeemed, coupons, couponBatches]);

  const processScannedCode = useCallback((rawData?: string) => {
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        if (parsed.type === 'cashbox_promo' && parsed.promoId) {
          const promo = promoQRCodes.find((p) => p.id === parsed.promoId && p.active);
          if (promo) { showPromoModal(promo); return; }
          const fallbackPromo: PromotionalQR = {
            id: parsed.promoId, sponsorId: parsed.sponsorId ?? '', sponsorName: parsed.sponsorName ?? 'Loja Parceira',
            sponsorAddress: parsed.sponsorAddress ?? '', backgroundImageUrl: parsed.backgroundImageUrl ?? '', city: parsed.city ?? '', state: parsed.state ?? '',
            message: parsed.message ?? '', couponValue: parsed.couponValue ?? 10, minPurchase: parsed.minPurchase ?? 100,
            createdAt: new Date().toISOString(), active: true,
          };
          showPromoModal(fallbackPromo);
          return;
        }
        if (parsed.type === 'cashbox_coupon' && parsed.code && parsed.value) {
          const validation = validateRealCoupon(parsed);
          if (!validation.valid) { showErrorModal(validation.errorTitle ?? 'Erro', validation.errorMsg ?? 'Cupom inválido.', validation.errorType ?? 'invalid'); return; }
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const coupon: Coupon = {
            id: `cpn_${Date.now()}`, code: parsed.code, value: parsed.value,
            sponsorId: parsed.sponsorId ?? validation.batch?.sponsorId ?? '', sponsorName: parsed.sponsorName ?? validation.batch?.sponsorName ?? '',
            status: 'valid', scannedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), drawId: `draw_${Date.now()}`,
          };
          markCodeRedeemed(parsed.code); addCoupon(coupon); setLast(coupon); setShow(true); setIsScanning(false);
          sa.setValue(0); Animated.spring(sa, { toValue: 1, friction: 4, useNativeDriver: true }).start();
          return;
        }
        showErrorModal('QR Code Desconhecido', 'Este QR Code não é do sistema CashBox PIX.', 'invalid');
        return;
      } catch {
        let matchedBatch: CouponBatch | undefined;
        for (const b of couponBatches) { if (b.codes.includes(rawData)) { matchedBatch = b; break; } }
        if (matchedBatch) {
          if (isCodeRedeemed(rawData)) { showErrorModal('Cupom Já Utilizado', `O código já foi escaneado.`, 'duplicate'); return; }
          if (coupons.find((c) => c.code === rawData)) { showErrorModal('Cupom Já Salvo', `Cupom já está na sua conta.`, 'duplicate'); return; }
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const coupon: Coupon = {
            id: `cpn_${Date.now()}`, code: rawData, value: matchedBatch.value, sponsorId: matchedBatch.sponsorId, sponsorName: matchedBatch.sponsorName,
            status: 'valid', scannedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), drawId: `draw_${Date.now()}`,
          };
          markCodeRedeemed(rawData); addCoupon(coupon); setLast(coupon); setShow(true); setIsScanning(false);
          sa.setValue(0); Animated.spring(sa, { toValue: 1, friction: 4, useNativeDriver: true }).start();
          return;
        }
        showErrorModal('QR Code Inválido', 'QR Code não reconhecido pelo sistema.', 'invalid');
        return;
      }
    }
    if (Platform.OS === 'web') {
      const sp = allSponsors[Math.floor(Math.random() * allSponsors.length)];
      const code = `PIX${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const value = sp?.couponValue ?? [5, 10, 15, 20, 25, 30][Math.floor(Math.random() * 6)];
      const coupon: Coupon = {
        id: `cpn_${Date.now()}`, code, value, sponsorId: sp?.id ?? 'unknown', sponsorName: sp?.name ?? 'Loja Parceira',
        status: 'valid', scannedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), drawId: `draw_${Date.now()}`,
      };
      addCoupon(coupon); setLast(coupon); setShow(true); setIsScanning(false);
      sa.setValue(0); Animated.spring(sa, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    }
  }, [addCoupon, sa, allSponsors, promoQRCodes, showPromoModal, validateRealCoupon, showErrorModal, markCodeRedeemed, couponBatches, isCodeRedeemed, coupons]);

  const handleBarcodeScan = useCallback((data: string) => {
    let decodedData = data;
    try { decodedData = decodeURIComponent(data); } catch { /* use raw */ }
    processScannedCode(decodedData);
  }, [processScannedCode]);

  const close = useCallback(() => { sa.setValue(0); setShow(false); setLast(null); setIsScanning(true); }, [sa]);
  const closePromo = useCallback(() => { promoAnim.setValue(0); setShowPromo(false); setLastPromo(null); setIsScanning(true); }, [promoAnim]);

  const renderScanner = () => {
    if (!isNative) return <SimulatedScanner onScan={() => processScannedCode()} />;
    if (!cameraPermission) return <View style={sc.permBox}><Camera size={48} color={Colors.dark.textMuted} /><Text style={sc.permTxt}>Carregando permissões...</Text></View>;
    if (!cameraPermission.granted) {
      return (
        <View style={sc.permBox}>
          <Camera size={48} color={Colors.dark.primary} />
          <Text style={sc.permTitle}>Acesso à Câmera</Text>
          <Text style={sc.permTxt}>Precisamos de acesso à câmera para escanear cupons PIX.</Text>
          <TouchableOpacity style={sc.permBtn} onPress={handleRequestPermission} testID="request-permission">
            <LinearGradient colors={[Colors.dark.primary, Colors.dark.primaryDim]} style={sc.permBtnG}>
              <Text style={sc.permBtnT}>PERMITIR CÂMERA</Text>
            </LinearGradient>
          </TouchableOpacity>
          {!cameraPermission.canAskAgain && (
            <TouchableOpacity style={sc.settingsBtn} onPress={() => Linking.openSettings()} testID="open-settings">
              <Settings size={16} color={Colors.dark.primary} />
              <Text style={sc.settingsBtnTxt}>Abrir Configurações</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={sc.simBtn} onPress={() => processScannedCode()} testID="simulate-scan">
            <Text style={sc.simBtnTxt}>Simular escaneamento (teste)</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return <NativeScanner onScan={handleBarcodeScan} isScanning={isScanning} />;
  };

  const recentCoupons = coupons.slice(0, 10);

  useScrollToTopOnFocus(scrollRef);

  return (
    <View style={sc.ctr}>
      <ScrollView ref={scrollRef} style={sc.scrollRoot} showsVerticalScrollIndicator={false} contentContainerStyle={sc.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1500); }} tintColor={Colors.dark.primary} colors={[Colors.dark.primary]} />}
      >
        <View style={{ paddingTop: ins.top }}>
          <View style={sc.hdr}>
            <Text style={sc.ttl}>Scanner</Text>
            <Text style={sc.sub}>Escaneie QR Codes promocionais ou cupons reais</Text>
          </View>
        </View>
        {renderScanner()}
        <View style={sc.typeBanner}>
          <View style={sc.typeItem}>
            <View style={[sc.typeIcon, { backgroundColor: 'rgba(255,190,11,0.12)' }]}><Gift size={16} color="#FFBE0B" /></View>
            <View style={sc.typeInfo}><Text style={sc.typeTitle}>Promocional</Text><Text style={sc.typeDesc}>Mensagem com oferta da loja</Text></View>
          </View>
          <View style={sc.typeDivider} />
          <View style={sc.typeItem}>
            <View style={[sc.typeIcon, { backgroundColor: Colors.dark.primaryFaint }]}><DollarSign size={16} color={Colors.dark.primary} /></View>
            <View style={sc.typeInfo}><Text style={sc.typeTitle}>Cupom Real</Text><Text style={sc.typeDesc}>PIX salvo no seu perfil</Text></View>
          </View>
        </View>
        <View style={sc.cHdr}><Ticket size={18} color={Colors.dark.primary} /><Text style={sc.cTtl}>Cupons Recebidos ({coupons.length})</Text></View>
        <View style={sc.list}>
          {recentCoupons.length === 0 ? (
            <View style={sc.empty}><ScanLine size={48} color={Colors.dark.textMuted} /><Text style={sc.eTtl}>Nenhum cupom ainda</Text><Text style={sc.eSub}>Escaneie um QR Code para receber seu cupom PIX!</Text></View>
          ) : recentCoupons.map((c) => <CouponRow key={c.id} coupon={c} />)}
          {coupons.length > 10 && <Text style={sc.moreTxt}>+ {coupons.length - 10} cupons anteriores</Text>}
        </View>
      </ScrollView>

      <Modal visible={show} transparent animationType="fade" onRequestClose={close}>
        <View style={md.ov}>
          <Animated.View style={[md.ct, { transform: [{ scale: sa }], opacity: sa }]}>
            <View style={md.topStrip}><CheckCircle size={20} color="#000" /><Text style={md.topTxt}>CUPOM RECEBIDO!</Text></View>
            <View style={md.body}>
              <View style={md.valueCircle}><Text style={md.valueCurrency}>R$</Text><Text style={md.valueAmount}>{last?.value.toFixed(2)}</Text></View>
              <Text style={md.sponsorName}>{last?.sponsorName}</Text>
              <Text style={md.savedNote}>Valor PIX salvo no seu perfil</Text>
              <View style={md.detailRow}>
                <View style={md.detailItem}><Text style={md.detailLabel}>Status</Text><Text style={md.detailValue}>Ativo</Text></View>
                <View style={md.detailDivider} />
                <View style={md.detailItem}><Text style={md.detailLabel}>Validade</Text><Text style={md.detailValue}>30 dias</Text></View>
              </View>
            </View>
            <TouchableOpacity style={md.btn} onPress={close} activeOpacity={0.8} testID="close-modal">
              <LinearGradient colors={['#F97316', '#EA580C']} style={md.btnG}><Text style={md.btnT}>ENTENDI</Text><ArrowRight size={18} color="#FFF" /></LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={showError} transparent animationType="fade" onRequestClose={closeError}>
        <View style={er.ov}>
          <Animated.View style={[er.ct, { transform: [{ scale: errorAnim }], opacity: errorAnim }]}>
            <View style={[er.topStrip, errorInfo.type === 'duplicate' ? er.topDuplicate : er.topInvalid]}>
              {errorInfo.type === 'duplicate' ? <AlertTriangle size={22} color="#fff" /> : <XCircle size={22} color="#fff" />}
              <Text style={er.topTxt}>{errorInfo.type === 'duplicate' ? 'JÁ ESCANEADO' : 'CUPOM INVÁLIDO'}</Text>
            </View>
            <View style={er.body}>
              <View style={[er.iconCircle, errorInfo.type === 'duplicate' ? er.iconDuplicate : er.iconInvalid]}>
                {errorInfo.type === 'duplicate' ? <AlertTriangle size={36} color="#FFBE0B" /> : <XCircle size={36} color={Colors.dark.danger} />}
              </View>
              <Text style={er.title}>{errorInfo.title}</Text>
              <Text style={er.message}>{errorInfo.message}</Text>
            </View>
            <TouchableOpacity style={er.btn} onPress={closeError} activeOpacity={0.8} testID="close-error-modal">
              <View style={[er.btnInner, errorInfo.type === 'duplicate' ? er.btnDuplicate : er.btnInvalid]}>
                <Text style={er.btnT}>TENTAR NOVAMENTE</Text><RefreshCw size={18} color="#fff" />
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={showPromo} transparent animationType="fade" onRequestClose={closePromo}>
        <View style={pm.ov}>
          <Animated.View style={[pm.ct, { transform: [{ scale: promoAnim }], opacity: promoAnim }]}>
            {lastPromo?.backgroundImageUrl ? (
              <>
                <Image source={{ uri: lastPromo.backgroundImageUrl }} style={pm.bgImage} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" />
                <LinearGradient colors={['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.42)']} style={pm.bgOverlay} />
              </>
            ) : null}
            <LinearGradient colors={['#FFBE0B', '#FF8C00']} style={pm.topStrip}><Gift size={22} color="#000" /><Text style={pm.topTxt}>PROMOÇÃO ESPECIAL!</Text></LinearGradient>
            <View style={pm.body}>
              <View style={pm.congratsWrap}><Text style={pm.congratsEmoji}>🎉</Text><Text style={[pm.congratsTitle, lastPromo?.backgroundImageUrl ? pm.congratsTitleOnImage : null]}>Parabéns!</Text></View>
              <View style={[pm.messageCard, lastPromo?.backgroundImageUrl ? pm.messageCardOnImage : null]}><Text style={pm.messageText}>{lastPromo?.message || `Ganhe R$ ${(lastPromo?.couponValue ?? 10).toFixed(2)} com compra mínima de R$ ${(lastPromo?.minPurchase ?? 100).toFixed(2)}!`}</Text></View>
              <View style={[pm.storeCard, lastPromo?.backgroundImageUrl ? pm.storeCardOnImage : null]}>
                <View style={pm.storeRow}><View style={pm.storeIconWrap}><Store size={20} color={Colors.dark.primary} /></View><View style={pm.storeInfo}><Text style={pm.storeName}>{lastPromo?.sponsorName ?? 'Loja Parceira'}</Text>{lastPromo?.sponsorAddress ? <View style={pm.addressRow}><MapPin size={12} color={Colors.dark.textMuted} /><Text style={pm.storeAddress}>{lastPromo.sponsorAddress}</Text></View> : null}</View></View>
                <View style={pm.detailsGrid}>
                  <View style={pm.detailBox}><DollarSign size={16} color={Colors.dark.success} /><Text style={pm.detailBoxLabel}>Valor PIX</Text><Text style={pm.detailBoxValue}>R$ {(lastPromo?.couponValue ?? 10).toFixed(2)}</Text></View>
                  <View style={pm.detailBox}><ShoppingBag size={16} color="#FFBE0B" /><Text style={pm.detailBoxLabel}>Compra mín.</Text><Text style={pm.detailBoxValue}>R$ {(lastPromo?.minPurchase ?? 100).toFixed(2)}</Text></View>
                </View>
              </View>
            </View>
            <TouchableOpacity style={pm.btn} onPress={closePromo} activeOpacity={0.8} testID="close-promo-modal">
              <LinearGradient colors={['#FFBE0B', '#FF8C00']} style={pm.btnG}><Text style={pm.btnT}>ENTENDI, VOU À LOJA!</Text><ArrowRight size={18} color="#000" /></LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const cam = StyleSheet.create({
  container: { marginHorizontal: 16, marginTop: 12, borderRadius: 20, overflow: 'hidden', height: 260, borderWidth: 1, borderColor: 'rgba(249,115,22,0.15)' },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayMiddle: { flexDirection: 'row', height: 170 },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  scanArea: { width: 190, height: 170, position: 'relative' as const },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#F97316', borderWidth: 3 },
  cTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  scanLine: { position: 'absolute', left: 10, right: 10, height: 2, backgroundColor: '#F97316', top: 85 },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', paddingBottom: 4 },
  instructions: { color: '#fff', fontSize: 13, fontWeight: '600' as const, textAlign: 'center' as const, marginBottom: 8 },
  controls: { flexDirection: 'row', gap: 24 },
  controlBtn: { alignItems: 'center', gap: 4 },
  controlTxt: { color: '#fff', fontSize: 10, fontWeight: '500' as const },
});

const sc = StyleSheet.create({
  ctr: { flex: 1, backgroundColor: 'transparent' },
  scrollRoot: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  hdr: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  ttl: { fontSize: 28, fontWeight: '800' as const, color: '#F8FAFC', textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  sub: { fontSize: 13, color: 'rgba(226,232,240,0.82)', marginTop: 2 },
  area: { marginHorizontal: 16, marginTop: 12, borderRadius: 20, overflow: 'hidden', height: 220, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(8,12,24,0.28)' },
  aGrad: { flex: 1, backgroundColor: 'rgba(8,12,24,0.4)', alignItems: 'center', justifyContent: 'center' },
  frame: { width: 160, height: 130, alignItems: 'center', justifyContent: 'center', position: 'relative' as const },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: '#F8FAFC', borderWidth: 3 },
  cTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  line: { position: 'absolute', left: 10, right: 10, height: 2, backgroundColor: '#60A5FA' },
  hint: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' as const, marginTop: 16 },
  hintS: { color: 'rgba(226,232,240,0.72)', fontSize: 11, marginTop: 4 },
  permBox: { marginHorizontal: 16, marginTop: 12, backgroundColor: 'rgba(8,12,24,0.72)', borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  permTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' as const, marginTop: 12 },
  permTxt: { color: 'rgba(226,232,240,0.8)', fontSize: 13, textAlign: 'center' as const, marginTop: 8 },
  permBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 20, width: '100%' },
  permBtnG: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  permBtnT: { color: '#FFF', fontSize: 14, fontWeight: '800' as const },
  settingsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  settingsBtnTxt: { color: Colors.dark.primary, fontSize: 13, fontWeight: '600' as const },
  simBtn: { marginTop: 14 },
  simBtnTxt: { color: 'rgba(226,232,240,0.78)', fontSize: 12, fontWeight: '500' as const },
  typeBanner: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, backgroundColor: 'rgba(8,12,24,0.72)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  typeItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  typeInfo: { flex: 1 },
  typeTitle: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' as const },
  typeDesc: { color: 'rgba(226,232,240,0.72)', fontSize: 10, marginTop: 1 },
  typeDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 8 },
  cHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginTop: 20, marginBottom: 10 },
  cTtl: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' as const },
  list: { paddingHorizontal: 16 },
  empty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  eTtl: { color: '#E2E8F0', fontSize: 16, fontWeight: '600' as const },
  eSub: { color: 'rgba(226,232,240,0.72)', fontSize: 13, textAlign: 'center' as const, paddingHorizontal: 40 },
  moreTxt: { color: 'rgba(226,232,240,0.72)', fontSize: 12, textAlign: 'center' as const, marginTop: 8 },
});

const md = StyleSheet.create({
  ov: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  ct: { backgroundColor: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 400, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(249,115,22,0.15)', shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 12 },
  topStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F97316', paddingVertical: 14 },
  topTxt: { color: '#FFF', fontSize: 15, fontWeight: '800' as const, letterSpacing: 1.5 },
  body: { padding: 24, alignItems: 'center' },
  valueCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(249,115,22,0.08)', borderWidth: 3, borderColor: '#F97316', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  valueCurrency: { color: '#F97316', fontSize: 14, fontWeight: '600' as const },
  valueAmount: { color: '#F97316', fontSize: 28, fontWeight: '900' as const, marginTop: -2 },
  sponsorName: { color: Colors.dark.text, fontSize: 18, fontWeight: '700' as const, marginBottom: 6 },
  savedNote: { color: Colors.dark.textSecondary, fontSize: 13, marginBottom: 20 },
  detailRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.inputBg, borderRadius: 14, padding: 14, width: '100%', borderWidth: 1, borderColor: Colors.dark.inputBorder },
  detailItem: { flex: 1, alignItems: 'center' },
  detailLabel: { color: Colors.dark.textMuted, fontSize: 11, fontWeight: '600' as const, marginBottom: 4 },
  detailValue: { color: Colors.dark.text, fontSize: 14, fontWeight: '700' as const },
  detailDivider: { width: 1, height: 30, backgroundColor: Colors.dark.cardBorder },
  btn: { borderRadius: 0, overflow: 'hidden' },
  btnG: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  btnT: { color: '#FFF', fontSize: 16, fontWeight: '800' as const, letterSpacing: 1 },
});

const er = StyleSheet.create({
  ov: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  ct: { backgroundColor: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 400, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  topStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  topDuplicate: { backgroundColor: '#FFBE0B' },
  topInvalid: { backgroundColor: Colors.dark.danger },
  topTxt: { color: '#fff', fontSize: 15, fontWeight: '800' as const, letterSpacing: 1.5 },
  body: { padding: 24, alignItems: 'center' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  iconDuplicate: { backgroundColor: 'rgba(255,190,11,0.12)' },
  iconInvalid: { backgroundColor: 'rgba(255,71,87,0.12)' },
  title: { color: Colors.dark.text, fontSize: 18, fontWeight: '800' as const, textAlign: 'center' as const, marginBottom: 8 },
  message: { color: Colors.dark.textSecondary, fontSize: 14, textAlign: 'center' as const, lineHeight: 20 },
  btn: { borderRadius: 0, overflow: 'hidden' },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  btnDuplicate: { backgroundColor: '#FFBE0B' },
  btnInvalid: { backgroundColor: Colors.dark.danger },
  btnT: { color: '#fff', fontSize: 15, fontWeight: '800' as const, letterSpacing: 0.5 },
});

const pm = StyleSheet.create({
  ov: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  ct: { backgroundColor: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 400, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)' },
  bgImage: { ...StyleSheet.absoluteFillObject },
  bgOverlay: { ...StyleSheet.absoluteFillObject },
  topStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  topTxt: { color: '#FFF', fontSize: 15, fontWeight: '800' as const, letterSpacing: 1.5 },
  body: { padding: 20, alignItems: 'center' },
  congratsWrap: { alignItems: 'center', marginBottom: 16 },
  congratsEmoji: { fontSize: 40, marginBottom: 6 },
  congratsTitle: { fontSize: 24, fontWeight: '900' as const, color: Colors.dark.text },
  congratsTitleOnImage: { color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  messageCard: { backgroundColor: 'rgba(255,190,11,0.08)', borderRadius: 14, padding: 16, width: '100%', borderWidth: 1, borderColor: 'rgba(255,190,11,0.2)', marginBottom: 14 },
  messageCardOnImage: { backgroundColor: 'rgba(255,255,255,0.9)', borderColor: 'rgba(255,255,255,0.28)' },
  messageText: { color: Colors.dark.text, fontSize: 15, fontWeight: '600' as const, lineHeight: 22, textAlign: 'center' as const },
  storeCard: { backgroundColor: Colors.dark.inputBg, borderRadius: 14, padding: 14, width: '100%', borderWidth: 1, borderColor: Colors.dark.inputBorder, marginBottom: 12 },
  storeCardOnImage: { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: 'rgba(255,255,255,0.3)' },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  storeIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.dark.primaryFaint, alignItems: 'center', justifyContent: 'center' },
  storeInfo: { flex: 1 },
  storeName: { color: Colors.dark.text, fontSize: 16, fontWeight: '700' as const },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  storeAddress: { color: Colors.dark.textMuted, fontSize: 12, flex: 1 },
  detailsGrid: { flexDirection: 'row', gap: 10 },
  detailBox: { flex: 1, alignItems: 'center', backgroundColor: Colors.dark.surfaceLight, borderRadius: 12, padding: 12, gap: 4, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  detailBoxLabel: { color: Colors.dark.textMuted, fontSize: 10, fontWeight: '600' as const },
  detailBoxValue: { color: Colors.dark.text, fontSize: 14, fontWeight: '800' as const },
  btn: { borderRadius: 0, overflow: 'hidden' },
  btnG: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  btnT: { color: '#FFF', fontSize: 14, fontWeight: '800' as const, letterSpacing: 0.5 },
});
