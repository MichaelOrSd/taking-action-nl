---
title: Home
permalink: /
---
<section class="hero">
  <p class="eyebrow">Newfoundland and Labrador</p>
  <h1>Taking Action NL</h1>
  <p>Free petitions, run by residents, delivered to the people who can act: town councils, the House of Assembly, ministers and regulators. Sign online, then sign on paper where the law needs ink.</p>
  <p><a class="btn btn-primary" href="#petitions">See open petitions</a> <a class="btn" href="{{ '/start/' | relative_url }}">Start a petition</a></p>
</section>

<section class="note privacy-first">
  <p><strong>Privacy first.</strong> We collect only what a petition needs: your name, address, a signature and an email to confirm it is you. Nothing is sold, shared with advertisers or used for anything but the petition you signed. Your signature is never shown online; only the count is. The people who see your name are the organiser and the public body the petition is delivered to, and every petition tells you who that is before you sign. You can be removed from the online list by asking. <a href="{{ '/privacy/' | relative_url }}">Read the whole policy</a>; it fits on one page.</p>
</section>

<section id="petitions">
  <h2>Petitions by community</h2>
  {% assign open = site.petitions | where: "status", "open" | sort: "community" %}
  {% assign groups = open | group_by: "community" | sort: "name" %}
  <div class="area-pick">
    <label for="area-select">Show petitions for</label>
    <select id="area-select">
      <option value="">All communities</option>
      {% for g in groups %}<option value="{{ g.name | slugify }}">{{ g.name }}</option>{% endfor %}
    </select>
  </div>
  {% for g in groups %}
  <div class="area" id="area-{{ g.name | slugify }}" data-area="{{ g.name | slugify }}">
  <h3 class="area-title">{{ g.name }}<span class="area-count">{{ g.items.size }} open</span></h3>
  <ul class="petition-list">
  {% assign items = g.items | sort: "opened" | reverse %}
  {% for p in items %}
    <li>
      <a class="title" href="{{ p.url | relative_url }}">{{ p.title }}</a>
      <span class="meta">{{ p.community }} · opened {{ p.opened | date: "%B %-d, %Y" }} · organised by {{ p.organiser }}</span>
      {{ p.summary }}
      <a class="go" href="{{ p.url | relative_url }}">Read and sign →</a>
      {% assign share_url = p.url | absolute_url %}
      {% include share.html url=share_url title=p.title compact=true %}
    </li>
  {% endfor %}
  </ul>
  </div>
  {% endfor %}
  {% if open.size == 0 %}<p class="muted">No open petitions yet.</p>{% endif %}
  <p class="muted area-empty" id="area-empty" hidden>No open petitions for that community yet. <a href="{{ '/start/' | relative_url }}">Start one</a>.</p>

  {% assign closed = site.petitions | where_exp: "p", "p.status != 'open'" | sort: "community" %}
  {% if closed.size > 0 %}
  <h2>Delivered and closed</h2>
  {% assign cgroups = closed | group_by: "community" | sort: "name" %}
  {% for g in cgroups %}
  <h3 class="area-title">{{ g.name }}</h3>
  <ul class="petition-list">
  {% for p in g.items %}<li><a class="title" href="{{ p.url | relative_url }}">{{ p.title }}</a><span class="meta">{{ p.community }} · {{ p.status }}</span></li>{% endfor %}
  </ul>
  {% endfor %}
  {% endif %}
  <p class="muted area-note">Every community in Newfoundland and Labrador can have its own heading here. <a href="{{ '/start/' | relative_url }}">Start a petition</a> for yours.</p>
</section>

<section>
  <h2>How it works</h2>
  <ol>
    <li><strong>Read the petition.</strong> Every petition says who it goes to, what it asks, and who organises it.</li>
    <li><strong>Sign online.</strong> Name, address, a drawn signature, and one email click to confirm it is you.</li>
    <li><strong>Sign on paper if it is going to the House.</strong> The House of Assembly accepts only original handwritten signatures. We print a page in the House's format with your details on it; you sign in ink.</li>
    <li><strong>Delivery.</strong> The organiser tables the petition with the council or hands it to an MHA, and reports back here.</li>
  </ol>
  <p class="note"><strong>A petition asks. It does not order.</strong> No petition in Canada is legally binding. What it does is put a number on how many people want something done, on the public record, in front of the people who can do it.</p>
</section>

<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script src="{{ '/assets/js/share.js' | relative_url }}"></script>
<script>
(function () {
  const sel = document.getElementById('area-select');
  if (!sel) return;
  const areas = Array.from(document.querySelectorAll('#petitions .area'));
  const empty = document.getElementById('area-empty');
  function apply(v) {
    let shown = 0;
    areas.forEach(a => { const on = !v || a.dataset.area === v; a.hidden = !on; if (on) shown++; });
    if (empty) empty.hidden = !(v && shown === 0);
  }
  let saved = '';
  try { saved = localStorage.getItem('ta-area') || ''; } catch (e) {}
  if (saved && !Array.from(sel.options).some(o => o.value === saved)) saved = '';
  sel.value = saved; apply(saved);
  sel.addEventListener('change', () => { try { localStorage.setItem('ta-area', sel.value); } catch (e) {} apply(sel.value); });
})();
</script>
