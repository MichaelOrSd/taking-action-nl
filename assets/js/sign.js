/* Taking Action NL: petition page behaviour.
   Signing is one journey on one page:
   1. details and a drawn signature;
   2. "check your email" - the page waits and advances when the link is clicked;
   3. done, with the share block.
   The signature is stored unconfirmed at step 1 and counted only after the click. */
(function () {
  const article = document.querySelector('article.petition');
  if (!article) return;
  const slug = article.dataset.slug;
  const localArea = (article.dataset.localArea || '').split('|').map(s => s.trim().toLowerCase()).filter(Boolean);
  const configured = window.TA && window.TA.supabaseUrl && !/YOUR-PROJECT/.test(window.TA.supabaseUrl);
  const sb = configured && window.supabase ? window.supabase.createClient(window.TA.supabaseUrl, window.TA.supabaseAnonKey) : null;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  let confirmedCount = 0;

  async function loadCounts() {
    const d = $('count-digital'), p = $('count-paper'), pw = $('count-paper-wrap'), lbl = $('count-label-text');
    if (!sb) { if (d) d.textContent = '0'; return; }
    const { data, error } = await sb.rpc('petition_counts', { p_slug: slug });
    const c = (!error && data && data.length) ? Number(data[0].confirmed_count || 0) : 0;
    const paper = (!error && data && data.length) ? Number(data[0].paper_count || 0) : 0;
    confirmedCount = c;
    if (d) d.textContent = c.toLocaleString();
    if (p) p.textContent = paper.toLocaleString();
    if (pw) pw.hidden = !(paper > 0);
    if (lbl) lbl.textContent = paper > 0 ? 'signed online' : 'signed';
  }

  async function loadSigners() {
    const ul = $('signer-list'), more = $('signer-more');
    if (!ul) return;
    if (!sb) { ul.innerHTML = '<li class="meta">Signing is not switched on yet.</li>'; return; }
    const { data, error } = await sb.rpc('public_signers', { p_slug: slug, p_limit: 12 });
    if (error || !data) { ul.innerHTML = '<li class="meta">Could not load the list.</li>'; return; }
    if (!data.length) { ul.innerHTML = '<li class="meta">Be the first to sign.</li>'; if (more) more.hidden = true; return; }
    ul.innerHTML = data.map(r => {
      const where = [r.community, r.province && r.province !== 'NL' ? r.province : ''].filter(Boolean).join(', ');
      return '<li class="signer"><span class="initials">' + esc(r.initials) + '</span><span class="where">' + esc(where) + '</span></li>';
    }).join('');
    if (more) { const rest = confirmedCount - data.length; more.hidden = rest <= 0; more.textContent = rest > 0 ? 'and ' + rest.toLocaleString() + ' more.' : ''; }
  }
  loadCounts().then(loadSigners);

  // Signature pad. Resize only when the width really changes, and keep the strokes.
  const canvas = $('signature-pad');
  let pad = null, lastW = 0;
  if (canvas && window.SignaturePad) {
    pad = new window.SignaturePad(canvas, { minWidth: 1, maxWidth: 2.5, penColor: '#111' });
    const H = () => (window.innerWidth < 480 ? 150 : 160);
    function resize() {
      const w = canvas.parentElement.clientWidth;
      if (w === lastW) return;
      const strokes = lastW ? pad.toData() : [];
      lastW = w;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = w * ratio; canvas.height = H() * ratio;
      canvas.style.width = w + 'px'; canvas.style.height = H() + 'px';
      canvas.getContext('2d').scale(ratio, ratio);
      pad.clear();
      if (strokes.length) pad.fromData(strokes);
    }
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
    resize();
    $('pad-clear').addEventListener('click', () => pad.clear());
  }

  const form = $('sign-form'), stepWait = $('sign-step-wait'), stepDone = $('sign-step-done'), steps = $('steps');
  const msg = $('form-msg'), waitMsg = $('wait-msg');
  if (!form || !stepWait) return;
  function say(el, text, kind) { el.textContent = text; el.className = 'form-msg ' + (kind || ''); }
  function setStep(n) {
    if (!steps) return;
    Array.from(steps.children).forEach((li, i) => {
      li.className = 'step' + (i + 1 < n ? ' done' : i + 1 === n ? ' on' : '');
      if (i + 1 === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
  }
  function plainError(e) {
    const m = (e && e.message) || '';
    if (/DUPLICATE_EMAIL/.test(m)) return 'This email has already signed this petition. Thank you.';
    if (/DUPLICATE_PERSON/.test(m)) return 'Someone with this name at this address has already signed this petition. If that is not you, add a middle initial or check the address.';
    if (/duplicate|already/i.test(m)) return 'This looks like a repeat of a signature already on the petition. Thank you.';
    if (/fetch|network|Failed to|50\d/i.test(m)) return 'Could not reach the server. Check your connection and press Sign again; nothing was lost.';
    return 'Something went wrong. Please try again in a moment.';
  }
  let pending = null, clientToken = null, lastSent = 0, pollTimer = null, pollStart = 0, cooldownTimer = null;
  const redirect = location.origin + (window.TA.baseurl || '') + '/thanks/?p=' + encodeURIComponent(slug);

  function showDone(fromOtherDevice) {
    clearInterval(pollTimer); pollTimer = null;
    form.hidden = true; stepWait.hidden = true; stepDone.hidden = false; setStep(4);
    const h = $('done-heading');
    loadCounts().then(() => { if (h && confirmedCount > 0) h.textContent = 'Thank you. You are signature number ' + confirmedCount.toLocaleString() + '.'; loadSigners(); });
    if (fromOtherDevice && $('done-other')) $('done-other').hidden = false;
    setTimeout(() => stepDone.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    const shareBtn = document.querySelector('.share-section .share-main'); if (shareBtn) shareBtn.focus({ preventScroll: true });
  }
  if (new URLSearchParams(location.search).get('signed') === '1') {
    history.replaceState(null, '', location.pathname + '#sign');
    showDone(true);
  }

  async function sendLink(email) {
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect, shouldCreateUser: true } });
    if (!error) { lastSent = Date.now(); startCooldown(); }
    return error;
  }
  function startCooldown() {
    const b = $('wait-resend');
    clearInterval(cooldownTimer);
    cooldownTimer = setInterval(() => {
      const left = Math.ceil((60000 - (Date.now() - lastSent)) / 1000);
      if (left > 0) { b.disabled = true; b.textContent = 'Send it again (' + left + ' s)'; }
      else { b.disabled = false; b.textContent = 'Send it again'; clearInterval(cooldownTimer); }
    }, 500);
  }
  function startPolling() {
    pollStart = Date.now();
    pollTimer = setInterval(async () => {
      if (Date.now() - pollStart > 30 * 60 * 1000) { clearInterval(pollTimer); say(waitMsg, 'This page has stopped checking. Click the link in the email whenever you find it; it confirms on its own.', 'warn'); return; }
      const { data } = await sb.rpc('signature_confirmed', { p_token: clientToken });
      if (data === true) { form.reset(); if (pad) pad.clear(); showDone(false); }
    }, 3000);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (form.website.value) return;
    if (!pad || pad.isEmpty()) { say(msg, 'Please draw your signature.', 'err'); return; }
    if (!sb) { say(msg, 'Signing is not switched on yet.', 'err'); return; }
    const email = form.email.value.trim().toLowerCase();
    const community = form.community.value.trim();
    clientToken = crypto.randomUUID ? crypto.randomUUID() : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
    const wantsUpdates = form.consent_updates.checked;
    pending = {
      petition_slug: slug,
      full_name: form.full_name.value.trim(),
      street: form.street.value.trim(),
      community: community,
      province: form.province.value,
      postal_code: null,
      email: email,
      phone: null,
      signature_data: pad.toDataURL('image/png'),
      consent_updates: wantsUpdates,
      consent_statement: !!(form.consent_statement && form.consent_statement.checked),
      in_local_area: localArea.includes(community.toLowerCase()),
      user_agent: navigator.userAgent.slice(0, 200),
      client_token: clientToken
    };
    const btn = $('sign-submit'); btn.disabled = true; say(msg, 'Saving…');
    const { error: aErr } = await sb.rpc('add_signature', { s: pending });
    if (aErr) { btn.disabled = false; say(msg, plainError(aErr), 'err'); return; }
    if (wantsUpdates) sb.rpc('join_supporters', { p_email: email, p_name: pending.full_name, p_community: community, p_province: pending.province, p_source: slug }).then(() => {});
    const err = await sendLink(email);
    btn.disabled = false; say(msg, '');
    $('wait-email').textContent = email;
    form.hidden = true; stepWait.hidden = false; setStep(2);
    if (err) say(waitMsg, 'We saved your details but could not send the email. Press "Send it again".', 'err');
    stepWait.scrollIntoView({ behavior: 'smooth', block: 'start' });
    startPolling();
  });

  $('wait-resend').addEventListener('click', async () => {
    if (!pending) return;
    say(waitMsg, 'Sending another email…');
    const err = await sendLink(pending.email);
    say(waitMsg, err ? 'Could not send. Try again in a minute.' : 'Sent again to ' + pending.email + '.', err ? 'err' : 'ok');
  });

  $('wait-back').addEventListener('click', () => {
    clearInterval(pollTimer); pollTimer = null;
    stepWait.hidden = true; form.hidden = false; setStep(1); say(waitMsg, '');
    form.email.focus();
  });
})();
