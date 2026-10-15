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

  // Signature pad. The form shows a tap target with a preview; drawing happens in a full-screen
  // modal so the canvas is as big as the phone allows. Clear and Cancel sit at the top, Done at the bottom.
  const canvas = $('signature-pad'), modal = $('sign-modal'), preview = $('pad-preview'), prompt = $('pad-prompt');
  let pad = null, lastW = 0, lastH = 0, before = [];
  function clearSig() { if (pad) pad.clear(); if (preview) { preview.hidden = true; preview.removeAttribute('src'); } if (prompt) prompt.hidden = false; }
  if (canvas && modal && window.SignaturePad) {
    pad = new window.SignaturePad(canvas, { minWidth: 1, maxWidth: 2.5, penColor: '#111' });
    const wrap = $('pad-wrap'), padMsg = $('pad-msg');
    function resize() {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h || (w === lastW && h === lastH)) return;
      const strokes = lastW ? pad.toData() : [];
      lastW = w; lastH = h;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = w * ratio; canvas.height = h * ratio;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      canvas.getContext('2d').scale(ratio, ratio);
      pad.clear();
      if (strokes.length) pad.fromData(strokes);
    }
    function openPad() {
      before = pad.toData();
      modal.hidden = false; document.body.classList.add('modal-open');
      say(padMsg, 'Sign across the line with your finger or mouse.');
      requestAnimationFrame(() => { resize(); pad.on(); $('pad-done').focus(); });
    }
    function closePad() { modal.hidden = true; document.body.classList.remove('modal-open'); pad.off(); $('pad-open').focus(); }
    $('pad-open').addEventListener('click', openPad);
    $('pad-clear').addEventListener('click', () => { pad.clear(); say(padMsg, 'Cleared. Sign again.'); });
    $('pad-cancel').addEventListener('click', () => { pad.clear(); if (before.length) pad.fromData(before); closePad(); });
    $('pad-done').addEventListener('click', () => {
      if (pad.isEmpty()) { say(padMsg, 'Please draw your signature first, or press Cancel.', 'err'); return; }
      preview.src = pad.toDataURL('image/png'); preview.hidden = false; prompt.hidden = true;
      closePad();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) $('pad-cancel').click(); });
    window.addEventListener('resize', () => { if (!modal.hidden) resize(); });
    window.addEventListener('orientationchange', () => setTimeout(() => { if (!modal.hidden) resize(); }, 200));
    pad.off();
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

  const signSection = document.getElementById('sign');
  // Scroll so the "Sign" heading and the step pills are in view, not just the current card.
  function scrollToSteps() { (signSection || form).scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  function showDone(fromOtherDevice) {
    clearInterval(pollTimer); pollTimer = null;
    form.hidden = true; stepWait.hidden = true; stepDone.hidden = false; setStep(4);
    const h = $('done-heading');
    loadCounts().then(() => { if (h && confirmedCount > 0) h.textContent = 'Thank you. You are signature number ' + confirmedCount.toLocaleString() + '.'; loadSigners(); });
    if (fromOtherDevice && $('done-other')) $('done-other').hidden = false;
    setTimeout(scrollToSteps, 150);
    const shareBtn = stepDone.querySelector('.share-main'); if (shareBtn) shareBtn.focus({ preventScroll: true });
  }
  // The confirmation page (opened from the email) asks whether this tab is still waiting. If so, it
  // tells this tab to finish and stays put, so the signer ends up with one petition tab, not two.
  let chan = null; try { chan = new BroadcastChannel('ta-sign'); } catch (e) { chan = null; }
  if (chan) chan.onmessage = (ev) => {
    const m = ev.data || {};
    if (m.slug !== slug || stepWait.hidden) return;
    if (m.type === 'ping') chan.postMessage({ type: 'pong', slug });
    if (m.type === 'confirmed') showDone(false);
  };
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
      if (data === true) { form.reset(); clearSig(); showDone(false); }
    }, 3000);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (form.website.value) return;
    if (!pad || pad.isEmpty()) { say(msg, 'Please tap the signature box and draw your signature.', 'err'); $('pad-open').focus(); return; }
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
    const btn = $('sign-submit'), btnText = btn.textContent; btn.disabled = true; btn.textContent = 'Sending\u2026'; say(msg, '');
    const { error: aErr } = await sb.rpc('add_signature', { s: pending });
    if (aErr && /DUPLICATE_EMAIL/.test(aErr.message)) {
      // This email already has a confirmed signature: that is a success, not a fault. Show it as one.
      btn.classList.add('btn-success'); btn.textContent = 'Already signed. Thank you';
      await new Promise(r => setTimeout(r, 900));
      btn.disabled = false; btn.classList.remove('btn-success'); btn.textContent = btnText;
      clearSig(); showDone(false);
      return;
    }
    if (aErr) { btn.disabled = false; btn.textContent = btnText; say(msg, plainError(aErr), 'err'); msg.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    if (wantsUpdates) sb.rpc('join_supporters', { p_email: email, p_name: pending.full_name, p_community: community, p_province: pending.province, p_source: slug }).then(() => {});
    const err = await sendLink(email);
    // The button itself says what happened, since the message under it can sit below the fold.
    btn.classList.add('btn-success'); btn.textContent = 'Check your email'; say(msg, '');
    await new Promise(r => setTimeout(r, 900));
    btn.disabled = false; btn.classList.remove('btn-success'); btn.textContent = btnText;
    $('wait-email').textContent = email;
    form.hidden = true; stepWait.hidden = false; setStep(2);
    scrollToSteps();
    if (err) say(waitMsg, 'We saved your details but could not send the email. Press "Send it again".', 'err');
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
