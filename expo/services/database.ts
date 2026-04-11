import { supabase, checkSupabaseConfigured } from '@/lib/supabase';
import { mockSponsors } from '@/mocks/sponsors';
import { mockWinners, mockGrandPrize } from '@/mocks/winners';
import { mockLeaderboard } from '@/mocks/leaderboard';
import type { Sponsor, Offer, SponsorStory, Winner, GrandPrize, UserProfile } from '@/types';
import type { LeaderboardEntry } from '@/mocks/leaderboard';

interface DbSponsor {
  id: string;
  name: string;
  category: string;
  image_url: string;
  logo_url: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  phone: string;
  description: string;
  min_purchase_value: number;
  verified: boolean;
  coupon_value: number | null;
  created_at?: string;
}

interface DbOffer {
  id: string;
  sponsor_id: string;
  sponsor_name: string;
  title: string;
  description: string;
  image_url: string;
  discount: string;
  likes: number;
  comments: number;
  shares: number;
}

interface DbStory {
  id: string;
  sponsor_id: string;
  sponsor_name: string;
  sponsor_logo: string;
  image_url: string;
  title: string;
  expires_at: string;
}

interface DbWinner {
  id: string;
  name: string;
  city: string;
  amount: number;
  type: string;
  date: string;
}

interface DbGrandPrize {
  id: string;
  title: string;
  value: number;
  image_url: string;
  background_image_url: string | null;
  draw_date: string;
  lottery_reference: string;
  description: string;
  winner_name: string | null;
  winner_city: string | null;
  is_active: boolean;
  city: string | null;
  state: string | null;
}

interface DbUser {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  pix_key: string;
  pix_key_type: string;
  avatar_url: string | null;
  referral_code: string | null;
  referred_by: string | null;
  identity_verified: boolean;
  selfie_url: string | null;
  document_url: string | null;
  balance: number;
  points: number;
  created_at: string;
}

interface DbLeaderboard {
  id: string;
  name: string;
  city: string;
  avatar_initials: string;
  shares: number;
  points: number;
  rank: number;
  trend: string;
}

function dbSponsorToApp(s: DbSponsor, offers: DbOffer[], stories: DbStory[]): Sponsor {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    imageUrl: s.image_url,
    logoUrl: s.logo_url,
    address: s.address,
    city: s.city,
    state: s.state,
    latitude: s.latitude,
    longitude: s.longitude,
    phone: s.phone,
    description: s.description,
    minPurchaseValue: s.min_purchase_value,
    verified: s.verified,
    couponValue: s.coupon_value ?? undefined,
    offers: offers.map((o) => ({
      id: o.id,
      sponsorId: o.sponsor_id,
      sponsorName: o.sponsor_name,
      title: o.title,
      description: o.description,
      imageUrl: o.image_url,
      discount: o.discount,
      likes: o.likes,
      comments: o.comments,
      shares: o.shares,
    })),
    stories: stories.map((st) => ({
      id: st.id,
      sponsorId: st.sponsor_id,
      sponsorName: st.sponsor_name,
      sponsorLogo: st.sponsor_logo,
      imageUrl: st.image_url,
      title: st.title,
      expiresAt: st.expires_at,
    })),
  };
}

function appSponsorToDb(s: Sponsor): { sponsor: Omit<DbSponsor, 'created_at'>; offers: DbOffer[]; stories: DbStory[] } {
  return {
    sponsor: {
      id: s.id,
      name: s.name,
      category: s.category,
      image_url: s.imageUrl,
      logo_url: s.logoUrl,
      address: s.address,
      city: s.city,
      state: s.state,
      latitude: s.latitude,
      longitude: s.longitude,
      phone: s.phone,
      description: s.description,
      min_purchase_value: s.minPurchaseValue,
      verified: s.verified,
      coupon_value: s.couponValue ?? null,
    },
    offers: s.offers.map((o) => ({
      id: o.id,
      sponsor_id: s.id,
      sponsor_name: o.sponsorName,
      title: o.title,
      description: o.description,
      image_url: o.imageUrl,
      discount: o.discount,
      likes: o.likes,
      comments: o.comments,
      shares: o.shares,
    })),
    stories: (s.stories ?? []).map((st) => ({
      id: st.id,
      sponsor_id: s.id,
      sponsor_name: st.sponsorName,
      sponsor_logo: st.sponsorLogo,
      image_url: st.imageUrl,
      title: st.title,
      expires_at: st.expiresAt,
    })),
  };
}

