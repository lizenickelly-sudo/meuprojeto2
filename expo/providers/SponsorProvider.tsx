import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Sponsor } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { readDomainCache, writeDomainCache, invalidateDomainKey } from '@/lib/stateCache';
import {
  fetchSponsors as dbFetchSponsors,
  syncSponsors as dbSyncSponsors,
} from '@/services/database';

const STORAGE_KEYS = {
  SPONSORS: 'cashboxpix_sponsors',
  SPONSORS_VERSION: 'cashboxpix_sponsors_version',
  LIKED_OFFERS: 'cashboxpix_liked_offers',
  SHARED_OFFERS: 'cashboxpix_shared_offers',
  LIKED_SPONSORS: 'cashboxpix_liked_sponsors',
  STARRED_SPONSORS: 'cashboxpix_starred_sponsors',
  SPONSOR_STARS: 'cashboxpix_sponsor_stars',
};

const SPONSORS_CACHE_VERSION = '4';
const SPONSOR_CACHE_TTL_MS = 1000 * 60 * 20;

const SPONSOR_CACHE_KEYS = {
  SPONSORS: 'sponsors',
  LIKED_OFFERS: 'liked_offers',
  SHARED_OFFERS: 'shared_offers',
  LIKED_SPONSORS: 'liked_sponsors',
  STARRED_SPONSORS: 'starred_sponsors',
  SPONSOR_STARS: 'sponsor_stars',
} as const;

function normalizeUserRatingKey(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function clampSponsorRating(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(5, Math.round(value)));
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(5, Math.round(parsed)));
    }
  }

  return 0;
}

function getSponsorRatingsByUser(sponsor?: Sponsor): Record<string, number> {
  if (!sponsor?.ratingsByUser) return {};

  return Object.entries(sponsor.ratingsByUser).reduce<Record<string, number>>((acc, [userKey, rawRating]) => {
    const normalizedKey = normalizeUserRatingKey(userKey);
    const normalizedRating = clampSponsorRating(rawRating);

    if (normalizedKey && normalizedRating > 0) {
      acc[normalizedKey] = normalizedRating;
    }

    return acc;
  }, {});
}

function getSponsorRatingSummary(ratingsByUser: Record<string, number>) {
  const ratings = Object.values(ratingsByUser).filter((value) => value > 0);
  const count = ratings.length;
  const total = ratings.reduce((sum, value) => sum + value, 0);
  const average = count > 0 ? Number((total / count).toFixed(1)) : 0;

  return {
    count,
    total,
    average,
  };
}

function withSponsorRatingSummary(sponsor: Sponsor, ratingsByUser: Record<string, number>): Sponsor {
  const summary = getSponsorRatingSummary(ratingsByUser);

  return {
    ...sponsor,
    ratingsByUser,
    ratingCount: summary.count,
    ratingTotal: summary.total,
    ratingAverage: summary.average,
  };
}

function getScopedStateKey(baseKey: string, scope?: string): string {
  const normalizedScope = normalizeUserRatingKey(scope);
  return normalizedScope ? `${baseKey}:${normalizedScope}` : baseKey;
}

