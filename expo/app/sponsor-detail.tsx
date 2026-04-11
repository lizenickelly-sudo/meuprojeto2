import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Platform, Linking } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { MapPin, Phone, BadgeCheck, Navigation, Grid3x3, ShoppingBag, Heart, MessageCircle, Share2, MessageSquare } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useSponsor } from '@/providers/SponsorProvider';
import OfferDetailModal from '@/components/OfferDetailModal';
import type { Offer, Sponsor } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GAP = 2;
const GRID_COLS = 3;
const GRID_ITEM_SIZE = (SCREEN_W - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;

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
  const { sponsors } = useSponsor();
  const sponsor = sponsors.find((s) => s.id === sponsorId);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'list'>('grid');

  const handleOfferPress = useCallback((offer: Offer) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedOffer(offer);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedOffer(null);
  }, []);

  const handleGoLocation = useCallback(() => {
    if (!sponsor) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openDirections(sponsor.latitude, sponsor.longitude, sponsor.name);
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
                <MapPin size={13} color={Colors.dark.textMuted} />
                <Text style={d.metaTxt}>{sponsor.address}, {sponsor.city} - {sponsor.state}</Text>
              </View>
              <View style={d.metaRow}>
                <Phone size={13} color={Colors.dark.textMuted} />
                <Text style={d.metaTxt}>{sponsor.phone}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={d.locationBtn}
            onPress={handleGoLocation}
            activeOpacity={0.8}
          >
            <Navigation size={18} color="#000" />
            <Text style={d.locationBtnTxt}>Ir para Local</Text>
          </TouchableOpacity>
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
          <View style={d.grid}>
            {sponsor.offers.map((offer) => (
              <TouchableOpacity key={offer.id} onPress={() => handleOfferPress(offer)} activeOpacity={0.85}>
                <View style={d.gridItem}>
                  <Image source={{ uri: offer.imageUrl }} style={d.gridImg} contentFit="cover" cachePolicy="memory-disk" />
                  {offer.discount && (
                    <View style={d.gridBadge}>
                      <Text style={d.gridBadgeTxt}>{offer.discount}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={d.listView}>
            {sponsor.offers.map((offer) => (
              <TouchableOpacity key={offer.id} onPress={() => handleOfferPress(offer)} activeOpacity={0.9} style={d.postCard}>
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
                    <Heart size={24} color={Colors.dark.text} />
                    <MessageCircle size={23} color={Colors.dark.text} />
                    <Share2 size={22} color={Colors.dark.text} />
                  </View>
                </View>
                <View style={d.postDetails}>
                  <Text style={d.postLikes}>{(offer.likes || 0).toLocaleString('pt-BR')} curtidas</Text>
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
    gap: 6,
  },
  metaTxt: {
    fontSize: 13,
    color: Colors.dark.textMuted,
  },

  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.neonGreen,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 14,
    gap: 8,
  },
  locationBtnTxt: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700' as const,
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
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    position: 'relative' as const,
    marginRight: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridImg: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.dark.surfaceLight,
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
    paddingTop: 0,
  },
  postCard: {
    backgroundColor: Colors.dark.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.cardBorder,
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
