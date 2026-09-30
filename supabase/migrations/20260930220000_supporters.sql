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
