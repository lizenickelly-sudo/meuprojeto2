import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

function getUrl(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_URL || '';
}

function getKey(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY || '';
}

export function checkSupabaseConfigured(): boolean {
  const url = getUrl();
  const key = getKey();
  const ok = Boolean(url && key && url.startsWith('http'));
  console.log('[Supabase] Config check - URL:', url ? url.substring(0, 50) : 'NOT SET');
  console.log('[Supabase] Config check - Key:', key ? 'SET (length: ' + key.length + ')' : 'NOT SET');
  console.log('[Supabase] Configured:', ok);
  return ok;
}

export function isSupabaseConfigured(): boolean {
  return checkSupabaseConfigured();
}

function getSupabaseClient(): SupabaseClient | null {
  if (_supabase) return _supabase;

  const url = getUrl();
  const key = getKey();

  if (!url || !key || !url.startsWith('http')) {
    console.log('[Supabase] Not configured - URL:', url || 'EMPTY', '- Key:', key ? 'SET' : 'EMPTY');
    return null;
  }

  try {
    _supabase = createClient(url, key);
    console.log('[Supabase] Client initialized successfully with URL:', url.substring(0, 50));
    return _supabase;
  } catch (err) {
    console.log('[Supabase] Failed to initialize client:', err);
    return null;
  }
}

export function resetSupabaseClient(): void {
  _supabase = null;
  console.log('[Supabase] Client reset, will re-initialize on next use');
}

const notConfiguredResponse = { data: null, error: { message: 'Supabase nao configurado. Adicione EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY ao .env' } };

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    if (!client) {
      console.warn('[Supabase] Client not available. Check env vars EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY / EXPO_PUBLIC_SUPABASE_KEY');
      if (prop === 'from') {
        return () => ({
          select: () => Promise.resolve(notConfiguredResponse),
          insert: () => Promise.resolve(notConfiguredResponse),
          upsert: () => Promise.resolve(notConfiguredResponse),
          update: () => Promise.resolve(notConfiguredResponse),
          delete: () => Promise.resolve(notConfiguredResponse),
        });
      }
      return undefined;
    }
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
