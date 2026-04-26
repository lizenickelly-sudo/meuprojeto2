-- CashBox PIX sponsor portal ticket persistence
-- Apply this in the Supabase SQL Editor for the current app architecture.
-- The Expo client uses the publishable/anon key directly against PostgREST,
-- so the table needs read/write access for anon/authenticated and RLS must
-- stay disabled unless the client auth model changes.

create table if not exists public.sponsor_tickets (
  id text primary key,
  sponsor_id text not null,
  status text not null default 'available',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sponsor_tickets_sponsor_id_idx on public.sponsor_tickets (sponsor_id);
create index if not exists sponsor_tickets_status_idx on public.sponsor_tickets (status);
create index if not exists sponsor_tickets_created_at_idx on public.sponsor_tickets (created_at desc);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.sponsor_tickets to anon, authenticated;

alter table public.sponsor_tickets disable row level security;

comment on table public.sponsor_tickets is 'Stores sponsor-side ticket registration and payment status for generated coupon batches.';