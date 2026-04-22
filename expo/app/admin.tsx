// Admin Panel - Full sponsor management, coupon batches, notifications and database sync
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Modal,
  KeyboardAvoidingView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  Shield,
  Users,
  Store,
  Gift,
  Trophy,
  Trash2,
  Edit3,
  Plus,
  Save,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  DollarSign,
  Bell,
  BarChart3,
  X,
  BadgeCheck,
  ImageIcon,
  Calendar,
  Ticket,
  Filter,
  MapPin,
  Hash,
  Send,
  Copy,
  Check,
  CircleDot,
  Package,
  Printer,
  Globe,
  Building2,
  Map,
  Eye,
  PlayCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import Colors from '@/constants/colors';
import ImageCanvasEditorModal, { mapPickerAssetToImageCanvasAsset, type ImageCanvasEditorSession } from '@/components/ImageCanvasEditorModal';
import { formatCPF, formatPhone, formatPixKeyValue } from '@/lib/formatters';
import {
  getAdminImageBucketName,
  getAdminImageStorageSetupInstructions,
  getAdminImageStorageSetupSql,
  isAdminImageBucketMissingError,
  isAdminImageStoragePolicyError,
  uploadAdminImage,
} from '@/lib/adminMedia';
import {
  formatVideoDuration,
  getSponsorVideoBucketName,
  getSponsorVideoStorageSetupInstructions,
  getSponsorVideoStorageSetupSql,
  isSponsorVideoBucketMissingError,
  isSponsorVideoStoragePolicyError,
  uploadSponsorPromotionalVideo,
} from '@/lib/sponsorMedia';
import { ALL_CITY_OPTIONS, STATES } from '@/mocks/cities';
import { useAdmin } from '@/providers/AdminProvider';
import { useSponsor } from '@/providers/SponsorProvider';
import { useUser } from '@/providers/UserProvider';
import { upsertUserServerOnly } from '@/services/database';
import type { Sponsor, CouponBatch, AdminNotification, SponsorImage, SponsorVideo, GrandPrize, PromotionalQR, ManagedCity, UserProfile } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');
const MAX_PROMOTIONAL_VIDEOS = 5;
const MAX_PROMOTIONAL_VIDEO_BYTES = 50 * 1024 * 1024;

type MainTab = 'overview' | 'states' | 'cities';
type CitySubTab = 'prize' | 'sponsors' | 'coupons' | 'notifications' | 'promoqr';
type UserReviewStatus = 'pending' | 'approved' | 'rejected';
type UserReviewRow = { profile: UserProfile; balance: number; points: number };

function getUserDisplayName(profile: UserProfile): string {
  return profile.name.trim() || profile.email.trim() || 'Usuario sem nome';
}

function getUserReviewStatus(profile: UserProfile): UserReviewStatus {
  if (profile.adminReviewStatus === 'approved' || profile.adminReviewStatus === 'rejected' || profile.adminReviewStatus === 'pending') {
    return profile.adminReviewStatus;
  }

  if (profile.adminReviewedAt) {
    return profile.isActive === false ? 'rejected' : 'approved';
  }

  return 'pending';
}

function getUserReviewStatusMeta(status: UserReviewStatus): { label: string; backgroundColor: string; textColor: string } {
  if (status === 'approved') {
    return {
      label: 'Ativo',
      backgroundColor: 'rgba(16,185,129,0.12)',
      textColor: Colors.dark.success,
    };
  }

  if (status === 'rejected') {
    return {
      label: 'Desativado',
      backgroundColor: 'rgba(239,68,68,0.1)',
      textColor: Colors.dark.danger,
    };
  }

  return {
    label: 'Pendente',
    backgroundColor: 'rgba(245,158,11,0.12)',
    textColor: Colors.dark.warning,
  };
}

