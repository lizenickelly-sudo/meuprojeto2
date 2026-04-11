import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Sponsor } from '@/types';
import { mockSponsors as defaultSponsors } from '@/mocks/sponsors';
import {
  fetchSponsors as dbFetchSponsors,
  upsertSponsor as dbUpsertSponsor,
  removeSponsor as dbRemoveSponsor,
} from '@/services/database';

const STORAGE_KEYS = {
  LIKED_OFFERS: 'cashboxpix_liked_offers',
  SHARED_OFFERS: 'cashboxpix_shared_offers',
};

export const [SponsorProvider, useSponsor] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [sponsors, setSponsors] = useState<Sponsor[]>(defaultSponsors);
  const [likedOffers, setLikedOffers] = useState<string[]>([]);
  const [sharedOffers, setSharedOffers] = useState<string[]>([]);

  const sponsorsQuery = useQuery({
    queryKey: ['sponsors'],
    queryFn: async () => {
      console.log('[SponsorProvider] Fetching sponsors from Supabase...');
      const result = await dbFetchSponsors();
      console.log('[SponsorProvider] Got', result.length, 'sponsors');
      return result;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const likedOffersQuery = useQuery({
    queryKey: ['liked_offers'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.LIKED_OFFERS);
      return stored ? JSON.parse(stored) as string[] : [];
    },
  });

  const sharedOffersQuery = useQuery({
    queryKey: ['shared_offers'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SHARED_OFFERS);
      return stored ? JSON.parse(stored) as string[] : [];
    },
  });

  useEffect(() => {
    if (sponsorsQuery.data) setSponsors(sponsorsQuery.data);
  }, [sponsorsQuery.data]);

  useEffect(() => {
    if (likedOffersQuery.data) setLikedOffers(likedOffersQuery.data);
  }, [likedOffersQuery.data]);

  useEffect(() => {
    if (sharedOffersQuery.data) setSharedOffers(sharedOffersQuery.data);
  }, [sharedOffersQuery.data]);

  const saveSponsorsMutation = useMutation({
    mutationFn: async (newSponsors: Sponsor[]) => {
      return newSponsors;
    },
    onSuccess: (data) => {
      setSponsors(data);
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
    },
  });

  const saveLikedOffersMutation = useMutation({
    mutationFn: async (offers: string[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.LIKED_OFFERS, JSON.stringify(offers));
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
      return offers;
    },
    onSuccess: (data) => {
      setSharedOffers(data);
      queryClient.invalidateQueries({ queryKey: ['shared_offers'] });
    },
  });

  const addSponsor = useCallback((sponsor: Sponsor) => {
    const updated = [...sponsors, sponsor];
    saveSponsorsMutation.mutate(updated);
    dbUpsertSponsor(sponsor).then((ok) => {
      if (ok) console.log('[SponsorProvider] Sponsor synced to Supabase:', sponsor.name);
    });
  }, [sponsors, saveSponsorsMutation]);

  const updateSponsor = useCallback((sponsor: Sponsor) => {
    const updated = sponsors.map((s) => (s.id === sponsor.id ? sponsor : s));
    saveSponsorsMutation.mutate(updated);
    dbUpsertSponsor(sponsor).then((ok) => {
      if (ok) console.log('[SponsorProvider] Sponsor updated in Supabase:', sponsor.name);
    });
  }, [sponsors, saveSponsorsMutation]);

  const deleteSponsor = useCallback((sponsorId: string) => {
    const updated = sponsors.filter((s) => s.id !== sponsorId);
    saveSponsorsMutation.mutate(updated);
    dbRemoveSponsor(sponsorId).then((ok) => {
      if (ok) console.log('[SponsorProvider] Sponsor removed from Supabase:', sponsorId);
    });
  }, [sponsors, saveSponsorsMutation]);

  const toggleLikeOffer = useCallback((offerId: string, onPoints?: (pts: number) => void): boolean => {
    if (likedOffers.includes(offerId)) {
      console.log('[SponsorProvider] Offer already liked:', offerId);
      return false;
    }
    const updated = [...likedOffers, offerId];
    saveLikedOffersMutation.mutate(updated);
    onPoints?.(1);
    console.log('[SponsorProvider] Liked offer:', offerId, '+1 point');
    return true;
  }, [likedOffers, saveLikedOffersMutation]);

  const shareOffer = useCallback((offerId: string, onPoints?: (pts: number) => void): boolean => {
    if (sharedOffers.includes(offerId)) {
      console.log('[SponsorProvider] Offer already shared:', offerId);
      return false;
    }
    const updated = [...sharedOffers, offerId];
    saveSharedOffersMutation.mutate(updated);
    onPoints?.(2);
    console.log('[SponsorProvider] Shared offer:', offerId, '+2 points');
    return true;
  }, [sharedOffers, saveSharedOffersMutation]);

  const isOfferLiked = useCallback((offerId: string) => {
    return likedOffers.includes(offerId);
  }, [likedOffers]);

  const isOfferShared = useCallback((offerId: string) => {
    return sharedOffers.includes(offerId);
  }, [sharedOffers]);

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
    isOfferLiked,
    isOfferShared,
    likedOffers,
    sharedOffers,
  };
});
