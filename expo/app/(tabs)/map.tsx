import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated, Dimensions, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MapPin, Locate, ChevronRight, Bell, X, Filter, Tag, BadgeCheck, Navigation2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import MapView, { Marker } from 'react-native-maps';
import Colors from '@/constants/colors';
import { useSponsor } from '@/providers/SponsorProvider';
import type { Sponsor } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');

const PROXIMITY_RADIUS_KM = 0.5;
const MAP_CATEGORIES = ['Todos', 'Supermercado', 'Farmacia', 'Restaurante', 'Auto Pecas', 'Pet Shop'];
const COUPON_VALUES = ['Qualquer', 'Ate R$10', 'R$10-20', 'R$20+'];

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function ProximityAlert({ sponsor, distance, onClose, onNavigate }: {
  sponsor: Sponsor;
  distance: string;
  onClose: () => void;
  onNavigate: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }).start();
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    p.start();
    return () => p.stop();
  }, []);

  return (
    <Animated.View style={[pa.wrap, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity style={pa.card} onPress={onNavigate} activeOpacity={0.9}>
        <Animated.View style={[pa.bellWrap, { transform: [{ scale: pulseAnim }] }]}>
          <Bell size={18} color="#000" fill="#000" />
        </Animated.View>
        <View style={pa.info}>
          <Text style={pa.title} numberOfLines={1}>Patrocinador perto de voce!</Text>
          <Text style={pa.name} numberOfLines={1}>{sponsor.name}</Text>
          <Text style={pa.dist}>{distance} - {sponsor.offers.length} oferta{sponsor.offers.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={pa.closeBtn}>
          <X size={16} color={Colors.dark.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const pa = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1.5, borderColor: Colors.dark.primary, shadowColor: '#F97316', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 10 },
  bellWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  info: { flex: 1 },
  title: { color: Colors.dark.primary, fontSize: 11, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  name: { color: Colors.dark.text, fontSize: 14, fontWeight: '700' as const, marginTop: 1 },
  dist: { color: Colors.dark.textSecondary, fontSize: 11, marginTop: 2 },
  closeBtn: { padding: 6 },
});

const SP_REGION = {
  latitude: -23.5540,
  longitude: -46.6510,
  latitudeDelta: 0.035,
  longitudeDelta: 0.035,
};

function SponsorBottomCard({ sponsor, onPress }: { sponsor: Sponsor; onPress: () => void }) {
  const slideAnim = useRef(new Animated.Value(200)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 65, useNativeDriver: true }).start();
  }, [sponsor.id]);

  return (
    <Animated.View style={[bc.wrap, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity style={bc.card} onPress={onPress} activeOpacity={0.9} testID={`bottom-${sponsor.id}`}>
        <Image source={{ uri: sponsor.logoUrl }} style={bc.logo} contentFit="cover" cachePolicy="memory-disk" />
        <View style={bc.info}>
          <View style={bc.nameRow}>
            <Text style={bc.name} numberOfLines={1}>{sponsor.name}</Text>
            {sponsor.verified && <BadgeCheck size={14} color={Colors.dark.primary} />}
          </View>
          <Text style={bc.cat}>{sponsor.category}</Text>
          <View style={bc.addrRow}>
            <MapPin size={11} color={Colors.dark.textMuted} />
            <Text style={bc.addr} numberOfLines={1}>{sponsor.address}</Text>
          </View>
        </View>
        <View style={bc.right}>
          {sponsor.couponValue != null && (
            <View style={bc.couponBadge}>
              <Text style={bc.couponVal}>R${sponsor.couponValue}</Text>
            </View>
          )}
          <View style={bc.offersBadge}>
            <Text style={bc.offersCount}>{sponsor.offers.length} ofertas</Text>
          </View>
          <ChevronRight size={18} color={Colors.dark.primary} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const bc = StyleSheet.create({
  wrap: { position: 'absolute', bottom: 100, left: 16, right: 16, zIndex: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(249,115,22,0.15)', shadowColor: '#F97316', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10 },
  logo: { width: 56, height: 56, borderRadius: 14, backgroundColor: Colors.dark.surfaceLight },
  info: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { color: Colors.dark.text, fontSize: 15, fontWeight: '700' as const, flexShrink: 1 },
  cat: { color: Colors.dark.primary, fontSize: 11, fontWeight: '600' as const, marginTop: 2 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  addr: { color: Colors.dark.textMuted, fontSize: 11, flex: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  couponBadge: { backgroundColor: Colors.dark.primary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  couponVal: { color: '#FFF', fontSize: 11, fontWeight: '800' as const },
  offersBadge: { backgroundColor: Colors.dark.primaryFaint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: Colors.dark.primaryBorder },
  offersCount: { color: Colors.dark.primary, fontSize: 10, fontWeight: '600' as const },
});

const CATEGORY_EMOJI: Record<string, string> = {
  'Supermercado': '🛒',
  'Farmácia': '💊',
  'Farmacia': '💊',
  'Restaurante': '🍽️',
  'Auto Peças': '🔧',
  'Auto Pecas': '🔧',
  'Pet Shop': '🐾',
};

function CustomPin({ name, selected, category, couponValue }: { name: string; selected: boolean; category: string; couponValue?: number }) {
  const emoji = CATEGORY_EMOJI[category] || '📍';
  const shortName = name.length > 10 ? name.slice(0, 9) + '…' : name;

  return (
    <View style={pinS.root}>
      <View style={[pinS.bubble, selected && pinS.bubbleSel]}>
        <View style={[pinS.emojiCircle, selected && pinS.emojiCircleSel]}>
          <Text style={pinS.emoji}>{emoji}</Text>
        </View>
        <Text style={[pinS.nameText, selected && pinS.nameTextSel]} numberOfLines={1}>{shortName}</Text>
        {couponValue != null && (
          <View style={[pinS.badge, selected && pinS.badgeSel]}>
            <Text style={[pinS.badgeText, selected && pinS.badgeTextSel]}>R${couponValue}</Text>
          </View>
        )}
      </View>
      <View style={[pinS.arrow, selected && pinS.arrowSel]} />
    </View>
  );
}

const pinS = StyleSheet.create({
  root: { alignItems: 'center', paddingBottom: 4 },
  bubble: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', borderWidth: 2, borderColor: Colors.dark.primary, minWidth: 70, maxWidth: 130, elevation: 8, shadowColor: '#F97316', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8 },
  bubbleSel: { backgroundColor: Colors.dark.primary, borderColor: '#EA580C' },
  emojiCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.dark.primaryFaint, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  emojiCircleSel: { backgroundColor: 'rgba(0,0,0,0.2)' },
  emoji: { fontSize: 18 },
  nameText: { color: Colors.dark.text, fontSize: 11, fontWeight: '800' as const, textAlign: 'center' as const },
  nameTextSel: { color: '#FFF', fontWeight: '900' as const },
  badge: { backgroundColor: Colors.dark.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  badgeSel: { backgroundColor: '#FFF' },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '900' as const },
  badgeTextSel: { color: Colors.dark.primary },
  arrow: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: Colors.dark.primary, marginTop: -1 },
  arrowSel: { borderTopColor: '#EA580C' },
});

function NearbyItem({ sponsor, distance, onPress }: { sponsor: Sponsor; distance: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={nb.card} onPress={onPress} activeOpacity={0.8}>
      <Image source={{ uri: sponsor.logoUrl }} style={nb.logo} contentFit="cover" cachePolicy="memory-disk" />
      <View style={nb.info}>
        <View style={nb.nameRow}>
          <Text style={nb.name} numberOfLines={1}>{sponsor.name}</Text>
          {sponsor.verified && <BadgeCheck size={12} color={Colors.dark.primary} />}
        </View>
        <Text style={nb.cat}>{sponsor.category}</Text>
      </View>
      <View style={nb.right}>
        <View style={nb.distBadge}>
          <Navigation2 size={10} color={Colors.dark.primary} />
          <Text style={nb.distTxt}>{distance}</Text>
        </View>
        {sponsor.couponValue != null && (
          <View style={nb.valBadge}>
            <Tag size={9} color="#000" />
            <Text style={nb.valTxt}>R${sponsor.couponValue}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const nb = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: Colors.dark.cardBorder, marginBottom: 8 },
  logo: { width: 42, height: 42, borderRadius: 10, backgroundColor: Colors.dark.surfaceLight },
  info: { flex: 1, marginLeft: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { color: Colors.dark.text, fontSize: 13, fontWeight: '700' as const, flexShrink: 1 },
  cat: { color: Colors.dark.textSecondary, fontSize: 10, marginTop: 1 },
  right: { alignItems: 'flex-end', gap: 4 },
  distBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.dark.primaryFaint, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  distTxt: { color: Colors.dark.primary, fontSize: 10, fontWeight: '700' as const },
  valBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.dark.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  valTxt: { color: '#FFF', fontSize: 10, fontWeight: '700' as const },
});

function WebMapFallback({ sponsors, selected, onSelect }: {
  sponsors: Sponsor[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={wm.container}>
      <View style={wm.mapPlaceholder}>
        <View style={wm.iconCircle}>
          <MapPin size={28} color={Colors.dark.primary} />
        </View>
        <Text style={wm.placeholderTitle}>Mapa dos Patrocinadores</Text>
        <Text style={wm.placeholderSub}>{sponsors.length} locais encontrados</Text>
      </View>
      <ScrollView contentContainerStyle={wm.grid} showsVerticalScrollIndicator={false}>
        {sponsors.map((sp) => {
          const emoji = CATEGORY_EMOJI[sp.category] || '📍';
          const isSel = selected === sp.id;
          return (
            <TouchableOpacity
              key={sp.id}
              style={[wm.pin, isSel && wm.pinSel]}
              onPress={() => onSelect(sp.id)}
              activeOpacity={0.7}
            >
              <View style={[wm.pinEmoji, isSel && wm.pinEmojiSel]}>
                <Text style={wm.emojiText}>{emoji}</Text>
              </View>
              <Text style={[wm.pinName, isSel && wm.pinNameSel]} numberOfLines={1}>{sp.name}</Text>
              {sp.couponValue != null && (
                <View style={[wm.pinValue, isSel && wm.pinValueSel]}>
                  <Text style={[wm.pinValueTxt, isSel && wm.pinValueTxtSel]}>R${sp.couponValue}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const wm = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  mapPlaceholder: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.dark.primaryFaint, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1, borderColor: Colors.dark.primaryBorder },
  placeholderTitle: { color: Colors.dark.text, fontSize: 18, fontWeight: '700' as const, marginTop: 4 },
  placeholderSub: { color: Colors.dark.textSecondary, fontSize: 13, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, paddingBottom: 120 },
  pin: { width: '30%', alignItems: 'center', backgroundColor: Colors.dark.card, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  pinSel: { borderWidth: 1.5, borderColor: Colors.dark.primary, backgroundColor: Colors.dark.primaryFaint },
  pinEmoji: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark.primaryFaint, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  pinEmojiSel: { backgroundColor: Colors.dark.primary },
  emojiText: { fontSize: 18 },
  pinName: { color: Colors.dark.text, fontSize: 10, fontWeight: '600' as const, textAlign: 'center' as const },
  pinNameSel: { color: Colors.dark.primary, fontWeight: '700' as const },
  pinValue: { marginTop: 4, backgroundColor: Colors.dark.primaryFaint, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  pinValueSel: { backgroundColor: Colors.dark.primary },
  pinValueTxt: { color: Colors.dark.primary, fontSize: 9, fontWeight: '700' as const },
  pinValueTxtSel: { color: '#FFF' },
});

export default function MapScreen() {
  console.log("[MapScreen] Map screen initialized");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [proxSponsor, setProxSponsor] = useState<Sponsor | null>(null);
  const [proxDistance, setProxDistance] = useState<string>('');
  const [dismissedProx, setDismissedProx] = useState<Set<string>>(new Set<string>());
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [filterCat, setFilterCat] = useState<string>('Todos');
  const [filterValue, setFilterValue] = useState<string>('Qualquer');
  const [showNearby, setShowNearby] = useState<boolean>(false);
  const nearbyAnim = useRef(new Animated.Value(0)).current;

  const { sponsors: allSponsors } = useSponsor();

  const filteredSponsors = useMemo(() => {
    let list = allSponsors;
    if (filterCat !== 'Todos') {
      list = list.filter((s) => s.category === filterCat);
    }
    if (filterValue !== 'Qualquer') {
      list = list.filter((s) => {
        const cv = s.couponValue ?? 0;
        if (filterValue === 'Ate R$10') return cv <= 10;
        if (filterValue === 'R$10-20') return cv > 10 && cv <= 20;
        if (filterValue === 'R$20+') return cv > 20;
        return true;
      });
    }
    return list;
  }, [filterCat, filterValue, allSponsors]);

  const nearbySponsors = useMemo(() => {
    if (!userLoc) return filteredSponsors.map((s) => ({ sponsor: s, dist: 0, distLabel: '--' }));
    return filteredSponsors
      .map((s) => {
        const d = getDistanceKm(userLoc.lat, userLoc.lon, s.latitude, s.longitude);
        const distMeters = Math.round(d * 1000);
        const distLabel = distMeters >= 1000 ? `${d.toFixed(1)} km` : `${distMeters}m`;
        return { sponsor: s, dist: d, distLabel };
      })
      .sort((a, b) => a.dist - b.dist);
  }, [filteredSponsors, userLoc]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterCat !== 'Todos') c++;
    if (filterValue !== 'Qualquer') c++;
    return c;
  }, [filterCat, filterValue]);

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS !== 'web') {
          const Location = await import('expo-location');
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const l = await Location.getCurrentPositionAsync({});
            setUserLoc({ lat: l.coords.latitude, lon: l.coords.longitude });
            console.log('[Map] user location:', l.coords.latitude, l.coords.longitude);
          }
        }
      } catch (e) {
        console.log('[Map] location err:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!userLoc) return;
    const nearest = allSponsors
      .filter((sp) => !dismissedProx.has(sp.id))
      .map((sp) => ({
        sponsor: sp,
        dist: getDistanceKm(userLoc.lat, userLoc.lon, sp.latitude, sp.longitude),
      }))
      .filter((item) => item.dist <= PROXIMITY_RADIUS_KM)
      .sort((a, b) => a.dist - b.dist)[0];

    if (nearest) {
      const distMeters = Math.round(nearest.dist * 1000);
      const distLabel = distMeters >= 1000 ? `${(nearest.dist).toFixed(1)} km` : `${distMeters}m`;
      setProxSponsor(nearest.sponsor);
      setProxDistance(distLabel);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      console.log('[Map] proximity alert for:', nearest.sponsor.name, distLabel);
    }
  }, [userLoc, dismissedProx, allSponsors]);

  const dismissProximity = useCallback(() => {
    if (proxSponsor) {
      setDismissedProx((prev) => new Set(prev).add(proxSponsor.id));
      setProxSponsor(null);
    }
  }, [proxSponsor]);

  const selectedSponsor = sel ? filteredSponsors.find((s) => s.id === sel) : null;

  const handleMarkerPress = useCallback((id: string) => {
    setSel(id);
    setShowNearby(false);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const sp = allSponsors.find((s) => s.id === id);
    if (sp && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: sp.latitude,
        longitude: sp.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 400);
    }
  }, [allSponsors]);

  const handleNavigate = useCallback((id: string) => {
    router.push({ pathname: '/sponsor-detail', params: { sponsorId: id } });
  }, [router]);

  const centerOnUser = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (userLoc && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLoc.lat,
        longitude: userLoc.lon,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      }, 500);
    }
  }, [userLoc]);

  const handleMapPress = useCallback(() => {
    setSel(null);
    setShowNearby(false);
  }, []);

  const toggleNearby = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !showNearby;
    setShowNearby(next);
    setSel(null);
    Animated.spring(nearbyAnim, { toValue: next ? 1 : 0, friction: 8, tension: 50, useNativeDriver: true }).start();
  }, [showNearby, nearbyAnim]);

  const initialRegion = userLoc
    ? { latitude: userLoc.lat, longitude: userLoc.lon, latitudeDelta: 0.035, longitudeDelta: 0.035 }
    : SP_REGION;

  const nearbyTranslate = nearbyAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  return (
    <View style={m.container}>
      {Platform.OS !== 'web' ? (
        <MapView
          ref={mapRef}
          style={m.map}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
          onPress={handleMapPress}
          testID="map-view"
        >
          {filteredSponsors.map((sp) => (
            <Marker
              key={sp.id}
              coordinate={{ latitude: sp.latitude, longitude: sp.longitude }}
              onPress={() => handleMarkerPress(sp.id)}
              tracksViewChanges={sel === sp.id}
              anchor={{ x: 0.5, y: 1 }}
              zIndex={sel === sp.id ? 10 : 1}
            >
              <CustomPin name={sp.name} selected={sel === sp.id} category={sp.category} couponValue={sp.couponValue} />
            </Marker>
          ))}
        </MapView>
      ) : (
        <WebMapFallback
          sponsors={filteredSponsors}
          selected={sel}
          onSelect={(id) => setSel(id)}
        />
      )}

      {proxSponsor && (
        <View style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, zIndex: 20 }}>
          <ProximityAlert
            sponsor={proxSponsor}
            distance={proxDistance}
            onClose={dismissProximity}
            onNavigate={() => {
              handleMarkerPress(proxSponsor.id);
              setProxSponsor(null);
            }}
          />
        </View>
      )}

      <View style={[m.topBar, { top: insets.top + (proxSponsor ? 80 : 8) }]}>
        <View style={m.topInfo}>
          <Text style={m.topTitle}>Patrocinadores</Text>
          <Text style={m.topCount}>{filteredSponsors.length} locais</Text>
        </View>
        <View style={m.topBtns}>
          <TouchableOpacity
            style={[m.filterBtn, activeFilterCount > 0 && m.filterBtnActive]}
            onPress={() => { setShowFilters(!showFilters); setShowNearby(false); }}
            testID="filter-btn"
          >
            <Filter size={18} color={activeFilterCount > 0 ? '#FFF' : Colors.dark.primary} />
            {activeFilterCount > 0 && (
              <View style={m.filterCount}><Text style={m.filterCountTxt}>{activeFilterCount}</Text></View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[m.nearbyBtn, showNearby && m.nearbyBtnActive]}
            onPress={toggleNearby}
            testID="nearby-btn"
          >
            <Navigation2 size={18} color={showNearby ? '#FFF' : Colors.dark.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={m.locBtn} onPress={centerOnUser} testID="loc-btn">
            <Locate size={20} color={Colors.dark.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {showFilters && (
        <View style={[m.filtersPanel, { top: insets.top + (proxSponsor ? 140 : 68) }]}>
          <Text style={m.fpLabel}>Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={m.fpScroll}>
            {MAP_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[m.fpChip, filterCat === cat && m.fpChipOn]}
                onPress={() => setFilterCat(cat)}
              >
                <Text style={[m.fpChipTxt, filterCat === cat && m.fpChipTxtOn]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={[m.fpLabel, { marginTop: 10 }]}>Valor do Cupom</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={m.fpScroll}>
            {COUPON_VALUES.map((val) => (
              <TouchableOpacity
                key={val}
                style={[m.fpChip, filterValue === val && m.fpChipOn]}
                onPress={() => setFilterValue(val)}
              >
                <Tag size={10} color={filterValue === val ? '#000' : Colors.dark.textSecondary} />
                <Text style={[m.fpChipTxt, filterValue === val && m.fpChipTxtOn]}>{val}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {activeFilterCount > 0 && (
            <TouchableOpacity style={m.clearBtn} onPress={() => { setFilterCat('Todos'); setFilterValue('Qualquer'); }}>
              <Text style={m.clearTxt}>Limpar filtros</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading && (
        <View style={m.loadingOverlay}>
          <ActivityIndicator size="small" color={Colors.dark.primary} />
          <Text style={m.loadingTxt}>Obtendo localizacao...</Text>
        </View>
      )}

      {selectedSponsor && !showNearby && (
        <SponsorBottomCard
          sponsor={selectedSponsor}
          onPress={() => handleNavigate(selectedSponsor.id)}
        />
      )}

      {showNearby && (
        <Animated.View style={[m.nearbyPanel, { transform: [{ translateY: nearbyTranslate }] }]}>
          <View style={m.nearbyHandle}>
            <View style={m.nearbyHandleBar} />
          </View>
          <View style={m.nearbyHeader}>
            <Navigation2 size={16} color={Colors.dark.primary} />
            <Text style={m.nearbyTitle}>Cupons perto de voce</Text>
            <Text style={m.nearbyCount}>{nearbySponsors.length}</Text>
          </View>
          <ScrollView style={m.nearbyList} showsVerticalScrollIndicator={false}>
            {nearbySponsors.map((item) => (
              <NearbyItem
                key={item.sponsor.id}
                sponsor={item.sponsor}
                distance={item.distLabel}
                onPress={() => {
                  handleMarkerPress(item.sponsor.id);
                  setShowNearby(false);
                }}
              />
            ))}
            {nearbySponsors.length === 0 && (
              <View style={m.nearbyEmpty}>
                <MapPin size={28} color={Colors.dark.textMuted} />
                <Text style={m.nearbyEmptyTxt}>Nenhum patrocinador encontrado com esses filtros</Text>
              </View>
            )}
            <View style={{ height: 20 }} />
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  map: { flex: 1 },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 },
  topInfo: { backgroundColor: Colors.dark.card, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: Colors.dark.cardBorder, shadowColor: '#00FF87', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  topTitle: { color: Colors.dark.text, fontSize: 16, fontWeight: '800' as const },
  topCount: { color: Colors.dark.primary, fontSize: 11, fontWeight: '600' as const, marginTop: 1 },
  topBtns: { flexDirection: 'row', gap: 8 },
  filterBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.dark.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.dark.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  filterBtnActive: { backgroundColor: Colors.dark.primary, borderColor: Colors.dark.primary },
  filterCount: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.dark.danger, alignItems: 'center', justifyContent: 'center' },
  filterCountTxt: { color: '#FFF', fontSize: 10, fontWeight: '800' as const },
  nearbyBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.dark.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.dark.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  nearbyBtnActive: { backgroundColor: Colors.dark.primary, borderColor: Colors.dark.primary },
  locBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.dark.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.dark.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  filtersPanel: { position: 'absolute', left: 16, right: 16, zIndex: 15, backgroundColor: Colors.dark.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.dark.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 },
  fpLabel: { color: Colors.dark.textSecondary, fontSize: 11, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  fpScroll: { marginBottom: 4 },
  fpChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.dark.surfaceLight, marginRight: 8, borderWidth: 1, borderColor: Colors.dark.cardBorder },
  fpChipOn: { backgroundColor: Colors.dark.primary, borderColor: Colors.dark.primary },
  fpChipTxt: { color: Colors.dark.textSecondary, fontSize: 12, fontWeight: '600' as const },
  fpChipTxtOn: { color: '#FFF' },
  clearBtn: { alignSelf: 'center', marginTop: 8, paddingHorizontal: 16, paddingVertical: 6 },
  clearTxt: { color: Colors.dark.danger, fontSize: 12, fontWeight: '600' as const },
  loadingOverlay: { position: 'absolute', top: '50%', alignSelf: 'center', backgroundColor: Colors.dark.card, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.dark.cardBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  loadingTxt: { color: Colors.dark.textSecondary, fontSize: 13 },
  nearbyPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: 380, backgroundColor: Colors.dark.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, zIndex: 12, borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.dark.cardBorder },
  nearbyHandle: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  nearbyHandleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.dark.textMuted },
  nearbyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.dark.cardBorder },
  nearbyTitle: { flex: 1, color: Colors.dark.text, fontSize: 15, fontWeight: '700' as const },
  nearbyCount: { backgroundColor: Colors.dark.primaryFaint, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, color: Colors.dark.primary, fontSize: 12, fontWeight: '700' as const, overflow: 'hidden' },
  nearbyList: { paddingHorizontal: 16, paddingTop: 10 },
  nearbyEmpty: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  nearbyEmptyTxt: { color: Colors.dark.textMuted, fontSize: 13, textAlign: 'center' },
});
