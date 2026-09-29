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

<section id="petitions">
  <h2>Open petitions</h2>
  <ul class="petition-list">
  {% assign open = site.petitions | where: "status", "open" | sort: "opened" | reverse %}
  {% for p in open %}
    <li>
      <a href="{{ p.url | relative_url }}">{{ p.title }}</a><br>
      <span class="muted">{{ p.community }} · opened {{ p.opened | date: "%B %-d, %Y" }}</span><br>
      {{ p.summary }}
    </li>
  {% endfor %}
  {% if open.size == 0 %}<li class="muted">No open petitions yet.</li>{% endif %}
  </ul>

  {% assign closed = site.petitions | where_exp: "p", "p.status != 'open'" %}
  {% if closed.size > 0 %}
  <h2>Delivered and closed</h2>
  <ul class="petition-list">
  {% for p in closed %}<li><a href="{{ p.url | relative_url }}">{{ p.title }}</a> <span class="muted">· {{ p.status }}</span></li>{% endfor %}
  </ul>
  {% endif %}
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
