import type { AdminNotification, Sponsor, UserProfile } from '@/types';

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export function normalizeMissionText(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function normalizeMissionUserKey(profile?: Partial<UserProfile> | null): string {
  const rawKey = profile?.email || profile?.id || profile?.cpf || '';
  return normalizeMissionText(rawKey);
}

export function isCityBonusNotification(notification?: AdminNotification | null): boolean {
  if (!notification) return false;

  return notification.type === 'city_bonus' || notification.metadata?.kind === 'city_bonus';
}

export function matchesMissionCity(
  notification: AdminNotification,
  city?: string | null,
  state?: string | null,
): boolean {
  const notificationCity = normalizeMissionText(notification.metadata?.sponsorCity);
  const userCity = normalizeMissionText(city);
  if (!notificationCity || !userCity || notificationCity !== userCity) return false;

  const notificationState = normalizeMissionText(notification.metadata?.sponsorState);
  const userState = normalizeMissionText(state);
  if (notificationState && userState && notificationState !== userState) return false;

  return true;
}

export function getMissionExpiresAt(notification: AdminNotification): number | null {
  const expiresAt = notification.metadata?.expiresAt;
  if (expiresAt) {
    const parsed = Date.parse(expiresAt);
    if (Number.isFinite(parsed)) return parsed;
  }

  const durationMinutes = notification.metadata?.bonusTimeLimitMinutes;
  if (durationMinutes && durationMinutes > 0) {
    const createdAt = Date.parse(notification.createdAt);
    if (Number.isFinite(createdAt)) {
      return createdAt + durationMinutes * 60 * 1000;
    }
  }

  return null;
}

export function getRemainingCityBonusMs(notification: AdminNotification, now: number = Date.now()): number {
  const expiresAt = getMissionExpiresAt(notification);
  if (expiresAt === null) return 0;
  return Math.max(0, expiresAt - now);
}

export function isCityBonusExpired(notification: AdminNotification, now: number = Date.now()): boolean {
  const expiresAt = getMissionExpiresAt(notification);
  if (expiresAt === null) return false;
  return expiresAt <= now;
}

export function hasUserClaimedCityBonus(notification: AdminNotification, userKey?: string | null): boolean {
  const normalizedUserKey = normalizeMissionText(userKey);
  if (!normalizedUserKey) return false;

  return (notification.metadata?.claimedBy || []).some((item) => normalizeMissionText(item) === normalizedUserKey);
}

export function getActiveCityBonusNotification(
  notifications: AdminNotification[],
  profile?: Partial<UserProfile> | null,
  now: number = Date.now(),
): AdminNotification | null {
  const userKey = normalizeMissionUserKey(profile);

  return notifications
    .filter((notification) => notification.sent)
    .filter(isCityBonusNotification)
    .filter((notification) => matchesMissionCity(notification, profile?.city, profile?.state))
    .filter((notification) => !isCityBonusExpired(notification, now))
    .filter((notification) => !hasUserClaimedCityBonus(notification, userKey))
    .sort((a, b) => {
      const aExpires = getMissionExpiresAt(a) ?? 0;
      const bExpires = getMissionExpiresAt(b) ?? 0;
      if (aExpires !== bExpires) return aExpires - bExpires;

      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    })[0] ?? null;
}

export function getDistanceMeters(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
): number {
  const earthRadiusKm = 6371;
  const dLat = ((toLatitude - fromLatitude) * Math.PI) / 180;
  const dLon = ((toLongitude - fromLongitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((fromLatitude * Math.PI) / 180) * Math.cos((toLatitude * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadiusKm * c * 1000);
}

export function formatDistanceLabel(distanceMeters: number): string {
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(1)} km`;
  }

  return `${distanceMeters} m`;
}

export function buildMissionRoute(
  origin: MapCoordinate,
  target: MapCoordinate,
  steps: number = 24,
): MapCoordinate[] {
  const safeSteps = Math.max(2, steps);
  const points: MapCoordinate[] = [];

  for (let index = 0; index <= safeSteps; index += 1) {
    const progress = index / safeSteps;
    points.push({
      latitude: origin.latitude + (target.latitude - origin.latitude) * progress,
      longitude: origin.longitude + (target.longitude - origin.longitude) * progress,
    });
  }

  return points;
}

export function parseCityBonusPayload(rawData: string): { code: string; sponsorId?: string; notificationId?: string } | null {
  try {
    const parsed = JSON.parse(rawData) as { type?: string; code?: string; sponsorId?: string; notificationId?: string };
    if (parsed.type !== 'cashbox_city_bonus') return null;

    const code = String(parsed.code || '').trim();
    if (!code) return null;

    return {
      code,
      sponsorId: parsed.sponsorId ? String(parsed.sponsorId) : undefined,
      notificationId: parsed.notificationId ? String(parsed.notificationId) : undefined,
    };
  } catch {
    return null;
  }
}

export function matchesCityBonusScan(rawData: string, expectedCode?: string | null): boolean {
  const normalizedExpectedCode = String(expectedCode || '').trim();
  if (!normalizedExpectedCode) return false;

  if (String(rawData || '').trim() === normalizedExpectedCode) {
    return true;
  }

  const parsed = parseCityBonusPayload(rawData);
  return parsed?.code === normalizedExpectedCode;
}