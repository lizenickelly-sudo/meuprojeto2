import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { hashPassword, verifyPassword } from '@/lib/crypto';
import { supabase } from '@/lib/supabase';

interface AuthUser {
  email: string;
  passwordHash: string;
  supabaseUserId?: string;
  createdAt: string;
}

interface AuthState {
  isLoggedIn: boolean;
  userEmail: string;
  supabaseUserId?: string;
}

const AUTH_KEYS = {
  AUTH_STATE: 'cashboxpix_auth_state',
  REGISTERED_USERS: 'cashboxpix_registered_users',
  RECOVERY_CODES: 'cashboxpix_recovery_codes',
};

const HAS_REMOTE_AUTH = Boolean(
  (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim() &&
  ((process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY || '').trim())
);

export const [AuthProvider, useAuth] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [supabaseUserId, setSupabaseUserId] = useState<string>('');
  const [isReady, setIsReady] = useState<boolean>(false);
  const [resetEpoch, setResetEpoch] = useState<number>(0);

  const authQuery = useQuery({
    queryKey: ['auth_state'],
    queryFn: async () => {
      console.log('[AuthProvider] Loading auth state...');
      const stored = await AsyncStorage.getItem(AUTH_KEYS.AUTH_STATE);
      if (stored) {
        const parsed = JSON.parse(stored) as AuthState;
        console.log('[AuthProvider] Found auth state:', parsed.userEmail);

        // If the profile row was deleted from Supabase, force logout locally.
        if (parsed.isLoggedIn && parsed.userEmail) {
          try {
            const normalizedEmail = parsed.userEmail.trim().toLowerCase();
            const { data: sessionData } = await supabase.auth.getSession();
            const sessionUser = sessionData.session?.user;

            // When Supabase is configured, require a real session instead of stale local auth state.
            if (!sessionUser && HAS_REMOTE_AUTH) {
              console.log('[AuthProvider] Missing Supabase session for logged-in state, clearing local auth:', normalizedEmail);
              await AsyncStorage.removeItem(AUTH_KEYS.AUTH_STATE);
              return null;
            }

            if (!sessionUser) {
              return parsed;
            }

            // If there is an active Supabase session matching this auth state, keep it.
            if (
              sessionUser &&
              (
                (parsed.supabaseUserId && sessionUser.id === parsed.supabaseUserId) ||
                (sessionUser.email && sessionUser.email.trim().toLowerCase() === normalizedEmail)
              )
            ) {
              return parsed;
            }

            const { data, error } = await supabase
              .from('users')
              .select('email,auth_user_id')
              .eq('email', normalizedEmail)
              .limit(1);

            let exists = Array.isArray(data) && data.length > 0;

            // Extra safety: if email lookup misses, try by auth_user_id.
            if (!exists && !error && parsed.supabaseUserId) {
              const { data: byAuthData, error: byAuthError } = await supabase
                .from('users')
                .select('email,auth_user_id')
                .eq('auth_user_id', parsed.supabaseUserId)
                .limit(1);
              if (!byAuthError && Array.isArray(byAuthData) && byAuthData.length > 0) {
                exists = true;
              }
            }

            // Force logout only when session exists and row is confirmed absent.
            if (!error && !exists) {
              console.log('[AuthProvider] User removed from Supabase, clearing auth state:', normalizedEmail);
              await supabase.auth.signOut();
              await AsyncStorage.removeItem(AUTH_KEYS.AUTH_STATE);
              return null;
            }
          } catch (error) {
            console.log('[AuthProvider] Remote auth validation fallback to local state:', error);
          }
        }

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
        setSupabaseUserId(authQuery.data.supabaseUserId || '');
      } else {
        setIsLoggedIn(false);
        setUserEmail('');
        setSupabaseUserId('');
      }
      setIsReady(true);
    }
  }, [authQuery.data]);

  const getUsers = useCallback(async (): Promise<AuthUser[]> => {
    const stored = await AsyncStorage.getItem(AUTH_KEYS.REGISTERED_USERS);
    return stored ? JSON.parse(stored) as AuthUser[] : [];
  }, []);

  const ensureRemoteUserRow = useCallback(async (email: string, authUserId?: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    try {
      const now = new Date().toISOString();
      await supabase
        .from('users')
        .upsert({
          email: normalizedEmail,
          auth_user_id: authUserId || null,
          profile: {
            email: normalizedEmail,
            authUserId: authUserId || '',
          },
          updated_at: now,
          created_at: now,
        }, {
          onConflict: 'email',
        });
    } catch (error) {
      console.log('[AuthProvider] ensureRemoteUserRow fallback:', error);
    }
  }, []);

  const registerMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const normalizedEmail = email.toLowerCase();
      console.log('[AuthProvider] Registering user:', normalizedEmail);
      const users = await getUsers();
      const existingLocalUser = users.find((u) => u.email.toLowerCase() === normalizedEmail);

      let remoteUserId = '';
      let remoteSignUpSucceeded = false;
      let remoteAlreadyRegistered = false;
      try {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
        });
        if (!error) {
          remoteUserId = data.user?.id || '';
          remoteSignUpSucceeded = true;
        } else {
          if (/already registered|already exists|user already/i.test(error.message)) {
            remoteAlreadyRegistered = true;
          }
          console.log('[AuthProvider] Supabase signUp fallback:', error.message);
        }
      } catch (error) {
        console.log('[AuthProvider] Supabase signUp exception:', error);
      }

      if (HAS_REMOTE_AUTH && !remoteSignUpSucceeded) {
        if (remoteAlreadyRegistered) {
          throw new Error('Este e-mail ja esta cadastrado. Tente entrar ou recuperar a senha.');
        }
        throw new Error('Nao foi possivel criar conta agora. Tente novamente em instantes.');
      }

      if (remoteAlreadyRegistered || (!remoteSignUpSucceeded && existingLocalUser)) {
        throw new Error('Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.');
      }

      const hashed = await hashPassword(password);
      const newUser: AuthUser = {
        email: normalizedEmail,
        passwordHash: hashed,
        supabaseUserId: remoteUserId || existingLocalUser?.supabaseUserId,
        createdAt: existingLocalUser?.createdAt || new Date().toISOString(),
      };

      const updated = existingLocalUser
        ? users.map((u) => (u.email.toLowerCase() === normalizedEmail ? newUser : u))
        : [...users, newUser];

      await AsyncStorage.setItem(AUTH_KEYS.REGISTERED_USERS, JSON.stringify(updated));

      if (remoteSignUpSucceeded) {
        await ensureRemoteUserRow(normalizedEmail, remoteUserId);
      }

      const authState: AuthState = {
        isLoggedIn: true,
        userEmail: normalizedEmail,
        supabaseUserId: remoteUserId,
      };
      await AsyncStorage.setItem(AUTH_KEYS.AUTH_STATE, JSON.stringify(authState));
      return authState;
    },
    onSuccess: (data) => {
      setIsLoggedIn(true);
      setUserEmail(data.userEmail);
      setSupabaseUserId(data.supabaseUserId || '');
      queryClient.invalidateQueries({ queryKey: ['auth_state'] });
      console.log('[AuthProvider] Registration successful:', data.userEmail);
    },
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const normalizedEmail = email.toLowerCase();
      console.log('[AuthProvider] Login attempt:', normalizedEmail);
      const users = await getUsers();
      const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

      let remoteUserId = user?.supabaseUserId || '';
      let remoteAuthSucceeded = false;
      let remoteAuthErrorMessage = '';
      const isInvalidCredentialsError = (msg: string) => /invalid login credentials|invalid credentials/i.test(msg);
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (!error) {
          remoteUserId = data.user?.id || remoteUserId;
          remoteAuthSucceeded = true;

          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session?.user) {
            remoteAuthSucceeded = false;
            remoteAuthErrorMessage = 'session-not-created';
          }
        } else {
          remoteAuthErrorMessage = error.message || '';
          if (!isInvalidCredentialsError(remoteAuthErrorMessage)) {
            console.log('[AuthProvider] Supabase signIn fallback:', error.message);
          }
        }
      } catch (error) {
        console.log('[AuthProvider] Supabase signIn exception:', error);
      }

      if (!remoteAuthSucceeded) {
        if (HAS_REMOTE_AUTH) {
          // Self-healing without relying on users table RLS: try creating auth account, then sign in again.
          if (isInvalidCredentialsError(remoteAuthErrorMessage)) {
            // If local user exists, validate local password first to avoid creating remote auth with wrong password.
            if (user) {
              const isValidLocalPassword = await verifyPassword(password, user.passwordHash);
              if (!isValidLocalPassword) {
                throw new Error('Senha incorreta');
              }
            }

            try {
              const signUpAttempt = await supabase.auth.signUp({ email: normalizedEmail, password });
              if (!signUpAttempt.error) {
                const retrySignIn = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
                if (!retrySignIn.error) {
                  remoteUserId = retrySignIn.data.user?.id || signUpAttempt.data.user?.id || '';
                  remoteAuthSucceeded = true;
                }
              }
            } catch (repairError) {
              console.log('[AuthProvider] Login self-healing fallback:', repairError);
            }
          }

          if (!remoteAuthSucceeded) {
            if (/invalid login credentials|invalid credentials|email not confirmed/i.test(remoteAuthErrorMessage)) {
              throw new Error('Email ou senha invalidos. Se preciso, use Esqueceu sua senha.');
            }
            throw new Error('Nao foi possivel autenticar no Supabase. Faca login novamente com internet ativa.');
          }
        }

        if (!user) {
          if (/invalid login credentials|invalid credentials|email not confirmed/i.test(remoteAuthErrorMessage)) {
            throw new Error('Email ou senha invalidos. Se preciso, use Esqueceu sua senha.');
          }
          throw new Error('Nao foi possivel entrar. Verifique email e senha.');
        }
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          throw new Error('Senha incorreta');
        }
      }

      if (remoteAuthSucceeded && !user) {
        // Keep local cache aligned when a valid Supabase user logs in for the first time on this device.
        const hashed = await hashPassword(password);
        const appended: AuthUser[] = [
          ...users,
          {
            email: normalizedEmail,
            passwordHash: hashed,
            supabaseUserId: remoteUserId,
            createdAt: new Date().toISOString(),
          },
        ];
        await AsyncStorage.setItem(AUTH_KEYS.REGISTERED_USERS, JSON.stringify(appended));
      } else if (user && remoteUserId && remoteUserId !== user.supabaseUserId) {
        const updatedUsers = users.map((u) =>
          u.email.toLowerCase() === normalizedEmail ? { ...u, supabaseUserId: remoteUserId } : u
        );
        await AsyncStorage.setItem(AUTH_KEYS.REGISTERED_USERS, JSON.stringify(updatedUsers));
      }

      if (remoteAuthSucceeded) {
        await ensureRemoteUserRow(normalizedEmail, remoteUserId);
      }

      const authState: AuthState = {
        isLoggedIn: true,
        userEmail: normalizedEmail,
        supabaseUserId: remoteUserId,
      };
      await AsyncStorage.setItem(AUTH_KEYS.AUTH_STATE, JSON.stringify(authState));
      return authState;
    },
    onSuccess: (data) => {
      setIsLoggedIn(true);
      setUserEmail(data.userEmail);
      setSupabaseUserId(data.supabaseUserId || '');
      queryClient.invalidateQueries({ queryKey: ['auth_state'] });
      console.log('[AuthProvider] Login successful:', data.userEmail);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log('[AuthProvider] Logging out...');
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.log('[AuthProvider] Supabase signOut fallback:', error);
      }
      await AsyncStorage.removeItem(AUTH_KEYS.AUTH_STATE);
    },
    onSuccess: () => {
      setIsLoggedIn(false);
      setUserEmail('');
      setSupabaseUserId('');
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

  const clearAppData = useCallback(async () => {
    console.log('[AuthProvider] Clearing all local app data...');
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.log('[AuthProvider] Supabase signOut during clear fallback:', error);
    }

    await AsyncStorage.clear();

    setIsLoggedIn(false);
    setUserEmail('');
    setSupabaseUserId('');
    setIsReady(true);
    setResetEpoch((prev) => prev + 1);
    queryClient.clear();
    console.log('[AuthProvider] Local app data cleared');
  }, [queryClient]);

  return {
    isLoggedIn,
    isReady,
    resetEpoch,
    userEmail,
    supabaseUserId,
    login,
    register,
    logout,
    recoverPassword,
    resetPassword,
    clearAppData,
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
