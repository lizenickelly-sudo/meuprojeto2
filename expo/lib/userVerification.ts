import type { UserProfile } from '@/types';

export function isUserAccountActivated(profile: UserProfile): boolean {
  return profile.isActive === true || profile.adminReviewStatus === 'approved';
}

export function isUserVerificationApproved(profile: UserProfile): boolean {
  return isUserAccountActivated(profile);
}

export function hasPendingUserVerification(profile: UserProfile): boolean {
  if (isUserVerificationApproved(profile)) return false;
  if (profile.adminReviewStatus === 'rejected') return false;

  return Boolean(
    profile.adminReviewStatus === 'pending' ||
    (profile.selfieUrl && profile.documentUrl && profile.cpf)
  );
}