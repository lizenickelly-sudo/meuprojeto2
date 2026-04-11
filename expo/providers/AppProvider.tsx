import React, { useCallback } from 'react';
import { ReactNode } from 'react';
import { UserProvider, useUser } from '@/providers/UserProvider';
import { SponsorProvider, useSponsor } from '@/providers/SponsorProvider';
import { AdminProvider, useAdmin } from '@/providers/AdminProvider';
import { CouponProvider, useCoupon } from '@/providers/CouponProvider';
import { NotificationProvider, useNotifications } from '@/providers/NotificationProvider';
import { Coupon, Transaction } from '@/types';

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <SponsorProvider>
        <AdminProvider>
          <CouponProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </CouponProvider>
        </AdminProvider>
      </SponsorProvider>
    </UserProvider>
  );
}

export function useApp() {
  const user = useUser();
  const sponsor = useSponsor();
  const admin = useAdmin();
  const coupon = useCoupon();
  const notif = useNotifications();

  const addCoupon = useCallback((c: Coupon) => {
    coupon.addCouponRaw(c);
    user.addBalance(c.value);
    const tx: Transaction = {
      id: `tx_${Date.now()}`,
      type: 'credit',
      description: `Cupom ${c.sponsorName} - ${c.code}`,
      amount: c.value,
      date: new Date().toISOString(),
      status: 'completed',
    };
    user.addTransaction(tx);
    notif.notifyNewCoupon(c.sponsorName, c.value, c.id);
  }, [coupon, user, notif]);

  const toggleLikeOffer = useCallback((offerId: string): boolean => {
    return sponsor.toggleLikeOffer(offerId, (pts) => user.addPoints(pts));
  }, [sponsor, user]);

  const shareOffer = useCallback((offerId: string): boolean => {
    return sponsor.shareOffer(offerId, (pts) => user.addPoints(pts));
  }, [sponsor, user]);

  return {
    profile: user.profile,
    balance: user.balance,
    points: user.points,
    transactions: user.transactions,
    isLoading: user.isLoading || coupon.isLoading,
    saveProfile: user.saveProfile,
    addBalance: user.addBalance,
    addPoints: user.addPoints,
    addTransaction: user.addTransaction,
    withdraw: user.withdraw,
    withdrawPending: user.withdrawPending,
    referralCount: user.referralCount,
    addReferral: user.addReferral,
    getReferralCode: user.getReferralCode,
    redeemPoints: user.redeemPoints,
    redeemPointsPending: user.redeemPointsPending,
    redeemPointsError: user.redeemPointsError,
    getPointsValue: user.getPointsValue,
    getPointsRedeemInfo: user.getPointsRedeemInfo,

    sponsors: sponsor.sponsors,
    addSponsor: sponsor.addSponsor,
    updateSponsor: sponsor.updateSponsor,
    deleteSponsor: sponsor.deleteSponsor,
    sponsorsByCity: sponsor.sponsorsByCity,
    sponsorsByState: sponsor.sponsorsByState,
    toggleLikeOffer,
    shareOffer,
    isOfferLiked: sponsor.isOfferLiked,
    isOfferShared: sponsor.isOfferShared,
    likedOffers: sponsor.likedOffers,
    sharedOffers: sponsor.sharedOffers,

    isAdmin: admin.isAdmin,
    toggleAdmin: admin.toggleAdmin,
    couponBatches: admin.couponBatches,
    addCouponBatch: admin.addCouponBatch,
    notifications: admin.notifications,
    addNotification: admin.addNotification,
    updateNotification: admin.updateNotification,
    deleteNotification: admin.deleteNotification,
    grandPrizeConfig: admin.grandPrizeConfig,
    saveGrandPrize: admin.saveGrandPrize,
    cityPrizes: admin.cityPrizes,
    saveCityPrize: admin.saveCityPrize,
    getCityPrize: admin.getCityPrize,
    cityImages: admin.cityImages,
    saveCityImage: admin.saveCityImage,
    getCityImage: admin.getCityImage,
    seedDatabase: admin.seedDatabase,
    checkTables: admin.checkTables,
    getSetupSQL: admin.getSetupSQL,
    fetchUsers: admin.fetchUsers,

    coupons: coupon.coupons,
    validCoupons: coupon.validCoupons,
    usedCoupons: coupon.usedCoupons,
    expiredCoupons: coupon.expiredCoupons,
    couponsBySponsor: coupon.couponsBySponsor,
    addCoupon,
    updateCouponStatus: coupon.updateCouponStatus,
    scannedMessages: coupon.scannedMessages,
    addScannedMessage: coupon.addScannedMessage,
    updateScannedMessageStatus: coupon.updateScannedMessageStatus,

    pushToken: notif.pushToken,
    notificationsEnabled: notif.notificationsEnabled,
    notifyNewCoupon: notif.notifyNewCoupon,
    notifyNewPromo: notif.notifyNewPromo,
    notifyWithdraw: notif.notifyWithdraw,
    notifyPointsRedeemed: notif.notifyPointsRedeemed,
    clearBadge: notif.clearBadge,
  };
}

export { useUser } from '@/providers/UserProvider';
export { useSponsor } from '@/providers/SponsorProvider';
export { useAdmin } from '@/providers/AdminProvider';
export { useCoupon } from '@/providers/CouponProvider';
export { useNotifications } from '@/providers/NotificationProvider';
