import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImageManipulator from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import { CheckCircle, Minus, Plus, RotateCw, X } from 'lucide-react-native';
import Colors from '@/constants/colors';

const DEFAULT_MIME_TYPE = 'image/jpeg';
const DEFAULT_FILE_NAME = 'edited-image.jpg';
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.2;

export type ImageCanvasAsset = {
  uri: string;
  width: number;
  height: number;
  fileName?: string;
  mimeType?: string;
};

export type ImageCanvasEditorSession = {
  asset: ImageCanvasAsset;
  title?: string;
  description?: string;
  confirmLabel?: string;
  aspectRatio?: number;
  onConfirm: (asset: ImageCanvasAsset) => void | Promise<void>;
};

type ImageCanvasEditorModalProps = {
  session: ImageCanvasEditorSession | null;
  onClose: () => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveFileName(fileName?: string): string {
  if (!fileName) return DEFAULT_FILE_NAME;

  const stripped = fileName.replace(/\.[^.]+$/, '').trim();
  return `${stripped || 'edited-image'}.jpg`;
}

export function mapPickerAssetToImageCanvasAsset(asset: ImagePickerAsset): ImageCanvasAsset {
  return {
    uri: asset.uri,
    width: asset.width ?? 0,
    height: asset.height ?? 0,
    fileName: asset.fileName ?? undefined,
    mimeType: asset.mimeType ?? DEFAULT_MIME_TYPE,
  };
}

export default function ImageCanvasEditorModal({ session, onClose }: ImageCanvasEditorModalProps) {
  const [workingAsset, setWorkingAsset] = useState<ImageCanvasAsset | null>(null);
  const [cropZoom, setCropZoom] = useState<number>(1);
  const [cropPan, setCropPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cropFrame, setCropFrame] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [processing, setProcessing] = useState<boolean>(false);

  const cropPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    cropPanRef.current = cropPan;
  }, [cropPan]);

  useEffect(() => {
    if (!session) {
      setWorkingAsset(null);
      setCropZoom(1);
      setCropPan({ x: 0, y: 0 });
      setCropFrame({ width: 0, height: 0 });
      return;
    }

    setWorkingAsset(session.asset);
    setCropZoom(1);
    setCropPan({ x: 0, y: 0 });
    setCropFrame({ width: 0, height: 0 });
  }, [session]);

  const aspectRatio = session?.aspectRatio ?? 1;

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => Boolean(workingAsset) && !processing,
      onMoveShouldSetPanResponder: (_, gestureState) => Boolean(workingAsset) && !processing && (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2),
      onPanResponderGrant: () => {
        panOriginRef.current = cropPanRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        setCropPan({
          x: panOriginRef.current.x + gestureState.dx,
          y: panOriginRef.current.y + gestureState.dy,
        });
      },
      onPanResponderTerminationRequest: () => false,
    }),
    [processing, workingAsset],
  );

  const resetViewport = useCallback(() => {
    setCropZoom(1);
    setCropPan({ x: 0, y: 0 });
  }, []);

  const zoomOut = useCallback(() => {
    setCropZoom((current) => clamp(Number((current - ZOOM_STEP).toFixed(2)), MIN_ZOOM, MAX_ZOOM));
  }, []);

  const zoomIn = useCallback(() => {
    setCropZoom((current) => clamp(Number((current + ZOOM_STEP).toFixed(2)), MIN_ZOOM, MAX_ZOOM));
  }, []);

  const rotateImage = useCallback(async () => {
    if (!workingAsset?.uri) return;

    try {
      setProcessing(true);
      const rotated = await ImageManipulator.manipulateAsync(
        workingAsset.uri,
        [{ rotate: 90 }],
        { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG },
      );

      setWorkingAsset({
        uri: rotated.uri,
        width: rotated.width,
        height: rotated.height,
        fileName: resolveFileName(workingAsset.fileName),
        mimeType: DEFAULT_MIME_TYPE,
      });
      resetViewport();
    } catch (error) {
      Alert.alert('Erro', 'Nao foi possivel girar a imagem.');
      console.log('[ImageCanvasEditor] Rotate error:', error);
    } finally {
      setProcessing(false);
    }
  }, [resetViewport, workingAsset]);

  const buildEditedAsset = useCallback(async (): Promise<ImageCanvasAsset> => {
    if (!workingAsset?.uri) {
      throw new Error('Nenhuma imagem selecionada para editar.');
    }

    if (workingAsset.width <= 0 || workingAsset.height <= 0 || cropFrame.width <= 0 || cropFrame.height <= 0) {
      return {
        ...workingAsset,
        fileName: resolveFileName(workingAsset.fileName),
        mimeType: workingAsset.mimeType ?? DEFAULT_MIME_TYPE,
      };
    }

    const frameWidth = cropFrame.width;
    const frameHeight = cropFrame.height;
    const baseScale = Math.min(frameWidth / workingAsset.width, frameHeight / workingAsset.height);
    const scale = baseScale * cropZoom;
    const displayedWidth = workingAsset.width * scale;
    const displayedHeight = workingAsset.height * scale;
    const imageLeft = (frameWidth - displayedWidth) / 2 + cropPan.x;
    const imageTop = (frameHeight - displayedHeight) / 2 + cropPan.y;

    let cropWidth = Math.floor(frameWidth / scale);
    let cropHeight = Math.floor(frameHeight / scale);
    let originX = Math.floor((0 - imageLeft) / scale);
    let originY = Math.floor((0 - imageTop) / scale);

    originX = clamp(originX, 0, Math.max(0, workingAsset.width - cropWidth));
    originY = clamp(originY, 0, Math.max(0, workingAsset.height - cropHeight));
    cropWidth = clamp(cropWidth, 80, workingAsset.width - originX);
    cropHeight = clamp(cropHeight, 80, workingAsset.height - originY);

    const edited = await ImageManipulator.manipulateAsync(
      workingAsset.uri,
      [{ crop: { originX, originY, width: cropWidth, height: cropHeight } }],
      { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG },
    );

    return {
      uri: edited.uri,
      width: edited.width,
      height: edited.height,
      fileName: resolveFileName(workingAsset.fileName),
      mimeType: DEFAULT_MIME_TYPE,
    };
  }, [cropFrame.height, cropFrame.width, cropPan.x, cropPan.y, cropZoom, workingAsset]);

  const handleConfirm = useCallback(async () => {
    if (!session) return;

    try {
      setProcessing(true);
      const editedAsset = await buildEditedAsset();
      await session.onConfirm(editedAsset);
      onClose();
    } catch (error) {
      console.log('[ImageCanvasEditor] Confirm error:', error);
    } finally {
      setProcessing(false);
    }
  }, [buildEditedAsset, onClose, session]);

  return (
    <Modal visible={Boolean(session)} animationType="fade" transparent onRequestClose={processing ? undefined : onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>{session?.title || 'Editar imagem'}</Text>
              {session?.description ? <Text style={styles.description}>{session.description}</Text> : null}
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={processing ? undefined : onClose} disabled={processing} activeOpacity={0.8}>
              <X size={20} color={Colors.dark.text} />
            </TouchableOpacity>
          </View>

          <View
            style={[styles.previewFrame, { aspectRatio }]}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setCropFrame({ width, height });
            }}
            {...panResponder.panHandlers}
          >
            {workingAsset?.uri ? (
              <Image
                source={{ uri: workingAsset.uri }}
                style={[
                  styles.previewImage,
                  { transform: [{ translateX: cropPan.x }, { translateY: cropPan.y }, { scale: cropZoom }] },
                ]}
                resizeMode="contain"
              />
            ) : null}

            {workingAsset?.width && workingAsset?.height ? (
              <View style={styles.sizeBadge}>
                <Text style={styles.sizeBadgeText}>{workingAsset.width} x {workingAsset.height}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.hint}>Arraste a imagem para mover e use os botoes para zoom e rotacao.</Text>

          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.controlButton} onPress={zoomOut} disabled={processing} activeOpacity={0.85}>
              <Minus size={16} color={Colors.dark.text} />
              <Text style={styles.controlButtonText}>Zoom</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={zoomIn} disabled={processing} activeOpacity={0.85}>
              <Plus size={16} color={Colors.dark.text} />
              <Text style={styles.controlButtonText}>Zoom</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={rotateImage} disabled={processing} activeOpacity={0.85}>
              <RotateCw size={16} color={Colors.dark.text} />
              <Text style={styles.controlButtonText}>Girar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={resetViewport} disabled={processing} activeOpacity={0.85}>
              <Text style={styles.controlButtonReset}>Reset</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.confirmButton, processing && styles.confirmButtonDisabled]} onPress={handleConfirm} disabled={processing} activeOpacity={0.85}>
            <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={styles.confirmButtonGradient}>
              {processing ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <CheckCircle size={18} color="#000" />
                  <Text style={styles.confirmButtonText}>{session?.confirmLabel || 'USAR ESTA IMAGEM'}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  container: { width: '100%', maxWidth: 560, backgroundColor: Colors.dark.card, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  headerTextWrap: { flex: 1 },
  title: { color: Colors.dark.text, fontSize: 18, fontWeight: '800' as const },
  description: { color: Colors.dark.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 4 },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark.surfaceLight },
  previewFrame: { width: '100%', borderRadius: 18, overflow: 'hidden', backgroundColor: Colors.dark.background, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  previewImage: { width: '100%', height: '100%' },
  sizeBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.68)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  sizeBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' as const },
  hint: { color: Colors.dark.textSecondary, fontSize: 12, textAlign: 'center' as const, marginTop: 12, marginBottom: 14 },
  controlsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  controlButton: { flex: 1, minWidth: 110, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.dark.surfaceLight, borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  controlButtonText: { color: Colors.dark.text, fontSize: 13, fontWeight: '600' as const },
  controlButtonReset: { color: Colors.dark.text, fontSize: 13, fontWeight: '700' as const },
  confirmButton: { borderRadius: 14, overflow: 'hidden' },
  confirmButtonDisabled: { opacity: 0.7 },
  confirmButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  confirmButtonText: { color: '#000', fontSize: 15, fontWeight: '900' as const, letterSpacing: 0.3 },
});