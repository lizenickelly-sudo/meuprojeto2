import { mockSponsors } from '@/mocks/sponsors';
import { mockWinners, mockGrandPrize } from '@/mocks/winners';
import { mockLeaderboard } from '@/mocks/leaderboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSponsorVideoStorageSetupSql } from '@/lib/sponsorMedia';
import type { CouponBatch, ManagedCity, PromotionalQR, Sponsor, Winner, GrandPrize, UserProfile } from '@/types';
import type { LeaderboardEntry } from '@/mocks/leaderboard';

const DB_KEYS = {
  USERS: 'cashboxpix_db_users',
};

const CITY_PRIZES_CAMPAIGN_ID = 'cashboxpix_city_prizes';
const CITY_PRIZE_EVENT_TYPE = 'city_prize_config';

type PersistedUserRow = {
  profile: UserProfile;
  balance: number;
  points: number;
  updatedAt: string;
};

type RemoteUserRow = {
  email: string;
  auth_user_id?: string | null;
  cpf?: string | null;
  name?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  avatar_url?: string | null;
  selfie_url?: string | null;
  document_url?: string | null;
  identity_verified?: boolean | null;
  profile?: UserProfile | null;
  balance?: number | null;
  points?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type RemoteAppStateRow = {
  key: string;
  value?: unknown;
  updated_at?: string | null;
};

type RemoteSponsorRow = {
  id: string;
  name?: string | null;
  city?: string | null;
  state?: string | null;
  verified?: boolean | null;
  data?: Partial<Sponsor> | null;
  updated_at?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
};

type RemoteManagedCityRow = {
  id: string;
  city?: string | null;
  state?: string | null;
  data?: Partial<ManagedCity> | null;
  created_at?: string | null;
};

type RemoteCouponBatchRow = {
  id: string;
  sponsor_id?: string | null;
  data?: Partial<CouponBatch> | null;
  created_at?: string | null;
};

type RemotePromoQRCodeRow = {
  id: string;
  sponsor_id?: string | null;
  city?: string | null;
  state?: string | null;
  data?: Partial<PromotionalQR> | null;
  created_at?: string | null;
};

type RemoteCityPrizeEventRow = {
  id: string;
  campaign_id: string;
  city_key: string;
  city?: string | null;
  state?: string | null;
  event_type: string;
  data?: Partial<GrandPrize> | null;
  created_at?: string | null;
};

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||
  ''
).trim();

function hasSupabaseConfig(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCpf(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizeCityKey(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'city';
}

function buildCityPrizeRowId(cityKey: string): string {
  return `city_prize_${cityKey}`;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function toFiniteNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeSponsorRatingsByUser(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, rawValue]) => {
    const normalizedKey = normalizeEmail(String(key || ''));
    if (!normalizedKey) return acc;

    const normalizedRating = Math.max(1, Math.min(5, Math.round(toFiniteNumber(rawValue, 0))));
    if (normalizedRating > 0) {
      acc[normalizedKey] = normalizedRating;
    }

    return acc;
  }, {});
}

function buildSponsorRatingSummary(ratingsByUser: Record<string, number>) {
  const ratings = Object.values(ratingsByUser).filter((value) => Number.isFinite(value) && value > 0);
  const ratingCount = ratings.length;
  const ratingTotal = ratings.reduce((sum, value) => sum + value, 0);
  const ratingAverage = ratingCount > 0 ? Number((ratingTotal / ratingCount).toFixed(1)) : 0;

  return {
    ratingCount,
    ratingTotal,
    ratingAverage,
  };
}

function mapRemoteSponsorRowToSponsor(row: RemoteSponsorRow): Sponsor {
  const data = toRecord(row.data);
  const sponsorId = row.id || String(data.id || '');
  const sponsorName = row.name ?? String(data.name || '');
  const city = row.city ?? String(data.city || '');
  const state = row.state ?? String(data.state || '');
  const imageUrl = String(data.imageUrl || row.thumbnail_url || data.logoUrl || '');
  const logoUrl = String(data.logoUrl || row.thumbnail_url || data.imageUrl || '');
  const ratingsByUser = normalizeSponsorRatingsByUser(data.ratingsByUser);
  const ratingSummary = buildSponsorRatingSummary(ratingsByUser);
  const promotionalVideos = Array.isArray(data.promotionalVideos)
    ? data.promotionalVideos
    : row.video_url
      ? [{ id: `${sponsorId}_video`, url: row.video_url, createdAt: row.updated_at || new Date().toISOString() }]
      : [];

  return {
    id: sponsorId,
    name: sponsorName,
    category: String(data.category || ''),
    imageUrl,
    logoUrl,
    address: String(data.address || ''),
    city,
    state,
    latitude: toFiniteNumber(data.latitude, 0),
    longitude: toFiniteNumber(data.longitude, 0),
    phone: String(data.phone || ''),
    whatsapp: data.whatsapp ? String(data.whatsapp) : undefined,
    description: String(data.description || ''),
    offers: Array.isArray(data.offers) ? data.offers as Sponsor['offers'] : [],
    minPurchaseValue: toFiniteNumber(data.minPurchaseValue, 0),
    verified: Boolean(row.verified ?? data.verified),
    couponValue: data.couponValue === undefined || data.couponValue === null ? undefined : toFiniteNumber(data.couponValue, 0),
    stories: Array.isArray(data.stories) ? data.stories as Sponsor['stories'] : [],
    galleryImages: Array.isArray(data.galleryImages) ? data.galleryImages as Sponsor['galleryImages'] : [],
    promotionalVideos: promotionalVideos as Sponsor['promotionalVideos'],
    ratingsByUser,
    ratingAverage: ratingSummary.ratingAverage,
    ratingCount: ratingSummary.ratingCount,
    ratingTotal: ratingSummary.ratingTotal,
  };
}