export async function fetchSponsors(): Promise<Sponsor[]> {
  if (!checkSupabaseConfigured()) {
    console.log('[DB] Supabase not configured, using mocks');
    return mockSponsors;
  }

  try {
    const { data: sponsorsData, error: sponsorsError } = await supabase
      .from('sponsors')
      .select('*')
      .order('name');

    if (sponsorsError || !sponsorsData || sponsorsData.length === 0) {
      console.log('[DB] No sponsors in Supabase, using mocks:', sponsorsError?.message);
      return mockSponsors;
    }

    const { data: offersData } = await supabase.from('offers').select('*');
    const { data: storiesData } = await supabase.from('sponsor_stories').select('*');

    const offers = (offersData ?? []) as DbOffer[];
    const stories = (storiesData ?? []) as DbStory[];

    const result = (sponsorsData as DbSponsor[]).map((s) => {
      const sponsorOffers = offers.filter((o) => o.sponsor_id === s.id);
      const sponsorStories = stories.filter((st) => st.sponsor_id === s.id);
      return dbSponsorToApp(s, sponsorOffers, sponsorStories);
    });

    console.log('[DB] Fetched', result.length, 'sponsors from Supabase');
    return result;
  } catch (err) {
    console.log('[DB] Error fetching sponsors:', err);
    return mockSponsors;
  }
}

export async function upsertSponsor(sponsor: Sponsor): Promise<boolean> {
  if (!checkSupabaseConfigured()) {
    console.log('[DB] Supabase not configured, skip upsert');
    return false;
  }

  try {
    const { sponsor: dbSponsor, offers, stories } = appSponsorToDb(sponsor);

    const { error: sponsorError } = await supabase
      .from('sponsors')
      .upsert(dbSponsor, { onConflict: 'id' });

    if (sponsorError) {
      console.log('[DB] Error upserting sponsor:', sponsorError.message);
      return false;
    }

    await supabase.from('offers').delete().eq('sponsor_id', sponsor.id);
    if (offers.length > 0) {
      await supabase.from('offers').insert(offers);
    }

    await supabase.from('sponsor_stories').delete().eq('sponsor_id', sponsor.id);
    if (stories.length > 0) {
      await supabase.from('sponsor_stories').insert(stories);
    }

    console.log('[DB] Upserted sponsor:', sponsor.name);
    return true;
  } catch (err) {
    console.log('[DB] Error upserting sponsor:', err);
    return false;
  }
}

export async function removeSponsor(sponsorId: string): Promise<boolean> {
  if (!checkSupabaseConfigured()) return false;

  try {
    await supabase.from('offers').delete().eq('sponsor_id', sponsorId);
    await supabase.from('sponsor_stories').delete().eq('sponsor_id', sponsorId);
    const { error } = await supabase.from('sponsors').delete().eq('id', sponsorId);
    if (error) {
      console.log('[DB] Error deleting sponsor:', error.message);
      return false;
    }
    console.log('[DB] Deleted sponsor:', sponsorId);
    return true;
  } catch (err) {
    console.log('[DB] Error deleting sponsor:', err);
    return false;
  }
}

export async function fetchWinners(): Promise<Winner[]> {
  if (!checkSupabaseConfigured()) return mockWinners;

  try {
    const { data, error } = await supabase
      .from('winners')
      .select('*')
      .order('date', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) {
      console.log('[DB] No winners in Supabase, using mocks');
      return mockWinners;
    }

    return (data as DbWinner[]).map((w) => ({
      id: w.id,
      name: w.name,
      city: w.city,
      amount: w.amount,
      type: w.type as Winner['type'],
      date: w.date,
    }));
  } catch {
    return mockWinners;
  }
}

