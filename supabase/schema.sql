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
insert into public.organisers (email, petition_slug) values ('michaeloreilly@me.com', 'topsail-road-fumes')
  on conflict do nothing;
-- Public "who has signed" wall: initials and community only, confirmed signatures only.
-- Never returns names, addresses, emails or signature images.
create or replace function public.public_signers(p_slug text, p_limit int default 40)
returns table (initials text, community text, province text, signed_on date)
language sql security definer set search_path = public stable as $$
  with parts as (
    select confirmed_at, community, province,
           regexp_split_to_array(regexp_replace(trim(full_name), '\s+', ' ', 'g'), ' ') as w
    from public.signatures
    where petition_slug = p_slug and confirmed
  ),
  named as (
    select confirmed_at, community, province,
           upper(left(w[1], 1)) as f,
           (select upper(left(x, 1)) from unnest(w) with ordinality as u(x, i)
             where i > 1 and x ~ '^[[:alpha:]]' order by i desc limit 1) as l
    from parts
  )
  select coalesce(f, '') || '. ' || coalesce(l || '.', '') as initials,
         community, province, confirmed_at::date as signed_on
  from named
  order by confirmed_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 200));
$$;
grant execute on function public.public_signers(text, int) to anon, authenticated;
-- Signing is now a two-step, same-page flow: the signer proves the email with a
-- six-digit code first, then the signature is written already confirmed.
-- add_signature therefore requires a signed-in user whose email matches.
create or replace function public.add_signature(s jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_email = '' then
    raise exception 'Please verify your email code first.';
  end if;
  if lower(s->>'email') <> v_email then
    raise exception 'The verified email does not match the email on the form.';
  end if;
  -- clear any earlier unconfirmed attempt by the same person
  delete from public.signatures where petition_slug = s->>'petition_slug' and lower(email) = v_email and confirmed = false;
  insert into public.signatures (petition_slug, full_name, street, community, province, postal_code, email, phone,
    signature_data, consent_updates, consent_statement, in_local_area, user_agent, confirmed, confirmed_at)
  values (
    s->>'petition_slug', s->>'full_name', s->>'street', s->>'community', coalesce(s->>'province','NL'),
    nullif(s->>'postal_code',''), v_email, nullif(left(s->>'phone',20),''), s->>'signature_data',
    coalesce((s->>'consent_updates')::boolean,false), coalesce((s->>'consent_statement')::boolean,false),
    coalesce((s->>'in_local_area')::boolean,false), left(s->>'user_agent',200), true, now());
end $$;
revoke execute on function public.add_signature(jsonb) from anon;
grant execute on function public.add_signature(jsonb) to authenticated;
-- Verification by email link, tracked on the signing page.
-- The form stores the signature unconfirmed with a random client token,
-- the email link confirms it, and the signing page polls the token to
-- advance to "Done" on its own. The token reveals nothing about the signer.
alter table public.signatures add column if not exists client_token uuid;
create index if not exists signatures_client_token on public.signatures (client_token);

create or replace function public.add_signature(s jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text := lower(s->>'email');
begin
  delete from public.signatures where petition_slug = s->>'petition_slug' and lower(email) = v_email and confirmed = false;
  insert into public.signatures (petition_slug, full_name, street, community, province, postal_code, email, phone,
    signature_data, consent_updates, consent_statement, in_local_area, user_agent, client_token)
  values (
    s->>'petition_slug', s->>'full_name', s->>'street', s->>'community', coalesce(s->>'province','NL'),
    nullif(s->>'postal_code',''), v_email, nullif(left(s->>'phone',20),''), s->>'signature_data',
    coalesce((s->>'consent_updates')::boolean,false), coalesce((s->>'consent_statement')::boolean,false),
    coalesce((s->>'in_local_area')::boolean,false), left(s->>'user_agent',200), nullif(s->>'client_token','')::uuid);
end $$;
grant execute on function public.add_signature(jsonb) to anon, authenticated;

create or replace function public.signature_confirmed(p_token uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select confirmed from public.signatures where client_token = p_token limit 1), false);
$$;
grant execute on function public.signature_confirmed(uuid) to anon, authenticated;
-- Supporter pool: people who asked to hear about future petitions.
-- Opt-in only (checkbox on the sign form or the "keep me informed" box on the
-- home page). Every email sent to them carries an unsubscribe link built from
-- unsubscribe_token. Readable only by platform organisers (petition_slug '*').
create table if not exists public.supporters (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  community text,
  province text default 'NL',
  source text,                       -- petition slug or 'home'
  unsubscribe_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);
create unique index if not exists supporters_email on public.supporters (lower(email));
alter table public.supporters enable row level security;

drop policy if exists supporters_owner_read on public.supporters;
create policy supporters_owner_read on public.supporters for select to authenticated
  using (exists (select 1 from public.organisers o where o.petition_slug = '*' and lower(o.email) = lower(auth.jwt() ->> 'email')));
drop policy if exists supporters_owner_delete on public.supporters;
create policy supporters_owner_delete on public.supporters for delete to authenticated
  using (exists (select 1 from public.organisers o where o.petition_slug = '*' and lower(o.email) = lower(auth.jwt() ->> 'email')));

create or replace function public.join_supporters(p_email text, p_name text, p_community text, p_province text, p_source text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_email is null or position('@' in p_email) < 2 then raise exception 'A valid email is required.'; end if;
  insert into public.supporters (email, full_name, community, province, source)
  values (lower(trim(p_email)), nullif(trim(p_name),''), nullif(trim(p_community),''), coalesce(nullif(p_province,''),'NL'), left(p_source,80))
  on conflict (lower(email)) do update
    set full_name = coalesce(excluded.full_name, supporters.full_name),
        community = coalesce(excluded.community, supporters.community),
        province = coalesce(excluded.province, supporters.province),
        unsubscribed_at = null;
end $$;
grant execute on function public.join_supporters(text, text, text, text, text) to anon, authenticated;

create or replace function public.unsubscribe_supporter(p_token uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.supporters set unsubscribed_at = now() where unsubscribe_token = p_token and unsubscribed_at is null;
  get diagnostics n = row_count;
  return n > 0 or exists (select 1 from public.supporters where unsubscribe_token = p_token);
end $$;
grant execute on function public.unsubscribe_supporter(uuid) to anon, authenticated;

create or replace function public.supporter_count()
returns bigint language sql security definer set search_path = public stable as $$
  select count(*) from public.supporters where unsubscribed_at is null;
$$;
grant execute on function public.supporter_count() to anon, authenticated;

-- Platform owner: sees the supporter pool and every petition.
insert into public.organisers (email, petition_slug) values ('michaeloreilly@me.com', '*') on conflict do nothing;
-- Clear messages for the two duplicate rules (same email; same person at the same address).
create or replace function public.add_signature(s jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text := lower(s->>'email');
begin
  delete from public.signatures where petition_slug = s->>'petition_slug' and lower(email) = v_email and confirmed = false;
  if exists (select 1 from public.signatures where petition_slug = s->>'petition_slug' and lower(email) = v_email and confirmed) then
    raise exception 'DUPLICATE_EMAIL';
  end if;
  if exists (select 1 from public.signatures where petition_slug = s->>'petition_slug'
             and lower(full_name) = lower(s->>'full_name') and lower(street) = lower(s->>'street') and lower(community) = lower(s->>'community')) then
    raise exception 'DUPLICATE_PERSON';
  end if;
  insert into public.signatures (petition_slug, full_name, street, community, province, postal_code, email, phone,
    signature_data, consent_updates, consent_statement, in_local_area, user_agent, client_token)
  values (
    s->>'petition_slug', s->>'full_name', s->>'street', s->>'community', coalesce(s->>'province','NL'),
    nullif(s->>'postal_code',''), v_email, nullif(left(s->>'phone',20),''), s->>'signature_data',
    coalesce((s->>'consent_updates')::boolean,false), coalesce((s->>'consent_statement')::boolean,false),
    coalesce((s->>'in_local_area')::boolean,false), left(s->>'user_agent',200), nullif(s->>'client_token','')::uuid);
end $$;
grant execute on function public.add_signature(jsonb) to anon, authenticated;
