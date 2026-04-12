import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';

const STORAGE_KEYS = {
  SEEN_COUPONS: 'cashboxpix_seen_coupon_ids',
};

export async function sendLocalNotification(
  title: string,
  body: string,
  _data?: Record<string, unknown>,
  _channelId?: string,
) {
  console.log('[Notifications] (disabled):', title, body);
}

export async function schedulePromoNotification(
  title: string,
  body: string,
  delaySeconds: number,
  _data?: Record<string, unknown>,
) {
  console.log('[Notifications] (disabled) schedule:', title, body, delaySeconds);
}

export const [NotificationProvider, useNotifications] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [pushToken] = useState<string | null>(null);
  const [notificationsEnabled] = useState<boolean>(false);

  const seenCouponsQuery = useQuery({
    queryKey: ['seen_coupon_ids'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SEEN_COUPONS);
      return stored ? JSON.parse(stored) as string[] : [];
    },
  });

  const saveSeenCouponsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.SEEN_COUPONS, JSON.stringify(ids));
      return ids;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seen_coupon_ids'] });
    },
  });

  const initNotifications = useCallback(async () => {
    console.log('[Notifications] Push notifications disabled');
  }, []);

  const notifyNewCoupon = useCallback(async (sponsorName: string, couponValue: number, couponId: string) => {
    const seen = seenCouponsQuery.data || [];
    if (seen.includes(couponId)) return;
    saveSeenCouponsMutation.mutate([...seen, couponId]);
    console.log('[Notifications] (disabled) New coupon:', sponsorName, couponValue);
  }, [seenCouponsQuery.data, saveSeenCouponsMutation]);

  const notifyNewPromo = useCallback(async (_sponsorName: string, _promoTitle: string, _sponsorId: string) => {
    console.log('[Notifications] (disabled) New promo');
  }, []);

  const notifyWithdraw = useCallback(async (_amount: number) => {
    console.log('[Notifications] (disabled) Withdraw');
  }, []);

  const notifyPointsRedeemed = useCallback(async (_value: number) => {
    console.log('[Notifications] (disabled) Points redeemed');
  }, []);

  const getBadgeCount = useCallback(async (): Promise<number> => {
    return 0;
  }, []);

  const clearBadge = useCallback(async () => {
    console.log('[Notifications] (disabled) Clear badge');
  }, []);

  return {
    pushToken,
    notificationsEnabled,
    lastNotification: null,
    initNotifications,
    notifyNewCoupon,
    notifyNewPromo,
    notifyWithdraw,
    notifyPointsRedeemed,
    getBadgeCount,
    clearBadge,
    sendLocalNotification,
    schedulePromoNotification,
  };
});