export async function fetchGrandPrize(): Promise<GrandPrize> {
  if (!checkSupabaseConfigured()) return mockGrandPrize;

  try {
    const { data, error } = await supabase
      .from('grand_prizes')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error || !data) {
      console.log('[DB] No active grand prize in Supabase, using mock');
      return mockGrandPrize;
    }

    const d = data as DbGrandPrize;
    return {
      id: d.id,
      title: d.title,
      value: d.value,
      imageUrl: d.image_url,
      backgroundImageUrl: d.background_image_url ?? undefined,
      drawDate: d.draw_date,
      lotteryReference: d.lottery_reference,
      description: d.description,
      winnerName: d.winner_name ?? undefined,
      winnerCity: d.winner_city ?? undefined,
      isActive: d.is_active,
      city: d.city ?? undefined,
      state: d.state ?? undefined,
    };
  } catch {
    return mockGrandPrize;
  }
}

function dbUserToApp(u: DbUser): UserProfile {
  return {
    id: u.id,
    name: u.name,
    cpf: u.cpf,
    phone: u.phone,
    email: u.email,
    city: u.city,
    state: u.state,
    pixKey: u.pix_key,
    pixKeyType: (u.pix_key_type || 'cpf') as UserProfile['pixKeyType'],
    avatarUrl: u.avatar_url ?? undefined,
    referralCode: u.referral_code ?? undefined,
    referredBy: u.referred_by ?? undefined,
    identityVerified: u.identity_verified,
    selfieUrl: u.selfie_url ?? undefined,
    documentUrl: u.document_url ?? undefined,
    createdAt: u.created_at,
  };
}

function appUserToDb(p: UserProfile, balance: number = 0, points: number = 0): DbUser {
  return {
    id: p.id,
    name: p.name,
    cpf: p.cpf,
    phone: p.phone,
    email: p.email,
    city: p.city,
    state: p.state,
    pix_key: p.pixKey,
    pix_key_type: p.pixKeyType,
    avatar_url: p.avatarUrl ?? null,
    referral_code: p.referralCode ?? null,
    referred_by: p.referredBy ?? null,
    identity_verified: p.identityVerified ?? false,
    selfie_url: p.selfieUrl ?? null,
    document_url: p.documentUrl ?? null,
    balance,
    points,
    created_at: p.createdAt,
  };
}

export async function upsertUser(profile: UserProfile, balance: number = 0, points: number = 0): Promise<boolean> {
  if (!checkSupabaseConfigured()) {
    console.log('[DB] Supabase not configured, skip user upsert');
    return false;
  }

  try {
    const dbUser = appUserToDb(profile, balance, points);
    const { error } = await supabase
      .from('usuarios')
      .upsert(dbUser, { onConflict: 'id' });

    if (error) {
      console.log('[DB] Error upserting user:', error.message, error.code);
      return false;
    }
    console.log('[DB] Upserted user:', profile.name, profile.id);
    return true;
  } catch (err) {
    console.log('[DB] Exception upserting user:', err);
    return false;
  }
}

export async function fetchUserByCpf(cpf: string): Promise<UserProfile | null> {
  if (!checkSupabaseConfigured()) return null;

  try {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) return null;

    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('cpf', cpf)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      const formatted = `${cleanCpf.slice(0,3)}.${cleanCpf.slice(3,6)}.${cleanCpf.slice(6,9)}-${cleanCpf.slice(9)}`;
      const { data: data2, error: error2 } = await supabase
        .from('usuarios')
        .select('*')
        .eq('cpf', formatted)
        .limit(1)
        .maybeSingle();

      if (error2 || !data2) {
        console.log('[DB] User not found by CPF:', cpf);
        return null;
      }
      return dbUserToApp(data2 as DbUser);
    }
    console.log('[DB] Found user by CPF:', data.name);
    return dbUserToApp(data as DbUser);
  } catch (err) {
    console.log('[DB] Exception fetching user by CPF:', err);
    return null;
  }
}

export async function fetchUser(userId: string): Promise<UserProfile | null> {
  if (!checkSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.log('[DB] User not found:', userId, error?.message);
      return null;
    }
    return dbUserToApp(data as DbUser);
  } catch (err) {
    console.log('[DB] Exception fetching user:', err);
    return null;
  }
}

