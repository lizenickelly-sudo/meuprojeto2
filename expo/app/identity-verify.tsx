import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Alert, Image, Modal, TextInput, ActivityIndicator, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { Camera, FileText, CheckCircle, Shield, Image as ImageIcon, X, AlertCircle, Crop, RotateCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Colors from '@/constants/colors';
import { formatCPF } from '@/lib/formatters';
import { useUser } from '@/providers/UserProvider';
import { useAdmin } from '@/providers/AdminProvider';

function validateCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  let remainder: number;
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(clean.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(clean.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(clean.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(clean.substring(10, 11));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getInitialVerificationStep(selfieUrl?: string, documentUrl?: string, cpf?: string): number {
  if (!selfieUrl) return 0;
  if (!documentUrl) return 1;
  if (!cpf) return 2;
  return 3;
}

export default function IdentityVerifyScreen() {
  console.log("[IdentityVerify] Verification screen initialized");
  const router = useRouter();
  const { profile, saveProfile } = useUser();
  const { addNotification } = useAdmin();
  const [step, setStep] = useState<number>(() => getInitialVerificationStep(profile.selfieUrl, profile.documentUrl, profile.cpf));
  const [selfieUrl, setSelfieUrl] = useState<string>(profile.selfieUrl || '');
  const [documentUrl, setDocumentUrl] = useState<string>(profile.documentUrl || '');
  const [cpfInput, setCpfInput] = useState<string>(formatCPF(profile.cpf || ''));
  const [cpfDocInput, setCpfDocInput] = useState<string>(formatCPF(profile.cpf || ''));
  const [cpfValid, setCpfValid] = useState<boolean>(false);
  const [cpfDocValid, setCpfDocValid] = useState<boolean>(false);
  const [cpfMatch, setCpfMatch] = useState<boolean>(false);
  const [showCpfModal, setShowCpfModal] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [pendingAsset, setPendingAsset] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [showCropConfirm, setShowCropConfirm] = useState<boolean>(false);
  const [cropZoom, setCropZoom] = useState<number>(1);
  const [cropPan, setCropPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cropFrame, setCropFrame] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const lastPanPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const gestureModeRef = useRef<'none' | 'pan' | 'pinch'>('none');
  const cropZoomRef = useRef<number>(1);
  const cropPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const normalizedUserCpf = cpfInput.replace(/\D/g, '');
    const normalizedDocCpf = cpfDocInput.replace(/\D/g, '');
    setCpfValid(validateCPF(normalizedUserCpf));
    setCpfDocValid(validateCPF(normalizedDocCpf));
    setCpfMatch(normalizedUserCpf.length === 11 && normalizedUserCpf === normalizedDocCpf);
  }, [cpfInput, cpfDocInput]);

  useEffect(() => {
    if (step === 4) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [step]);

  useEffect(() => {
    setSelfieUrl(profile.selfieUrl || '');
    setDocumentUrl(profile.documentUrl || '');
    setCpfInput(formatCPF(profile.cpf || ''));
    setCpfDocInput(formatCPF(profile.cpf || ''));
    setStep(getInitialVerificationStep(profile.selfieUrl, profile.documentUrl, profile.cpf));
  }, [profile.selfieUrl, profile.documentUrl, profile.cpf]);

  useEffect(() => {
    cropZoomRef.current = cropZoom;
  }, [cropZoom]);

  useEffect(() => {
    cropPanRef.current = cropPan;
  }, [cropPan]);

  const saveSelfie = useCallback((uri: string) => {
    setSelfieUrl(uri);
    setStep(1);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const saveDocument = useCallback((uri: string) => {
    setDocumentUrl(uri);
    setStep(2);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const confirmCrop = useCallback(() => {
    if (!pendingAsset?.uri) return;
    setShowCropConfirm(false);
    if (step === 0) saveSelfie(pendingAsset.uri);
    else if (step === 1) saveDocument(pendingAsset.uri);
    setPendingAsset(null);
    setCropZoom(1);
    setCropPan({ x: 0, y: 0 });
  }, [pendingAsset, step, saveSelfie, saveDocument]);

  const rotatePending = useCallback(async () => {
    if (!pendingAsset?.uri) return;
    try {
      const rotated = await ImageManipulator.manipulateAsync(
        pendingAsset.uri,
        [{ rotate: 90 }],
        { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
      );
      setPendingAsset({ uri: rotated.uri, width: rotated.width, height: rotated.height });
    } catch (error) {
      Alert.alert('Erro', 'Nao foi possivel girar a foto.');
      console.log('Rotate error:', error);
    }
  }, [pendingAsset]);

  const cropPending = useCallback(async () => {
    if (!pendingAsset?.uri || !pendingAsset.width || !pendingAsset.height) {
      Alert.alert('Erro', 'Nao foi possivel cortar esta imagem.');
      return;
    }

    try {
      let cropWidth = pendingAsset.width;
      let cropHeight = pendingAsset.height;
      let originX = 0;
      let originY = 0;

      if (cropFrame.width > 0 && cropFrame.height > 0) {
        const frameW = cropFrame.width;
        const frameH = cropFrame.height;
        const baseScale = Math.min(frameW / pendingAsset.width, frameH / pendingAsset.height);
        const scale = baseScale * cropZoom;
        const displayedW = pendingAsset.width * scale;
        const displayedH = pendingAsset.height * scale;

        const imageLeft = (frameW - displayedW) / 2 + cropPan.x;
        const imageTop = (frameH - displayedH) / 2 + cropPan.y;

        cropWidth = Math.floor(frameW / scale);
        cropHeight = Math.floor(frameH / scale);
        originX = Math.floor((0 - imageLeft) / scale);
        originY = Math.floor((0 - imageTop) / scale);
      } else {
        const targetAspect = step === 0 ? 1 : 4 / 3;
        const sourceAspect = pendingAsset.width / pendingAsset.height;
        if (sourceAspect > targetAspect) {
          cropWidth = Math.floor(pendingAsset.height * targetAspect);
        } else {
          cropHeight = Math.floor(pendingAsset.width / targetAspect);
        }
        cropWidth = Math.max(120, Math.floor(cropWidth / cropZoom));
        cropHeight = Math.max(120, Math.floor(cropHeight / cropZoom));
        originX = Math.floor((pendingAsset.width - cropWidth) / 2);
        originY = Math.floor((pendingAsset.height - cropHeight) / 2);
      }

      originX = clamp(originX, 0, Math.max(0, pendingAsset.width - cropWidth));
      originY = clamp(originY, 0, Math.max(0, pendingAsset.height - cropHeight));
      cropWidth = clamp(cropWidth, 80, pendingAsset.width - originX);
      cropHeight = clamp(cropHeight, 80, pendingAsset.height - originY);

      const cropped = await ImageManipulator.manipulateAsync(
        pendingAsset.uri,
        [{ crop: { originX, originY, width: cropWidth, height: cropHeight } }],
        { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
      );

      setPendingAsset({ uri: cropped.uri, width: cropped.width, height: cropped.height });
    } catch (error) {
      Alert.alert('Erro', 'Nao foi possivel cortar a foto.');
      console.log('Crop error:', error);
    }
  }, [pendingAsset, step, cropZoom, cropPan, cropFrame]);

  const cancelCrop = useCallback(() => {
    setShowCropConfirm(false);
    setPendingAsset(null);
    setCropZoom(1);
    setCropPan({ x: 0, y: 0 });
  }, []);

  const getTouchDistance = useCallback((touches: readonly { pageX: number; pageY: number }[]) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const handleCropTouchStart = useCallback((evt: any) => {
    const touches = evt.nativeEvent.touches as readonly { pageX: number; pageY: number }[];
    if (touches.length >= 2) {
      gestureModeRef.current = 'pinch';
      pinchStartDistanceRef.current = getTouchDistance(touches);
      pinchStartZoomRef.current = cropZoomRef.current;
      return;
    }
    if (touches.length === 1) {
      gestureModeRef.current = 'pan';
      lastPanPointRef.current = { x: touches[0].pageX, y: touches[0].pageY };
      pinchStartDistanceRef.current = null;
      return;
    }
    gestureModeRef.current = 'none';
    pinchStartDistanceRef.current = null;
  }, [getTouchDistance]);

  const handleCropTouchMove = useCallback((evt: any) => {
    const touches = evt.nativeEvent.touches as readonly { pageX: number; pageY: number }[];

    if (touches.length >= 2) {
      if (gestureModeRef.current !== 'pinch') {
        gestureModeRef.current = 'pinch';
        pinchStartDistanceRef.current = getTouchDistance(touches);
        pinchStartZoomRef.current = cropZoomRef.current;
        return;
      }

      const currentDistance = getTouchDistance(touches);
      if (!pinchStartDistanceRef.current || pinchStartDistanceRef.current <= 0) {
        pinchStartDistanceRef.current = currentDistance;
        pinchStartZoomRef.current = cropZoomRef.current;
        return;
      }

      const nextZoom = clamp(Number((pinchStartZoomRef.current * (currentDistance / pinchStartDistanceRef.current)).toFixed(2)), 1, 3);
      setCropZoom(nextZoom);
      return;
    }

    if (touches.length === 1) {
      const point = { x: touches[0].pageX, y: touches[0].pageY };
      if (gestureModeRef.current !== 'pan') {
        gestureModeRef.current = 'pan';
        lastPanPointRef.current = point;
        pinchStartDistanceRef.current = null;
        return;
      }

      const dx = point.x - lastPanPointRef.current.x;
      const dy = point.y - lastPanPointRef.current.y;
      lastPanPointRef.current = point;
      setCropPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      return;
    }

    gestureModeRef.current = 'none';
    pinchStartDistanceRef.current = null;
  }, [getTouchDistance]);

  const handleCropTouchEnd = useCallback((evt: any) => {
    const touches = evt.nativeEvent.touches as readonly { pageX: number; pageY: number }[];
    if (touches.length >= 2) {
      gestureModeRef.current = 'pinch';
      pinchStartDistanceRef.current = getTouchDistance(touches);
      pinchStartZoomRef.current = cropZoomRef.current;
      return;
    }
    if (touches.length === 1) {
      gestureModeRef.current = 'pan';
      lastPanPointRef.current = { x: touches[0].pageX, y: touches[0].pageY };
      pinchStartDistanceRef.current = null;
      return;
    }
    gestureModeRef.current = 'none';
    pinchStartDistanceRef.current = null;
  }, [getTouchDistance]);

  const pickCamera = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão necessária', 'Permita o acesso à câmera nas configurações do dispositivo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const asset = result.assets[0];
        setPendingAsset({ uri: asset.uri, width: asset.width ?? 0, height: asset.height ?? 0 });
        setCropZoom(1);
        setCropPan({ x: 0, y: 0 });
        setShowCropConfirm(true);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível acessar a câmera.');
      console.log('Camera error:', error);
    }
  }, [step]);

  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        allowsMultiple: false,
        quality: 0.95,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const asset = result.assets[0];
        setPendingAsset({ uri: asset.uri, width: asset.width ?? 0, height: asset.height ?? 0 });
        setCropZoom(1);
        setCropPan({ x: 0, y: 0 });
        setShowCropConfirm(true);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível acessar a galeria.');
      console.log('Gallery error:', error);
    }
  }, [step]);

  const handleVerify = useCallback(async () => {
    if (!cpfValid) {
      Alert.alert('CPF Inválido', 'O CPF informado é inválido. Verifique os dígitos.');
      return;
    }

    if (!cpfDocValid) {
      Alert.alert('CPF do documento inválido', 'Verifique o CPF informado no documento.');
      return;
    }

    if (!cpfMatch) {
      Alert.alert('CPF divergente', 'O CPF digitado nao confere com o CPF do documento.');
      return;
    }

    if (!selfieUrl || !documentUrl) {
      Alert.alert('Documentos incompletos', 'Selfie e documento são obrigatórios.');
      return;
    }

    setIsProcessing(true);
    try {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await saveProfile({
        ...profile,
        identityVerified: false,
        adminReviewStatus: 'pending',
        adminReviewedAt: undefined,
        avatarUrl: selfieUrl,
        selfieUrl,
        documentUrl,
        cpf: cpfInput.replace(/\D/g, ''),
      });
      
      // Send identity verification notification to admin
      addNotification({
        id: profile.id || `verify_${Date.now()}`,
        title: 'Verificação de Identidade Pendente',
        message: `${profile.name || 'Usuário'} enviou documentos para verificação de identidade.`,
        type: 'identity_verification',
        createdAt: new Date().toISOString(),
        sent: false,
        metadata: {
          kind: 'identity_verification',
          userEmail: profile.email,
          cpf: cpfInput.replace(/\D/g, ''),
          selfieUrl,
          documentUrl,
          verificationStatus: 'pending',
        },
      });
      
      setStep(4);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível completar a verificação.');
      console.log('Verify error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [cpfValid, cpfDocValid, cpfMatch, selfieUrl, documentUrl, cpfInput, profile, saveProfile, addNotification]);

  const canOpenStep = useCallback((targetStep: number) => {
    if (targetStep <= 0) return true;
    if (targetStep === 1) return Boolean(selfieUrl);
    if (targetStep === 2) return Boolean(selfieUrl && documentUrl);
    if (targetStep === 3) return Boolean(selfieUrl && documentUrl && cpfValid && cpfDocValid && cpfMatch);
    return false;
  }, [cpfDocValid, cpfMatch, cpfValid, documentUrl, selfieUrl]);

  if (step === 4) {
    return (
      <View style={v.ctr}>
        <Stack.Screen options={{ title: 'Verificacao' }} />
        <View style={v.successWrap}>
          <Animated.View style={[v.successIcon, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
            <CheckCircle size={72} color={Colors.dark.neonGreen} />
          </Animated.View>
          <Animated.Text style={[v.successTtl, { opacity: opacityAnim }]}>Enviado para análise!</Animated.Text>
          <Animated.Text style={[v.successDesc, { opacity: opacityAnim }]}>Seus documentos foram enviados. O perfil e a carteira só mostrarão Verificado quando o admin ativar sua conta.</Animated.Text>
          <Animated.View style={{ opacity: opacityAnim }}>
            <TouchableOpacity style={v.doneBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={v.doneBtnG}>
                <Text style={v.doneBtnT}>CONCLUIR</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
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
          <Text style={v.headerDesc}>Para sua seguranca, precisamos verificar sua identidade antes de permitir saques. Tenha um RG ou CNH disponível.</Text>
          {profile.adminReviewStatus === 'pending' ? <Text style={v.reviewHint}>Documentos em análise. Toque nas etapas para revisar ou substituir selfie, documento e CPF.</Text> : null}
        </View>

        <View style={v.stepsRow}>
          {['Selfie', 'Documento', 'CPF', 'Confirmar'].map((label, i) => (
            <TouchableOpacity key={label} style={v.stepItem} onPress={() => canOpenStep(i) && setStep(i)} activeOpacity={canOpenStep(i) ? 0.8 : 1} disabled={!canOpenStep(i)}>
              <View style={[v.stepCircle, step >= i && v.stepCircleActive, canOpenStep(i) && v.stepCircleEnabled]}>
                <Text style={[v.stepNum, step >= i && v.stepNumActive]}>{i + 1}</Text>
              </View>
              <Text style={[v.stepLabel, step >= i && v.stepLabelActive, canOpenStep(i) && v.stepLabelEnabled, { fontSize: 10 }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {step === 0 && (
          <View style={v.card}>
            <View style={v.cardIcon}><Camera size={40} color={Colors.dark.neonGreen} /></View>
            <Text style={v.cardTtl}>Tire uma selfie</Text>
            <Text style={v.cardDesc}>Posicione seu rosto centralizado na camera, em um ambiente bem iluminado, sem oculos ou chapeu.</Text>
            {selfieUrl && <Image source={{ uri: selfieUrl }} style={v.imagePreview} />}
            <View style={v.buttonRow}>
              <TouchableOpacity style={v.actionBtn2} onPress={pickCamera} activeOpacity={0.8} testID="camera-btn">
                <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={v.actionBtnG}>
                  <Camera size={18} color="#000" />
                  <Text style={v.actionBtnT}>CAMERA</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={v.actionBtn2} onPress={pickImage} activeOpacity={0.8} testID="gallery-btn">
                <LinearGradient colors={[Colors.dark.primary, '#5B21B6']} style={v.actionBtnG}>
                  <ImageIcon size={18} color="#fff" />
                  <Text style={[v.actionBtnT, { color: '#fff' }]}>GALERIA</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            {selfieUrl && <Text style={v.successTxt}>✓ Selfie enviada</Text>}
          </View>
        )}

        {step === 1 && (
          <View style={v.card}>
            <View style={v.cardIcon}><FileText size={40} color={Colors.dark.neonGreen} /></View>
            <Text style={v.cardTtl}>Envie seu documento</Text>
            <Text style={v.cardDesc}>Fotografe a frente do seu RG, CNH ou Passaporte. O documento deve estar legivel e dentro do prazo de validade.</Text>
            {documentUrl && <Image source={{ uri: documentUrl }} style={v.imagePreview} />}
            <View style={v.buttonRow}>
              <TouchableOpacity style={v.actionBtn2} onPress={pickCamera} activeOpacity={0.8} testID="doc-camera-btn">
                <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={v.actionBtnG}>
                  <Camera size={18} color="#000" />
                  <Text style={v.actionBtnT}>CAMERA</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={v.actionBtn2} onPress={pickImage} activeOpacity={0.8} testID="doc-gallery-btn">
                <LinearGradient colors={[Colors.dark.primary, '#5B21B6']} style={v.actionBtnG}>
                  <ImageIcon size={18} color="#fff" />
                  <Text style={[v.actionBtnT, { color: '#fff' }]}>GALERIA</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
            {documentUrl && <Text style={v.successTxt}>✓ Documento enviado</Text>}
          </View>
        )}

        {step === 2 && (
          <View style={v.card}>
            <View style={v.cardIcon}><Shield size={40} color={Colors.dark.neonGreen} /></View>
            <Text style={v.cardTtl}>Informe seu CPF</Text>
            <Text style={v.cardDesc}>Digite seu CPF na tela a seguir. Este dado será validado no banco de dados.</Text>
            <TouchableOpacity style={v.actionBtn} onPress={() => setShowCpfModal(true)} activeOpacity={0.8}>
              <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={v.actionBtnG}>
                <Text style={v.actionBtnT}>INFORMAR CPF</Text>
              </LinearGradient>
            </TouchableOpacity>
            {cpfValid && <Text style={v.successTxt}>✓ CPF válido</Text>}
          </View>
        )}

        {step === 3 && (
          <View style={v.card}>
            <View style={v.confirmRow}>
              <View style={v.confirmItem}><CheckCircle size={24} color={Colors.dark.success} /><Text style={v.confirmTxt}>Selfie enviada</Text></View>
              <View style={v.confirmItem}><CheckCircle size={24} color={Colors.dark.success} /><Text style={v.confirmTxt}>Documento enviado</Text></View>
              <View style={v.confirmItem}><CheckCircle size={24} color={Colors.dark.success} /><Text style={v.confirmTxt}>CPF validado</Text></View>
            </View>
            <Text style={v.cardDesc}>Todos os dados foram coletados e validados. Revise e confirme para concluir a verificacao.</Text>
            <TouchableOpacity style={v.actionBtn} onPress={handleVerify} disabled={isProcessing} activeOpacity={0.8} testID="verify-btn">
              <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={v.actionBtnG}>
                {isProcessing ? <ActivityIndicator color="#000" /> : <>
                  <Shield size={18} color="#000" /><Text style={v.actionBtnT}>VERIFICAR AGORA</Text>
                </>}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showCropConfirm} animationType="fade" transparent>
        <View style={v.cropOverlay}>
          <View style={v.cropModalContent}>
            <Text style={v.cropModalTitle}>{step === 0 ? 'Confirmar Selfie' : 'Confirmar Documento'}</Text>
            <Text style={v.cropModalDesc}>{step === 0 ? 'A foto do seu rosto está boa?' : 'O documento está legível?'}</Text>
            <View
              style={[
                v.cropPreviewFrame,
                {
                  height: pendingAsset
                    ? clamp(Math.floor(280 * (pendingAsset.height / Math.max(1, pendingAsset.width))), 220, 380)
                    : 280,
                },
              ]}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setCropFrame({ width, height });
              }}
              onTouchStart={handleCropTouchStart}
              onTouchMove={handleCropTouchMove}
              onTouchEnd={handleCropTouchEnd}
              onTouchCancel={handleCropTouchEnd}
            >
              {pendingAsset?.uri ? (
                <Image
                  source={{ uri: pendingAsset.uri }}
                  style={[
                    v.cropPreview,
                    { transform: [{ translateX: cropPan.x }, { translateY: cropPan.y }, { scale: cropZoom }] },
                  ]}
                  resizeMode="contain"
                />
              ) : null}
              {pendingAsset?.width && pendingAsset?.height ? (
                <View style={v.sizeBadgeCenter}>
                  <Text style={v.sizeBadgeText}>{pendingAsset.width} x {pendingAsset.height}</Text>
                </View>
              ) : null}
            </View>
            <Text style={v.zoomHint}>Use dois dedos para zoom e um dedo para mover</Text>
            <View style={v.editRow}>
              <TouchableOpacity style={v.editBtn} onPress={cropPending} activeOpacity={0.85}>
                <Crop size={14} color={Colors.dark.text} />
                <Text style={v.editBtnTxt}>Cortar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={v.editBtn} onPress={rotatePending} activeOpacity={0.85}>
                <RotateCw size={14} color={Colors.dark.text} />
                <Text style={v.editBtnTxt}>Girar</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={v.cropConfirmBtn} onPress={confirmCrop} activeOpacity={0.85}>
              <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={v.actionBtnG}>
                <CheckCircle size={20} color="#000" />
                <Text style={[v.actionBtnT, { fontSize: 16 }]}>USAR ESTA FOTO</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={v.cropRetryBtn} onPress={cancelCrop} activeOpacity={0.8}>
              <Text style={v.cropRetryTxt}>↩ Refazer foto</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showCpfModal} animationType="slide" transparent>
        <View style={v.modalOverlay}>
          <View style={v.modalContent}>
            <View style={v.modalHeader}>
              <TouchableOpacity onPress={() => setShowCpfModal(false)}>
                <X size={24} color={Colors.dark.text} />
              </TouchableOpacity>
              <Text style={v.modalTitle}>Informe seu CPF</Text>
              <View style={{ width: 24 }} />
            </View>
            <ScrollView style={v.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={v.modalDesc}>Digite seu CPF:</Text>
              <TextInput
                style={[v.cpfInput, cpfValid && v.cpfInputValid, cpfInput.length > 0 && !cpfValid && v.cpfInputError]}
                value={cpfInput}
                onChangeText={(text) => setCpfInput(formatCPF(text))}
                placeholder="000.000.000-00"
                placeholderTextColor={Colors.dark.textMuted}
                keyboardType="number-pad"
                maxLength={14}
              />
              {cpfInput.replace(/\D/g, '').length === 11 && !cpfValid && <View style={v.errorHint}><AlertCircle size={14} color={Colors.dark.danger} /><Text style={v.errorHintTxt}>CPF inválido</Text></View>}
              {cpfValid && <View style={v.successHint}><CheckCircle size={14} color={Colors.dark.success} /><Text style={v.successHintTxt}>CPF válido</Text></View>}

              <Text style={[v.modalDesc, { marginTop: 8 }]}>Confirme o CPF que aparece no documento:</Text>
              <TextInput
                style={[v.cpfInput, cpfDocValid && v.cpfInputValid, cpfDocInput.length > 0 && !cpfDocValid && v.cpfInputError]}
                value={cpfDocInput}
                onChangeText={(text) => setCpfDocInput(formatCPF(text))}
                placeholder="000.000.000-00"
                placeholderTextColor={Colors.dark.textMuted}
                keyboardType="number-pad"
                maxLength={14}
              />

              {cpfDocInput.replace(/\D/g, '').length === 11 && !cpfDocValid && <View style={v.errorHint}><AlertCircle size={14} color={Colors.dark.danger} /><Text style={v.errorHintTxt}>CPF do documento inválido</Text></View>}
              {cpfDocValid && !cpfMatch && <View style={v.errorHint}><AlertCircle size={14} color={Colors.dark.danger} /><Text style={v.errorHintTxt}>CPF diferente do documento</Text></View>}
              {cpfValid && cpfDocValid && cpfMatch && <View style={v.successHint}><CheckCircle size={14} color={Colors.dark.success} /><Text style={v.successHintTxt}>CPF confirmado com o documento</Text></View>}

              <TouchableOpacity
                style={[v.cpfConfirmBtn, !(cpfValid && cpfDocValid && cpfMatch) && v.cpfConfirmBtnDisabled]}
                onPress={() => { setShowCpfModal(false); setStep(3); }}
                disabled={!(cpfValid && cpfDocValid && cpfMatch)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={(cpfValid && cpfDocValid && cpfMatch) ? [Colors.dark.neonGreen, Colors.dark.neonGreenDim] : [Colors.dark.textMuted, Colors.dark.textMuted]}
                  style={v.cpfConfirmBtnG}
                >
                  <Text style={[v.cpfConfirmBtnT, !cpfValid && { color: Colors.dark.background }]}>CONFIRMAR CPF</Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const v = StyleSheet.create({
  ctr: { flex: 1, backgroundColor: 'transparent' },
  sc: { paddingBottom: 20, paddingTop: 16 },
  headerCard: { alignItems: 'center', marginHorizontal: 16, marginBottom: 24, gap: 8 },
  headerTtl: { color: Colors.dark.text, fontSize: 22, fontWeight: '800' as const, textAlign: 'center' },
  headerDesc: { color: Colors.dark.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  reviewHint: { color: Colors.dark.warning, fontSize: 12, fontWeight: '600' as const, textAlign: 'center', lineHeight: 18, marginTop: 4, paddingHorizontal: 12 },
  stepsRow: { flexDirection: 'row', justifyContent: 'center', gap: 32, marginBottom: 28 },
  stepItem: { alignItems: 'center', gap: 6 },
  stepCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.dark.card, borderWidth: 2, borderColor: Colors.dark.cardBorder, alignItems: 'center', justifyContent: 'center' },
  stepCircleEnabled: { borderColor: 'rgba(0,255,135,0.28)' },
  stepCircleActive: { backgroundColor: Colors.dark.neonGreenFaint, borderColor: Colors.dark.neonGreen },
  stepNum: { color: Colors.dark.textMuted, fontSize: 14, fontWeight: '800' as const },
  stepNumActive: { color: Colors.dark.neonGreen },
  stepLabel: { color: Colors.dark.textMuted, fontSize: 11, fontWeight: '600' as const },
  stepLabelEnabled: { color: Colors.dark.textSecondary },
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
  imagePreview: { width: '100%', height: 240, borderRadius: 12, marginVertical: 12 },
  buttonRow: { flexDirection: 'row', gap: 12, width: '100%' },
  actionBtn2: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  successTxt: { color: Colors.dark.success, fontSize: 13, fontWeight: '600' as const, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: Colors.dark.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.dark.background },
  modalTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.dark.text },
  modalBody: { padding: 16, gap: 12 },
  modalDesc: { fontSize: 13, color: Colors.dark.textMuted, marginBottom: 8 },
  cpfInput: { paddingHorizontal: 12, paddingVertical: 14, backgroundColor: Colors.dark.background, borderRadius: 8, borderWidth: 2, borderColor: Colors.dark.border || Colors.dark.cardBorder, color: Colors.dark.text, fontSize: 16, fontWeight: '600' as const, letterSpacing: 2 },
  cpfInputValid: { borderColor: Colors.dark.success },
  cpfInputError: { borderColor: '#DC2626' },
  errorHint: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'rgba(220, 38, 38, 0.1)', borderRadius: 8 },
  errorHintTxt: { fontSize: 12, color: '#DC2626', fontWeight: '500' as const },
  successHint: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: 8 },
  successHintTxt: { fontSize: 12, color: Colors.dark.success, fontWeight: '500' as const },
  cpfConfirmBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 16, width: '100%' },
  cpfConfirmBtnDisabled: { opacity: 0.5 },
  cpfConfirmBtnG: { paddingVertical: 14, justifyContent: 'center', alignItems: 'center' },
  cpfConfirmBtnT: { fontSize: 14, fontWeight: '600' as const, color: '#000' },
  cropModalContent: { backgroundColor: Colors.dark.card, borderRadius: 24, padding: 24, alignItems: 'center', gap: 14, width: '100%' },
  cropOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  cropModalTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.dark.text },
  cropModalDesc: { fontSize: 13, color: Colors.dark.textSecondary, textAlign: 'center' as const },
  cropPreviewFrame: { width: '100%', height: 280, borderRadius: 14, marginVertical: 8, overflow: 'hidden', backgroundColor: Colors.dark.background },
  cropPreview: { width: '100%', height: '100%' },
  sizeBadgeCenter: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -50 }, { translateY: -16 }], backgroundColor: 'rgba(0,0,0,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  sizeBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.3 },
  zoomHint: { color: Colors.dark.textSecondary, fontSize: 12, marginBottom: 8 },
  editRow: { width: '100%', flexDirection: 'row', gap: 10 },
  editBtn: { flex: 1, borderWidth: 1, borderColor: Colors.dark.cardBorder, borderRadius: 10, paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, backgroundColor: Colors.dark.background },
  editBtnTxt: { color: Colors.dark.text, fontSize: 13, fontWeight: '600' as const },
  cropConfirmBtn: { width: '100%', borderRadius: 12, overflow: 'hidden' as const },
  cropRetryBtn: { paddingVertical: 12 },
  cropRetryTxt: { color: Colors.dark.textSecondary, fontSize: 14, textDecorationLine: 'underline' as const },
});
