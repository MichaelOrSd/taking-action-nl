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

  const form = $('sign-form'), stepCode = $('sign-step-code'), stepDone = $('sign-step-done');
  const msg = $('form-msg'), codeMsg = $('code-msg');
  if (!form || !stepCode) return;
  function say(el, text, kind) { el.textContent = text; el.className = 'form-msg ' + (kind || ''); }
  let pending = null;
  let lastSent = 0;

  async function sendCode(email) {
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (!error) lastSent = Date.now();
    return error;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (form.website.value) return;
    if (!pad || pad.isEmpty()) { say(msg, 'Please draw your signature.', 'err'); return; }
    if (!sb) { say(msg, 'Signing is not switched on yet. The organiser has not connected the database.', 'err'); return; }
    const email = form.email.value.trim().toLowerCase();
    const community = form.community.value.trim();
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
      user_agent: navigator.userAgent.slice(0, 200)
    };
    const btn = $('sign-submit'); btn.disabled = true; say(msg, 'Sending your code…');
    const err = await sendCode(email);
    btn.disabled = false;
    if (err) { say(msg, 'Could not send the code: ' + err.message, 'err'); return; }
    say(msg, '');
    $('code-email').textContent = email;
    form.hidden = true; stepCode.hidden = false;
    $('code-input').value = ''; $('code-input').focus();
    stepCode.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('code-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('code-input').value.replace(/\D/g, '');
    if (code.length < 6) { say(codeMsg, 'Enter the six-digit code from the email.', 'err'); return; }
    const b = $('code-submit'); b.disabled = true; say(codeMsg, 'Checking…');
    const { error: vErr } = await sb.auth.verifyOtp({ email: pending.email, token: code, type: 'email' });
    if (vErr) { b.disabled = false; say(codeMsg, 'That code did not work. Check the digits, or press "Send a new code".', 'err'); return; }
    const { error: aErr } = await sb.rpc('add_signature', { s: pending });
    await sb.auth.signOut();
    b.disabled = false;
    if (aErr) {
      say(codeMsg, /duplicate|already/i.test(aErr.message) ? 'You have already signed this petition. Thank you.' : 'Could not record your signature: ' + aErr.message, 'err');
      return;
    }
    stepCode.hidden = true; stepDone.hidden = false;
    stepDone.scrollIntoView({ behavior: 'smooth', block: 'center' });
    form.reset(); if (pad) pad.clear();
    loadCounts(); loadSigners();
  });

  $('code-resend').addEventListener('click', async () => {
    if (!pending) return;
    const wait = 60000 - (Date.now() - lastSent);
    if (wait > 0) { say(codeMsg, 'Please wait ' + Math.ceil(wait / 1000) + ' seconds before asking for another code.', 'warn'); return; }
    say(codeMsg, 'Sending a new code…');
    const err = await sendCode(pending.email);
    say(codeMsg, err ? 'Could not send: ' + err.message : 'A new code is on its way to ' + pending.email + '.', err ? 'err' : 'ok');
  });

  $('code-back').addEventListener('click', () => {
    stepCode.hidden = true; form.hidden = false; say(codeMsg, '');
    form.email.focus();
  });
})();