export const [SponsorProvider, useSponsor] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { isLoggedIn, userEmail } = useAuth();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [likedOffers, setLikedOffers] = useState<string[]>([]);
  const [sharedOffers, setSharedOffers] = useState<string[]>([]);
  const [likedSponsors, setLikedSponsors] = useState<string[]>([]);
  const [starredSponsors, setStarredSponsors] = useState<string[]>([]);
  const [sponsorStars, setSponsorStars] = useState<Record<string, number>>({});
  const ratingUserKey = normalizeUserRatingKey(userEmail);
  const starredSponsorsStorageKey = getScopedStateKey(STORAGE_KEYS.STARRED_SPONSORS, ratingUserKey);
  const sponsorStarsStorageKey = getScopedStateKey(STORAGE_KEYS.SPONSOR_STARS, ratingUserKey);
  const starredSponsorsCacheKey = getScopedStateKey(SPONSOR_CACHE_KEYS.STARRED_SPONSORS, ratingUserKey);
  const sponsorStarsCacheKey = getScopedStateKey(SPONSOR_CACHE_KEYS.SPONSOR_STARS, ratingUserKey);

  const sponsorsQuery = useQuery({
    queryKey: ['sponsors'],
    queryFn: async () => {
      const version = await AsyncStorage.getItem(STORAGE_KEYS.SPONSORS_VERSION);
      if (version !== SPONSORS_CACHE_VERSION) {
        await AsyncStorage.removeItem(STORAGE_KEYS.SPONSORS);
        await AsyncStorage.setItem(STORAGE_KEYS.SPONSORS_VERSION, SPONSORS_CACHE_VERSION);
        await invalidateDomainKey('sponsor', SPONSOR_CACHE_KEYS.SPONSORS);
      }

      console.log('[SponsorProvider] Fetching sponsors from Supabase...');
      const remoteSponsors = await dbFetchSponsors();
      console.log('[SponsorProvider] Got', remoteSponsors.length, 'sponsors');
      if (remoteSponsors.length > 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.SPONSORS, JSON.stringify(remoteSponsors));
        await writeDomainCache('sponsor', SPONSOR_CACHE_KEYS.SPONSORS, remoteSponsors);
        return remoteSponsors;
      }

      await AsyncStorage.removeItem(STORAGE_KEYS.SPONSORS);
      await invalidateDomainKey('sponsor', SPONSOR_CACHE_KEYS.SPONSORS);
      return [];
    },
    enabled: true,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const likedOffersQuery = useQuery({
    queryKey: ['liked_offers'],
    queryFn: async () => {
      const cached = await readDomainCache<string[]>('sponsor', SPONSOR_CACHE_KEYS.LIKED_OFFERS, SPONSOR_CACHE_TTL_MS);
      if (cached) return cached;

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.LIKED_OFFERS);
      const value = stored ? JSON.parse(stored) as string[] : [];
      await writeDomainCache('sponsor', SPONSOR_CACHE_KEYS.LIKED_OFFERS, value);
      return value;
    },
    staleTime: 0,
    refetchOnMount: 'stale',
  });

  const sharedOffersQuery = useQuery({
    queryKey: ['shared_offers'],
    queryFn: async () => {
      const cached = await readDomainCache<string[]>('sponsor', SPONSOR_CACHE_KEYS.SHARED_OFFERS, SPONSOR_CACHE_TTL_MS);
      if (cached) return cached;

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SHARED_OFFERS);
      const value = stored ? JSON.parse(stored) as string[] : [];
      await writeDomainCache('sponsor', SPONSOR_CACHE_KEYS.SHARED_OFFERS, value);
      return value;
    },
    staleTime: 0,
    refetchOnMount: 'stale',
  });

  const likedSponsorsQuery = useQuery({
    queryKey: ['liked_sponsors'],
    queryFn: async () => {
      const cached = await readDomainCache<string[]>('sponsor', SPONSOR_CACHE_KEYS.LIKED_SPONSORS, SPONSOR_CACHE_TTL_MS);
      if (cached) return cached;

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.LIKED_SPONSORS);
      const value = stored ? JSON.parse(stored) as string[] : [];
      await writeDomainCache('sponsor', SPONSOR_CACHE_KEYS.LIKED_SPONSORS, value);
      return value;
    },
    staleTime: 0,
    refetchOnMount: 'stale',
  });

  const starredSponsorsQuery = useQuery({
    queryKey: ['starred_sponsors', ratingUserKey],
    queryFn: async () => {
      if (!ratingUserKey) return [];

      const cached = await readDomainCache<string[]>('sponsor', starredSponsorsCacheKey, SPONSOR_CACHE_TTL_MS);
      if (cached) return cached;

      const stored = await AsyncStorage.getItem(starredSponsorsStorageKey);
      const value = stored ? JSON.parse(stored) as string[] : [];
      await writeDomainCache('sponsor', starredSponsorsCacheKey, value);
      return value;
    },
    staleTime: 0,
    refetchOnMount: 'stale',
  });

  const sponsorStarsQuery = useQuery({
    queryKey: ['sponsor_stars', ratingUserKey],
    queryFn: async () => {
      if (!ratingUserKey) return {};

      const cached = await readDomainCache<Record<string, number>>('sponsor', sponsorStarsCacheKey, SPONSOR_CACHE_TTL_MS);
      if (cached) return cached;

      const stored = await AsyncStorage.getItem(sponsorStarsStorageKey);
      const value = stored ? JSON.parse(stored) as Record<string, number> : {};
      await writeDomainCache('sponsor', sponsorStarsCacheKey, value);
      return value;
    },
    staleTime: 0,
    refetchOnMount: 'stale',
  });

  useEffect(() => {
    if (!isLoggedIn) {
      setLikedOffers([]);
      setSharedOffers([]);
      setLikedSponsors([]);
      setStarredSponsors([]);
      setSponsorStars({});
      queryClient.removeQueries({ queryKey: ['liked_offers'] });
      queryClient.removeQueries({ queryKey: ['shared_offers'] });
      queryClient.removeQueries({ queryKey: ['liked_sponsors'] });
      queryClient.removeQueries({ queryKey: ['starred_sponsors'] });
      queryClient.removeQueries({ queryKey: ['sponsor_stars'] });
      return;
    }
  }, [isLoggedIn, queryClient]);

  // Reload liked/shared offers when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        console.log('[SponsorProvider] App resumed - refreshing sponsors and engagement state');
        void invalidateDomainKey('sponsor', SPONSOR_CACHE_KEYS.SPONSORS);
        queryClient.invalidateQueries({ queryKey: ['sponsors'] });
        queryClient.invalidateQueries({ queryKey: ['liked_offers'] });
        queryClient.invalidateQueries({ queryKey: ['shared_offers'] });
        queryClient.invalidateQueries({ queryKey: ['liked_sponsors'] });
        queryClient.invalidateQueries({ queryKey: ['starred_sponsors'] });
        queryClient.invalidateQueries({ queryKey: ['sponsor_stars'] });
      }
    });
    return () => subscription.remove();
  }, [queryClient]);

  useEffect(() => {
    if (sponsorsQuery.data) setSponsors(sponsorsQuery.data);
  }, [sponsorsQuery.data]);

  useEffect(() => {
    if (likedOffersQuery.data) setLikedOffers(likedOffersQuery.data);
  }, [likedOffersQuery.data]);

  useEffect(() => {
    if (sharedOffersQuery.data) setSharedOffers(sharedOffersQuery.data);
  }, [sharedOffersQuery.data]);

  useEffect(() => {
    if (likedSponsorsQuery.data) setLikedSponsors(likedSponsorsQuery.data);
  }, [likedSponsorsQuery.data]);

  useEffect(() => {
    if (starredSponsorsQuery.data) setStarredSponsors(starredSponsorsQuery.data);
  }, [starredSponsorsQuery.data]);

  useEffect(() => {
    if (sponsorStarsQuery.data) setSponsorStars(sponsorStarsQuery.data);
  }, [sponsorStarsQuery.data]);

  const saveSponsorsMutation = useMutation({
    mutationFn: async (newSponsors: Sponsor[]) => {
      const saved = await dbSyncSponsors(newSponsors);
      if (!saved) {
        throw new Error('Failed to persist sponsors in the server');
      }

      await AsyncStorage.setItem(STORAGE_KEYS.SPONSORS, JSON.stringify(newSponsors));
      await writeDomainCache('sponsor', SPONSOR_CACHE_KEYS.SPONSORS, newSponsors);
      return newSponsors;
    },
    onSuccess: (data) => {
      setSponsors(data);
      queryClient.setQueryData(['sponsors'], data);
    },
  });

  const saveLikedOffersMutation = useMutation({
    mutationFn: async (offers: string[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.LIKED_OFFERS, JSON.stringify(offers));
      await writeDomainCache('sponsor', SPONSOR_CACHE_KEYS.LIKED_OFFERS, offers);
      return offers;
    },
    onSuccess: (data) => {
      setLikedOffers(data);
      queryClient.invalidateQueries({ queryKey: ['liked_offers'] });
    },
  });

  const saveSharedOffersMutation = useMutation({
    mutationFn: async (offers: string[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.SHARED_OFFERS, JSON.stringify(offers));
      await writeDomainCache('sponsor', SPONSOR_CACHE_KEYS.SHARED_OFFERS, offers);
      return offers;
    },
    onSuccess: (data) => {
      setSharedOffers(data);
      queryClient.invalidateQueries({ queryKey: ['shared_offers'] });
    },
  });

  const saveLikedSponsorsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.LIKED_SPONSORS, JSON.stringify(ids));
      await writeDomainCache('sponsor', SPONSOR_CACHE_KEYS.LIKED_SPONSORS, ids);
      return ids;
    },
    onSuccess: (data) => {
      setLikedSponsors(data);
      queryClient.invalidateQueries({ queryKey: ['liked_sponsors'] });
    },
  });

  const saveStarredSponsorsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await AsyncStorage.setItem(starredSponsorsStorageKey, JSON.stringify(ids));
      await writeDomainCache('sponsor', starredSponsorsCacheKey, ids);
      return ids;
    },
    onSuccess: (data) => {
      setStarredSponsors(data);
      queryClient.invalidateQueries({ queryKey: ['starred_sponsors'] });
    },
  });

  const saveSponsorStarsMutation = useMutation({
    mutationFn: async (stars: Record<string, number>) => {
      await AsyncStorage.setItem(sponsorStarsStorageKey, JSON.stringify(stars));
      await writeDomainCache('sponsor', sponsorStarsCacheKey, stars);
      return stars;
    },
    onSuccess: (data) => {
      setSponsorStars(data);
      queryClient.invalidateQueries({ queryKey: ['sponsor_stars'] });
    },
  });

  useEffect(() => {
    if (!ratingUserKey || sponsors.length === 0 || Object.keys(sponsorStars).length === 0) return;

    let changed = false;
    const updatedSponsors = sponsors.map((sponsor) => {
      const localStars = clampSponsorRating(sponsorStars[sponsor.id] || 0);
      if (localStars === 0) return sponsor;

      const ratingsByUser = getSponsorRatingsByUser(sponsor);
      if (ratingsByUser[ratingUserKey] === localStars) return sponsor;

      changed = true;
      return withSponsorRatingSummary(sponsor, {
        ...ratingsByUser,
        [ratingUserKey]: localStars,
      });
    });

    if (!changed) return;

    setSponsors(updatedSponsors);
    queryClient.setQueryData(['sponsors'], updatedSponsors);
    saveSponsorsMutation.mutate(updatedSponsors);
  }, [queryClient, ratingUserKey, saveSponsorsMutation, sponsorStars, sponsors]);

  const bumpOfferCounter = useCallback((offerId: string, field: 'likes' | 'shares' | 'comments') => {
    let changed = false;
    const updatedSponsors = sponsors.map((sponsor) => ({
      ...sponsor,
      offers: sponsor.offers.map((offer) => {
        if (offer.id !== offerId) return offer;
        changed = true;
        return {
          ...offer,
          [field]: (offer[field] || 0) + 1,
        };
      }),
      galleryImages: (sponsor.galleryImages || []).map((product) => {
        if (product.id !== offerId) return product;
        changed = true;
        return {
          ...product,
          [field]: (product[field] || 0) + 1,
        };
      }),
    }));

    if (changed) {
      saveSponsorsMutation.mutate(updatedSponsors);
    }

    return changed;
  }, [sponsors, saveSponsorsMutation]);

  const addSponsor = useCallback((sponsor: Sponsor) => {
    const updated = [...sponsors, sponsor];
    saveSponsorsMutation.mutate(updated);
  }, [sponsors, saveSponsorsMutation]);

  const updateSponsor = useCallback((sponsor: Sponsor) => {
    const exists = sponsors.some((item) => item.id === sponsor.id);
    const updated = exists
      ? sponsors.map((item) => (item.id === sponsor.id ? sponsor : item))
      : [...sponsors, sponsor];

    saveSponsorsMutation.mutate(updated);
  }, [sponsors, saveSponsorsMutation]);

  const deleteSponsor = useCallback((sponsorId: string) => {
    const updated = sponsors.filter((s) => s.id !== sponsorId);
    saveSponsorsMutation.mutate(updated);
  }, [sponsors, saveSponsorsMutation]);

  const toggleLikeOffer = useCallback((offerId: string, onPoints?: (pts: number) => void): boolean => {
    if (likedOffers.includes(offerId)) {
      console.log('[SponsorProvider] Offer already liked:', offerId);
      return false;
    }
    const updated = [...likedOffers, offerId];
    saveLikedOffersMutation.mutate(updated);
    bumpOfferCounter(offerId, 'likes');
    onPoints?.(1);
    console.log('[SponsorProvider] Liked offer:', offerId, '+1 point');
    return true;
  }, [likedOffers, saveLikedOffersMutation, bumpOfferCounter]);

  const shareOffer = useCallback((offerId: string, onPoints?: (pts: number) => void): boolean => {
    if (sharedOffers.includes(offerId)) {
      console.log('[SponsorProvider] Offer already shared:', offerId);
      return false;
    }
    const updated = [...sharedOffers, offerId];
    saveSharedOffersMutation.mutate(updated);
    bumpOfferCounter(offerId, 'shares');
    onPoints?.(1);
    console.log('[SponsorProvider] Shared offer:', offerId, '+1 point');
    return true;
  }, [sharedOffers, saveSharedOffersMutation, bumpOfferCounter]);

  const addOfferComment = useCallback((offerId: string): boolean => {
    const changed = bumpOfferCounter(offerId, 'comments');
    if (changed) {
      console.log('[SponsorProvider] Comment registered for offer:', offerId);
    }
    return changed;
  }, [bumpOfferCounter]);

  const isOfferLiked = useCallback((offerId: string) => {
    return likedOffers.includes(offerId);
  }, [likedOffers]);

  const isOfferShared = useCallback((offerId: string) => {
    return sharedOffers.includes(offerId);
  }, [sharedOffers]);

  const toggleLikeSponsor = useCallback((sponsorId: string): boolean => {
    const alreadyLiked = likedSponsors.includes(sponsorId);
    const updated = alreadyLiked
      ? likedSponsors.filter((id) => id !== sponsorId)
      : [...likedSponsors, sponsorId];
    saveLikedSponsorsMutation.mutate(updated);
    return !alreadyLiked;
  }, [likedSponsors, saveLikedSponsorsMutation]);

  const toggleSponsorStar = useCallback((sponsorId: string, nextStars?: number): boolean => {
    if (!ratingUserKey) return false;

    const targetSponsor = sponsors.find((item) => item.id === sponsorId);
    if (!targetSponsor) return false;

    const ratingsByUser = getSponsorRatingsByUser(targetSponsor);
    const currentStars = ratingsByUser[ratingUserKey] || clampSponsorRating(sponsorStars[sponsorId] || 0);
    const alreadyStarred = currentStars > 0 || starredSponsors.includes(sponsorId);
    const clampedStars = typeof nextStars === 'number' && Number.isFinite(nextStars)
      ? clampSponsorRating(nextStars)
      : (alreadyStarred ? 0 : Math.max(1, currentStars || 1));

    const updatedStarred = clampedStars > 0
      ? (alreadyStarred ? starredSponsors : [...starredSponsors, sponsorId])
      : starredSponsors.filter((id) => id !== sponsorId);
    const updatedStars = { ...sponsorStars };
    const updatedRatingsByUser = { ...ratingsByUser };

    if (clampedStars > 0) {
      updatedRatingsByUser[ratingUserKey] = clampedStars;
    } else {
      delete updatedRatingsByUser[ratingUserKey];
    }

    const updatedSponsors = sponsors.map((sponsor) => (
      sponsor.id === sponsorId ? withSponsorRatingSummary(sponsor, updatedRatingsByUser) : sponsor
    ));

    if (clampedStars > 0) {
      updatedStars[sponsorId] = clampedStars;
    } else {
      delete updatedStars[sponsorId];
    }

    setSponsors(updatedSponsors);
    queryClient.setQueryData(['sponsors'], updatedSponsors);
    saveSponsorsMutation.mutate(updatedSponsors);
    saveStarredSponsorsMutation.mutate(updatedStarred);
    saveSponsorStarsMutation.mutate(updatedStars);

    return clampedStars > 0;
  }, [queryClient, ratingUserKey, saveSponsorStarsMutation, saveSponsorsMutation, saveStarredSponsorsMutation, sponsorStars, sponsors, starredSponsors]);

  const isSponsorLiked = useCallback((sponsorId: string) => {
    return likedSponsors.includes(sponsorId);
  }, [likedSponsors]);

  const getSponsorStars = useCallback((sponsorId: string) => {
    const sponsor = sponsors.find((item) => item.id === sponsorId);
    if (!sponsor) return clampSponsorRating(sponsorStars[sponsorId] || 0);

    const ratingsByUser = getSponsorRatingsByUser(sponsor);
    if (ratingUserKey && ratingsByUser[ratingUserKey] > 0) {
      return ratingsByUser[ratingUserKey];
    }

    return clampSponsorRating(sponsorStars[sponsorId] || 0);
  }, [ratingUserKey, sponsorStars, sponsors]);

  const isSponsorStarred = useCallback((sponsorId: string) => {
    return starredSponsors.includes(sponsorId) || getSponsorStars(sponsorId) > 0;
  }, [getSponsorStars, starredSponsors]);

  const getSponsorAverageStars = useCallback((sponsorId: string) => {
    const sponsor = sponsors.find((item) => item.id === sponsorId);
    if (!sponsor) return 0;

    const ratingAverage = typeof sponsor.ratingAverage === 'number' && Number.isFinite(sponsor.ratingAverage)
      ? sponsor.ratingAverage
      : getSponsorRatingSummary(getSponsorRatingsByUser(sponsor)).average;

    return Number(ratingAverage.toFixed(1));
  }, [sponsors]);

  const getSponsorRatingCount = useCallback((sponsorId: string) => {
    const sponsor = sponsors.find((item) => item.id === sponsorId);
    if (!sponsor) return 0;

    if (typeof sponsor.ratingCount === 'number' && Number.isFinite(sponsor.ratingCount)) {
      return sponsor.ratingCount;
    }

    return getSponsorRatingSummary(getSponsorRatingsByUser(sponsor)).count;
  }, [sponsors]);

  const sponsorsByCity = useMemo(() => {
    const map: Record<string, Sponsor[]> = {};
    sponsors.forEach((s) => {
      const key = s.city;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [sponsors]);

  const sponsorsByState = useMemo(() => {
    const map: Record<string, Sponsor[]> = {};
    sponsors.forEach((s) => {
      const key = s.state;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [sponsors]);

  const refreshSponsors = useCallback(async () => {
    await invalidateDomainKey('sponsor', SPONSOR_CACHE_KEYS.SPONSORS);
    await queryClient.refetchQueries({ queryKey: ['sponsors'], exact: true });
  }, [queryClient]);

  return {
    sponsors,
    addSponsor,
    updateSponsor,
    deleteSponsor,
    refreshSponsors,
    sponsorsByCity,
    sponsorsByState,
    toggleLikeOffer,
    shareOffer,
    addOfferComment,
    isOfferLiked,
    isOfferShared,
    toggleLikeSponsor,
    toggleSponsorStar,
    isSponsorLiked,
    isSponsorStarred,
    getSponsorStars,
    getSponsorAverageStars,
    getSponsorRatingCount,
    likedOffers,
    sharedOffers,
    likedSponsors,
    starredSponsors,
    sponsorStars,
  };
});
