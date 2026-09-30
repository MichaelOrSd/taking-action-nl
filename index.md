---
title: Home
permalink: /
---
<section class="hero">
  <p class="eyebrow">Newfoundland and Labrador</p>
  <h1>Taking Action NL</h1>
  <p>Petitions by residents of Newfoundland and Labrador, delivered to the councils, ministers and MHAs who can act. Free. Sign online; sign on paper where the House needs ink.</p>
  <p class="strip"><strong>Privacy first.</strong> We collect only what a petition needs and show the public only a count. <a href="{{ '/privacy/' | relative_url }}">Policy, one page</a>.</p>
</section>

<section id="petitions">
  <h2>Petitions by community</h2>
  {% assign open = site.petitions | where: "status", "open" | sort: "community" %}
  {% assign groups = open | group_by: "community" | sort: "name" %}
  {% if groups.size > 1 %}
  <div class="area-pick">
    <label for="area-select">Show petitions for</label>
    <select id="area-select">
      <option value="">All communities</option>
      {% for g in groups %}<option value="{{ g.name | slugify }}">{{ g.name }}</option>{% endfor %}
    </select>
  </div>
  {% endif %}
  {% for g in groups %}
  <div class="area" id="area-{{ g.name | slugify }}" data-area="{{ g.name | slugify }}">
  <h3 class="area-title">{{ g.name }}<span class="area-count">{{ g.items.size }} open</span></h3>
  <ul class="petition-list">
  {% assign items = g.items | sort: "opened" | reverse %}
  {% for p in items %}
    {% assign share_url = p.url | absolute_url %}
    <li>
      <a class="title" href="{{ p.url | relative_url }}">{{ p.title }}</a>
      <span class="meta">Opened {{ p.opened | date: "%-d %b %Y" }} · organised by {{ p.organiser_short | default: p.organiser }} · <span class="card-count" data-slug="{{ p.slug }}">…</span> signed</span>
      <p class="summary">{{ p.summary }}</p>
      <div class="btn-row">
        <a class="btn btn-primary" href="{{ p.url | relative_url }}">Read and sign</a>
        <button type="button" class="btn share-quick" data-url="{{ share_url }}" data-title="{{ p.title | escape }}">Share</button>
      </div>
    </li>
  {% endfor %}
  </ul>
  </div>
  {% endfor %}
  {% if open.size == 0 %}<p class="meta">No open petitions yet.</p>{% endif %}
  <p class="meta" id="area-empty" hidden>No open petitions for that community yet. <a href="{{ '/start/' | relative_url }}">Start one</a>.</p>

  {% assign closed = site.petitions | where_exp: "p", "p.status != 'open'" | sort: "community" %}
  {% if closed.size > 0 %}
  <h2>Delivered and closed</h2>
  {% assign cgroups = closed | group_by: "community" | sort: "name" %}
  {% for g in cgroups %}
  <h3 class="area-title">{{ g.name }}</h3>
  <ul class="petition-list">
  {% for p in g.items %}<li><a class="title" href="{{ p.url | relative_url }}">{{ p.title }}</a><span class="meta">{{ p.status }}</span></li>{% endfor %}
  </ul>
  {% endfor %}
  {% endif %}
  <p class="meta">Your community not here? <a href="{{ '/start/' | relative_url }}">Start a petition</a>.</p>
</section>

<section class="loop" id="stay-informed">
  <h2>Hear about the next petition</h2>
  <p>We will email you when a new petition opens in NL. Occasional, never sold, one-click unsubscribe. <span class="meta" id="loop-count"></span></p>
  <form id="loop-form" class="sign-form" novalidate>
    <div class="row">
      <div class="field"><label for="loop-email">Email</label><input id="loop-email" type="email" inputmode="email" autocomplete="email" required maxlength="160"></div>
      <div class="field"><label for="loop-community">Community <span class="meta">(optional)</span></label><input id="loop-community" type="text" autocomplete="address-level2" autocapitalize="words" maxlength="80"></div>
    </div>
    <button type="submit" class="btn btn-primary">Keep me informed</button>
    <p class="form-msg" id="loop-msg" role="status" aria-live="polite"></p>
  </form>
</section>

<section>
  <h2>How it works</h2>
  <ol>
    <li><strong>Read.</strong> Every petition says who it goes to and what it asks.</li>
    <li><strong>Sign online.</strong> Name, address, a drawn signature, one email click.</li>
    <li><strong>Sign on paper if it goes to the House.</strong> The House of Assembly accepts ink only; we print the page for you.</li>
  </ol>
  <p class="meta">A petition asks; it does not order. Its power is the number of people behind it, on the record.</p>
</section>

<script defer src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
<script defer src="{{ '/assets/js/share.js' | relative_url }}"></script>
<script>
document.addEventListener('DOMContentLoaded', function () {
  const ok = window.TA && window.TA.supabaseUrl && !/YOUR-PROJECT/.test(window.TA.supabaseUrl) && window.supabase;
  const sb = ok ? window.supabase.createClient(window.TA.supabaseUrl, window.TA.supabaseAnonKey) : null;
  document.querySelectorAll('.card-count').forEach(async el => {
    if (!sb) { el.textContent = '0'; return; }
    const { data } = await sb.rpc('petition_counts', { p_slug: el.dataset.slug });
    el.textContent = (data && data.length) ? Number(data[0].confirmed_count || 0).toLocaleString() : '0';
  });
  const f = document.getElementById('loop-form'), msg = document.getElementById('loop-msg');
  if (sb) sb.rpc('supporter_count').then(({ data }) => { const c = document.getElementById('loop-count'); if (c && data) c.textContent = Number(data).toLocaleString() + ' on the list.'; });
  if (f) f.addEventListener('submit', async (e) => {
    e.preventDefault(); if (!f.reportValidity()) return;
    if (!sb) { msg.textContent = 'Not switched on yet.'; return; }
    const { error } = await sb.rpc('join_supporters', { p_email: document.getElementById('loop-email').value.trim(), p_name: '', p_community: document.getElementById('loop-community').value.trim(), p_province: 'NL', p_source: 'home' });
    msg.className = 'form-msg ' + (error ? 'err' : 'ok');
    msg.textContent = error ? 'Could not add you. Check the email and try again.' : 'You are on the list. Thank you.';
    if (!error) f.reset();
  });
  const sel = document.getElementById('area-select');
  if (sel) {
    const areas = Array.from(document.querySelectorAll('#petitions .area'));
    const empty = document.getElementById('area-empty');
    function apply(v) { let shown = 0; areas.forEach(a => { const on = !v || a.dataset.area === v; a.hidden = !on; if (on) shown++; }); if (empty) empty.hidden = !(v && shown === 0); }
    let saved = ''; try { saved = localStorage.getItem('ta-area') || ''; } catch (e) {}
    if (saved && !Array.from(sel.options).some(o => o.value === saved)) saved = '';
    sel.value = saved; apply(saved);
    sel.addEventListener('change', () => { try { localStorage.setItem('ta-area', sel.value); } catch (e) {} apply(sel.value); });
  }
});
</script>
