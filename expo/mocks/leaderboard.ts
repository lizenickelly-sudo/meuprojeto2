export interface LeaderboardEntry {
  id: string;
  name: string;
  city: string;
  avatarInitials: string;
  shares: number;
  points: number;
  rank: number;
  trend: 'up' | 'down' | 'same';
}

export const mockLeaderboard: LeaderboardEntry[] = [
  { id: 'lb1', name: 'Fernanda R.', city: 'São Paulo', avatarInitials: 'FR', shares: 87, points: 870, rank: 1, trend: 'up' },
  { id: 'lb2', name: 'Carlos M.', city: 'São Paulo', avatarInitials: 'CM', shares: 74, points: 740, rank: 2, trend: 'same' },
  { id: 'lb3', name: 'Ana Beatriz S.', city: 'Rio de Janeiro', avatarInitials: 'AB', shares: 68, points: 680, rank: 3, trend: 'up' },
  { id: 'lb4', name: 'João P.', city: 'Belo Horizonte', avatarInitials: 'JP', shares: 55, points: 550, rank: 4, trend: 'down' },
  { id: 'lb5', name: 'Maria L.', city: 'São Paulo', avatarInitials: 'ML', shares: 49, points: 490, rank: 5, trend: 'up' },
  { id: 'lb6', name: 'Pedro H.', city: 'Curitiba', avatarInitials: 'PH', shares: 43, points: 430, rank: 6, trend: 'down' },
  { id: 'lb7', name: 'Luciana G.', city: 'Salvador', avatarInitials: 'LG', shares: 38, points: 380, rank: 7, trend: 'same' },
  { id: 'lb8', name: 'Roberto F.', city: 'Fortaleza', avatarInitials: 'RF', shares: 31, points: 310, rank: 8, trend: 'up' },
  { id: 'lb9', name: 'Juliana T.', city: 'São Paulo', avatarInitials: 'JT', shares: 27, points: 270, rank: 9, trend: 'down' },
  { id: 'lb10', name: 'Diego A.', city: 'Manaus', avatarInitials: 'DA', shares: 22, points: 220, rank: 10, trend: 'same' },
];

export const WEEKLY_PRIZES = [
  { rank: 1, bonus: 500 },
  { rank: 2, bonus: 300 },
  { rank: 3, bonus: 150 },
];