export async function fetchAllUsers(): Promise<{ profile: UserProfile; balance: number; points: number }[]> {
  if (!checkSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.log('[DB] Error fetching users:', error?.message);
      return [];
    }

    return (data as DbUser[]).map((u) => ({
      profile: dbUserToApp(u),
      balance: u.balance,
      points: u.points,
    }));
  } catch (err) {
    console.log('[DB] Exception fetching users:', err);
    return [];
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!checkSupabaseConfigured()) return mockLeaderboard;

  try {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('rank')
      .limit(20);

    if (error || !data || data.length === 0) {
      console.log('[DB] No leaderboard in Supabase, using mocks');
      return mockLeaderboard;
    }

    return (data as DbLeaderboard[]).map((e) => ({
      id: e.id,
      name: e.name,
      city: e.city,
      avatarInitials: e.avatar_initials,
      shares: e.shares,
      points: e.points,
      rank: e.rank,
      trend: e.trend as LeaderboardEntry['trend'],
    }));
  } catch {
    return mockLeaderboard;
  }
}

export async function seedSponsorsToSupabase(): Promise<{ success: boolean; count: number; error?: string }> {
  if (!checkSupabaseConfigured()) {
    return { success: false, count: 0, error: 'Supabase nao configurado' };
  }

  try {
    const firstSponsor = mockSponsors[0];
    if (!firstSponsor) return { success: false, count: 0, error: 'Nenhum mock sponsor encontrado' };

    const { sponsor: dbFirst } = appSponsorToDb(firstSponsor);
    const { error: testError } = await supabase
      .from('sponsors')
      .upsert(dbFirst, { onConflict: 'id' });

    if (testError) {
      console.log('[DB] First sponsor upsert failed:', testError.message, testError.code, testError.details);
      if (testError.code === '42P01' || testError.message?.includes('does not exist')) {
        return { success: false, count: 0, error: 'Tabela "sponsors" nao existe. Execute o SQL de setup.' };
      }
      if (testError.code === '42501') {
        return { success: false, count: 0, error: 'Sem permissao para inserir em "sponsors". Verifique RLS policies.' };
      }
      return { success: false, count: 0, error: `Erro sponsors: ${testError.message}` };
    }

    let count = 1;
    const errors: string[] = [];

    for (let i = 1; i < mockSponsors.length; i++) {
      const ok = await upsertSponsor(mockSponsors[i]);
      if (ok) {
        count++;
      } else {
        errors.push(mockSponsors[i].name);
      }
    }

    console.log('[DB] Seeded', count, 'sponsors to Supabase, failed:', errors);
    return { success: true, count };
  } catch (err: any) {
    console.log('[DB] Error seeding sponsors:', err);
    return { success: false, count: 0, error: err?.message ?? 'Erro desconhecido' };
  }
}

export async function seedWinnersToSupabase(): Promise<{ ok: boolean; error?: string }> {
  if (!checkSupabaseConfigured()) return { ok: false, error: 'Supabase nao configurado' };

  try {
    const dbWinners = mockWinners.map((w) => ({
      id: w.id,
      name: w.name,
      city: w.city,
      amount: w.amount,
      type: w.type,
      date: w.date,
    }));

    const { error } = await supabase.from('winners').upsert(dbWinners, { onConflict: 'id' });
    if (error) {
      console.log('[DB] Error seeding winners:', error.message, error.code, error.details);
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return { ok: false, error: 'Tabela "winners" nao existe. Execute o SQL de setup.' };
      }
      return { ok: false, error: error.message };
    }
    console.log('[DB] Seeded', dbWinners.length, 'winners');
    return { ok: true };
  } catch (err: any) {
    console.log('[DB] Exception seeding winners:', err);
    return { ok: false, error: err?.message ?? 'Erro desconhecido' };
  }
}