function formatDateTime(value?: string): string {
  if (!value) return 'Nao informado';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Nao informado';

  return parsed.toLocaleString('pt-BR');
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function formatUserLocation(profile: UserProfile): string {
  const parts = [profile.city.trim(), profile.state.trim()].filter(Boolean);
  return parts.length ? parts.join(' - ') : 'Cidade nao informada';
}

function ReviewStatusBadge({ profile }: { profile: UserProfile }) {
  const meta = getUserReviewStatusMeta(getUserReviewStatus(profile));

  return (
    <View style={[ur.statusBadge, { backgroundColor: meta.backgroundColor }]}>
      <Text style={[ur.statusBadgeText, { color: meta.textColor }]}>{meta.label}</Text>
    </View>
  );
}

function ReviewDetailItem({ label, value, multiline = false }: { label: string; value?: string | number | null; multiline?: boolean }) {
  const resolved = value === undefined || value === null || `${value}`.trim() === '' ? 'Nao informado' : `${value}`;

  return (
    <View style={ur.detailItem}>
      <Text style={ur.detailLabel}>{label}</Text>
      <Text style={[ur.detailValue, multiline && ur.detailValueMultiline]}>{resolved}</Text>
    </View>
  );
}

function TabButton({ label, active, onPress, icon: Icon }: { label: string; active: boolean; onPress: () => void; icon: React.ElementType }) {
  return (
    <TouchableOpacity
      style={[tb.btn, active && tb.btnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Icon size={16} color={active ? '#000' : Colors.dark.textMuted} />
      <Text style={[tb.txt, active && tb.txtActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const tb = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.dark.surfaceLight },
  btnActive: { backgroundColor: Colors.dark.neonGreen },
  txt: { color: Colors.dark.textMuted, fontSize: 12, fontWeight: '600' as const },
  txtActive: { color: '#000', fontWeight: '700' as const },
});

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <View style={a.statCard}>
      <View style={[a.statIcon, { backgroundColor: color + '18' }]}>
        <Icon size={20} color={color} />
      </View>
      <Text style={a.statVal}>{value}</Text>
      <Text style={a.statLbl}>{label}</Text>
    </View>
  );
}

function SponsorRow({ sponsor, onEdit, onDelete }: { sponsor: Sponsor; onEdit: () => void; onDelete: () => void }) {
  return (
    <View style={a.spRow}>
      <Image source={{ uri: sponsor.logoUrl }} style={a.spLogo} contentFit="cover" cachePolicy="memory-disk" />
      <View style={a.spInfo}>
        <View style={a.spNameRow}>
          <Text style={a.spName} numberOfLines={1}>{sponsor.name}</Text>
          {sponsor.verified && <BadgeCheck size={14} color={Colors.dark.neonGreen} />}
        </View>
        <Text style={a.spMeta}>{sponsor.category} - {sponsor.city}, {sponsor.state}</Text>
        <Text style={a.spOffers}>{sponsor.offers.length} ofertas - Cupom: R$ {sponsor.couponValue ?? 0}</Text>
      </View>
      <View style={a.spActions}>
        <TouchableOpacity style={a.spActBtn} onPress={onEdit} testID={`edit-sponsor-${sponsor.id}`}>
          <Edit3 size={16} color={Colors.dark.neonGreen} />
        </TouchableOpacity>
        <TouchableOpacity style={[a.spActBtn, a.spActDel]} onPress={onDelete} testID={`delete-sponsor-${sponsor.id}`}>
          <Trash2 size={16} color={Colors.dark.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface OfferFormItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  discount: string;
}

interface SponsorFormData {
  name: string;
  category: string;
  imageUrl: string;
  logoUrl: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  description: string;
  minPurchaseValue: string;
  couponValue: string;
  verified: boolean;
  latitude: string;
  longitude: string;
  galleryImages: SponsorImage[];
  promotionalVideos: SponsorVideo[];
  offers: OfferFormItem[];
}

type SponsorFormSectionKey = 'basic' | 'images' | 'videos' | 'offers' | 'gallery' | 'address' | 'coupon';

function getInitialSponsorFormSections(): Record<SponsorFormSectionKey, boolean> {
  return {
    basic: false,
    images: false,
    videos: false,
    offers: false,
    gallery: false,
    address: false,
    coupon: false,
  };
}

const emptySponsorForm: SponsorFormData = {
  name: '',
  category: '',
  imageUrl: '',
  logoUrl: '',
  address: '',
  city: 'Sao Paulo',
  state: 'SP',
  phone: '',
  description: '',
  minPurchaseValue: '50',
  couponValue: '10',
  verified: false,
  latitude: '-23.5505',
  longitude: '-46.6333',
  galleryImages: [],
  promotionalVideos: [],
  offers: [],
};

function SponsorFormModal({
  visible,
  onClose,
  onSave,
  initialData,
  sponsorId,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (data: SponsorFormData) => void;
  initialData: SponsorFormData;
  sponsorId: string;
  title: string;
}) {
  const [form, setForm] = useState<SponsorFormData>(initialData);
  const insets = useSafeAreaInsets();
  const [newImgPrice, setNewImgPrice] = useState<string>('');
  const [newImgLabel, setNewImgLabel] = useState<string>('');
  const [newVideoTitle, setNewVideoTitle] = useState<string>('');
  const [uploadingVideo, setUploadingVideo] = useState<boolean>(false);
  const [editingOfferIdx, setEditingOfferIdx] = useState<number | null>(null);
  const [offerTitle, setOfferTitle] = useState<string>('');
  const [offerDesc, setOfferDesc] = useState<string>('');
  const [offerDiscount, setOfferDiscount] = useState<string>('');
  const [offerImageUrl, setOfferImageUrl] = useState<string>('');
  const [loadingLocation, setLoadingLocation] = useState<boolean>(false);
  const [imageCanvasSession, setImageCanvasSession] = useState<ImageCanvasEditorSession | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<SponsorFormSectionKey, boolean>>(() => getInitialSponsorFormSections());

  const updateField = useCallback((key: keyof SponsorFormData, value: string | boolean | SponsorImage[] | SponsorVideo[] | OfferFormItem[]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const copySponsorVideoStorageSql = useCallback(async () => {
    await Clipboard.setStringAsync(getSponsorVideoStorageSetupSql());
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert(
      'SQL copiado',
      `Cole o SQL no SQL Editor do Supabase para criar o bucket \"${getSponsorVideoBucketName()}\" e liberar os uploads.`,
    );
  }, []);

  const showSponsorVideoStorageSetupAlert = useCallback((message?: string) => {
    Alert.alert(
      'Storage de videos nao configurado',
      `${message || getSponsorVideoStorageSetupInstructions()}\n\nUse \"Copiar SQL do Storage\" e execute o script uma vez no SQL Editor do Supabase.`,
      [
        { text: 'Agora nao', style: 'cancel' },
        {
          text: 'Copiar SQL',
          onPress: () => {
            void copySponsorVideoStorageSql();
          },
        },
      ],
    );
  }, [copySponsorVideoStorageSql]);

  const getCurrentLocation = useCallback(async () => {
    try {
      setLoadingLocation(true);
      if (Platform.OS === 'web') {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              updateField('latitude', position.coords.latitude.toString());
              updateField('longitude', position.coords.longitude.toString());
              setLoadingLocation(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
            () => {
              setLoadingLocation(false);
              Alert.alert('Erro', 'Nao foi possivel obter a localizacao');
            }
          );
        } else {
          setLoadingLocation(false);
          Alert.alert('Erro', 'Geolocalizacao nao suportada neste navegador');
        }
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoadingLocation(false);
        Alert.alert('Permissao negada', 'Permita o acesso a localizacao para usar esta funcao');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      updateField('latitude', loc.coords.latitude.toString());
      updateField('longitude', loc.coords.longitude.toString());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Erro', 'Nao foi possivel obter a localizacao');
    } finally {
      setLoadingLocation(false);
    }
  }, [updateField]);

  const pickImage = useCallback(async (field: 'imageUrl' | 'logoUrl') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setImageCanvasSession({
        asset: mapPickerAssetToImageCanvasAsset(result.assets[0]),
        title: field === 'logoUrl' ? 'Editar logo' : 'Editar imagem principal',
        description: 'Ajuste a imagem antes de usar no patrocinador.',
        aspectRatio: field === 'logoUrl' ? 1 : 16 / 9,
        confirmLabel: field === 'logoUrl' ? 'USAR ESTE LOGO' : 'USAR ESTA IMAGEM',
        onConfirm: async (editedAsset) => {
          updateField(field, editedAsset.uri);
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      });
    }
  }, [updateField]);

  const pickGalleryImage = useCallback(async () => {
    if (form.galleryImages.length >= 10) {
      Alert.alert('Limite', 'Maximo de 10 imagens por patrocinador');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setImageCanvasSession({
        asset: mapPickerAssetToImageCanvasAsset(result.assets[0]),
        title: 'Editar imagem da galeria',
        description: 'Ajuste a imagem quadrada antes de adicionar na galeria.',
        aspectRatio: 1,
        confirmLabel: 'ADICIONAR NA GALERIA',
        onConfirm: async (editedAsset) => {
          const newImg: SponsorImage = {
            id: `img_${Date.now()}`,
            url: editedAsset.uri,
            price: newImgPrice ? parseFloat(newImgPrice) : undefined,
            label: newImgLabel.trim() || undefined,
          };
          updateField('galleryImages', [...form.galleryImages, newImg]);
          setNewImgPrice('');
          setNewImgLabel('');
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      });
    }
  }, [form.galleryImages, newImgPrice, newImgLabel, updateField]);

  const handleRemoveGalleryImage = useCallback((imgId: string) => {
    updateField('galleryImages', form.galleryImages.filter((img) => img.id !== imgId));
  }, [form.galleryImages, updateField]);

  const handleRemovePromotionalVideo = useCallback((videoId: string) => {
    updateField('promotionalVideos', form.promotionalVideos.filter((video) => video.id !== videoId));
  }, [form.promotionalVideos, updateField]);

  const pickPromotionalVideo = useCallback(async () => {
    if (uploadingVideo) return;

    if (form.promotionalVideos.length >= MAX_PROMOTIONAL_VIDEOS) {
      Alert.alert('Limite', `Maximo de ${MAX_PROMOTIONAL_VIDEOS} videos por patrocinador`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return;
    }

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_PROMOTIONAL_VIDEO_BYTES) {
      Alert.alert('Arquivo muito grande', 'Escolha um video de ate 50 MB para upload');
      return;
    }

    try {
      setUploadingVideo(true);
      const uploadedVideo = await uploadSponsorPromotionalVideo({
        sponsorId: sponsorId || form.name.trim() || `draft_${Date.now()}`,
        fileUri: asset.uri,
        fileName: asset.fileName || undefined,
        mimeType: asset.mimeType || undefined,
        title: newVideoTitle.trim() || undefined,
        durationSeconds: asset.duration ? asset.duration / 1000 : undefined,
      });

      updateField('promotionalVideos', [...form.promotionalVideos, uploadedVideo]);
      setNewVideoTitle('');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Nao foi possivel enviar o video para o Supabase';

      if (isSponsorVideoBucketMissingError(error) || isSponsorVideoStoragePolicyError(error)) {
        showSponsorVideoStorageSetupAlert(errorMessage);
      } else {
        Alert.alert('Falha no upload', errorMessage);
      }
    } finally {
      setUploadingVideo(false);
    }
  }, [form.name, form.promotionalVideos, newVideoTitle, showSponsorVideoStorageSetupAlert, sponsorId, updateField, uploadingVideo]);

  const handleSave = useCallback(() => {
    if (uploadingVideo) {
      Alert.alert('Upload em andamento', 'Aguarde a conclusao do upload do video antes de salvar');
      return;
    }
    if (!form.name.trim()) {
      Alert.alert('Erro', 'Nome e obrigatorio');
      return;
    }
    if (!form.category.trim()) {
      Alert.alert('Erro', 'Categoria e obrigatoria');
      return;
    }
    onSave(form);
  }, [form, onSave, uploadingVideo]);

  const resetOfferFields = useCallback(() => {
    setEditingOfferIdx(null);
    setOfferTitle('');
    setOfferDesc('');
    setOfferDiscount('');
    setOfferImageUrl('');
  }, []);

  const handleAddOffer = useCallback(() => {
    if (!offerTitle.trim()) {
      Alert.alert('Erro', 'Titulo da promocao e obrigatorio');
      return;
    }
    if (editingOfferIdx !== null) {
      const updated = [...form.offers];
      updated[editingOfferIdx] = {
        ...updated[editingOfferIdx],
        title: offerTitle.trim(),
        description: offerDesc.trim(),
        discount: offerDiscount.trim(),
        imageUrl: offerImageUrl.trim(),
      };
      updateField('offers', updated);
    } else {
      const newOffer: OfferFormItem = {
        id: `offer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: offerTitle.trim(),
        description: offerDesc.trim(),
        discount: offerDiscount.trim(),
        imageUrl: offerImageUrl.trim(),
      };
      updateField('offers', [...form.offers, newOffer]);
    }
    resetOfferFields();
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [offerTitle, offerDesc, offerDiscount, offerImageUrl, editingOfferIdx, form.offers, updateField, resetOfferFields]);

  const handleEditOffer = useCallback((idx: number) => {
    const o = form.offers[idx];
    setEditingOfferIdx(idx);
    setOfferTitle(o.title);
    setOfferDesc(o.description);
    setOfferDiscount(o.discount);
    setOfferImageUrl(o.imageUrl);
  }, [form.offers]);

  const handleRemoveOffer = useCallback((idx: number) => {
    const updated = form.offers.filter((_, i) => i !== idx);
    updateField('offers', updated);
    if (editingOfferIdx === idx) resetOfferFields();
  }, [form.offers, updateField, editingOfferIdx, resetOfferFields]);

  const pickOfferImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setImageCanvasSession({
        asset: mapPickerAssetToImageCanvasAsset(result.assets[0]),
        title: 'Editar imagem da promocao',
        description: 'Ajuste a arte da promocao antes de salvar.',
        aspectRatio: 16 / 9,
        confirmLabel: 'USAR NA PROMOCAO',
        onConfirm: async (editedAsset) => {
          setOfferImageUrl(editedAsset.uri);
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      });
    }
  }, []);

  const toggleSection = useCallback((section: SponsorFormSectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const renderSponsorSection = (
    section: SponsorFormSectionKey,
    title: string,
    children: React.ReactNode,
    subtitle?: string,
  ) => {
    const expanded = expandedSections[section];

    return (
      <View style={fm.section}>
        <TouchableOpacity style={fm.sectionToggle} onPress={() => toggleSection(section)} activeOpacity={0.8}>
          <Text style={fm.sectionToggleTitle}>{title}</Text>
          {expanded ? <ChevronDown size={18} color={Colors.dark.textMuted} /> : <ChevronRight size={18} color={Colors.dark.textMuted} />}
        </TouchableOpacity>
        {expanded ? (
          <View style={fm.sectionBody}>
            {subtitle ? <Text style={fm.sectionSub}>{subtitle}</Text> : null}
            {children}
          </View>
        ) : null}
      </View>
    );
  };

  React.useEffect(() => {
    if (visible) {
      setForm(initialData);
      setNewImgPrice('');
      setNewImgLabel('');
      setNewVideoTitle('');
      setUploadingVideo(false);
      setImageCanvasSession(null);
      setExpandedSections(getInitialSponsorFormSections());
      resetOfferFields();
    }
  }, [visible, initialData, resetOfferFields]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={fm.container}
      >
        <View style={[fm.header, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={fm.closeBtn}>
            <X size={22} color={Colors.dark.text} />
          </TouchableOpacity>
          <Text style={fm.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={handleSave} style={fm.saveHeaderBtn}>
            <Text style={fm.saveHeaderTxt}>Salvar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={fm.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {renderSponsorSection('basic', 'Informacoes Basicas', (
            <>
              <View style={fm.field}>
                <Text style={fm.label}>Nome da Loja *</Text>
                <TextInput style={fm.input} value={form.name} onChangeText={(v) => updateField('name', v)} placeholder="Ex: Supermercado Bom Preco" placeholderTextColor={Colors.dark.textMuted} testID="sponsor-name-input" />
              </View>
              <View style={fm.field}>
                <Text style={fm.label}>Categoria *</Text>
                <TextInput style={fm.input} value={form.category} onChangeText={(v) => updateField('category', v)} placeholder="Ex: Supermercado, Farmacia" placeholderTextColor={Colors.dark.textMuted} testID="sponsor-category-input" />
              </View>
              <View style={fm.field}>
                <Text style={fm.label}>Descricao</Text>
                <TextInput style={[fm.input, fm.textArea]} value={form.description} onChangeText={(v) => updateField('description', v)} placeholder="Breve descricao da loja" placeholderTextColor={Colors.dark.textMuted} multiline numberOfLines={3} testID="sponsor-desc-input" />
              </View>
            </>
          ))}

          {renderSponsorSection('images', 'Imagens Principais', (
            <>
              <View style={fm.field}>
                <Text style={fm.label}>Imagem Principal</Text>
                <TouchableOpacity style={fm.uploadBtn} onPress={() => pickImage('imageUrl')} activeOpacity={0.8} testID="sponsor-image-input">
                  {form.imageUrl ? (
                    <Image source={{ uri: form.imageUrl }} style={fm.uploadPreview} contentFit="cover" />
                  ) : (
                    <View style={fm.uploadPlaceholder}>
                      <ImageIcon size={28} color={Colors.dark.neonGreen} />
                      <Text style={fm.uploadPlaceholderTxt}>Toque para escolher foto</Text>
                    </View>
                  )}
                  {form.imageUrl ? (
                    <View style={fm.uploadOverlay}>
                      <ImageIcon size={14} color="#fff" />
                      <Text style={fm.uploadOverlayTxt}>Trocar Foto</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              </View>
              <View style={fm.field}>
                <Text style={fm.label}>Logo</Text>
                <TouchableOpacity style={fm.uploadLogoBtn} onPress={() => pickImage('logoUrl')} activeOpacity={0.8} testID="sponsor-logo-input">
                  {form.logoUrl ? (
                    <Image source={{ uri: form.logoUrl }} style={fm.uploadLogoPreview} contentFit="cover" />
                  ) : (
                    <View style={fm.uploadLogoPlaceholder}>
                      <ImageIcon size={22} color={Colors.dark.neonGreen} />
                    </View>
                  )}
                  <View style={fm.uploadLogoInfo}>
                    <Text style={fm.uploadLogoTxt}>{form.logoUrl ? 'Trocar logo' : 'Escolher logo'}</Text>
                    <Text style={fm.uploadLogoSub}>Formato quadrado recomendado</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          ))}

          {renderSponsorSection(
            'videos',
            `Videos Promocionais (${form.promotionalVideos.length}/${MAX_PROMOTIONAL_VIDEOS})`,
            <>
              {form.promotionalVideos.map((video) => (
                <View key={video.id} style={fm.videoItem}>
                  <View style={fm.videoThumbPlaceholder}>
                    <PlayCircle size={20} color={Colors.dark.neonGreen} />
                  </View>
                  <View style={fm.videoInfo}>
                    <Text style={fm.videoTitle} numberOfLines={1}>{video.title || video.fileName || 'Video promocional'}</Text>
                    <Text style={fm.videoMeta} numberOfLines={1}>
                      {formatVideoDuration(video.durationSeconds)}
                      {video.fileName ? ` • ${video.fileName}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemovePromotionalVideo(video.id)} style={fm.galleryRemove}>
                    <X size={14} color={Colors.dark.danger} />
                  </TouchableOpacity>
                </View>
              ))}

              {form.promotionalVideos.length < MAX_PROMOTIONAL_VIDEOS && (
                <View style={fm.addImgSection}>
                  <View style={fm.field}>
                    <Text style={fm.label}>Titulo do Video (opcional)</Text>
                    <TextInput
                      style={fm.input}
                      value={newVideoTitle}
                      onChangeText={setNewVideoTitle}
                      placeholder="Ex: Tour da loja, ofertas da semana"
                      placeholderTextColor={Colors.dark.textMuted}
                    />
                  </View>
                  <TouchableOpacity
                    style={[fm.addVideoBtn, uploadingVideo && fm.addVideoBtnDisabled]}
                    onPress={pickPromotionalVideo}
                    activeOpacity={0.8}
                    disabled={uploadingVideo}
                  >
                    {uploadingVideo ? <ActivityIndicator color="#000" size="small" /> : <PlayCircle size={16} color="#000" />}
                    <Text style={[fm.addVideoBtnTxt, uploadingVideo && fm.addVideoBtnTxtDisabled]}>
                      {uploadingVideo ? 'Enviando video...' : 'Escolher e enviar video'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={fm.videoSetupBtn}
                    onPress={() => {
                      void copySponsorVideoStorageSql();
                    }}
                    activeOpacity={0.8}
                  >
                    <Copy size={14} color={Colors.dark.neonGreen} />
                    <Text style={fm.videoSetupBtnTxt}>Copiar SQL do Storage</Text>
                  </TouchableOpacity>
                  <Text style={fm.videoHint}>
                    Bucket atual: {getSponsorVideoBucketName()}. Se o upload falhar, execute esse SQL no Supabase para criar o bucket e liberar leitura/upload para o app.
                  </Text>
                </View>
              )}
            </>,
            'Envie videos da loja para salvar no Supabase e exibir no perfil publico',
          )}

          {renderSponsorSection(
            'offers',
            `Promocoes / Ofertas (${form.offers.length})`,
            <>
              {form.offers.map((offer, idx) => (
                <View key={offer.id} style={fm.offerItem}>
                  {offer.imageUrl ? (
                    <Image source={{ uri: offer.imageUrl }} style={fm.offerThumb} contentFit="cover" />
                  ) : (
                    <View style={[fm.offerThumb, fm.offerThumbPlaceholder]}>
                      <Gift size={16} color={Colors.dark.textMuted} />
                    </View>
                  )}
                  <View style={fm.offerInfo}>
                    <Text style={fm.offerTitle} numberOfLines={1}>{offer.title}</Text>
                    {offer.discount ? <Text style={fm.offerDiscount}>{offer.discount}</Text> : null}
                    {offer.description ? <Text style={fm.offerDesc} numberOfLines={1}>{offer.description}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => handleEditOffer(idx)} style={fm.offerEditBtn}>
                    <Edit3 size={13} color={Colors.dark.neonGreen} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleRemoveOffer(idx)} style={fm.galleryRemove}>
                    <X size={14} color={Colors.dark.danger} />
                  </TouchableOpacity>
                </View>
              ))}

              <View style={fm.addImgSection}>
                <Text style={[fm.label, { marginBottom: 2 }]}>{editingOfferIdx !== null ? 'Editando Promocao' : 'Nova Promocao'}</Text>
                <View style={fm.field}>
                  <Text style={fm.label}>Titulo *</Text>
                  <TextInput style={fm.input} value={offerTitle} onChangeText={setOfferTitle} placeholder="Ex: 20% OFF em toda a loja" placeholderTextColor={Colors.dark.textMuted} testID="offer-title-input" />
                </View>
                <View style={fm.field}>
                  <Text style={fm.label}>Desconto</Text>
                  <TextInput style={fm.input} value={offerDiscount} onChangeText={setOfferDiscount} placeholder="Ex: 20% OFF, R$ 10 desconto" placeholderTextColor={Colors.dark.textMuted} />
                </View>
                <View style={fm.field}>
                  <Text style={fm.label}>Descricao</Text>
                  <TextInput style={[fm.input, { minHeight: 60, textAlignVertical: 'top' as const }]} value={offerDesc} onChangeText={setOfferDesc} placeholder="Descricao da promocao" placeholderTextColor={Colors.dark.textMuted} multiline />
                </View>
                <View style={fm.field}>
                  <Text style={fm.label}>Imagem da Promocao</Text>
                  <TouchableOpacity style={fm.offerImgPickBtn} onPress={pickOfferImage} activeOpacity={0.8}>
                    {offerImageUrl ? (
                      <Image source={{ uri: offerImageUrl }} style={fm.offerImgPreview} contentFit="cover" />
                    ) : (
                      <View style={fm.offerImgPlaceholder}>
                        <ImageIcon size={20} color={Colors.dark.neonGreen} />
                        <Text style={fm.offerImgPlaceholderTxt}>Escolher Imagem</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
                <View style={fm.offerBtnRow}>
                  <TouchableOpacity style={fm.offerSaveBtn} onPress={handleAddOffer} activeOpacity={0.8}>
                    <Save size={14} color="#000" />
                    <Text style={fm.offerSaveBtnTxt}>{editingOfferIdx !== null ? 'Atualizar' : 'Adicionar'}</Text>
                  </TouchableOpacity>
                  {editingOfferIdx !== null && (
                    <TouchableOpacity style={fm.offerCancelBtn} onPress={resetOfferFields} activeOpacity={0.8}>
                      <X size={14} color={Colors.dark.textMuted} />
                      <Text style={fm.offerCancelBtnTxt}>Cancelar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </>,
            'Adicione promocoes e ofertas que aparecerao no perfil da loja',
          )}

          {renderSponsorSection(
            'gallery',
            `Galeria de Imagens (${form.galleryImages.length}/10)`,
            <>
              {form.galleryImages.map((img) => (
                <View key={img.id} style={fm.galleryItem}>
                  <Image source={{ uri: img.url }} style={fm.galleryThumb} contentFit="cover" />
                  <View style={fm.galleryInfo}>
                    <Text style={fm.galleryLabel} numberOfLines={1}>{img.label || 'Sem titulo'}</Text>
                    {img.price !== undefined && <Text style={fm.galleryPrice}>R$ {img.price.toFixed(2)}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveGalleryImage(img.id)} style={fm.galleryRemove}>
                    <X size={14} color={Colors.dark.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              {form.galleryImages.length < 10 && (
                <View style={fm.addImgSection}>
                  <View style={fm.row}>
                    <View style={[fm.field, { flex: 1 }]}>
                      <Text style={fm.label}>Titulo</Text>
                      <TextInput style={fm.input} value={newImgLabel} onChangeText={setNewImgLabel} placeholder="Ex: Produto A" placeholderTextColor={Colors.dark.textMuted} />
                    </View>
                    <View style={[fm.field, { width: 100 }]}>
                      <Text style={fm.label}>Preco (R$)</Text>
                      <TextInput style={fm.input} value={newImgPrice} onChangeText={setNewImgPrice} placeholder="0.00" placeholderTextColor={Colors.dark.textMuted} keyboardType="numeric" />
                    </View>
                  </View>
                  <TouchableOpacity style={fm.addImgBtn} onPress={pickGalleryImage} activeOpacity={0.8}>
                    <ImageIcon size={14} color={Colors.dark.neonGreen} />
                    <Text style={fm.addImgBtnTxt}>Escolher Foto da Galeria</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>,
            'Adicione ate 10 imagens com precos para exibir no perfil',
          )}

          {renderSponsorSection('address', 'Endereco Completo', (
            <>
              <View style={fm.field}>
                <Text style={fm.label}>Endereco</Text>
                <TextInput style={fm.input} value={form.address} onChangeText={(v) => updateField('address', v)} placeholder="Rua, numero, bairro" placeholderTextColor={Colors.dark.textMuted} />
              </View>
              <View style={fm.row}>
                <View style={[fm.field, { flex: 1 }]}>
                  <Text style={fm.label}>Cidade</Text>
                  <TextInput style={fm.input} value={form.city} onChangeText={(v) => updateField('city', v)} placeholder="Sao Paulo" placeholderTextColor={Colors.dark.textMuted} />
                </View>
                <View style={[fm.field, { width: 80 }]}>
                  <Text style={fm.label}>Estado</Text>
                  <TextInput style={fm.input} value={form.state} onChangeText={(v) => updateField('state', v)} placeholder="SP" placeholderTextColor={Colors.dark.textMuted} maxLength={2} autoCapitalize="characters" />
                </View>
              </View>
              <View style={fm.field}>
                <Text style={fm.label}>Telefone</Text>
                <TextInput style={fm.input} value={formatPhone(form.phone)} onChangeText={(v) => updateField('phone', formatPhone(v))} placeholder="(11) 99999-0000" placeholderTextColor={Colors.dark.textMuted} keyboardType="phone-pad" />
              </View>
              <View style={fm.field}>
                <Text style={fm.label}>Localizacao</Text>
                <TouchableOpacity style={fm.locationBtn} onPress={getCurrentLocation} activeOpacity={0.7} disabled={loadingLocation}>
                  <MapPin size={18} color={Colors.dark.neonGreen} />
                  <Text style={fm.locationBtnText}>{loadingLocation ? 'Obtendo localizacao...' : 'Usar local atual'}</Text>
                </TouchableOpacity>
                {form.latitude && form.longitude && form.latitude !== '-23.5505' ? (
                  <Text style={fm.locationInfo}>Lat: {parseFloat(form.latitude).toFixed(6)}  |  Lng: {parseFloat(form.longitude).toFixed(6)}</Text>
                ) : null}
              </View>
            </>
          ))}

          {renderSponsorSection('coupon', 'Cupom e Valores', (
            <>
              <View style={fm.row}>
                <View style={[fm.field, { flex: 1 }]}>
                  <Text style={fm.label}>Valor do Cupom (R$)</Text>
                  <TextInput style={fm.input} value={form.couponValue} onChangeText={(v) => updateField('couponValue', v)} placeholder="10" placeholderTextColor={Colors.dark.textMuted} keyboardType="numeric" />
                </View>
                <View style={[fm.field, { flex: 1 }]}>
                  <Text style={fm.label}>Compra Minima (R$)</Text>
                  <TextInput style={fm.input} value={form.minPurchaseValue} onChangeText={(v) => updateField('minPurchaseValue', v)} placeholder="50" placeholderTextColor={Colors.dark.textMuted} keyboardType="numeric" />
                </View>
              </View>
              <TouchableOpacity style={fm.toggleRow} onPress={() => updateField('verified', !form.verified)} activeOpacity={0.7}>
                <BadgeCheck size={18} color={form.verified ? Colors.dark.neonGreen : Colors.dark.textMuted} />
                <Text style={[fm.toggleLabel, form.verified && fm.toggleActive]}>Patrocinador Verificado</Text>
                <View style={[fm.toggleSwitch, form.verified && fm.toggleSwitchActive]}>
                  <View style={[fm.toggleDot, form.verified && fm.toggleDotActive]} />
                </View>
              </TouchableOpacity>
            </>
          ))}

          <TouchableOpacity style={fm.saveFullBtn} onPress={handleSave} activeOpacity={0.8}>
            <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={fm.saveFullGrad}>
              <Save size={18} color="#000" />
              <Text style={fm.saveFullTxt}>SALVAR PATROCINADOR</Text>
            </LinearGradient>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>

          <ImageCanvasEditorModal session={imageCanvasSession} onClose={() => setImageCanvasSession(null)} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const fm = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: Colors.dark.surface, borderBottomWidth: 1, borderBottomColor: Colors.dark.cardBorder },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.dark.text, fontSize: 17, fontWeight: '700' as const },
  saveHeaderBtn: { backgroundColor: Colors.dark.neonGreen, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  saveHeaderTxt: { color: '#000', fontSize: 14, fontWeight: '700' as const },
  scroll: { padding: 16 },
  section: { backgroundColor: Colors.dark.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  sectionToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionToggleTitle: { flex: 1, color: Colors.dark.text, fontSize: 15, fontWeight: '700' as const },
  sectionBody: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.dark.cardBorder },
  sectionTitle: { color: Colors.dark.text, fontSize: 15, fontWeight: '700' as const, marginBottom: 4 },
  sectionSub: { color: Colors.dark.textMuted, fontSize: 11, marginBottom: 14 },
  field: { marginBottom: 12 },
  label: { color: Colors.dark.textSecondary, fontSize: 12, fontWeight: '600' as const, marginBottom: 6 },
  input: { backgroundColor: Colors.dark.inputBg, borderRadius: 12, padding: 12, color: Colors.dark.text, fontSize: 14, borderWidth: 1, borderColor: Colors.dark.inputBorder },
  textArea: { minHeight: 80, textAlignVertical: 'top' as const },
  row: { flexDirection: 'row', gap: 10 },
  uploadBtn: { borderRadius: 14, overflow: 'hidden', height: 160, backgroundColor: Colors.dark.surfaceLight, borderWidth: 1, borderColor: Colors.dark.neonGreenFaint, borderStyle: 'dashed' as const, position: 'relative' as const },
  uploadPreview: { width: '100%', height: '100%', borderRadius: 14 },
  uploadPlaceholder: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8 },
  uploadPlaceholderTxt: { color: Colors.dark.neonGreen, fontSize: 13, fontWeight: '600' as const },
  uploadOverlay: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', paddingVertical: 8 },
  uploadOverlayTxt: { color: '#fff', fontSize: 12, fontWeight: '600' as const },
  uploadLogoBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, backgroundColor: Colors.dark.surfaceLight, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.dark.neonGreenFaint, borderStyle: 'dashed' as const },
  uploadLogoPreview: { width: 56, height: 56, borderRadius: 12, backgroundColor: Colors.dark.inputBg },
  uploadLogoPlaceholder: { width: 56, height: 56, borderRadius: 12, backgroundColor: Colors.dark.inputBg, alignItems: 'center' as const, justifyContent: 'center' as const },
  uploadLogoInfo: { flex: 1 },
  uploadLogoTxt: { color: Colors.dark.neonGreen, fontSize: 14, fontWeight: '600' as const },
  uploadLogoSub: { color: Colors.dark.textMuted, fontSize: 11, marginTop: 2 },
  galleryItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.surfaceLight, borderRadius: 10, padding: 8, marginBottom: 8, gap: 10 },
  galleryThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: Colors.dark.inputBg },
  galleryInfo: { flex: 1 },
  galleryLabel: { color: Colors.dark.text, fontSize: 13, fontWeight: '600' as const },
  galleryPrice: { color: Colors.dark.neonGreen, fontSize: 12, fontWeight: '700' as const, marginTop: 2 },
  galleryRemove: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center' },
  addImgSection: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.dark.cardBorder },
  addImgBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed' as const, borderColor: Colors.dark.neonGreen, marginTop: 4 },
  addImgBtnTxt: { color: Colors.dark.neonGreen, fontSize: 12, fontWeight: '600' as const },
  videoItem: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: Colors.dark.surfaceLight, borderRadius: 10, padding: 8, marginBottom: 8, gap: 10 },
  videoThumbPlaceholder: { width: 48, height: 48, borderRadius: 10, backgroundColor: Colors.dark.inputBg, alignItems: 'center' as const, justifyContent: 'center' as const },
  videoInfo: { flex: 1 },
  videoTitle: { color: Colors.dark.text, fontSize: 13, fontWeight: '700' as const },
  videoMeta: { color: Colors.dark.textMuted, fontSize: 11, marginTop: 2 },
  addVideoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.dark.neonGreen, paddingVertical: 12, borderRadius: 10 },
  addVideoBtnDisabled: { opacity: 0.7 },
  addVideoBtnTxt: { color: '#000', fontSize: 13, fontWeight: '700' as const },
  addVideoBtnTxtDisabled: { color: '#000' },
  videoSetupBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.dark.surfaceLight, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: Colors.dark.neonGreenFaint, marginTop: 10 },
  videoSetupBtnTxt: { color: Colors.dark.neonGreen, fontSize: 12, fontWeight: '700' as const },
  videoHint: { color: Colors.dark.textMuted, fontSize: 11, marginTop: 8, lineHeight: 16 },
  offerItem: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: Colors.dark.surfaceLight, borderRadius: 10, padding: 8, marginBottom: 8, gap: 10 },
  offerThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: Colors.dark.inputBg },
  offerThumbPlaceholder: { alignItems: 'center' as const, justifyContent: 'center' as const },
  offerInfo: { flex: 1 },
  offerTitle: { color: Colors.dark.text, fontSize: 13, fontWeight: '600' as const },
  offerDiscount: { color: Colors.dark.neonGreen, fontSize: 12, fontWeight: '700' as const, marginTop: 2 },
  offerDesc: { color: Colors.dark.textMuted, fontSize: 11, marginTop: 1 },
  offerEditBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.dark.neonGreenFaint, alignItems: 'center' as const, justifyContent: 'center' as const },
  offerImgPickBtn: { borderRadius: 12, overflow: 'hidden' as const, height: 100, backgroundColor: Colors.dark.surfaceLight, borderWidth: 1, borderColor: Colors.dark.neonGreenFaint, borderStyle: 'dashed' as const },
  offerImgPreview: { width: '100%' as any, height: '100%' as any, borderRadius: 12 },
  offerImgPlaceholder: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6 },
  offerImgPlaceholderTxt: { color: Colors.dark.neonGreen, fontSize: 12, fontWeight: '600' as const },
  offerBtnRow: { flexDirection: 'row' as const, gap: 10, marginTop: 4 },
  offerSaveBtn: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, backgroundColor: Colors.dark.neonGreen, paddingVertical: 10, borderRadius: 10 },
  offerSaveBtnTxt: { color: '#000', fontSize: 13, fontWeight: '700' as const },
  offerCancelBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 4, backgroundColor: Colors.dark.surfaceLight, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  offerCancelBtnTxt: { color: Colors.dark.textMuted, fontSize: 13, fontWeight: '600' as const },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.dark.cardBorder, marginTop: 4 },
  toggleLabel: { flex: 1, color: Colors.dark.textSecondary, fontSize: 14, fontWeight: '500' as const },
  toggleActive: { color: Colors.dark.text },
  toggleSwitch: { width: 48, height: 28, borderRadius: 14, backgroundColor: Colors.dark.surfaceLight, padding: 3, justifyContent: 'center' },
  toggleSwitchActive: { backgroundColor: Colors.dark.neonGreen },
  toggleDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.dark.text },
  toggleDotActive: { alignSelf: 'flex-end' as const },
  saveFullBtn: { borderRadius: 14, overflow: 'hidden', marginTop: 4, shadowColor: "#00FF87", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  saveFullGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  saveFullTxt: { color: '#000', fontSize: 15, fontWeight: '800' as const, letterSpacing: 0.5 },
  photoPreviewContainer: { width: '100%', height: 160, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.dark.inputBg, marginBottom: 12 },
  photoPreview: { width: '100%', height: '100%' },
  changePhotoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.dark.surfaceLight, paddingVertical: 10, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  changePhotoBtnTxt: { color: Colors.dark.text, fontSize: 13, fontWeight: '600' as const },
  photoPlaceholder: { minHeight: 160, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, backgroundColor: Colors.dark.inputBg, borderRadius: 12, paddingVertical: 24, marginBottom: 12 },
  photoPlaceholderTxt: { color: Colors.dark.textMuted, fontSize: 12, fontWeight: '500' as const },
  addPhotoBtn: { borderRadius: 12, overflow: 'hidden' as const },
  addPhotoBtnGrad: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 12, gap: 6 },
  addPhotoBtnTxt: { color: '#000', fontSize: 13, fontWeight: '700' as const },
  locationBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, backgroundColor: Colors.dark.surfaceLight, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.dark.neonGreenFaint },
  locationBtnText: { color: Colors.dark.neonGreen, fontSize: 14, fontWeight: '600' as const },
  locationInfo: { color: Colors.dark.textMuted, fontSize: 12, marginTop: 8 },
});

function generateQRCodePayload(batch: CouponBatch, code: string): string {
  const payload = {
    type: 'cashbox_coupon',
    code,
    value: batch.value,
    sponsorId: batch.sponsorId,
    sponsorName: batch.sponsorName,
    batchId: batch.id,
    createdAt: batch.createdAt,
  };
  return JSON.stringify(payload);
}

