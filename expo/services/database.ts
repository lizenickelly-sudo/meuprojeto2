import { mockSponsors } from '@/mocks/sponsors';
import { mockWinners, mockGrandPrize } from '@/mocks/winners';
import { mockLeaderboard } from '@/mocks/leaderboard';
import type { Sponsor, Winner, GrandPrize, UserProfile } from '@/types';
import type { LeaderboardEntry } from '@/mocks/leaderboard';

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
  console.log('[DB] upsertUser - local only, no remote DB');
  return false;
}

export async function fetchUserByCpf(_cpf: string): Promise<UserProfile | null> {
  console.log('[DB] fetchUserByCpf - local only, no remote DB');
  return null;
}

export async function fetchUser(_userId: string): Promise<UserProfile | null> {
  console.log('[DB] fetchUser - local only, no remote DB');
  return null;
}

export async function fetchAllUsers(): Promise<{ profile: UserProfile; balance: number; points: number }[]> {
  console.log('[DB] fetchAllUsers - local only, no remote DB');
  return [];
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
  console.log('[DB] seedAllToSupabase - no remote DB configured');
  return {
    sponsors: { count: 0, error: 'Banco de dados remoto nao configurado' },
    winners: { ok: false, error: 'Banco de dados remoto nao configurado' },
    leaderboard: { ok: false, error: 'Banco de dados remoto nao configurado' },
    grandPrize: { ok: false, error: 'Banco de dados remoto nao configurado' },
  };
}

export async function checkTablesExist(): Promise<{ missing: string[]; errors: Record<string, string> }> {
  return { missing: [], errors: {} };
}

export function hasTableMissingError(_error?: string): boolean {
  return false;
}

export function hasConfigError(_error?: string): boolean {
  return false;
}

export const SETUP_SQL = '';