function mapRemoteManagedCityRow(row: RemoteManagedCityRow): ManagedCity {
  const data = toRecord(row.data);
  return {
    id: row.id || String(data.id || ''),
    city: row.city ?? String(data.city || ''),
    state: row.state ?? String(data.state || ''),
    imageUrl: data.imageUrl ? String(data.imageUrl) : undefined,
    createdAt: String(data.createdAt || row.created_at || new Date().toISOString()),
  };
}

function buildRemoteSponsorRow(sponsor: Sponsor): RemoteSponsorRow {
  const firstVideo = sponsor.promotionalVideos?.[0];
  return {
    id: sponsor.id,
    name: sponsor.name,
    city: sponsor.city,
    state: sponsor.state,
    verified: sponsor.verified,
    data: sponsor,
    updated_at: new Date().toISOString(),
    video_url: firstVideo?.url ?? null,
    thumbnail_url: sponsor.imageUrl || sponsor.logoUrl || null,
  };
}

function buildRemoteManagedCityRow(city: ManagedCity): RemoteManagedCityRow {
  return {
    id: city.id,
    city: city.city,
    state: city.state,
    data: city,
    created_at: city.createdAt || new Date().toISOString(),
  };
}

function mapRemoteCouponBatchRow(row: RemoteCouponBatchRow): CouponBatch | null {
  const data = toRecord(row.data);
  const id = row.id || String(data.id || '');
  const sponsorId = row.sponsor_id ?? String(data.sponsorId || '');
  if (!id || !sponsorId) return null;

  return {
    id,
    sponsorId,
    sponsorName: String(data.sponsorName || ''),
    quantity: toFiniteNumber(data.quantity, 0),
    value: toFiniteNumber(data.value, 0),
    prefix: String(data.prefix || ''),
    createdAt: String(data.createdAt || row.created_at || new Date().toISOString()),
    codes: Array.isArray(data.codes) ? (data.codes as string[]) : [],
  };
}

function buildRemoteCouponBatchRow(batch: CouponBatch): RemoteCouponBatchRow {
  return {
    id: batch.id,
    sponsor_id: batch.sponsorId,
    data: batch,
    created_at: batch.createdAt || new Date().toISOString(),
  };
}

function mapRemotePromoQRCodeRow(row: RemotePromoQRCodeRow): PromotionalQR | null {
  const data = toRecord(row.data);
  const id = row.id || String(data.id || '');
  const sponsorId = row.sponsor_id ?? String(data.sponsorId || '');
  if (!id || !sponsorId) return null;

  return {
    id,
    sponsorId,
    sponsorName: String(data.sponsorName || ''),
    sponsorAddress: String(data.sponsorAddress || ''),
    backgroundImageUrl: data.backgroundImageUrl ? String(data.backgroundImageUrl) : undefined,
    city: row.city ?? String(data.city || ''),
    state: row.state ?? String(data.state || ''),
    message: String(data.message || ''),
    couponValue: toFiniteNumber(data.couponValue, 0),
    minPurchase: toFiniteNumber(data.minPurchase, 0),
    createdAt: String(data.createdAt || row.created_at || new Date().toISOString()),
    active: data.active === undefined ? true : Boolean(data.active),
  };
}

function buildRemotePromoQRCodeRow(code: PromotionalQR): RemotePromoQRCodeRow {
  return {
    id: code.id,
    sponsor_id: code.sponsorId,
    city: code.city,
    state: code.state,
    data: code,
    created_at: code.createdAt || new Date().toISOString(),
  };
}

function mapRemoteCityPrizeEventRowToPrize(row: RemoteCityPrizeEventRow): GrandPrize | null {
  const data = toRecord(row.data);
  const city = row.city ?? String(data.city || '');
  if (!city) return null;

  const state = row.state ?? String(data.state || '');

  return {
    id: String(data.id || row.id || buildCityPrizeRowId(row.city_key || normalizeCityKey(city))),
    title: String(data.title || `GRANDE PREMIO - ${city}`),
    value: toFiniteNumber(data.value, 10000),
    imageUrl: String(data.imageUrl || ''),
    backgroundImageUrl: data.backgroundImageUrl ? String(data.backgroundImageUrl) : undefined,
    drawDate: String(data.drawDate || ''),
    lotteryReference: String(data.lotteryReference || 'Loteria Federal'),
    description: String(data.description || `Grande premio da cidade de ${city}`),
    winnerName: data.winnerName ? String(data.winnerName) : undefined,
    winnerCity: data.winnerCity ? String(data.winnerCity) : undefined,
    isActive: data.isActive === undefined ? true : Boolean(data.isActive),
    city,
    state,
  };
}

