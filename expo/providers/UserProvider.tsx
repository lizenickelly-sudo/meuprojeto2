import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { UserProfile, Transaction } from '@/types';
import { upsertUser as dbUpsertUser } from '@/services/database';
import { useAuth } from '@/providers/AuthProvider';

function getUserStorageKeys(email: string) {
  const prefix = email ? `cashboxpix_${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}` : 'cashboxpix_guest';
  return {
    USER_PROFILE: `${prefix}_user_profile`,
    TRANSACTIONS: `${prefix}_transactions`,
    BALANCE: `${prefix}_balance`,
    POINTS: `${prefix}_points`,
    REFERRAL_COUNT: `${prefix}_referral_count`,
  };
}

const POINTS_TO_CURRENCY_RATE = 0.1;
const MIN_REDEEM_VALUE = 5.0;

const defaultProfile: UserProfile = {
  id: '',
  name: '',
  cpf: '',
  phone: '',
  email: '',
  city: '',
  state: '',
  pixKey: '',
  pixKeyType: 'cpf',
  pixCpf: '',
  pixPhone: '',
  pixEmail: '',
  pixRandom: '',
  createdAt: new Date().toISOString(),
};

export const [UserProvider, useUser] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { userEmail, isLoggedIn } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [points, setPoints] = useState<number>(0);
  const [referralCount, setReferralCount] = useState<number>(0);
  const [prevEmail, setPrevEmail] = useState<string>('');

  const storageKeys = useMemo(() => getUserStorageKeys(userEmail), [userEmail]);

  useEffect(() => {
    if (userEmail !== prevEmail) {
      console.log('[UserProvider] User changed from', prevEmail, 'to', userEmail);
      setPrevEmail(userEmail);
      setProfile({ ...defaultProfile, email: userEmail });
      setTransactions([]);
      setBalance(0);
      setPoints(0);
      setReferralCount(0);
      queryClient.invalidateQueries({ queryKey: ['user_profile'] });
      queryClient.invalidateQueries({ queryKey: ['user_balance'] });
      queryClient.invalidateQueries({ queryKey: ['user_points'] });
      queryClient.invalidateQueries({ queryKey: ['user_transactions'] });
      queryClient.invalidateQueries({ queryKey: ['referral_count'] });
    }
  }, [userEmail, prevEmail, queryClient]);

  useEffect(() => {
    if (!isLoggedIn) {
      console.log('[UserProvider] User logged out, resetting state');
      setProfile({ ...defaultProfile });
      setTransactions([]);
      setBalance(0);
      setPoints(0);
      setReferralCount(0);
    }
  }, [isLoggedIn]);

  const profileQuery = useQuery({
    queryKey: ['user_profile', userEmail],
    queryFn: async () => {
      const keys = getUserStorageKeys(userEmail);
      console.log('[UserProvider] Loading profile for:', userEmail, 'key:', keys.USER_PROFILE);
      const stored = await AsyncStorage.getItem(keys.USER_PROFILE);
      if (stored) {
        const parsed = JSON.parse(stored) as UserProfile;
        console.log('[UserProvider] Found stored profile:', parsed.name);
        return parsed;
      }
      console.log('[UserProvider] No profile found, returning default');
      return { ...defaultProfile, email: userEmail };
    },
    enabled: !!userEmail && isLoggedIn,
  });

  const balanceQuery = useQuery({
    queryKey: ['user_balance', userEmail],
    queryFn: async () => {
      const keys = getUserStorageKeys(userEmail);
      const stored = await AsyncStorage.getItem(keys.BALANCE);
      return stored ? parseFloat(stored) : 0;
    },
    enabled: !!userEmail && isLoggedIn,
  });

  const pointsQuery = useQuery({
    queryKey: ['user_points', userEmail],
    queryFn: async () => {
      const keys = getUserStorageKeys(userEmail);
      const stored = await AsyncStorage.getItem(keys.POINTS);
      return stored ? parseInt(stored, 10) : 0;
    },
    enabled: !!userEmail && isLoggedIn,
  });

  const transactionsQuery = useQuery({
    queryKey: ['user_transactions', userEmail],
    queryFn: async () => {
      const keys = getUserStorageKeys(userEmail);
      const stored = await AsyncStorage.getItem(keys.TRANSACTIONS);
      return stored ? JSON.parse(stored) as Transaction[] : [];
    },
    enabled: !!userEmail && isLoggedIn,
  });

  const referralQuery = useQuery({
    queryKey: ['referral_count', userEmail],
    queryFn: async () => {
      const keys = getUserStorageKeys(userEmail);
      const stored = await AsyncStorage.getItem(keys.REFERRAL_COUNT);
      return stored ? parseInt(stored, 10) : 0;
    },
    enabled: !!userEmail && isLoggedIn,
  });

  useEffect(() => {
    if (profileQuery.data && userEmail) {
      const loaded = { ...profileQuery.data };
      if (loaded.email && loaded.email.toLowerCase() !== userEmail.toLowerCase()) {
        console.log('[UserProvider] Profile email mismatch, ignoring stale data');
        return;
      }
      if (!loaded.email) {
        loaded.email = userEmail;
      }
      setProfile(loaded);
    }
  }, [profileQuery.data, userEmail]);

  useEffect(() => {
    if (balanceQuery.data !== undefined) setBalance(balanceQuery.data);
  }, [balanceQuery.data]);

  useEffect(() => {
    if (pointsQuery.data !== undefined) setPoints(pointsQuery.data);
  }, [pointsQuery.data]);

  useEffect(() => {
    if (transactionsQuery.data) setTransactions(transactionsQuery.data);
  }, [transactionsQuery.data]);

  useEffect(() => {
    if (referralQuery.data !== undefined) setReferralCount(referralQuery.data);
  }, [referralQuery.data]);

  const saveProfileMutation = useMutation({
    mutationFn: async (newProfile: UserProfile) => {
      await AsyncStorage.setItem(storageKeys.USER_PROFILE, JSON.stringify(newProfile));
      return newProfile;
    },
    onSuccess: (data) => {
      setProfile(data);
      queryClient.invalidateQueries({ queryKey: ['user_profile', userEmail] });
      dbUpsertUser(data, balance, points).then((ok) => {
        if (ok) console.log('[UserProvider] User synced to Supabase:', data.name);
      });
    },
  });

  const addBalanceMutation = useMutation({
    mutationFn: async (amount: number) => {
      const newBalance = balance + amount;
      await AsyncStorage.setItem(storageKeys.BALANCE, newBalance.toString());
      return newBalance;
    },
    onSuccess: (data) => {
      setBalance(data);
      queryClient.invalidateQueries({ queryKey: ['user_balance', userEmail] });
    },
  });

  const addPointsMutation = useMutation({
    mutationFn: async (pts: number) => {
      const newPoints = points + pts;
      await AsyncStorage.setItem(storageKeys.POINTS, newPoints.toString());
      return newPoints;
    },
    onSuccess: (data) => {
      setPoints(data);
      queryClient.invalidateQueries({ queryKey: ['user_points', userEmail] });
    },
  });

  const addTransactionMutation = useMutation({
    mutationFn: async (tx: Transaction) => {
      const updated = [tx, ...transactions];
      await AsyncStorage.setItem(storageKeys.TRANSACTIONS, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      setTransactions(data);
      queryClient.invalidateQueries({ queryKey: ['user_transactions', userEmail] });
    },
  });

  const addReferralMutation = useMutation({
    mutationFn: async () => {
      const newCount = referralCount + 1;
      await AsyncStorage.setItem(storageKeys.REFERRAL_COUNT, newCount.toString());
      return newCount;
    },
    onSuccess: (data) => {
      setReferralCount(data);
      queryClient.invalidateQueries({ queryKey: ['referral_count', userEmail] });
    },
  });

  const redeemPointsMutation = useMutation({
    mutationFn: async () => {
      const pointsValue = points * POINTS_TO_CURRENCY_RATE;
      if (pointsValue < MIN_REDEEM_VALUE) {
        throw new Error(`Falta R$ ${(MIN_REDEEM_VALUE - pointsValue).toFixed(2)} para resgatar o valor`);
      }
      const newBalance = balance + pointsValue;
      await AsyncStorage.setItem(storageKeys.BALANCE, newBalance.toString());
      await AsyncStorage.setItem(storageKeys.POINTS, '0');
      const tx: Transaction = {
        id: `tx_pts_${Date.now()}`,
        type: 'credit',
        description: `Resgate de ${points} pontos`,
        amount: pointsValue,
        date: new Date().toISOString(),
        status: 'completed',
      };
      const updatedTx = [tx, ...transactions];
      await AsyncStorage.setItem(storageKeys.TRANSACTIONS, JSON.stringify(updatedTx));
      return { balance: newBalance, transactions: updatedTx };
    },
    onSuccess: (data) => {
      setBalance(data.balance);
      setPoints(0);
      setTransactions(data.transactions);
      queryClient.invalidateQueries({ queryKey: ['user_balance', userEmail] });
      queryClient.invalidateQueries({ queryKey: ['user_points', userEmail] });
      queryClient.invalidateQueries({ queryKey: ['user_transactions', userEmail] });
      console.log('[UserProvider] Points redeemed successfully, balance:', data.balance);
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (amount: number) => {
      if (amount > balance) throw new Error('Saldo insuficiente');
      if (!profile.pixKey) throw new Error('Cadastre sua chave PIX primeiro');
      const newBalance = balance - amount;
      await AsyncStorage.setItem(storageKeys.BALANCE, newBalance.toString());
      const tx: Transaction = {
        id: `tx_${Date.now()}`,
        type: 'debit',
        description: `Saque PIX - ${profile.pixKey}`,
        amount,
        date: new Date().toISOString(),
        status: 'pending',
      };
      const updatedTx = [tx, ...transactions];
      await AsyncStorage.setItem(storageKeys.TRANSACTIONS, JSON.stringify(updatedTx));
      return { balance: newBalance, transactions: updatedTx };
    },
    onSuccess: (data) => {
      setBalance(data.balance);
      setTransactions(data.transactions);
      queryClient.invalidateQueries({ queryKey: ['user_balance', userEmail] });
      queryClient.invalidateQueries({ queryKey: ['user_transactions', userEmail] });
    },
  });

  const saveProfile = useCallback((p: UserProfile) => {
    saveProfileMutation.mutate(p);
  }, [saveProfileMutation]);

  const addBalance = useCallback((amount: number) => {
    addBalanceMutation.mutate(amount);
  }, [addBalanceMutation]);

  const addPoints = useCallback((pts: number) => {
    addPointsMutation.mutate(pts);
  }, [addPointsMutation]);

  const addTransaction = useCallback((tx: Transaction) => {
    addTransactionMutation.mutate(tx);
  }, [addTransactionMutation]);

  const withdraw = useCallback((amount: number) => {
    withdrawMutation.mutate(amount);
  }, [withdrawMutation]);

  const addReferral = useCallback(() => {
    addReferralMutation.mutate();
    addPointsMutation.mutate(50);
  }, [addReferralMutation, addPointsMutation]);

  const redeemPoints = useCallback(() => {
    redeemPointsMutation.mutate();
  }, [redeemPointsMutation]);

  const getPointsValue = useCallback(() => {
    return points * POINTS_TO_CURRENCY_RATE;
  }, [points]);

  const getPointsRedeemInfo = useCallback(() => {
    const currentValue = points * POINTS_TO_CURRENCY_RATE;
    const canRedeem = currentValue >= MIN_REDEEM_VALUE;
    const remaining = Math.max(0, MIN_REDEEM_VALUE - currentValue);
    return { currentValue, canRedeem, remaining, minValue: MIN_REDEEM_VALUE };
  }, [points]);

  const getReferralCode = useCallback(() => {
    if (profile.referralCode) return profile.referralCode;
    const code = `CBX${profile.name.replace(/\s/g, '').substring(0, 4).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;
    saveProfileMutation.mutate({ ...profile, referralCode: code });
    return code;
  }, [profile, saveProfileMutation]);

  const isLoading = profileQuery.isLoading || balanceQuery.isLoading;

  return {
    profile,
    balance,
    points,
    transactions,
    isLoading,
    saveProfile,
    addBalance,
    addPoints,
    addTransaction,
    withdraw,
    withdrawPending: withdrawMutation.isPending,
    referralCount,
    addReferral,
    getReferralCode,
    redeemPoints,
    redeemPointsPending: redeemPointsMutation.isPending,
    redeemPointsError: redeemPointsMutation.error?.message ?? null,
    getPointsValue,
    getPointsRedeemInfo,
  };
});