export async function seedLeaderboardToSupabase(): Promise<{ ok: boolean; error?: string }> {
  if (!checkSupabaseConfigured()) return { ok: false, error: 'Supabase nao configurado' };

  try {
    const dbEntries = mockLeaderboard.map((e) => ({
      id: e.id,
      name: e.name,
      city: e.city,
      avatar_initials: e.avatarInitials,
      shares: e.shares,
      points: e.points,
      rank: e.rank,
      trend: e.trend,
    }));

    const { error } = await supabase.from('leaderboard').upsert(dbEntries, { onConflict: 'id' });
    if (error) {
      console.log('[DB] Error seeding leaderboard:', error.message, error.code, error.details);
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return { ok: false, error: 'Tabela "leaderboard" nao existe. Execute o SQL de setup.' };
      }
      return { ok: false, error: error.message };
    }
    console.log('[DB] Seeded', dbEntries.length, 'leaderboard entries');
    return { ok: true };
  } catch (err: any) {
    console.log('[DB] Exception seeding leaderboard:', err);
    return { ok: false, error: err?.message ?? 'Erro desconhecido' };
  }
}

export async function seedGrandPrizeToSupabase(): Promise<{ ok: boolean; error?: string }> {
  if (!checkSupabaseConfigured()) return { ok: false, error: 'Supabase nao configurado' };

  try {
    const prize: DbGrandPrize = {
      id: mockGrandPrize.id,
      title: mockGrandPrize.title,
      value: mockGrandPrize.value,
      image_url: mockGrandPrize.imageUrl,
      background_image_url: mockGrandPrize.backgroundImageUrl ?? null,
      draw_date: mockGrandPrize.drawDate,
      lottery_reference: mockGrandPrize.lotteryReference,
      description: mockGrandPrize.description,
      winner_name: null,
      winner_city: null,
      is_active: mockGrandPrize.isActive,
      city: null,
      state: null,
    };

    const { error } = await supabase.from('grand_prizes').upsert(prize, { onConflict: 'id' });
    if (error) {
      console.log('[DB] Error seeding grand prize:', error.message, error.code, error.details);
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return { ok: false, error: 'Tabela "grand_prizes" nao existe. Execute o SQL de setup.' };
      }
      return { ok: false, error: error.message };
    }
    console.log('[DB] Seeded grand prize:', prize.title);
    return { ok: true };
  } catch (err: any) {
    console.log('[DB] Exception seeding grand prize:', err);
    return { ok: false, error: err?.message ?? 'Erro desconhecido' };
  }
}

export interface SeedResult {
  sponsors: { count: number; error?: string };
  winners: { ok: boolean; error?: string };
  leaderboard: { ok: boolean; error?: string };
  grandPrize: { ok: boolean; error?: string };
}

export async function checkTablesExist(): Promise<{ missing: string[]; errors: Record<string, string> }> {
  if (!checkSupabaseConfigured()) return { missing: ['all'], errors: { all: 'Supabase nao configurado' } };

  const tables = ['sponsors', 'offers', 'sponsor_stories', 'winners', 'grand_prizes', 'leaderboard', 'usuarios'];
  const missing: string[] = [];
  const errors: Record<string, string> = {};

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`[DB] Table '${table}' check failed:`, error.message, error.code);
        missing.push(table);
        errors[table] = error.message;
      }
    } catch (err: any) {
      missing.push(table);
      errors[table] = err?.message ?? 'Erro';
    }
  }

  return { missing, errors };
}

export function hasTableMissingError(error?: string): boolean {
  if (!error) return false;
  return (
    error.includes('does not exist') ||
    error.includes('42P01') ||
    error.includes('nao existe') ||
    error.includes('relation') ||
    error.includes('undefined_table')
  );
}

export function hasConfigError(error?: string): boolean {
  if (!error) return false;
  return error.includes('nao configurado');
}

