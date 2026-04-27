import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { CouponBatch, AdminNotification, GrandPrize, PromotionalQR, ManagedCity } from '@/types';
import { hashPin, verifyPin } from '@/lib/crypto';
import { invalidateDomainKey, readDomainCache, writeDomainCache } from '@/lib/stateCache';
import { hasSupabaseConfig, supabase } from '@/lib/supabase';
import {
  fetchAppState as dbFetchAppState,
  saveAppState as dbSaveAppState,
  fetchCouponBatches as dbFetchCouponBatches,
  syncCouponBatches as dbSyncCouponBatches,
  fetchCityPrizes as dbFetchCityPrizes,
  syncCityPrizes as dbSyncCityPrizes,
  fetchManagedCities as dbFetchManagedCities,
  fetchPromoQRCodes as dbFetchPromoQRCodes,
  syncManagedCities as dbSyncManagedCities,
  syncPromoQRCodes as dbSyncPromoQRCodes,
  seedAllToSupabase,
  checkTablesExist,
  getSetupSql,
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

type AdminCacheKey = (typeof ADMIN_CACHE_KEYS)[keyof typeof ADMIN_CACHE_KEYS];

function normalizeLocationText(value?: string | null): string {
  if (!value) return '';

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

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

  const loadRemoteAdminState = useCallback(
    async function <T>(storageKey: string, cacheKey: AdminCacheKey, emptyValue: T): Promise<T> {
      const remote = await dbFetchAppState<T>(cacheKey);
      if (remote !== null && remote !== undefined) {
        await AsyncStorage.setItem(storageKey, JSON.stringify(remote));
        await writeDomainCache('admin', cacheKey, remote);
        return remote;
      }

      await AsyncStorage.removeItem(storageKey);
      await invalidateDomainKey('admin', cacheKey);
      return emptyValue;
    },
    [],
  );

  const persistRemoteAdminState = useCallback(
    async function <T>(storageKey: string, cacheKey: AdminCacheKey, value: T): Promise<T> {
      const saved = await dbSaveAppState(cacheKey, value);
      if (!saved) {
        throw new Error(`Failed to persist admin state for ${cacheKey}`);
      }

      await AsyncStorage.setItem(storageKey, JSON.stringify(value));
      await writeDomainCache('admin', cacheKey, value);
      return value;
    },
    [],
  );

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
      const remote = await dbFetchCouponBatches();
      if (remote.length > 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.COUPON_BATCHES, JSON.stringify(remote));
        await writeDomainCache('admin', ADMIN_CACHE_KEYS.COUPON_BATCHES, remote);
        return remote;
      }

      await AsyncStorage.removeItem(STORAGE_KEYS.COUPON_BATCHES);
      await invalidateDomainKey('admin', ADMIN_CACHE_KEYS.COUPON_BATCHES);
      return [];
    },
  });

  const notificationsQuery = useQuery({
    queryKey: ['admin_notifications'],
    queryFn: () => loadRemoteAdminState<AdminNotification[]>(STORAGE_KEYS.NOTIFICATIONS, ADMIN_CACHE_KEYS.NOTIFICATIONS, []),
  });

  const grandPrizeQuery = useQuery({
    queryKey: ['grand_prize_config'],
    queryFn: () => loadRemoteAdminState<GrandPrize | null>(STORAGE_KEYS.GRAND_PRIZE, ADMIN_CACHE_KEYS.GRAND_PRIZE, null),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const cityPrizesQuery = useQuery({
    queryKey: ['city_prizes'],
    queryFn: async () => {
      const remote = await dbFetchCityPrizes();
      if (Object.keys(remote).length > 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.CITY_PRIZES, JSON.stringify(remote));
        await writeDomainCache('admin', ADMIN_CACHE_KEYS.CITY_PRIZES, remote);
        return remote;
      }

      await AsyncStorage.removeItem(STORAGE_KEYS.CITY_PRIZES);
      await invalidateDomainKey('admin', ADMIN_CACHE_KEYS.CITY_PRIZES);
      return {};
    },
  });

  const cityImagesQuery = useQuery({
    queryKey: ['city_images'],
    queryFn: () => loadRemoteAdminState<Record<string, string>>(STORAGE_KEYS.CITY_IMAGES, ADMIN_CACHE_KEYS.CITY_IMAGES, {}),
  });

  const managedCitiesQuery = useQuery({
    queryKey: ['managed_cities'],
    queryFn: async () => {
      const remote = await dbFetchManagedCities();
      if (remote.length > 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.MANAGED_CITIES, JSON.stringify(remote));
        await writeDomainCache('admin', ADMIN_CACHE_KEYS.MANAGED_CITIES, remote);
        return remote;
      }

      await AsyncStorage.removeItem(STORAGE_KEYS.MANAGED_CITIES);
      await invalidateDomainKey('admin', ADMIN_CACHE_KEYS.MANAGED_CITIES);
      return [];
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
    const nextImages = { ...(cityImagesQuery.data ?? {}) };
    managedCities.forEach((city) => {
      const imageUrl = city.imageUrl?.trim();
      if (imageUrl) {
        nextImages[city.city] = imageUrl;
      }
    });
    setCityImages(nextImages);
  }, [cityImagesQuery.data, managedCities]);

  useEffect(() => {
    if (managedCitiesQuery.data) setManagedCities(managedCitiesQuery.data);
  }, [managedCitiesQuery.data]);

  const promoQRQuery = useQuery({
    queryKey: ['promo_qrcodes'],
    queryFn: async () => {
      const remote = await dbFetchPromoQRCodes();
      if (remote.length > 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.PROMO_QR_CODES, JSON.stringify(remote));
        await writeDomainCache('admin', ADMIN_CACHE_KEYS.PROMO_QR_CODES, remote);
        return remote;
      }

      await AsyncStorage.removeItem(STORAGE_KEYS.PROMO_QR_CODES);
      await invalidateDomainKey('admin', ADMIN_CACHE_KEYS.PROMO_QR_CODES);
      return [];
    },
  });

  useEffect(() => {
    if (promoQRQuery.data) setPromoQRCodes(promoQRQuery.data);
  }, [promoQRQuery.data]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;

      console.log('[AdminProvider] App resumed - refreshing notifications for map state');
      queryClient.refetchQueries({ queryKey: ['admin_notifications'], exact: true });
    });

    return () => subscription.remove();
  }, [queryClient]);

  useEffect(() => {
    if (!hasSupabaseConfig) return;

    const channel = supabase
      .channel('admin-notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_state',
          filter: 'key=eq.notifications',
        },
        () => {
          console.log('[AdminProvider] Notifications changed in Supabase, refreshing admin notifications');
          queryClient.refetchQueries({ queryKey: ['admin_notifications'], exact: true });
        },
      )
      .subscribe((status) => {
        console.log('[AdminProvider] Notifications realtime status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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
      const saved = await dbSyncCouponBatches(batches);
      if (!saved) {
        throw new Error('Failed to persist coupon batches in the server');
      }

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
    mutationFn: (notifs: AdminNotification[]) => persistRemoteAdminState(STORAGE_KEYS.NOTIFICATIONS, ADMIN_CACHE_KEYS.NOTIFICATIONS, notifs),
    onSuccess: (data) => {
      setNotifications(data);
      queryClient.invalidateQueries({ queryKey: ['admin_notifications'] });
    },
  });

  const saveGrandPrizeMutation = useMutation({
    mutationFn: (prize: GrandPrize) => persistRemoteAdminState(STORAGE_KEYS.GRAND_PRIZE, ADMIN_CACHE_KEYS.GRAND_PRIZE, prize),
    onSuccess: (data) => {
      setGrandPrizeConfig(data);
      queryClient.invalidateQueries({ queryKey: ['grand_prize_config'] });
    },
  });

  const saveCityPrizesMutation = useMutation({
    mutationFn: async (prizes: Record<string, GrandPrize>) => {
      const saved = await dbSyncCityPrizes(prizes);
      if (!saved) {
        throw new Error('Failed to persist city prizes in the server');
      }

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
      const saved = await dbSyncPromoQRCodes(codes);
      if (!saved) {
        throw new Error('Failed to persist promo QR codes in the server');
      }

      await AsyncStorage.setItem(STORAGE_KEYS.PROMO_QR_CODES, JSON.stringify(codes));
      await writeDomainCache('admin', ADMIN_CACHE_KEYS.PROMO_QR_CODES, codes);
      return codes;
    },
    onSuccess: (data) => {
      setPromoQRCodes(data);
      queryClient.invalidateQueries({ queryKey: ['promo_qrcodes'] });
    },
  });

  const saveManagedCitiesMutation = useMutation({
    mutationFn: async (cities: ManagedCity[]) => {
      const saved = await dbSyncManagedCities(cities);
      if (!saved) {
        throw new Error('Failed to persist managed cities in the server');
      }

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

  const saveCityPrize = useCallback(async (city: string, prize: GrandPrize) => {
    const updated = { ...cityPrizes, [city]: prize };
    await saveCityPrizesMutation.mutateAsync(updated);
  }, [cityPrizes, saveCityPrizesMutation]);

  const getCityPrize = useCallback((city: string): GrandPrize | null => {
    return cityPrizes[city] ?? null;
  }, [cityPrizes]);

  const saveCityImage = useCallback(async (cityName: string, imageUrl: string, state?: string) => {
    const normalizedCity = cityName.trim().toLowerCase();
    const normalizedState = state?.trim().toUpperCase();
    const existingCity = managedCities.find((city) => (
      city.city.trim().toLowerCase() === normalizedCity
      && (!normalizedState || city.state.trim().toUpperCase() === normalizedState)
    ));

    const nextCity: ManagedCity = existingCity
      ? {
        ...existingCity,
        state: normalizedState || existingCity.state,
        imageUrl,
      }
      : {
        id: `city_${Date.now()}`,
        city: cityName.trim(),
        state: normalizedState || '',
        imageUrl,
        createdAt: new Date().toISOString(),
      };

    const updatedCities = existingCity
      ? managedCities.map((city) => (city.id === existingCity.id ? nextCity : city))
      : [...managedCities, nextCity];

    await saveManagedCitiesMutation.mutateAsync(updatedCities);
  }, [managedCities, saveManagedCitiesMutation]);

  const getCityImage = useCallback((city: string, state?: string): string | null => {
    const trimmedCity = city.trim();
    const normalizedCity = normalizeLocationText(trimmedCity);
    const normalizedState = normalizeLocationText(state);
    if (!normalizedCity) return null;

    const exactManagedCity = managedCities.find((managedCity) => {
      if (normalizeLocationText(managedCity.city) !== normalizedCity) return false;
      if (!managedCity.imageUrl?.trim()) return false;
      if (!normalizedState) return true;
      return normalizeLocationText(managedCity.state) === normalizedState;
    });
    if (exactManagedCity?.imageUrl?.trim()) {
      return exactManagedCity.imageUrl.trim();
    }

    const stateAgnosticManagedCity = managedCities.find((managedCity) => {
      return normalizeLocationText(managedCity.city) === normalizedCity
        && !normalizeLocationText(managedCity.state)
        && Boolean(managedCity.imageUrl?.trim());
    });
    if (stateAgnosticManagedCity?.imageUrl?.trim()) {
      return stateAgnosticManagedCity.imageUrl.trim();
    }

    const directImage = cityImages[trimmedCity]?.trim();
    if (directImage) {
      return directImage;
    }

    const normalizedImageEntry = Object.entries(cityImages).find(([key, imageUrl]) => {
      return normalizeLocationText(key) === normalizedCity && Boolean(imageUrl?.trim());
    });
    if (normalizedImageEntry?.[1]?.trim()) {
      return normalizedImageEntry[1].trim();
    }

    const cityOnlyManagedCity = managedCities.find((managedCity) => {
      return normalizeLocationText(managedCity.city) === normalizedCity && Boolean(managedCity.imageUrl?.trim());
    });

    return cityOnlyManagedCity?.imageUrl?.trim() ?? null;
  }, [cityImages, managedCities]);

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

  const refreshManagedCities = useCallback(async () => {
    await invalidateDomainKey('admin', ADMIN_CACHE_KEYS.MANAGED_CITIES);
    await queryClient.refetchQueries({ queryKey: ['managed_cities'], exact: true });
  }, [queryClient]);

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
    return getSetupSql();
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
    refreshManagedCities,
  };
});
