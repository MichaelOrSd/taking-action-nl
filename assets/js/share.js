/* Taking Action NL: QR codes, share blocks and quick share buttons. */
(function () {
  const q = s => encodeURIComponent(s);
  async function quickShare(url, title, say) {
    if (navigator.share) { try { await navigator.share({ title, text: 'Please read and sign this petition: ' + title, url }); } catch (e) {} return true; }
    try { await navigator.clipboard.writeText(url); if (say) say('Link copied.'); } catch (e) { window.prompt('Copy this link:', url); }
    return false;
  }

  // Quick share buttons (petition header, home cards)
  document.querySelectorAll('.share-quick').forEach(b => {
    b.addEventListener('click', async () => {
      const shared = await quickShare(b.dataset.url, b.dataset.title, t => { const old = b.textContent; b.textContent = t; setTimeout(() => { b.textContent = old; }, 2000); });
      if (!shared && !navigator.share) { const full = document.getElementById('share'); if (full && b.closest('article')) full.scrollIntoView({ behavior: 'smooth' }); }
    });
  });

  // Full share blocks
  document.querySelectorAll('.share').forEach(b => {
    const url = b.dataset.url, title = b.dataset.title || 'Petition';
    const text = 'Please read and sign this petition: ' + title + ' ' + url;
    const qrEl = b.querySelector('.share-qr');
    const size = window.innerWidth < 480 ? 128 : 168;
    if (window.QRCode && qrEl && !qrEl.firstChild) new window.QRCode(qrEl, { text: url, width: size, height: size, correctLevel: window.QRCode.CorrectLevel.M, colorDark: '#111111', colorLight: '#ffffff' });
    const msg = b.querySelector('.share-msg');
    const say = t => { if (msg) { msg.textContent = t; setTimeout(() => { msg.textContent = ''; }, 3000); } };
    b.querySelector('.share-email').href = 'mailto:?subject=' + q(title) + '&body=' + q(text);
    b.querySelector('.share-sms').href = 'sms:?&body=' + q(text);
    b.querySelector('.share-wa').href = 'https://wa.me/?text=' + q(text);
    b.querySelector('.share-fb').href = 'https://www.facebook.com/sharer/sharer.php?u=' + q(url);
    b.querySelector('.share-x').href = 'https://twitter.com/intent/tweet?text=' + q('Please read and sign this petition: ' + title) + '&url=' + q(url);
    b.querySelector('.share-native').onclick = () => quickShare(url, title, say);
    b.querySelector('.share-copy').onclick = async () => {
      try { await navigator.clipboard.writeText(url); say('Link copied.'); } catch (e) { window.prompt('Copy this link:', url); }
    };
    b.querySelector('.share-qr-dl').onclick = () => {
      const c = qrEl && qrEl.querySelector('canvas'); const img = qrEl && qrEl.querySelector('img');
      const data = c ? c.toDataURL('image/png') : (img ? img.src : null);
      if (!data) return;
      const a = document.createElement('a'); a.href = data; a.download = 'petition-qr.png'; document.body.appendChild(a); a.click(); a.remove();
    };
  });
})();
