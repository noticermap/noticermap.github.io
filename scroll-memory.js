/* NoticerMap scroll memory — built 2026-11-28T03:52:13.229Z */
(function () {
'use strict';
/* scroll-memory: first open of a detail view is at the top; returning to the
   same view+id restores the last scroll position from sessionStorage. */
const SM_STORE_KEY = 'noticermap:scroll-mem';
try { if (history && 'scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) { }

const _sm = { map: null, active: new Map(), writeTick: 0, observers: new Map() };

function smStore() {
  if (_sm.map) return _sm.map;
  try {
    const raw = sessionStorage.getItem(SM_STORE_KEY);
    const o = raw ? JSON.parse(raw) : {};
    _sm.map = o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch (e) { _sm.map = {}; }
  return _sm.map;
}
function smPersist(immediate) {
  const write = () => {
    _sm.writeTick = 0;
    try { sessionStorage.setItem(SM_STORE_KEY, JSON.stringify(smStore())); } catch (e) { }
  };
  if (immediate) { if (_sm.writeTick && typeof cancelAnimationFrame === 'function') try { cancelAnimationFrame(_sm.writeTick); } catch (e) { } _sm.writeTick = 0; write(); return; }
  if (_sm.writeTick) return;
  _sm.writeTick = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(write) : setTimeout(write, 0);
}
function scrollMemKey(view, id) {
  const v = String(view == null ? '' : view).trim();
  if (!v) return '';
  const i = id == null || id === '' ? '' : String(id);
  return i ? v + ':' + i : v;
}
function scrollMemGet(key) {
  if (!key) return null;
  const y = smStore()[key];
  return typeof y === 'number' && isFinite(y) && y >= 0 ? y : null;
}
function scrollMemPosition(key) {
  const y = scrollMemGet(key);
  return y == null ? 0 : y;
}
function smIsWindow(el) { return el === window || el === document || el === document.documentElement || el === document.body; }
function smGetY(el) {
  if (!el) return 0;
  if (smIsWindow(el)) return window.scrollY || document.documentElement.scrollTop || 0;
  return el.scrollTop || 0;
}
function smSetY(el, y) {
  const n = Math.max(0, Math.round(Number(y) || 0));
  if (!el) return;
  if (smIsWindow(el)) window.scrollTo(0, n);
  else el.scrollTop = n;
}
function smMax(el) {
  if (!el) return 0;
  if (smIsWindow(el)) return Math.max(0, (document.documentElement.scrollHeight || 0) - (window.innerHeight || 0));
  return Math.max(0, (el.scrollHeight || 0) - (el.clientHeight || 0));
}
function smHidden(el) {
  if (!el || smIsWindow(el)) return false;
  return !!(el.hidden || (el.offsetParent === null && el !== document.body && el !== document.documentElement));
}
function smReadyToRecord(el, key, y) {
  const stored = scrollMemGet(key) || 0;
  const restore = (_sm.active.get(el) || {}).restoreY || 0;
  const target = Math.max(stored, restore);
  if (target > 0 && y + 1 < target && smMax(el) + 1 < target) return false;
  if (smHidden(el) && y === 0 && target > 0) return false;
  return true;
}
function scrollMemRemember(el) {
  const cur = el && _sm.active.get(el);
  if (!cur || !cur.key) return;
  const y = smGetY(el);
  if (!smReadyToRecord(el, cur.key, y)) return;
  smStore()[cur.key] = y;
  smPersist();
  if (Math.abs(y - (cur.restoreY || 0)) > 1 && smMax(el) >= (cur.restoreY || 0)) cur.restoreY = y;
}
function scrollMemLeave(el, key) {
  const k = key || (el && (_sm.active.get(el) || {}).key);
  if (el && k) {
    const y = smGetY(el);
    if (smReadyToRecord(el, k, y)) { smStore()[k] = y; smPersist(true); }
  }
  if (el) _sm.active.delete(el);
}
function smApply(el, key) {
  const cur = _sm.active.get(el);
  if (!cur || cur.key !== key) return;
  smSetY(el, cur.restoreY);
}
function scrollMemEnter(el, key) {
  if (!el || !key) return;
  const prev = _sm.active.get(el);
  if (prev && prev.key && prev.key !== key) scrollMemLeave(el, prev.key);
  const y = scrollMemPosition(key);
  _sm.active.set(el, { key, restoreY: y });
  smApply(el, key);
  const again = () => smApply(el, key);
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => { again(); requestAnimationFrame(again); });
  else setTimeout(again, 0);
}
function scrollMemBind(el) {
  if (!el || el._smBound) return el;
  el._smBound = true;
  const target = smIsWindow(el) ? window : el;
  target.addEventListener('scroll', () => scrollMemRemember(el), { passive: true });
  if (typeof ResizeObserver === 'function' && !smIsWindow(el)) {
    const ro = new ResizeObserver(() => {
      const cur = _sm.active.get(el);
      if (!cur || !(cur.restoreY > 0)) return;
      if (smGetY(el) + 1 < cur.restoreY) smSetY(el, cur.restoreY);
    });
    try { ro.observe(el); _sm.observers.set(el, ro); } catch (e) { }
  }
  return el;
}

function scrollMemPanelKey(sel) {
  const s = sel || (typeof S !== 'undefined' ? S : null) || {};
  if (s.link) return scrollMemKey('claim', s.link);
  if (s.node) return scrollMemKey('profile', s.node);
  if (s.net) return scrollMemKey('network', s.net);
  if (s.ov != null && s.ov !== '') return scrollMemKey('overlap', s.ov);
  if (s.lead) return scrollMemKey('lead', s.lead);
  return scrollMemKey('overview');
}
function scrollMemViewEl(view) {
  if (typeof document === 'undefined' || !view || view === 'map') return null;
  if (view === 'timeline') return document.querySelector('#view-timeline .tl-scroll') || document.getElementById('view-timeline');
  return document.getElementById('view-' + view);
}
function scrollMemViewKeyFor(view) {
  if (view === 'index' && typeof iPage === 'number') return scrollMemKey('view-index', iPage);
  if (view === 'money' && typeof S !== 'undefined' && S.mfocus && S.node) return scrollMemKey('view-money', S.node);
  return scrollMemKey('view-' + (view || 'map'));
}
function scrollMemAfterPanel() {
  const body = typeof $ === 'function' ? $('#panel-body') : document.getElementById('panel-body');
  if (!body) return;
  scrollMemBind(body);
  scrollMemEnter(body, scrollMemPanelKey());
}
function scrollMemBeforePanel() {
  const body = typeof $ === 'function' ? $('#panel-body') : document.getElementById('panel-body');
  if (body) scrollMemRemember(body);
}
function scrollMemLeaveView(view) {
  const el = scrollMemViewEl(view);
  if (el) { scrollMemBind(el); scrollMemLeave(el, scrollMemViewKeyFor(view)); }
}
function scrollMemEnterView(view) {
  const el = scrollMemViewEl(view);
  if (!el) return;
  scrollMemBind(el);
  scrollMemEnter(el, scrollMemViewKeyFor(view));
}
function scrollMemAfterViewRender(view) {
  const v = view || (typeof S !== 'undefined' ? S.view : null);
  if (!v || v === 'map') return;
  scrollMemEnterView(v);
}
function scrollMemWindowKey() {
  const path = (location.pathname || '/').replace(/\/+$/, '') || '/';
  const hash = location.hash || '';
  if (/\.html$/i.test(path) && /(?:^|\/)e\//.test(path)) return scrollMemKey('e', path + hash);
  return scrollMemKey('page', path + hash);
}
function scrollMemInitStatic() {
  const key = scrollMemWindowKey();
  const y = scrollMemPosition(key);
  const el = document.scrollingElement || document.documentElement;
  scrollMemBind(window);
  _sm.active.set(window, { key, restoreY: y });
  if (el && el !== window) _sm.active.set(el, { key, restoreY: y });
  const apply = () => {
    const cur = _sm.active.get(window);
    window.scrollTo(0, cur ? cur.restoreY : y);
  };
  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  window.addEventListener('load', apply);
  window.addEventListener('resize', apply);
  if (typeof ResizeObserver === 'function') {
    try { new ResizeObserver(apply).observe(document.documentElement); if (document.body) new ResizeObserver(apply).observe(document.body); } catch (e) { }
  }
  window.addEventListener('pagehide', () => {
    const curY = window.scrollY || 0;
    if (smReadyToRecord(window, key, curY)) { smStore()[key] = curY; smPersist(true); }
  });
}
function scrollMemFlush() {
  _sm.active.forEach((cur, el) => {
    if (!cur || !cur.key) return;
    const y = smIsWindow(el) ? (window.scrollY || 0) : smGetY(el);
    if (smReadyToRecord(el, cur.key, y)) smStore()[cur.key] = y;
  });
  smPersist(true);
}
function scrollMemInitApp() {
  window.addEventListener('pagehide', scrollMemFlush);
  window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') scrollMemFlush(); });
  const sidebar = typeof $ === 'function' ? $('#sidebar') : document.getElementById('sidebar');
  if (sidebar) { scrollMemBind(sidebar); scrollMemEnter(sidebar, scrollMemKey('sidebar')); }
}

if (typeof document !== 'undefined') {
  const bootStatic = () => !!(document.body && document.body.classList.contains('static-page') && (scrollMemInitStatic(), true));
  if (document.body) bootStatic();
  else document.addEventListener('DOMContentLoaded', bootStatic);
}

})();