function generateThermalPrintHTML(batch: CouponBatch): string {
  const dateStr = new Date(batch.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const codesHTML = batch.codes.map((code, i) => {
    const qrData = encodeURIComponent(generateQRCodePayload(batch, code));
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}&format=png&margin=4`;
    return `
    <div class="coupon">
      <div class="coupon-header">
        <span class="idx">${String(i + 1).padStart(3, '0')}</span>
        <span class="store">${batch.sponsorName}</span>
      </div>
      <div class="qr-container">
        <img src="${qrUrl}" class="qr-img" alt="QR Code ${code}" />
      </div>
      <div class="code">${code}</div>
      <div class="value">R$ ${batch.value.toFixed(2)}</div>
      <div class="scan-hint">Escaneie o QR Code ou digite o codigo acima</div>
      <div class="sep">- - - - - - - - - - - - - - - -</div>
    </div>
  `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page {
      margin: 2mm;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      width: 72mm;
      max-width: 72mm;
      color: #000;
      background: #fff;
    }
    .header {
      text-align: center;
      padding: 4mm 0;
      border-bottom: 2px dashed #000;
      margin-bottom: 3mm;
    }
    .header h1 {
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 1px;
    }
    .header .info {
      font-size: 10px;
      margin-top: 2mm;
      color: #333;
    }
    .header .batch-id {
      font-size: 9px;
      color: #666;
      margin-top: 1mm;
    }
    .summary {
      text-align: center;
      padding: 2mm 0 3mm;
      border-bottom: 1px solid #000;
      margin-bottom: 3mm;
    }
    .summary .line {
      font-size: 11px;
      margin: 1mm 0;
    }
    .summary .total {
      font-size: 14px;
      font-weight: 900;
      margin-top: 2mm;
    }
    .coupon {
      padding: 3mm 1mm;
      margin-bottom: 2mm;
      page-break-inside: avoid;
    }
    .coupon-header {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #666;
      margin-bottom: 2mm;
    }
    .qr-container {
      text-align: center;
      padding: 2mm 0;
    }
    .qr-img {
      width: 40mm;
      height: 40mm;
      image-rendering: pixelated;
    }
    .coupon .code {
      font-size: 13px;
      font-weight: 900;
      text-align: center;
      letter-spacing: 1.5px;
      padding: 2mm 0 1mm;
      border: 1px dashed #999;
      border-radius: 2mm;
      margin: 1mm 2mm;
      background: #f9f9f9;
    }
    .coupon .value {
      text-align: center;
      font-size: 14px;
      font-weight: 900;
      margin-top: 1mm;
    }
    .scan-hint {
      text-align: center;
      font-size: 8px;
      color: #888;
      margin-top: 1mm;
      font-style: italic;
    }
    .coupon .sep {
      text-align: center;
      font-size: 10px;
      color: #999;
      margin-top: 2mm;
    }
    .footer {
      text-align: center;
      padding: 3mm 0;
      border-top: 2px dashed #000;
      margin-top: 2mm;
      font-size: 9px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>CASHBOX PIX</h1>
    <div class="info">LOTE DE CUPONS</div>
    <div class="info">${batch.sponsorName}</div>
    <div class="batch-id">Lote: ${batch.id}</div>
    <div class="batch-id">${dateStr}</div>
  </div>
  <div class="summary">
    <div class="line">Quantidade: ${batch.quantity} cupons</div>
    <div class="line">Valor unitario: R$ ${batch.value.toFixed(2)}</div>
    <div class="line">Prefixo: ${batch.prefix}</div>
    <div class="total">Total: R$ ${(batch.quantity * batch.value).toFixed(2)}</div>
  </div>
  ${codesHTML}
  <div class="footer">
    <div>*** FIM DO LOTE ***</div>
    <div style="margin-top:1mm;">Impresso em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
  </div>
</body>
</html>`;
}

function CouponBatchModal({
  visible,
  onClose,
  sponsors,
  onGenerate,
  onRequestPreview,
}: {
  visible: boolean;
  onClose: () => void;
  sponsors: Sponsor[];
  onGenerate: (batch: CouponBatch) => void;
  onRequestPreview?: (batch: CouponBatch) => void;
}) {
  const insets = useSafeAreaInsets();
  const [selectedSponsor, setSelectedSponsor] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('10');
  const [value, setValue] = useState<string>('10');
  const [showSponsorPicker, setShowSponsorPicker] = useState<boolean>(false);

  const selectedSponsorObj = sponsors.find((s) => s.id === selectedSponsor);

  const buildPrefix = useCallback((sponsor: Sponsor | undefined) => {
    if (!sponsor) return '';
    const stateCode = sponsor.state.toUpperCase().substring(0, 2);
    const cityName = sponsor.city.charAt(0).toUpperCase() + sponsor.city.slice(1).toLowerCase();
    return `${stateCode}-${cityName}`;
  }, []);

  const generatedPrefix = useMemo(() => buildPrefix(selectedSponsorObj), [selectedSponsorObj, buildPrefix]);

  const handleGenerate = useCallback(() => {
    if (!selectedSponsor) {
      Alert.alert('Erro', 'Selecione um patrocinador');
      return;
    }
    const qty = parseInt(quantity, 10);
    if (!qty || qty < 1 || qty > 1000) {
      Alert.alert('Erro', 'Quantidade deve ser entre 1 e 1000');
      return;
    }
    const val = parseFloat(value);
    if (!val || val <= 0) {
      Alert.alert('Erro', 'Valor deve ser maior que zero');
      return;
    }
    const codes: string[] = [];
    const pfx = buildPrefix(selectedSponsorObj);
    for (let i = 0; i < qty; i++) {
      // Gerar 5 dígitos aleatórios para cada cupom
      const randomDigits = String(Math.floor(10000 + Math.random() * 90000));
      const code = `${pfx}-${randomDigits}`;
      codes.push(code);
    }
    const batch: CouponBatch = {
      id: `batch_${Date.now()}`,
      sponsorId: selectedSponsor,
      sponsorName: selectedSponsorObj?.name ?? '',
      quantity: qty,
      value: val,
      prefix: generatedPrefix,
      createdAt: new Date().toISOString(),
      codes,
    };
    onGenerate(batch);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Sucesso', `${qty} cupons gerados para ${selectedSponsorObj?.name}!`, [
      { text: 'Depois', style: 'cancel', onPress: () => onClose() },
      { text: 'Visualizar', onPress: () => { if (onRequestPreview) onRequestPreview(batch); onClose(); } },
      { text: 'Imprimir', onPress: () => { printBatchCoupons(batch); onClose(); } },
    ]);
  }, [selectedSponsor, quantity, value, selectedSponsorObj, generatedPrefix, buildPrefix, onGenerate, onClose]);

  const printBatchCoupons = useCallback(async (batch: CouponBatch) => {
    try {
      const html = generateThermalPrintHTML(batch);
      console.log('[CouponBatch] Printing batch:', batch.id, 'codes:', batch.codes.length);
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print();
            }, 500);
          };
        } else {
          await Print.printAsync({ html });
        }
      } else {
        await Print.printAsync({ html });
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.log('[CouponBatch] Print error:', err);
      Alert.alert('Erro', 'Nao foi possivel imprimir. Verifique se a impressora esta conectada via Bluetooth ou WiFi.');
    }
  }, []);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={fm.container}>
        <View style={[fm.header, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={fm.closeBtn}>
            <X size={22} color={Colors.dark.text} />
          </TouchableOpacity>
          <Text style={fm.headerTitle}>Gerar Lote de Cupons</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={fm.scroll} keyboardShouldPersistTaps="handled">
          <View style={fm.section}>
            <Text style={fm.sectionTitle}>Patrocinador</Text>
            <TouchableOpacity
              style={[fm.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }]}
              onPress={() => setShowSponsorPicker(!showSponsorPicker)}
            >
              <Text style={{ color: selectedSponsorObj ? Colors.dark.text : Colors.dark.textMuted, fontSize: 14 }}>
                {selectedSponsorObj?.name ?? 'Selecione um patrocinador'}
              </Text>
              <ChevronDown size={18} color={Colors.dark.textMuted} />
            </TouchableOpacity>
            {showSponsorPicker && (
              <View style={bm.pickerList}>
                {sponsors.map((sp) => (
                  <TouchableOpacity
                    key={sp.id}
                    style={[bm.pickerItem, selectedSponsor === sp.id && bm.pickerItemActive]}
                    onPress={() => { setSelectedSponsor(sp.id); setShowSponsorPicker(false); }}
                  >
                    <Text style={[bm.pickerItemTxt, selectedSponsor === sp.id && bm.pickerItemTxtActive]}>{sp.name}</Text>
                    <Text style={bm.pickerItemSub}>{sp.city}, {sp.state}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <View style={fm.section}>
            <Text style={fm.sectionTitle}>Configuracoes</Text>
            <View style={[fm.row, { marginTop: 10 }]}>
              <View style={[fm.field, { flex: 1 }]}>
                <Text style={fm.label}>Quantidade</Text>
                <TextInput style={fm.input} value={quantity} onChangeText={setQuantity} placeholder="10" placeholderTextColor={Colors.dark.textMuted} keyboardType="numeric" />
              </View>
              <View style={[fm.field, { flex: 1 }]}>
                <Text style={fm.label}>Valor (R$)</Text>
                <TextInput style={fm.input} value={value} onChangeText={setValue} placeholder="10" placeholderTextColor={Colors.dark.textMuted} keyboardType="numeric" />
              </View>
            </View>
            <View style={fm.field}>
              <Text style={fm.label}>Prefixo do codigo (auto)</Text>
              <View style={[fm.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                <Text style={{ color: generatedPrefix ? Colors.dark.text : Colors.dark.textMuted, fontSize: 14, fontWeight: '600' as const }}>
                  {generatedPrefix || 'Selecione um patrocinador'}
                </Text>
                <Text style={{ color: Colors.dark.textMuted, fontSize: 11 }}>Estado-Cidade-Sorteio</Text>
              </View>
              <Text style={{ color: Colors.dark.textMuted, fontSize: 11, marginTop: 4 }}>Formato: UF-CID-XXXXX (numero da Loteria Federal)</Text>
            </View>
          </View>
          <TouchableOpacity style={fm.saveFullBtn} onPress={handleGenerate} activeOpacity={0.8}>
            <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={fm.saveFullGrad}>
              <Package size={18} color="#000" />
              <Text style={fm.saveFullTxt}>GERAR CUPONS</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CouponPreviewModal({
  visible,
  batch,
  onClose,
  onPrint,
}: {
  visible: boolean;
  batch: CouponBatch | null;
  onClose: () => void;
  onPrint: (batch: CouponBatch) => void;
}) {
  const insets = useSafeAreaInsets();
  if (!batch) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[cp.container, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
        <View style={cp.header}>
          <TouchableOpacity onPress={onClose} style={cp.closeBtn}>
            <X size={22} color={Colors.dark.text} />
          </TouchableOpacity>
          <Text style={cp.headerTitle}>Visualizar Cupons</Text>
          <TouchableOpacity style={cp.printBtn} onPress={() => { onPrint(batch); onClose(); }} activeOpacity={0.7}>
            <Printer size={18} color={Colors.dark.neonGreen} />
          </TouchableOpacity>
        </View>

        <View style={cp.infoBar}>
          <View style={cp.infoPart}>
            <Text style={cp.infoLabel}>Loja</Text>
            <Text style={cp.infoValue}>{batch.sponsorName}</Text>
          </View>
          <View style={cp.infoDivider} />
          <View style={cp.infoPart}>
            <Text style={cp.infoLabel}>Preço</Text>
            <Text style={cp.infoValue}>R$ {batch.value.toFixed(2)}</Text>
          </View>
          <View style={cp.infoDivider} />
          <View style={cp.infoPart}>
            <Text style={cp.infoLabel}>Total</Text>
            <Text style={cp.infoValue}>{batch.quantity}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={cp.list}>
          {batch.codes.map((code, i) => {
            const qrData = encodeURIComponent(generateQRCodePayload(batch, code));
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}&format=png&margin=2`;
            return (
              <View key={`${code}-${i}`} style={cp.couponPreview}>
                <View style={cp.couponNum}>
                  <Text style={cp.couponNumText}>#{String(i + 1).padStart(3, '0')}</Text>
                </View>
                <View style={cp.couponQRWrapper}>
                  <Image
                    source={{ uri: qrUrl }}
                    style={cp.couponQR}
                    contentFit="contain"
                  />
                </View>
                <View style={cp.couponInfo}>
                  <Text style={cp.couponCode}>{code}</Text>
                  <Text style={cp.couponValue}>R$ {batch.value.toFixed(2)}</Text>
                </View>
                <TouchableOpacity
                  style={cp.copyBtn}
                  onPress={() => {
                    if (Platform.OS !== 'web') {
                      Clipboard.setStringAsync(code);
                      Alert.alert('Copiado', 'Código copiado para a área de transferência');
                    }
                  }}
                >
                  <Copy size={16} color={Colors.dark.neonGreen} />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const cp = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.dark.surface, borderBottomWidth: 1, borderBottomColor: Colors.dark.cardBorder },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.dark.text, fontSize: 16, fontWeight: '700' as const, flex: 1, textAlign: 'center' as const },
  printBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  infoBar: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.dark.card, borderBottomWidth: 1, borderBottomColor: Colors.dark.cardBorder, gap: 12 },
  infoPart: { flex: 1, alignItems: 'center' as const },
  infoLabel: { color: Colors.dark.textMuted, fontSize: 11, fontWeight: '600' as const, marginBottom: 2 },
  infoValue: { color: Colors.dark.text, fontSize: 15, fontWeight: '700' as const },
  infoDivider: { width: 1, backgroundColor: Colors.dark.cardBorder },
  list: { paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
  couponPreview: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.dark.card, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  couponNum: { width: 40, alignItems: 'center' as const, justifyContent: 'center' as const },
  couponNumText: { color: Colors.dark.textMuted, fontSize: 11, fontWeight: '700' as const },
  couponQRWrapper: { width: 70, height: 70, backgroundColor: Colors.dark.inputBg, borderRadius: 8, overflow: 'hidden' as const, borderWidth: 1, borderColor: Colors.dark.neonGreenFaint },
  couponQR: { width: '100%', height: '100%' },
  couponInfo: { flex: 1, gap: 4 },
  couponCode: { color: Colors.dark.text, fontSize: 12, fontWeight: '700' as const, fontFamily: 'monospace' },
  couponValue: { color: Colors.dark.neonGreen, fontSize: 11, fontWeight: '600' as const },
  copyBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: Colors.dark.surfaceLight },
  codeItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.dark.card, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  codeNumber: { color: Colors.dark.textMuted, fontSize: 12, fontWeight: '600' as const, minWidth: 32 },
  codeBox: { flex: 1, backgroundColor: Colors.dark.inputBg, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: Colors.dark.neonGreenFaint, borderStyle: 'dashed' as const },
  codeText: { color: Colors.dark.text, fontSize: 13, fontWeight: '700' as const, fontFamily: 'monospace' },
});

function PromoQRPreviewModal({
  visible,
  promo,
  onClose,
  onPrint,
}: {
  visible: boolean;
  promo: PromotionalQR | null;
  onClose: () => void;
  onPrint: (promo: PromotionalQR) => void;
}) {
  const insets = useSafeAreaInsets();
  if (!promo) return null;

  const qrData = encodeURIComponent(JSON.stringify({
    type: 'cashbox_promo',
    promoId: promo.id,
    sponsorId: promo.sponsorId,
    sponsorName: promo.sponsorName,
    sponsorAddress: promo.sponsorAddress,
    backgroundImageUrl: promo.backgroundImageUrl,
    message: promo.message,
    couponValue: promo.couponValue,
    minPurchase: promo.minPurchase,
    city: promo.city,
    state: promo.state,
  }));
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrData}&format=png&margin=8`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[pqm.container, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
        <View style={pqm.header}>
          <TouchableOpacity onPress={onClose} style={pqm.closeBtn}>
            <X size={22} color={Colors.dark.text} />
          </TouchableOpacity>
          <Text style={pqm.headerTitle}>QR Code Promocional</Text>
          <TouchableOpacity style={pqm.printBtn} onPress={() => { onPrint(promo); onClose(); }} activeOpacity={0.7}>
            <Printer size={18} color="#F59E0B" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={pqm.content}>
          <View style={pqm.infoSection}>
            <Text style={pqm.storeName}>{promo.sponsorName}</Text>
            {promo.sponsorAddress && <Text style={pqm.storeAddr}>{promo.sponsorAddress}</Text>}
            <Text style={pqm.storeValue}>Pix R$ {promo.couponValue.toFixed(2)} | Compra min R$ {promo.minPurchase.toFixed(2)}</Text>
          </View>

          {promo.backgroundImageUrl ? (
            <View style={pqm.bgPreviewWrap}>
              <Image source={{ uri: promo.backgroundImageUrl }} style={pqm.bgPreviewImg} contentFit="cover" contentPosition="center" />
            </View>
          ) : null}

          <View style={pqm.qrWrapper}>
            <Image
              source={{ uri: qrUrl }}
              style={pqm.qrImage}
              contentFit="contain"
            />
          </View>

          <View style={pqm.messageSection}>
            <Text style={pqm.messageLabel}>Mensagem Promocional:</Text>
            <Text style={pqm.messageText}>
              {promo.message || `Parabéns! Quer ganhar 1 Pix de R$ ${promo.couponValue.toFixed(2)}? Vá até a loja ${promo.sponsorName} e faça uma compra mínima de R$ ${promo.minPurchase.toFixed(2)} e ganhe um cupom para receber um Pix de R$ ${promo.couponValue.toFixed(2)}!`}
            </Text>
          </View>

          <View style={pqm.instructionSection}>
            <Text style={pqm.instructionText}>📱 Escaneie com o app CashBox PIX para ver a promoção</Text>
          </View>

          <TouchableOpacity 
            style={pqm.printFullBtn} 
            onPress={() => { onPrint(promo); onClose(); }} 
            activeOpacity={0.8}
          >
            <LinearGradient colors={['#F59E0B', '#D97706']} style={pqm.printFullGrad}>
              <Printer size={16} color="#000" />
              <Text style={pqm.printFullTxt}>IMPRIMIR QR CODE</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const pqm = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.dark.surface, borderBottomWidth: 1, borderBottomColor: Colors.dark.cardBorder },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.dark.text, fontSize: 16, fontWeight: '700' as const, flex: 1, textAlign: 'center' as const },
  printBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(245, 158, 11, 0.1)', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingVertical: 20, gap: 16 },
  infoSection: { backgroundColor: Colors.dark.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  storeName: { color: Colors.dark.text, fontSize: 18, fontWeight: '700' as const },
  storeAddr: { color: Colors.dark.textMuted, fontSize: 13, marginTop: 4 },
  storeValue: { color: '#F59E0B', fontSize: 14, fontWeight: '700' as const, marginTop: 8, backgroundColor: 'rgba(245, 158, 11, 0.08)', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  bgPreviewWrap: { borderRadius: 14, overflow: 'hidden' as const, minHeight: 180, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  bgPreviewImg: { width: '100%', height: 180 },
  qrWrapper: { backgroundColor: Colors.dark.card, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: Colors.dark.cardBorder, alignItems: 'center' as const, minHeight: 320 },
  qrImage: { width: 280, height: 280 },
  messageSection: { backgroundColor: Colors.dark.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  messageLabel: { color: Colors.dark.textMuted, fontSize: 12, fontWeight: '600' as const, marginBottom: 8 },
  messageText: { color: Colors.dark.text, fontSize: 13, lineHeight: 1.6 },
  instructionSection: { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.2)' },
  instructionText: { color: '#F59E0B', fontSize: 13, fontWeight: '600' as const, textAlign: 'center' as const },
  printFullBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 8, marginBottom: 20, shadowColor:'#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  printFullGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  printFullTxt: { color: '#000', fontSize: 14, fontWeight: '800' as const, letterSpacing: 0.5 },
});

const bm = StyleSheet.create({
  pickerList: { backgroundColor: Colors.dark.surfaceLight, borderRadius: 12, marginTop: 8, overflow: 'hidden' },
  pickerSearch: { margin: 12, marginBottom: 4, backgroundColor: Colors.dark.card, borderRadius: 10, borderWidth: 1, borderColor: Colors.dark.cardBorder, color: Colors.dark.text, fontSize: 14, paddingHorizontal: 12, paddingVertical: 10 },
  pickerItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.dark.cardBorder },
  pickerItemActive: { backgroundColor: Colors.dark.neonGreenFaint },
  pickerItemTxt: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' as const },
  pickerItemTxtActive: { color: Colors.dark.neonGreen },
  pickerItemSub: { color: Colors.dark.textMuted, fontSize: 11, marginTop: 2 },
  emptyText: { color: Colors.dark.textMuted, fontSize: 13, textAlign: 'center' as const, paddingHorizontal: 14, paddingVertical: 18 },
});

function NotificationModal({
  visible,
  onClose,
  onSave,
  initialData,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (notif: AdminNotification) => void;
  initialData: AdminNotification | null;
}) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [type, setType] = useState<AdminNotification['type']>('general');

  React.useEffect(() => {
    if (visible && initialData) {
      setTitle(initialData.title);
      setMessage(initialData.message);
      setType(initialData.type);
    } else if (visible) {
      setTitle('');
      setMessage('');
      setType('general');
    }
  }, [visible, initialData]);

  const handleSave = useCallback(() => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Erro', 'Preencha titulo e mensagem');
      return;
    }
    const notif: AdminNotification = {
      id: initialData?.id ?? `notif_${Date.now()}`,
      title: title.trim(),
      message: message.trim(),
      type,
      createdAt: initialData?.createdAt ?? new Date().toISOString(),
      sent: initialData?.sent ?? false,
    };
    onSave(notif);
    onClose();
  }, [title, message, type, initialData, onSave, onClose]);

  const typeOptions: { value: AdminNotification['type']; label: string }[] = [
    { value: 'general', label: 'Geral' },
    { value: 'promo', label: 'Promocao' },
    { value: 'prize', label: 'Premio' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={fm.container}>
        <View style={[fm.header, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={fm.closeBtn}>
            <X size={22} color={Colors.dark.text} />
          </TouchableOpacity>
          <Text style={fm.headerTitle}>{initialData ? 'Editar Notificacao' : 'Nova Notificacao'}</Text>
          <TouchableOpacity onPress={handleSave} style={fm.saveHeaderBtn}>
            <Text style={fm.saveHeaderTxt}>Salvar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={fm.scroll} keyboardShouldPersistTaps="handled">
          <View style={fm.section}>
            <View style={fm.field}>
              <Text style={fm.label}>Titulo</Text>
              <TextInput style={fm.input} value={title} onChangeText={setTitle} placeholder="Titulo da notificacao" placeholderTextColor={Colors.dark.textMuted} />
            </View>
            <View style={fm.field}>
              <Text style={fm.label}>Mensagem</Text>
              <TextInput style={[fm.input, fm.textArea]} value={message} onChangeText={setMessage} placeholder="Mensagem da notificacao" placeholderTextColor={Colors.dark.textMuted} multiline numberOfLines={4} />
            </View>
            <View style={fm.field}>
              <Text style={fm.label}>Tipo</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {typeOptions.map((opt) => (
                  <TouchableOpacity key={opt.value} style={[nm.typeBtn, type === opt.value && nm.typeBtnActive]} onPress={() => setType(opt.value)}>
                    <Text style={[nm.typeTxt, type === opt.value && nm.typeTxtActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          <TouchableOpacity style={fm.saveFullBtn} onPress={handleSave} activeOpacity={0.8}>
            <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={fm.saveFullGrad}>
              <Save size={18} color="#000" />
              <Text style={fm.saveFullTxt}>SALVAR NOTIFICACAO</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const nm = StyleSheet.create({
  typeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.dark.surfaceLight },
  typeBtnActive: { backgroundColor: Colors.dark.neonGreen },
  typeTxt: { color: Colors.dark.textMuted, fontSize: 13, fontWeight: '600' as const },
  typeTxtActive: { color: '#000' },
});

export default function AdminPanel() {
  console.log("[AdminPanel] Rendering admin panel");
  const insets = useSafeAreaInsets();
  const {
    isAdmin,
    couponBatches,
    addCouponBatch,
    notifications,
    addNotification,
    updateNotification,
    deleteNotification,
    grandPrizeConfig,
    cityPrizes,
    saveCityPrize,
    getCityPrize,
    cityImages,
    saveCityImage,
    fetchUsers,
    promoQRCodes,
    addPromoQR,
    updatePromoQR,
    deletePromoQR,
    getPromoQRsByCity,
    managedCities,
    addManagedCity,
    verifyIdentity,
    refreshManagedCities,
  } = useAdmin();
  const {
    sponsors,
    addSponsor,
    updateSponsor,
    deleteSponsor,
    refreshSponsors,
  } = useSponsor();
  const { creditUserBalance, profile: currentUserProfile, refreshProfile } = useUser();

  const [mainTab, setMainTab] = useState<MainTab>('overview');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [citySubTab, setCitySubTab] = useState<CitySubTab>('prize');

  const [showSponsorModal, setShowSponsorModal] = useState<boolean>(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [sponsorDraftId, setSponsorDraftId] = useState<string>('');
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [previewBatch, setPreviewBatch] = useState<CouponBatch | null>(null);
  const [showCouponPreview, setShowCouponPreview] = useState<boolean>(false);
  const [showNotifModal, setShowNotifModal] = useState<boolean>(false);
  const [editingNotif, setEditingNotif] = useState<AdminNotification | null>(null);
  const [editingPromo, setEditingPromo] = useState<PromotionalQR | null>(null);
  const [showPromoForm, setShowPromoForm] = useState<boolean>(false);
  const [previewPromoQR, setPreviewPromoQR] = useState<PromotionalQR | null>(null);
  const [showPromoQRPreview, setShowPromoQRPreview] = useState<boolean>(false);
  const [promoForm, setPromoForm] = useState<{ sponsorId: string; sponsorName: string; sponsorAddress: string; backgroundImageUrl: string; message: string; couponValue: string; minPurchase: string }>({
    sponsorId: '', sponsorName: '', sponsorAddress: '', backgroundImageUrl: '', message: '', couponValue: '10', minPurchase: '100',
  });
  const [promoBgUploadMeta, setPromoBgUploadMeta] = useState<{ fileName?: string; mimeType?: string } | null>(null);

  const [showAddCityModal, setShowAddCityModal] = useState<boolean>(false);
  const [syncingServer, setSyncingServer] = useState<boolean>(false);
  const [newCityName, setNewCityName] = useState<string>('');
  const [newCityState, setNewCityState] = useState<string>('SP');
  const [showStatePicker, setShowStatePicker] = useState<boolean>(false);
  const [showCityPicker, setShowCityPicker] = useState<boolean>(false);
  const [newCitySearch, setNewCitySearch] = useState<string>('');
  const [newCityPhotoUri, setNewCityPhotoUri] = useState<string | null>(null);
  const [cityHeaderImageError, setCityHeaderImageError] = useState<boolean>(false);
  const [showUserReviewModal, setShowUserReviewModal] = useState<boolean>(false);
  const [loadingUserReviewRows, setLoadingUserReviewRows] = useState<boolean>(false);
  const [savingUserReviewEmail, setSavingUserReviewEmail] = useState<string>('');
  const [userReviewRows, setUserReviewRows] = useState<UserReviewRow[]>([]);
  const [selectedUserReviewEmail, setSelectedUserReviewEmail] = useState<string | null>(null);

  const suggestedCities = useMemo(() => {
    const normalizedSearch = normalizeSearchText(newCitySearch);
    const citiesForSelectedState = ALL_CITY_OPTIONS.filter(({ state }) => state === newCityState);

    if (!normalizedSearch) return citiesForSelectedState;

    return citiesForSelectedState.filter(({ city, state }) => {
      const normalizedCity = normalizeSearchText(city);
      const normalizedState = normalizeSearchText(state);

      return normalizedCity.startsWith(normalizedSearch)
        || normalizedState.startsWith(normalizedSearch)
        || normalizedCity.split(' ').some((part) => part.startsWith(normalizedSearch));
    });
  }, [newCitySearch, newCityState]);

  const getCityImageUri = useCallback((city: string | null) => {
    if (!city) return null;
    const raw = cityImages[city];
    if (!raw) return null;
    const uri = raw.trim();
    if (!uri) return null;
    if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('file://') || uri.startsWith('data:image/')) {
      return uri;
    }
    return null;
  }, [cityImages]);

  const cities = useMemo(() => {
    const cityMap: Record<string, { city: string; state: string; count: number }> = {};
    sponsors.forEach((s) => {
      const key = `${s.city}|${s.state}`;
      if (!cityMap[key]) cityMap[key] = { city: s.city, state: s.state, count: 0 };
      cityMap[key].count++;
    });
    managedCities.forEach((c) => {
      const key = `${c.city}|${c.state}`;
      if (!cityMap[key]) cityMap[key] = { city: c.city, state: c.state, count: 0 };
    });
    return Object.values(cityMap).sort((a, b) => a.city.localeCompare(b.city));
  }, [sponsors, managedCities]);

  const states = useMemo(() => {
    const stateMap: Record<string, { state: string; cities: string[]; count: number }> = {};
    sponsors.forEach((s) => {
      if (!stateMap[s.state]) stateMap[s.state] = { state: s.state, cities: [], count: 0 };
      if (!stateMap[s.state].cities.includes(s.city)) stateMap[s.state].cities.push(s.city);
      stateMap[s.state].count++;
    });
    managedCities.forEach((c) => {
      if (!stateMap[c.state]) stateMap[c.state] = { state: c.state, cities: [], count: 0 };
      if (!stateMap[c.state].cities.includes(c.city)) stateMap[c.state].cities.push(c.city);
    });
    return Object.values(stateMap).sort((a, b) => a.state.localeCompare(b.state));
  }, [sponsors, managedCities]);

  const citySponsors = useMemo(() => {
    if (!selectedCity) return [];
    return sponsors.filter((s) => s.city === selectedCity);
  }, [sponsors, selectedCity]);

  const stateSponsors = useMemo(() => {
    if (!selectedState) return [];
    return sponsors.filter((s) => s.state === selectedState);
  }, [sponsors, selectedState]);

  const totalOffers = useMemo(() => sponsors.reduce((sum, s) => sum + s.offers.length, 0), [sponsors]);
  const totalServerCoupons = useMemo(() => couponBatches.reduce((sum, batch) => sum + batch.quantity, 0), [couponBatches]);

  const cityPrizeData = useMemo(() => {
    if (!selectedCity) return null;
    return getCityPrize(selectedCity);
  }, [selectedCity, getCityPrize]);

  const selectedCityState = useMemo(() => {
    if (!selectedCity) return null;
    return cities.find((city) => city.city === selectedCity)?.state ?? null;
  }, [cities, selectedCity]);

  const selectedUserReviewRow = useMemo(() => {
    if (!selectedUserReviewEmail) return null;
    return userReviewRows.find((row) => row.profile.email === selectedUserReviewEmail) ?? null;
  }, [selectedUserReviewEmail, userReviewRows]);

  const userReviewSummary = useMemo(() => {
    return userReviewRows.reduce((summary, row) => {
      const status = getUserReviewStatus(row.profile);
      summary.total += 1;
      summary[status] += 1;
      return summary;
    }, {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    });
  }, [userReviewRows]);

  const [prizeMsg, setPrizeMsg] = useState<string>('');
  const [prizeVal, setPrizeVal] = useState<string>('');
  const [prizeDrawDate, setPrizeDrawDate] = useState<string>('');
  const [prizeBgUrl, setPrizeBgUrl] = useState<string>('');
  const [prizeLotteryRef, setPrizeLotteryRef] = useState<string>('');
  const [prizeBgUploadMeta, setPrizeBgUploadMeta] = useState<{ fileName?: string; mimeType?: string } | null>(null);
  const [savingCityPrize, setSavingCityPrize] = useState<boolean>(false);
  const [imageCanvasSession, setImageCanvasSession] = useState<ImageCanvasEditorSession | null>(null);

  const copyAdminImageStorageSql = useCallback(async () => {
    await Clipboard.setStringAsync(getAdminImageStorageSetupSql());
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    Alert.alert(
      'SQL copiado',
      `Cole o SQL no SQL Editor do Supabase para criar o bucket "${getAdminImageBucketName()}" e liberar os uploads.`,
    );
  }, []);

  const showAdminImageStorageSetupAlert = useCallback((message?: string) => {
    Alert.alert(
      'Storage de imagens nao configurado',
      `${message || getAdminImageStorageSetupInstructions()}\n\nUse "Copiar SQL do Storage" e execute o script uma vez no SQL Editor do Supabase.`,
      [
        { text: 'Agora nao', style: 'cancel' },
        {
          text: 'Copiar SQL',
          onPress: () => {
            void copyAdminImageStorageSql();
          },
        },
      ],
    );
  }, [copyAdminImageStorageSql]);

  React.useEffect(() => {
    if (selectedCity) {
      const cp = getCityPrize(selectedCity);
      const exactMatch = grandPrizeConfig?.city === selectedCity ? grandPrizeConfig : null;
      const fallback = exactMatch ?? grandPrizeConfig;
      const prize = cp ?? fallback;
      console.log('[Admin] Loading prize for city:', selectedCity, 'local:', !!cp, 'fallback:', !!fallback, 'bgUrl:', prize?.backgroundImageUrl);
      setPrizeMsg(prize?.description ?? '');
      setPrizeVal(prize?.value?.toString() ?? '10000');
      setPrizeDrawDate(prize?.drawDate ?? '2026-05-15');
      setPrizeBgUrl(prize?.backgroundImageUrl ?? '');
      setPrizeBgUploadMeta(null);
      setPrizeLotteryRef(prize?.lotteryReference ?? 'Loteria Federal');
    }
  }, [selectedCity, getCityPrize, grandPrizeConfig]);

  React.useEffect(() => {
    setCityHeaderImageError(false);
  }, [selectedCity]);

  const sponsorFormData = useMemo((): SponsorFormData => {
    if (editingSponsor) {
      return {
        name: editingSponsor.name,
        category: editingSponsor.category,
        imageUrl: editingSponsor.imageUrl,
        logoUrl: editingSponsor.logoUrl,
        address: editingSponsor.address,
        city: editingSponsor.city,
        state: editingSponsor.state,
        phone: formatPhone(editingSponsor.phone),
        description: editingSponsor.description,
        minPurchaseValue: editingSponsor.minPurchaseValue.toString(),
        couponValue: (editingSponsor.couponValue ?? 0).toString(),
        verified: editingSponsor.verified,
        latitude: editingSponsor.latitude.toString(),
        longitude: editingSponsor.longitude.toString(),
        galleryImages: editingSponsor.galleryImages ?? [],
        promotionalVideos: editingSponsor.promotionalVideos ?? [],
        offers: (editingSponsor.offers ?? []).map((o) => ({
          id: o.id,
          title: o.title,
          description: o.description,
          imageUrl: o.imageUrl,
          discount: o.discount,
        })),
      };
    }
    return {
      ...emptySponsorForm,
      city: selectedCity ?? 'Sao Paulo',
      state: cities.find((c) => c.city === selectedCity)?.state ?? 'SP',
    };
  }, [editingSponsor, selectedCity, cities]);

  const handleOpenAdd = useCallback(() => {
    setSponsorDraftId(`s_${Date.now()}`);
    setEditingSponsor(null);
    setShowSponsorModal(true);
  }, []);

  const handleOpenEdit = useCallback((sponsor: Sponsor) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSponsorDraftId(sponsor.id);
    setEditingSponsor(sponsor);
    setShowSponsorModal(true);
  }, []);

  const handleSaveSponsor = useCallback((data: SponsorFormData) => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const resolvedSponsorId = sponsorDraftId || editingSponsor?.id || `s_${Date.now()}`;
    const sponsorData: Sponsor = {
      id: resolvedSponsorId,
      name: data.name.trim(),
      category: data.category.trim(),
      imageUrl: data.imageUrl.trim() || 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400',
      logoUrl: data.logoUrl.trim() || 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=100',
      address: data.address.trim(),
      city: data.city.trim(),
      state: data.state.trim(),
      latitude: parseFloat(data.latitude) || -23.5505,
      longitude: parseFloat(data.longitude) || -46.6333,
      phone: formatPhone(data.phone).trim(),
      description: data.description.trim(),
      minPurchaseValue: parseFloat(data.minPurchaseValue) || 50,
      verified: data.verified,
      couponValue: parseFloat(data.couponValue) || 0,
      offers: data.offers.map((o) => ({
        id: o.id,
        sponsorId: resolvedSponsorId,
        sponsorName: data.name.trim(),
        title: o.title,
        description: o.description,
        imageUrl: o.imageUrl || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400',
        discount: o.discount,
        likes: editingSponsor?.offers?.find((eo) => eo.id === o.id)?.likes ?? 0,
        comments: editingSponsor?.offers?.find((eo) => eo.id === o.id)?.comments ?? 0,
        shares: editingSponsor?.offers?.find((eo) => eo.id === o.id)?.shares ?? 0,
      })),
      stories: editingSponsor?.stories ?? [],
      galleryImages: data.galleryImages,
      promotionalVideos: data.promotionalVideos,
    };
    addManagedCity({
      id: `city_${Date.now()}`,
      city: sponsorData.city,
      state: sponsorData.state,
      createdAt: new Date().toISOString(),
    });
    if (editingSponsor) {
      updateSponsor(sponsorData);
      Alert.alert('Sucesso', `${sponsorData.name} atualizado!`);
    } else {
      addSponsor(sponsorData);
      Alert.alert('Sucesso', `${sponsorData.name} adicionado!`);
    }
    setShowSponsorModal(false);
    setEditingSponsor(null);
    setSponsorDraftId('');
  }, [editingSponsor, sponsorDraftId, updateSponsor, addSponsor, addManagedCity]);

  const handleSaveManagedCity = useCallback(async () => {
    const city = newCityName.trim();
    const state = newCityState.trim().toUpperCase();
    if (!city) {
      Alert.alert('Erro', 'Informe o nome da cidade');
      return;
    }
    if (state.length !== 2) {
      Alert.alert('Erro', 'Informe a UF com 2 letras');
      return;
    }
    const exists = cities.some((c) => c.city.toLowerCase() === city.toLowerCase() && c.state.toUpperCase() === state);
    if (exists) {
      Alert.alert('Aviso', 'Esta cidade ja esta cadastrada');
      return;
    }
    const created: ManagedCity = {
      id: `city_${Date.now()}`,
      city,
      state,
      createdAt: new Date().toISOString(),
    };

    try {
      if (newCityPhotoUri) {
        const uploadedImage = await uploadAdminImage({
          folder: 'city-images',
          itemId: `${state}-${city}`,
          fileUri: newCityPhotoUri,
        });
        await saveCityImage(city, uploadedImage.publicUrl, state);
      } else {
        addManagedCity(created);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Nao foi possivel salvar a foto da cidade';

      if (isAdminImageBucketMissingError(error) || isAdminImageStoragePolicyError(error)) {
        showAdminImageStorageSetupAlert(errorMessage);
      } else {
        Alert.alert('Falha ao salvar cidade', errorMessage);
      }
      return;
    }

    setShowAddCityModal(false);
    setShowCityPicker(false);
    setShowStatePicker(false);
    setNewCitySearch('');
    setNewCityName('');
    setNewCityState('SP');
    setNewCityPhotoUri(null);
    setSelectedCity(city);
    setCitySubTab('prize');
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [addManagedCity, cities, newCityName, newCityPhotoUri, newCityState, saveCityImage, showAdminImageStorageSetupAlert]);

  const handleDeleteSponsor = useCallback((sponsor: Sponsor) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Excluir Patrocinador', `Tem certeza que deseja excluir "${sponsor.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteSponsor(sponsor.id) },
    ]);
  }, [deleteSponsor]);

  const handlePrintBatch = useCallback(async (batch: CouponBatch) => {
    try {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      console.log('[Admin] Printing batch:', batch.id, 'with', batch.codes.length, 'codes');
      const html = generateThermalPrintHTML(batch);
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print();
            }, 500);
          };
        } else {
          await Print.printAsync({ html });
        }
      } else {
        await Print.printAsync({ html });
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.log('[Admin] Print error:', err);
      Alert.alert('Erro ao Imprimir', 'Nao foi possivel imprimir. Verifique se a impressora termica esta conectada via Bluetooth ou WiFi.');
    }
  }, []);

  const handlePickCityPhoto = useCallback(async (city: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setImageCanvasSession({
        asset: mapPickerAssetToImageCanvasAsset(result.assets[0]),
        title: `Editar foto de ${city}`,
        description: 'Ajuste a imagem antes de salvar no servidor.',
        aspectRatio: 16 / 9,
        confirmLabel: 'SALVAR FOTO DA CIDADE',
        onConfirm: async (editedAsset) => {
          try {
            const uploadedImage = await uploadAdminImage({
              folder: 'city-images',
              itemId: `${selectedCityState ?? 'city'}-${city}`,
              fileUri: editedAsset.uri,
              fileName: editedAsset.fileName,
              mimeType: editedAsset.mimeType,
            });

            await saveCityImage(city, uploadedImage.publicUrl, selectedCityState ?? undefined);
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            console.log('[Admin] City photo saved for:', city, uploadedImage.publicUrl);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Nao foi possivel salvar a foto da cidade';

            if (isAdminImageBucketMissingError(error) || isAdminImageStoragePolicyError(error)) {
              showAdminImageStorageSetupAlert(errorMessage);
            } else {
              Alert.alert('Falha no upload', errorMessage);
            }

            throw error;
          }
        },
      });
    }
  }, [saveCityImage, selectedCityState, showAdminImageStorageSetupAlert]);

  const handlePickNewCityPhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setImageCanvasSession({
        asset: mapPickerAssetToImageCanvasAsset(result.assets[0]),
        title: 'Editar foto da nova cidade',
        description: 'Ajuste a capa da cidade antes de salvar.',
        aspectRatio: 16 / 9,
        confirmLabel: 'USAR ESTA FOTO',
        onConfirm: async (editedAsset) => {
          setNewCityPhotoUri(editedAsset.uri);
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      });
    }
  }, []);

  const handlePickPrizeBg = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setImageCanvasSession({
        asset: mapPickerAssetToImageCanvasAsset(result.assets[0]),
        title: 'Editar fundo do premio',
        description: 'Ajuste a imagem que sera usada como fundo do premio da cidade.',
        aspectRatio: 16 / 9,
        confirmLabel: 'USAR NO PREMIO',
        onConfirm: async (editedAsset) => {
          setPrizeBgUrl(editedAsset.uri);
          setPrizeBgUploadMeta({
            fileName: editedAsset.fileName,
            mimeType: editedAsset.mimeType,
          });
        },
      });
    }
  }, []);

  const handlePickPromoBackground = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setImageCanvasSession({
        asset: mapPickerAssetToImageCanvasAsset(result.assets[0]),
        title: 'Editar fundo do QR promocional',
        description: 'Ajuste a imagem que aparecera no card do usuario apos o scan.',
        aspectRatio: 16 / 9,
        confirmLabel: 'USAR NO QR PROMO',
        onConfirm: async (editedAsset) => {
          setPromoForm((prev) => ({ ...prev, backgroundImageUrl: editedAsset.uri }));
          setPromoBgUploadMeta({
            fileName: editedAsset.fileName,
            mimeType: editedAsset.mimeType,
          });
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      });
    }
  }, []);

  const handleSaveCityPrize = useCallback(async () => {
    if (!selectedCity || savingCityPrize) return;

    setSavingCityPrize(true);

    try {
      let resolvedBackgroundImageUrl = prizeBgUrl.trim();

      if (
        resolvedBackgroundImageUrl &&
        !resolvedBackgroundImageUrl.startsWith('http://') &&
        !resolvedBackgroundImageUrl.startsWith('https://')
      ) {
        const uploadedImage = await uploadAdminImage({
          folder: 'prizes',
          itemId: selectedCity,
          fileUri: resolvedBackgroundImageUrl,
          fileName: prizeBgUploadMeta?.fileName,
          mimeType: prizeBgUploadMeta?.mimeType,
        });

        resolvedBackgroundImageUrl = uploadedImage.publicUrl;
      }

      const prize: GrandPrize = {
        id: cityPrizeData?.id ?? `gp_${selectedCity}_${Date.now()}`,
        title: `GRANDE PREMIO - ${selectedCity}`,
        value: parseFloat(prizeVal) || 10000,
        imageUrl: cityPrizeData?.imageUrl ?? grandPrizeConfig?.imageUrl ?? '',
        backgroundImageUrl: resolvedBackgroundImageUrl || undefined,
        drawDate: prizeDrawDate || '2026-05-15',
        lotteryReference: prizeLotteryRef || 'Loteria Federal',
        description: prizeMsg || `Grande premio da cidade de ${selectedCity}`,
        isActive: true,
        city: selectedCity,
        state: cities.find((c) => c.city === selectedCity)?.state,
      };

      await saveCityPrize(selectedCity, prize);
      setPrizeBgUrl(resolvedBackgroundImageUrl);
      setPrizeBgUploadMeta(null);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert('Sucesso', `Premio de ${selectedCity} salvo!`);
    } catch (error) {
      console.log('[Admin] Failed to save city prize:', error);
      const errorMessage = error instanceof Error ? error.message : 'Nao foi possivel salvar o premio.';

      if (isAdminImageBucketMissingError(error) || isAdminImageStoragePolicyError(error)) {
        showAdminImageStorageSetupAlert(errorMessage);
        return;
      }

      Alert.alert('Erro', errorMessage);
    } finally {
      setSavingCityPrize(false);
    }
  }, [selectedCity, savingCityPrize, prizeBgUrl, prizeBgUploadMeta?.fileName, prizeBgUploadMeta?.mimeType, cityPrizeData, prizeVal, grandPrizeConfig?.imageUrl, prizeDrawDate, prizeLotteryRef, prizeMsg, cities, saveCityPrize, showAdminImageStorageSetupAlert]);

  const handleSendNotification = useCallback((notif: AdminNotification) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Enviar Notificacao', `Enviar "${notif.title}" para todos os usuarios?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Enviar', onPress: () => { updateNotification({ ...notif, sent: true }); Alert.alert('Enviado', 'Notificacao enviada!'); } },
    ]);
  }, [updateNotification]);

  const isLotteryClaimNotification = useCallback((notif: AdminNotification) => {
    return notif.type === 'prize' && notif.metadata?.kind === 'lottery_claim' && notif.metadata?.status === 'requested';
  }, []);

  const isIdentityVerificationNotification = useCallback((notif: AdminNotification) => {
    return notif.type === 'identity_verification' && notif.metadata?.kind === 'identity_verification' && notif.metadata?.verificationStatus === 'pending';
  }, []);

  const handleVerifyIdentity = useCallback((notif: AdminNotification) => {
    const metadata = notif.metadata;
    const userEmail = metadata?.userEmail ?? '';
    const cpf = formatCPF(metadata?.cpf ?? '');

    if (!userEmail || !cpf) {
      Alert.alert('Dados incompletos', 'Esta solicitacao nao possui os dados necessarios para verificacao.');
      return;
    }

    Alert.alert(
      'Verificar identidade',
      `Confirmar verificacao de identidade para ${userEmail}?\n\nCPF: ${cpf}`,
      [
        { text: 'Rejeitar', onPress: () => {
          verifyIdentity(notif.id, userEmail, false);
          console.log('[Admin] Identity verification rejected for:', userEmail);
          Alert.alert('Rejeitado', 'Verificacao de identidade rejeitada.');
          updateNotification({
            ...notif,
            metadata: {
              ...metadata,
              verificationStatus: 'rejected',
              verifiedAt: new Date().toISOString(),
            },
          });
        }, style: 'destructive' },
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aprovar',
          onPress: async () => {
            verifyIdentity(notif.id, userEmail, true);
            console.log('[Admin] Identity verification approved for:', userEmail);
            updateNotification({
              ...notif,
              sent: true,
              metadata: {
                ...metadata,
                verificationStatus: 'verified',
                identityVerified: true,
                verifiedAt: new Date().toISOString(),
              },
            });
            Alert.alert('Sucesso', 'Identidade verificada e usuario liberado para saques.');
          },
        },
      ],
    );
  }, [verifyIdentity, updateNotification]);

  const handleConfirmLotteryClaim = useCallback((notif: AdminNotification) => {
    const metadata = notif.metadata;
    const amount = metadata?.amount ?? 0;
    const targetEmail = metadata?.userEmail ?? '';
    const lotteryCode = metadata?.lotteryCode ?? '';
    const ticketId = metadata?.ticketId ?? '';

    if (!targetEmail || !ticketId || amount <= 0) {
      Alert.alert('Dados incompletos', 'Esta solicitacao nao possui os dados necessarios para credito.');
      return;
    }

    Alert.alert(
      'Confirmar premio',
      `Creditar R$ ${amount.toFixed(2)} para ${targetEmail}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            const credited = await creditUserBalance(
              targetEmail,
              amount,
              `Premio Loteria Federal - Bilhete ${lotteryCode || ticketId}`,
            );

            if (!credited) {
              Alert.alert('Erro', 'Nao foi possivel creditar o premio para este usuario.');
              return;
            }

            updateNotification({
              ...notif,
              sent: true,
              metadata: {
                ...metadata,
                status: 'confirmed',
                confirmedAt: new Date().toISOString(),
              },
            });

            Alert.alert('Sucesso', 'Premio conferido e saldo atualizado com sucesso.');
          },
        },
      ],
    );
  }, [creditUserBalance, updateNotification]);

  const loadUserReviewRows = useCallback(async () => {
    setLoadingUserReviewRows(true);

    try {
      const rows = await fetchUsers();
      const statusWeight: Record<UserReviewStatus, number> = {
        pending: 0,
        rejected: 1,
        approved: 2,
      };

      const sorted = [...rows].sort((left, right) => {
        const statusDiff = statusWeight[getUserReviewStatus(left.profile)] - statusWeight[getUserReviewStatus(right.profile)];
        if (statusDiff !== 0) return statusDiff;

        const leftTime = new Date(left.profile.adminReviewedAt || left.profile.createdAt || 0).getTime();
        const rightTime = new Date(right.profile.adminReviewedAt || right.profile.createdAt || 0).getTime();
        return rightTime - leftTime;
      });

      setUserReviewRows(sorted);
    } catch (error) {
      console.log('[Admin] Failed to load users for review:', error);
      Alert.alert('Erro', 'Nao foi possivel carregar os usuarios para revisao.');
    } finally {
      setLoadingUserReviewRows(false);
    }
  }, [fetchUsers]);

  const handleOpenUserReviewModal = useCallback(() => {
    setSelectedUserReviewEmail(null);
    setShowUserReviewModal(true);
    void loadUserReviewRows();
  }, [loadUserReviewRows]);

  const handleCloseUserReviewModal = useCallback(() => {
    setShowUserReviewModal(false);
    setSelectedUserReviewEmail(null);
    setSavingUserReviewEmail('');
  }, []);

  const handleRefreshUserReviewRows = useCallback(() => {
    void loadUserReviewRows();
  }, [loadUserReviewRows]);

  const handleUpdateUserActivation = useCallback(async (row: UserReviewRow, nextActive: boolean) => {
    const normalizedEmail = row.profile.email.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert('Erro', 'Este usuario nao possui e-mail valido para atualizar.');
      return;
    }

    const nextProfile: UserProfile = {
      ...row.profile,
      email: normalizedEmail,
      isActive: nextActive,
      identityVerified: nextActive ? true : row.profile.identityVerified,
      adminReviewStatus: nextActive ? 'approved' : 'rejected',
      adminReviewedAt: new Date().toISOString(),
    };

    setSavingUserReviewEmail(normalizedEmail);

    try {
      const saved = await upsertUserServerOnly(nextProfile, row.balance, row.points);
      if (!saved) {
        throw new Error('Failed to persist user activation in the server');
      }

      setUserReviewRows((currentRows) => currentRows.map((item) => (
        item.profile.email.trim().toLowerCase() === normalizedEmail
          ? { ...item, profile: nextProfile }
          : item
      )));

      if (normalizedEmail === currentUserProfile.email.trim().toLowerCase()) {
        await refreshProfile();
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(nextActive ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      }

      Alert.alert(
        'Sucesso',
        nextActive ? 'Usuario ativado e revisado com sucesso.' : 'Usuario desativado com sucesso.',
      );
    } catch (error) {
      console.log('[Admin] Failed to update user activation:', error);
      Alert.alert('Erro', 'Nao foi possivel atualizar este usuario.');
    } finally {
      setSavingUserReviewEmail('');
    }
  }, [currentUserProfile.email, refreshProfile]);

  const handleSyncCurrentDataToServer = useCallback(async () => {
    setSyncingServer(true);

    try {
      await Promise.all([
        refreshSponsors(),
        refreshManagedCities(),
      ]);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert('Sucesso', 'Painel atualizado com as cidades e os patrocinadores salvos no servidor.');
    } catch (error) {
      console.log('[Admin] Failed refreshing cities and sponsors from server:', error);
      Alert.alert('Erro', 'Nao foi possivel atualizar as cidades e os patrocinadores salvos no servidor.');
    } finally {
      setSyncingServer(false);
    }
  }, [refreshManagedCities, refreshSponsors]);

  if (!isAdmin) {
    return (
      <View style={a.denied}>
        <Shield size={64} color={Colors.dark.textMuted} />
        <Text style={a.deniedTtl}>Acesso Restrito</Text>
        <Text style={a.deniedSub}>Esta area e exclusiva para administradores.</Text>
      </View>
    );
  }

  const renderOverview = () => (
    <>
      <View style={a.statsRow}>
        <StatCard icon={Globe} label="Estados" value={states.length.toString()} color={Colors.dark.purple} />
        <StatCard icon={Building2} label="Cidades" value={cities.length.toString()} color={Colors.dark.orange} />
        <StatCard icon={Store} label="Lojas" value={sponsors.length.toString()} color={Colors.dark.neonGreen} />
      </View>
      <View style={a.statsRow}>
        <StatCard icon={Gift} label="Ofertas" value={totalOffers.toString()} color={Colors.dark.gold} />
        <StatCard icon={Ticket} label="Cupons" value={totalServerCoupons.toString()} color={Colors.dark.warning} />
        <StatCard icon={Trophy} label="Premios" value={Object.keys(cityPrizes).length.toString()} color={Colors.dark.danger} />
      </View>

      <View style={a.section}>
        <View style={a.secHdr}>
          <BarChart3 size={18} color={Colors.dark.neonGreen} />
          <Text style={a.secTtl}>Resumo Geral</Text>
        </View>
        <View style={a.summaryGrid}>
          <View style={a.summaryItem}>
            <Text style={a.summaryVal}>{totalServerCoupons}</Text>
            <Text style={a.summaryLbl}>Cupons no Servidor</Text>
          </View>
          <View style={a.summaryItem}>
            <Text style={a.summaryVal}>{couponBatches.length}</Text>
            <Text style={a.summaryLbl}>Lotes Gerados</Text>
          </View>
          <View style={a.summaryItem}>
            <Text style={a.summaryVal}>{promoQRCodes.length}</Text>
            <Text style={a.summaryLbl}>QR Promocionais</Text>
          </View>
          <View style={a.summaryItem}>
            <Text style={a.summaryVal}>{notifications.length}</Text>
            <Text style={a.summaryLbl}>Notificacoes</Text>
          </View>
        </View>
      </View>

      <View style={a.section}>
        <View style={a.secHdr}>
          <Bell size={18} color={Colors.dark.warning} />
          <Text style={a.secTtl}>Acoes Rapidas</Text>
        </View>
        <TouchableOpacity style={a.actionRow} onPress={() => setMainTab('states')} activeOpacity={0.7}>
          <View style={[a.actIcon, { backgroundColor: 'rgba(124,58,237,0.1)' }]}>
            <Globe size={18} color={Colors.dark.purple} />
          </View>
          <View style={a.actInfo}>
            <Text style={a.actTtl}>Ver Estados</Text>
            <Text style={a.actSub}>{states.length} estados com patrocinadores</Text>
          </View>
          <ChevronRight size={18} color={Colors.dark.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={a.actionRow} onPress={() => setMainTab('cities')} activeOpacity={0.7}>
          <View style={[a.actIcon, { backgroundColor: 'rgba(255,107,0,0.1)' }]}>
            <Building2 size={18} color={Colors.dark.orange} />
          </View>
          <View style={a.actInfo}>
            <Text style={a.actTtl}>Ver Cidades</Text>
            <Text style={a.actSub}>{cities.length} cidades cadastradas</Text>
          </View>
          <ChevronRight size={18} color={Colors.dark.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={a.actionRow} onPress={handleOpenUserReviewModal} activeOpacity={0.7}>
          <View style={[a.actIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
            <Users size={18} color="#2563EB" />
          </View>
          <View style={a.actInfo}>
            <Text style={a.actTtl}>Verificar Dados de Usuarios</Text>
            <Text style={a.actSub}>Revisar cadastro e ativar ou desativar contas</Text>
          </View>
          <ChevronRight size={18} color={Colors.dark.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={a.actionRow} onPress={() => { setEditingNotif(null); setShowNotifModal(true); }} activeOpacity={0.7}>
          <View style={[a.actIcon, { backgroundColor: 'rgba(255,190,11,0.1)' }]}>
            <Bell size={18} color={Colors.dark.warning} />
          </View>
          <View style={a.actInfo}>
            <Text style={a.actTtl}>Nova Notificacao</Text>
            <Text style={a.actSub}>Criar e enviar notificacao</Text>
          </View>
          <ChevronRight size={18} color={Colors.dark.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={a.actionRow} onPress={handleSyncCurrentDataToServer} activeOpacity={0.7} disabled={syncingServer}>
          <View style={[a.actIcon, { backgroundColor: 'rgba(0,184,101,0.1)' }]}>
            <Save size={18} color={Colors.dark.neonGreen} />
          </View>
          <View style={a.actInfo}>
            <Text style={a.actTtl}>{syncingServer ? 'Sincronizando...' : 'Sincronizar com Servidor'}</Text>
            <Text style={a.actSub}>Atualizar cidades e lojas salvas no servidor</Text>
          </View>
          <ChevronRight size={18} color={Colors.dark.textMuted} />
        </TouchableOpacity>
      </View>
    </>
  );

  const renderStates = () => {
    if (selectedState) {
      const stateData = states.find((s) => s.state === selectedState);
      const stateCities = stateData?.cities ?? [];
      return (
        <>
          <TouchableOpacity style={a.backBtn} onPress={() => setSelectedState(null)} activeOpacity={0.7}>
            <ChevronLeft size={20} color={Colors.dark.neonGreen} />
            <Text style={a.backBtnTxt}>Todos os Estados</Text>
          </TouchableOpacity>

          <View style={a.cityHeaderCard}>
            <LinearGradient colors={[Colors.dark.purple, '#5B21B6']} style={a.cityHeaderGrad}>
              <Globe size={28} color="#fff" />
              <Text style={a.cityHeaderName}>{selectedState}</Text>
              <Text style={a.cityHeaderSub}>{stateSponsors.length} patrocinadores • {stateCities.length} cidades</Text>
            </LinearGradient>
          </View>

          <View style={a.section}>
            <View style={a.secHdr}>
              <Building2 size={18} color={Colors.dark.orange} />
              <Text style={a.secTtl}>Cidades em {selectedState}</Text>
            </View>
            {stateCities.map((city) => {
              const cityCount = sponsors.filter((s) => s.city === city && s.state === selectedState).length;
              const hasPrize = !!cityPrizes[city];
              return (
                <TouchableOpacity
                  key={city}
                  style={a.cityRow}
                  onPress={() => { setSelectedCity(city); setSelectedState(null); setMainTab('cities'); setCitySubTab('prize'); }}
                  activeOpacity={0.7}
                >
                  <View style={a.cityRowIcon}>
                    <MapPin size={16} color={Colors.dark.orange} />
                  </View>
                  <View style={a.cityRowInfo}>
                    <Text style={a.cityRowName}>{city}</Text>
                    <Text style={a.cityRowMeta}>{cityCount} patrocinadores</Text>
                  </View>
                  {hasPrize && (
                    <View style={a.cityPrizeBadge}>
                      <Trophy size={10} color="#000" />
                    </View>
                  )}
                  <View style={a.cityRowCount}>
                    <Text style={a.cityRowCountTxt}>{cityCount}</Text>
                  </View>
                  <ChevronRight size={16} color={Colors.dark.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={a.section}>
            <View style={a.secHdr}>
              <Store size={18} color={Colors.dark.neonGreen} />
              <Text style={a.secTtl}>Patrocinadores em {selectedState}</Text>
            </View>
            {stateSponsors.map((sp) => (
              <SponsorRow key={sp.id} sponsor={sp} onEdit={() => handleOpenEdit(sp)} onDelete={() => handleDeleteSponsor(sp)} />
            ))}
          </View>
        </>
      );
    }

    return (
      <>
        <View style={a.section}>
          <View style={a.secHdr}>
            <Globe size={18} color={Colors.dark.purple} />
            <Text style={a.secTtl}>Estados ({states.length})</Text>
          </View>
          {states.length === 0 ? (
            <View style={a.emptyState}>
              <Globe size={32} color={Colors.dark.textMuted} />
              <Text style={a.emptyTxt}>Nenhum estado com patrocinadores</Text>
            </View>
          ) : (
            states.map((st) => (
              <TouchableOpacity
                key={st.state}
                style={a.stateRow}
                onPress={() => setSelectedState(st.state)}
                activeOpacity={0.7}
              >
                <View style={a.stateIcon}>
                  <Map size={20} color="#fff" />
                </View>
                <View style={a.stateInfo}>
                  <Text style={a.stateName}>{st.state}</Text>
                  <Text style={a.stateMeta}>{st.cities.length} cidades • {st.count} patrocinadores</Text>
                </View>
                <View style={a.stateCountBadge}>
                  <Text style={a.stateCountTxt}>{st.count}</Text>
                </View>
                <ChevronRight size={18} color={Colors.dark.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </>
    );
  };

  const renderCityPanel = () => {
    if (!selectedCity) {
      return (
        <>
          <View style={a.section}>
            <View style={a.secHdr}>
              <Plus size={18} color={Colors.dark.neonGreen} />
              <Text style={a.secTtl}>Cadastro de Cidades</Text>
            </View>
            <TouchableOpacity style={a.addBtn} activeOpacity={0.8} onPress={() => setShowAddCityModal(true)}>
              <Plus size={16} color={Colors.dark.neonGreen} />
              <Text style={a.addBtnTxt}>Adicionar Cidade</Text>
            </TouchableOpacity>
          </View>

          <View style={a.section}>
            <View style={a.secHdr}>
              <Building2 size={18} color={Colors.dark.orange} />
              <Text style={a.secTtl}>Cidades ({cities.length})</Text>
            </View>
            {cities.length === 0 ? (
              <View style={a.emptyState}>
                <Building2 size={32} color={Colors.dark.textMuted} />
                <Text style={a.emptyTxt}>Nenhuma cidade com patrocinadores</Text>
              </View>
            ) : (
              cities.map((ct) => {
                const hasPrize = !!cityPrizes[ct.city];
                return (
                  <TouchableOpacity
                    key={`${ct.city}|${ct.state}`}
                    style={a.cityRow}
                    onPress={() => { setSelectedCity(ct.city); setCitySubTab('prize'); }}
                    activeOpacity={0.7}
                  >
                    <View style={a.cityRowIcon}>
                      {getCityImageUri(ct.city) ? (
                        <Image source={{ uri: getCityImageUri(ct.city)! }} style={a.cityThumbImage} contentFit="cover" />
                      ) : (
                        <View style={a.cityThumbPlaceholder}>
                          <MapPin size={14} color={Colors.dark.orange} />
                        </View>
                      )}
                    </View>
                    <View style={a.cityRowInfo}>
                      <Text style={a.cityRowName}>{ct.city}</Text>
                      <Text style={a.cityRowMeta}>{ct.state} • {ct.count} patrocinadores</Text>
                    </View>
                    {hasPrize && (
                      <View style={a.cityPrizeBadge}>
                        <Trophy size={10} color="#000" />
                      </View>
                    )}
                    <View style={a.cityRowCount}>
                      <Text style={a.cityRowCountTxt}>{ct.count}</Text>
                    </View>
                    <ChevronRight size={16} color={Colors.dark.textMuted} />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </>
      );
    }

    return (
      <>
        <TouchableOpacity style={a.backBtn} onPress={() => setSelectedCity(null)} activeOpacity={0.7}>
          <ChevronLeft size={20} color={Colors.dark.neonGreen} />
          <Text style={a.backBtnTxt}>Todas as Cidades</Text>
        </TouchableOpacity>

        {(() => {
          const headerImageUri = getCityImageUri(selectedCity);
          const showHeaderImage = Boolean(headerImageUri) && !cityHeaderImageError;
          return (
        <View style={a.cityHeaderCard}>
          <View style={a.cityHeaderImgWrap}>
            <LinearGradient colors={[Colors.dark.orange, Colors.dark.orangeDim]} style={StyleSheet.absoluteFillObject} />
            {showHeaderImage ? (
              <Image
                source={{ uri: headerImageUri! }}
                style={a.cityHeaderBgImg}
                contentFit="cover"
                onError={() => setCityHeaderImageError(true)}
              />
            ) : null}
            <View style={[a.cityHeaderImgOverlay, !showHeaderImage && a.cityHeaderNoImageOverlay]}>
              <MapPin size={28} color="#fff" />
              <Text style={a.cityHeaderName}>{selectedCity}</Text>
              <Text style={a.cityHeaderSub}>{citySponsors.length} patrocinadores • {cities.find((c) => c.city === selectedCity)?.state ?? ''}</Text>
              <TouchableOpacity style={a.cityPhotoBtn} onPress={() => handlePickCityPhoto(selectedCity!)} activeOpacity={0.7}>
                <ImageIcon size={14} color="#fff" />
                <Text style={a.cityPhotoBtnTxt}>{showHeaderImage ? 'Trocar Foto' : 'Adicionar Foto da Cidade'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
          );
        })()}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={a.tabBar} contentContainerStyle={a.tabBarContent}>
          <TabButton label="Premio" active={citySubTab === 'prize'} onPress={() => setCitySubTab('prize')} icon={Trophy} />
          <TabButton label="Lojas" active={citySubTab === 'sponsors'} onPress={() => setCitySubTab('sponsors')} icon={Store} />
          <TabButton label="Cupons" active={citySubTab === 'coupons'} onPress={() => setCitySubTab('coupons')} icon={Ticket} />
          <TabButton label="QR Promo" active={citySubTab === 'promoqr'} onPress={() => setCitySubTab('promoqr')} icon={Gift} />
          <TabButton label="Notificacoes" active={citySubTab === 'notifications'} onPress={() => setCitySubTab('notifications')} icon={Bell} />
        </ScrollView>

        {citySubTab === 'prize' && renderCityPrize()}
        {citySubTab === 'sponsors' && renderCitySponsors()}
        {citySubTab === 'coupons' && renderCityCoupons()}
        {citySubTab === 'promoqr' && renderCityPromoQR()}
        {citySubTab === 'notifications' && renderCityNotifications()}
      </>
    );
  };

  const renderCityPrize = () => (
    <View style={a.section}>
      <View style={a.secHdr}>
        <Trophy size={18} color={Colors.dark.gold} />
        <Text style={a.secTtl}>Premio - {selectedCity}</Text>
      </View>

      <View style={a.field}>
        <Text style={a.fLbl}>Foto de Fundo</Text>
        <TouchableOpacity style={a.pickImgBtn} onPress={handlePickPrizeBg} activeOpacity={0.8}>
          <ImageIcon size={18} color={Colors.dark.neonGreen} />
          <Text style={a.pickImgTxt}>{prizeBgUrl ? 'Trocar Foto da Galeria' : 'Escolher Foto da Galeria'}</Text>
        </TouchableOpacity>
      </View>
      {prizeBgUrl ? (
        <View style={a.prizePreview}>
          <Image source={{ uri: prizeBgUrl }} style={a.prizePreviewImg} contentFit="cover" contentPosition="center" />
          <View style={a.prizePreviewOverlay}>
            <Text style={a.prizePreviewTxt}>Preview do Fundo</Text>
            <TouchableOpacity style={a.changeBgBtn} onPress={handlePickPrizeBg} activeOpacity={0.7}>
              <ImageIcon size={14} color="#fff" />
              <Text style={a.changeBgTxt}>Trocar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={a.field}>
        <Text style={a.fLbl}>Data do Sorteio</Text>
        <TextInput style={a.inp} value={prizeDrawDate} onChangeText={setPrizeDrawDate} placeholder="2026-05-15" placeholderTextColor={Colors.dark.textMuted} />
        <Text style={a.fieldHint}>Formato: AAAA-MM-DD (ex: 2026-05-15)</Text>
      </View>

      <View style={a.field}>
        <Text style={a.fLbl}>Valor do Premio (R$)</Text>
        <TextInput style={a.inp} value={prizeVal} onChangeText={setPrizeVal} placeholder="10000" placeholderTextColor={Colors.dark.textMuted} keyboardType="numeric" />
      </View>

      <View style={a.field}>
        <Text style={a.fLbl}>Referencia da Loteria</Text>
        <TextInput style={a.inp} value={prizeLotteryRef} onChangeText={setPrizeLotteryRef} placeholder="Loteria Federal - 1 ao 5 premio" placeholderTextColor={Colors.dark.textMuted} />
      </View>

      <View style={a.field}>
        <Text style={a.fLbl}>Descricao do Premio</Text>
        <TextInput style={[a.inp, { minHeight: 80, textAlignVertical: 'top' as const }]} value={prizeMsg} onChangeText={setPrizeMsg} placeholder="Descricao do grande premio..." placeholderTextColor={Colors.dark.textMuted} multiline />
      </View>

      <TouchableOpacity style={[a.saveBtn, savingCityPrize && a.saveBtnDisabled]} onPress={() => { void handleSaveCityPrize(); }} activeOpacity={0.8} disabled={savingCityPrize}>
        <LinearGradient colors={savingCityPrize ? [Colors.dark.surfaceLight, Colors.dark.inputBg] : [Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={a.saveBtnG}>
          {savingCityPrize ? <ActivityIndicator size="small" color="#000" /> : <Save size={16} color="#000" />}
          <Text style={a.saveBtnT}>{savingCityPrize ? 'SALVANDO PREMIO...' : `SALVAR PREMIO DE ${selectedCity?.toUpperCase()}`}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderCitySponsors = () => (
    <View style={a.section}>
      <View style={a.secHdr}>
        <Store size={18} color={Colors.dark.neonGreen} />
        <Text style={a.secTtl}>Lojas em {selectedCity} ({citySponsors.length})</Text>
      </View>
      {citySponsors.length === 0 ? (
        <View style={a.emptyState}>
          <Store size={32} color={Colors.dark.textMuted} />
          <Text style={a.emptyTxt}>Nenhum patrocinador nesta cidade</Text>
        </View>
      ) : (
        citySponsors.map((sp) => (
          <SponsorRow key={sp.id} sponsor={sp} onEdit={() => handleOpenEdit(sp)} onDelete={() => handleDeleteSponsor(sp)} />
        ))
      )}
      <TouchableOpacity style={a.addBtn} activeOpacity={0.8} onPress={handleOpenAdd} testID="add-sponsor-btn">
        <Plus size={16} color={Colors.dark.neonGreen} />
        <Text style={a.addBtnTxt}>Novo Patrocinador (Perfil + Promocoes)</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCityCoupons = () => {
    const citySponsorIds = citySponsors.map((s) => s.id);
    const cityCouponBatches = couponBatches.filter((batch) => citySponsorIds.includes(batch.sponsorId));
    const cityCouponCount = cityCouponBatches.reduce((sum, batch) => sum + batch.quantity, 0);

    return (
      <>
        <View style={a.section}>
          <View style={a.secHdr}>
            <Ticket size={18} color={Colors.dark.neonGreen} />
            <Text style={a.secTtl}>Cupons - {selectedCity}</Text>
          </View>
          <View style={a.summaryGrid}>
            <View style={a.summaryItem}>
              <Text style={a.summaryVal}>{cityCouponCount}</Text>
              <Text style={a.summaryLbl}>Cupons no Servidor</Text>
            </View>
            <View style={a.summaryItem}>
              <Text style={a.summaryVal}>{cityCouponBatches.length}</Text>
              <Text style={a.summaryLbl}>Lotes da Cidade</Text>
            </View>
          </View>
        </View>
        <View style={a.section}>
          <View style={a.secHdr}>
            <Package size={18} color={Colors.dark.neonGreen} />
            <Text style={a.secTtl}>Lotes de Cupons</Text>
          </View>
          {cityCouponBatches.length === 0 ? (
            <View style={a.emptyState}>
              <Package size={32} color={Colors.dark.textMuted} />
              <Text style={a.emptyTxt}>Nenhum lote gerado para esta cidade</Text>
            </View>
          ) : (
            cityCouponBatches.map((batch) => (
              <View key={batch.id} style={a.batchRow}>
                <View style={a.batchIcon}>
                  <Hash size={16} color={Colors.dark.neonGreen} />
                </View>
                <View style={a.batchInfo}>
                  <Text style={a.batchName}>{batch.sponsorName}</Text>
                  <Text style={a.batchMeta}>{batch.quantity} cupons - R$ {batch.value.toFixed(2)} cada</Text>
                </View>
                <Text style={a.batchPrefix}>{batch.prefix}</Text>
                <TouchableOpacity
                  style={a.batchPrintBtn}
                  onPress={() => handlePrintBatch(batch)}
                  activeOpacity={0.7}
                  testID={`print-batch-${batch.id}`}
                >
                  <Printer size={14} color={Colors.dark.neonGreen} />
                </TouchableOpacity>
              </View>
            ))
          )}
          <TouchableOpacity style={a.addBtn} activeOpacity={0.8} onPress={() => setShowBatchModal(true)}>
            <Plus size={16} color={Colors.dark.neonGreen} />
            <Text style={a.addBtnTxt}>Gerar Novo Lote</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  };

  const handleOpenPromoForm = (promo?: PromotionalQR) => {
    if (promo) {
      setEditingPromo(promo);
      setPromoForm({
        sponsorId: promo.sponsorId,
        sponsorName: promo.sponsorName,
        sponsorAddress: promo.sponsorAddress,
        backgroundImageUrl: promo.backgroundImageUrl || '',
        message: promo.message,
        couponValue: promo.couponValue.toString(),
        minPurchase: promo.minPurchase.toString(),
      });
    } else {
      setEditingPromo(null);
      setPromoForm({ sponsorId: '', sponsorName: '', sponsorAddress: '', backgroundImageUrl: '', message: '', couponValue: '10', minPurchase: '100' });
    }
    setPromoBgUploadMeta(null);
    setShowPromoForm(true);
  };

  const handleSavePromo = async () => {
    if (!promoForm.sponsorName.trim()) {
      Alert.alert('Erro', 'Nome da empresa e obrigatorio');
      return;
    }
    if (!selectedCity) return;
    const cityState = cities.find((c) => c.city === selectedCity)?.state ?? '';
    const couponVal = parseFloat(promoForm.couponValue) || 10;
    const minPurch = parseFloat(promoForm.minPurchase) || 100;
    const defaultMsg = `Parabéns! Quer ganhar 1 Pix de R$ ${couponVal.toFixed(2)}? Vá até a loja ${promoForm.sponsorName} e faça uma compra mínima de R$ ${minPurch.toFixed(2)} e ganhe um cupom para receber um Pix de R$ ${couponVal.toFixed(2)}!`;

    let resolvedBackgroundImageUrl = promoForm.backgroundImageUrl.trim();

    try {
      if (
        resolvedBackgroundImageUrl &&
        !resolvedBackgroundImageUrl.startsWith('http://') &&
        !resolvedBackgroundImageUrl.startsWith('https://')
      ) {
        const uploadedImage = await uploadAdminImage({
          folder: 'promo-qr-backgrounds',
          itemId: editingPromo?.id ?? `${selectedCity}-${promoForm.sponsorName}`,
          fileUri: resolvedBackgroundImageUrl,
          fileName: promoBgUploadMeta?.fileName,
          mimeType: promoBgUploadMeta?.mimeType,
        });

        resolvedBackgroundImageUrl = uploadedImage.publicUrl;
      }

      const promo: PromotionalQR = {
        id: editingPromo?.id ?? `promo_${Date.now()}`,
        sponsorId: promoForm.sponsorId || `sp_promo_${Date.now()}`,
        sponsorName: promoForm.sponsorName.trim(),
        sponsorAddress: promoForm.sponsorAddress.trim(),
        backgroundImageUrl: resolvedBackgroundImageUrl || undefined,
        city: selectedCity,
        state: cityState,
        message: promoForm.message.trim() || defaultMsg,
        couponValue: couponVal,
        minPurchase: minPurch,
        createdAt: editingPromo?.createdAt ?? new Date().toISOString(),
        active: true,
      };

      if (editingPromo) {
        updatePromoQR(promo);
        Alert.alert('Sucesso', `QR Promocional de ${promo.sponsorName} atualizado!`);
      } else {
        addPromoQR(promo);
        Alert.alert('Sucesso', `QR Promocional de ${promo.sponsorName} criado!`);
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPromoForm((prev) => ({ ...prev, backgroundImageUrl: resolvedBackgroundImageUrl }));
      setPromoBgUploadMeta(null);
      setShowPromoForm(false);
      setEditingPromo(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Nao foi possivel salvar a foto de fundo do QR promocional';

      if (isAdminImageBucketMissingError(error) || isAdminImageStoragePolicyError(error)) {
        showAdminImageStorageSetupAlert(errorMessage);
      } else {
        Alert.alert('Falha ao salvar QR Promo', errorMessage);
      }
    }
  };

  const handleCopyPromoQR = async (promo: PromotionalQR) => {
    const payload = JSON.stringify({
      type: 'cashbox_promo',
      promoId: promo.id,
      sponsorId: promo.sponsorId,
      sponsorName: promo.sponsorName,
      sponsorAddress: promo.sponsorAddress,
      backgroundImageUrl: promo.backgroundImageUrl,
      message: promo.message,
      couponValue: promo.couponValue,
      minPurchase: promo.minPurchase,
      city: promo.city,
      state: promo.state,
    });
    try {
      await Clipboard.setStringAsync(payload);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Copiado!', 'Dados do QR Promocional copiados. Use um gerador de QR Code para criar o codigo com este conteudo.');
    } catch {
      Alert.alert('Erro', 'Nao foi possivel copiar');
    }
  };

  const handlePrintPromoQR = async (promo: PromotionalQR) => {
    try {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const qrData = encodeURIComponent(JSON.stringify({
        type: 'cashbox_promo',
        promoId: promo.id,
        sponsorId: promo.sponsorId,
        sponsorName: promo.sponsorName,
        sponsorAddress: promo.sponsorAddress,
        backgroundImageUrl: promo.backgroundImageUrl,
        message: promo.message,
        couponValue: promo.couponValue,
        minPurchase: promo.minPurchase,
        city: promo.city,
        state: promo.state,
      }));
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrData}&format=png&margin=8`;
      const promoMessage = promo.message || `Parabéns! Quer ganhar 1 Pix de R$ ${promo.couponValue.toFixed(2)}? Vá até a loja ${promo.sponsorName} e faça uma compra mínima de R$ ${promo.minPurchase.toFixed(2)} e ganhe um cupom para receber um Pix de R$ ${promo.couponValue.toFixed(2)}!`;
      const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
  @page { margin: 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; text-align: center; padding: 24px; background: #fff; color: #000; }
  .container { max-width: 400px; margin: 0 auto; border: 2px solid #222; border-radius: 16px; padding: 28px 20px; }
  .title { font-size: 24px; font-weight: 900; letter-spacing: 1px; margin-bottom: 2px; }
  .sub { font-size: 13px; color: #888; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
  .qr-wrap { background: #f9f9f9; border-radius: 12px; padding: 16px; display: inline-block; margin: 12px auto; }
  .qr { display: block; margin: 0 auto; }
  .store { font-size: 20px; font-weight: 800; margin-top: 16px; color: #111; }
  .addr { font-size: 13px; color: #777; margin-top: 6px; }
  .value { font-size: 17px; font-weight: 800; color: #F59E0B; margin-top: 14px; background: rgba(245,158,11,0.08); display: inline-block; padding: 8px 20px; border-radius: 8px; }
  .sep { border-top: 2px dashed #ddd; margin: 20px 0; }
  .message { font-size: 13px; color: #555; line-height: 1.6; margin-bottom: 16px; padding: 0 8px; }
  .hint { font-size: 11px; color: #aaa; margin-top: 8px; }
  .footer { font-size: 10px; color: #bbb; margin-top: 16px; }
  @media print {
    body { padding: 0; }
    .container { border: 2px solid #000; }
  }
</style></head><body>
  <div class="container">
    <div class="title">CASHBOX PIX</div>
    <div class="sub">QR Code Promocional</div>
    <div class="sep"></div>
    <div class="message">${promoMessage}</div>
    <div class="qr-wrap">
      <img src="${qrUrl}" class="qr" width="220" height="220" alt="QR Code" />
    </div>
    <div class="store">${promo.sponsorName}</div>
    ${promo.sponsorAddress ? `<div class="addr">${promo.sponsorAddress}</div>` : ''}
    <div class="value">Pix R$ ${promo.couponValue.toFixed(2)} | Compra min R$ ${promo.minPurchase.toFixed(2)}</div>
    <div class="sep"></div>
    <div class="hint">Escaneie com o app CashBox PIX para ver a promocao</div>
    <div class="footer">Impresso em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
  </div>
</body></html>`;
      console.log('[Admin] Printing promo QR for:', promo.sponsorName);
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank', 'width=600,height=800');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print();
            }, 500);
          };
        } else {
          await Print.printAsync({ html });
        }
      } else {
        await Print.printAsync({ html });
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.log('[Admin] Print promo QR error:', err);
      Alert.alert('Erro', 'Nao foi possivel imprimir');
    }
  };

  const renderCityPromoQR = () => {
    const cityPromos = selectedCity ? getPromoQRsByCity(selectedCity) : [];

    return (
      <>
        <View style={a.section}>
          <View style={a.secHdr}>
            <Gift size={18} color="#F59E0B" />
            <Text style={a.secTtl}>QR Codes Promocionais - {selectedCity}</Text>
          </View>
          <Text style={pq.desc}>QR codes que exibem uma mensagem promocional ao usuario. Nao geram cupom - apenas convidam o usuario a ir ate a loja.</Text>

          {cityPromos.length === 0 ? (
            <View style={a.emptyState}>
              <Gift size={32} color={Colors.dark.textMuted} />
              <Text style={a.emptyTxt}>Nenhum QR promocional nesta cidade</Text>
            </View>
          ) : (
            cityPromos.map((promo) => (
              <View key={promo.id} style={pq.row}>
                <View style={pq.rowIcon}>
                  <Gift size={18} color="#F59E0B" />
                </View>
                <View style={pq.rowInfo}>
                  <Text style={pq.rowName} numberOfLines={1}>{promo.sponsorName}</Text>
                  <Text style={pq.rowAddr} numberOfLines={1}>{promo.sponsorAddress || 'Sem endereco'}</Text>
                  <Text style={pq.rowValues}>Pix R$ {promo.couponValue.toFixed(2)} | Min R$ {promo.minPurchase.toFixed(2)}</Text>
                </View>
                <View style={pq.rowActions}>
                  <TouchableOpacity style={pq.actBtn} onPress={() => handleCopyPromoQR(promo)}>
                    <Copy size={14} color={Colors.dark.neonGreen} />
                  </TouchableOpacity>
                  <TouchableOpacity style={pq.actBtn} onPress={() => {
                    setPreviewPromoQR(promo);
                    setShowPromoQRPreview(true);
                  }}>
                    <Eye size={14} color={Colors.dark.neonGreen} />
                  </TouchableOpacity>
                  <TouchableOpacity style={pq.actBtn} onPress={() => handlePrintPromoQR(promo)}>
                    <Printer size={14} color={Colors.dark.neonGreen} />
                  </TouchableOpacity>
                  <TouchableOpacity style={pq.actBtn} onPress={() => handleOpenPromoForm(promo)}>
                    <Edit3 size={14} color={Colors.dark.neonGreen} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[pq.actBtn, { backgroundColor: 'rgba(239,68,68,0.1)' }]} onPress={() => {
                    Alert.alert('Excluir', `Excluir QR promocional de ${promo.sponsorName}?`, [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Excluir', style: 'destructive', onPress: () => deletePromoQR(promo.id) },
                    ]);
                  }}>
                    <Trash2 size={14} color={Colors.dark.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          <TouchableOpacity style={a.addBtn} activeOpacity={0.8} onPress={() => handleOpenPromoForm()}>
            <Plus size={16} color="#F59E0B" />
            <Text style={[a.addBtnTxt, { color: '#FFBE0B' }]}>Novo QR Promocional</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={showPromoForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPromoForm(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={fm.container}>
            <View style={[fm.header, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
              <TouchableOpacity onPress={() => setShowPromoForm(false)} style={fm.closeBtn}>
                <X size={22} color={Colors.dark.text} />
              </TouchableOpacity>
              <Text style={fm.headerTitle}>{editingPromo ? 'Editar QR Promo' : 'Novo QR Promo'}</Text>
              <TouchableOpacity onPress={handleSavePromo} style={[fm.saveHeaderBtn, { backgroundColor: '#F59E0B' }]}>
                <Text style={[fm.saveHeaderTxt, { color: '#fff' }]}>Salvar</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={fm.scroll} keyboardShouldPersistTaps="handled">
              <View style={fm.section}>
                <Text style={fm.sectionTitle}>Dados da Empresa</Text>
                <View style={fm.field}>
                  <Text style={fm.label}>Nome da Empresa *</Text>
                  <TextInput style={fm.input} value={promoForm.sponsorName} onChangeText={(v) => setPromoForm((p) => ({ ...p, sponsorName: v }))} placeholder="Ex: Supermercado Bom Preco" placeholderTextColor={Colors.dark.textMuted} />
                </View>
                <View style={fm.field}>
                  <Text style={fm.label}>Endereco da Empresa</Text>
                  <TextInput style={fm.input} value={promoForm.sponsorAddress} onChangeText={(v) => setPromoForm((p) => ({ ...p, sponsorAddress: v }))} placeholder="Rua, numero, bairro" placeholderTextColor={Colors.dark.textMuted} />
                </View>
              </View>

              <View style={fm.section}>
                <Text style={fm.sectionTitle}>Foto de Fundo do Card</Text>
                <Text style={fm.sectionSub}>Essa imagem aparece para o usuario quando o QR promocional for escaneado.</Text>
                <View style={fm.field}>
                  <Text style={fm.label}>Imagem de Fundo</Text>
                  <TouchableOpacity style={fm.uploadBtn} onPress={handlePickPromoBackground} activeOpacity={0.8}>
                    {promoForm.backgroundImageUrl ? (
                      <Image source={{ uri: promoForm.backgroundImageUrl }} style={fm.uploadPreview} contentFit="cover" contentPosition="center" />
                    ) : (
                      <View style={fm.uploadPlaceholder}>
                        <ImageIcon size={28} color={Colors.dark.neonGreen} />
                        <Text style={fm.uploadPlaceholderTxt}>Escolher foto de fundo</Text>
                      </View>
                    )}
                    {promoForm.backgroundImageUrl ? (
                      <View style={fm.uploadOverlay}>
                        <ImageIcon size={14} color="#fff" />
                        <Text style={fm.uploadOverlayTxt}>Trocar Foto</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={fm.section}>
                <Text style={fm.sectionTitle}>Valores da Promocao</Text>
                <View style={fm.row}>
                  <View style={[fm.field, { flex: 1 }]}>
                    <Text style={fm.label}>Valor do Pix (R$)</Text>
                    <TextInput style={fm.input} value={promoForm.couponValue} onChangeText={(v) => setPromoForm((p) => ({ ...p, couponValue: v }))} placeholder="10" placeholderTextColor={Colors.dark.textMuted} keyboardType="numeric" />
                  </View>
                  <View style={[fm.field, { flex: 1 }]}>
                    <Text style={fm.label}>Compra Minima (R$)</Text>
                    <TextInput style={fm.input} value={promoForm.minPurchase} onChangeText={(v) => setPromoForm((p) => ({ ...p, minPurchase: v }))} placeholder="100" placeholderTextColor={Colors.dark.textMuted} keyboardType="numeric" />
                  </View>
                </View>
              </View>

              <View style={fm.section}>
                <Text style={fm.sectionTitle}>Mensagem Personalizada</Text>
                <Text style={fm.sectionSub}>Deixe vazio para usar a mensagem padrao</Text>
                <View style={fm.field}>
                  <Text style={fm.label}>Mensagem</Text>
                  <TextInput style={[fm.input, fm.textArea]} value={promoForm.message} onChangeText={(v) => setPromoForm((p) => ({ ...p, message: v }))} placeholder={`Parabéns! Quer ganhar 1 Pix de R$ ${promoForm.couponValue || '10'},00?...`} placeholderTextColor={Colors.dark.textMuted} multiline numberOfLines={4} />
                </View>
              </View>

              {promoForm.sponsorName.trim() ? (
                <View style={fm.section}>
                  <Text style={fm.sectionTitle}>Preview da Mensagem</Text>
                  <View style={pq.previewCard}>
                    {promoForm.backgroundImageUrl ? (
                      <Image source={{ uri: promoForm.backgroundImageUrl }} style={pq.previewBg} contentFit="cover" contentPosition="center" />
                    ) : null}
                    {promoForm.backgroundImageUrl ? <LinearGradient colors={['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.45)']} style={pq.previewBgOverlay} /> : null}
                    <Text style={pq.previewEmoji}>🎉</Text>
                    <Text style={[pq.previewText, promoForm.backgroundImageUrl ? pq.previewTextOnImage : null]}>
                      {promoForm.message.trim() || `Parabéns! Quer ganhar 1 Pix de R$ ${parseFloat(promoForm.couponValue || '10').toFixed(2)}? Vá até a loja ${promoForm.sponsorName} e faça uma compra mínima de R$ ${parseFloat(promoForm.minPurchase || '100').toFixed(2)} e ganhe um cupom para receber um Pix de R$ ${parseFloat(promoForm.couponValue || '10').toFixed(2)}!`}
                    </Text>
                    <View style={[pq.previewStore, promoForm.backgroundImageUrl ? pq.previewStoreOnImage : null]}>
                      <Store size={14} color={Colors.dark.neonGreen} />
                      <Text style={[pq.previewStoreName, promoForm.backgroundImageUrl ? pq.previewStoreNameOnImage : null]}>{promoForm.sponsorName}</Text>
                    </View>
                    {promoForm.sponsorAddress.trim() ? (
                      <View style={[pq.previewAddr, promoForm.backgroundImageUrl ? pq.previewAddrOnImage : null]}>
                        <MapPin size={12} color={promoForm.backgroundImageUrl ? '#FFFFFF' : Colors.dark.textMuted} />
                        <Text style={[pq.previewAddrText, promoForm.backgroundImageUrl ? pq.previewAddrTextOnImage : null]}>{promoForm.sponsorAddress}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}

              <TouchableOpacity style={[fm.saveFullBtn, { shadowColor: '#F59E0B' }]} onPress={handleSavePromo} activeOpacity={0.8}>
                <LinearGradient colors={['#FFBE0B', '#FF8C00']} style={fm.saveFullGrad}>
                  <Save size={18} color="#fff" />
                  <Text style={[fm.saveFullTxt, { color: '#fff' }]}>SALVAR QR PROMOCIONAL</Text>
                </LinearGradient>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </>
    );
  };

  const renderCityNotifications = () => (
    <View style={a.section}>
      <View style={a.secHdr}>
        <Bell size={18} color={Colors.dark.warning} />
        <Text style={a.secTtl}>Notificacoes</Text>
      </View>
      {notifications.length === 0 ? (
        <View style={a.emptyState}>
          <Bell size={32} color={Colors.dark.textMuted} />
          <Text style={a.emptyTxt}>Nenhuma notificacao</Text>
        </View>
      ) : (
        notifications.map((notif) => (
          <View key={notif.id} style={a.notifRow}>
            <View style={a.notifLeft}>
              <View style={[a.notifTypeDot, notif.type === 'promo' ? { backgroundColor: Colors.dark.neonGreen } : notif.type === 'prize' ? { backgroundColor: Colors.dark.gold } : { backgroundColor: Colors.dark.warning }]} />
              <View style={a.notifInfo}>
                <Text style={a.notifTitle} numberOfLines={1}>{notif.title}</Text>
                <Text style={a.notifMsg} numberOfLines={2}>{notif.message}</Text>
                <View style={a.notifMeta}>
                  <Text style={a.notifDate}>{new Date(notif.createdAt).toLocaleDateString('pt-BR')}</Text>
                  {notif.sent && (
                    <View style={a.notifSentBadge}>
                      <Check size={10} color="#000" />
                      <Text style={a.notifSentTxt}>Enviada</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <View style={a.notifActions}>
              <TouchableOpacity style={a.notifActBtn} onPress={() => { setEditingNotif(notif); setShowNotifModal(true); }}>
                <Edit3 size={14} color={Colors.dark.neonGreen} />
              </TouchableOpacity>
              {!notif.sent && (
                <TouchableOpacity style={a.notifActBtn} onPress={() => handleSendNotification(notif)}>
                  <Send size={14} color={Colors.dark.warning} />
                </TouchableOpacity>
              )}
              {isLotteryClaimNotification(notif) && (
                <TouchableOpacity style={a.notifActBtn} onPress={() => handleConfirmLotteryClaim(notif)}>
                  <DollarSign size={14} color={Colors.dark.success} />
                </TouchableOpacity>
              )}
              {isIdentityVerificationNotification(notif) && (
                <TouchableOpacity style={a.notifActBtn} onPress={() => handleVerifyIdentity(notif)}>
                  <BadgeCheck size={14} color={Colors.dark.neonGreen} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[a.notifActBtn, { backgroundColor: 'rgba(239,68,68,0.1)' }]} onPress={() => {
                Alert.alert('Excluir', 'Excluir esta notificacao?', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Excluir', style: 'destructive', onPress: () => deleteNotification(notif.id) },
                ]);
              }}>
                <Trash2 size={14} color={Colors.dark.danger} />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
      <TouchableOpacity style={a.addBtn} activeOpacity={0.8} onPress={() => { setEditingNotif(null); setShowNotifModal(true); }}>
        <Plus size={16} color={Colors.dark.neonGreen} />
        <Text style={a.addBtnTxt}>Nova Notificacao</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={a.ctr}>
      <LinearGradient colors={[Colors.dark.background, '#EDF0F4', '#E8ECF1']} style={a.bgGrad} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={a.sc}>
        <View style={a.hdrBanner}>
          <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim, '#162D6B']} style={a.hdrGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Shield size={24} color="#000" />
            <Text style={a.hdrTtl}>Painel Administrativo</Text>
          </LinearGradient>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={a.tabBar} contentContainerStyle={a.tabBarContent}>
          <TabButton label="Visao Geral" active={mainTab === 'overview'} onPress={() => { setMainTab('overview'); setSelectedCity(null); setSelectedState(null); }} icon={BarChart3} />
          <TabButton label="Estados" active={mainTab === 'states'} onPress={() => { setMainTab('states'); setSelectedCity(null); setSelectedState(null); }} icon={Globe} />
          <TabButton label="Cidades" active={mainTab === 'cities'} onPress={() => { setMainTab('cities'); setSelectedCity(null); setSelectedState(null); }} icon={Building2} />
        </ScrollView>

        {mainTab === 'overview' && renderOverview()}
        {mainTab === 'states' && renderStates()}
        {mainTab === 'cities' && renderCityPanel()}

        <View style={{ height: 40 }} />
      </ScrollView>

      <SponsorFormModal
        visible={showSponsorModal}
        onClose={() => { setShowSponsorModal(false); setEditingSponsor(null); setSponsorDraftId(''); }}
        onSave={handleSaveSponsor}
        initialData={sponsorFormData}
        sponsorId={sponsorDraftId}
        title={editingSponsor ? 'Editar Patrocinador' : 'Novo Patrocinador'}
      />

      <CouponBatchModal
        visible={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        sponsors={selectedCity ? citySponsors : sponsors}
        onRequestPreview={(batch) => {
          setPreviewBatch(batch);
          setShowCouponPreview(true);
        }}
        onGenerate={(batch) => {
          addCouponBatch(batch);
          console.log('[Admin] Coupon batch saved; codes will only appear in wallet after real scan:', batch.id, batch.codes.length, 'codes');
        }}
      />

      <CouponPreviewModal
        visible={showCouponPreview}
        batch={previewBatch}
        onClose={() => setShowCouponPreview(false)}
        onPrint={(batch) => {
          // Encontra a função printBatchCoupons no contexto
          const html = generateThermalPrintHTML(batch);
          console.log('[Admin] Printing batch from preview:', batch.id, 'codes:', batch.codes.length);
          if (Platform.OS === 'web') {
            const printWindow = window.open('', '_blank', 'width=800,height=600');
            if (printWindow) {
              printWindow.document.write(html);
              printWindow.document.close();
              printWindow.onload = () => {
                setTimeout(() => {
                  printWindow.print();
                }, 500);
              };
            } else {
              Print.printAsync({ html }).catch((err) => {
                console.log('[Admin] Print error:', err);
                Alert.alert('Erro', 'Não foi possível imprimir. Verifique se a impressora está conectada via Bluetooth ou WiFi.');
              });
            }
          } else {
            Print.printAsync({ html }).catch((err) => {
              console.log('[Admin] Print error:', err);
              Alert.alert('Erro', 'Não foi possível imprimir. Verifique se a impressora está conectada via Bluetooth ou WiFi.');
            });
          }
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />

      <PromoQRPreviewModal
        visible={showPromoQRPreview}
        promo={previewPromoQR}
        onClose={() => setShowPromoQRPreview(false)}
        onPrint={(promo) => handlePrintPromoQR(promo)}
      />

      <NotificationModal
        visible={showNotifModal}
        onClose={() => { setShowNotifModal(false); setEditingNotif(null); }}
        onSave={(notif) => {
          if (editingNotif) {
            updateNotification(notif);
          } else {
            addNotification(notif);
          }
        }}
        initialData={editingNotif}
      />

      <Modal visible={showUserReviewModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleCloseUserReviewModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={fm.container}>
          <View style={[fm.header, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
            <TouchableOpacity onPress={handleCloseUserReviewModal} style={fm.closeBtn}>
              <X size={22} color={Colors.dark.text} />
            </TouchableOpacity>
            <Text style={fm.headerTitle}>{selectedUserReviewRow ? 'Revisar Usuario' : 'Usuarios para Revisao'}</Text>
            <TouchableOpacity
              onPress={handleRefreshUserReviewRows}
              style={[fm.saveHeaderBtn, ur.headerActionBtn, loadingUserReviewRows && ur.headerActionBtnDisabled]}
              disabled={loadingUserReviewRows}
            >
              <Text style={fm.saveHeaderTxt}>{loadingUserReviewRows ? 'Atualizando' : 'Atualizar'}</Text>
            </TouchableOpacity>
          </View>

          {loadingUserReviewRows ? (
            <View style={ur.loadingWrap}>
              <ActivityIndicator size="large" color={Colors.dark.primary} />
              <Text style={ur.loadingText}>Carregando usuarios...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={ur.scrollContent} showsVerticalScrollIndicator={false}>
              {!selectedUserReviewRow ? (
                <>
                  <View style={ur.summaryPanel}>
                    <View style={ur.summaryCard}>
                      <Text style={ur.summaryNumber}>{userReviewSummary.total}</Text>
                      <Text style={ur.summaryLabel}>Usuarios</Text>
                    </View>
                    <View style={ur.summaryCard}>
                      <Text style={[ur.summaryNumber, { color: Colors.dark.warning }]}>{userReviewSummary.pending}</Text>
                      <Text style={ur.summaryLabel}>Pendentes</Text>
                    </View>
                    <View style={ur.summaryCard}>
                      <Text style={[ur.summaryNumber, { color: Colors.dark.success }]}>{userReviewSummary.approved}</Text>
                      <Text style={ur.summaryLabel}>Ativos</Text>
                    </View>
                    <View style={ur.summaryCard}>
                      <Text style={[ur.summaryNumber, { color: Colors.dark.danger }]}>{userReviewSummary.rejected}</Text>
                      <Text style={ur.summaryLabel}>Desativados</Text>
                    </View>
                  </View>

                  <View style={ur.listSection}>
                    <Text style={ur.sectionTitle}>Selecione um usuario</Text>
                    <Text style={ur.sectionSubtitle}>Abra a ficha para conferir dados enviados, documentos e status da conta.</Text>

                    {userReviewRows.length === 0 ? (
                      <View style={a.emptyState}>
                        <Users size={32} color={Colors.dark.textMuted} />
                        <Text style={a.emptyTxt}>Nenhum usuario encontrado para revisao</Text>
                      </View>
                    ) : (
                      userReviewRows.map((row) => (
                        <TouchableOpacity
                          key={row.profile.email || row.profile.id}
                          style={ur.userCard}
                          activeOpacity={0.8}
                          onPress={() => setSelectedUserReviewEmail(row.profile.email)}
                        >
                          {row.profile.avatarUrl ? (
                            <Image source={{ uri: row.profile.avatarUrl }} style={ur.userAvatar} contentFit="cover" />
                          ) : (
                            <View style={ur.userAvatarPlaceholder}>
                              <Users size={18} color={Colors.dark.primary} />
                            </View>
                          )}

                          <View style={ur.userCardInfo}>
                            <Text style={ur.userName} numberOfLines={1}>{getUserDisplayName(row.profile)}</Text>
                            <Text style={ur.userMeta} numberOfLines={1}>{row.profile.email || 'Sem e-mail'}</Text>
                            <Text style={ur.userMeta} numberOfLines={1}>{formatUserLocation(row.profile)}</Text>
                          </View>

                          <View style={ur.userCardSide}>
                            <ReviewStatusBadge profile={row.profile} />
                            <ChevronRight size={16} color={Colors.dark.textMuted} />
                          </View>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                </>
              ) : (
                <>
                  <TouchableOpacity style={ur.inlineBackBtn} onPress={() => setSelectedUserReviewEmail(null)} activeOpacity={0.8}>
                    <ChevronLeft size={18} color={Colors.dark.primary} />
                    <Text style={ur.inlineBackText}>Voltar para lista</Text>
                  </TouchableOpacity>

                  <View style={ur.heroCard}>
                    {selectedUserReviewRow.profile.avatarUrl ? (
                      <Image source={{ uri: selectedUserReviewRow.profile.avatarUrl }} style={ur.heroAvatar} contentFit="cover" />
                    ) : (
                      <View style={ur.heroAvatarPlaceholder}>
                        <Users size={24} color={Colors.dark.primary} />
                      </View>
                    )}

                    <View style={ur.heroInfo}>
                      <ReviewStatusBadge profile={selectedUserReviewRow.profile} />
                      <Text style={ur.heroTitle}>{getUserDisplayName(selectedUserReviewRow.profile)}</Text>
                      <Text style={ur.heroSubtitle}>{selectedUserReviewRow.profile.email || 'Sem e-mail'}</Text>
                      <Text style={ur.heroSubtitle}>{formatUserLocation(selectedUserReviewRow.profile)}</Text>
                    </View>
                  </View>

                  <View style={ur.metricRow}>
                    <View style={ur.metricCard}>
                      <Text style={ur.metricLabel}>Saldo</Text>
                      <Text style={ur.metricValue}>R$ {selectedUserReviewRow.balance.toFixed(2)}</Text>
                    </View>
                    <View style={ur.metricCard}>
                      <Text style={ur.metricLabel}>Pontos</Text>
                      <Text style={ur.metricValue}>{selectedUserReviewRow.points}</Text>
                    </View>
                  </View>

                  <View style={ur.actionButtonRow}>
                    <TouchableOpacity
                      style={[
                        ur.primaryActionBtn,
                        savingUserReviewEmail === selectedUserReviewRow.profile.email.trim().toLowerCase() && ur.actionBtnDisabled,
                      ]}
                      activeOpacity={0.85}
                      disabled={savingUserReviewEmail === selectedUserReviewRow.profile.email.trim().toLowerCase()}
                      onPress={() => handleUpdateUserActivation(selectedUserReviewRow, true)}
                    >
                      {savingUserReviewEmail === selectedUserReviewRow.profile.email.trim().toLowerCase() ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : null}
                      <Text style={ur.primaryActionText}>Confirmar e Ativar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        ur.secondaryActionBtn,
                        savingUserReviewEmail === selectedUserReviewRow.profile.email.trim().toLowerCase() && ur.actionBtnDisabled,
                      ]}
                      activeOpacity={0.85}
                      disabled={savingUserReviewEmail === selectedUserReviewRow.profile.email.trim().toLowerCase()}
                      onPress={() => handleUpdateUserActivation(selectedUserReviewRow, false)}
                    >
                      <Text style={ur.secondaryActionText}>Desativar Usuario</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={ur.detailSection}>
                    <Text style={ur.sectionTitle}>Dados Pessoais</Text>
                    <ReviewDetailItem label="Nome" value={selectedUserReviewRow.profile.name} />
                    <ReviewDetailItem label="CPF" value={formatCPF(selectedUserReviewRow.profile.cpf)} />
                    <ReviewDetailItem label="Telefone" value={formatPhone(selectedUserReviewRow.profile.phone)} />
                    <ReviewDetailItem label="E-mail" value={selectedUserReviewRow.profile.email} />
                    <ReviewDetailItem label="Criado em" value={formatDateTime(selectedUserReviewRow.profile.createdAt)} />
                  </View>

                  <View style={ur.detailSection}>
                    <Text style={ur.sectionTitle}>Endereco e Indicacao</Text>
                    <ReviewDetailItem label="Cidade" value={selectedUserReviewRow.profile.city} />
                    <ReviewDetailItem label="Estado" value={selectedUserReviewRow.profile.state} />
                    <ReviewDetailItem label="Codigo de indicacao" value={selectedUserReviewRow.profile.referralCode} />
                    <ReviewDetailItem label="Indicado por" value={selectedUserReviewRow.profile.referredBy} />
                  </View>

                  <View style={ur.detailSection}>
                    <Text style={ur.sectionTitle}>PIX e Validacao</Text>
                    <ReviewDetailItem label="Tipo da chave principal" value={selectedUserReviewRow.profile.pixKeyType} />
                    <ReviewDetailItem label="Chave principal" value={formatPixKeyValue(selectedUserReviewRow.profile.pixKeyType, selectedUserReviewRow.profile.pixKey)} multiline />
                    <ReviewDetailItem label="Chave CPF" value={formatCPF(selectedUserReviewRow.profile.pixCpf || '')} multiline />
                    <ReviewDetailItem label="Chave telefone" value={formatPhone(selectedUserReviewRow.profile.pixPhone || '')} multiline />
                    <ReviewDetailItem label="Chave e-mail" value={selectedUserReviewRow.profile.pixEmail} multiline />
                    <ReviewDetailItem label="Chave aleatoria" value={selectedUserReviewRow.profile.pixRandom} multiline />
                    <ReviewDetailItem label="Identidade verificada" value={selectedUserReviewRow.profile.identityVerified ? 'Sim' : 'Nao'} />
                    <ReviewDetailItem label="Ultima revisao admin" value={formatDateTime(selectedUserReviewRow.profile.adminReviewedAt)} />
                  </View>

                  <View style={ur.detailSection}>
                    <Text style={ur.sectionTitle}>Arquivos Enviados</Text>
                    <Text style={ur.sectionSubtitle}>Avatar, selfie e documento usados na conferência manual.</Text>

                    {!selectedUserReviewRow.profile.avatarUrl && !selectedUserReviewRow.profile.selfieUrl && !selectedUserReviewRow.profile.documentUrl ? (
                      <View style={a.emptyState}>
                        <ImageIcon size={28} color={Colors.dark.textMuted} />
                        <Text style={a.emptyTxt}>Nenhum arquivo enviado</Text>
                      </View>
                    ) : (
                      <View style={ur.mediaGrid}>
                        {selectedUserReviewRow.profile.avatarUrl ? (
                          <View style={ur.mediaCard}>
                            <Text style={ur.mediaLabel}>Avatar</Text>
                            <Image source={{ uri: selectedUserReviewRow.profile.avatarUrl }} style={ur.mediaImage} contentFit="cover" />
                          </View>
                        ) : null}

                        {selectedUserReviewRow.profile.selfieUrl ? (
                          <View style={ur.mediaCard}>
                            <Text style={ur.mediaLabel}>Selfie</Text>
                            <Image source={{ uri: selectedUserReviewRow.profile.selfieUrl }} style={ur.mediaImage} contentFit="cover" />
                          </View>
                        ) : null}

                        {selectedUserReviewRow.profile.documentUrl ? (
                          <View style={ur.mediaCard}>
                            <Text style={ur.mediaLabel}>Documento</Text>
                            <Image source={{ uri: selectedUserReviewRow.profile.documentUrl }} style={ur.mediaImage} contentFit="cover" />
                          </View>
                        ) : null}
                      </View>
                    )}
                  </View>
                </>
              )}

              <View style={{ height: 32 }} />
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>

      <ImageCanvasEditorModal session={imageCanvasSession} onClose={() => setImageCanvasSession(null)} />

      <Modal visible={showAddCityModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => {
        setShowAddCityModal(false);
        setShowCityPicker(false);
        setShowStatePicker(false);
        setNewCitySearch('');
      }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={fm.container}>
          <View style={[fm.header, { paddingTop: Platform.OS === 'ios' ? 16 : insets.top + 8 }]}>
            <TouchableOpacity onPress={() => {
              setShowAddCityModal(false);
              setShowCityPicker(false);
              setShowStatePicker(false);
              setNewCitySearch('');
            }} style={fm.closeBtn}>
              <X size={22} color={Colors.dark.text} />
            </TouchableOpacity>
            <Text style={fm.headerTitle}>Adicionar Cidade</Text>
            <TouchableOpacity onPress={handleSaveManagedCity} style={fm.saveHeaderBtn}>
              <Text style={fm.saveHeaderTxt}>Salvar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={fm.scroll} keyboardShouldPersistTaps="handled">
            <View style={fm.section}>
              <Text style={fm.sectionTitle}>Dados da Cidade</Text>
              <View style={fm.field}>
                <Text style={fm.label}>UF *</Text>
                <TouchableOpacity
                  style={[fm.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  onPress={() => setShowStatePicker((v) => !v)}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: Colors.dark.text, fontSize: 14 }}>{newCityState}</Text>
                  <ChevronDown size={16} color={Colors.dark.textMuted} />
                </TouchableOpacity>
                {showStatePicker ? (
                  <View style={bm.pickerList}>
                    <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                      {STATES.map((uf) => (
                        <TouchableOpacity
                          key={uf}
                          style={[bm.pickerItem, newCityState === uf && bm.pickerItemActive]}
                          onPress={() => {
                            setNewCityState(uf);
                            setNewCityName('');
                            setNewCitySearch('');
                            setShowStatePicker(false);
                            setShowCityPicker(true);
                          }}
                        >
                          <Text style={[bm.pickerItemTxt, newCityState === uf && bm.pickerItemTxtActive]}>{uf}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </View>
              <View style={fm.field}>
                <Text style={fm.label}>Cidade *</Text>
                <TouchableOpacity
                  style={[fm.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  onPress={() => {
                    setShowStatePicker(false);
                    setShowCityPicker((v) => {
                      const next = !v;
                      if (!next) setNewCitySearch('');
                      return next;
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: newCityName ? Colors.dark.text : Colors.dark.textMuted, fontSize: 14 }}>
                    {newCityName ? `${newCityName} - ${newCityState}` : 'Escolha uma cidade'}
                  </Text>
                  <ChevronDown size={16} color={Colors.dark.textMuted} />
                </TouchableOpacity>
                {showCityPicker ? (
                  <View style={bm.pickerList}>
                    <TextInput
                      style={bm.pickerSearch}
                      value={newCitySearch}
                      onChangeText={setNewCitySearch}
                      placeholder="Digite as primeiras letras"
                      placeholderTextColor={Colors.dark.textMuted}
                      autoCapitalize="words"
                      autoCorrect={false}
                      autoFocus
                    />
                    <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
                      {suggestedCities.map(({ city, state }) => (
                        <TouchableOpacity
                          key={`${state}|${city}`}
                          style={[bm.pickerItem, newCityName === city && newCityState === state && bm.pickerItemActive]}
                          onPress={() => {
                            setNewCityName(city);
                            setNewCityState(state);
                            setShowCityPicker(false);
                            setShowStatePicker(false);
                            setNewCitySearch('');
                          }}
                        >
                          <Text style={[bm.pickerItemTxt, newCityName === city && newCityState === state && bm.pickerItemTxtActive]}>{city}</Text>
                          <Text style={bm.pickerItemSub}>{state}</Text>
                        </TouchableOpacity>
                      ))}
                      {suggestedCities.length === 0 ? <Text style={bm.emptyText}>Nenhuma cidade encontrada</Text> : null}
                    </ScrollView>
                  </View>
                ) : null}
              </View>
              <Text style={fm.sectionSub}>A cidade sera criada com todas as abas prontas para editar: premio, lojas, cupons e QR promocional.</Text>
            </View>

            <View style={fm.section}>
              <Text style={fm.sectionTitle}>Foto da Cidade</Text>
              {newCityPhotoUri ? (
                <>
                  <View style={fm.photoPreviewContainer}>
                    <Image source={{ uri: newCityPhotoUri }} style={fm.photoPreview} contentFit="cover" />
                  </View>
                  <TouchableOpacity style={fm.changePhotoBtn} onPress={handlePickNewCityPhoto} activeOpacity={0.8}>
                    <Edit3 size={16} color={Colors.dark.text} />
                    <Text style={fm.changePhotoBtnTxt}>Trocar Foto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[fm.changePhotoBtn, { backgroundColor: Colors.dark.cardBorder }]}
                    onPress={() => setNewCityPhotoUri(null)}
                    activeOpacity={0.8}
                  >
                    <X size={16} color={Colors.dark.text} />
                    <Text style={fm.changePhotoBtnTxt}>Remover Foto</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={fm.photoPlaceholder}>
                    <ImageIcon size={32} color={Colors.dark.textMuted} />
                    <Text style={fm.photoPlaceholderTxt}>Nenhuma foto selecionada</Text>
                  </View>
                  <TouchableOpacity style={fm.addPhotoBtn} onPress={handlePickNewCityPhoto} activeOpacity={0.8}>
                    <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={fm.addPhotoBtnGrad}>
                      <ImageIcon size={16} color="#000" />
                      <Text style={fm.addPhotoBtnTxt}>Adicionar Foto</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
              <Text style={fm.sectionSub}>A foto sera exibida nos cards da cidade e no cabeçalho.</Text>
            </View>

            <TouchableOpacity style={fm.saveFullBtn} onPress={handleSaveManagedCity} activeOpacity={0.8}>
              <LinearGradient colors={[Colors.dark.neonGreen, Colors.dark.neonGreenDim]} style={fm.saveFullGrad}>
                <Save size={18} color="#000" />
                <Text style={fm.saveFullTxt}>CRIAR CIDADE</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const a = StyleSheet.create({
  ctr: { flex: 1, backgroundColor: Colors.dark.background },
  bgGrad: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sc: { paddingBottom: 20 },
  denied: { flex: 1, backgroundColor: Colors.dark.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
  deniedTtl: { color: Colors.dark.text, fontSize: 22, fontWeight: '700' as const, marginTop: 16 },
  deniedSub: { color: Colors.dark.textSecondary, fontSize: 14, textAlign: 'center' as const, marginTop: 8 },
  hdrBanner: { marginHorizontal: 16, marginTop: 12, borderRadius: 20, overflow: 'hidden', shadowColor: "#00FF87", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  hdrGrad: { padding: 24, alignItems: 'center' as const, gap: 6 },
  hdrTtl: { color: '#000', fontSize: 22, fontWeight: '800' as const },
  hdrSub: { color: 'rgba(0,0,0,0.6)', fontSize: 13 },
  tabBar: { marginTop: 16, marginBottom: 4 },
  tabBarContent: { paddingHorizontal: 16, gap: 8 },
  statsRow: { flexDirection: 'row' as const, paddingHorizontal: 16, gap: 10, marginTop: 12 },
  statCard: { flex: 1, backgroundColor: Colors.dark.card, borderRadius: 14, padding: 14, alignItems: 'center' as const, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 8 },
  statVal: { color: Colors.dark.text, fontSize: 22, fontWeight: '800' as const },
  statLbl: { color: Colors.dark.textSecondary, fontSize: 10, marginTop: 2, fontWeight: '500' as const },
  section: { marginHorizontal: 16, marginTop: 16, backgroundColor: Colors.dark.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  secHdr: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 14 },
  secTtl: { color: Colors.dark.text, fontSize: 16, fontWeight: '700' as const },
  field: { marginBottom: 12 },
  fLbl: { color: Colors.dark.textSecondary, fontSize: 12, fontWeight: '600' as const, marginBottom: 6 },
  fieldHint: { color: Colors.dark.textMuted, fontSize: 10, marginTop: 4 },
  inp: { backgroundColor: Colors.dark.inputBg, borderRadius: 12, padding: 12, color: Colors.dark.text, fontSize: 14, borderWidth: 1, borderColor: Colors.dark.inputBorder },
  saveBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 4, shadowColor: "#00FF87", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
  saveBtnDisabled: { opacity: 0.85 },
  saveBtnG: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 12, gap: 8 },
  saveBtnT: { color: '#000', fontSize: 13, fontWeight: '700' as const, letterSpacing: 0.5 },
  prizePreview: { borderRadius: 14, overflow: 'hidden', marginBottom: 12, height: 160, position: 'relative' as const },
  prizePreviewImg: { width: '100%', height: '100%' },
  prizePreviewOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
  prizePreviewTxt: { color: '#fff', fontSize: 12, fontWeight: '600' as const },
  pickImgBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, backgroundColor: Colors.dark.surfaceLight, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: Colors.dark.neonGreenFaint, borderStyle: 'dashed' as const },
  pickImgTxt: { color: Colors.dark.neonGreen, fontSize: 13, fontWeight: '600' as const },
  changeBgBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  changeBgTxt: { color: '#fff', fontSize: 11, fontWeight: '600' as const },
  summaryGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  summaryItem: { width: '47%' as any, backgroundColor: Colors.dark.surfaceLight, borderRadius: 12, padding: 14, alignItems: 'center' as const },
  summaryVal: { color: Colors.dark.text, fontSize: 20, fontWeight: '800' as const },
  summaryLbl: { color: Colors.dark.textMuted, fontSize: 11, marginTop: 4, fontWeight: '500' as const },
  spRow: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: Colors.dark.surfaceLight, borderRadius: 12, padding: 12, marginBottom: 8 },
  spLogo: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.dark.inputBg },
  spInfo: { flex: 1, marginLeft: 10 },
  spNameRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  spName: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' as const, flex: 1 },
  spMeta: { color: Colors.dark.textSecondary, fontSize: 11, marginTop: 2 },
  spOffers: { color: Colors.dark.textMuted, fontSize: 10, marginTop: 2 },
  spActions: { flexDirection: 'row' as const, gap: 8, marginLeft: 8 },
  spActBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.dark.neonGreenFaint, alignItems: 'center' as const, justifyContent: 'center' as const },
  spActDel: { backgroundColor: 'rgba(239,68,68,0.1)' },
  emptyState: { alignItems: 'center' as const, paddingVertical: 24, gap: 8 },
  emptyTxt: { color: Colors.dark.textMuted, fontSize: 14 },
  seedBtn: { marginHorizontal: 16, marginTop: 16, borderRadius: 16, overflow: 'hidden' as const, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  seedBtnGrad: { paddingVertical: 18, paddingHorizontal: 20, alignItems: 'center' as const, gap: 4 },
  seedBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' as const, letterSpacing: 1 },
  seedBtnSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500' as const },
  addBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed' as const, borderColor: Colors.dark.neonGreen, marginTop: 4 },
  addBtnTxt: { color: Colors.dark.neonGreen, fontSize: 13, fontWeight: '600' as const },
  actionRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.dark.cardBorder },
  actIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const, marginRight: 12 },
  actInfo: { flex: 1 },
  actTtl: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' as const },
  actSub: { color: Colors.dark.textMuted, fontSize: 11, marginTop: 2 },
  backBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, marginHorizontal: 16, marginTop: 12, paddingVertical: 8 },
  backBtnTxt: { color: Colors.dark.neonGreen, fontSize: 14, fontWeight: '600' as const },
  cityHeaderCard: { marginHorizontal: 16, marginTop: 8, borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  cityHeaderGrad: { padding: 24, alignItems: 'center' as const, gap: 6 },
  cityHeaderName: { color: '#fff', fontSize: 26, fontWeight: '900' as const, letterSpacing: 0.5 },
  cityHeaderSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  cityHeaderImgWrap: { width: '100%', height: 180 },
  cityHeaderBgImg: { width: '100%', height: '100%' },
  cityHeaderImgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, padding: 24 },
  cityHeaderNoImageOverlay: { backgroundColor: 'rgba(0,0,0,0.18)' },
  cityPhotoBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginTop: 6 },
  cityPhotoBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '600' as const },
  stateRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.dark.cardBorder, gap: 12 },
  stateIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.dark.purple, alignItems: 'center' as const, justifyContent: 'center' as const },
  stateInfo: { flex: 1 },
  stateName: { color: Colors.dark.text, fontSize: 18, fontWeight: '800' as const },
  stateMeta: { color: Colors.dark.textMuted, fontSize: 12, marginTop: 2 },
  stateCountBadge: { backgroundColor: Colors.dark.neonGreen, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  stateCountTxt: { color: '#000', fontSize: 13, fontWeight: '800' as const },
  cityRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.dark.cardBorder, gap: 10 },
  cityRowIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,107,0,0.08)', alignItems: 'center' as const, justifyContent: 'center' as const, overflow: 'hidden' as const },
  cityThumbImage: { width: '100%', height: '100%' },
  cityThumbPlaceholder: { width: '100%', height: '100%', alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: 'rgba(255,107,0,0.1)' },
  cityRowInfo: { flex: 1 },
  cityRowName: { color: Colors.dark.text, fontSize: 15, fontWeight: '700' as const },
  cityRowMeta: { color: Colors.dark.textMuted, fontSize: 11, marginTop: 2 },
  cityPrizeBadge: { backgroundColor: Colors.dark.gold, width: 22, height: 22, borderRadius: 11, alignItems: 'center' as const, justifyContent: 'center' as const },
  cityRowCount: { backgroundColor: Colors.dark.neonGreenFaint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cityRowCountTxt: { color: Colors.dark.neonGreen, fontSize: 12, fontWeight: '800' as const },
  filterScroll: { marginBottom: 12 },
  filterScrollContent: { gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.dark.surfaceLight },
  filterChipActive: { backgroundColor: Colors.dark.neonGreen },
  filterChipTxt: { color: Colors.dark.textMuted, fontSize: 12, fontWeight: '600' as const },
  filterChipTxtActive: { color: '#000', fontWeight: '700' as const },
  sponsorFilterSection: { marginBottom: 12 },
  couponRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.dark.cardBorder, gap: 10 },
  couponStatus: { width: 8, height: 8, borderRadius: 4 },
  couponStatusActive: { backgroundColor: Colors.dark.neonGreen },
  couponStatusUsed: { backgroundColor: Colors.dark.textMuted },
  couponStatusExpired: { backgroundColor: Colors.dark.danger },
  couponInfo: { flex: 1 },
  couponCode: { color: Colors.dark.text, fontSize: 13, fontWeight: '700' as const, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  couponMeta: { color: Colors.dark.textSecondary, fontSize: 11, marginTop: 2 },
  couponDate: { color: Colors.dark.textMuted, fontSize: 10, marginTop: 1 },
  couponBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  couponBadgeActive: { backgroundColor: Colors.dark.neonGreenFaint },
  couponBadgeUsed: { backgroundColor: Colors.dark.surfaceLight },
  couponBadgeExpired: { backgroundColor: 'rgba(239,68,68,0.1)' },
  couponBadgeTxt: { fontSize: 10, fontWeight: '700' as const, color: Colors.dark.textSecondary },
  batchRow: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.dark.cardBorder, gap: 10 },
  batchIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.dark.neonGreenFaint, alignItems: 'center' as const, justifyContent: 'center' as const },
  batchInfo: { flex: 1 },
  batchName: { color: Colors.dark.text, fontSize: 13, fontWeight: '600' as const },
  batchMeta: { color: Colors.dark.textSecondary, fontSize: 11, marginTop: 2 },
  batchPrefix: { color: Colors.dark.neonGreen, fontSize: 12, fontWeight: '700' as const, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  batchPrintBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.dark.neonGreenFaint, alignItems: 'center' as const, justifyContent: 'center' as const, marginLeft: 6 },
  notifRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.dark.cardBorder, gap: 8 },
  notifLeft: { flex: 1, flexDirection: 'row' as const, gap: 10, alignItems: 'flex-start' as const },
  notifTypeDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  notifInfo: { flex: 1 },
  notifTitle: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' as const },
  notifMsg: { color: Colors.dark.textSecondary, fontSize: 12, marginTop: 3, lineHeight: 18 },
  notifMeta: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginTop: 6 },
  notifDate: { color: Colors.dark.textMuted, fontSize: 10 },
  notifSentBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, backgroundColor: Colors.dark.neonGreen, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  notifSentTxt: { color: '#000', fontSize: 9, fontWeight: '700' as const },
  notifActions: { flexDirection: 'row' as const, gap: 6 },
  notifActBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.dark.neonGreenFaint, alignItems: 'center' as const, justifyContent: 'center' as const },
});

const ur = StyleSheet.create({
  headerActionBtn: { minWidth: 88, alignItems: 'center' as const },
  headerActionBtnDisabled: { opacity: 0.7 },
  loadingWrap: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 12, paddingHorizontal: 24 },
  loadingText: { color: Colors.dark.textMuted, fontSize: 13 },
  scrollContent: { padding: 16, paddingBottom: 0 },
  summaryPanel: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10, marginBottom: 16 },
  summaryCard: { width: '47%' as any, backgroundColor: Colors.dark.card, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  summaryNumber: { color: Colors.dark.text, fontSize: 24, fontWeight: '800' as const },
  summaryLabel: { color: Colors.dark.textMuted, fontSize: 12, marginTop: 4 },
  listSection: { backgroundColor: Colors.dark.card, borderRadius: 18, borderWidth: 1, borderColor: Colors.dark.cardBorder, padding: 16 },
  sectionTitle: { color: Colors.dark.text, fontSize: 16, fontWeight: '700' as const },
  sectionSubtitle: { color: Colors.dark.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 14 },
  userCard: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: Colors.dark.surfaceLight, marginBottom: 10 },
  userAvatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.dark.inputBg },
  userAvatarPlaceholder: { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.dark.primaryFaint, alignItems: 'center' as const, justifyContent: 'center' as const },
  userCardInfo: { flex: 1 },
  userCardSide: { alignItems: 'flex-end' as const, gap: 10 },
  userName: { color: Colors.dark.text, fontSize: 15, fontWeight: '700' as const },
  userMeta: { color: Colors.dark.textMuted, fontSize: 12, marginTop: 3 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' as const },
  inlineBackBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginBottom: 12 },
  inlineBackText: { color: Colors.dark.primary, fontSize: 13, fontWeight: '700' as const },
  heroCard: { backgroundColor: Colors.dark.card, borderRadius: 18, borderWidth: 1, borderColor: Colors.dark.cardBorder, padding: 16, flexDirection: 'row' as const, gap: 14, alignItems: 'center' as const },
  heroAvatar: { width: 76, height: 76, borderRadius: 22, backgroundColor: Colors.dark.inputBg },
  heroAvatarPlaceholder: { width: 76, height: 76, borderRadius: 22, backgroundColor: Colors.dark.primaryFaint, alignItems: 'center' as const, justifyContent: 'center' as const },
  heroInfo: { flex: 1, gap: 4 },
  heroTitle: { color: Colors.dark.text, fontSize: 19, fontWeight: '800' as const },
  heroSubtitle: { color: Colors.dark.textMuted, fontSize: 12 },
  metricRow: { flexDirection: 'row' as const, gap: 10, marginTop: 12 },
  metricCard: { flex: 1, backgroundColor: Colors.dark.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.dark.cardBorder, paddingVertical: 14, paddingHorizontal: 16 },
  metricLabel: { color: Colors.dark.textMuted, fontSize: 11, marginBottom: 4 },
  metricValue: { color: Colors.dark.text, fontSize: 18, fontWeight: '800' as const },
  actionButtonRow: { gap: 10, marginTop: 12, marginBottom: 2 },
  primaryActionBtn: { minHeight: 50, borderRadius: 14, backgroundColor: Colors.dark.success, alignItems: 'center' as const, justifyContent: 'center' as const, flexDirection: 'row' as const, gap: 8, paddingHorizontal: 16 },
  primaryActionText: { color: '#fff', fontSize: 14, fontWeight: '800' as const },
  secondaryActionBtn: { minHeight: 50, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)', alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 16 },
  secondaryActionText: { color: Colors.dark.danger, fontSize: 14, fontWeight: '800' as const },
  actionBtnDisabled: { opacity: 0.7 },
  detailSection: { backgroundColor: Colors.dark.card, borderRadius: 18, borderWidth: 1, borderColor: Colors.dark.cardBorder, padding: 16, marginTop: 14 },
  detailItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.dark.cardBorder },
  detailLabel: { color: Colors.dark.textMuted, fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  detailValue: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' as const, marginTop: 4 },
  detailValueMultiline: { lineHeight: 20 },
  mediaGrid: { gap: 12 },
  mediaCard: { backgroundColor: Colors.dark.surfaceLight, borderRadius: 14, padding: 12 },
  mediaLabel: { color: Colors.dark.text, fontSize: 13, fontWeight: '700' as const, marginBottom: 10 },
  mediaImage: { width: '100%', height: 220, borderRadius: 12, backgroundColor: Colors.dark.inputBg },
});

const pq = StyleSheet.create({
  desc: { color: Colors.dark.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.surfaceLight, borderRadius: 12, padding: 12, marginBottom: 8, gap: 10 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,190,11,0.1)', alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1 },
  rowName: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' as const },
  rowAddr: { color: Colors.dark.textMuted, fontSize: 11, marginTop: 2 },
  rowValues: { color: '#FFBE0B', fontSize: 11, fontWeight: '700' as const, marginTop: 3 },
  rowActions: { flexDirection: 'row', gap: 6 },
  actBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.dark.neonGreenFaint, alignItems: 'center', justifyContent: 'center' },
  previewCard: { backgroundColor: 'rgba(255,190,11,0.06)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(255,190,11,0.15)', alignItems: 'center', gap: 8, overflow: 'hidden' as const },
  previewBg: { ...StyleSheet.absoluteFillObject },
  previewBgOverlay: { ...StyleSheet.absoluteFillObject },
  previewEmoji: { fontSize: 32 },
  previewText: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' as const, lineHeight: 20, textAlign: 'center' as const },
  previewTextOnImage: { color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  previewStore: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  previewStoreOnImage: { backgroundColor: 'rgba(0,0,0,0.32)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'center' as const },
  previewStoreName: { color: Colors.dark.text, fontSize: 15, fontWeight: '700' as const },
  previewStoreNameOnImage: { color: '#FFFFFF' },
  previewAddr: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  previewAddrOnImage: { backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'center' as const },
  previewAddrText: { color: Colors.dark.textMuted, fontSize: 12 },
  previewAddrTextOnImage: { color: '#FFFFFF' },
});
