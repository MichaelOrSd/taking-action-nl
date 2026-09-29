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
