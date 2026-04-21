import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, Alert, KeyboardAvoidingView, Modal, Animated, FlatList, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Save, MapPin, Key, Edit3, CheckCircle, UserCircle, Shield, BadgeCheck, Lock, X, Delete, ChevronDown, Settings, Camera, AlertTriangle, LogOut } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { formatCPF, formatPhone } from '@/lib/formatters';
import { hasPendingUserVerification, isUserVerificationApproved } from '@/lib/userVerification';
import { useUser } from '@/providers/UserProvider';
import { useAdmin } from '@/providers/AdminProvider';
import { useAuth } from '@/providers/AuthProvider';
import { ALL_CITY_OPTIONS, STATES } from '@/mocks/cities';
import { fetchUserByCpf } from '@/services/database';
import type { UserProfile } from '@/types';

function Field({ label, value, editing, onChange, placeholder, keyboard, tid, mask, locked, loading, hint }: { label: string; value: string; editing: boolean; onChange: (v: string) => void; placeholder?: string; keyboard?: 'default' | 'numeric' | 'phone-pad' | 'email-address'; tid?: string; mask?: 'cpf' | 'phone'; locked?: boolean; loading?: boolean; hint?: string }) {
  const formattedValue = useMemo(() => {
    if (mask === 'cpf') return formatCPF(value);
    if (mask === 'phone') return formatPhone(value);
    return value;
  }, [mask, value]);

  const handleChange = useCallback((text: string) => {
    if (mask === 'cpf') onChange(formatCPF(text));
    else if (mask === 'phone') onChange(formatPhone(text));
    else onChange(text);
  }, [mask, onChange]);

  const maxLen = mask === 'cpf' ? 14 : mask === 'phone' ? 15 : undefined;
  return (
    <View style={s.field}>
      <View style={s.fieldLabelRow}>
        <Text style={s.fieldLabel}>{label}</Text>
        {locked && <View style={s.lockedBadge}><Lock size={10} color="#FFBE0B" /><Text style={s.lockedBadgeText}>Salvo</Text></View>}
      </View>
      {editing && !locked ? (
        <View>
          <TextInput style={s.fieldInput} value={formattedValue} onChangeText={handleChange} placeholder={placeholder} placeholderTextColor={Colors.dark.textMuted} keyboardType={keyboard || 'default'} autoCapitalize={keyboard === 'email-address' ? 'none' : 'sentences'} maxLength={maxLen} testID={`in-${tid}`} />
          {loading && <Text style={s.fieldHintLoading}>Buscando dados...</Text>}
          {hint && !loading && <Text style={s.fieldHintSuccess}>{hint}</Text>}
        </View>
      ) : (
        <View style={locked ? s.fieldLockedContainer : undefined}>
          <Text style={[s.fieldValue, locked && s.fieldValueLocked]}>{formattedValue || '--'}</Text>
        </View>
      )}
    </View>
  );
}

type ProfileSectionKey = 'personal' | 'address' | 'pix';

