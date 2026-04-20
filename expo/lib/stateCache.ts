import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheEnvelope<T> = {
  updatedAt: number;
  data: T;
};

type DomainName = 'auth' | 'user' | 'sponsor' | 'coupon' | 'admin' | 'notifications';

const DOMAIN_VERSIONS: Record<DomainName, number> = {
  auth: 1,
  user: 1,
  sponsor: 1,
  coupon: 1,
  admin: 1,
  notifications: 1,
};

function domainPrefix(domain: DomainName): string {
  return `cashboxpix_cache_${domain}_v${DOMAIN_VERSIONS[domain]}`;
}

function indexKey(domain: DomainName): string {
  return `${domainPrefix(domain)}_index`;
}

function dataKey(domain: DomainName, key: string): string {
  return `${domainPrefix(domain)}_${key}`;
}

async function addToIndex(domain: DomainName, storageKey: string): Promise<void> {
  const idxKey = indexKey(domain);
  const stored = await AsyncStorage.getItem(idxKey);
  const current = stored ? (JSON.parse(stored) as string[]) : [];
  if (!current.includes(storageKey)) {
    current.push(storageKey);
    await AsyncStorage.setItem(idxKey, JSON.stringify(current));
  }
}

export async function writeDomainCache<T>(domain: DomainName, key: string, data: T): Promise<void> {
  const storageKey = dataKey(domain, key);
  const envelope: CacheEnvelope<T> = {
    updatedAt: Date.now(),
    data,
  };
  await AsyncStorage.setItem(storageKey, JSON.stringify(envelope));
  await addToIndex(domain, storageKey);
}

export async function readDomainCache<T>(
  domain: DomainName,
  key: string,
  maxAgeMs?: number,
): Promise<T | null> {
  const storageKey = dataKey(domain, key);
  const stored = await AsyncStorage.getItem(storageKey);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as CacheEnvelope<T>;
    if (!parsed || typeof parsed !== 'object' || !('updatedAt' in parsed) || !('data' in parsed)) {
      return null;
    }

    if (typeof maxAgeMs === 'number' && maxAgeMs > 0) {
      const age = Date.now() - Number(parsed.updatedAt || 0);
      if (age > maxAgeMs) {
        await AsyncStorage.removeItem(storageKey);
        return null;
      }
    }

    return parsed.data;
  } catch (error) {
    console.log('[StateCache] Failed to parse cache entry:', domain, key, error);
    return null;
  }
}

export async function invalidateDomainKey(domain: DomainName, key: string): Promise<void> {
  const storageKey = dataKey(domain, key);
  await AsyncStorage.removeItem(storageKey);
}

export async function invalidateDomain(domain: DomainName): Promise<void> {
  const idxKey = indexKey(domain);
  const stored = await AsyncStorage.getItem(idxKey);
  const keys = stored ? (JSON.parse(stored) as string[]) : [];

  if (keys.length > 0) {
    await AsyncStorage.multiRemove(keys);
  }

  await AsyncStorage.removeItem(idxKey);
}
