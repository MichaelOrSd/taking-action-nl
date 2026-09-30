/* Taking Action NL: petition page behaviour.
   Signing is one journey on one page:
   1. fill in the form and draw a signature;
   2. a six-digit code is emailed; enter it in the box that appears;
   3. the signature is recorded, already confirmed, and the page says thank you.
   Nothing is stored until the code is verified. */
(function () {
  const article = document.querySelector('article.petition');
  if (!article) return;
  const slug = article.dataset.slug;
  const localArea = (article.dataset.localArea || '').split('|').map(s => s.trim().toLowerCase()).filter(Boolean);
  const configured = window.TA && window.TA.supabaseUrl && !/YOUR-PROJECT/.test(window.TA.supabaseUrl);
  const sb = configured && window.supabase ? window.supabase.createClient(window.TA.supabaseUrl, window.TA.supabaseAnonKey) : null;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

  async function loadCounts() {
    const d = $('count-digital'), p = $('count-paper');
    if (!sb) { if (d) d.textContent = '0'; if (p) p.textContent = '0'; return; }
    const { data, error } = await sb.rpc('petition_counts', { p_slug: slug });
    if (error || !data || !data.length) { if (d) d.textContent = '0'; if (p) p.textContent = '0'; return; }
    if (d) d.textContent = Number(data[0].confirmed_count || 0).toLocaleString();
    if (p) p.textContent = Number(data[0].paper_count || 0).toLocaleString();
  }
  loadCounts();

  async function loadSigners() {
    const ul = $('signer-list');
    if (!ul) return;
    if (!sb) { ul.innerHTML = '<li class="muted">Signing is not switched on yet.</li>'; return; }
    const { data, error } = await sb.rpc('public_signers', { p_slug: slug, p_limit: 60 });
    if (error || !data) { ul.innerHTML = '<li class="muted">Could not load the list.</li>'; return; }
    if (!data.length) { ul.innerHTML = '<li class="muted">Be the first to sign.</li>'; return; }
    ul.innerHTML = data.map(r => {
      const where = [r.community, r.province && r.province !== 'NL' ? r.province : ''].filter(Boolean).join(', ');
      return '<li class="signer"><span class="initials">' + esc(r.initials) + '</span><span class="redacted" aria-hidden="true">name withheld</span><span class="where">' + esc(where) + '</span></li>';
    }).join('');
  }
  loadSigners();

  const canvas = $('signature-pad');
  let pad = null;
  if (canvas && window.SignaturePad) {
    pad = new window.SignaturePad(canvas, { minWidth: 1, maxWidth: 2.5, penColor: '#111' });
    function resize() {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const w = canvas.parentElement.clientWidth;
      canvas.width = w * ratio; canvas.height = 180 * ratio;
      canvas.style.width = w + 'px'; canvas.style.height = '180px';
      canvas.getContext('2d').scale(ratio, ratio);
      pad.clear();
    }
    window.addEventListener('resize', resize); resize();
    $('pad-clear').addEventListener('click', () => pad.clear());
  }

  const form = $('sign-form'), stepWait = $('sign-step-wait'), stepDone = $('sign-step-done');
  const msg = $('form-msg'), waitMsg = $('wait-msg');
  if (!form || !stepWait) return;
  function say(el, text, kind) { el.textContent = text; el.className = 'form-msg ' + (kind || ''); }
  let pending = null, clientToken = null, lastSent = 0, pollTimer = null, pollStart = 0;
  const redirect = location.origin + (window.TA.baseurl || '') + '/thanks/?p=' + encodeURIComponent(slug);

  async function sendLink(email) {
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect, shouldCreateUser: true } });
    if (!error) lastSent = Date.now();
    return error;
  }
  function finish() {
    clearInterval(pollTimer); pollTimer = null;
    stepWait.hidden = true; stepDone.hidden = false;
    stepDone.scrollIntoView({ behavior: 'smooth', block: 'center' });
    form.reset(); if (pad) pad.clear();
    loadCounts(); loadSigners();
  }
  function startPolling() {
    pollStart = Date.now();
    pollTimer = setInterval(async () => {
      if (Date.now() - pollStart > 30 * 60 * 1000) { clearInterval(pollTimer); say(waitMsg, 'Still waiting. This page has stopped checking; open the link in the email whenever you find it and it will confirm on its own.', 'warn'); return; }
      const { data } = await sb.rpc('signature_confirmed', { p_token: clientToken });
      if (data === true) finish();
    }, 3000);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (form.website.value) return;
    if (!pad || pad.isEmpty()) { say(msg, 'Please draw your signature.', 'err'); return; }
    if (!sb) { say(msg, 'Signing is not switched on yet. The organiser has not connected the database.', 'err'); return; }
    const email = form.email.value.trim().toLowerCase();
    const community = form.community.value.trim();
    clientToken = (crypto.randomUUID ? crypto.randomUUID() : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)));
    pending = {
      petition_slug: slug,
      full_name: form.full_name.value.trim(),
      street: form.street.value.trim(),
      community: community,
      province: form.province.value,
      postal_code: form.postal_code.value.trim().toUpperCase() || null,
      email: email,
      phone: form.phone.value.trim() || null,
      signature_data: pad.toDataURL('image/png'),
      consent_updates: form.consent_updates.checked,
      consent_statement: form.consent_statement.checked,
      in_local_area: localArea.includes(community.toLowerCase()),
      user_agent: navigator.userAgent.slice(0, 200),
      client_token: clientToken
    };
    const btn = $('sign-submit'); btn.disabled = true; say(msg, 'Saving and sending your confirmation email…');
    const { error: aErr } = await sb.rpc('add_signature', { s: pending });
    if (aErr) {
      btn.disabled = false;
      say(msg, /duplicate|already/i.test(aErr.message) ? 'You have already signed this petition. Thank you.' : 'Something went wrong: ' + aErr.message, 'err');
      return;
    }
    if (form.consent_future && form.consent_future.checked) {
      sb.rpc('join_supporters', { p_email: email, p_name: pending.full_name, p_community: community, p_province: pending.province, p_source: slug }).then(() => {});
    }
    const err = await sendLink(email);
    btn.disabled = false;
    if (err) { say(msg, 'Your details are saved but the email could not be sent: ' + err.message, 'err'); return; }
    say(msg, '');
    $('wait-email').textContent = email;
    form.hidden = true; stepWait.hidden = false;
    stepWait.scrollIntoView({ behavior: 'smooth', block: 'center' });
    startPolling();
  });

  $('wait-resend').addEventListener('click', async () => {
    if (!pending) return;
    const wait = 60000 - (Date.now() - lastSent);
    if (wait > 0) { say(waitMsg, 'Please wait ' + Math.ceil(wait / 1000) + ' seconds before asking for another email.', 'warn'); return; }
    say(waitMsg, 'Sending another email…');
    const err = await sendLink(pending.email);
    say(waitMsg, err ? 'Could not send: ' + err.message : 'Another email is on its way to ' + pending.email + '.', err ? 'err' : 'ok');
  });

  $('wait-back').addEventListener('click', () => {
    clearInterval(pollTimer); pollTimer = null;
    stepWait.hidden = true; form.hidden = false; say(waitMsg, '');
    form.email.focus();
  });
})();
