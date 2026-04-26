import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { verifyPassword, hashPassword } from '@/lib/crypto';
import { fetchSponsorTickets as dbFetchSponsorTickets, syncSponsorTickets as dbSyncSponsorTickets } from '@/services/database';
import { useSponsor } from '@/providers/SponsorProvider';
import { useAdmin } from '@/providers/AdminProvider';
import type { Sponsor, SponsorTicketRecord, UserProfile } from '@/types';

const STORAGE_KEYS = {
  SESSION: 'cashboxpix_sponsor_portal_session',
  TICKETS: 'cashboxpix_sponsor_tickets',
};

interface SponsorPortalSession {
  sponsorId: string;
  sponsorEmail: string;
  loggedInAt: string;
}

type TicketRequestResult =
  | { outcome: 'approved'; ticket: SponsorTicketRecord }
  | { outcome: 'pending'; ticket: SponsorTicketRecord; message: string }
  | { outcome: 'refused'; message: string };

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function buildTicketId(batchId: string, code: string): string {
  const normalizedCode = code.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return `${batchId}_${normalizedCode}`;
}

function parseCouponPayload(rawData: string): { code: string; batchId: string; sponsorId: string; sponsorName: string; value: number } | null {
  try {
    const parsed = JSON.parse(rawData);
    if (parsed?.type !== 'cashbox_coupon') return null;
    if (!parsed.code || !parsed.batchId || !parsed.sponsorId) return null;
    const numericValue = typeof parsed.value === 'number' ? parsed.value : Number(parsed.value || 0);
    return {
      code: String(parsed.code),
      batchId: String(parsed.batchId),
      sponsorId: String(parsed.sponsorId),
      sponsorName: String(parsed.sponsorName || ''),
      value: Number.isFinite(numericValue) ? numericValue : 0,
    };
  } catch {
    return null;
  }
}