export default function ProfileScreen() {
  console.log("[ProfileScreen] Profile screen initialized");
  const ins = useSafeAreaInsets();
  const router = useRouter();
  const { profile, saveProfile, refreshProfile } = useUser();
  const { isAdmin, toggleAdmin, verifyAdminPin } = useAdmin();
  const { logout } = useAuth();
  const isIdentityVerified = useMemo(() => isUserVerificationApproved(profile), [profile.isActive, profile.adminReviewStatus]);
  const hasPendingIdentityVerification = useMemo(() => hasPendingUserVerification(profile), [profile.isActive, profile.adminReviewStatus, profile.selfieUrl, profile.documentUrl, profile.cpf]);
  const accountActivation = useMemo(() => {
    if (profile.isActive === true || profile.adminReviewStatus === 'approved') {
      return {
        label: 'Ativado',
        description: 'Conta liberada pelo administrador.',
        variant: 'active' as const,
      };
    }

    if (profile.isActive === false || profile.adminReviewStatus === 'rejected') {
      return {
        label: 'Desativado',
        description: 'Conta desativada pelo administrador.',
        variant: 'inactive' as const,
      };
    }

    return {
      label: 'Pendente',
      description: 'Aguardando confirmacao e ativacao pelo administrador.',
      variant: 'pending' as const,
    };
  }, [profile.isActive, profile.adminReviewStatus]);

  const isFieldLocked = useCallback((fieldName: string): boolean => {
    const value = profile[fieldName as keyof UserProfile];
    if (typeof value === 'string' && value.trim().length > 0) {
      const lockedFields = ['name', 'cpf', 'phone', 'email', 'city', 'state'];
      return lockedFields.includes(fieldName);
    }
    return false;
  }, [profile]);

  const isPixCpfLocked = !!(profile.pixCpf && profile.pixCpf.trim().length > 0);
  const isPixPhoneLocked = !!(profile.pixPhone && profile.pixPhone.trim().length > 0);
  const isPixEmailLocked = !!(profile.pixEmail && profile.pixEmail.trim().length > 0);
  const isPixRandomLocked = !!(profile.pixRandom && profile.pixRandom.trim().length > 0);
  const [ed, setEd] = useState<boolean>(false);
  const [f, setF] = useState<UserProfile>({ ...profile });
  const [sv, setSv] = useState<boolean>(false);
  const [showCityModal, setShowCityModal] = useState<boolean>(false);
  const [citySearch, setCitySearch] = useState<string>('');
  const [adminTaps, setAdminTaps] = useState<number>(0);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinCode, setPinCode] = useState<string>('');
  const [pinError, setPinError] = useState<boolean>(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const [cpfLookupLoading, setCpfLookupLoading] = useState<boolean>(false);
  const [cpfLookupHint, setCpfLookupHint] = useState<string>('');
  const cpfLookupTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openSections, setOpenSections] = useState<Record<ProfileSectionKey, boolean>>({
    personal: false,
    address: false,
    pix: false,
  });

  useFocusEffect(
    useCallback(() => {
      void refreshProfile();
    }, [refreshProfile]),
  );

  const upd = useCallback((k: keyof UserProfile, v: string) => setF((prev) => ({ ...prev, [k]: v })), []);
  const selectCity = useCallback((city: string, state: string) => {
    setF((prev) => ({ ...prev, city, state }));
    setShowCityModal(false);
    setCitySearch('');
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);
  const toggleSection = useCallback((section: ProfileSectionKey) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const handleCpfChange = useCallback((newCpf: string) => {
    const masked = formatCPF(newCpf);
    upd('cpf', masked);
    setCpfLookupHint('');

    if (cpfLookupTimeout.current) {
      clearTimeout(cpfLookupTimeout.current);
    }

    const digits = masked.replace(/\D/g, '');
    if (digits.length === 11) {
      setCpfLookupLoading(true);
      cpfLookupTimeout.current = setTimeout(async () => {
        try {
          console.log('[Profile] Looking up CPF:', masked);
          const found = await fetchUserByCpf(masked);
          if (found && found.name) {
            console.log('[Profile] Found user by CPF:', found.name);
            setF((prev) => ({
              ...prev,
              name: found.name,
              phone: found.phone || prev.phone,
              email: found.email || prev.email,
              city: found.city || prev.city,
              state: found.state || prev.state,
            }));
            setCpfLookupHint(`Encontrado: ${found.name}`);
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            setCpfLookupHint('');
            console.log('[Profile] No user found for CPF');
          }
        } catch (err) {
          console.log('[Profile] CPF lookup error:', err);
          setCpfLookupHint('');
        } finally {
          setCpfLookupLoading(false);
        }
      }, 500);
    }
  }, [upd]);

  const pickAvatar = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        if (ed) setF((prev) => ({ ...prev, avatarUrl: uri }));
        else saveProfile({ ...profile, avatarUrl: uri });
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (err) { console.log('[Profile] Avatar pick error:', err); }
  }, [ed, profile, saveProfile]);

  const cityOptions = useMemo(() => {
    const search = citySearch.toLowerCase().trim();
    if (!search) return ALL_CITY_OPTIONS;
    return ALL_CITY_OPTIONS.filter(({ city, state }) => city.toLowerCase().includes(search) || state.toLowerCase().includes(search));
  }, [citySearch]);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handlePinPress = useCallback((digit: string) => {
    if (pinCode.length >= 6) return;
    const newPin = pinCode + digit;
    setPinCode(newPin);
    setPinError(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (newPin.length === 6) {
      verifyAdminPin(newPin).then((isValid) => {
        if (isValid) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          toggleAdmin(true); setShowPinModal(false); setPinCode('');
          setTimeout(() => router.push('/admin'), 300);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setPinError(true); triggerShake();
          setTimeout(() => { setPinCode(''); setPinError(false); }, 800);
        }
      });
    }
  }, [pinCode, toggleAdmin, triggerShake, router, verifyAdminPin]);

  const handlePinDelete = useCallback(() => { if (pinCode.length === 0) return; setPinCode((prev) => prev.slice(0, -1)); setPinError(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }, [pinCode]);
  const closePinModal = useCallback(() => { setShowPinModal(false); setPinCode(''); setPinError(false); }, []);

  const startEd = useCallback(() => {
    setF({ ...profile, pixKeys: profile.pixKeys || [] });
    setOpenSections({ personal: true, address: true, pix: true });
    setEd(true);
  }, [profile]);

  const doSave = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const toSave = { ...f, id: f.id || `u_${Date.now()}`, createdAt: f.createdAt || new Date().toISOString(), savedFields: {} };
    if (toSave.pixCpf?.trim()) { toSave.pixKey = toSave.pixCpf; toSave.pixKeyType = 'cpf'; }
    else if (toSave.pixPhone?.trim()) { toSave.pixKey = toSave.pixPhone; toSave.pixKeyType = 'phone'; }
    else if (toSave.pixEmail?.trim()) { toSave.pixKey = toSave.pixEmail; toSave.pixKeyType = 'email'; }
    else if (toSave.pixRandom?.trim()) { toSave.pixKey = toSave.pixRandom; toSave.pixKeyType = 'random'; }
    saveProfile(toSave); setEd(false); setSv(true); setTimeout(() => setSv(false), 2000);
  }, [f, saveProfile]);

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingTop: ins.top }]} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Text style={s.headerTitle}>Perfil</Text>
          <View style={s.headerActions}>
            {ed ? (
              <TouchableOpacity style={s.headerBtn} onPress={doSave} testID="profile-save-btn"><Save size={20} color={Colors.dark.primary} /></TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.headerBtn} onPress={startEd} testID="ed-btn"><Edit3 size={20} color={Colors.dark.text} /></TouchableOpacity>
            )}
            {isAdmin && <TouchableOpacity style={s.headerBtn} onPress={() => router.push('/admin')}><Settings size={20} color={Colors.dark.text} /></TouchableOpacity>}
          </View>
        </View>

        {sv && <View style={s.savedBanner}><CheckCircle size={16} color={Colors.dark.success} /><Text style={s.savedText}>Perfil salvo com sucesso!</Text></View>}

        <View style={s.profileHeader}>
          <View style={s.profileHeaderRow}>
            <TouchableOpacity style={s.avatarContainer} onPress={pickAvatar} activeOpacity={0.8}>
              {(ed ? f.avatarUrl : profile.avatarUrl) ? (
                <Image source={{ uri: ed ? f.avatarUrl : profile.avatarUrl }} style={s.avatarImage} />
              ) : (
                <View style={s.avatar}><Text style={s.avatarText}>{(profile.name || 'V').charAt(0).toUpperCase()}</Text></View>
              )}
              <View style={s.avatarBadge}><Camera size={12} color="#000" /></View>
            </TouchableOpacity>
            <View style={s.profileInfoRight}>
              <Text style={s.profileName}>{profile.name || 'Visitante'}</Text>
              {profile.city ? <View style={s.locationRow}><MapPin size={13} color={Colors.dark.textSecondary} /><Text style={s.profileLocation}>{profile.city}, {profile.state}</Text></View> : <Text style={s.profileLocation}>Localização não definida</Text>}
              {!ed && !isIdentityVerified && !hasPendingIdentityVerification && (
                <TouchableOpacity style={s.verifyBtn} onPress={() => router.push('/identity-verify')}><Shield size={13} color="#000" /><Text style={s.verifyBtnText}>Verificar</Text></TouchableOpacity>
              )}
              {!ed && !isIdentityVerified && hasPendingIdentityVerification && <View style={s.pendingInline}><AlertTriangle size={13} color={Colors.dark.warning} /><Text style={s.pendingInlineText}>Em análise</Text></View>}
              {isIdentityVerified && <View style={s.verifiedInline}><BadgeCheck size={13} color={Colors.dark.success} /><Text style={s.verifiedInlineText}>Verificado</Text></View>}
            </View>
          </View>
        </View>

        <View style={s.section}>
          <TouchableOpacity style={[s.sectionHeader, openSections.personal && s.sectionHeaderExpanded]} onPress={() => toggleSection('personal')} activeOpacity={0.8}>
            <View style={s.sectionHeaderMain}><UserCircle size={18} color={Colors.dark.primary} /><Text style={s.sectionTitle}>Dados Pessoais</Text></View>
            <View style={[s.sectionChevronWrap, openSections.personal && s.sectionChevronOpen]}><ChevronDown size={18} color={Colors.dark.textMuted} /></View>
          </TouchableOpacity>
          {openSections.personal && (
            <View style={s.sectionBody}>
              <Field label="Nome completo" value={ed ? f.name : profile.name} editing={ed} onChange={(v) => upd('name', v)} placeholder="Seu nome" tid="name" locked={isFieldLocked('name')} />
              <Field label="CPF" value={ed ? f.cpf : profile.cpf} editing={ed} onChange={handleCpfChange} placeholder="000.000.000-00" keyboard="numeric" tid="cpf" mask="cpf" locked={isFieldLocked('cpf')} loading={cpfLookupLoading} hint={cpfLookupHint} />
              <Field label="Telefone" value={ed ? f.phone : profile.phone} editing={ed} onChange={(v) => upd('phone', v)} placeholder="(00) 00000-0000" keyboard="phone-pad" tid="phone" mask="phone" locked={isFieldLocked('phone')} />
              <Field label="E-mail" value={ed ? f.email : profile.email} editing={ed} onChange={(v) => upd('email', v)} placeholder="seu@email.com" keyboard="email-address" tid="email" locked={isFieldLocked('email')} />
            </View>
          )}
        </View>

        <View style={s.section}>
          <TouchableOpacity style={[s.sectionHeader, openSections.address && s.sectionHeaderExpanded]} onPress={() => toggleSection('address')} activeOpacity={0.8}>
            <View style={s.sectionHeaderMain}><MapPin size={18} color={Colors.dark.primary} /><Text style={s.sectionTitle}>Endereço</Text></View>
            <View style={[s.sectionChevronWrap, openSections.address && s.sectionChevronOpen]}><ChevronDown size={18} color={Colors.dark.textMuted} /></View>
          </TouchableOpacity>
          {openSections.address && (
            <View style={s.sectionBody}>
              <View style={s.fieldLabelRow}><Text style={s.fieldLabel}>Estado</Text>{isFieldLocked('state') && <View style={s.lockedBadge}><Lock size={10} color="#FFBE0B" /><Text style={s.lockedBadgeText}>Salvo</Text></View>}</View>
              {ed && !isFieldLocked('state') ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.stateScroll}>
                  {STATES.map((st) => (
                    <TouchableOpacity key={st} style={[s.stateChip, f.state === st && s.stateChipActive]} onPress={() => { upd('state', st); setF((prev) => ({ ...prev, state: st, city: '' })); }}>
                      <Text style={[s.stateChipText, f.state === st && s.stateChipTextActive]}>{st}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : <View style={isFieldLocked('state') ? s.fieldLockedContainer : undefined}><Text style={[s.fieldValue, isFieldLocked('state') && s.fieldValueLocked]}>{(ed ? f.state : profile.state) || '--'}</Text></View>}
              <View style={s.fieldSpacer} />
              <View style={s.fieldLabelRow}><Text style={s.fieldLabel}>Cidade</Text>{isFieldLocked('city') && <View style={s.lockedBadge}><Lock size={10} color="#FFBE0B" /><Text style={s.lockedBadgeText}>Salvo</Text></View>}</View>
              {ed && !isFieldLocked('city') ? (
                <TouchableOpacity style={s.citySelector} onPress={() => setShowCityModal(true)}>
                  <Text style={f.city ? s.citySelectorText : s.citySelectorPlaceholder}>{f.city ? `${f.city} - ${f.state}` : 'Selecione sua cidade'}</Text>
                  <ChevronDown size={18} color={Colors.dark.textMuted} />
                </TouchableOpacity>
              ) : <View style={isFieldLocked('city') ? s.fieldLockedContainer : undefined}><Text style={[s.fieldValue, isFieldLocked('city') && s.fieldValueLocked]}>{(ed ? f.city : profile.city) || '--'}</Text></View>}
            </View>
          )}
        </View>

        <View style={s.section}>
          <TouchableOpacity style={[s.sectionHeader, openSections.pix && s.sectionHeaderExpanded]} onPress={() => toggleSection('pix')} activeOpacity={0.8}>
            <View style={s.sectionHeaderMain}><Key size={18} color={Colors.dark.primary} /><Text style={s.sectionTitle}>Chaves PIX</Text></View>
            <View style={[s.sectionChevronWrap, openSections.pix && s.sectionChevronOpen]}><ChevronDown size={18} color={Colors.dark.textMuted} /></View>
          </TouchableOpacity>
          {openSections.pix && (
            <View style={s.sectionBody}>
              <Field label="CPF (Chave PIX)" value={ed ? (f.pixCpf || '') : (profile.pixCpf || '')} editing={ed} onChange={(v) => upd('pixCpf', v)} placeholder="000.000.000-00" keyboard="numeric" tid="pixCpf" mask="cpf" locked={isPixCpfLocked} />
              <Field label="Telefone (Chave PIX)" value={ed ? (f.pixPhone || '') : (profile.pixPhone || '')} editing={ed} onChange={(v) => upd('pixPhone', v)} placeholder="(00) 00000-0000" keyboard="phone-pad" tid="pixPhone" mask="phone" locked={isPixPhoneLocked} />
              <Field label="E-mail (Chave PIX)" value={ed ? (f.pixEmail || '') : (profile.pixEmail || '')} editing={ed} onChange={(v) => upd('pixEmail', v)} placeholder="seu@email.com" keyboard="email-address" tid="pixEmail" locked={isPixEmailLocked} />
              <Field label="Chave Aleatória (PIX)" value={ed ? (f.pixRandom || '') : (profile.pixRandom || '')} editing={ed} onChange={(v) => upd('pixRandom', v)} placeholder="Ex: a1b2c3d4-..." tid="pixRandom" locked={isPixRandomLocked} />
            </View>
          )}
        </View>

        <View style={s.section}>
          <View style={[s.sectionHeader, s.sectionHeaderExpanded]}><View style={s.sectionHeaderMain}><Shield size={18} color={Colors.dark.primary} /><Text style={s.sectionTitle}>Segurança</Text></View></View>
          <View style={s.sectionBody}>
            <View style={s.securityRow}>
              <View style={s.securityInfo}><Text style={s.securityLabel}>Verificação de Identidade</Text><Text style={s.securityDesc}>{isIdentityVerified ? 'Conta verificada e ativada' : hasPendingIdentityVerification ? 'Documentos enviados. Aguarde a ativação do administrador.' : 'Verifique para sacar'}</Text></View>
              {isIdentityVerified ? <View style={s.verifiedTag}><BadgeCheck size={14} color={Colors.dark.success} /><Text style={s.verifiedTagText}>Verificado</Text></View> : hasPendingIdentityVerification ? <View style={s.pendingTag}><AlertTriangle size={14} color={Colors.dark.warning} /><Text style={s.pendingTagText}>Em análise</Text></View> : <TouchableOpacity style={s.verifyActionBtn} onPress={() => router.push('/identity-verify')}><Text style={s.verifyActionText}>Verificar</Text></TouchableOpacity>}
            </View>
            <View style={[s.securityRow, s.securityRowSeparated]}>
              <View style={s.securityInfo}>
                <Text style={s.securityLabel}>Ativação da Conta</Text>
                <Text style={s.securityDesc}>{accountActivation.description}</Text>
              </View>
              <View
                style={[
                  s.accountStatusTag,
                  accountActivation.variant === 'active'
                    ? s.accountStatusTagActive
                    : accountActivation.variant === 'inactive'
                      ? s.accountStatusTagInactive
                      : s.accountStatusTagPending,
                ]}
              >
                {accountActivation.variant === 'active' ? (
                  <CheckCircle size={14} color={Colors.dark.success} />
                ) : (
                  <AlertTriangle size={14} color={accountActivation.variant === 'inactive' ? Colors.dark.danger : Colors.dark.warning} />
                )}
                <Text
                  style={[
                    s.accountStatusTagText,
                    accountActivation.variant === 'active'
                      ? s.accountStatusTagTextActive
                      : accountActivation.variant === 'inactive'
                        ? s.accountStatusTagTextInactive
                        : s.accountStatusTagTextPending,
                  ]}
                >
                  {accountActivation.label}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {ed && (
          <TouchableOpacity style={s.saveFloating} onPress={doSave} activeOpacity={0.8} testID="save-fab">
            <LinearGradient colors={[Colors.dark.primary, Colors.dark.primaryDim]} style={s.saveFloatingGrad}><Save size={18} color="#FFF" /><Text style={s.saveFloatingText}>SALVAR PERFIL</Text></LinearGradient>
          </TouchableOpacity>
        )}

        {isAdmin && !ed && (
          <TouchableOpacity style={s.adminBtn} onPress={() => router.push('/admin')} activeOpacity={0.8}>
            <LinearGradient colors={[Colors.dark.purple, Colors.dark.purpleLight]} style={s.adminBtnGrad}><Shield size={18} color="#FFF" /><Text style={s.adminBtnText}>PAINEL ADMIN</Text></LinearGradient>
          </TouchableOpacity>
        )}



        <TouchableOpacity style={s.logoutBtn} onPress={() => Alert.alert('Sair da conta', 'Tem certeza?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sair', style: 'destructive', onPress: () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); logout(); } }])} activeOpacity={0.8} testID="logout-btn">
          <LogOut size={18} color="#FF4757" /><Text style={s.logoutBtnText}>Sair da conta</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.versionRow} onPress={() => { if (isAdmin) { router.push('/admin'); return; } const next = adminTaps + 1; setAdminTaps(next); if (next >= 5) { setAdminTaps(0); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowPinModal(true); } }} activeOpacity={1}>
          <Text style={s.versionText}>Caça ao Tesouro PIX v1.0.0</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showCityModal} transparent animationType="slide" onRequestClose={() => setShowCityModal(false)}>
        <View style={cm.overlay}>
          <View style={cm.container}>
            <View style={cm.handle} />
            <View style={cm.header}><Text style={cm.title}>Selecione a cidade</Text><TouchableOpacity onPress={() => { setShowCityModal(false); setCitySearch(''); }}><X size={22} color={Colors.dark.text} /></TouchableOpacity></View>
            <TextInput style={cm.search} value={citySearch} onChangeText={setCitySearch} placeholder="Buscar cidade..." placeholderTextColor={Colors.dark.textMuted} autoFocus />
            <FlatList data={cityOptions} keyExtractor={(item) => `${item.state}|${item.city}`} renderItem={({ item }) => (
              <TouchableOpacity style={cm.cityItem} onPress={() => selectCity(item.city, item.state)}>
                <MapPin size={16} color={Colors.dark.primary} />
                <View style={cm.cityTextWrap}>
                  <Text style={cm.cityText}>{item.city}</Text>
                  <Text style={cm.citySubText}>{item.state}</Text>
                </View>
                {(ed ? f.city : profile.city) === item.city && (ed ? f.state : profile.state) === item.state && <CheckCircle size={16} color={Colors.dark.success} />}
              </TouchableOpacity>
            )} ListEmptyComponent={<Text style={cm.emptyText}>Nenhuma cidade encontrada</Text>} style={cm.list} showsVerticalScrollIndicator={false} />
          </View>
        </View>
      </Modal>

      <Modal visible={showPinModal} transparent animationType="fade" onRequestClose={closePinModal}>
        <View style={pin.overlay}>
          <View style={pin.container}>
            <View style={pin.header}><View style={pin.lockIcon}><Lock size={24} color={Colors.dark.primary} /></View><Text style={pin.title}>Acesso Administrativo</Text><Text style={pin.subtitle}>Digite a senha de 6 dígitos</Text><TouchableOpacity style={pin.closeBtn} onPress={closePinModal}><X size={20} color={Colors.dark.textMuted} /></TouchableOpacity></View>
            <Animated.View style={[pin.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>{[0, 1, 2, 3, 4, 5].map((i) => <View key={i} style={[pin.dot, i < pinCode.length && pin.dotFilled, pinError && pin.dotError]} />)}</Animated.View>
            {pinError && <Text style={pin.errorText}>Senha incorreta</Text>}
            <View style={pin.keypad}>
              {['1','2','3','4','5','6','7','8','9','','0','del'].map((key) => {
                if (key === '') return <View key="empty" style={pin.keyEmpty} />;
                if (key === 'del') return <TouchableOpacity key="del" style={pin.key} onPress={handlePinDelete} activeOpacity={0.6}><Delete size={22} color={Colors.dark.text} /></TouchableOpacity>;
                return <TouchableOpacity key={key} style={pin.key} onPress={() => handlePinPress(key)} activeOpacity={0.6}><Text style={pin.keyText}>{key}</Text></TouchableOpacity>;
              })}
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  scroll: { paddingBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: 24, fontWeight: '700' as const, color: Colors.dark.text },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  savedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.15)' },
  savedText: { color: Colors.dark.success, fontSize: 13, fontWeight: '600' as const },
  profileHeader: { paddingTop: 16, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: Colors.dark.cardBorder, marginHorizontal: 16 },
  profileHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  profileInfoRight: { flex: 1, paddingLeft: 16 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  avatarContainer: { position: 'relative' as const },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(249,115,22,0.08)', borderWidth: 3, borderColor: Colors.dark.primary, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: Colors.dark.primary },
  avatarText: { fontSize: 32, fontWeight: '800' as const, color: Colors.dark.primary },
  avatarBadge: { position: 'absolute' as const, bottom: -2, right: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.dark.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  profileName: { fontSize: 22, fontWeight: '800' as const, color: Colors.dark.text },
  profileLocation: { fontSize: 14, color: Colors.dark.textSecondary },
  pendingInline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  pendingInlineText: { color: Colors.dark.warning, fontSize: 12, fontWeight: '600' as const },
  verifiedInline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  verifiedInlineText: { color: Colors.dark.success, fontSize: 12, fontWeight: '600' as const },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, backgroundColor: Colors.dark.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, alignSelf: 'flex-start' as const },
  verifyBtnText: { color: '#000', fontSize: 12, fontWeight: '600' as const },
  section: { marginTop: 20, marginHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  sectionHeaderExpanded: { marginBottom: 12 },
  sectionHeaderMain: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.dark.text, flex: 1 },
  sectionChevronWrap: { alignItems: 'center', justifyContent: 'center' },
  sectionChevronOpen: { transform: [{ rotate: '180deg' }] },
  sectionBody: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  field: { marginBottom: 16 },
  fieldLabelRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginBottom: 6 },
  fieldLabel: { color: Colors.dark.textSecondary, fontSize: 12, fontWeight: '600' as const },
  fieldValue: { color: Colors.dark.text, fontSize: 15, fontWeight: '500' as const },
  fieldValueLocked: { color: Colors.dark.textSecondary },
  fieldLockedContainer: { backgroundColor: 'rgba(255,190,11,0.04)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(255,190,11,0.12)' },
  fieldInput: { backgroundColor: Colors.dark.inputBg, borderRadius: 12, padding: 12, color: Colors.dark.text, fontSize: 15, borderWidth: 1, borderColor: Colors.dark.inputBorder },
  fieldHintLoading: { color: Colors.dark.textMuted, fontSize: 11, marginTop: 4, marginLeft: 4, fontStyle: 'italic' as const },
  fieldHintSuccess: { color: Colors.dark.success, fontSize: 11, marginTop: 4, marginLeft: 4, fontWeight: '600' as const },
  fieldSpacer: { height: 16 },
  lockedBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 3, backgroundColor: 'rgba(255,190,11,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  lockedBadgeText: { color: '#FFBE0B', fontSize: 10, fontWeight: '600' as const },
  stateScroll: { marginBottom: 4 },
  stateChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.dark.inputBg, marginRight: 6, borderWidth: 1, borderColor: Colors.dark.inputBorder },
  stateChipActive: { backgroundColor: Colors.dark.primaryFaint, borderColor: Colors.dark.primary },
  stateChipText: { color: Colors.dark.textSecondary, fontSize: 13, fontWeight: '600' as const },
  stateChipTextActive: { color: Colors.dark.primary },
  citySelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.dark.inputBg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.dark.inputBorder },
  citySelectorText: { color: Colors.dark.text, fontSize: 15 },
  citySelectorPlaceholder: { color: Colors.dark.textMuted, fontSize: 15 },
  securityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  securityRowSeparated: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.dark.cardBorder },
  securityInfo: { flex: 1 },
  securityLabel: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' as const },
  securityDesc: { color: Colors.dark.textSecondary, fontSize: 12, marginTop: 2 },
  verifiedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.08)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  verifiedTagText: { color: Colors.dark.success, fontSize: 12, fontWeight: '600' as const },
  pendingTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,158,11,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  pendingTagText: { color: Colors.dark.warning, fontSize: 12, fontWeight: '600' as const },
  accountStatusTag: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  accountStatusTagActive: { backgroundColor: 'rgba(16,185,129,0.08)' },
  accountStatusTagPending: { backgroundColor: 'rgba(245,158,11,0.1)' },
  accountStatusTagInactive: { backgroundColor: 'rgba(239,68,68,0.1)' },
  accountStatusTagText: { fontSize: 12, fontWeight: '700' as const },
  accountStatusTagTextActive: { color: Colors.dark.success },
  accountStatusTagTextPending: { color: Colors.dark.warning },
  accountStatusTagTextInactive: { color: Colors.dark.danger },
  verifyActionBtn: { backgroundColor: Colors.dark.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  verifyActionText: { color: '#000', fontSize: 12, fontWeight: '700' as const },
  saveFloating: { marginHorizontal: 16, marginTop: 24, borderRadius: 16, overflow: 'hidden' as const },
  saveFloatingGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  saveFloatingText: { color: '#FFF', fontSize: 16, fontWeight: '800' as const, letterSpacing: 0.5 },
  adminBtn: { marginHorizontal: 16, marginTop: 16, borderRadius: 16, overflow: 'hidden' as const },
  adminBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
  adminBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' as const, letterSpacing: 0.5 },
  supportSection: { marginHorizontal: 16, marginTop: 20 },
  supportNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(255,190,11,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,190,11,0.2)', marginBottom: 12 },
  supportNoticeText: { flex: 1, color: '#FFBE0B', fontSize: 12, fontWeight: '500' as const, lineHeight: 18 },
  supportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#25D366', borderRadius: 14, paddingVertical: 14 },
  supportBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 24, paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.12)' },
  logoutBtnText: { color: '#FF4757', fontSize: 15, fontWeight: '700' as const },
  versionRow: { alignItems: 'center', marginTop: 16, paddingVertical: 12 },
  versionText: { color: Colors.dark.textMuted, fontSize: 12 },
});

