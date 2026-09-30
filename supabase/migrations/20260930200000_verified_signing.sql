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