function buildRemoteCityPrizeEventRow(prize: GrandPrize, existingRow?: RemoteCityPrizeEventRow): RemoteCityPrizeEventRow {
  const city = (prize.city || existingRow?.city || '').trim();
  const state = (prize.state || existingRow?.state || '').trim();
  const cityKey = normalizeCityKey(city || existingRow?.city_key || prize.id || 'city');

  return {
    id: existingRow?.id || buildCityPrizeRowId(cityKey),
    campaign_id: CITY_PRIZES_CAMPAIGN_ID,
    city_key: cityKey,
    city,
    state,
    event_type: CITY_PRIZE_EVENT_TYPE,
    data: { ...prize, city, state },
    created_at: existingRow?.created_at || new Date().toISOString(),
  };
}

function mapRemoteRowToUserProfile(row: RemoteUserRow): UserProfile {
  const profile = row.profile && typeof row.profile === 'object' ? row.profile : ({} as UserProfile);
  const email = normalizeEmail(row.email || profile.email || '');
  return {
    ...profile,
    email,
    name: row.name ?? profile.name ?? '',
    cpf: row.cpf ?? profile.cpf ?? '',
    phone: row.phone ?? profile.phone ?? '',
    city: row.city ?? profile.city ?? '',
    state: row.state ?? profile.state ?? '',
    avatarUrl: row.avatar_url ?? profile.avatarUrl,
    selfieUrl: row.selfie_url ?? profile.selfieUrl,
    documentUrl: row.document_url ?? profile.documentUrl,
    identityVerified: Boolean(row.identity_verified ?? profile.identityVerified),
    createdAt: row.created_at ?? profile.createdAt ?? new Date().toISOString(),
  };
}

async function supabaseRequest(path: string, init?: RequestInit): Promise<Response> {
  const url = `${SUPABASE_URL}${path}`;
  const headers: HeadersInit = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...(init?.headers || {}),
  };
  return fetch(url, { ...init, headers });
}

async function fetchRemoteAppState<T>(key: string): Promise<T | null> {
  if (!hasSupabaseConfig()) return null;

  const query = `/rest/v1/app_state?select=value&key=eq.${encodeURIComponent(key)}&limit=1`;
  const res = await supabaseRequest(query, { method: 'GET' });
  if (!res.ok) {
    const errorText = await res.text();
    console.log('[DB] Supabase fetch app_state failed:', key, errorText);
    return null;
  }

  const rows = (await res.json()) as RemoteAppStateRow[];
  if (!rows.length) return null;
  return (rows[0].value ?? null) as T | null;
}

async function fetchSponsorsTable(): Promise<RemoteSponsorRow[] | null> {
  if (!hasSupabaseConfig()) return null;

  const res = await supabaseRequest('/rest/v1/sponsors?select=*&order=updated_at.desc', { method: 'GET' });
  if (!res.ok) {
    const errorText = await res.text();
    console.log('[DB] Supabase fetch sponsors table failed:', errorText);
    return null;
  }

  return (await res.json()) as RemoteSponsorRow[];
}

async function upsertSponsorsTable(sponsors: Sponsor[]): Promise<boolean> {
  if (!hasSupabaseConfig()) return false;

  const currentRows = await fetchSponsorsTable();
  if (currentRows === null) return false;

  const currentIds = new Set(currentRows.map((row) => row.id));
  const nextIds = new Set(sponsors.map((sponsor) => sponsor.id));

  if (sponsors.length > 0) {
    const payload = sponsors.map(buildRemoteSponsorRow);
    const upsertRes = await supabaseRequest('/rest/v1/sponsors?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(payload),
    });

    if (!upsertRes.ok) {
      const errorText = await upsertRes.text();
      console.log('[DB] Supabase upsert sponsors table failed:', errorText);
      return false;
    }
  }

  const idsToDelete = [...currentIds].filter((id) => !nextIds.has(id));
  for (const sponsorId of idsToDelete) {
    const deleteRes = await supabaseRequest(`/rest/v1/sponsors?id=eq.${encodeURIComponent(sponsorId)}`, {
      method: 'DELETE',
    });
    if (!deleteRes.ok) {
      const errorText = await deleteRes.text();
      console.log('[DB] Supabase delete sponsor failed:', sponsorId, errorText);
      return false;
    }
  }

  return true;
}

async function fetchManagedCitiesTable(): Promise<RemoteManagedCityRow[] | null> {
  if (!hasSupabaseConfig()) return null;

  const res = await supabaseRequest('/rest/v1/managed_cities?select=*&order=created_at.asc', { method: 'GET' });
  if (!res.ok) {
    const errorText = await res.text();
    console.log('[DB] Supabase fetch managed_cities table failed:', errorText);
    return null;
  }

  return (await res.json()) as RemoteManagedCityRow[];
}

async function syncManagedCitiesTable(cities: ManagedCity[]): Promise<boolean> {
  if (!hasSupabaseConfig()) return false;

  const currentRows = await fetchManagedCitiesTable();
  if (currentRows === null) return false;

  const currentIds = new Set(currentRows.map((row) => row.id));
  const nextIds = new Set(cities.map((city) => city.id));

  if (cities.length > 0) {
    const payload = cities.map(buildRemoteManagedCityRow);
    const upsertRes = await supabaseRequest('/rest/v1/managed_cities?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(payload),
    });

    if (!upsertRes.ok) {
      const errorText = await upsertRes.text();
      console.log('[DB] Supabase upsert managed_cities failed:', errorText);
      return false;
    }
  }

  const idsToDelete = [...currentIds].filter((id) => !nextIds.has(id));
  for (const cityId of idsToDelete) {
    const deleteRes = await supabaseRequest(`/rest/v1/managed_cities?id=eq.${encodeURIComponent(cityId)}`, {
      method: 'DELETE',
    });
    if (!deleteRes.ok) {
      const errorText = await deleteRes.text();
      console.log('[DB] Supabase delete managed city failed:', cityId, errorText);
      return false;
    }
  }

  return true;
}

