/* Image credits page: the credit data (data/image-credits.js) is only fetched when this page is opened. */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var v = (document.currentScript && (document.currentScript.getAttribute('src').match(/\?v=([^&]+)/) || [])[1]) || '';
  function render() {
    var d = window.__NM_CREDITS__ || { items: [] }, st = document.getElementById('credits-status'), ul = document.getElementById('credits-list'), tm = document.getElementById('credits-tm');
    var photos = d.items.filter(function (x) { return x[1] !== 'logo'; }).length;
    st.textContent = d.items.length ? d.items.length + ' pictures: ' + photos + ' photos, ' + (d.items.length - photos) + ' logos.' : 'No pictures in this build.';
    if (d.tm) { tm.textContent = d.tm; tm.hidden = false; }
    ul.innerHTML = d.items.map(function (x) {
      var name = x[0], kind = x[1], credit = x[2], lic = x[3], url = /^https?:\/\//i.test(x[4] || '') ? x[4] : '', img = x[5], from = x[6];
      var meta = [kind === 'logo' ? 'Logo' : 'Photo', credit ? 'by ' + esc(credit) : '', lic ? esc(lic) : '', 'via ' + esc(from)].filter(Boolean).join(' · ');
      return '<li class="' + (kind === 'logo' ? 'logo' : 'photo') + '"><img src="' + esc(img) + '" alt="" loading="lazy" decoding="async" width="44" height="44"><div><div class="c-name">' + esc(name) + '</div><div class="c-meta">' + meta + (url ? ' · <a href="' + esc(url) + '" target="_blank" rel="noopener nofollow">source</a>' : '') + '</div></div></li>';
    }).join('');
  }
  function load() { var s = document.createElement('script'); s.src = 'data/image-credits.js' + (v ? '?v=' + v : ''); s.onload = render; s.onerror = function () { document.getElementById('credits-status').textContent = 'Could not load the credits.'; }; document.head.appendChild(s); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
