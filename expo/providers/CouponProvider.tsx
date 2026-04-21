import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Coupon, ScannedMessage, FederalLotteryResult } from '@/types';
import { readDomainCache, writeDomainCache } from '@/lib/stateCache';

type LotteryTicketStatus = 'pending' | 'still_competing' | 'not_won' | 'won_pending_claim' | 'claim_requested' | 'claim_confirmed';

export interface LotteryNumber {
  couponId: string;
  couponCode: string;
  lotteryCode: string;
  sponsorName: string;
  scannedAt: string;
  status: LotteryTicketStatus;
  checkedAt?: string;
  checkedDrawId?: string;
  prizeRank?: 1 | 2 | 3 | 4 | 5;
  expectedPrizeAmount?: number;
}

const DEFAULT_FEDERAL_RESULTS: FederalLotteryResult[] = [
  {
    id: 'federal_2026_04_11',
    contest: 'Concurso 5894',
    drawDate: '2026-04-11',
    prizeNumbers: ['12345', '67890', '54321', '11223', '99887'],
  },
  {
    id: 'federal_2026_04_08',
    contest: 'Concurso 5893',
    drawDate: '2026-04-08',
    prizeNumbers: ['44556', '77889', '99001', '23456', '70123'],
  },
  {
    id: 'federal_2026_04_04',
    contest: 'Concurso 5892',
    drawDate: '2026-04-04',
    prizeNumbers: ['33110', '88442', '55009', '66771', '99055'],
  },
];

function normalizeLotteryNumber(raw: unknown): LotteryNumber | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<LotteryNumber>;
  const couponId = typeof item.couponId === 'string' ? item.couponId : '';
  const lotteryCode = typeof item.lotteryCode === 'string' ? item.lotteryCode.replace(/\D/g, '').slice(0, 5) : '';
  if (!couponId || lotteryCode.length !== 5) return null;

  const validStatus: LotteryTicketStatus[] = ['pending', 'still_competing', 'not_won', 'won_pending_claim', 'claim_requested', 'claim_confirmed'];
  const status = validStatus.includes(item.status as LotteryTicketStatus)
    ? (item.status as LotteryTicketStatus)
    : 'pending';
  const expectedPrizeAmount = typeof item.expectedPrizeAmount === 'number' && Number.isFinite(item.expectedPrizeAmount)
    ? item.expectedPrizeAmount
    : undefined;
  const parsedRank = item.prizeRank;
  const prizeRank = parsedRank === 1 || parsedRank === 2 || parsedRank === 3 || parsedRank === 4 || parsedRank === 5
    ? parsedRank
    : undefined;

  return {
    couponId,
    couponCode: typeof item.couponCode === 'string' ? item.couponCode : lotteryCode,
    lotteryCode,
    sponsorName: typeof item.sponsorName === 'string' ? item.sponsorName : 'Cupom',
    scannedAt: typeof item.scannedAt === 'string' ? item.scannedAt : new Date().toISOString(),
    status,
    checkedAt: typeof item.checkedAt === 'string' ? item.checkedAt : undefined,
    checkedDrawId: typeof item.checkedDrawId === 'string' ? item.checkedDrawId : undefined,
    prizeRank,
    expectedPrizeAmount,
  };
}

const STORAGE_KEYS = {
  COUPONS: 'cashboxpix_coupons',
  SCANNED_MESSAGES: 'cashboxpix_scanned_messages',
  REDEEMED_CODES: 'cashboxpix_redeemed_codes',
  LOTTERY_NUMBERS: 'cashboxpix_lottery_numbers',
  LOTTERY_RESULTS: 'cashboxpix_lottery_results',
};

const COUPON_CACHE_TTL_MS = 1000 * 60 * 20;

const COUPON_CACHE_KEYS = {
  COUPONS: 'coupons',
  SCANNED_MESSAGES: 'scanned_messages',
  REDEEMED_CODES: 'redeemed_codes',
  LOTTERY_NUMBERS: 'lottery_numbers',
  LOTTERY_RESULTS: 'lottery_results',
} as const;

function isBatchGeneratedCoupon(coupon: Coupon): boolean {
  return typeof coupon.drawId === 'string' && coupon.drawId.startsWith('batch_');
}