async function fetchCityPrizeEventsTable(): Promise<RemoteCityPrizeEventRow[] | null> {
  if (!hasSupabaseConfig()) return null;

  const query = `/rest/v1/city_prize_events?select=id,campaign_id,city_key,city,state,event_type,data,created_at&campaign_id=eq.${encodeURIComponent(CITY_PRIZES_CAMPAIGN_ID)}&event_type=eq.${encodeURIComponent(CITY_PRIZE_EVENT_TYPE)}&order=city.asc`;
  const res = await supabaseRequest(query, { method: 'GET' });
  if (!res.ok) {
    const errorText = await res.text();
    console.log('[DB] Supabase fetch city_prize_events table failed:', errorText);
    return null;
  }

  return (await res.json()) as RemoteCityPrizeEventRow[];
}

async function syncCityPrizeEventsTable(prizes: Record<string, GrandPrize>): Promise<boolean> {
  if (!hasSupabaseConfig()) return false;

  const currentRows = await fetchCityPrizeEventsTable();
  if (currentRows === null) return false;

  const currentByCityKey = new Map(currentRows.map((row) => [row.city_key, row]));
  const payload = Object.entries(prizes)
    .map(([cityName, prize]) => {
      const city = (prize.city || cityName).trim();
      if (!city) return null;

      const cityKey = normalizeCityKey(city);
      const existingRow = currentByCityKey.get(cityKey);
      return buildRemoteCityPrizeEventRow({ ...prize, city }, existingRow);
    })
    .filter((row): row is RemoteCityPrizeEventRow => Boolean(row));

  if (payload.length > 0) {
    const upsertRes = await supabaseRequest('/rest/v1/city_prize_events?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(payload),
    });

    if (!upsertRes.ok) {
      const errorText = await upsertRes.text();
      console.log('[DB] Supabase upsert city_prize_events failed:', errorText);
      return false;
    }
  }

  const nextIds = new Set(payload.map((row) => row.id));
  const idsToDelete = currentRows.map((row) => row.id).filter((id) => !nextIds.has(id));
  for (const eventId of idsToDelete) {
    const deleteRes = await supabaseRequest(`/rest/v1/city_prize_events?id=eq.${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    });
    if (!deleteRes.ok) {
      const errorText = await deleteRes.text();
      console.log('[DB] Supabase delete city_prize_event failed:', eventId, errorText);
      return false;
    }
  }

  return true;
}

async function fetchCouponBatchesTable(): Promise<RemoteCouponBatchRow[] | null> {
  if (!hasSupabaseConfig()) return null;

  const res = await supabaseRequest('/rest/v1/coupon_batches?select=id,sponsor_id,data,created_at&order=created_at.desc', { method: 'GET' });
  if (!res.ok) {
    const errorText = await res.text();
    console.log('[DB] Supabase fetch coupon_batches table failed:', errorText);
    return null;
  }

  return (await res.json()) as RemoteCouponBatchRow[];
}

async function syncCouponBatchesTable(batches: CouponBatch[]): Promise<boolean> {
  if (!hasSupabaseConfig()) return false;

  const currentRows = await fetchCouponBatchesTable();
  if (currentRows === null) return false;

  if (batches.length > 0) {
    const payload = batches.map(buildRemoteCouponBatchRow);
    const upsertRes = await supabaseRequest('/rest/v1/coupon_batches?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(payload),
    });

    if (!upsertRes.ok) {
      const errorText = await upsertRes.text();
      console.log('[DB] Supabase upsert coupon_batches failed:', errorText);
      return false;
    }
  }

  const nextIds = new Set(batches.map((batch) => batch.id));
  const idsToDelete = currentRows.map((row) => row.id).filter((id) => !nextIds.has(id));
  for (const batchId of idsToDelete) {
    const deleteRes = await supabaseRequest(`/rest/v1/coupon_batches?id=eq.${encodeURIComponent(batchId)}`, {
      method: 'DELETE',
    });
    if (!deleteRes.ok) {
      const errorText = await deleteRes.text();
      console.log('[DB] Supabase delete coupon_batch failed:', batchId, errorText);
      return false;
    }
  }

  return true;
}

async function fetchPromoQRCodesTable(): Promise<RemotePromoQRCodeRow[] | null> {
  if (!hasSupabaseConfig()) return null;

  const res = await supabaseRequest('/rest/v1/promo_qr_codes?select=id,sponsor_id,city,state,data,created_at&order=created_at.desc', { method: 'GET' });
  if (!res.ok) {
    const errorText = await res.text();
    console.log('[DB] Supabase fetch promo_qr_codes table failed:', errorText);
    return null;
  }

  return (await res.json()) as RemotePromoQRCodeRow[];
}

async function syncPromoQRCodesTable(codes: PromotionalQR[]): Promise<boolean> {
  if (!hasSupabaseConfig()) return false;

  const currentRows = await fetchPromoQRCodesTable();
  if (currentRows === null) return false;

  if (codes.length > 0) {
    const payload = codes.map(buildRemotePromoQRCodeRow);
    const upsertRes = await supabaseRequest('/rest/v1/promo_qr_codes?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(payload),
    });

    if (!upsertRes.ok) {
      const errorText = await upsertRes.text();
      console.log('[DB] Supabase upsert promo_qr_codes failed:', errorText);
      return false;
    }
  }

  const nextIds = new Set(codes.map((code) => code.id));
  const idsToDelete = currentRows.map((row) => row.id).filter((id) => !nextIds.has(id));
  for (const codeId of idsToDelete) {
    const deleteRes = await supabaseRequest(`/rest/v1/promo_qr_codes?id=eq.${encodeURIComponent(codeId)}`, {
      method: 'DELETE',
    });
    if (!deleteRes.ok) {
      const errorText = await deleteRes.text();
      console.log('[DB] Supabase delete promo_qr_code failed:', codeId, errorText);
      return false;
    }
  }

  return true;
}

async function upsertRemoteAppState<T>(key: string, value: T): Promise<boolean> {
  if (!hasSupabaseConfig()) return false;

  const res = await supabaseRequest('/rest/v1/app_state?on_conflict=key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      key,
      value,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.log('[DB] Supabase upsert app_state failed:', key, errorText);
    return false;
  }

  return true;
}

export async function fetchAppState<T>(key: string): Promise<T | null> {
  return fetchRemoteAppState<T>(key);
}

export async function saveAppState<T>(key: string, value: T): Promise<boolean> {
  return upsertRemoteAppState<T>(key, value);
}

export async function fetchCityPrizes(): Promise<Record<string, GrandPrize>> {
  if (!hasSupabaseConfig()) return {};

  const tableRows = await fetchCityPrizeEventsTable();
  if (tableRows !== null) {
    if (tableRows.length > 0) {
      console.log('[DB] Using remote city prizes from Supabase city_prize_events table');
      return tableRows.reduce<Record<string, GrandPrize>>((accumulator, row) => {
        const prize = mapRemoteCityPrizeEventRowToPrize(row);
        if (prize?.city) {
          accumulator[prize.city] = prize;
        }
        return accumulator;
      }, {});
    }

    console.log('[DB] No rows found in Supabase city_prize_events table');
  }

  const remoteCityPrizes = await fetchRemoteAppState<Record<string, GrandPrize>>('city_prizes');
  if (remoteCityPrizes && Object.keys(remoteCityPrizes).length > 0) {
    console.log('[DB] Using remote city prizes from Supabase app_state');
    return remoteCityPrizes;
  }

  console.log('[DB] No remote city prizes found');
  return {};
}

export async function fetchCouponBatches(): Promise<CouponBatch[]> {
  if (!hasSupabaseConfig()) return [];

  const tableRows = await fetchCouponBatchesTable();
  if (tableRows !== null) {
    if (tableRows.length > 0) {
      console.log('[DB] Using remote coupon batches from Supabase coupon_batches table');
      return tableRows
        .map(mapRemoteCouponBatchRow)
        .filter((batch): batch is CouponBatch => Boolean(batch));
    }

    console.log('[DB] No rows found in Supabase coupon_batches table');
  }

  const remoteBatches = await fetchRemoteAppState<CouponBatch[]>('coupon_batches');
  if (remoteBatches && remoteBatches.length > 0) {
    console.log('[DB] Using remote coupon batches from Supabase app_state');
    return remoteBatches;
  }

  console.log('[DB] No remote coupon batches found');
  return [];
}

export async function syncCouponBatches(batches: CouponBatch[]): Promise<boolean> {
  const tableSaved = await syncCouponBatchesTable(batches);
  if (tableSaved) {
    void upsertRemoteAppState('coupon_batches', batches);
    return true;
  }

  return upsertRemoteAppState('coupon_batches', batches);
}

export async function fetchPromoQRCodes(): Promise<PromotionalQR[]> {
  if (!hasSupabaseConfig()) return [];

  const tableRows = await fetchPromoQRCodesTable();
  if (tableRows !== null) {
    if (tableRows.length > 0) {
      console.log('[DB] Using remote promo QR codes from Supabase promo_qr_codes table');
      return tableRows
        .map(mapRemotePromoQRCodeRow)
        .filter((code): code is PromotionalQR => Boolean(code));
    }

    console.log('[DB] No rows found in Supabase promo_qr_codes table');
  }

  const remoteCodes = await fetchRemoteAppState<PromotionalQR[]>('promo_qr_codes');
  if (remoteCodes && remoteCodes.length > 0) {
    console.log('[DB] Using remote promo QR codes from Supabase app_state');
    return remoteCodes;
  }

  console.log('[DB] No remote promo QR codes found');
  return [];
}

export async function syncPromoQRCodes(codes: PromotionalQR[]): Promise<boolean> {
  const tableSaved = await syncPromoQRCodesTable(codes);
  if (tableSaved) {
    void upsertRemoteAppState('promo_qr_codes', codes);
    return true;
  }

  return upsertRemoteAppState('promo_qr_codes', codes);
}

export async function syncCityPrizes(prizes: Record<string, GrandPrize>): Promise<boolean> {
  const tableSaved = await syncCityPrizeEventsTable(prizes);
  if (tableSaved) {
    void upsertRemoteAppState('city_prizes', prizes);
    return true;
  }

  return upsertRemoteAppState('city_prizes', prizes);
}

async function upsertUserRemote(profile: UserProfile, balance: number, points: number): Promise<boolean> {
  if (!hasSupabaseConfig()) return false;

  const email = normalizeEmail(profile.email || '');
  if (!email) return false;

  const payload: RemoteUserRow = {
    email,
    cpf: profile.cpf || null,
    name: profile.name || null,
    phone: profile.phone || null,
    city: profile.city || null,
    state: profile.state || null,
    avatar_url: profile.avatarUrl || null,
    selfie_url: profile.selfieUrl || null,
    document_url: profile.documentUrl || null,
    identity_verified: Boolean(profile.identityVerified),
    profile,
    balance,
    points,
    updated_at: new Date().toISOString(),
    created_at: profile.createdAt || new Date().toISOString(),
  };

  const res = await supabaseRequest('/rest/v1/users?on_conflict=email', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.log('[DB] Supabase upsert user failed:', errorText);
    return false;
  }

  return true;
}

export async function ensureUserRemoteRow(email: string, authUserId?: string): Promise<boolean> {
  if (!hasSupabaseConfig()) return false;

  const normalizedEmail = normalizeEmail(email || '');
  if (!normalizedEmail) return false;

  let existingRow: RemoteUserRow | null = null;
  const query = `/rest/v1/users?select=*&email=eq.${encodeURIComponent(normalizedEmail)}&limit=1`;
  const existingRes = await supabaseRequest(query, { method: 'GET' });
  if (existingRes.ok) {
    const rows = (await existingRes.json()) as RemoteUserRow[];
    existingRow = rows[0] ?? null;
  } else {
    const errorText = await existingRes.text();
    console.log('[DB] ensureUserRemoteRow fetch existing failed:', errorText);
  }

  const existingProfile = existingRow ? mapRemoteRowToUserProfile(existingRow) : null;
  const now = new Date().toISOString();
  const nextProfile: UserProfile = {
    id: existingProfile?.id || authUserId || normalizedEmail,
    name: existingProfile?.name || '',
    cpf: existingProfile?.cpf || '',
    phone: existingProfile?.phone || '',
    email: normalizedEmail,
    city: existingProfile?.city || '',
    state: existingProfile?.state || '',
    pixKey: existingProfile?.pixKey || '',
    pixKeyType: existingProfile?.pixKeyType || 'cpf',
    pixKeys: existingProfile?.pixKeys,
    pixCpf: existingProfile?.pixCpf || '',
    pixPhone: existingProfile?.pixPhone || '',
    pixEmail: existingProfile?.pixEmail || '',
    pixRandom: existingProfile?.pixRandom || '',
    avatarUrl: existingProfile?.avatarUrl,
    createdAt: existingProfile?.createdAt || existingRow?.created_at || now,
    referralCode: existingProfile?.referralCode,
    referredBy: existingProfile?.referredBy,
    identityVerified: existingProfile?.identityVerified,
    selfieUrl: existingProfile?.selfieUrl,
    documentUrl: existingProfile?.documentUrl,
    savedFields: existingProfile?.savedFields,
    isActive: existingProfile?.isActive,
    adminReviewStatus: existingProfile?.adminReviewStatus || 'pending',
    adminReviewedAt: existingProfile?.adminReviewedAt,
  };

  return upsertUserRemote(
    {
      ...nextProfile,
      createdAt: existingRow?.created_at || nextProfile.createdAt || now,
    },
    Number.isFinite(existingRow?.balance as number) ? Number(existingRow?.balance) : 0,
    Number.isFinite(existingRow?.points as number) ? Number(existingRow?.points) : 0,
  );
}

async function fetchUserRemoteByEmail(email: string): Promise<UserProfile | null> {
  if (!hasSupabaseConfig()) return null;
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const query = `/rest/v1/users?select=*&email=eq.${encodeURIComponent(normalized)}&limit=1`;
  const res = await supabaseRequest(query, { method: 'GET' });
  if (!res.ok) {
    const errorText = await res.text();
    console.log('[DB] Supabase fetch by email failed:', errorText);
    return null;
  }

  const rows = (await res.json()) as RemoteUserRow[];
  if (!rows.length) return null;
  return mapRemoteRowToUserProfile(rows[0]);
}

async function fetchUserRemoteByCpf(cpf: string): Promise<UserProfile | null> {
  if (!hasSupabaseConfig()) return null;
  const normalizedCpf = normalizeCpf(cpf);
  if (!normalizedCpf) return null;

  const query = `/rest/v1/users?select=*&cpf=eq.${encodeURIComponent(normalizedCpf)}&limit=1`;
  const res = await supabaseRequest(query, { method: 'GET' });
  if (!res.ok) {
    const errorText = await res.text();
    console.log('[DB] Supabase fetch by cpf failed:', errorText);
    return null;
  }

  const rows = (await res.json()) as RemoteUserRow[];
  if (!rows.length) return null;
  return mapRemoteRowToUserProfile(rows[0]);
}

async function fetchAllUsersRemote(): Promise<{ profile: UserProfile; balance: number; points: number }[]> {
  if (!hasSupabaseConfig()) return [];

  const res = await supabaseRequest('/rest/v1/users?select=*&order=updated_at.desc', { method: 'GET' });
  if (!res.ok) {
    const errorText = await res.text();
    console.log('[DB] Supabase fetch all users failed:', errorText);
    return [];
  }

  const rows = (await res.json()) as RemoteUserRow[];
  return rows.map((row) => ({
    profile: mapRemoteRowToUserProfile(row),
    balance: Number.isFinite(row.balance as number) ? Number(row.balance) : 0,
    points: Number.isFinite(row.points as number) ? Number(row.points) : 0,
  }));
}

async function loadUsersMap(): Promise<Record<string, PersistedUserRow>> {
  const raw = await AsyncStorage.getItem(DB_KEYS.USERS);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, PersistedUserRow>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.log('[DB] Failed parsing users map:', error);
    return {};
  }
}

async function saveUsersMap(map: Record<string, PersistedUserRow>): Promise<void> {
  await AsyncStorage.setItem(DB_KEYS.USERS, JSON.stringify(map));
}

export async function fetchSponsors(): Promise<Sponsor[]> {
  if (!hasSupabaseConfig()) {
    console.log('[DB] No remote sponsors: Supabase not configured');
    return [];
  }

  const tableSponsors = await fetchSponsorsTable();
  if (tableSponsors !== null) {
    if (tableSponsors.length > 0) {
      console.log('[DB] Using remote sponsors from Supabase sponsors table');
      return tableSponsors.map(mapRemoteSponsorRowToSponsor);
    }

    console.log('[DB] No rows found in Supabase sponsors table');
  }

  const remoteSponsors = await fetchRemoteAppState<Sponsor[]>('sponsors');
  if (remoteSponsors && remoteSponsors.length > 0) {
    console.log('[DB] Using remote sponsors from Supabase app_state');
    return remoteSponsors;
  }

  console.log('[DB] No remote sponsors found in Supabase app_state');
  return [];
}

export async function upsertSponsor(sponsor: Sponsor): Promise<boolean> {
  const currentSponsors = await fetchSponsors();
  const existingIndex = currentSponsors.findIndex((item) => item.id === sponsor.id);

  if (existingIndex >= 0) {
    currentSponsors[existingIndex] = sponsor;
  } else {
    currentSponsors.push(sponsor);
  }

  const tableSaved = await upsertSponsorsTable(currentSponsors);
  if (tableSaved) {
    await upsertRemoteAppState('sponsors', currentSponsors);
    return true;
  }

  return upsertRemoteAppState('sponsors', currentSponsors);
}

export async function removeSponsor(sponsorId: string): Promise<boolean> {
  const currentSponsors = await fetchSponsors();
  const updatedSponsors = currentSponsors.filter((item) => item.id !== sponsorId);
  const tableSaved = await upsertSponsorsTable(updatedSponsors);
  if (tableSaved) {
    await upsertRemoteAppState('sponsors', updatedSponsors);
    return true;
  }

  return upsertRemoteAppState('sponsors', updatedSponsors);
}

export async function syncSponsors(sponsors: Sponsor[]): Promise<boolean> {
  const tableSaved = await upsertSponsorsTable(sponsors);
  if (tableSaved) {
    await upsertRemoteAppState('sponsors', sponsors);
    return true;
  }

  return upsertRemoteAppState('sponsors', sponsors);
}

export async function fetchManagedCities(): Promise<ManagedCity[]> {
  if (!hasSupabaseConfig()) return [];

  const tableCities = await fetchManagedCitiesTable();
  if (tableCities !== null) {
    if (tableCities.length > 0) {
      console.log('[DB] Using remote managed cities from Supabase managed_cities table');
      return tableCities.map(mapRemoteManagedCityRow);
    }

    console.log('[DB] No rows found in Supabase managed_cities table');
  }

  const remoteCities = await fetchRemoteAppState<ManagedCity[]>('managed_cities');
  if (remoteCities && remoteCities.length > 0) {
    console.log('[DB] Using remote managed cities from Supabase app_state');
    return remoteCities;
  }

  console.log('[DB] No remote managed cities found');
  return [];
}

export async function syncManagedCities(cities: ManagedCity[]): Promise<boolean> {
  const tableSaved = await syncManagedCitiesTable(cities);
  if (tableSaved) {
    await upsertRemoteAppState('managed_cities', cities);
    return true;
  }

  return upsertRemoteAppState('managed_cities', cities);
}

export async function fetchWinners(): Promise<Winner[]> {
  console.log('[DB] Using local mock winners');
  return mockWinners;
}

export async function fetchGrandPrize(): Promise<GrandPrize> {
  const remotePrize = await fetchRemoteAppState<GrandPrize>('grand_prize');
  if (remotePrize) {
    console.log('[DB] Using remote grand prize from Supabase app_state');
    return remotePrize;
  }

  console.log('[DB] Using local mock grand prize');
  return mockGrandPrize;
}

export async function upsertUser(_profile: UserProfile, _balance: number = 0, _points: number = 0): Promise<boolean> {
  const email = normalizeEmail(_profile.email || '');
  if (!email) {
    console.log('[DB] upsertUser skipped: missing email');
    return false;
  }

  const users = await loadUsersMap();
  const prev = users[email];
  users[email] = {
    profile: {
      ...prev?.profile,
      ..._profile,
      email,
      createdAt: _profile.createdAt || prev?.profile?.createdAt || new Date().toISOString(),
    },
    balance: Number.isFinite(_balance) ? _balance : (prev?.balance ?? 0),
    points: Number.isFinite(_points) ? _points : (prev?.points ?? 0),
    updatedAt: new Date().toISOString(),
  };

  await saveUsersMap(users);

  const remoteOk = await upsertUserRemote(users[email].profile, users[email].balance, users[email].points);
  return remoteOk || true;
}

export async function fetchUserByCpf(_cpf: string): Promise<UserProfile | null> {
  const remote = await fetchUserRemoteByCpf(_cpf || '');
  if (remote) return remote;

  const target = normalizeCpf(_cpf || '');
  if (!target) return null;

  const users = await loadUsersMap();
  for (const row of Object.values(users)) {
    if (normalizeCpf(row.profile.cpf || '') === target) {
      return row.profile;
    }
  }
  return null;
}

export async function fetchUser(_userId: string): Promise<UserProfile | null> {
  const remote = await fetchUserRemoteByEmail(_userId || '');
  if (remote) return remote;

  const users = await loadUsersMap();
  const idNorm = _userId.trim().toLowerCase();

  // Try direct by email first
  if (users[idNorm]?.profile) {
    return users[idNorm].profile;
  }

  for (const row of Object.values(users)) {
    if ((row.profile.id || '').toLowerCase() === idNorm) {
      return row.profile;
    }
  }
  return null;
}

export async function fetchAllUsers(): Promise<{ profile: UserProfile; balance: number; points: number }[]> {
  return fetchAllUsersRemote();
}

export async function upsertUserServerOnly(_profile: UserProfile, _balance: number = 0, _points: number = 0): Promise<boolean> {
  const email = normalizeEmail(_profile.email || '');
  if (!email) {
    console.log('[DB] upsertUserServerOnly skipped: missing email');
    return false;
  }

  return upsertUserRemote(
    {
      ..._profile,
      email,
      createdAt: _profile.createdAt || new Date().toISOString(),
    },
    Number.isFinite(_balance) ? _balance : 0,
    Number.isFinite(_points) ? _points : 0,
  );
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  console.log('[DB] Using local mock leaderboard');
  return mockLeaderboard;
}

export interface SeedResult {
  sponsors: { count: number; error?: string };
  winners: { ok: boolean; error?: string };
  leaderboard: { ok: boolean; error?: string };
  grandPrize: { ok: boolean; error?: string };
}

export async function seedAllToSupabase(): Promise<SeedResult> {
  if (!hasSupabaseConfig()) {
    console.log('[DB] seedAllToSupabase - no remote DB configured');
    return {
      sponsors: { count: 0, error: 'Banco de dados remoto nao configurado' },
      winners: { ok: false, error: 'Banco de dados remoto nao configurado' },
      leaderboard: { ok: false, error: 'Banco de dados remoto nao configurado' },
      grandPrize: { ok: false, error: 'Banco de dados remoto nao configurado' },
    };
  }

  const sponsorsOk = await upsertRemoteAppState('sponsors', mockSponsors);
  const grandPrizeOk = await upsertRemoteAppState('grand_prize', mockGrandPrize);

  return {
    sponsors: sponsorsOk ? { count: mockSponsors.length } : { count: 0, error: 'Falha ao gravar sponsors em app_state' },
    winners: { ok: true },
    leaderboard: { ok: true },
    grandPrize: grandPrizeOk ? { ok: true } : { ok: false, error: 'Falha ao gravar grand_prize em app_state' },
  };
}

export async function checkTablesExist(): Promise<{ missing: string[]; errors: Record<string, string> }> {
  if (!hasSupabaseConfig()) {
    return {
      missing: ['users', 'app_state'],
      errors: { config: 'Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY (ou EXPO_PUBLIC_SUPABASE_KEY)' },
    };
  }

  try {
    const tables = [
      { name: 'users', select: 'email' },
      { name: 'app_state', select: 'key' },
    ];
    const missing: string[] = [];
    const errors: Record<string, string> = {};

    for (const table of tables) {
      const res = await supabaseRequest(`/rest/v1/${table.name}?select=${table.select}&limit=1`, { method: 'GET' });
      if (res.ok) continue;

      const text = await res.text();
      if (/relation .* does not exist|42P01|Could not find the table/i.test(text)) {
        missing.push(table.name);
      }
      errors[table.name] = text || `Falha ao verificar tabela ${table.name}`;
    }

    return { missing, errors };
  } catch (error) {
    return { missing: ['users', 'app_state'], errors: { users: String(error), app_state: String(error) } };
  }
}

export function hasTableMissingError(error?: string): boolean {
  if (!error) return false;
  return /does not exist|42P01|Could not find the table/i.test(error);
}

export function hasConfigError(error?: string): boolean {
  if (!error) return false;
  return /configur|apikey|EXPO_PUBLIC_SUPABASE/i.test(error);
}

const BASE_SETUP_SQL = `
create table if not exists public.users (
  email text primary key,
  cpf text,
  name text,
  phone text,
  city text,
  state text,
  avatar_url text,
  selfie_url text,
  document_url text,
  identity_verified boolean default false,
  profile jsonb not null default '{}'::jsonb,
  balance numeric not null default 0,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_cpf_idx on public.users (cpf);
create index if not exists users_updated_at_idx on public.users (updated_at desc);

create table if not exists public.app_state (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists app_state_updated_at_idx on public.app_state (updated_at desc);
`;

export function getSetupSql(): string {
  return [BASE_SETUP_SQL.trim(), getSponsorVideoStorageSetupSql().trim()].join('\n\n');
}