const cm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  container: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%', paddingBottom: 30 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.dark.cardBorder, alignSelf: 'center', marginTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 18, fontWeight: '700' as const, color: Colors.dark.text },
  search: { marginHorizontal: 20, marginBottom: 8, backgroundColor: Colors.dark.inputBg, borderRadius: 12, padding: 12, color: Colors.dark.text, fontSize: 15, borderWidth: 1, borderColor: Colors.dark.inputBorder },
  list: { paddingHorizontal: 20 },
  cityItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.dark.cardBorder },
  cityTextWrap: { flex: 1 },
  cityText: { color: Colors.dark.text, fontSize: 15 },
  citySubText: { color: Colors.dark.textMuted, fontSize: 12, marginTop: 2 },
  emptyText: { color: Colors.dark.textMuted, fontSize: 14, textAlign: 'center' as const, paddingVertical: 24 },
});

const pin = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  container: { width: '100%', maxWidth: 340, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 28, width: '100%' },
  lockIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.dark.primaryFaint, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { color: Colors.dark.text, fontSize: 18, fontWeight: '800' as const, textAlign: 'center' as const },
  subtitle: { color: Colors.dark.textSecondary, fontSize: 13, marginTop: 6, textAlign: 'center' as const },
  closeBtn: { position: 'absolute' as const, top: 0, right: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  dotsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: Colors.dark.textMuted, backgroundColor: 'transparent' },
  dotFilled: { backgroundColor: Colors.dark.primary, borderColor: Colors.dark.primary },
  dotError: { backgroundColor: '#FF4757', borderColor: '#FF4757' },
  errorText: { color: '#FF4757', fontSize: 13, fontWeight: '600' as const, marginTop: 4, marginBottom: 8 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 20, width: '100%' },
  key: { width: 68, height: 56, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  keyText: { color: Colors.dark.text, fontSize: 24, fontWeight: '700' as const },
  keyEmpty: { width: 68, height: 56 },
});
