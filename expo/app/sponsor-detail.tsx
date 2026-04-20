import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Platform, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { MapPin, Phone, BadgeCheck, Navigation, Grid3x3, ShoppingBag, Heart, MessageCircle, Share2, MessageSquare } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useSponsor } from '@/providers/SponsorProvider';
import { useUser } from '@/providers/UserProvider';
import OfferDetailModal from '@/components/OfferDetailModal';
import type { Offer, SponsorImage } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GAP = 8;
const GRID_COLS = 3;
const GRID_HORIZONTAL_PADDING = 12;
const GRID_ITEM_SIZE = (SCREEN_W - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

function openDirections(lat: number, lon: number, label: string) {
  const encoded = encodeURIComponent(label);
  if (Platform.OS === 'ios') {
    Linking.openURL(`maps:0,0?daddr=${lat},${lon}&dirflg=d`).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&destination_place_id=${encoded}&travelmode=driving`);
    });
  } else if (Platform.OS === 'android') {
    Linking.openURL(`google.navigation:q=${lat},${lon}&mode=d`).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`);
    });
  } else {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`);
  }
}

export default function SponsorDetailScreen() {
  console.log("[SponsorDetail] Sponsor detail initialized");
  const { sponsorId } = useLocalSearchParams<{ sponsorId: string }>();
  const router = useRouter();
  const { sponsors, toggleLikeOffer: rawToggleLike, shareOffer: rawShare, addOfferComment, isOfferLiked, isOfferShared } = useSponsor();
  const { addPoints } = useUser();
  const sponsor = sponsors.find((s) => s.id === sponsorId);
  const toggleLikeOffer = useCallback((offerId: string) => rawToggleLike(offerId, (pts) => addPoints(pts)), [rawToggleLike, addPoints]);
  const shareOffer = useCallback((offerId: string) => rawShare(offerId, (pts) => addPoints(pts)), [rawShare, addPoints]);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [selectedOfferList, setSelectedOfferList] = useState<Offer[]>([]);
  const [selectedOfferIndex, setSelectedOfferIndex] = useState<number>(0);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'list'>('grid');

  const handleOfferPress = useCallback((offer: Offer, index: number) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    setSelectedOfferList(productOffers);
    setSelectedOfferIndex(idx);
    setSelectedOffer(productOffers[idx] || null);
    setModalVisible(true);
  }, [sponsor]);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedOffer(null);
    setSelectedOfferList([]);
    setSelectedOfferIndex(0);
  }, []);

  const handleGoLocation = useCallback(() => {
    if (!sponsor) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openDirections(sponsor.latitude, sponsor.longitude, sponsor.name);
  }, [sponsor]);

  const handleOfferComment = useCallback((offer: Offer) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addOfferComment(offer.id);
    console.log('[SponsorDetail] Comment registered for offer:', offer.id);
  }, [addOfferComment]);

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

  return (
    <View style={d.ctr}>
      <Stack.Screen options={{
        title: sponsor.name,
        headerStyle: { backgroundColor: Colors.dark.surface },
        headerTintColor: Colors.dark.neonGreen,
        headerTitleStyle: { color: Colors.dark.text, fontWeight: '600' as const, fontSize: 16 },
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
            <Text style={d.bioName}>{sponsor.name}</Text>
            <Text style={d.bioCategory}>{sponsor.category}</Text>
            <Text style={d.bioDesc}>{sponsor.description}</Text>
            <View style={d.bioMeta}>
              <View style={d.metaRow}>
                <TouchableOpacity style={d.inlineGoBtn} onPress={handleGoLocation} activeOpacity={0.8}>
                  <Navigation size={16} color="#FFF" />
                </TouchableOpacity>
                <MapPin size={13} color={Colors.dark.textMuted} />
                <Text style={d.metaTxt}>{sponsor.address}, {sponsor.city} - {sponsor.state}</Text>
              </View>
              <View style={d.metaRow}>
                <Phone size={13} color={Colors.dark.textMuted} />
                <Text style={d.metaTxt}>{sponsor.phone}</Text>
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
                    <Image source={{ uri: product.url }} style={d.gridImg} contentFit="cover" cachePolicy="memory-disk" />
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
                <View style={d.postHeader}>
                  <Image source={{ uri: sponsor.logoUrl || sponsor.imageUrl }} style={d.postAvatar} contentFit="cover" cachePolicy="memory-disk" />
                  <View style={d.postHeaderInfo}>
                    <Text style={d.postSponsorName}>{sponsor.name}</Text>
                    <Text style={d.postLocation}>{sponsor.city}</Text>
                  </View>
                </View>
                <Image source={{ uri: offer.imageUrl }} style={d.postImage} contentFit="cover" cachePolicy="memory-disk" />
                <View style={d.postActions}>
                  <View style={d.postActionsLeft}>
                    <TouchableOpacity style={d.postActionBtn} onPress={() => toggleLikeOffer(offer.id)} activeOpacity={0.7}>
                      <Heart
                        size={24}
                        color={isOfferLiked(offer.id) ? '#EF4444' : Colors.dark.text}
                        fill={isOfferLiked(offer.id) ? '#EF4444' : 'transparent'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity style={d.postActionBtn} onPress={() => handleOfferComment(offer)} activeOpacity={0.7}>
                      <MessageCircle size={23} color={Colors.dark.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={d.postActionBtn} onPress={() => shareOffer(offer.id)} activeOpacity={0.7}>
                      <Share2 size={22} color={isOfferShared(offer.id) ? Colors.dark.neonGreen : Colors.dark.text} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={d.postDetails}>
                  <Text style={d.postLikes}>{(offer.likes || 0).toLocaleString('pt-BR')} curtidas • {offer.comments || 0} mensagens • {offer.shares || 0} compartilhamentos</Text>
                  <Text style={d.postCaption}>
                    <Text style={d.postCaptionBold}>{sponsor.name} </Text>
                    {offer.title}
                  </Text>
                  <Text style={d.postDescTxt}>{offer.description}</Text>
                  {offer.discount && (
                    <View style={d.postPriceBadge}>
                      <Text style={d.postPriceTxt}>{offer.discount} OFF</Text>
                    </View>
                  )}
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
        onClose={handleCloseModal}
      />
    </View>
  );
}

const d = StyleSheet.create({
  ctr: { flex: 1, backgroundColor: Colors.dark.background },
  empty: { flex: 1, backgroundColor: Colors.dark.background, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { color: Colors.dark.textMuted, fontSize: 16 },

  profileSection: {
    backgroundColor: Colors.dark.surface,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.cardBorder,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  avatarWrap: {
    position: 'relative' as const,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 3,
    borderColor: Colors.dark.neonGreen,
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
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNum: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },

  bioSection: {
    marginTop: 14,
  },
  bioName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  bioCategory: {
    fontSize: 13,
    color: Colors.dark.neonGreen,
    fontWeight: '600' as const,
    marginTop: 1,
  },
  bioDesc: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
    marginTop: 6,
  },
  bioMeta: {
    marginTop: 8,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaTxt: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.textMuted,
    lineHeight: 18,
  },
  inlineGoBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.cardBorder,
    backgroundColor: Colors.dark.surface,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
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
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700' as const,
    marginHorizontal: 12,
    marginTop: 14,
    marginBottom: 10,
  },
  emptyProducts: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    marginHorizontal: 12,
    marginBottom: 14,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    position: 'relative' as const,
    marginRight: GRID_GAP,
    marginBottom: GRID_GAP,
    borderRadius: 12,
    overflow: 'hidden' as const,
  },
  gridImg: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: 12,
  },
  productInfoWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  productLabel: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  productPrice: {
    color: Colors.dark.neonGreen,
    fontSize: 10,
    fontWeight: '800' as const,
    marginTop: 1,
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
    gap: 12,
  },
  postCard: {
    backgroundColor: Colors.dark.surface,
    marginHorizontal: 12,
    marginBottom: 14,
    borderRadius: 18,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  postAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
  },
  postHeaderInfo: {
    flex: 1,
  },
  postSponsorName: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  postLocation: {
    fontSize: 11,
    color: Colors.dark.textMuted,
  },
  postImage: {
    width: SCREEN_W,
    height: SCREEN_W * 0.85,
    backgroundColor: Colors.dark.surfaceLight,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  postActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  postActionBtn: {
    paddingVertical: 2,
  },
  postDetails: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  postLikes: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.dark.text,
    marginBottom: 4,
  },
  postCaption: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
  postCaptionBold: {
    fontWeight: '700' as const,
    color: Colors.dark.text,
  },
  postDescTxt: {
    fontSize: 13,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  postPriceBadge: {
    alignSelf: 'flex-start' as const,
    backgroundColor: Colors.dark.neonGreen,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 8,
  },
  postPriceTxt: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800' as const,
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
