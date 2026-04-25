import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Platform, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { MapPin, Phone, BadgeCheck, Grid3x3, ShoppingBag, MessageSquare, Heart, Send, Star } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { formatPhone } from '@/lib/formatters';
import { useSponsor } from '@/providers/SponsorProvider';
import OfferDetailModal from '@/components/OfferDetailModal';
import type { Offer, SponsorImage } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GAP = 4;
const GRID_COLS = 3;
const GRID_HORIZONTAL_PADDING = 12;
const GRID_ITEM_SIZE = (SCREEN_W - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
const CARD_BORDER_BLUE = '#3B82F6';

const STORE_THEME = {
  textPrimary: '#F8FAFC',
  textSecondary: 'rgba(226,232,240,0.82)',
  textMuted: 'rgba(226,232,240,0.62)',
  titleShadow: 'rgba(0,0,0,0.32)',
};

function openDirections(address: string, lat?: number, lon?: number) {
  const trimmedAddress = address.trim();
  const hasCoordinates = typeof lat === 'number' && Number.isFinite(lat) && typeof lon === 'number' && Number.isFinite(lon);
  const destination = trimmedAddress || (hasCoordinates ? `${lat},${lon}` : '');

  if (!destination) return;

  const encodedDestination = encodeURIComponent(destination);
  if (Platform.OS === 'ios') {
    Linking.openURL(`maps://?daddr=${encodedDestination}&dirflg=d`).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving`);
    });
  } else if (Platform.OS === 'android') {
    Linking.openURL(`google.navigation:q=${encodedDestination}&mode=d`).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving`);
    });
  } else {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving`);
  }
}

export default function SponsorDetailScreen() {
  console.log("[SponsorDetail] Sponsor detail initialized");
  const { sponsorId } = useLocalSearchParams<{ sponsorId: string }>();
  const { sponsors } = useSponsor();
  const sponsor = sponsors.find((s) => s.id === sponsorId);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [selectedOfferList, setSelectedOfferList] = useState<Offer[]>([]);
  const [selectedOfferIndex, setSelectedOfferIndex] = useState<number>(0);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [modalPresentationMode, setModalPresentationMode] = useState<'default' | 'product-card'>('default');
  const [activeTab, setActiveTab] = useState<'grid' | 'list'>('grid');

  const handleOfferPress = useCallback((offer: Offer, index: number) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalPresentationMode('default');
    setSelectedOfferList(sponsor?.offers || []);
    setSelectedOfferIndex(index);
    setSelectedOffer(offer);
    setModalVisible(true);
  }, [sponsor]);

  const handleProductPress = useCallback((product: SponsorImage) => {
    if (!sponsor) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const productOffers: Offer[] = (sponsor.galleryImages || []).map((item) => ({
      id: item.id,
      sponsorId: sponsor.id,
      sponsorName: sponsor.name,
      title: item.label || 'Produto da loja',
      description: item.label ? `Produto: ${item.label}` : 'Produto da loja',
      imageUrl: item.url,
      discount: typeof item.price === 'number' ? `R$ ${item.price.toFixed(2)}` : '',
      likes: item.likes || 0,
      comments: item.comments || 0,
      shares: item.shares || 0,
    }));
    const idx = Math.max(0, productOffers.findIndex((item) => item.id === product.id));
    setModalPresentationMode('product-card');
    setSelectedOfferList(productOffers);
    setSelectedOfferIndex(idx);
    setSelectedOffer(productOffers[idx] || null);
    setModalVisible(true);
  }, [sponsor]);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setModalPresentationMode('default');
    setSelectedOffer(null);
    setSelectedOfferList([]);
    setSelectedOfferIndex(0);
  }, []);

  const handleGoLocation = useCallback(() => {
    if (!sponsor) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const destinationAddress = [sponsor.address, sponsor.city, sponsor.state].filter(Boolean).join(', ');
    openDirections(destinationAddress, sponsor.latitude, sponsor.longitude);
  }, [sponsor]);

  if (!sponsor) {
    return (
      <View style={d.empty}>
        <Stack.Screen options={{ title: 'Patrocinador' }} />
        <Text style={d.emptyTxt}>Patrocinador nao encontrado</Text>
      </View>
    );
  }

  const totalLikes = sponsor.offers.reduce((sum, o) => sum + (o.likes || 0), 0);
  const products = sponsor.galleryImages || [];
  const ratingAverage = typeof sponsor.ratingAverage === 'number' ? sponsor.ratingAverage : 0;
  const ratingCount = typeof sponsor.ratingCount === 'number' ? sponsor.ratingCount : 0;
  const hasRatings = ratingCount > 0;
  const ratingAverageLabel = ratingAverage.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <View style={d.ctr}>
      <Stack.Screen options={{
        title: sponsor.name,
        headerStyle: { backgroundColor: Colors.dark.surface },
        headerTintColor: Colors.dark.neonGreen,
        headerBackTitleVisible: false,
        headerTitleAlign: 'left',
        headerTitleContainerStyle: { maxWidth: SCREEN_W - 118 },
        headerTitle: () => (
          <View style={d.headerTitleWrap}>
            <Text style={d.headerEyebrow}>Patrocinador</Text>
            <Text style={d.headerTitleText} numberOfLines={1}>{sponsor.name}</Text>
          </View>
        ),
      }} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={d.profileSection}>
          <View style={d.profileTop}>
            <View style={d.avatarWrap}>
              <Image source={{ uri: sponsor.logoUrl || sponsor.imageUrl }} style={d.avatar} contentFit="cover" cachePolicy="memory-disk" />
              {sponsor.verified && (
                <View style={d.verifiedDot}>
                  <BadgeCheck size={14} color="#000" fill={Colors.dark.neonGreen} />
                </View>
              )}
            </View>
            <View style={d.statsRow}>
              <View style={d.statItem}>
                <Text style={d.statNum}>{sponsor.offers.length}</Text>
                <Text style={d.statLabel}>Ofertas</Text>
              </View>
              <View style={d.statItem}>
                <Text style={d.statNum}>{totalLikes.toLocaleString('pt-BR')}</Text>
                <Text style={d.statLabel}>Curtidas</Text>
              </View>
              <View style={d.statItem}>
                <Text style={d.statNum}>{sponsor.offers.reduce((sum, o) => sum + (o.shares || 0), 0)}</Text>
                <Text style={d.statLabel}>Shares</Text>
              </View>
            </View>
          </View>

          <View style={d.bioSection}>
            <View style={d.bioHead}>
              <View style={d.bioTitleWrap}>
                <Text style={d.bioName} numberOfLines={1}>{sponsor.name}</Text>
                <Text style={d.bioCategory} numberOfLines={1}>{sponsor.category}</Text>
                <View style={d.ratingRow}>
                  <Star size={13} color="#F59E0B" fill="#F59E0B" />
                  {hasRatings ? (
                    <Text style={d.ratingText}>
                      <Text style={d.ratingValue}>{ratingAverageLabel}</Text>
                      {' '}media • {ratingCount} avaliacao{ratingCount === 1 ? '' : 'es'}
                    </Text>
                  ) : (
                    <Text style={d.ratingEmpty}>Sem avaliacoes</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity style={d.inlineGoBtn} onPress={handleGoLocation} activeOpacity={0.8}>
                <Text style={d.inlineGoBtnTxt}>Ir para</Text>
              </TouchableOpacity>
            </View>
            <Text style={d.bioDesc} numberOfLines={2}>{sponsor.description}</Text>
            <View style={d.bioMeta}>
              <View style={d.metaRow}>
                <MapPin size={12} color={Colors.dark.textMuted} />
                <Text style={d.metaTxt} numberOfLines={1}>{sponsor.address}, {sponsor.city} - {sponsor.state}</Text>
              </View>
              <View style={d.metaRow}>
                <Phone size={12} color={Colors.dark.textMuted} />
                <Text style={d.metaTxt}>{formatPhone(sponsor.phone)}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={d.tabBar}>
          <TouchableOpacity
            style={[d.tabItem, activeTab === 'grid' && d.tabItemActive]}
            onPress={() => setActiveTab('grid')}
            activeOpacity={0.7}
          >
            <Grid3x3 size={22} color={activeTab === 'grid' ? Colors.dark.neonGreen : Colors.dark.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[d.tabItem, activeTab === 'list' && d.tabItemActive]}
            onPress={() => setActiveTab('list')}
            activeOpacity={0.7}
          >
            <ShoppingBag size={22} color={activeTab === 'list' ? Colors.dark.neonGreen : Colors.dark.textMuted} />
          </TouchableOpacity>
        </View>

        {activeTab === 'grid' ? (
          <View>
            <Text style={d.sectionTitle}>Produtos da Loja</Text>
            {products.length > 0 ? (
              <View style={d.grid}>
                {products.map((product) => (
                  <TouchableOpacity key={product.id} style={d.gridItem} onPress={() => handleProductPress(product)} activeOpacity={0.85}>
                    <Image source={{ uri: product.url }} style={d.gridImg} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" />
                    <View style={d.gridShade} />
                    {(product.label || typeof product.price === 'number') && (
                      <View style={d.productInfoWrap}>
                        {product.label ? <Text style={d.productLabel} numberOfLines={1}>{product.label}</Text> : null}
                        {typeof product.price === 'number' ? <Text style={d.productPrice}>R$ {product.price.toFixed(2)}</Text> : null}
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={d.emptyProducts}>Este patrocinador ainda nao cadastrou produtos da loja.</Text>
            )}
          </View>
        ) : (
          <View style={d.listView}>
            {sponsor.offers.map((offer, offerIndex) => (
              <TouchableOpacity key={offer.id} onPress={() => handleOfferPress(offer, offerIndex)} activeOpacity={0.9} style={d.postCard}>
                <View style={d.postTopBar}>
                  <View style={d.postIdentity}>
                    <Image source={{ uri: sponsor.logoUrl || sponsor.imageUrl }} style={d.postAvatar} contentFit="cover" cachePolicy="memory-disk" />
                    <View style={d.postHeaderInfo}>
                      <View style={d.postNameRow}>
                        <Text style={d.postSponsorName} numberOfLines={1}>{sponsor.name}</Text>
                        {sponsor.verified ? <BadgeCheck size={13} color="#08111F" fill={Colors.dark.neonGreen} /> : null}
                      </View>
                      <Text style={d.postLocation} numberOfLines={1}>{[sponsor.city, sponsor.state].filter(Boolean).join(' • ')}</Text>
                    </View>
                  </View>
                  <Text style={d.postTag}>Post</Text>
                </View>

                <Image source={{ uri: offer.imageUrl }} style={d.postMedia} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" />

                <View style={d.postActionsRow}>
                  <View style={d.postActionIcons}>
                    <Heart size={18} color="#F8FAFC" />
                    <MessageSquare size={18} color="#F8FAFC" />
                    <Send size={18} color="#F8FAFC" />
                  </View>
                  {offer.discount ? <Text style={d.postPricePill}>{offer.discount}</Text> : null}
                </View>

                <View style={d.postCaptionWrap}>
                  <Text style={d.postLikes}>{offer.likes} curtida{offer.likes === 1 ? '' : 's'}</Text>
                  <Text style={d.postCaption} numberOfLines={2}>
                    <Text style={d.postCaptionStrong}>{sponsor.name}</Text>
                    {' '}
                    {offer.title}
                  </Text>
                  <Text style={d.postDescription} numberOfLines={2}>{offer.description}</Text>
                  <Text style={d.postStats}>{offer.comments} comentarios • {offer.shares} compartilhamentos</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <TouchableOpacity
        style={d.whatsappFab}
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          const whatsNumber = (sponsor.whatsapp || sponsor.phone).replace(/\D/g, '');
          const msg = encodeURIComponent(`Olá ${sponsor.name}! Vi seu comércio no app e gostaria de mais informações.`);
          Linking.openURL(`https://wa.me/55${whatsNumber}?text=${msg}`);
        }}
        activeOpacity={0.85}
        testID="whatsapp-fab"
      >
        <MessageSquare size={26} color="#FFF" />
      </TouchableOpacity>

      <OfferDetailModal
        visible={modalVisible}
        offer={selectedOffer}
        sponsor={sponsor}
        offerList={selectedOfferList}
        initialIndex={selectedOfferIndex}
        presentationMode={modalPresentationMode}
        onClose={handleCloseModal}
      />
    </View>
  );
}

