import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { hashPassword, verifyPassword } from '@/lib/crypto';

interface AuthUser {
  email: string;
  passwordHash: string;
  createdAt: string;
}

interface AuthState {
  isLoggedIn: boolean;
  userEmail: string;
}

const AUTH_KEYS = {
  AUTH_STATE: 'cashboxpix_auth_state',
  REGISTERED_USERS: 'cashboxpix_registered_users',
  RECOVERY_CODES: 'cashboxpix_recovery_codes',
};

export const [AuthProvider, useAuth] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [isReady, setIsReady] = useState<boolean>(false);

  const authQuery = useQuery({
    queryKey: ['auth_state'],
    queryFn: async () => {
      console.log('[AuthProvider] Loading auth state...');
      const stored = await AsyncStorage.getItem(AUTH_KEYS.AUTH_STATE);
      if (stored) {
        const parsed = JSON.parse(stored) as AuthState;
        console.log('[AuthProvider] Found auth state:', parsed.userEmail);
        return parsed;
      }
      console.log('[AuthProvider] No auth state found');
      return null;
    },
  });

  useEffect(() => {
    if (authQuery.data !== undefined) {
      if (authQuery.data) {
        setIsLoggedIn(authQuery.data.isLoggedIn);
        setUserEmail(authQuery.data.userEmail);
      }
      setIsReady(true);
    }
  }, [authQuery.data]);

  const getUsers = useCallback(async (): Promise<AuthUser[]> => {
    const stored = await AsyncStorage.getItem(AUTH_KEYS.REGISTERED_USERS);
    return stored ? JSON.parse(stored) as AuthUser[] : [];
  }, []);

  const registerMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      console.log('[AuthProvider] Registering user:', email);
      const users = await getUsers();
      const exists = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (exists) {
        throw new Error('Este e-mail já está cadastrado');
      }
      const hashed = await hashPassword(password);
      const newUser: AuthUser = { email: email.toLowerCase(), passwordHash: hashed, createdAt: new Date().toISOString() };
      const updated = [...users, newUser];
      await AsyncStorage.setItem(AUTH_KEYS.REGISTERED_USERS, JSON.stringify(updated));
      const authState: AuthState = { isLoggedIn: true, userEmail: email.toLowerCase() };
      await AsyncStorage.setItem(AUTH_KEYS.AUTH_STATE, JSON.stringify(authState));
      return authState;
    },
    onSuccess: (data) => {
      setIsLoggedIn(true);
      setUserEmail(data.userEmail);
      queryClient.invalidateQueries({ queryKey: ['auth_state'] });
      console.log('[AuthProvider] Registration successful:', data.userEmail);
    },
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      console.log('[AuthProvider] Login attempt:', email);
      const users = await getUsers();
      const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        throw new Error('E-mail não encontrado');
      }
      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        throw new Error('Senha incorreta');
      }
      const authState: AuthState = { isLoggedIn: true, userEmail: email.toLowerCase() };
      await AsyncStorage.setItem(AUTH_KEYS.AUTH_STATE, JSON.stringify(authState));
      return authState;
    },
    onSuccess: (data) => {
      setIsLoggedIn(true);
      setUserEmail(data.userEmail);
      queryClient.invalidateQueries({ queryKey: ['auth_state'] });
      console.log('[AuthProvider] Login successful:', data.userEmail);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log('[AuthProvider] Logging out...');
      await AsyncStorage.removeItem(AUTH_KEYS.AUTH_STATE);
    },
    onSuccess: () => {
      setIsLoggedIn(false);
      setUserEmail('');
      queryClient.invalidateQueries({ queryKey: ['auth_state'] });
      console.log('[AuthProvider] Logout successful');
    },
  });

  const recoverPasswordMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      console.log('[AuthProvider] Password recovery for:', email);
      const users = await getUsers();
      const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        throw new Error('E-mail não encontrado no sistema');
      }
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const recoveryData = { email: email.toLowerCase(), code, createdAt: new Date().toISOString() };
      await AsyncStorage.setItem(AUTH_KEYS.RECOVERY_CODES, JSON.stringify(recoveryData));
      console.log('[AuthProvider] Recovery code generated:', code);
      return { email: email.toLowerCase(), code };
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ email, code, newPassword }: { email: string; code: string; newPassword: string }) => {
      console.log('[AuthProvider] Resetting password for:', email);
      const storedRecovery = await AsyncStorage.getItem(AUTH_KEYS.RECOVERY_CODES);
      if (!storedRecovery) {
        throw new Error('Código de recuperação expirado. Solicite um novo.');
      }
      const recovery = JSON.parse(storedRecovery);
      if (recovery.email !== email.toLowerCase() || recovery.code !== code) {
        throw new Error('Código de verificação inválido');
      }
      const createdAt = new Date(recovery.createdAt).getTime();
      if (Date.now() - createdAt > 10 * 60 * 1000) {
        throw new Error('Código expirado. Solicite um novo.');
      }
      const users = await getUsers();
      const newHash = await hashPassword(newPassword);
      const updated = users.map((u) =>
        u.email.toLowerCase() === email.toLowerCase() ? { ...u, passwordHash: newHash } : u
      );
      await AsyncStorage.setItem(AUTH_KEYS.REGISTERED_USERS, JSON.stringify(updated));
      await AsyncStorage.removeItem(AUTH_KEYS.RECOVERY_CODES);
      return { success: true };
    },
  });

  const login = useCallback((email: string, password: string) => {
    loginMutation.mutate({ email, password });
  }, [loginMutation]);

  const register = useCallback((email: string, password: string) => {
    registerMutation.mutate({ email, password });
  }, [registerMutation]);

  const logout = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  const recoverPassword = useCallback((email: string) => {
    recoverPasswordMutation.mutate({ email });
  }, [recoverPasswordMutation]);

  const resetPassword = useCallback((email: string, code: string, newPassword: string) => {
    resetPasswordMutation.mutate({ email, code, newPassword });
  }, [resetPasswordMutation]);

  return {
    isLoggedIn,
    isReady,
    userEmail,
    login,
    register,
    logout,
    recoverPassword,
    resetPassword,
    loginPending: loginMutation.isPending,
    loginError: loginMutation.error?.message ?? null,
    registerPending: registerMutation.isPending,
    registerError: registerMutation.error?.message ?? null,
    logoutPending: logoutMutation.isPending,
    recoverPending: recoverPasswordMutation.isPending,
    recoverError: recoverPasswordMutation.error?.message ?? null,
    recoverSuccess: recoverPasswordMutation.isSuccess,
    recoverData: recoverPasswordMutation.data ?? null,
    resetPending: resetPasswordMutation.isPending,
    resetError: resetPasswordMutation.error?.message ?? null,
    resetSuccess: resetPasswordMutation.isSuccess,
    resetLoginMutation: loginMutation,
    resetRecoverMutation: recoverPasswordMutation,
    resetResetMutation: resetPasswordMutation,
    resetRegisterMutation: registerMutation,
  };
});
