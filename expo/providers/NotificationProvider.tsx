import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import * as Notifications from 'expo-notifications';

const STORAGE_KEYS = {
  PUSH_TOKEN: 'cashboxpix_push_token',
  NOTIF_ENABLED: 'cashboxpix_notif_enabled',
  SEEN_COUPONS: 'cashboxpix_seen_coupon_ids',
};

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') {
    console.log('[Notifications] Web platform, skipping push registration');
    return null;
  }

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Padrão',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1E3A8A',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('promos', {
        name: 'Promoções e Cupons',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#22C55E',
        sound: 'default',
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    console.log('[Notifications] Push token:', tokenData.data);
    return tokenData.data;
  } catch (err) {
    console.log('[Notifications] Error registering:', err);
    return null;
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channelId?: string,
) {
  if (Platform.OS === 'web') {
    console.log('[Notifications] Web: would show notification:', title, body);
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
        ...(Platform.OS === 'android' && channelId ? { channelId } : {}),
      },
      trigger: null,
    });
    console.log('[Notifications] Local notification sent:', title);
  } catch (err) {
    console.log('[Notifications] Error sending local notification:', err);
  }
}

export async function schedulePromoNotification(
  title: string,
  body: string,
  delaySeconds: number,
  data?: Record<string, unknown>,
) {
  if (Platform.OS === 'web') return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'promos' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delaySeconds,
      },
    });
    console.log('[Notifications] Scheduled notification in', delaySeconds, 's:', title);
  } catch (err) {
    console.log('[Notifications] Error scheduling notification:', err);
  }
}

export const [NotificationProvider, useNotifications] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const [lastNotification, setLastNotification] = useState<Notifications.Notification | null>(null);

  const tokenQuery = useQuery({
    queryKey: ['push_token'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
      return stored;
    },
  });

  const enabledQuery = useQuery({
    queryKey: ['notif_enabled'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.NOTIF_ENABLED);
      return stored === 'true';
    },
  });

  const seenCouponsQuery = useQuery({
    queryKey: ['seen_coupon_ids'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SEEN_COUPONS);
      return stored ? JSON.parse(stored) as string[] : [];
    },
  });

  useEffect(() => {
    if (tokenQuery.data) setPushToken(tokenQuery.data);
  }, [tokenQuery.data]);

  useEffect(() => {
    if (enabledQuery.data !== undefined) setNotificationsEnabled(enabledQuery.data);
  }, [enabledQuery.data]);

  const saveTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token);
      return token;
    },
    onSuccess: (data) => {
      setPushToken(data);
      queryClient.invalidateQueries({ queryKey: ['push_token'] });
    },
  });

  const saveEnabledMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIF_ENABLED, enabled.toString());
      return enabled;
    },
    onSuccess: (data) => {
      setNotificationsEnabled(data);
      queryClient.invalidateQueries({ queryKey: ['notif_enabled'] });
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
    if (Platform.OS === 'web') {
      setNotificationsEnabled(false);
      return;
    }

    const token = await registerForPushNotifications();
    if (token) {
      saveTokenMutation.mutate(token);
      saveEnabledMutation.mutate(true);
    }
  }, [saveTokenMutation, saveEnabledMutation]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    initNotifications();

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Notifications] Received:', notification.request.content.title);
      setLastNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[Notifications] User tapped:', response.notification.request.content.data);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  const notifyNewCoupon = useCallback(async (sponsorName: string, couponValue: number, couponId: string) => {
    const seen = seenCouponsQuery.data || [];
    if (seen.includes(couponId)) return;

    await sendLocalNotification(
      '🎉 Novo cupom resgatado!',
      `Você ganhou R$ ${couponValue.toFixed(2)} de ${sponsorName}! Confira na sua carteira.`,
      { type: 'coupon', couponId, sponsorName },
      'promos',
    );

    saveSeenCouponsMutation.mutate([...seen, couponId]);
  }, [seenCouponsQuery.data, saveSeenCouponsMutation]);

  const notifyNewPromo = useCallback(async (sponsorName: string, promoTitle: string, sponsorId: string) => {
    await sendLocalNotification(
      `🔥 Nova promoção de ${sponsorName}!`,
      promoTitle,
      { type: 'promo', sponsorId },
      'promos',
    );
  }, []);

  const notifyWithdraw = useCallback(async (amount: number) => {
    await sendLocalNotification(
      '💸 Saque solicitado!',
      `Seu saque de R$ ${amount.toFixed(2)} via PIX foi solicitado com sucesso.`,
      { type: 'withdraw' },
      'default',
    );
  }, []);

  const notifyPointsRedeemed = useCallback(async (value: number) => {
    await sendLocalNotification(
      '⭐ Pontos resgatados!',
      `Você converteu seus pontos em R$ ${value.toFixed(2)}. O valor já está no seu saldo!`,
      { type: 'points_redeemed' },
      'default',
    );
  }, []);

  const getBadgeCount = useCallback(async (): Promise<number> => {
    if (Platform.OS === 'web') return 0;
    try {
      return await Notifications.getBadgeCountAsync();
    } catch {
      return 0;
    }
  }, []);

  const clearBadge = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch (err) {
      console.log('[Notifications] Error clearing badge:', err);
    }
  }, []);

  return {
    pushToken,
    notificationsEnabled,
    lastNotification,
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
