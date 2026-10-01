-- Platform owners (organisers row with petition_slug '*') can see and manage
-- signatures on every petition, not only petitions assigned to them by name.
drop policy if exists organiser_read on public.signatures;
create policy organiser_read on public.signatures for select to authenticated
  using (exists (select 1 from public.organisers o where o.petition_slug in (signatures.petition_slug, '*') and lower(o.email) = lower(auth.jwt() ->> 'email')));
drop policy if exists organiser_update on public.signatures;
create policy organiser_update on public.signatures for update to authenticated
  using (exists (select 1 from public.organisers o where o.petition_slug in (signatures.petition_slug, '*') and lower(o.email) = lower(auth.jwt() ->> 'email')));
drop policy if exists organiser_delete on public.signatures;
create policy organiser_delete on public.signatures for delete to authenticated
  using (exists (select 1 from public.organisers o where o.petition_slug in (signatures.petition_slug, '*') and lower(o.email) = lower(auth.jwt() ->> 'email')));
