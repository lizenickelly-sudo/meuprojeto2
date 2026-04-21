import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Sponsor } from '@/types';
import { useAuth } from '@/providers/AuthProvider';
import { readDomainCache, writeDomainCache, invalidateDomainKey } from '@/lib/stateCache';
import {
  saveAppState as dbSaveAppState,
  fetchSponsors as dbFetchSponsors,
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

export const [SponsorProvider, useSponsor] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { isLoggedIn } = useAuth();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [likedOffers, setLikedOffers] = useState<string[]>([]);
  const [sharedOffers, setSharedOffers] = useState<string[]>([]);
  const [likedSponsors, setLikedSponsors] = useState<string[]>([]);
  const [starredSponsors, setStarredSponsors] = useState<string[]>([]);
  const [sponsorStars, setSponsorStars] = useState<Record<string, number>>({});

  const sponsorsQuery = useQuery({
    queryKey: ['sponsors'],
    queryFn: async () => {
      const version = await AsyncStorage.getItem(STORAGE_KEYS.SPONSORS_VERSION);
      if (version !== SPONSORS_CACHE_VERSION) {
        await AsyncStorage.removeItem(STORAGE_KEYS.SPONSORS);
        await AsyncStorage.setItem(STORAGE_KEYS.SPONSORS_VERSION, SPONSORS_CACHE_VERSION);
        await invalidateDomainKey('sponsor', SPONSOR_CACHE_KEYS.SPONSORS);
      }

      const cachedSponsors = await readDomainCache<Sponsor[]>(
        'sponsor',
        SPONSOR_CACHE_KEYS.SPONSORS,
        SPONSOR_CACHE_TTL_MS,
      );
      if (cachedSponsors && cachedSponsors.length > 0) return cachedSponsors;

      console.log('[SponsorProvider] Fetching sponsors from Supabase...');
      const remoteSponsors = await dbFetchSponsors();
      console.log('[SponsorProvider] Got', remoteSponsors.length, 'sponsors');
      if (remoteSponsors.length > 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.SPONSORS, JSON.stringify(remoteSponsors));
        await writeDomainCache('sponsor', SPONSOR_CACHE_KEYS.SPONSORS, remoteSponsors);
        return remoteSponsors;
      }

      const local = await AsyncStorage.getItem(STORAGE_KEYS.SPONSORS);
      if (local) {
        const parsed = JSON.parse(local) as Sponsor[];
        if (parsed.length > 0) {
          await writeDomainCache('sponsor', SPONSOR_CACHE_KEYS.SPONSORS, parsed);
          return parsed;
        }
      }

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
    queryKey: ['starred_sponsors'],
    queryFn: async () => {
      const cached = await readDomainCache<string[]>('sponsor', SPONSOR_CACHE_KEYS.STARRED_SPONSORS, SPONSOR_CACHE_TTL_MS);
      if (cached) return cached;

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.STARRED_SPONSORS);
      const value = stored ? JSON.parse(stored) as string[] : [];
      await writeDomainCache('sponsor', SPONSOR_CACHE_KEYS.STARRED_SPONSORS, value);
      return value;
    },
    staleTime: 0,
    refetchOnMount: 'stale',
  });

  const sponsorStarsQuery = useQuery({
    queryKey: ['sponsor_stars'],
    queryFn: async () => {
      const cached = await readDomainCache<Record<string, number>>('sponsor', SPONSOR_CACHE_KEYS.SPONSOR_STARS, SPONSOR_CACHE_TTL_MS);
      if (cached) return cached;

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SPONSOR_STARS);
      const value = stored ? JSON.parse(stored) as Record<string, number> : {};
      await writeDomainCache('sponsor', SPONSOR_CACHE_KEYS.SPONSOR_STARS, value);
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
      await AsyncStorage.setItem(STORAGE_KEYS.SPONSORS, JSON.stringify(newSponsors));
      await writeDomainCache('sponsor', SPONSOR_CACHE_KEYS.SPONSORS, newSponsors);
      await dbSaveAppState(SPONSOR_CACHE_KEYS.SPONSORS, newSponsors);
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
      await AsyncStorage.setItem(STORAGE_KEYS.STARRED_SPONSORS, JSON.stringify(ids));
      await writeDomainCache('sponsor', SPONSOR_CACHE_KEYS.STARRED_SPONSORS, ids);
      return ids;
    },
    onSuccess: (data) => {
      setStarredSponsors(data);
      queryClient.invalidateQueries({ queryKey: ['starred_sponsors'] });
    },
  });

  const saveSponsorStarsMutation = useMutation({
    mutationFn: async (stars: Record<string, number>) => {
      await AsyncStorage.setItem(STORAGE_KEYS.SPONSOR_STARS, JSON.stringify(stars));
      await writeDomainCache('sponsor', SPONSOR_CACHE_KEYS.SPONSOR_STARS, stars);
      return stars;
    },
    onSuccess: (data) => {
      setSponsorStars(data);
      queryClient.invalidateQueries({ queryKey: ['sponsor_stars'] });
    },
  });

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

  const toggleSponsorStar = useCallback((sponsorId: string): boolean => {
    const alreadyStarred = starredSponsors.includes(sponsorId);
    const updatedStarred = alreadyStarred
      ? starredSponsors.filter((id) => id !== sponsorId)
      : [...starredSponsors, sponsorId];

    const currentStars = sponsorStars[sponsorId] || 0;
    const nextStars = alreadyStarred ? Math.max(0, currentStars - 1) : currentStars + 1;
    const updatedStars = {
      ...sponsorStars,
      [sponsorId]: nextStars,
    };

    saveStarredSponsorsMutation.mutate(updatedStarred);
    saveSponsorStarsMutation.mutate(updatedStars);

    return !alreadyStarred;
  }, [starredSponsors, sponsorStars, saveStarredSponsorsMutation, saveSponsorStarsMutation]);

  const isSponsorLiked = useCallback((sponsorId: string) => {
    return likedSponsors.includes(sponsorId);
  }, [likedSponsors]);

  const isSponsorStarred = useCallback((sponsorId: string) => {
    return starredSponsors.includes(sponsorId);
  }, [starredSponsors]);

  const getSponsorStars = useCallback((sponsorId: string) => {
    return sponsorStars[sponsorId] || 0;
  }, [sponsorStars]);

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

  return {
    sponsors,
    addSponsor,
    updateSponsor,
    deleteSponsor,
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
    likedOffers,
    sharedOffers,
    likedSponsors,
    starredSponsors,
    sponsorStars,
  };
});
