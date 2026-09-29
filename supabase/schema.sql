-- Taking Action NL: database schema for Supabase (Postgres).
-- Run this once in the Supabase SQL editor (or `supabase db push`).
-- Design: the public (anon key) can add a signature and read aggregate counts.
-- A signer confirms by clicking a magic link (Supabase Auth), then the
-- confirm function marks the row whose email matches the signed-in user.
-- Organisers (rows in `organisers`) can read, update and delete signatures
-- for their own petitions only.

create extension if not exists pgcrypto;

create table if not exists public.signatures (
  id uuid primary key default gen_random_uuid(),
  petition_slug text not null,
  full_name text not null check (char_length(full_name) between 2 and 120),
  street text not null check (char_length(street) between 3 and 160),
  community text not null check (char_length(community) between 2 and 80),
  province text not null default 'NL' check (char_length(province) = 2),
  postal_code text,
  email text not null check (position('@' in email) > 1),
  phone text,
  signature_data text not null check (signature_data like 'data:image/png;base64,%' and char_length(signature_data) < 200000),
  consent_updates boolean not null default false,
  consent_statement boolean not null default false,
  in_local_area boolean not null default false,
  confirmed boolean not null default false,
  confirmed_at timestamptz,
  paper_signed boolean not null default false,
  user_agent text,
  created_at timestamptz not null default now()
);

-- For instances that ran an earlier version of this file:
alter table public.signatures add column if not exists phone text;

create unique index if not exists signatures_one_per_email on public.signatures (petition_slug, lower(email));
create unique index if not exists signatures_one_per_person on public.signatures (petition_slug, lower(full_name), lower(street), lower(community));
create index if not exists signatures_by_petition on public.signatures (petition_slug, confirmed);

create table if not exists public.organisers (
  email text not null,
  petition_slug text not null,
  primary key (email, petition_slug)
);

alter table public.signatures enable row level security;
alter table public.organisers enable row level security;

-- Nobody reads signatures directly except organisers of that petition.
drop policy if exists organiser_read on public.signatures;
create policy organiser_read on public.signatures for select to authenticated
  using (exists (select 1 from public.organisers o where o.petition_slug = signatures.petition_slug and lower(o.email) = lower(auth.jwt() ->> 'email')));
drop policy if exists organiser_update on public.signatures;
create policy organiser_update on public.signatures for update to authenticated
  using (exists (select 1 from public.organisers o where o.petition_slug = signatures.petition_slug and lower(o.email) = lower(auth.jwt() ->> 'email')));
drop policy if exists organiser_delete on public.signatures;
create policy organiser_delete on public.signatures for delete to authenticated
  using (exists (select 1 from public.organisers o where o.petition_slug = signatures.petition_slug and lower(o.email) = lower(auth.jwt() ->> 'email')));

-- Organisers can see which petitions are theirs.
drop policy if exists organiser_self on public.organisers;
create policy organiser_self on public.organisers for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Public insert goes through a function so we control the fields.
create or replace function public.add_signature(s jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.signatures (petition_slug, full_name, street, community, province, postal_code, email, phone,
    signature_data, consent_updates, consent_statement, in_local_area, user_agent)
  values (
    s->>'petition_slug', s->>'full_name', s->>'street', s->>'community', coalesce(s->>'province','NL'),
    nullif(s->>'postal_code',''), lower(s->>'email'), nullif(left(s->>'phone',20),''), s->>'signature_data',
    coalesce((s->>'consent_updates')::boolean,false), coalesce((s->>'consent_statement')::boolean,false),
    coalesce((s->>'in_local_area')::boolean,false), left(s->>'user_agent',200));
end $$;
grant execute on function public.add_signature(jsonb) to anon, authenticated;

-- Confirm: the signed-in user's email must match the signature's email.
create or replace function public.confirm_my_signature(p_slug text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.signatures set confirmed = true, confirmed_at = now()
   where petition_slug = p_slug and lower(email) = lower(auth.jwt() ->> 'email') and confirmed = false;
  get diagnostics n = row_count;
  return n > 0 or exists (select 1 from public.signatures where petition_slug = p_slug and lower(email) = lower(auth.jwt() ->> 'email') and confirmed);
end $$;
grant execute on function public.confirm_my_signature(text) to authenticated;

-- Public counts only.
create or replace function public.petition_counts(p_slug text)
returns table (confirmed_count bigint, paper_count bigint) language sql security definer set search_path = public stable as $$
  select count(*) filter (where confirmed), count(*) filter (where paper_signed)
  from public.signatures where petition_slug = p_slug;
$$;
grant execute on function public.petition_counts(text) to anon, authenticated;

-- First organiser for the first petition (edit before running).
insert into public.organisers (email, petition_slug) values ('michaeloreilly@me.com', 'crown-cabinets-fumes')
  on conflict do nothing;