export const [SponsorPortalProvider, useSponsorPortal] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { sponsors, updateSponsor } = useSponsor();
  const { couponBatches } = useAdmin();
  const [session, setSession] = useState<SponsorPortalSession | null>(null);
  const [tickets, setTickets] = useState<SponsorTicketRecord[]>([]);

  const sessionQuery = useQuery({
    queryKey: ['sponsor_portal_session'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SESSION);
      return stored ? JSON.parse(stored) as SponsorPortalSession : null;
    },
  });

  const ticketsQuery = useQuery({
    queryKey: ['sponsor_tickets'],
    queryFn: async () => {
      const remote = await dbFetchSponsorTickets();
      if (remote.length > 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(remote));
        return remote;
      }

      const stored = await AsyncStorage.getItem(STORAGE_KEYS.TICKETS);
      return stored ? JSON.parse(stored) as SponsorTicketRecord[] : [];
    },
  });

  useEffect(() => {
    if (sessionQuery.data !== undefined) {
      setSession(sessionQuery.data);
    }
  }, [sessionQuery.data]);

  useEffect(() => {
    if (ticketsQuery.data) {
      setTickets(ticketsQuery.data);
    }
  }, [ticketsQuery.data]);

  const saveTicketsMutation = useMutation({
    mutationFn: async (nextTickets: SponsorTicketRecord[]) => {
      const saved = await dbSyncSponsorTickets(nextTickets);
      if (!saved) {
        throw new Error('Failed to persist sponsor tickets in the server');
      }

      await AsyncStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(nextTickets));
      return nextTickets;
    },
    onSuccess: (data) => {
      setTickets(data);
      queryClient.setQueryData(['sponsor_tickets'], data);
    },
  });

  const saveSessionMutation = useMutation({
    mutationFn: async (nextSession: SponsorPortalSession | null) => {
      if (nextSession) {
        await AsyncStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(nextSession));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.SESSION);
      }
      return nextSession;
    },
    onSuccess: (data) => {
      setSession(data);
      queryClient.setQueryData(['sponsor_portal_session'], data);
    },
  });

  const allProvisionedTickets = useMemo(() => {
    const existingById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
    const nextTickets: SponsorTicketRecord[] = [];

    couponBatches.forEach((batch) => {
      batch.codes.forEach((code) => {
        const ticketId = buildTicketId(batch.id, code);
        const existingTicket = existingById.get(ticketId);
        nextTickets.push(existingTicket ?? {
          id: ticketId,
          sponsorId: batch.sponsorId,
          sponsorName: batch.sponsorName,
          batchId: batch.id,
          code,
          value: batch.value,
          createdAt: batch.createdAt,
          status: 'available',
        });
      });
    });

    return nextTickets;
  }, [couponBatches, tickets]);

  useEffect(() => {
    if (couponBatches.length === 0) return;

    const currentIds = new Set(tickets.map((ticket) => ticket.id));
    const nextIds = new Set(allProvisionedTickets.map((ticket) => ticket.id));
    const hasNewTickets = allProvisionedTickets.some((ticket) => !currentIds.has(ticket.id));
    const hasRemovedTickets = tickets.some((ticket) => !nextIds.has(ticket.id));

    if (!hasNewTickets && !hasRemovedTickets) return;

    saveTicketsMutation.mutate(allProvisionedTickets);
  }, [allProvisionedTickets, couponBatches.length, saveTicketsMutation, tickets]);

  const currentSponsor = useMemo(() => {
    if (!session?.sponsorId) return null;
    return sponsors.find((item) => item.id === session.sponsorId) ?? null;
  }, [session?.sponsorId, sponsors]);

  const sponsorTickets = useMemo(() => {
    if (!currentSponsor?.id) return [];
    return tickets.filter((ticket) => ticket.sponsorId === currentSponsor.id);
  }, [currentSponsor?.id, tickets]);

  const login = useCallback(async (email: string, password: string): Promise<{ ok: boolean; message?: string }> => {
    const normalizedEmail = normalizeEmail(email);
    const sponsor = sponsors.find((item) => normalizeEmail(item.sponsorPanelEmail || '') === normalizedEmail);
    if (!sponsor?.sponsorPanelPasswordHash) {
      return { ok: false, message: 'Patrocinador nao encontrado ou acesso ainda nao configurado.' };
    }

    const isValid = await verifyPassword(password, sponsor.sponsorPanelPasswordHash);
    if (!isValid) {
      return { ok: false, message: 'Senha incorreta.' };
    }

    await saveSessionMutation.mutateAsync({
      sponsorId: sponsor.id,
      sponsorEmail: normalizedEmail,
      loggedInAt: new Date().toISOString(),
    });

    return { ok: true };
  }, [saveSessionMutation, sponsors]);

  const logout = useCallback(async () => {
    await saveSessionMutation.mutateAsync(null);
  }, [saveSessionMutation]);

  const configureSponsorAccess = useCallback(async (sponsor: Sponsor, sponsorPanelEmail: string, password?: string) => {
    const trimmedEmail = normalizeEmail(sponsorPanelEmail);
    const nextSponsor: Sponsor = {
      ...sponsor,
      sponsorPanelEmail: trimmedEmail,
      sponsorPanelEnabledAt: sponsor.sponsorPanelEnabledAt || new Date().toISOString(),
      sponsorPanelPasswordHash: password
        ? await hashPassword(password)
        : sponsor.sponsorPanelPasswordHash,
    };
    updateSponsor(nextSponsor);
    return nextSponsor;
  }, [updateSponsor]);

  const upsertTicket = useCallback(async (nextTicket: SponsorTicketRecord) => {
    const updated = tickets.some((ticket) => ticket.id === nextTicket.id)
      ? tickets.map((ticket) => (ticket.id === nextTicket.id ? nextTicket : ticket))
      : [...tickets, nextTicket];

    await saveTicketsMutation.mutateAsync(updated);
    return nextTicket;
  }, [saveTicketsMutation, tickets]);

  const registerTicketFromQr = useCallback(async (rawData: string): Promise<{ ok: boolean; message: string; ticket?: SponsorTicketRecord }> => {
    if (!currentSponsor) return { ok: false, message: 'Entre no painel do patrocinador primeiro.' };

    const parsed = parseCouponPayload(rawData);
    if (!parsed) return { ok: false, message: 'QR Code invalido para o painel do patrocinador.' };
    if (parsed.sponsorId !== currentSponsor.id) return { ok: false, message: 'Este bilhete pertence a outro patrocinador.' };

    const ticketId = buildTicketId(parsed.batchId, parsed.code);
    const existing = tickets.find((ticket) => ticket.id === ticketId);
    const nextTicket: SponsorTicketRecord = {
      ...(existing ?? {
        id: ticketId,
        sponsorId: parsed.sponsorId,
        sponsorName: parsed.sponsorName || currentSponsor.name,
        batchId: parsed.batchId,
        code: parsed.code,
        value: parsed.value,
        createdAt: new Date().toISOString(),
        status: 'available',
      }),
      registeredAt: new Date().toISOString(),
    };

    await upsertTicket(nextTicket);
    return { ok: true, message: 'Bilhete salvo no painel do patrocinador.', ticket: nextTicket };
  }, [currentSponsor, tickets, upsertTicket]);

  const requestTicketPayment = useCallback(async (
    parsedCoupon: { code: string; batchId?: string; sponsorId?: string; sponsorName?: string; value?: number },
    profile: UserProfile,
  ): Promise<TicketRequestResult> => {
    const matchedBatch = couponBatches.find((batch) => (
      batch.id === parsedCoupon.batchId || batch.codes.includes(parsedCoupon.code)
    ));

    const sponsorId = parsedCoupon.sponsorId || matchedBatch?.sponsorId || '';
    if (!sponsorId) {
      return { outcome: 'refused', message: 'Bilhete recusado. O patrocinador deste QR nao foi encontrado.' };
    }

    const batchId = parsedCoupon.batchId || matchedBatch?.id || '';
    if (!batchId) {
      return { outcome: 'refused', message: 'Bilhete recusado. O lote deste QR nao foi encontrado.' };
    }

    const ticketId = buildTicketId(batchId, parsedCoupon.code);
    const existing = tickets.find((ticket) => ticket.id === ticketId);
    const nextBase: SponsorTicketRecord = existing ?? {
      id: ticketId,
      sponsorId,
      sponsorName: parsedCoupon.sponsorName || matchedBatch?.sponsorName || '',
      batchId,
      code: parsedCoupon.code,
      value: typeof parsedCoupon.value === 'number' ? parsedCoupon.value : (matchedBatch?.value || 0),
      createdAt: matchedBatch?.createdAt || new Date().toISOString(),
      status: 'available',
    };

    const normalizedProfileEmail = normalizeEmail(profile.email || '');

    if (nextBase.status === 'paid') {
      const paidTicket = {
        ...nextBase,
        lastScannedAt: new Date().toISOString(),
      };
      await upsertTicket(paidTicket);
      return { outcome: 'refused', message: 'Cupom ja utilizado. Este bilhete ja foi pago e registrado.' };
    }

    if (nextBase.status === 'refused') {
      return {
        outcome: 'refused',
        message: nextBase.refusalReason || 'Bilhete recusado pelo patrocinador.',
      };
    }

    if (nextBase.status === 'pending_payment') {
      const existingCustomerEmail = normalizeEmail(nextBase.customerEmail || '');
      if (existingCustomerEmail && normalizedProfileEmail && existingCustomerEmail !== normalizedProfileEmail) {
        return {
          outcome: 'refused',
          message: 'Bilhete recusado. Este QR ja foi solicitado por outro usuario e aguarda pagamento.',
        };
      }

      const pendingTicket: SponsorTicketRecord = {
        ...nextBase,
        customerEmail: profile.email,
        customerName: profile.name,
        customerPixKey: profile.pixKey,
        customerPixKeyType: profile.pixKeyType,
        paymentRequestedAt: nextBase.paymentRequestedAt || new Date().toISOString(),
        lastScannedAt: new Date().toISOString(),
        refusalReason: 'Aguardando pagamento do patrocinador.',
      };

      await upsertTicket(pendingTicket);
      return {
        outcome: 'pending',
        ticket: pendingTicket,
        message: 'Bilhete recusado por enquanto. O PIX do cliente foi enviado ao patrocinador e o pagamento ainda nao foi confirmado.',
      };
    }

    const nextTicket: SponsorTicketRecord = {
      ...nextBase,
      status: 'pending_payment',
      customerEmail: profile.email,
      customerName: profile.name,
      customerPixKey: profile.pixKey,
      customerPixKeyType: profile.pixKeyType,
      paymentRequestedAt: existing?.paymentRequestedAt || new Date().toISOString(),
      lastScannedAt: new Date().toISOString(),
      refusalReason: 'Aguardando pagamento do patrocinador.',
    };

    await upsertTicket(nextTicket);
    return {
      outcome: 'pending',
      ticket: nextTicket,
      message: 'Bilhete recusado por enquanto. O PIX do cliente foi enviado ao patrocinador e o pagamento ainda nao foi confirmado.',
    };
  }, [couponBatches, tickets, upsertTicket]);

  const markTicketPaid = useCallback(async (ticketId: string) => {
    const existing = tickets.find((ticket) => ticket.id === ticketId);
    if (!existing) {
      throw new Error('Bilhete nao encontrado.');
    }

    const nextTicket: SponsorTicketRecord = {
      ...existing,
      status: 'paid',
      paidAt: new Date().toISOString(),
      paidBySponsorAt: new Date().toISOString(),
      paidMessage: 'Este bilhete foi pago pelo patrocinador.',
      refusalReason: undefined,
    };

    await upsertTicket(nextTicket);
    return nextTicket;
  }, [tickets, upsertTicket]);

  const refuseTicket = useCallback(async (ticketId: string, reason: string) => {
    const existing = tickets.find((ticket) => ticket.id === ticketId);
    if (!existing) {
      throw new Error('Bilhete nao encontrado.');
    }

    const nextTicket: SponsorTicketRecord = {
      ...existing,
      status: 'refused',
      refusalReason: reason,
    };
    await upsertTicket(nextTicket);
    return nextTicket;
  }, [tickets, upsertTicket]);

  return {
    isSponsorLoggedIn: Boolean(session?.sponsorId && currentSponsor),
    sponsorSession: session,
    currentSponsor,
    sponsorTickets,
    allSponsorTickets: tickets,
    configureSponsorAccess,
    login,
    logout,
    registerTicketFromQr,
    requestTicketPayment,
    markTicketPaid,
    refuseTicket,
  };
});