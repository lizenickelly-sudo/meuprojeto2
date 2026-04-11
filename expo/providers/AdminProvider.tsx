import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { CouponBatch, AdminNotification, GrandPrize, PromotionalQR } from '@/types';
import { hashPin, verifyPin } from '@/lib/crypto';
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
};

export const [AdminProvider, useAdmin] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [couponBatches, setCouponBatches] = useState<CouponBatch[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [grandPrizeConfig, setGrandPrizeConfig] = useState<GrandPrize | null>(null);
  const [cityPrizes, setCityPrizes] = useState<Record<string, GrandPrize>>({});
  const [cityImages, setCityImages] = useState<Record<string, string>>({});
  const [promoQRCodes, setPromoQRCodes] = useState<PromotionalQR[]>([]);

  const adminQuery = useQuery({
    queryKey: ['is_admin'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.IS_ADMIN);
      return stored === 'true';
    },
  });

  const couponBatchesQuery = useQuery({
    queryKey: ['coupon_batches'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.COUPON_BATCHES);
      return stored ? JSON.parse(stored) as CouponBatch[] : [];
    },
  });

  const notificationsQuery = useQuery({
    queryKey: ['admin_notifications'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      return stored ? JSON.parse(stored) as AdminNotification[] : [];
    },
  });

  const grandPrizeQuery = useQuery({
    queryKey: ['grand_prize_config'],
    queryFn: async () => {
      console.log('[AdminProvider] Fetching grand prize from Supabase...');
      const result = await dbFetchGrandPrize();
      console.log('[AdminProvider] Got grand prize:', result.title);
      return result;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const cityPrizesQuery = useQuery({
    queryKey: ['city_prizes'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CITY_PRIZES);
      return stored ? JSON.parse(stored) as Record<string, GrandPrize> : {};
    },
  });

  const cityImagesQuery = useQuery({
    queryKey: ['city_images'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.CITY_IMAGES);
      return stored ? JSON.parse(stored) as Record<string, string> : {};
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

  const promoQRQuery = useQuery({
    queryKey: ['promo_qrcodes'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PROMO_QR_CODES);
      return stored ? JSON.parse(stored) as PromotionalQR[] : [];
    },
  });

  useEffect(() => {
    if (promoQRQuery.data) setPromoQRCodes(promoQRQuery.data);
  }, [promoQRQuery.data]);

  const setAdminMutation = useMutation({
    mutationFn: async (val: boolean) => {
      await AsyncStorage.setItem(STORAGE_KEYS.IS_ADMIN, val.toString());
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
      return images;
    },
    onSuccess: (data) => {
      setCityImages(data);
      queryClient.invalidateQueries({ queryKey: ['city_images'] });
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
    promoQRCodes,
    addPromoQR,
    updatePromoQR,
    deletePromoQR,
    getPromoQRsByCity,
  };
});
