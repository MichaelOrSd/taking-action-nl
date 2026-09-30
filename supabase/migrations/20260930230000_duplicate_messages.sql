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
