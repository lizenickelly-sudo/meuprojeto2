import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { CouponBatch, AdminNotification, GrandPrize, PromotionalQR, ManagedCity } from '@/types';
import { hashPin, verifyPin } from '@/lib/crypto';
import { readDomainCache, writeDomainCache } from '@/lib/stateCache';
import {
  fetchGrandPrize as dbFetchGrandPrize,
  seedAllToSupabase,
  checkTablesExist,
  SETUP_SQL,
  fetchAllUsers as dbFetchAllUsers,
} from '@/services/database';
import type { SeedResult } from '@/services/database';

const STORAGE_KEYS = {
  IS_ADMIN: 'cashboxpix_is_admin',
  ADMIN_PIN_HASH: 'cashboxpix_admin_pin_hash',
  COUPON_BATCHES: 'cashboxpix_coupon_batches',
  NOTIFICATIONS: 'cashboxpix_notifications',
  GRAND_PRIZE: 'cashboxpix_grand_prize',
  CITY_PRIZES: 'cashboxpix_city_prizes',
  CITY_IMAGES: 'cashboxpix_city_images',
  PROMO_QR_CODES: 'cashboxpix_promo_qrcodes',
  MANAGED_CITIES: 'cashboxpix_managed_cities',
};

const ADMIN_CACHE_TTL_MS = 1000 * 60 * 20;

const ADMIN_CACHE_KEYS = {
  IS_ADMIN: 'is_admin',
  COUPON_BATCHES: 'coupon_batches',
  NOTIFICATIONS: 'notifications',
  GRAND_PRIZE: 'grand_prize',
  CITY_PRIZES: 'city_prizes',
  CITY_IMAGES: 'city_images',
  PROMO_QR_CODES: 'promo_qr_codes',
  MANAGED_CITIES: 'managed_cities',
} as const;

