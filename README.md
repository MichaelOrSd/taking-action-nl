# Taking Action NL

A free, open petition platform for residents of Newfoundland and Labrador. Static site on GitHub Pages (Jekyll), signatures in Supabase. Fork it and run your own for your community.

Live: https://michaelorsd.github.io/taking-action-nl/

## How it works

- **Petitions** are Markdown files in `_petitions/`. One file, one petition. Jekyll builds the page and `api/petitions.json`.
- **Signatures** go to a Supabase table through a database function. Signers confirm by clicking a one-time email link. Only organisers listed in the `organisers` table can read the list, from `/admin/`.
- **Paper** matters in NL: the House of Assembly accepts only original handwritten signatures. `/print/?p=<slug>` prints a House-format page, pre-filled if the signer wants.

## Run your own instance

1. **Fork** this repository. In Settings → Pages, deploy from the `main` branch, root. Edit `_config.yml`: `url`, `baseurl`, `title`, and `platform` (owner, contact, province).
2. **Create a Supabase project** (free tier is fine). In the SQL editor, run `supabase/schema.sql`. Edit the last statement first so the organiser email and petition slug are yours.
3. **Auth settings** in Supabase: enable Email provider, turn off "Confirm email" double-opt-in if you like (the magic link itself is the confirmation), set Site URL to your Pages URL and add `https://<your-pages-url>/thanks/` and `/admin/` to Redirect URLs. Supabase's built-in mailer is rate-limited to a few emails an hour; connect your own SMTP (Resend, Postmark, or any provider) under Auth → SMTP before you launch.
4. **Keys**: copy the project URL and anon key into `assets/js/config.js`. The anon key is public by design; row-level security does the protecting.
5. **Write a petition**: copy `_petitions/topsail-road-fumes.md`, change the front matter, commit. It is live when Pages rebuilds (about a minute).
6. **Organisers**: add a row to `organisers` (email, petition_slug) for each person who may see that petition's signatures. They sign in at `/admin/` with a one-time link to that email.

## Data collected

Name, street, community, province, postal code (optional), phone (optional), email, drawn signature (PNG data URL), consent flags, timestamp, browser string. Emails and browser strings are never shown publicly. See `privacy/index.md`.

## Local preview

```
bundle install
bundle exec jekyll serve
```

## Licence

MIT. See `LICENSE`.