export const [CouponProvider, useCoupon] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [scannedMessages, setScannedMessages] = useState<ScannedMessage[]>([]);
  const [redeemedCodes, setRedeemedCodes] = useState<string[]>([]);
  const [lotteryNumbers, setLotteryNumbers] = useState<LotteryNumber[]>([]);
  const [federalLotteryResults, setFederalLotteryResults] = useState<FederalLotteryResult[]>(DEFAULT_FEDERAL_RESULTS);

  const couponsQuery = useQuery({
    queryKey: ['user_coupons'],
    queryFn: async () => {
      const cached = await readDomainCache<Coupon[]>('coupon', COUPON_CACHE_KEYS.COUPONS, COUPON_CACHE_TTL_MS);
      if (cached) return cached;

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.COUPONS);
      const value = stored ? JSON.parse(stored) as Coupon[] : [];
      await writeDomainCache('coupon', COUPON_CACHE_KEYS.COUPONS, value);
      return value;
    },
  });

  const scannedMessagesQuery = useQuery({
    queryKey: ['scanned_messages'],
    queryFn: async () => {
      const cached = await readDomainCache<ScannedMessage[]>('coupon', COUPON_CACHE_KEYS.SCANNED_MESSAGES, COUPON_CACHE_TTL_MS);
      if (cached) return cached;

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SCANNED_MESSAGES);
      const value = stored ? JSON.parse(stored) as ScannedMessage[] : [];
      await writeDomainCache('coupon', COUPON_CACHE_KEYS.SCANNED_MESSAGES, value);
      return value;
    },
  });

  const lotteryNumbersQuery = useQuery({
    queryKey: ['lottery_numbers'],
    queryFn: async () => {
      const cached = await readDomainCache<LotteryNumber[]>('coupon', COUPON_CACHE_KEYS.LOTTERY_NUMBERS, COUPON_CACHE_TTL_MS);
      if (cached) return cached;

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.LOTTERY_NUMBERS);
      if (!stored) return [];
      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed)) return [];
      const value = parsed.map(normalizeLotteryNumber).filter((item): item is LotteryNumber => item !== null);
      await writeDomainCache('coupon', COUPON_CACHE_KEYS.LOTTERY_NUMBERS, value);
      return value;
    },
  });

  const federalResultsQuery = useQuery({
    queryKey: ['federal_lottery_results'],
    queryFn: async () => {
      const cached = await readDomainCache<FederalLotteryResult[]>('coupon', COUPON_CACHE_KEYS.LOTTERY_RESULTS, COUPON_CACHE_TTL_MS);
      if (cached && cached.length > 0) return cached;

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.LOTTERY_RESULTS);
      if (!stored) {
        await writeDomainCache('coupon', COUPON_CACHE_KEYS.LOTTERY_RESULTS, DEFAULT_FEDERAL_RESULTS);
        return DEFAULT_FEDERAL_RESULTS;
      }
      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed)) {
        await writeDomainCache('coupon', COUPON_CACHE_KEYS.LOTTERY_RESULTS, DEFAULT_FEDERAL_RESULTS);
        return DEFAULT_FEDERAL_RESULTS;
      }
      const valid = parsed
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const result = item as Partial<FederalLotteryResult>;
          if (!Array.isArray(result.prizeNumbers) || result.prizeNumbers.length !== 5) return null;
          const numbers = result.prizeNumbers.map((num) => (typeof num === 'string' ? num.replace(/\D/g, '').slice(0, 5) : ''));
          if (numbers.some((num) => num.length !== 5)) return null;
          return {
            id: typeof result.id === 'string' ? result.id : `federal_${Date.now()}`,
            contest: typeof result.contest === 'string' ? result.contest : 'Concurso',
            drawDate: typeof result.drawDate === 'string' ? result.drawDate : new Date().toISOString().slice(0, 10),
            prizeNumbers: [numbers[0], numbers[1], numbers[2], numbers[3], numbers[4]] as [string, string, string, string, string],
          } satisfies FederalLotteryResult;
        })
        .filter((item): item is FederalLotteryResult => item !== null);
      const value = valid.length > 0 ? valid.slice(0, 3) : DEFAULT_FEDERAL_RESULTS;
      await writeDomainCache('coupon', COUPON_CACHE_KEYS.LOTTERY_RESULTS, value);
      return value;
    },
  });

  const redeemedCodesQuery = useQuery({
    queryKey: ['redeemed_codes'],
    queryFn: async () => {
      const cached = await readDomainCache<string[]>('coupon', COUPON_CACHE_KEYS.REDEEMED_CODES, COUPON_CACHE_TTL_MS);
      if (cached) return cached;

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.REDEEMED_CODES);
      const value = stored ? JSON.parse(stored) as string[] : [];
      await writeDomainCache('coupon', COUPON_CACHE_KEYS.REDEEMED_CODES, value);
      return value;
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

  useEffect(() => {
    if (federalResultsQuery.data) setFederalLotteryResults(federalResultsQuery.data);
  }, [federalResultsQuery.data]);

  useEffect(() => {
    if (couponsQuery.data === undefined || lotteryNumbersQuery.data === undefined) return;

    const invalidCouponIds = coupons
      .filter((coupon) => isBatchGeneratedCoupon(coupon))
      .map((coupon) => coupon.id);

    if (invalidCouponIds.length === 0) return;

    const invalidCouponIdSet = new Set(invalidCouponIds);
    const sanitizedCoupons = coupons.filter((coupon) => !invalidCouponIdSet.has(coupon.id));
    const sanitizedLotteryNumbers = lotteryNumbers.filter((entry) => !invalidCouponIdSet.has(entry.couponId));

    setCoupons(sanitizedCoupons);
    setLotteryNumbers(sanitizedLotteryNumbers);
    void AsyncStorage.setItem(STORAGE_KEYS.COUPONS, JSON.stringify(sanitizedCoupons));
    void AsyncStorage.setItem(STORAGE_KEYS.LOTTERY_NUMBERS, JSON.stringify(sanitizedLotteryNumbers));
    void writeDomainCache('coupon', COUPON_CACHE_KEYS.COUPONS, sanitizedCoupons);
    void writeDomainCache('coupon', COUPON_CACHE_KEYS.LOTTERY_NUMBERS, sanitizedLotteryNumbers);
    console.log('[CouponProvider] Removed unscanned batch-generated tickets from wallet:', invalidCouponIds.length);
  }, [coupons, lotteryNumbers, couponsQuery.data, lotteryNumbersQuery.data]);

  const addCouponMutation = useMutation({
    mutationFn: async (coupon: Coupon) => {
      const updated = [...coupons, coupon];
      await AsyncStorage.setItem(STORAGE_KEYS.COUPONS, JSON.stringify(updated));
      await writeDomainCache('coupon', COUPON_CACHE_KEYS.COUPONS, updated);
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
      await writeDomainCache('coupon', COUPON_CACHE_KEYS.COUPONS, updated);
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
      await writeDomainCache('coupon', COUPON_CACHE_KEYS.SCANNED_MESSAGES, messages);
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
      await writeDomainCache('coupon', COUPON_CACHE_KEYS.REDEEMED_CODES, codes);
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
      await writeDomainCache('coupon', COUPON_CACHE_KEYS.LOTTERY_NUMBERS, numbers);
      return numbers;
    },
    onSuccess: (data) => {
      setLotteryNumbers(data);
      queryClient.invalidateQueries({ queryKey: ['lottery_numbers'] });
    },
  });

  const saveFederalResultsMutation = useMutation({
    mutationFn: async (results: FederalLotteryResult[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.LOTTERY_RESULTS, JSON.stringify(results.slice(0, 3)));
      const trimmed = results.slice(0, 3);
      await writeDomainCache('coupon', COUPON_CACHE_KEYS.LOTTERY_RESULTS, trimmed);
      return trimmed;
    },
    onSuccess: (data) => {
      setFederalLotteryResults(data);
      queryClient.invalidateQueries({ queryKey: ['federal_lottery_results'] });
    },
  });

  const extractLotteryCode = useCallback((code: string): string => {
    const parts = code.split('-');
    if (parts.length >= 3) return parts[parts.length - 1];
    if (code.length >= 5) return code.slice(-5);
    return code;
  }, []);

  const addCouponRaw = useCallback((coupon: Coupon) => {
    if (isBatchGeneratedCoupon(coupon)) {
      console.log('[CouponProvider] Ignoring batch-generated coupon before scan:', coupon.code);
      return;
    }

    addCouponMutation.mutate(coupon);
    const lotteryCode = extractLotteryCode(coupon.code);
    const entry: LotteryNumber = {
      couponId: coupon.id,
      couponCode: coupon.code,
      lotteryCode,
      sponsorName: coupon.sponsorName,
      scannedAt: coupon.scannedAt,
      status: 'pending',
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

  const clearNonWinningCheckedTickets = useCallback(() => {
    const updated = lotteryNumbers.filter((item) => item.status !== 'not_won');
    saveLotteryNumbersMutation.mutate(updated);
  }, [lotteryNumbers, saveLotteryNumbersMutation]);

  const editLotteryNumbers = useCallback((codes: string[]) => {
    console.log('[CouponProvider] Editing lottery numbers:', codes);
    const updated = codes.map((code) => {
      const existing = lotteryNumbers.find(ln => ln.lotteryCode === code);
      return existing || { couponId: `manual_${code}`, couponCode: code, lotteryCode: code, sponsorName: 'Manual', scannedAt: new Date().toISOString(), status: 'pending' as const };
    });
    saveLotteryNumbersMutation.mutate(updated);
  }, [lotteryNumbers, saveLotteryNumbersMutation]);

  const checkLotteryTicket = useCallback((ticketId: string, drawId: string, totalPrizeValue: number) => {
    const draw = federalLotteryResults.find((item) => item.id === drawId);
    if (!draw) {
      return { ok: false as const, reason: 'draw_not_found' as const };
    }

    const currentTicket = lotteryNumbers.find((item) => item.couponId === ticketId);
    if (!currentTicket) {
      return { ok: false as const, reason: 'ticket_not_found' as const };
    }

    const eligible = lotteryNumbers.filter((item) => (
      item.status === 'pending' ||
      item.status === 'still_competing' ||
      item.couponId === ticketId
    ));
    const winningTickets = eligible.filter((item) => draw.prizeNumbers.includes(item.lotteryCode));

    if (winningTickets.length === 0) {
      const updated = lotteryNumbers.map((item) => item.couponId === ticketId
        ? {
          ...item,
          status: 'still_competing' as const,
          checkedAt: new Date().toISOString(),
          checkedDrawId: drawId,
          prizeRank: undefined,
          expectedPrizeAmount: undefined,
        }
        : item);
      saveLotteryNumbersMutation.mutate(updated);
      return {
        ok: true as const,
        status: 'still_competing' as const,
        winnersCount: 0,
        prizeAmount: 0,
      };
    }

    const safePrize = Number.isFinite(totalPrizeValue) && totalPrizeValue > 0 ? totalPrizeValue : 0;
    const prizeAmount = winningTickets.length > 0 ? safePrize / winningTickets.length : 0;
    const updated = lotteryNumbers.map((item) => {
      const rankIndex = draw.prizeNumbers.findIndex((num) => num === item.lotteryCode);
      if (rankIndex >= 0) {
        return {
          ...item,
          status: item.status === 'claim_confirmed' ? 'claim_confirmed' : item.status === 'claim_requested' ? 'claim_requested' : 'won_pending_claim',
          checkedAt: new Date().toISOString(),
          checkedDrawId: drawId,
          prizeRank: (rankIndex + 1) as 1 | 2 | 3 | 4 | 5,
          expectedPrizeAmount: prizeAmount,
        };
      }

      if (item.status === 'pending' || item.status === 'still_competing') {
        return {
          ...item,
          status: 'not_won' as const,
          checkedAt: new Date().toISOString(),
          checkedDrawId: drawId,
          prizeRank: undefined,
          expectedPrizeAmount: undefined,
        };
      }

      return item;
    });

    const updatedTicket = updated.find((item) => item.couponId === ticketId);
    saveLotteryNumbersMutation.mutate(updated);
    return {
      ok: true as const,
      status: updatedTicket?.status ?? 'not_won',
      winnersCount: winningTickets.length,
      prizeAmount,
    };
  }, [federalLotteryResults, lotteryNumbers, saveLotteryNumbersMutation]);

  const requestPrizeClaim = useCallback((ticketId: string) => {
    const updated = lotteryNumbers.map((item) => item.couponId === ticketId
      ? {
        ...item,
        status: item.status === 'claim_confirmed' ? 'claim_confirmed' : 'claim_requested',
      }
      : item);
    saveLotteryNumbersMutation.mutate(updated);
  }, [lotteryNumbers, saveLotteryNumbersMutation]);

  const confirmPrizeClaim = useCallback((ticketId: string) => {
    const updated = lotteryNumbers.map((item) => item.couponId === ticketId
      ? {
        ...item,
        status: 'claim_confirmed' as const,
      }
      : item);
    saveLotteryNumbersMutation.mutate(updated);
  }, [lotteryNumbers, saveLotteryNumbersMutation]);

  const setLatestFederalResults = useCallback((results: FederalLotteryResult[]) => {
    if (results.length === 0) {
      saveFederalResultsMutation.mutate(DEFAULT_FEDERAL_RESULTS);
      return;
    }
    saveFederalResultsMutation.mutate(results.slice(0, 3));
  }, [saveFederalResultsMutation]);

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
    federalLotteryResults,
    setLatestFederalResults,
    checkLotteryTicket,
    requestPrizeClaim,
    confirmPrizeClaim,
    clearLotteryNumbers,
    clearNonWinningCheckedTickets,
    editLotteryNumbers,
    isLoading,
  };
});