export const [AdminProvider, useAdmin] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [couponBatches, setCouponBatches] = useState<CouponBatch[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [grandPrizeConfig, setGrandPrizeConfig] = useState<GrandPrize | null>(null);
  const [cityPrizes, setCityPrizes] = useState<Record<string, GrandPrize>>({});
  const [cityImages, setCityImages] = useState<Record<string, string>>({});
  const [promoQRCodes, setPromoQRCodes] = useState<PromotionalQR[]>([]);
  const [managedCities, setManagedCities] = useState<ManagedCity[]>([]);

  const adminQuery = useQuery({
    queryKey: ['is_admin'],
    queryFn: async () => {
      const cached = await readDomainCache<boolean>('admin', ADMIN_CACHE_KEYS.IS_ADMIN, ADMIN_CACHE_TTL_MS);
      if (cached !== null) return cached;

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.IS_ADMIN);
      const value = stored === 'true';
      await writeDomainCache('admin', ADMIN_CACHE_KEYS.IS_ADMIN, value);
      return value;
    },
  });

  const couponBatchesQuery = useQuery({
    queryKey: ['coupon_batches'],
    queryFn: async () => {
      const cached = await readDomainCache<CouponBatch[]>('admin', ADMIN_CACHE_KEYS.COUPON_BATCHES, ADMIN_CACHE_TTL_MS);
      if (cached) return cached;

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.COUPON_BATCHES);
      const value = stored ? JSON.parse(stored) as CouponBatch[] : [];
      await writeDomainCache('admin', ADMIN_CACHE_KEYS.COUPON_BATCHES, value);
      return value;
    },
  });

  const notificationsQuery = useQuery({
    queryKey: ['admin_notifications'],
    queryFn: async () => {
      const cached = await readDomainCache<AdminNotification[]>('admin', ADMIN_CACHE_KEYS.NOTIFICATIONS, ADMIN_CACHE_TTL_MS);
      if (cached) return cached;

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      const value = stored ? JSON.parse(stored) as AdminNotification[] : [];
      await writeDomainCache('admin', ADMIN_CACHE_KEYS.NOTIFICATIONS, value);
      return value;
    },
  });

  const grandPrizeQuery = useQuery({
    queryKey: ['grand_prize_config'],
    queryFn: async () => {
      const cached = await readDomainCache<GrandPrize>('admin', ADMIN_CACHE_KEYS.GRAND_PRIZE, ADMIN_CACHE_TTL_MS);
      if (cached) return cached;

      console.log('[AdminProvider] Fetching grand prize from Supabase...');
      const result = await dbFetchGrandPrize();
      console.log('[AdminProvider] Got grand prize:', result.title);
      await writeDomainCache('admin', ADMIN_CACHE_KEYS.GRAND_PRIZE, result);
      return result;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const cityPrizesQuery = useQuery({
    queryKey: ['city_prizes'],
    queryFn: async () => {
      const cached = await readDomainCache<Record<string, GrandPrize>>('admin', ADMIN_CACHE_KEYS.CITY_PRIZES, ADMIN_CACHE_TTL_MS);
      if (cached) return cached;

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CITY_PRIZES);
      const value = stored ? JSON.parse(stored) as Record<string, GrandPrize> : {};
      await writeDomainCache('admin', ADMIN_CACHE_KEYS.CITY_PRIZES, value);
      return value;
    },
  });

  const cityImagesQuery = useQuery({
    queryKey: ['city_images'],
    queryFn: async () => {
      const cached = await readDomainCache<Record<string, string>>('admin', ADMIN_CACHE_KEYS.CITY_IMAGES, ADMIN_CACHE_TTL_MS);
      if (cached) return cached;

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CITY_IMAGES);
      const value = stored ? JSON.parse(stored) as Record<string, string> : {};
      await writeDomainCache('admin', ADMIN_CACHE_KEYS.CITY_IMAGES, value);
      return value;
    },
  });

  const managedCitiesQuery = useQuery({
    queryKey: ['managed_cities'],
    queryFn: async () => {
      const cached = await readDomainCache<ManagedCity[]>('admin', ADMIN_CACHE_KEYS.MANAGED_CITIES, ADMIN_CACHE_TTL_MS);
      if (cached) return cached;

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.MANAGED_CITIES);
      const value = stored ? JSON.parse(stored) as ManagedCity[] : [];
      await writeDomainCache('admin', ADMIN_CACHE_KEYS.MANAGED_CITIES, value);
      return value;
    },
  });

  useEffect(() => {
    if (adminQuery.data !== undefined) setIsAdmin(adminQuery.data);
  }, [adminQuery.data]);

  useEffect(() => {
    if (couponBatchesQuery.data) setCouponBatches(couponBatchesQuery.data);
  }, [couponBatchesQuery.data]);

  useEffect(() => {
    if (notificationsQuery.data) setNotifications(notificationsQuery.data);
  }, [notificationsQuery.data]);

  useEffect(() => {
    if (grandPrizeQuery.data !== undefined) setGrandPrizeConfig(grandPrizeQuery.data);
  }, [grandPrizeQuery.data]);

  useEffect(() => {
    if (cityPrizesQuery.data) setCityPrizes(cityPrizesQuery.data);
  }, [cityPrizesQuery.data]);

  useEffect(() => {
    if (cityImagesQuery.data) setCityImages(cityImagesQuery.data);
  }, [cityImagesQuery.data]);

  useEffect(() => {
    if (managedCitiesQuery.data) setManagedCities(managedCitiesQuery.data);
  }, [managedCitiesQuery.data]);

  const promoQRQuery = useQuery({
    queryKey: ['promo_qrcodes'],
    queryFn: async () => {
      const cached = await readDomainCache<PromotionalQR[]>('admin', ADMIN_CACHE_KEYS.PROMO_QR_CODES, ADMIN_CACHE_TTL_MS);
      if (cached) return cached;

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PROMO_QR_CODES);
      const value = stored ? JSON.parse(stored) as PromotionalQR[] : [];
      await writeDomainCache('admin', ADMIN_CACHE_KEYS.PROMO_QR_CODES, value);
      return value;
    },
  });

  useEffect(() => {
    if (promoQRQuery.data) setPromoQRCodes(promoQRQuery.data);
  }, [promoQRQuery.data]);

  const setAdminMutation = useMutation({
    mutationFn: async (val: boolean) => {
      await AsyncStorage.setItem(STORAGE_KEYS.IS_ADMIN, val.toString());
      await writeDomainCache('admin', ADMIN_CACHE_KEYS.IS_ADMIN, val);
      return val;
    },
    onSuccess: (data) => {
      setIsAdmin(data);
      queryClient.invalidateQueries({ queryKey: ['is_admin'] });
    },
  });

  const saveCouponBatchesMutation = useMutation({
    mutationFn: async (batches: CouponBatch[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.COUPON_BATCHES, JSON.stringify(batches));
      await writeDomainCache('admin', ADMIN_CACHE_KEYS.COUPON_BATCHES, batches);
      return batches;
    },
    onSuccess: (data) => {
      setCouponBatches(data);
      queryClient.invalidateQueries({ queryKey: ['coupon_batches'] });
    },
  });

  const saveNotificationsMutation = useMutation({
    mutationFn: async (notifs: AdminNotification[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
      await writeDomainCache('admin', ADMIN_CACHE_KEYS.NOTIFICATIONS, notifs);
      return notifs;
    },
    onSuccess: (data) => {
      setNotifications(data);
      queryClient.invalidateQueries({ queryKey: ['admin_notifications'] });
    },
  });

  const saveGrandPrizeMutation = useMutation({
    mutationFn: async (prize: GrandPrize) => {
      await AsyncStorage.setItem(STORAGE_KEYS.GRAND_PRIZE, JSON.stringify(prize));
      await writeDomainCache('admin', ADMIN_CACHE_KEYS.GRAND_PRIZE, prize);
      return prize;
    },
    onSuccess: (data) => {
      setGrandPrizeConfig(data);
      queryClient.invalidateQueries({ queryKey: ['grand_prize_config'] });
    },
  });

  const saveCityPrizesMutation = useMutation({
    mutationFn: async (prizes: Record<string, GrandPrize>) => {
      await AsyncStorage.setItem(STORAGE_KEYS.CITY_PRIZES, JSON.stringify(prizes));
      await writeDomainCache('admin', ADMIN_CACHE_KEYS.CITY_PRIZES, prizes);
      return prizes;
    },
    onSuccess: (data) => {
      setCityPrizes(data);
      queryClient.invalidateQueries({ queryKey: ['city_prizes'] });
    },
  });

  const savePromoQRMutation = useMutation({
    mutationFn: async (codes: PromotionalQR[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.PROMO_QR_CODES, JSON.stringify(codes));
      await writeDomainCache('admin', ADMIN_CACHE_KEYS.PROMO_QR_CODES, codes);
      return codes;
    },
    onSuccess: (data) => {
      setPromoQRCodes(data);
      queryClient.invalidateQueries({ queryKey: ['promo_qrcodes'] });
    },
  });

  const saveCityImagesMutation = useMutation({
    mutationFn: async (images: Record<string, string>) => {
      await AsyncStorage.setItem(STORAGE_KEYS.CITY_IMAGES, JSON.stringify(images));
      await writeDomainCache('admin', ADMIN_CACHE_KEYS.CITY_IMAGES, images);
      return images;
    },
    onSuccess: (data) => {
      setCityImages(data);
      queryClient.invalidateQueries({ queryKey: ['city_images'] });
    },
  });

  const saveManagedCitiesMutation = useMutation({
    mutationFn: async (cities: ManagedCity[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.MANAGED_CITIES, JSON.stringify(cities));
      await writeDomainCache('admin', ADMIN_CACHE_KEYS.MANAGED_CITIES, cities);
      return cities;
    },
    onSuccess: (data) => {
      setManagedCities(data);
      queryClient.invalidateQueries({ queryKey: ['managed_cities'] });
    },
  });

  const toggleAdmin = useCallback((val: boolean) => {
    setAdminMutation.mutate(val);
  }, [setAdminMutation]);

  const verifyAdminPin = useCallback(async (pin: string): Promise<boolean> => {
    console.log('[AdminProvider] Verifying admin PIN...');
    const storedHash = await AsyncStorage.getItem(STORAGE_KEYS.ADMIN_PIN_HASH);
    if (!storedHash) {
      console.log('[AdminProvider] No admin PIN set, setting initial PIN');
      const newHash = await hashPin(pin);
      await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_PIN_HASH, newHash);
      return true;
    }
    const isValid = await verifyPin(pin, storedHash);
    console.log('[AdminProvider] PIN verification result:', isValid);
    return isValid;
  }, []);

  const changeAdminPin = useCallback(async (currentPin: string, newPin: string): Promise<boolean> => {
    const storedHash = await AsyncStorage.getItem(STORAGE_KEYS.ADMIN_PIN_HASH);
    if (storedHash) {
      const isValid = await verifyPin(currentPin, storedHash);
      if (!isValid) return false;
    }
    const newHash = await hashPin(newPin);
    await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_PIN_HASH, newHash);
    console.log('[AdminProvider] Admin PIN changed successfully');
    return true;
  }, []);

  const hasAdminPin = useCallback(async (): Promise<boolean> => {
    const storedHash = await AsyncStorage.getItem(STORAGE_KEYS.ADMIN_PIN_HASH);
    return Boolean(storedHash);
  }, []);

  const addCouponBatch = useCallback((batch: CouponBatch) => {
    const updated = [...couponBatches, batch];
    saveCouponBatchesMutation.mutate(updated);
  }, [couponBatches, saveCouponBatchesMutation]);

  const addNotification = useCallback((notif: AdminNotification) => {
    const updated = [...notifications, notif];
    saveNotificationsMutation.mutate(updated);
  }, [notifications, saveNotificationsMutation]);

  const updateNotification = useCallback((notif: AdminNotification) => {
    const updated = notifications.map((n) => n.id === notif.id ? notif : n);
    saveNotificationsMutation.mutate(updated);
  }, [notifications, saveNotificationsMutation]);

  const deleteNotification = useCallback((id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    saveNotificationsMutation.mutate(updated);
  }, [notifications, saveNotificationsMutation]);

  const saveGrandPrize = useCallback((prize: GrandPrize) => {
    saveGrandPrizeMutation.mutate(prize);
  }, [saveGrandPrizeMutation]);

  const saveCityPrize = useCallback((city: string, prize: GrandPrize) => {
    const updated = { ...cityPrizes, [city]: prize };
    saveCityPrizesMutation.mutate(updated);
  }, [cityPrizes, saveCityPrizesMutation]);

  const getCityPrize = useCallback((city: string): GrandPrize | null => {
    return cityPrizes[city] ?? null;
  }, [cityPrizes]);

  const saveCityImage = useCallback((city: string, imageUrl: string) => {
    const updated = { ...cityImages, [city]: imageUrl };
    saveCityImagesMutation.mutate(updated);
  }, [cityImages, saveCityImagesMutation]);

  const getCityImage = useCallback((city: string): string | null => {
    return cityImages[city] ?? null;
  }, [cityImages]);

  const addManagedCity = useCallback((city: ManagedCity) => {
    const normalizedCity = city.city.trim().toLowerCase();
    const normalizedState = city.state.trim().toUpperCase();
    const exists = managedCities.some((c) => c.city.trim().toLowerCase() === normalizedCity && c.state.trim().toUpperCase() === normalizedState);
    if (exists) return;
    const updated = [...managedCities, city];
    saveManagedCitiesMutation.mutate(updated);
  }, [managedCities, saveManagedCitiesMutation]);

  const removeManagedCity = useCallback((cityId: string) => {
    const updated = managedCities.filter((c) => c.id !== cityId);
    saveManagedCitiesMutation.mutate(updated);
  }, [managedCities, saveManagedCitiesMutation]);

  const addPromoQR = useCallback((promo: PromotionalQR) => {
    const updated = [...promoQRCodes, promo];
    savePromoQRMutation.mutate(updated);
    console.log('[AdminProvider] Added promo QR:', promo.id, promo.sponsorName);
  }, [promoQRCodes, savePromoQRMutation]);

  const updatePromoQR = useCallback((promo: PromotionalQR) => {
    const updated = promoQRCodes.map((p) => p.id === promo.id ? promo : p);
    savePromoQRMutation.mutate(updated);
    console.log('[AdminProvider] Updated promo QR:', promo.id);
  }, [promoQRCodes, savePromoQRMutation]);

  const deletePromoQR = useCallback((id: string) => {
    const updated = promoQRCodes.filter((p) => p.id !== id);
    savePromoQRMutation.mutate(updated);
    console.log('[AdminProvider] Deleted promo QR:', id);
  }, [promoQRCodes, savePromoQRMutation]);

  const getPromoQRsByCity = useCallback((city: string): PromotionalQR[] => {
    return promoQRCodes.filter((p) => p.city === city);
  }, [promoQRCodes]);

  const seedDatabase = useCallback(async (): Promise<SeedResult> => {
    console.log('[AdminProvider] Seeding all data to Supabase...');
    const result = await seedAllToSupabase();
    console.log('[AdminProvider] Seed result:', result);
    queryClient.invalidateQueries({ queryKey: ['sponsors'] });
    queryClient.invalidateQueries({ queryKey: ['grand_prize_config'] });
    return result;
  }, [queryClient]);

  const checkTables = useCallback(async () => {
    return checkTablesExist();
  }, []);

  const getSetupSQL = useCallback(() => {
    return SETUP_SQL;
  }, []);

  const verifyIdentity = useCallback((userId: string, email: string, verified: boolean = true) => {
    const notification = notifications.find((n) => n.id === userId);
    if (notification) {
      updateNotification({
        ...notification,
        metadata: {
          ...notification.metadata,
          identityVerified: verified,
          verifiedAt: verified ? new Date().toISOString() : undefined,
          verificationStatus: verified ? 'verified' : 'pending',
        },
      });
      console.log(`[AdminProvider] Identity verification updated for ${email}: ${verified}`);
    }
  }, [notifications, updateNotification]);

  const getPendingIdentityVerifications = useCallback(() => {
    return notifications.filter((n) =>
      n.type === 'identity_verification' &&
      n.metadata?.verificationStatus !== 'verified'
    );
  }, [notifications]);

  return {
    isAdmin,
    toggleAdmin,
    verifyAdminPin,
    changeAdminPin,
    hasAdminPin,
    couponBatches,
    addCouponBatch,
    notifications,
    addNotification,
    updateNotification,
    deleteNotification,
    grandPrizeConfig,
    saveGrandPrize,
    cityPrizes,
    saveCityPrize,
    getCityPrize,
    cityImages,
    saveCityImage,
    getCityImage,
    seedDatabase,
    checkTables,
    getSetupSQL,
    fetchUsers: dbFetchAllUsers,
    verifyIdentity,
    getPendingIdentityVerifications,
    promoQRCodes,
    addPromoQR,
    updatePromoQR,
    deletePromoQR,
    getPromoQRsByCity,
    managedCities,
    addManagedCity,
    removeManagedCity,
  };
});
