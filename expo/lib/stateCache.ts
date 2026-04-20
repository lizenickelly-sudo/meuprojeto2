import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheEnvelope<T> = {
  value: T;
  updatedAt: number;
};

const CACHE_PREFIX = 'cashboxpix_state_cache';

function getCacheKey(domain: string, key: string): string {
  return `${CACHE_PREFIX}:${domain}:${key}`;
}

function isValidEnvelope<T>(value: unknown): value is CacheEnvelope<T> {
  if (!value || typeof value !== 'object') return false;

  const maybeEnvelope = value as Partial<CacheEnvelope<T>>;
  return typeof maybeEnvelope.updatedAt === 'number' && 'value' in maybeEnvelope;
}

export async function readDomainCache<T>(
  domain: string,
  key: string,
  ttlMs: number,
): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(getCacheKey(domain, key));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isValidEnvelope<T>(parsed)) {
      await AsyncStorage.removeItem(getCacheKey(domain, key));
      return null;
    }

    if (ttlMs > 0 && Date.now() - parsed.updatedAt > ttlMs) {
      await AsyncStorage.removeItem(getCacheKey(domain, key));
      return null;
    }

    return parsed.value;
  } catch (error) {
    console.log('[stateCache] Failed to read cache:', domain, key, error);
    return null;
  }
}

export async function writeDomainCache<T>(
  domain: string,
  key: string,
  value: T,
): Promise<void> {
  try {
    const payload: CacheEnvelope<T> = {
      value,
      updatedAt: Date.now(),
    };

    await AsyncStorage.setItem(getCacheKey(domain, key), JSON.stringify(payload));
  } catch (error) {
    console.log('[stateCache] Failed to write cache:', domain, key, error);
  }
}

export async function invalidateDomainKey(domain: string, key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(getCacheKey(domain, key));
  } catch (error) {
    console.log('[stateCache] Failed to invalidate cache key:', domain, key, error);
  }
}