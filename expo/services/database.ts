import { mockSponsors } from '@/mocks/sponsors';
import { mockWinners, mockGrandPrize } from '@/mocks/winners';
import { mockLeaderboard } from '@/mocks/leaderboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Sponsor, Winner, GrandPrize, UserProfile } from '@/types';
import type { LeaderboardEntry } from '@/mocks/leaderboard';

const DB_KEYS = {
  USERS: 'cashboxpix_db_users',
};

type PersistedUserRow = {
  profile: UserProfile;
  balance: number;
  points: number;
  updatedAt: string;
};

type RemoteUserRow = {
  email: string;
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
  console.log('[DB] Using local mock sponsors');
  return mockSponsors;
}

export async function upsertSponsor(_sponsor: Sponsor): Promise<boolean> {
  console.log('[DB] upsertSponsor - local only, no remote DB');
  return false;
}

export async function removeSponsor(_sponsorId: string): Promise<boolean> {
  console.log('[DB] removeSponsor - local only, no remote DB');
  return false;
}

export async function fetchWinners(): Promise<Winner[]> {
  console.log('[DB] Using local mock winners');
  return mockWinners;
}

export async function fetchGrandPrize(): Promise<GrandPrize> {
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
  const remoteRows = await fetchAllUsersRemote();
  if (remoteRows.length) return remoteRows;

  const users = await loadUsersMap();
  return Object.values(users)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((row) => ({ profile: row.profile, balance: row.balance, points: row.points }));
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

  // Se houver configuracao remota, mantemos estes dados locais por enquanto e
  // consideramos apenas a parte de usuarios como sincronizada por upsertUser.
  return {
    sponsors: { count: 0 },
    winners: { ok: true },
    leaderboard: { ok: true },
    grandPrize: { ok: true },
  };
}

export async function checkTablesExist(): Promise<{ missing: string[]; errors: Record<string, string> }> {
  if (!hasSupabaseConfig()) {
    return {
      missing: ['users'],
      errors: { config: 'Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY (ou EXPO_PUBLIC_SUPABASE_KEY)' },
    };
  }

  try {
    const res = await supabaseRequest('/rest/v1/users?select=email&limit=1', { method: 'GET' });
    if (res.ok) return { missing: [], errors: {} };

    const text = await res.text();
    const missing = /relation .*users.* does not exist|42P01|Could not find the table/i.test(text)
      ? ['users']
      : [];
    return { missing, errors: { users: text || 'Falha ao verificar tabela users' } };
  } catch (error) {
    return { missing: ['users'], errors: { users: String(error) } };
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

export const SETUP_SQL = `
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
`;
