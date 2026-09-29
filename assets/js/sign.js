/* Taking Action NL: petition page behaviour (counter + sign form). */
(function () {
  const article = document.querySelector('article.petition');
  if (!article) return;
  const slug = article.dataset.slug;
  const localArea = (article.dataset.localArea || '').split('|').map(s => s.trim().toLowerCase()).filter(Boolean);
  const configured = window.TA && window.TA.supabaseUrl && !/YOUR-PROJECT/.test(window.TA.supabaseUrl);
  const sb = configured && window.supabase ? window.supabase.createClient(window.TA.supabaseUrl, window.TA.supabaseAnonKey) : null;

  // Counter
  async function loadCounts() {
    const d = document.getElementById('count-digital');
    const p = document.getElementById('count-paper');
    if (!sb) { if (d) d.textContent = '0'; if (p) p.textContent = '0'; return; }
    const { data, error } = await sb.rpc('petition_counts', { p_slug: slug });
    if (error || !data || !data.length) { if (d) d.textContent = '0'; if (p) p.textContent = '0'; return; }
    if (d) d.textContent = Number(data[0].confirmed_count || 0).toLocaleString();
    if (p) p.textContent = Number(data[0].paper_count || 0).toLocaleString();
  }
  loadCounts();

  // Signature pad
  const canvas = document.getElementById('signature-pad');
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
    document.getElementById('pad-clear').addEventListener('click', () => pad.clear());
  }

  // Form
  const form = document.getElementById('sign-form');
  const msg = document.getElementById('form-msg');
  if (!form) return;
  function say(text, kind) { msg.textContent = text; msg.className = 'form-msg ' + (kind || ''); }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (form.website.value) return; // honeypot
    if (!pad || pad.isEmpty()) { say('Please draw your signature.', 'err'); return; }
    if (!sb) { say('Signing is not switched on yet. The organiser has not connected the database.', 'err'); return; }

    const email = form.email.value.trim().toLowerCase();
    const community = form.community.value.trim();
    const row = {
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

    const btn = document.getElementById('sign-submit');
    btn.disabled = true; say('Saving your signature…');
    const { error } = await sb.rpc('add_signature', { s: row });
    if (error) {
      btn.disabled = false;
      say(/duplicate|already/i.test(error.message) ? 'It looks like you have already signed this petition. Check your email for the confirmation link.' : 'Something went wrong: ' + error.message, 'err');
      return;
    }
    // Send the confirmation link (Supabase Auth one-time link)
    const redirect = location.origin + (window.TA.baseurl || '') + '/thanks/?p=' + encodeURIComponent(slug);
    const { error: otpErr } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect, shouldCreateUser: true } });
    if (otpErr) {
      say('Your signature is saved but the confirmation email could not be sent (' + otpErr.message + '). The organiser can confirm it by hand; email them if you do not hear back.', 'warn');
      return;
    }
    form.reset(); if (pad) pad.clear();
    say('Thank you. Check your email for a link to confirm your signature. It counts once you click it.', 'ok');
  });
})();