export async function seedAllToSupabase(): Promise<SeedResult> {
  if (!checkSupabaseConfigured()) {
    console.log('[DB] Supabase NOT configured!');
    console.log('[DB] URL value:', process.env.EXPO_PUBLIC_SUPABASE_URL ? 'SET' : 'EMPTY');
    console.log('[DB] Key value:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'EMPTY');
    const configError = 'Supabase nao configurado. Verifique as variaveis de ambiente EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.';
    return {
      sponsors: { count: 0, error: configError },
      winners: { ok: false, error: configError },
      leaderboard: { ok: false, error: configError },
      grandPrize: { ok: false, error: configError },
    };
  }

  console.log('[DB] Starting seed - trying each operation independently...');

  const [sponsorsResult, winners, leaderboard, grandPrize] = await Promise.all([
    seedSponsorsToSupabase(),
    seedWinnersToSupabase(),
    seedLeaderboardToSupabase(),
    seedGrandPrizeToSupabase(),
  ]);

  console.log('[DB] Seed results:', {
    sponsors: { count: sponsorsResult.count, error: sponsorsResult.error },
    winnersOk: winners.ok, winnersError: winners.error,
    leaderboardOk: leaderboard.ok, leaderboardError: leaderboard.error,
    grandPrizeOk: grandPrize.ok, grandPrizeError: grandPrize.error,
  });

  return {
    sponsors: { count: sponsorsResult.count, error: sponsorsResult.error },
    winners,
    leaderboard,
    grandPrize,
  };
}

export const SETUP_SQL = `
-- Run this SQL in your Supabase SQL Editor to create the required tables

CREATE TABLE IF NOT EXISTS sponsors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION NOT NULL DEFAULT 0,
  longitude DOUBLE PRECISION NOT NULL DEFAULT 0,
  phone TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  min_purchase_value DOUBLE PRECISION NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT false,
  coupon_value DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  sponsor_id TEXT NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  sponsor_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  discount TEXT NOT NULL DEFAULT '',
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sponsor_stories (
  id TEXT PRIMARY KEY,
  sponsor_id TEXT NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  sponsor_name TEXT NOT NULL,
  sponsor_logo TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS winners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'coupon',
  date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS grand_prizes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL DEFAULT '',
  background_image_url TEXT,
  draw_date TEXT NOT NULL,
  lottery_reference TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  winner_name TEXT,
  winner_city TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  city TEXT,
  state TEXT
);

CREATE TABLE IF NOT EXISTS leaderboard (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  avatar_initials TEXT NOT NULL DEFAULT '',
  shares INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL DEFAULT 0,
  trend TEXT NOT NULL DEFAULT 'same'
);

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  cpf TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  pix_key TEXT NOT NULL DEFAULT '',
  pix_key_type TEXT NOT NULL DEFAULT 'cpf',
  avatar_url TEXT,
  referral_code TEXT,
  referred_by TEXT,
  identity_verified BOOLEAN NOT NULL DEFAULT false,
  selfie_url TEXT,
  document_url TEXT,
  balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE grand_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Public read access policies
CREATE POLICY "Public read sponsors" ON sponsors FOR SELECT USING (true);
CREATE POLICY "Public read offers" ON offers FOR SELECT USING (true);
CREATE POLICY "Public read stories" ON sponsor_stories FOR SELECT USING (true);
CREATE POLICY "Public read winners" ON winners FOR SELECT USING (true);
CREATE POLICY "Public read grand_prizes" ON grand_prizes FOR SELECT USING (true);
CREATE POLICY "Public read leaderboard" ON leaderboard FOR SELECT USING (true);
CREATE POLICY "Public read usuarios" ON usuarios FOR SELECT USING (true);

-- Public write access (for admin from app - in production use service role)
CREATE POLICY "Public insert sponsors" ON sponsors FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update sponsors" ON sponsors FOR UPDATE USING (true);
CREATE POLICY "Public delete sponsors" ON sponsors FOR DELETE USING (true);

CREATE POLICY "Public insert offers" ON offers FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update offers" ON offers FOR UPDATE USING (true);
CREATE POLICY "Public delete offers" ON offers FOR DELETE USING (true);

CREATE POLICY "Public insert stories" ON sponsor_stories FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update stories" ON sponsor_stories FOR UPDATE USING (true);
CREATE POLICY "Public delete stories" ON sponsor_stories FOR DELETE USING (true);

CREATE POLICY "Public insert winners" ON winners FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update winners" ON winners FOR UPDATE USING (true);

CREATE POLICY "Public insert grand_prizes" ON grand_prizes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update grand_prizes" ON grand_prizes FOR UPDATE USING (true);

CREATE POLICY "Public insert leaderboard" ON leaderboard FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update leaderboard" ON leaderboard FOR UPDATE USING (true);

CREATE POLICY "Public insert usuarios" ON usuarios FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update usuarios" ON usuarios FOR UPDATE USING (true);
CREATE POLICY "Public delete usuarios" ON usuarios FOR DELETE USING (true);
`;
