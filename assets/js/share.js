/* Taking Action NL: one Share button. Phones get the system share sheet;
   everywhere else a small menu drops down with the usual options. */
(function () {
  const q = s => encodeURIComponent(s);
  const shareText = title => 'Please read and sign this petition: ' + title;

  async function nativeShare(url, title) {
    if (!navigator.share) return false;
    try { await navigator.share({ title, text: shareText(title), url }); } catch (e) {}
    return true;
  }
  async function copy(url, say) {
    try { await navigator.clipboard.writeText(url); if (say) say('Link copied.'); }
    catch (e) { window.prompt('Copy this link:', url); }
  }
  function closeAll() {
    document.querySelectorAll('.share-menu').forEach(m => { m.hidden = true; });
    document.querySelectorAll('.share-main[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.addEventListener('click', e => { if (!e.target.closest('.share')) closeAll(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

  // Quick share buttons (petition header, home cards): system sheet, else copy the link.
  document.querySelectorAll('.share-quick').forEach(b => {
    b.addEventListener('click', async () => {
      if (await nativeShare(b.dataset.url, b.dataset.title)) return;
      const full = b.closest('article') && document.querySelector('.share .share-main');
      if (full) { full.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => full.click(), 400); return; }
      await copy(b.dataset.url, t => { const old = b.textContent; b.textContent = t; setTimeout(() => { b.textContent = old; }, 2000); });
    });
  });

  // Full share blocks: QR + one button
  document.querySelectorAll('.share').forEach(b => {
    const url = b.dataset.url, title = b.dataset.title || 'Petition';
    const text = shareText(title) + ' ' + url;
    const qrEl = b.querySelector('.share-qr');
    const size = window.innerWidth < 480 ? 128 : 168;
    if (window.QRCode && qrEl && !qrEl.firstChild) new window.QRCode(qrEl, { text: url, width: size, height: size, correctLevel: window.QRCode.CorrectLevel.M, colorDark: '#111111', colorLight: '#ffffff' });
    const msg = b.querySelector('.share-msg');
    const say = t => { if (msg) { msg.textContent = t; setTimeout(() => { msg.textContent = ''; }, 3000); } };
    const menu = b.querySelector('.share-menu'), main = b.querySelector('.share-main');
    b.querySelector('.share-email').href = 'mailto:?subject=' + q(title) + '&body=' + q(text);
    b.querySelector('.share-sms').href = 'sms:?&body=' + q(text);
    b.querySelector('.share-wa').href = 'https://wa.me/?text=' + q(text);
    b.querySelector('.share-fb').href = 'https://www.facebook.com/sharer/sharer.php?u=' + q(url);
    b.querySelector('.share-x').href = 'https://twitter.com/intent/tweet?text=' + q(shareText(title)) + '&url=' + q(url);
    main.onclick = async (e) => {
      e.stopPropagation();
      if (await nativeShare(url, title)) return;
      const open = menu.hidden; closeAll();
      menu.hidden = !open; main.setAttribute('aria-expanded', String(open));
      if (open) { const first = menu.querySelector('.share-item'); if (first) first.focus(); }
    };
    b.querySelector('.share-copy').onclick = async () => { await copy(url, say); closeAll(); };
    b.querySelector('.share-qr-dl').onclick = () => {
      const c = qrEl && qrEl.querySelector('canvas'); const img = qrEl && qrEl.querySelector('img');
      const data = c ? c.toDataURL('image/png') : (img ? img.src : null);
      if (data) { const a = document.createElement('a'); a.href = data; a.download = 'petition-qr.png'; document.body.appendChild(a); a.click(); a.remove(); }
      closeAll();
    };
    menu.querySelectorAll('a.share-item').forEach(a => a.addEventListener('click', () => setTimeout(closeAll, 100)));
  });
})();