const d = StyleSheet.create({
  ctr: { flex: 1, backgroundColor: 'transparent' },
  empty: { flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { color: STORE_THEME.textMuted, fontSize: 16, fontWeight: '600' as const },
  headerTitleWrap: {
    gap: 1,
  },
  headerEyebrow: {
    color: 'rgba(226,232,240,0.68)',
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  headerTitleText: {
    color: Colors.dark.primary,
    fontSize: 16,
    fontWeight: '900' as const,
    letterSpacing: 0.2,
  },

  profileSection: {
    backgroundColor: 'rgba(7,11,22,0.42)',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarWrap: {
    position: 'relative' as const,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 2,
    borderColor: 'rgba(248,250,252,0.84)',
  },
  verifiedDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    padding: 1,
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    paddingTop: 4,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 0,
    flex: 1,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statNum: {
    fontSize: 16,
    fontWeight: '900' as const,
    color: STORE_THEME.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(226,232,240,0.76)',
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginTop: 2,
  },

  bioSection: {
    marginTop: 8,
  },
  bioHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bioTitleWrap: {
    flex: 1,
  },
  bioName: {
    fontSize: 20,
    fontWeight: '900' as const,
    letterSpacing: 0.2,
    color: STORE_THEME.textPrimary,
    textShadowColor: STORE_THEME.titleShadow,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  bioCategory: {
    fontSize: 11,
    color: 'rgba(226,232,240,0.76)',
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  ratingText: {
    color: STORE_THEME.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  ratingValue: {
    color: STORE_THEME.textPrimary,
    fontWeight: '800' as const,
  },
  ratingEmpty: {
    color: STORE_THEME.textMuted,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  bioDesc: {
    fontSize: 14,
    color: STORE_THEME.textSecondary,
    fontWeight: '500' as const,
    lineHeight: 21,
    marginTop: 6,
  },
  bioMeta: {
    marginTop: 8,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaTxt: {
    flex: 1,
    fontSize: 13,
    color: STORE_THEME.textSecondary,
    fontWeight: '600' as const,
    lineHeight: 18,
  },
  inlineGoBtn: {
    minWidth: 58,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: 7,
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },
  inlineGoBtnTxt: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(7,11,22,0.24)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.dark.neonGreen,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: GRID_HORIZONTAL_PADDING,
  },
  sectionTitle: {
    color: STORE_THEME.textPrimary,
    fontSize: 16,
    fontWeight: '800' as const,
    letterSpacing: 0.2,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  emptyProducts: {
    color: STORE_THEME.textMuted,
    fontSize: 13,
    fontWeight: '600' as const,
    marginHorizontal: 12,
    marginBottom: 14,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    position: 'relative' as const,
    marginRight: GRID_GAP,
    marginBottom: GRID_GAP,
    borderRadius: 16,
    overflow: 'hidden' as const,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  gridImg: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    borderRadius: 16,
  },
  gridShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,23,0.12)',
  },
  productInfoWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingTop: 18,
    paddingBottom: 8,
    backgroundColor: 'rgba(2,6,23,0.58)',
  },
  productLabel: {
    color: STORE_THEME.textPrimary,
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 0.2,
  },
  productPrice: {
    color: STORE_THEME.textSecondary,
    fontSize: 11,
    fontWeight: '700' as const,
    marginTop: 2,
  },
  gridBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  gridBadgeTxt: {
    color: Colors.dark.neonGreen,
    fontSize: 10,
    fontWeight: '700' as const,
  },

  listView: {
    paddingTop: 6,
    gap: 14,
  },
  postCard: {
    backgroundColor: 'rgba(7,11,22,0.72)',
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 8,
  },
  postTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
  postIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  postMedia: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.dark.surfaceLight,
  },
  postActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  postActionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  postAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.42)',
  },
  postHeaderInfo: {
    flex: 1,
  },
  postNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  postSponsorName: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: STORE_THEME.textPrimary,
    flexShrink: 1,
  },
  postLocation: {
    fontSize: 11,
    color: STORE_THEME.textMuted,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  postTag: {
    color: 'rgba(226,232,240,0.76)',
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  postPricePill: {
    color: '#111827',
    fontSize: 11,
    fontWeight: '900' as const,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F59E0B',
    overflow: 'hidden' as const,
  },
  postCaptionWrap: {
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  postLikes: {
    color: STORE_THEME.textPrimary,
    fontSize: 12,
    fontWeight: '800' as const,
  },
  postCaption: {
    color: STORE_THEME.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  postCaptionStrong: {
    color: STORE_THEME.textPrimary,
    fontWeight: '800' as const,
  },
  postDescription: {
    color: STORE_THEME.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  postStats: {
    color: STORE_THEME.textMuted,
    fontSize: 11,
    fontWeight: '600' as const,
    marginTop: 8,
  },

  whatsappFab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 100,
  },
});
