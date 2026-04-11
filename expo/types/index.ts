export interface PixKeyEntry {
  id: string;
  type: 'cpf' | 'phone' | 'email' | 'random';
  value: string;
}

export interface UserProfile {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  pixKey: string;
  pixKeyType: 'cpf' | 'phone' | 'email' | 'random';
  pixKeys?: PixKeyEntry[];
  pixCpf?: string;
  pixPhone?: string;
  pixEmail?: string;
  pixRandom?: string;
  avatarUrl?: string;
  createdAt: string;
  referralCode?: string;
  referredBy?: string;
  identityVerified?: boolean;
  selfieUrl?: string;
  documentUrl?: string;
  savedFields?: Record<string, boolean>;
}

export interface Coupon {
  id: string;
  code: string;
  value: number;
  sponsorId: string;
  sponsorName: string;
  status: 'valid' | 'used' | 'expired';
  scannedAt: string;
  expiresAt: string;
  drawId: string;
}

export interface SponsorImage {
  id: string;
  url: string;
  price?: number;
  label?: string;
}

export interface Sponsor {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  logoUrl: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  phone: string;
  whatsapp?: string;
  description: string;
  offers: Offer[];
  minPurchaseValue: number;
  verified: boolean;
  couponValue?: number;
  stories?: SponsorStory[];
  galleryImages?: SponsorImage[];
}

export interface SponsorStory {
  id: string;
  sponsorId: string;
  sponsorName: string;
  sponsorLogo: string;
  imageUrl: string;
  title: string;
  expiresAt: string;
}

export interface Offer {
  id: string;
  sponsorId: string;
  sponsorName: string;
  title: string;
  description: string;
  imageUrl: string;
  discount: string;
  likes: number;
  comments: number;
  shares: number;
  isLiked?: boolean;
}

export interface Transaction {
  id: string;
  type: 'credit' | 'debit' | 'points';
  description: string;
  amount: number;
  date: string;
  status: 'completed' | 'pending' | 'failed';
  pixKey?: string;
  receiptId?: string;
}

export interface Winner {
  id: string;
  name: string;
  city: string;
  amount: number;
  type: 'coupon' | 'grand_prize';
  date: string;
}

export interface GrandPrize {
  id: string;
  title: string;
  value: number;
  imageUrl: string;
  backgroundImageUrl?: string;
  drawDate: string;
  lotteryReference: string;
  description: string;
  winnerName?: string;
  winnerCity?: string;
  isActive: boolean;
  city?: string;
  state?: string;
}

export interface ScannedMessage {
  id: string;
  code: string;
  sponsorId: string;
  sponsorName: string;
  sponsorAddress: string;
  message: string;
  couponValue: number;
  minPurchase: number;
  scannedAt: string;
  status: 'pending' | 'redeemed' | 'expired';
}

export interface PromotionalQR {
  id: string;
  sponsorId: string;
  sponsorName: string;
  sponsorAddress: string;
  city: string;
  state: string;
  message: string;
  couponValue: number;
  minPurchase: number;
  createdAt: string;
  active: boolean;
}

export interface CouponBatch {
  id: string;
  sponsorId: string;
  sponsorName: string;
  quantity: number;
  value: number;
  prefix: string;
  createdAt: string;
  codes: string[];
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: 'general' | 'promo' | 'prize';
  createdAt: string;
  sent: boolean;
}
