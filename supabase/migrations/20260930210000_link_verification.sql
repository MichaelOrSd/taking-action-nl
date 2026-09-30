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
