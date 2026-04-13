import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Coupon, ScannedMessage } from '@/types';

export interface LotteryNumber {
  couponId: string;
  couponCode: string;
  lotteryCode: string;
  sponsorName: string;
  scannedAt: string;
}

const STORAGE_KEYS = {
  COUPONS: 'cashboxpix_coupons',
  SCANNED_MESSAGES: 'cashboxpix_scanned_messages',
  REDEEMED_CODES: 'cashboxpix_redeemed_codes',
  LOTTERY_NUMBERS: 'cashboxpix_lottery_numbers',
};

export const [CouponProvider, useCoupon] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [scannedMessages, setScannedMessages] = useState<ScannedMessage[]>([]);
  const [redeemedCodes, setRedeemedCodes] = useState<string[]>([]);
  const [lotteryNumbers, setLotteryNumbers] = useState<LotteryNumber[]>([]);

  const couponsQuery = useQuery({
    queryKey: ['user_coupons'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.COUPONS);
      return stored ? JSON.parse(stored) as Coupon[] : [];
    },
  });

  const scannedMessagesQuery = useQuery({
    queryKey: ['scanned_messages'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SCANNED_MESSAGES);
      return stored ? JSON.parse(stored) as ScannedMessage[] : [];
    },
  });

  const lotteryNumbersQuery = useQuery({
    queryKey: ['lottery_numbers'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.LOTTERY_NUMBERS);
      return stored ? JSON.parse(stored) as LotteryNumber[] : [];
    },
  });

  const redeemedCodesQuery = useQuery({
    queryKey: ['redeemed_codes'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.REDEEMED_CODES);
      return stored ? JSON.parse(stored) as string[] : [];
    },
  });

  useEffect(() => {
    if (couponsQuery.data) setCoupons(couponsQuery.data);
  }, [couponsQuery.data]);

  useEffect(() => {
    if (scannedMessagesQuery.data) setScannedMessages(scannedMessagesQuery.data);
  }, [scannedMessagesQuery.data]);

  useEffect(() => {
    if (redeemedCodesQuery.data) setRedeemedCodes(redeemedCodesQuery.data);
  }, [redeemedCodesQuery.data]);

  useEffect(() => {
    if (lotteryNumbersQuery.data) setLotteryNumbers(lotteryNumbersQuery.data);
  }, [lotteryNumbersQuery.data]);

  const addCouponMutation = useMutation({
    mutationFn: async (coupon: Coupon) => {
      const updated = [...coupons, coupon];
      await AsyncStorage.setItem(STORAGE_KEYS.COUPONS, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      setCoupons(data);
      queryClient.invalidateQueries({ queryKey: ['user_coupons'] });
    },
  });

  const updateCouponStatusMutation = useMutation({
    mutationFn: async ({ couponId, status }: { couponId: string; status: Coupon['status'] }) => {
      const updated = coupons.map((c) => c.id === couponId ? { ...c, status } : c);
      await AsyncStorage.setItem(STORAGE_KEYS.COUPONS, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      setCoupons(data);
      queryClient.invalidateQueries({ queryKey: ['user_coupons'] });
    },
  });

  const saveScannedMessagesMutation = useMutation({
    mutationFn: async (messages: ScannedMessage[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.SCANNED_MESSAGES, JSON.stringify(messages));
      return messages;
    },
    onSuccess: (data) => {
      setScannedMessages(data);
      queryClient.invalidateQueries({ queryKey: ['scanned_messages'] });
    },
  });

  const saveRedeemedCodesMutation = useMutation({
    mutationFn: async (codes: string[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.REDEEMED_CODES, JSON.stringify(codes));
      return codes;
    },
    onSuccess: (data) => {
      setRedeemedCodes(data);
      queryClient.invalidateQueries({ queryKey: ['redeemed_codes'] });
    },
  });

  const saveLotteryNumbersMutation = useMutation({
    mutationFn: async (numbers: LotteryNumber[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.LOTTERY_NUMBERS, JSON.stringify(numbers));
      return numbers;
    },
    onSuccess: (data) => {
      setLotteryNumbers(data);
      queryClient.invalidateQueries({ queryKey: ['lottery_numbers'] });
    },
  });

  const extractLotteryCode = useCallback((code: string): string => {
    const parts = code.split('-');
    if (parts.length >= 3) return parts[parts.length - 1];
    if (code.length >= 5) return code.slice(-5);
    return code;
  }, []);

  const addCouponRaw = useCallback((coupon: Coupon) => {
    addCouponMutation.mutate(coupon);
    const lotteryCode = extractLotteryCode(coupon.code);
    const entry: LotteryNumber = {
      couponId: coupon.id,
      couponCode: coupon.code,
      lotteryCode,
      sponsorName: coupon.sponsorName,
      scannedAt: coupon.scannedAt,
    };
    const updated = [...lotteryNumbers, entry];
    saveLotteryNumbersMutation.mutate(updated);
    console.log('[CouponProvider] Lottery number added:', lotteryCode);
  }, [addCouponMutation, lotteryNumbers, saveLotteryNumbersMutation, extractLotteryCode]);

  const updateCouponStatus = useCallback((couponId: string, status: Coupon['status']) => {
    updateCouponStatusMutation.mutate({ couponId, status });
  }, [updateCouponStatusMutation]);

  const addScannedMessage = useCallback((msg: ScannedMessage) => {
    const updated = [msg, ...scannedMessages];
    saveScannedMessagesMutation.mutate(updated);
  }, [scannedMessages, saveScannedMessagesMutation]);

  const updateScannedMessageStatus = useCallback((msgId: string, status: ScannedMessage['status']) => {
    const updated = scannedMessages.map((m) => m.id === msgId ? { ...m, status } : m);
    saveScannedMessagesMutation.mutate(updated);
  }, [scannedMessages, saveScannedMessagesMutation]);

  const markCodeRedeemed = useCallback((code: string) => {
    console.log('[CouponProvider] Marking code as redeemed:', code);
    const updated = [...redeemedCodes, code];
    saveRedeemedCodesMutation.mutate(updated);
  }, [redeemedCodes, saveRedeemedCodesMutation]);

  const isCodeRedeemed = useCallback((code: string): boolean => {
    return redeemedCodes.includes(code);
  }, [redeemedCodes]);

  const validCoupons = useMemo(() => coupons.filter((c) => c.status === 'valid'), [coupons]);
  const usedCoupons = useMemo(() => coupons.filter((c) => c.status === 'used'), [coupons]);
  const expiredCoupons = useMemo(() => coupons.filter((c) => c.status === 'expired'), [coupons]);

  const couponsBySponsor = useMemo(() => {
    const map: Record<string, Coupon[]> = {};
    coupons.forEach((c) => {
      if (!map[c.sponsorId]) map[c.sponsorId] = [];
      map[c.sponsorId].push(c);
    });
    return map;
  }, [coupons]);

  const clearLotteryNumbers = useCallback(() => {
    console.log('[CouponProvider] Clearing lottery numbers after draw');
    saveLotteryNumbersMutation.mutate([]);
  }, [saveLotteryNumbersMutation]);

  const isLoading = couponsQuery.isLoading;

  return {
    coupons,
    validCoupons,
    usedCoupons,
    expiredCoupons,
    couponsBySponsor,
    addCouponRaw,
    updateCouponStatus,
    scannedMessages,
    addScannedMessage,
    updateScannedMessageStatus,
    redeemedCodes,
    markCodeRedeemed,
    isCodeRedeemed,
    lotteryNumbers,
    clearLotteryNumbers,
    isLoading,
  };
});
