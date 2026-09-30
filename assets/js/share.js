/* Taking Action NL: QR codes and share buttons. Runs on any page with .share blocks. */
(function () {
  const blocks = document.querySelectorAll('.share');
  if (!blocks.length) return;
  blocks.forEach(b => {
    const url = b.dataset.url, title = b.dataset.title || 'Petition';
    const text = title + ' — please read and sign: ' + url;
    const qrEl = b.querySelector('.share-qr');
    const size = b.classList.contains('share-compact') ? 112 : 168;
    if (window.QRCode && qrEl) new window.QRCode(qrEl, { text: url, width: size, height: size, correctLevel: window.QRCode.CorrectLevel.M, colorDark: '#111111', colorLight: '#ffffff' });
    const msg = b.querySelector('.share-msg');
    const say = t => { if (msg) { msg.textContent = t; setTimeout(() => { msg.textContent = ''; }, 3000); } };
    const q = s => encodeURIComponent(s);
    b.querySelector('.share-email').href = 'mailto:?subject=' + q(title) + '&body=' + q(text);
    b.querySelector('.share-sms').href = 'sms:?&body=' + q(text);
    b.querySelector('.share-wa').href = 'https://wa.me/?text=' + q(text);
    b.querySelector('.share-fb').href = 'https://www.facebook.com/sharer/sharer.php?u=' + q(url);
    b.querySelector('.share-x').href = 'https://twitter.com/intent/tweet?text=' + q(title) + '&url=' + q(url);
    const nat = b.querySelector('.share-native');
    if (nat) nat.onclick = async () => {
      if (navigator.share) { try { await navigator.share({ title, text: title, url }); } catch (e) {} return; }
      // No system share sheet (most desktops): copy the link and point at the options.
      try { await navigator.clipboard.writeText(url); say('Link copied. Or pick a way to share below.'); } catch (e) { say('Pick a way to share below.'); }
    };
    b.querySelector('.share-copy').onclick = async () => {
      try { await navigator.clipboard.writeText(url); say('Link copied.'); }
      catch (e) { window.prompt('Copy this link:', url); }
    };
    b.querySelector('.share-qr-dl').onclick = () => {
      const c = qrEl && qrEl.querySelector('canvas'); const img = qrEl && qrEl.querySelector('img');
      const data = c ? c.toDataURL('image/png') : (img ? img.src : null);
      if (!data) return;
      const a = document.createElement('a'); a.href = data; a.download = 'petition-qr.png'; document.body.appendChild(a); a.click(); a.remove();
    };
  });
})();
