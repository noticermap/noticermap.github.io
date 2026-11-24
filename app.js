/* NoticerMap — built 2026-11-24T13:16:53.142Z */
(function () {
'use strict';
// ---- 00-core.js
/* core: data, vocabulary, helpers, state, URL hash, filtering, dates */
const D = window.__WIRETAP_DATA__;
if (!D) { document.getElementById('loading').textContent = 'Data failed to load (data/core.js).'; throw new Error('no data'); }
const V = D.meta.vocab;
const TYPE = V.TYPES, TYPE_ORDER = V.TYPE_ORDER, STATUS = V.STATUS, LINK_TYPES = V.LINK_TYPES, LINK_CATS = V.LINK_CATS, AMOUNT_KINDS = V.AMOUNT_KINDS, NON_FLOW = new Set(V.NON_FLOW_KINDS), NETKIND = V.NETWORK_KINDS || {};
const LAYERS = V.LAYERS || {};
// every known layer is shown in the toggle (Wiretap / FringeViews / Public records); PRESENT = layers with data
const LAYER_KEYS = [...new Set([...Object.keys(LAYERS), ...(D.meta.layers || [])])], LAYERS_PRESENT = D.meta.layers && D.meta.layers.length ? D.meta.layers : ['wiretap'];
// theories layer is controlled by the dedicated Theories toggle / per-node switch, not the source-layer chips
const MAP_LAYER_KEYS = LAYER_KEYS.filter(k => k !== 'theories');
const itemLayers = x => x.layers || [x.source_layer || 'wiretap'];
// source kinds = every reporting layer's key + public_record + other (generic: no fixed number of layers)
const NLAYERS = Math.max(1, LAYER_KEYS.length); const SRC_KINDS = [...Object.keys(LAYERS).filter(k => k !== 'records'), 'public_record', 'official_website', 'other'];
const srcKindLabel = k => k === 'public_record' ? 'Public record' : k === 'official_website' ? "Official website (organization's own claim)" : k === 'other' ? 'Other' : (LAYERS[k] && LAYERS[k].label) || 'Wiretap';
// what kind of item a source is (from its own URL) + the paywall chip (data field: source.paywalled = true; a 'headline/preview only' note also counts)
const srcMedium = s => { const u = String(s.url || ''); return /^https?:\/\/(www\.)?thebureau\.news\//i.test(u) ? 'Bureau article' : /^https?:\/\/(www\.|mobile\.)?(x|twitter)\.com\/scoopercooper\b/i.test(u) ? 'X post (@scoopercooper)' : /^https?:\/\/(www\.|mobile\.)?(x|twitter)\.com\//i.test(u) ? 'X post' : ''; };
const isPaywalled = s => s.paywalled === true || s.paywalled === 'true' || /\bpaywall(ed)?\b.*\b(headline|preview)\b|\bheadline (and|&) (free )?preview only\b/i.test(s.note || '');
const ownClaimChip = s => s && s.kind === 'official_website' ? ' <span class="own-claim-chip" data-own-claim title="Published by the organization itself. An own claim, not verification.">Organization\'s own claim</span>' : '';
const paywallChip = s => isPaywalled(s) ? ' <span class="paywall-chip" title="Only the headline and free preview were read; the full text is behind a paywall.">Paywalled (headline/preview only)</span>' : '';
const layerInfo = k => LAYERS[k] || { label: k, reported: 'Reported by ' + k, color: '#ccc', mark: '?' };
const layerChip = (ly, short) => { const L = layerInfo(ly); const g = glossFor('layer', ly); return `<span class="layer" style="--lc:${L.color}" data-layer-chip="${esc(ly)}" tabindex="0" title="${esc(g || 'Source layer: ' + (L.outlet || L.label))}"><span class="lm" aria-hidden="true">${esc(L.mark)}</span>${short ? '' : esc(L.label)}${short ? `<span class="sr-only">${esc(L.label)}</span>` : ''}</span>`; };
const statusLabel = (st, ly) => st === 'reported' ? layerInfo(ly || 'wiretap').reported : ly === 'records' && st === 'verified' ? 'Verified in public records' : (STATUS[st] || STATUS.reported).label;
const STATUS_KEYS = Object.keys(STATUS), CAT_KEYS = Object.keys(LINK_CATS);
const PROV = D.meta.provinces || {};
const BIG = D.entities.length > 1200;
// ---- glossary (Map Guide, optional): hover/tap definitions on badges and layer chips
let GLOSS = {};
const glossKey = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function glossFor(kind, k) {
  const keys = Object.keys(GLOSS); if (!keys.length) return '';
  const want = kind === 'status' ? [k, STATUS[k]?.label, STATUS[k]?.short] : kind === 'layer' ? [k + ' layer', (LAYERS[k]?.label || k) + ' layer', LAYERS[k]?.label, k, k === 'bloodmoney' ? 'BloodMoney layer' : ''] : [k];
  for (const w of want.filter(Boolean)) { const hit = keys.find(x => glossKey(x) === glossKey(w)); if (hit) return GLOSS[hit]; }
  return '';
}
// ---- Seen in N layers (item level; computed by the build)
const seenOf = x => x.seen || itemLayers(x);
const seenTier = n => Math.min(NLAYERS, n); // CSS/graph tiers go up to the number of layers
const seenBadge = (x, compact) => { const ls = seenOf(x); const n = ls.length; return `<span class="seen seen-${seenTier(n)}${n > 1 && n >= NLAYERS ? ' seen-max' : ''}" tabindex="0" title="Seen in ${n} source layer${n === 1 ? '' : 's'}: ${esc(ls.map(k => layerInfo(k).label).join(', '))}. Counts layers that report this item themselves; a public-record source on a reported item is evidence, not a layer.">${compact ? `${n}×` : `Seen in ${n} layer${n === 1 ? '' : 's'}`}</span>`; };
// ---- v1.10 norm benchmarks (money links and events): display only. Never counts as verified, never implies illegality, not in totals.
const NORM_TIP = () => (D.meta.vocab && D.meta.vocab.NORM_TOOLTIP) || 'Compared with a sourced benchmark; not a finding of wrongdoing.';
const hasNorm = x => !!(x && (x.norm_flag || x.norm_comparison || (x.norm_benchmark_ids || []).length || (x.ethics_assessments || []).length));
const normFlagBadge = x => x && x.norm_flag ? `<span class="norm-flag" data-norm-flag title="${esc(NORM_TIP())}">Outside the norm</span>` : '';
const hostOfUrl = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return ''; } };
function normBlock(x) {
  if (!hasNorm(x)) return '';
  const B = (D.meta.vocab && D.meta.vocab.NORM_BENCHMARKS) || {};
  const bench = (x.norm_benchmark_ids || []).map(id => { const b = B[id]; const u = b && safeUrl(b.source_url);
    return b ? (u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" data-norm-bench="${esc(id)}">${esc(b.name || id)}</a>` : `<span data-norm-bench="${esc(id)}">${esc(b.name || id)}</span>`) : `<span data-norm-bench="${esc(id)}" class="muted">${esc(id)} (benchmark details not in this build)</span>`; });
  const q = (x.ethics_assessments || []).map(a => { const u = safeUrl(a.source_url);
    const src = u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(hostOfUrl(u) || 'source')}</a>` : 'source not given';
    return `<blockquote class="ethics-q" data-ethics>“${esc(a.quote)}” <cite>— ${esc(a.by || 'unattributed')}${a.date ? ', ' + esc(a.date) : ''}, ${src}</cite></blockquote>`; });
  return `<section class="norms" data-norms><h3 class="lbl">Compared with a benchmark</h3>
    ${x.norm_flag ? `<p>${normFlagBadge(x)}</p>` : ''}
    ${bench.length ? `<p class="small">Benchmark: ${bench.join(' · ')}</p>` : ''}
    ${x.norm_comparison ? `<p class="small" data-norm-cmp>${esc(x.norm_comparison)}</p>` : ''}
    ${q.length ? `<div class="small"><span class="muted">Ethics assessments (quoted):</span>${q.join('')}</div>` : ''}
    <p class="small muted">${esc(NORM_TIP())} Not a verification status.</p></section>`;
}
// ---- legal status (persons): neutral chip, exactly as the source states. Never 'criminal'/'guilty'/'convicted' unless status is 'convicted'.
const LEGAL = V.LEGAL_STATUS || {};
const FORBID = /\b(criminal|guilty|convicted)\b/i;
const legalList = e => e.type !== 'person' ? [] : e.legal_statuses && e.legal_statuses.length ? e.legal_statuses : e.legal_status ? [{ status: e.legal_status, detail: e.legal_status_detail, source: e.legal_status_source, date: e.legal_status_date }] : [];
const hasLegal = e => legalList(e).length > 0;
function legalChips(e, compact) {
  const L = legalList(e); if (!L.length) return '';
  return `<div class="legal${compact ? ' compact' : ''}">${L.map(x => {
    const lab = (LEGAL[x.status] || {}).label || 'Status unknown';
    let det = x.detail || ''; if (det && x.status !== 'convicted' && FORBID.test(det)) det = 'see the source for the stated wording';
    const u = x.source && safeUrl(x.source.url);
    const src = x.source ? (u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(x.source.publisher || x.source.title || 'source')}</a>` : esc(x.source.title || x.source.publisher || 'source')) : '';
    const note = (LEGAL[x.status] || {}).note;
    return `<div class="legal-row"><span class="legal-chip" title="Legal status as the source states it. Not a finding by this map.">${esc(lab)}</span>${compact ? '' : `${det ? ` <span class="legal-det">${esc(det)}</span>` : ''}${src ? ` <span class="muted">· ${src}</span>` : ''}${x.date ? ` <span class="muted">· ${esc(x.date)}</span>` : ''}`}${note ? `<div class="legal-note">${esc(note)}</div>` : ''}</div>`;
  }).join('')}</div>`;
}

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => (/^https?:\/\//i.test(u || '') ? u : null);
const fmtCAD = n => n == null ? '' : n >= 1e9 ? `$${(n / 1e9).toFixed(n >= 1e10 ? 1 : 2).replace(/\.?0+$/, '')}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M` : n >= 1e4 ? `$${Math.round(n / 1e3)}k` : `$${Math.round(n).toLocaleString('en-CA')}`;
const fmtCADfull = n => n == null ? '—' : n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
const LT = t => LINK_TYPES[t] || { label: String(t || 'related to').replace(/_/g, ' '), inverse: String(t || 'related to').replace(/_/g, ' ') + ' (reverse)', cat: 'affiliation', arrow: 'triangle' };
const catOf = l => LT(l.type).cat;
const provName = p => p ? (PROV[p] || p) : '';
const isEst = l => l.amount_cad > 0 && NON_FLOW.has(l.amount_kind);
// network-wide totals skip pass-throughs that sit inside an upstream award (parent_link_id): those dollars are already counted there
const isFlowTotal = l => isFlow(l) && !l.upstream_counted;
const isFlow = l => l.amount_cad > 0 && !NON_FLOW.has(l.amount_kind) && (LT(l.type).cat === 'money' || ['payment', 'donation', 'contract', 'grant'].includes(l.amount_kind)); // stake valuations etc. are not flows
const badge = (st, ly) => { const s = STATUS[st] || STATUS.reported; const lab = ly ? statusLabel(st, ly) : s.label; const desc = glossFor('status', st) || st === 'reported' && ly === 'records' ? 'Listed in a public registry (Records Checker addition); not a news report.' : st === 'reported' && ly ? `Appears in ${layerInfo(ly).outlet || layerInfo(ly).label} reporting. Not independently verified.` : s.desc; return `<span class="badge ${s.cls}" tabindex="0" data-gloss title="${esc(desc)}"><span class="ic" aria-hidden="true">${s.icon}</span>${esc(lab)}</span>`; };
const lbadge = x => badge(x.status, itemLayers(x).length === 1 ? itemLayers(x)[0] : itemLayers(x).find(k => k !== 'records') || x.source_layer);
const estTag = l => isEst(l) ? `<span class="est" title="${esc(AMOUNT_KINDS[l.amount_kind].label)}: not a recorded payment; excluded from money totals by default">${esc(l.amount_kind === 'budget' ? 'Budget' : l.amount_kind === 'other' ? 'Other amount' : 'Estimate')}</span>` : l.amount_cad > 0 && !isFlow(l) ? `<span class="kind" title="Not money that moved; not counted in money totals">${esc(AMOUNT_KINDS[l.amount_kind]?.label || l.amount_kind || 'value')} · not counted</span>` : (l.amount_kind && l.amount_kind !== 'payment' && l.amount_cad ? `<span class="kind">${esc(AMOUNT_KINDS[l.amount_kind]?.label || l.amount_kind)}</span>` : '');
const typeChip = t => { const T = TYPE[t] || { label: t, color: '#888' }; return `<span class="tchip"><span class="dot" style="background:${T.color}" aria-hidden="true"></span>${esc(T.label)}</span>`; };
const toast = msg => { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2000); };
const announce = msg => { const a = $('#sr-live'); a.textContent = ''; setTimeout(() => (a.textContent = msg), 30); };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ---- dates: everything becomes [startDay, endDay] (days since 1970-01-01, UTC) by precision
const DAY = 864e5;
function dateInterval(d) {
  if (!d) return null;
  const m = String(d).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/); if (!m) return null;
  const y = +m[1], mo = m[2] ? +m[2] - 1 : null, da = m[3] ? +m[3] : null;
  if (mo == null) return [Date.UTC(y, 0, 1) / DAY, Date.UTC(y, 11, 31) / DAY, 'year'];
  if (da == null) return [Date.UTC(y, mo, 1) / DAY, Date.UTC(y, mo + 1, 0) / DAY, 'month'];
  const x = Date.UTC(y, mo, da) / DAY; return [x, x, 'day'];
}
const dayToISO = n => new Date(n * DAY).toISOString().slice(0, 10);
const isoToDay = s => { const i = dateInterval(s); return i ? i[0] : null; };
const DOM0 = (dateInterval(D.meta.date_min) || [isoToDay('2000-01-01')])[0];
const DOM1 = Math.max(DOM0 + 1, (dateInterval(D.meta.date_max) || [0, isoToDay(new Date().toISOString().slice(0, 10))])[1]);
const linkDate = (l, basis) => basis === 'reported' ? (l.reported || null) : (l.date || null);

// ---- indexes
const ENT = new Map(D.entities.map(e => [e.id, e]));
const LNK = new Map(D.links.map(l => [l.id, l]));
let SRC = new Map(); D.sources = D.sources || [];
const NETS = D.networks || [], CLUSTERS = D.clusters || [];
const NET = new Map([...NETS, ...CLUSTERS].map(n => [n.id, n]));
const netLabel = n => n.auto ? 'Auto-detected cluster' : (NETKIND[n.kind]?.label || 'Network');
const byNode = new Map(D.entities.map(e => [e.id, []]));
for (const l of D.links) { l._iv = { event: dateInterval(l.date), reported: dateInterval(l.reported) }; byNode.get(l.from).push(l); if (l.to !== l.from) byNode.get(l.to).push(l); }
// v1.8: an event that didn't happen may only have an expected date: it is placed (and date-filtered) there
const EV_KINDS = V.EVENT_KINDS || {}; const evKindLabel = k => (EV_KINDS[k] || {}).label || String(k || '').replace(/_/g, ' ');
let MONEY_BY_EVENT = null; const moneyTiedTo = id => { if (!MONEY_BY_EVENT) { MONEY_BY_EVENT = new Map(); for (const l of D.links) if (l.event_id) (MONEY_BY_EVENT.get(l.event_id) || MONEY_BY_EVENT.set(l.event_id, []).get(l.event_id)).push(l); } return MONEY_BY_EVENT.get(id) || []; };
const EV_STATUS = V.EVENT_STATUS || {}; const isStoppedEv = e => e && e.type === 'event' && !!e.event_status && e.event_status !== 'occurred' && !(EV_STATUS[e.event_status] || {}).upcoming; const isUpcomingEv = e => e && e.type === 'event' && !!(EV_STATUS[e.event_status] || {}).upcoming;
const ivOf = x => !x ? null : x.date ? dateInterval(x.date) : x.date_range ? [(dateInterval(x.date_range.start) || [-1e9])[0], (dateInterval(x.date_range.end) || [0, 1e9])[1]] : null;
for (const e of D.entities) if (e.type === 'event') e._xiv = ivOf(e.expected);
for (const e of D.entities) e._iv = e.date ? dateInterval(e.date) : e.date_range ? [(dateInterval(e.date_range.start) || [-1e9])[0], (dateInterval(e.date_range.end) || [0, 1e9])[1]] : e._xiv || null;
const name = id => (ENT.get(id) || {}).name || id;
// ---- overlaps (derived by the build; NOT claims, no status, never in money totals)
const OV_TYPES = V.OVERLAP_TYPES || {}, OV_TYPE_KEYS = Object.keys(OV_TYPES), OV_NOTE = V.OVERLAP_DISCLAIMER || 'Overlap found by the map, not a reported claim';
let OVS = [], OV_BY = new Map(), CORR = new Map();
let LEADS = [], LEAD = new Map(), GUIDE = { tours: [], walkthrough: null, next_steps: {}, glossary: {}, present: false }, EXPLAIN = null;
const LEAD_PAT = V.LEAD_PATTERNS || {}, LEAD_NOTE = 'Timing pattern'; // short UI caveat; full wording stays in data (V.LEAD_DISCLAIMER)
const MAXDEG = Math.max(1, ...D.entities.map(e => e.degree));

// ---- state (mirrors the URL hash)
const allProvs = [...new Set(D.entities.map(e => e.province || '—'))].sort((a, b) => (a === 'FED' ? -1 : b === 'FED' ? 1 : a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b)));
const usedTypes = TYPE_ORDER.filter(t => t === 'event' || D.entities.some(e => e.type === t)); // Events always listed
const usedCats = CAT_KEYS.filter(c => D.links.some(l => catOf(l) === c));
const defaults = () => ({ normf: false, thy: false, thyOn: new Set(), view: 'map', node: null, link: null, net: null, ov: null, layers: new Set(LAYER_KEYS.filter(k => k !== 'theories')), q: '', types: new Set(usedTypes), provs: new Set(allProvs), statuses: new Set(STATUS_KEYS), cats: new Set(usedCats), from: null, to: null, basis: 'event', undated: true, money: false, est: false, minl: 1, legalf: false, ltypes: new Set(['lobbied', 'lobbied_on']), subj: new Set(), hl: false, lead: null, lpat: new Set(Object.keys(LEAD_PAT)), llayer: 'all', lprov: 'all', lfrom: '', lto: '', lmin: 0, tour: null, step: 0, layout: 'network', min: 0, mfocus: false, top: BIG ? 150 : 0, maxdeg: 0, expand: [], ecolor: 'status', sq: '', skind: 'all', ssort: 'date', slayer: 'all', tlgroup: 'cat', ovtypes: new Set(OV_TYPE_KEYS), ovl: false, pa: null, pb: null, ovsort: 'strength' });
let S = defaults();
const VIEWS = ['map', 'money', 'timeline', 'networks', 'leads', 'overlaps', 'tours', 'index', 'sources', 'about'];
function toHash() {
  const p = new URLSearchParams(), d = defaults();
  if (S.view !== 'map') p.set('view', S.view);
  if (S.node) p.set('node', S.node);
  if (S.link) p.set('link', S.link);
  if (S.net) p.set('net', S.net);
  if (S.ov != null) p.set('ov', S.ov);
  if (S.lead) p.set('lead', S.lead);
  if (S.tour) { p.set('tour', S.tour); p.set('step', S.step); }
  if (S.subj.size) p.set('subj', [...S.subj].join('|')); if (S.ltypes.size !== 2) p.set('lt', [...S.ltypes].join(',') || 'none');
  if (S.minl > 1) p.set('minl', S.minl); if (S.legalf) p.set('legal', '1'); if (S.normf) p.set('norm', '1'); if (S.thy) p.set('thy', '1'); if (S.thyOn.size) p.set('thyon', [...S.thyOn].join(',')); if (S.evstop) p.set('evstop', '1'); if (S.evkind) p.set('evkind', S.evkind); if (S.hl) p.set('hl', '1');
  if (S.lpat.size !== d.lpat.size) p.set('lpat', [...S.lpat].join(',')); if (S.llayer !== 'all') p.set('llayer', S.llayer); if (S.lprov !== 'all') p.set('lprov', S.lprov); if (S.lfrom) p.set('lfrom', S.lfrom); if (S.lto) p.set('lto', S.lto); if (S.lmin) p.set('lmin', S.lmin);
  if (S.layers.size !== MAP_LAYER_KEYS.length || [...S.layers].some(k => !MAP_LAYER_KEYS.includes(k))) p.set('layers', [...S.layers].join(','));
  if (S.q) p.set('q', S.q);
  const setIf = (k, set, all) => { if (set.size !== all.size) p.set(k, [...set].join(',')); };
  setIf('types', S.types, d.types); setIf('prov', S.provs, d.provs); setIf('status', S.statuses, d.statuses); setIf('cats', S.cats, d.cats);
  if (S.from) p.set('from', S.from); if (S.to) p.set('to', S.to);
  if (S.basis !== 'event') p.set('basis', S.basis);
  if (!S.undated) p.set('undated', '0');
  if (S.money) p.set('money', '1'); if (S.est) p.set('est', '1');
  if (S.layout !== 'network') p.set('layout', S.layout);
  if (S.min) p.set('min', S.min); if (S.mfocus) p.set('focus', '1'); if (S.top !== d.top) p.set('top', S.top);
  if (S.maxdeg) p.set('maxdeg', S.maxdeg);
  if (S.expand.length) p.set('expand', S.expand.join(','));
  if (S.ecolor !== 'status') p.set('ecolor', S.ecolor);
  if (S.sq) p.set('sq', S.sq); if (S.skind !== 'all') p.set('skind', S.skind); if (S.ssort !== 'date') p.set('ssort', S.ssort); if (S.slayer !== 'all') p.set('slayer', S.slayer);
  if (S.tlgroup !== 'cat') p.set('tl', S.tlgroup);
  setIf('ovt', S.ovtypes, d.ovtypes); if (S.ovl) p.set('ovl', '1'); if (S.pa) p.set('pa', S.pa); if (S.pb) p.set('pb', S.pb); if (S.mvia) p.set('mv', '1'); if (S.ovsort !== 'strength') p.set('ovsort', S.ovsort);
  return p.toString().replace(/%2C/g, ',');
}
function fromHash() {
  const p = new URLSearchParams(location.hash.slice(1)), d = defaults();
  const list = (k, all) => p.has(k) ? new Set(p.get(k).split(',').filter(x => all.has(x))) : null;
  const okDate = s => (s && dateInterval(s) ? s : null);
  S = Object.assign(d, {
    view: VIEWS.includes(p.get('view')) ? p.get('view') : 'map',
    node: ENT.has(p.get('node')) ? p.get('node') : null, link: LNK.has(p.get('link')) ? p.get('link') : null, net: NET.has(p.get('net')) ? p.get('net') : null, ov: p.has('ov') && /^\d+$/.test(p.get('ov')) ? +p.get('ov') : null, lead: p.get('lead') || null, tour: p.get('tour') || null, step: Math.max(0, +p.get('step') || 0),
    minl: Math.max(1, Math.min(NLAYERS, +p.get('minl') || 1)), legalf: p.get('legal') === '1', normf: p.get('norm') === '1', thy: p.get('thy') === '1', thyOn: new Set((p.get('thyon') || '').split(',').filter(id => ENT.has(id))), evstop: p.get('evstop') === '1', evkind: EV_KINDS[p.get('evkind')] ? p.get('evkind') : '', hl: p.get('hl') === '1', lpat: list('lpat', d.lpat) || d.lpat, llayer: p.get('llayer') || 'all', lprov: p.get('lprov') || 'all', lfrom: okDate(p.get('lfrom')) || '', lto: okDate(p.get('lto')) || '', lmin: +p.get('lmin') || 0, layers: list('layers', d.layers) || (LAYER_KEYS.includes(p.get('layer')) ? new Set([p.get('layer')]) : d.layers),
    q: p.get('q') || '',
    types: list('types', d.types) || d.types, provs: list('prov', d.provs) || d.provs, statuses: list('status', d.statuses) || d.statuses, cats: list('cats', d.cats) || d.cats,
    from: okDate(p.get('from')), to: okDate(p.get('to')), basis: p.get('basis') === 'reported' ? 'reported' : 'event',
    undated: p.get('undated') !== '0', money: p.get('money') === '1', est: p.get('est') === '1',
    layout: ['network', 'rings', 'provinces', 'clusters'].includes(p.get('layout')) ? p.get('layout') : 'network',
    min: +p.get('min') || 0, mfocus: p.get('focus') === '1', top: p.has('top') ? +p.get('top') || 0 : d.top,
    maxdeg: +p.get('maxdeg') || 0, expand: (p.get('expand') || '').split(',').filter(id => ENT.has(id)),
    ecolor: ['type', 'layer'].includes(p.get('ecolor')) ? p.get('ecolor') : 'status',
    sq: p.get('sq') || '', skind: SRC_KINDS.includes(p.get('skind')) ? p.get('skind') : 'all', ssort: p.get('ssort') === 'cited' ? 'cited' : 'date', slayer: LAYER_KEYS.includes(p.get('slayer')) ? p.get('slayer') : 'all',
    tlgroup: p.get('tl') === 'status' ? 'status' : 'cat',
    ovtypes: list('ovt', d.ovtypes) || d.ovtypes, ovl: p.get('ovl') === '1', pa: ENT.has(p.get('pa')) ? p.get('pa') : null, pb: ENT.has(p.get('pb')) ? p.get('pb') : null, mvia: p.get('mv') === '1', ovsort: ['partners', 'layers'].includes(p.get('ovsort')) ? p.get('ovsort') : 'strength',
  });
  for (const k of ['types', 'provs', 'statuses', 'cats', 'layers', 'ovtypes', 'lpat']) if (!S[k].size) S[k] = d[k];
  if (p.has('subj')) S.subj = new Set(p.get('subj').split('|').filter(Boolean));
  if (p.has('lt')) S.ltypes = new Set(p.get('lt').split(',').filter(x => x === 'lobbied' || x === 'lobbied_on'));
}
let lastHash = null;
function commit(push) {
  const h = toHash(); if (h === lastHash) return; lastHash = h;
  const url = location.pathname + location.search + (h ? '#' + h : '');
  try { if (push) history.pushState(null, '', url); else history.replaceState(null, '', url); } catch { location.hash = h; }
}

// ---- filtering
function overlaps(iv, a, b) { return iv[1] >= a && iv[0] <= b; }
function dateBounds() { return [S.from ? isoToDay(S.from) : -Infinity, S.to ? (dateInterval(S.to) || [0, Infinity])[1] : Infinity]; }
const layerAll = () => MAP_LAYER_KEYS.every(k => S.layers.has(k));
const inLayer = x => layerAll() || itemLayers(x).some(k => S.layers.has(k));
function linkPass(l, a, b) {
  if (typeof isTheoryLnk === 'function' && isTheoryLnk(l)) {
    const thyShow = typeof theoriesVisible === 'function' ? theoriesVisible() : new Set();
    if (typeof theoryLinkVisible === 'function') { if (!theoryLinkVisible(l, thyShow)) return false; }
    else if (!S.thy) return false;
    return true;
  }
  if (!inLayer(l)) return false;
  if (S.minl > 1 && seenOf(l).length < S.minl) return false;
  if (!S.statuses.has(l.status)) return false;
  if (!S.cats.has(catOf(l))) return false;
  if (!lobbyPass(l)) return false;
  const iv = l._iv[S.basis];
  if (!iv) { if (!S.undated) return false; } else if (!overlaps(iv, a, b)) return false;
  if (S.money && !(l.amount_cad > 0 && (S.est || !isEst(l)))) return false;
  return true;
}
const dateFilterActive = () => !!(S.from || S.to);
function filtered() {
  const [a, b] = dateBounds();
  const ents = new Set();
  const thyShow = typeof theoriesVisible === 'function' ? theoriesVisible() : new Set();
  for (const e of D.entities) {
    const thy = typeof isTheoryEnt === 'function' ? isTheoryEnt(e) : (e.theory || e.type === 'theory');
    if (thy) { if (thyShow.has(e.id) || S.thyOn.has(e.id)) ents.add(e.id); continue; }
    if (!S.types.has(e.type) || !S.provs.has(e.province || '—')) continue;
    if (S.maxdeg && e.degree > S.maxdeg && e.id !== S.node && !S.expand.includes(e.id)) continue;
    if (e._iv && dateFilterActive() && !overlaps(e._iv, a, b)) continue;
    if (S.minl > 1 && seenOf(e).length < S.minl) continue;
    if (S.legalf && !hasLegal(e)) continue;
    // theories layer chip is not part of the verified default set
    if ((e.layers || []).includes('theories') && !(e.layers || []).some(k => k !== 'theories') && !S.thy && !thyShow.has(e.id)) continue;
    ents.add(e.id);
  }
  if (S.evstop) { // 'Blocked / didn't happen': those events plus whatever links to them
    const keep = new Set(D.entities.filter(e => isStoppedEv(e) && ents.has(e.id)).map(e => e.id)); for (const id of [...keep]) for (const l of byNode.get(id) || []) { keep.add(l.from); keep.add(l.to); }
    for (const id of [...ents]) if (!keep.has(id)) ents.delete(id);
  }
  if (S.evkind) { // 'Event kind': events of that kind plus whatever links to them (or ties money to them). Never a grouping of attendees.
    const keep = new Set(D.entities.filter(e => e.type === 'event' && e.event_kind === S.evkind && ents.has(e.id)).map(e => e.id));
    for (const id of [...keep]) { for (const l of byNode.get(id) || []) { keep.add(l.from); keep.add(l.to); } for (const l of moneyTiedTo(id)) { keep.add(l.from); keep.add(l.to); } }
    for (const id of [...ents]) if (!keep.has(id)) ents.delete(id);
  }
  if (S.normf) { // 'Outside the norm': flagged events and money links, plus what links to the flagged events. A comparison, not a finding.
    const keep = new Set(D.entities.filter(e => e.norm_flag && ents.has(e.id)).map(e => e.id)); for (const id of [...keep]) for (const l of byNode.get(id) || []) { keep.add(l.from); keep.add(l.to); }
    for (const l of D.links) if (l.norm_flag) { keep.add(l.from); keep.add(l.to); }
    for (const id of [...ents]) if (!keep.has(id)) ents.delete(id);
  }
  let links = D.links.filter(l => ents.has(l.from) && ents.has(l.to) && linkPass(l, a, b));
  if (!layerAll()) { const touched = new Set(); links.forEach(l => { touched.add(l.from); touched.add(l.to); }); for (const id of [...ents]) if (!touched.has(id) && !inLayer(ENT.get(id))) ents.delete(id); }
  const linkFilterActive = S.subj.size > 0 || S.ltypes.size !== 2 || S.statuses.size !== STATUS_KEYS.length || S.cats.size !== usedCats.length || S.money || dateFilterActive() || !S.undated;
  if (linkFilterActive) { const touched = new Set(); links.forEach(l => { touched.add(l.from); touched.add(l.to); }); for (const id of [...ents]) if (!touched.has(id) && !(dateFilterActive() && ENT.get(id).type === 'event' && ENT.get(id)._iv)) ents.delete(id); } // a dated event inside the date range stays
  // neighbourhood focus mode: only expanded nodes + their direct neighbours
  let focusSet = null;
  if (S.expand.length) {
    focusSet = new Set(S.expand.filter(id => ents.has(id)));
    for (const l of links) { if (S.expand.includes(l.from)) focusSet.add(l.to); if (S.expand.includes(l.to)) focusSet.add(l.from); }
    for (const id of [...ents]) if (!focusSet.has(id)) ents.delete(id);
    links = links.filter(l => ents.has(l.from) && ents.has(l.to) && (S.expand.includes(l.from) || S.expand.includes(l.to)));
  }
  return { ents, links, linkSet: new Set(links.map(l => l.id)), nets: NETS.filter(inLayer) };
}
let F = null;

// ---- 02-chunks.js
/* progressive loading: the core (data/core.js) has every entity and link with the fields the map, filters, views and
   path finder need. Heavy fields (sources, summaries, lobbying detail, descriptions, guide intros and next steps, link
   explanations, per-entity overlaps) live in detail buckets data/d/<n>.js grouped by map region and are fetched when an
   item is opened. Search uses a prefix-sharded index (data/s/<n>.js). Script tags keep it working over file:// too. */
const CH = D.meta.chunks || null;
// LITE: phones, tablets and low-memory devices use a tight draw budget and defer overlaps/sources (?lite=1 / ?lite=0 force it)
const LITE = BIG && !/[?&]lite=0/.test(location.search) && (/[?&]lite=1/.test(location.search) || (() => { try { return matchMedia('(max-width: 900px)').matches || matchMedia('(pointer: coarse)').matches || (navigator.deviceMemory != null && navigator.deviceMemory <= 4); } catch (_) { return false; } })());
// Layered drawing for every large graph (phones and desktop). ?lite=0 keeps the old full-graph path for debugging.
const LOD_ON = BIG && !/[?&]lite=0/.test(location.search);
const CHUNK_V = (() => { const s = document.querySelector('script[src*="data/core.js"]'); const m = s && s.getAttribute('src').match(/\?v=([^&]+)/); return m ? m[1] : ''; })();
const chunkV = () => (CHUNK_V ? '?v=' + CHUNK_V : '');
let OV_FULL = false; // data/overlaps.js loaded
const DET = { have: new Map(), pending: new Map(), res: new Map(), failed: new Set(), lru: [], pin: {} };
const DET_BUDGET = LITE ? 60 : 1e9; // detail buckets kept in memory on LITE devices (least recently used are dropped)
const ENT_DF = (CH && CH.entity_fields) || [], LNK_DF = (CH && CH.link_fields) || [];
let OV_PART = new Map(); // overlaps known from opened profiles before data/overlaps.js is loaded
const ovAt = i => OVS[i] || OV_PART.get(+i);
const isHyd = x => !x || x._b == null || x._h === true;
function ovIngest(id, rows) {
  if (OV_FULL) return;
  const list = rows.map(([i, type, a, b, via, links, total, strength, kinds, sources, hops]) => OV_PART.get(i) || OV_PART.set(i, { i, type, a, b, via, links, total, strength, kinds, sources, hops }).get(i));
  OV_BY.set(id, list);
}
function ingestDetail(b, p) {
  if (DET.have.has(b)) return;
  for (const id in p.e) { const e = ENT.get(id); if (!e) continue; const d = p.e[id];
    for (const k in d) { if (k === '_intro') (GUIDE.entity_intros = GUIDE.entity_intros || {})[id] = d[k]; else if (k === '_next') (GUIDE.next_steps = GUIDE.next_steps || {})[id] = d[k]; else if (k === '_ov') ovIngest(id, d[k]); else e[k] = d[k]; }
    e._h = true; }
  for (const id in p.l) { const l = LNK.get(id); if (!l) continue; const d = p.l[id];
    for (const k in d) { if (k === '_x') (EXPLAIN = EXPLAIN || {})[id] = d[k]; else l[k] = d[k]; }
    l._h = true; }
  DET.have.set(b, { e: Object.keys(p.e), l: Object.keys(p.l) }); touchBucket(b); evictBuckets();
}
function touchBucket(b) { const i = DET.lru.indexOf(b); if (i >= 0) DET.lru.splice(i, 1); DET.lru.push(b); }
function evictBuckets() {
  if (DET.hold || DET.have.size <= DET_BUDGET) return;
  const pinned = new Set(Object.values(DET.pin).flatMap(s => [...s]));
  for (let i = 0; i < DET.lru.length && DET.have.size > DET_BUDGET; ) {
    const b = DET.lru[i]; if (pinned.has(b)) { i++; continue; }
    DET.lru.splice(i, 1); const ids = DET.have.get(b); DET.have.delete(b);
    for (const id of ids.e) { const e = ENT.get(id); if (!e) continue; for (const k of ENT_DF) delete e[k]; e._h = false; if (GUIDE.entity_intros) delete GUIDE.entity_intros[id]; if (GUIDE.next_steps) delete GUIDE.next_steps[id]; if (!OV_FULL) OV_BY.delete(id); }
    for (const id of ids.l) { const l = LNK.get(id); if (!l) continue; const lb = l.lobbying; for (const k of LNK_DF) delete l[k]; if (lb) l.lobbying = lb.subjects ? { subjects: lb.subjects } : {}; l._h = false; if (EXPLAIN) delete EXPLAIN[id]; }
  }
}
window.__wiretapDetail = (b, p) => { try { ingestDetail(b, p); } catch (err) { console.error('detail ' + b, err); } };
function loadBucket(b) {
  if (DET.have.has(b)) { touchBucket(b); return Promise.resolve(); }
  if (DET.pending.has(b)) return DET.pending.get(b);
  const pr = new Promise(res => {
    const sc = document.createElement('script'); sc.src = `data/d/${b}.js${chunkV()}`; sc.async = true;
    sc.onload = () => { sc.remove(); res(); };
    sc.onerror = () => { sc.remove(); DET.failed.add(b); res(); };
    document.head.appendChild(sc);
  });
  DET.pending.set(b, pr); pr.then(() => DET.pending.delete(b)); return pr;
}
// ready(items, slot, rerender): true when every item is hydrated; otherwise fetches the missing buckets and calls rerender once.
// slot pins the buckets of what is on screen (e.g. the open profile) so they are not dropped.
const WAIT = {};
function ready(xs, slot, rerender) {
  xs = xs.filter(Boolean); if (slot) DET.pin[slot] = new Set(xs.map(x => x._b).filter(b => b != null));
  const miss = new Set(); for (const x of xs) if (!isHyd(x) && !DET.failed.has(x._b)) miss.add(x._b);
  if (!miss.size) return xs.every(isHyd) ? true : 'error';
  const tok = WAIT[slot || '_'] = {};
  Promise.all([...miss].map(loadBucket)).then(() => { if (WAIT[slot || '_'] === tok) { delete WAIT[slot || '_']; rerender(); } });
  return false;
}
const detailErr = () => `<p class="empty-inline" role="status">The details for this item could not be loaded. Check the connection and <button type="button" class="linkish" data-detail-retry>try again</button>.</p>`;
document.addEventListener('click', e => { if (e.target.closest('[data-detail-retry]')) { DET.failed.clear(); update(false); } });
// export / tools: hydrate a list of items (any size), a few buckets at a time
async function hydrateAll(xs) { DET.hold = true; clearTimeout(DET.holdT); const bs = [...new Set(xs.filter(x => !isHyd(x)).map(x => x._b))]; for (let i = 0; i < bs.length; i += 8) await Promise.all(bs.slice(i, i + 8).map(loadBucket)); DET.holdT = setTimeout(() => { DET.hold = false; evictBuckets(); }, 3000); }

// ---- search: inverted index sharded by term prefix (same tokenizer and BM25+ scoring as the MiniSearch index it replaces)
const SI = D.meta.search_index || null;
const SH = { data: new Map(), pending: new Map(), src: new Map() };
const SPACE_OR_PUNCT = /[\n\r\p{Z}\p{P}]+/u;
const tokenize = s => String(s || '').split(SPACE_OR_PUNCT).map(t => t.toLowerCase()).filter(Boolean);
window.__wiretapShard = (k, d) => {
  if (typeof k === 'string' && k.startsWith('src-')) { const off = +k.slice(4) * SI.src_piece; d.forEach((r, j) => SH.src.set(off + j, { sid: r[0], title: r[1], url: r[2], key: r[3], kind: r[4], date: r[5], nc: r[6], layers: r[7] })); return; }
  SH.data.set(k, d);
};
function shardsFor(t) {
  const out = []; if (!SI) return out; const pre = [...t].length >= 2;
  SI.shards.forEach(([key, exact], i) => { if (exact ? (key === t || (pre && key.startsWith(t))) : (t.startsWith(key) || (pre && key.startsWith(t)))) out.push(i); });
  return out;
}
const loadScriptOnce = (map, k, src) => map.get(k) || map.set(k, new Promise(res => { const sc = document.createElement('script'); sc.src = src + chunkV(); sc.async = true; sc.onload = sc.onerror = () => { sc.remove(); res(); }; document.head.appendChild(sc); })).get(k);
function searchMissing(q) { const need = new Set(); for (const t of new Set(tokenize(q))) for (const i of shardsFor(t)) if (!SH.data.has(i)) need.add(i); return need; }
function searchLoad(q) { return Promise.all([...searchMissing(q)].map(i => loadScriptOnce(SH.pending, i, `data/s/${i}.js`))); }
function srcStubLoad(sis) { return Promise.all([...new Set(sis.map(si => Math.floor(si / SI.src_piece)))].map(k => loadScriptOnce(SH.pending, 'src-' + k, `data/s/src-${k}.js`))); }
function editWithin(a, b, max) { // bounded Levenshtein
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) { const cur = [i]; let rowMin = i; for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < rowMin) rowMin = cur[j]; } if (rowMin > max) return max + 1; prev = cur; }
  return prev[b.length];
}
function matchTerm(t) {
  const res = new Map(), N = SI.n, pre = [...t].length >= 2, maxD = Math.round(t.length * 0.2);
  for (const i of shardsFor(t)) { const sh = SH.data.get(i); if (!sh) continue;
    for (const term in sh) {
      let w = 0;
      if (term === t) w = 1;
      else if (pre && term.startsWith(t)) w = 0.375 * t.length / (t.length + 0.3 * (term.length - t.length));
      else if (maxD > 0) { const d = editWithin(t, term, maxD); if (d <= maxD) w = 0.45 * t.length / (t.length + d); }
      if (!w) continue;
      const p = sh[term], df = p.length / 2, idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      for (let j = 0; j < p.length; j += 2) { const di = p[j]; const r = res.get(di) || res.set(di, { s: 0, terms: [] }).get(di); r.s += idf * p[j + 1] / 100 * w; if (!r.terms.includes(term)) r.terms.push(term); }
    } }
  return res;
}
function docRef(di) {
  for (const [kind, start, n] of SI.runs) { if (di < start || di >= start + n) continue; const j = di - start;
    return kind === 'e' ? { kind, ref: D.entities[j].id } : kind === 'l' ? { kind, ref: D.links[j].id } : kind === 's' ? { kind, ref: 's' + j, si: j } : { kind, ref: SI.refs[kind][j] }; }
  return { kind: 'x', ref: '' };
}
const KIND_BOOST = { e: 2.5, n: 2, s: 0.6, l: 1 };
function shardSearch(q, limit) {
  const terms = [...new Set(tokenize(q))]; if (!terms.length) return [];
  const per = terms.map(matchTerm); const all = new Map();
  per.forEach(m => { for (const [di, r] of m) { const a = all.get(di) || all.set(di, { s: 0, terms: [], n: 0 }).get(di); a.s += r.s; a.n++; for (const x of r.terms) if (!a.terms.includes(x)) a.terms.push(x); } });
  const rows = [...all].map(([di, a]) => { const d = docRef(di); return { id: d.kind + ':' + d.ref, kind: d.kind, ref: d.ref, si: d.si, terms: a.terms, score: a.s * (KIND_BOOST[d.kind] || 1), all: a.n === terms.length }; });
  const by = (a, b) => b.score - a.score;
  return rows.filter(r => r.all).sort(by).concat(rows.filter(r => !r.all).sort(by)).slice(0, limit);
}
// small builds carry every bucket and shard inside core.js: hydrate now (synchronous, as before chunking)
if (D.inline) { (D.inline.details || []).forEach((p, i) => ingestDetail(i, p)); (D.inline.shards || []).forEach((x, i) => SH.data.set(i, x)); (D.inline.src || []).forEach((rows, k) => window.__wiretapShard('src-' + k, rows)); delete D.inline; }

// ---- 05-extras.js
/* lazy data: overlaps, leads, search index, sources, guide, explanations. Each data/<name>.js registers itself
   (window.__WIRETAP_EXTRA__[name]) and calls window.__wiretapExtra(name). Script tags work over file:// too. */
const EXTRA = { loaded: {}, pending: {}, waiters: {} };
const BUILD_V = (() => { const s = document.querySelector('script[src*="data/core.js"]'); const m = s && s.getAttribute('src').match(/\?v=([^&]+)/); return m ? m[1] : ''; })();
const EXTRA_NAMES = ['search', 'sources', 'overlaps', 'leads', 'guide', 'explain'];
function ingestExtra(name) {
  const x = (window.__WIRETAP_EXTRA__ || {})[name]; if (!x || EXTRA.loaded[name]) return;
  EXTRA.loaded[name] = true;
  try {
    if (name === 'overlaps') {
      OVS = (x.overlaps || []).map(([type, a, b, via, links, total, strength, kinds, sources, hops], i) => ({ i, type, a, b, via, links, total, strength, kinds, sources, hops }));
      OV_BY = new Map(D.entities.map(e => [e.id, []])); for (const o of OVS) { OV_BY.get(o.a)?.push(o); OV_BY.get(o.b)?.push(o); }
      CORR = new Map((x.corroborated || []).map(c => [c.kind + ':' + c.id, c.layers]));
      D.corroborated = x.corroborated || []; OV_FULL = true; OV_PART = new Map();
    } else if (name === 'leads') { LEADS = x.leads || []; LEAD = new Map(LEADS.map(l => [l.id, l])); for (const l of LEADS) l._ivs = [dateInterval(l.window?.start), dateInterval(l.window?.end)]; }
    else if (name === 'search') initSearch(x);
    else if (name === 'sources') { D.sources = x.sources || []; SRC = new Map(D.sources.map(s => [s.sid, s])); }
    else if (name === 'guide') { FITS = null; const keep = { next_steps: Object.assign(GUIDE.next_steps || {}, x.next_steps || {}), entity_intros: Object.assign(GUIDE.entity_intros || {}, x.entity_intros || {}) }; GUIDE = Object.assign({ tours: [], walkthrough: null, next_steps: {}, glossary: {} }, x, keep); delete GUIDE.explanations; GLOSS = GUIDE.glossary || {}; EXPLAIN = EXPLAIN || null; if (x.explanations) EXPLAIN = x.explanations; }
    else if (name === 'explain') EXPLAIN = x.explanations || x;
  } catch (err) { console.error('extra ' + name, err); }
  (EXTRA.waiters[name] || []).forEach(f => f()); EXTRA.waiters[name] = [];
  if (typeof onExtraLoaded === 'function') onExtraLoaded(name);
}
window.__wiretapExtra = ingestExtra;
// chunked builds: the search index is sharded (data/s/) and link explanations travel with their detail bucket
if (SI) EXTRA.loaded.search = true;
if (CH) EXTRA.loaded.explain = true;
function loadExtra(name) {
  if (EXTRA.loaded[name]) return Promise.resolve();
  return new Promise(res => {
    (EXTRA.waiters[name] = EXTRA.waiters[name] || []).push(res);
    if (EXTRA.pending[name]) return; EXTRA.pending[name] = true;
    if ((window.__WIRETAP_EXTRA__ || {})[name]) return ingestExtra(name);
    const sc = document.createElement('script'); sc.src = `data/${name}.js${BUILD_V ? '?v=' + BUILD_V : ''}`; sc.async = true;
    sc.onerror = () => { EXTRA.loaded[name] = true; console.warn(`optional data/${name}.js not available`); (EXTRA.waiters[name] || []).forEach(f => f()); EXTRA.waiters[name] = []; if (typeof onExtraLoaded === 'function') onExtraLoaded(name); };
    document.head.appendChild(sc);
  });
}
const loadingNote = what => `<p class="loading-inline" role="status"><span class="spinner sm" aria-hidden="true"></span> Loading ${esc(what)}…</p>`;

// ---- 10-sidebar.js
/* sidebar: filters, date range, search, networks list, legend */
function chip(label, color, on, attrs, n, icon) {
  return `<button type="button" class="chip" aria-pressed="${on}" ${attrs}>${icon ? `<span class="ic" aria-hidden="true">${icon}</span>` : color ? `<span class="dot" style="background:${color}" aria-hidden="true"></span>` : ''}${esc(label)}${n != null ? ` <span class="n">${n}</span>` : ''}</button>`;
}
function toggleIn(set, v, all) {
  // first click on a full set isolates the value ("solo"); later clicks toggle; emptying restores all
  if (set.size === all.length) { set.clear(); set.add(v); } else if (set.has(v)) { set.delete(v); if (!set.size) all.forEach(x => set.add(x)); } else set.add(v);
}
const STEP = 1; // slider step in days
let filtersBuilt = false;
function renderFilters() {
  if (!filtersBuilt) {
    filtersBuilt = true;
    const tc = {}; D.entities.forEach(e => (tc[e.type] = (tc[e.type] || 0) + 1));
    $('#f-types').innerHTML = usedTypes.map(t => chip(t === 'event' ? TYPE[t].plural : TYPE[t].label, TYPE[t].color, true, `data-type="${t}"${t === 'event' ? ' data-guide="events"' : ''}`, tc[t])).join('');
    const pc = {}; D.entities.forEach(e => { const p = e.province || '—'; pc[p] = (pc[p] || 0) + 1; });
    $('#f-provs').innerHTML = allProvs.map(p => chip(p === '—' ? 'none' : p, null, true, `data-prov="${esc(p)}" title="${esc(p === '—' ? 'No province' : provName(p))}"`, pc[p])).join('');
    const sc = {}; D.links.forEach(l => (sc[l.status] = (sc[l.status] || 0) + 1));
    $('#f-status').innerHTML = STATUS_KEYS.map(s => chip(STATUS[s].short, null, true, `data-status="${s}" title="${esc(STATUS[s].label)}" class="st-${STATUS[s].cls}"`, sc[s] || 0, STATUS[s].icon)).join('');
    const cc = {}; D.links.forEach(l => { const c = catOf(l); cc[c] = (cc[c] || 0) + 1; });
    $('#f-cats').innerHTML = usedCats.map(c => chip(LINK_CATS[c].label, LINK_CATS[c].color, true, `data-cat="${c}" title="${esc(LINK_CATS[c].desc || '')}"`, cc[c])).join('');
    for (const r of ['#f-r0', '#f-r1']) { $(r).min = DOM0; $(r).max = DOM1; $(r).step = STEP; }
    $('#date-label').textContent = `(${dayToISO(DOM0).slice(0, 4)}–${dayToISO(DOM1).slice(0, 4)})`;
    renderHist();
    renderNetList();
    const lc = k => D.links.filter(l => itemLayers(l).includes(k)).length + D.entities.filter(e => itemLayers(e).includes(k)).length;
    $('#f-layer').innerHTML = LAYER_KEYS.filter(k => k !== 'theories').map(k => `<button type="button" data-layer="${esc(k)}" aria-pressed="true" title="${esc(layerInfo(k).outlet || layerInfo(k).label)}"${lc(k) ? '' : ' class="nodata"'}><span class="lmark" style="--lc:${layerInfo(k).color}" aria-hidden="true"></span>${esc(layerInfo(k).label)} <span class="n">${lc(k)}</span></button>`).join('');
    const missing = LAYER_KEYS.filter(k => !lc(k));
    $('#layer-note').textContent = (missing.length ? `No ${missing.map(k => layerInfo(k).label).join(' / ')} items yet. ` : '') + 'Pick one or more (at least one stays on). “Public records” = items whose own source layer is official records; a public-record source on a reported item is evidence only.';
    $('#f-minl').innerHTML = Array.from({ length: NLAYERS }, (_, i) => i + 1).map(n => `<option value="${n}">${n === 1 ? 'any (1+)' : n + '+ layers'}</option>`).join('');
    $('#legal-n').textContent = `(${D.entities.filter(hasLegal).length})`; if ($('#norm-n')) $('#norm-n').textContent = `(${D.entities.filter(e => e.norm_flag).length + D.links.filter(l => l.norm_flag).length})`; if ($('#thy-n')) $('#thy-n').textContent = `(${D.entities.filter(e => e.type === 'theory').length})`; $('#evstop-n').textContent = `(${D.entities.filter(isStoppedEv).length} events)`; { const sel = $('#f-evkind'); if (sel && sel.options.length === 1) sel.insertAdjacentHTML('beforeend', Object.keys(EV_KINDS).map(k => `<option value="${esc(k)}">${esc(evKindLabel(k))} (${D.entities.filter(e => e.type === 'event' && e.event_kind === k).length})</option>`).join('')); }
    renderLobbyFilters(true);
  }
  renderLobbyFilters();
  $('#f-minl').value = String(S.minl); $('#f-legal').checked = S.legalf; if ($('#f-norm')) $('#f-norm').checked = !!S.normf; if ($('#f-thy')) { $('#f-thy').checked = !!S.thy; $('#thy-banner').hidden = !S.thy; } $('#f-evstop').checked = S.evstop; $('#f-evkind').value = S.evkind || ''; $('#f-hl').checked = S.hl;
  $$('#f-layer [data-layer]').forEach(b => { const on = S.layers.has(b.dataset.layer); b.setAttribute('aria-pressed', on); b.classList.toggle('on', on); });
  // update in place so elements under the pointer are never replaced mid-click
  $$('#f-types [data-type]').forEach(b => b.setAttribute('aria-pressed', S.types.has(b.dataset.type)));
  $$('#f-provs [data-prov]').forEach(b => b.setAttribute('aria-pressed', S.provs.has(b.dataset.prov)));
  $$('#f-status [data-status]').forEach(b => b.setAttribute('aria-pressed', S.statuses.has(b.dataset.status)));
  $$('#f-cats [data-cat]').forEach(b => b.setAttribute('aria-pressed', S.cats.has(b.dataset.cat)));
  const a = S.from ? isoToDay(S.from) : DOM0, b = S.to ? dateInterval(S.to)[1] : DOM1;
  $('#f-r0').value = Math.max(DOM0, Math.min(DOM1, a)); $('#f-r1').value = Math.max(DOM0, Math.min(DOM1, b));
  $('#f-r0').setAttribute('aria-valuetext', S.from || 'earliest'); $('#f-r1').setAttribute('aria-valuetext', S.to || 'latest');
  if (document.activeElement !== $('#f-from')) $('#f-from').value = S.from || '';
  if (document.activeElement !== $('#f-to')) $('#f-to').value = S.to || '';
  $('#f-basis').value = S.basis; $('#t-basis').value = S.basis;
  $('#f-undated').checked = S.undated; $('#f-money').checked = S.money; $('#f-est').checked = S.est; $('#m-est').checked = S.est;
  $('#undated-n').textContent = `(${D.links.filter(l => !l._iv[S.basis]).length})`;
  $('#btn-dates-clear').hidden = !dateFilterActive();
  $('#f-slider').style.setProperty('--a', ((+$('#f-r0').value - DOM0) / (DOM1 - DOM0)) * 100 + '%');
  $('#f-slider').style.setProperty('--b', ((+$('#f-r1').value - DOM0) / (DOM1 - DOM0)) * 100 + '%');
  $$('#net-list [data-net], #clu-list [data-net]').forEach(b => { b.setAttribute('aria-pressed', S.net === b.dataset.net); const n = NET.get(b.dataset.net); b.hidden = !n.auto && !inLayer(n); });
  renderHist(true);
}
function renderHist(onlyHi) {
  // monthly-ish histogram of link dates (by current basis)
  const bins = 60, w = (DOM1 - DOM0) / bins, box = $('#f-hist');
  if (!onlyHi || box.dataset.basis !== S.basis) {
    const c = new Array(bins).fill(0);
    for (const l of D.links) { const iv = l._iv[S.basis]; if (!iv) continue; const i = Math.min(bins - 1, Math.max(0, Math.floor(((iv[0] + iv[1]) / 2 - DOM0) / w))); c[i]++; }
    const mx = Math.max(1, ...c);
    box.innerHTML = c.map((n, i) => `<span style="height:${n ? 8 + (n / mx) * 92 : 0}%" data-i="${i}" title="${dayToISO(Math.round(DOM0 + i * w)).slice(0, 7)}: ${n}"></span>`).join('');
    box.dataset.basis = S.basis;
  }
  const [a, b] = dateBounds();
  [...box.children].forEach((s, i) => { const x0 = DOM0 + i * w, x1 = x0 + w; s.classList.toggle('out', x1 < a || x0 > b); });
}
function setDate(which, iso) {
  S[which] = iso || null;
  if (S.from && S.to && isoToDay(S.from) > dateInterval(S.to)[1]) { if (which === 'from') S.to = S.from; else S.from = S.to; }
  update();
}
$('#f-r0').addEventListener('input', e => { if (+e.target.value > +$('#f-r1').value) e.target.value = $('#f-r1').value; S.from = +e.target.value <= DOM0 ? null : dayToISO(+e.target.value); lazyUpdate(); });
$('#f-r1').addEventListener('input', e => { if (+e.target.value < +$('#f-r0').value) e.target.value = $('#f-r0').value; S.to = +e.target.value >= DOM1 ? null : dayToISO(+e.target.value); lazyUpdate(); });
const lazyUpdate = debounce(() => update(), 60);
for (const k of ['from', 'to']) {
  const inp = $('#f-' + k);
  inp.addEventListener('change', () => { const v = inp.value.trim(); if (v && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(v)) { inp.setAttribute('aria-invalid', 'true'); toast('Use YYYY, YYYY-MM or YYYY-MM-DD'); return; } inp.removeAttribute('aria-invalid'); setDate(k, v); });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.dispatchEvent(new Event('change')); });
}
$('#btn-dates-clear').addEventListener('click', () => { S.from = S.to = null; update(); });
$('#f-basis').addEventListener('change', e => { S.basis = e.target.value; update(); });
$('#t-basis').addEventListener('change', e => { S.basis = e.target.value; update(); });
$('#f-hist').addEventListener('click', e => { const s = e.target.closest('[data-i]'); if (!s) return; const w = (DOM1 - DOM0) / 60; S.from = dayToISO(Math.round(DOM0 + +s.dataset.i * w)).slice(0, 7); S.to = dayToISO(Math.round(DOM0 + (+s.dataset.i + 1) * w)).slice(0, 7); update(); });
$('#f-layer').addEventListener('click', e => {
  const b = e.target.closest('[data-layer]'); if (!b) return; const k = b.dataset.layer;
  if (S.layers.has(k)) { if (S.layers.size === 1) { toast('At least one source layer must stay on'); return; } S.layers.delete(k); } else S.layers.add(k);
  if (S.net && NET.get(S.net) && !NET.get(S.net).auto && !inLayer(NET.get(S.net))) S.net = null;
  renderResults(); update(true); announce(`Source layers: ${[...S.layers].map(x => layerInfo(x).label).join(', ')}`);
});
$('#f-types').addEventListener('click', e => { const b = e.target.closest('[data-type]'); if (!b) return; toggleIn(S.types, b.dataset.type, usedTypes); update(); });
$('#f-provs').addEventListener('click', e => { const b = e.target.closest('[data-prov]'); if (!b) return; toggleIn(S.provs, b.dataset.prov, allProvs); update(); });
$('#f-status').addEventListener('click', e => { const b = e.target.closest('[data-status]'); if (!b) return; toggleIn(S.statuses, b.dataset.status, STATUS_KEYS); update(); });
$('#f-cats').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (!b) return; toggleIn(S.cats, b.dataset.cat, usedCats); update(); });
$('#f-minl').addEventListener('change', e => { S.minl = +e.target.value || 1; update(); announce(S.minl > 1 ? `Showing items seen in at least ${S.minl} layers` : 'Showing items from any number of layers'); });
$('#f-legal').addEventListener('change', e => { S.legalf = e.target.checked; update(); });
$('#f-norm').addEventListener('change', e => { S.normf = e.target.checked; update(); announce(S.normf ? 'Showing records compared with a sourced benchmark and marked Outside the norm. Not a finding of wrongdoing.' : 'Showing all records'); });
$('#f-thy')?.addEventListener('change', e => { S.thy = e.target.checked; if ($('#thy-banner')) $('#thy-banner').hidden = !S.thy; prevVisibleKey = ''; if (typeof syncTheoryGraph === 'function') syncTheoryGraph(); update(true); announce(S.thy ? 'Showing the Theories (unverified) layer. Reported claims only; no wrongdoing alleged.' : 'Hiding the Theories layer'); });
$('#f-evkind').addEventListener('change', e => { S.evkind = e.target.value; update(); announce(S.evkind ? `Showing ${evKindLabel(S.evkind)} events and what links to them` : 'Showing all event kinds'); });
$('#f-evstop').addEventListener('change', e => { S.evstop = e.target.checked; update(); announce(S.evstop ? "Showing events that were blocked or didn't happen, and what links to them" : 'Showing all events'); });
$('#f-hl').addEventListener('change', e => { S.hl = e.target.checked; update(); });
$('#f-undated').addEventListener('change', e => { S.undated = e.target.checked; update(); });
$('#f-money').addEventListener('change', e => { S.money = e.target.checked; update(); });
$('#f-est').addEventListener('change', e => { S.est = e.target.checked; update(); });
$('#m-est').addEventListener('change', e => { S.est = e.target.checked; update(); });
function resetFilters() { const keep = { view: S.view, layout: S.layout, ecolor: S.ecolor, tour: S.tour, step: S.step }; S = Object.assign(defaults(), keep); $('#q').value = ''; renderResults(); update(true); }
$('#btn-reset').addEventListener('click', resetFilters);
document.addEventListener('click', e => { if (e.target.closest('[data-reset]')) resetFilters(); });

// ---- networks list (curated first; auto-detected clusters separate and labelled)
function netButton(n) {
  const k = n.auto ? { icon: '⁂' } : (NETKIND[n.kind] || {});
  return `<button type="button" class="net-btn${n.auto ? ' auto' : ''}" data-net="${esc(n.id)}" aria-pressed="false"><span class="ic" aria-hidden="true">${k.icon || '◇'}</span><span class="nm">${esc(n.auto ? n.name.replace(/^Auto-detected cluster \d+: /, '') : n.name)}</span>${n.auto ? '' : (n.layers || [n.source_layer]).map(x => layerChip(x, true)).join('')}<span class="n">${n.members.length}</span></button>`;
}
function renderNetList() {
  $('#net-list').innerHTML = NETS.length ? NETS.map(netButton).join('') : '<p class="help">No curated networks in the data yet (graph/networks.json).</p>';
  $('#clu-n').textContent = `(${CLUSTERS.length})`;
  $('#clu-list').innerHTML = CLUSTERS.slice(0, 40).map(netButton).join('') + (CLUSTERS.length > 40 ? `<p class="help">+${CLUSTERS.length - 40} smaller clusters</p>` : '');
  $('#clu-wrap').hidden = !CLUSTERS.length;
}
$('#sb-networks').addEventListener('click', e => { const b = e.target.closest('[data-net]'); if (!b) return; selectNet(S.net === b.dataset.net ? null : b.dataset.net); closeSidebarMobile(); });

// ---- legend
function dashSvg(st) { const s = STATUS[st]; return `<svg width="34" height="8" aria-hidden="true"><line x1="0" y1="4" x2="34" y2="4" stroke="${s.color}" stroke-width="2.5" ${s.dash ? `stroke-dasharray="${s.dash.join(' ')}"` : ''}/></svg>`; }
const ARROW_GLYPH = { triangle: '▶', vee: '⋁', tee: '┤', square: '■', circle: '●', 'triangle-tee': '▶┤', 'triangle-cross': '▶✕', none: '—' };
function renderLegend() {
  $('#legend').innerHTML = STATUS_KEYS.map(s => `<div class="legend-row">${dashSvg(s)}${badge(s)}</div>`).join('') + `<div class="legend-sub">Source layers</div>` + LAYER_KEYS.map(k => `<div class="legend-row">${layerChip(k)}<span class="muted">${esc(layerInfo(k).outlet || '')}</span></div>`).join('') +
    `<div class="legend-sub">Relationships (arrowhead)</div>` +
    usedCats.map(c => { const ts = Object.entries(LINK_TYPES).filter(([k, t]) => t.cat === c && D.links.some(l => l.type === k)); const legalNote = (c === 'case' || (c === 'state' && ts.some(([k]) => k === 'plaintiff_in' || k === 'party_to_case' || k === 'charged'))) ? ' <span class="muted">(case links: neutral record wording only; not a finding of wrongdoing)</span>' : ''; return `<div class="legend-row"><span class="dot sq" style="background:${LINK_CATS[c].color}" aria-hidden="true"></span><span>${esc(LINK_CATS[c].label)}</span><span class="muted">${ts.map(([, t]) => `${ARROW_GLYPH[t.arrow] || '▶'} ${esc(t.short || t.label)}`).join(' · ')}${legalNote}</span></div>`; }).join('') +
    `<div class="legend-row"><span class="est">Estimate</span><span class="muted">estimates, budgets and other amounts are not money moved; excluded from totals by default</span></div>` +
    `<div class="legend-row"><span class="seen seen-2">Seen in 2 layers</span><span class="muted">reported independently by N source layers</span></div>` +
    `<div class="legend-row"><svg width="34" height="8" aria-hidden="true"><line x1="0" y1="4" x2="34" y2="4" stroke="#9aa0a6" stroke-width="1.2" stroke-dasharray="1 3"/></svg><span class="muted">Overlap (optional): found by the map, not a claim</span></div>` +
    `<div class="legend-row muted">Line width ∝ amount · node size ∝ connections</div>`;
  { const DESC = { wiretap: 'Wiretap Media reporting', fringeviews: 'commentary by FringeViews, Polly St. George; mostly unverified', bloodmoney: 'items mapped by the Bl00d Money project', samcooper: 'reporting by Sam Cooper / The Bureau (@scoopercooper); many articles are paywalled, so often only the headline and free preview were read', records: 'items whose own source is official records, added by the records checker and the records collector', theories: 'Unverified theory - reported claims only, educational, no wrongdoing alleged. Off by default; use the Theories toggle or a per-node switch.' };
    fillSourceSelects();
    $('#about-layer-n').textContent = `(${LAYER_KEYS.length})`; $('#about-layers').innerHTML = LAYER_KEYS.map(k => `<li data-about-layer="${esc(k)}">${layerChip(k)} ${esc(DESC[k] || layerInfo(k).outlet || '')}</li>`).join(''); }
  $('#about-badges').innerHTML = STATUS_KEYS.map(s => `<div>${badge(s)}<span>${esc(STATUS[s].desc)}</span></div>`).join('');
}

// ---- search
let MS = null;
function initSearch(x) { try { MS = MiniSearch.loadJSON(JSON.stringify(x.index), x.options); } catch (e) { console.warn('search index load failed', e); } if (S.q) renderResults(); }
let activeIdx = -1, lastResults = [];
function hl(text, terms) {
  let out = esc(text); if (!terms.length) return out;
  const re = new RegExp('(' + terms.filter(t => t.length > 1).map(t => esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig');
  return terms.length ? out.replace(re, '<mark>$1</mark>') : out;
}
function runSearch(q, limit = 40) {
  if (!q.trim()) return [];
  if (SI) return shardSearch(q, limit);
  if (MS) {
    const opts = { prefix: true, fuzzy: 0.2, boost: { name: 3, aliases: 2.5 }, boostDocument: (id, term, f) => (f && f.kind === 'e' ? 2.5 : f && f.kind === 'n' ? 2 : f && f.kind === 's' ? 0.6 : 1) };
    const and = MS.search(q, Object.assign({ combineWith: 'AND' }, opts)), or = MS.search(q, Object.assign({ combineWith: 'OR' }, opts));
    return and.concat(or).filter((r, i, a) => a.findIndex(x => x.id === r.id) === i).slice(0, limit);
  }
  const ql = q.toLowerCase();
  return D.entities.filter(e => (e.name + ' ' + e.aliases.join(' ') + ' ' + e.summary).toLowerCase().includes(ql)).slice(0, limit).map(e => ({ id: 'e:' + e.id, kind: 'e', ref: e.id, terms: [ql] }));
}
function resultVisible(r) {
  if (!F) return true;
  if (r.kind === 'e') return F.ents.has(r.ref);
  if (r.kind === 'l') return F.linkSet.has(r.ref);
  if (r.kind === 'n') return NET.get(r.ref).auto || inLayer(NET.get(r.ref));
  if (r.kind === 's') return layerAll() || ((srcOf(r) || {}).layers || []).some(k => S.layers.has(k));
  return true;
}
// sharded search: fetch the shards a query needs (and the source titles of source hits), then render again
function searchPending(q) {
  if (!SI || !q.trim()) return false;
  if (searchMissing(q).size) { searchLoad(q).then(() => { if (S.q === q) { renderResults(); if (S.view === 'index') renderIndex(); highlightSearch(); } }); return true; }
  return false;
}
const srcOf = r => SRC.get(r.ref) || SH.src.get(r.si);
function renderResults() {
  const q = S.q;
  if (searchPending(q)) { lastResults = []; lastResults._q = null; $('#q').setAttribute('aria-expanded', 'true'); $('#results').innerHTML = `<div class="no-results" role="status">${loadingNote('search')}</div>`; return; } lastResults = runSearch(q, 80).filter(r => layerAll() || (r.kind === 'e' ? inLayer(ENT.get(r.ref)) || (F && F.ents.has(r.ref)) : r.kind === 'l' ? inLayer(LNK.get(r.ref)) : resultVisible(r))).slice(0, 40); lastResults._q = q; activeIdx = -1;
  const box = $('#results');
  $('#q').setAttribute('aria-expanded', q.trim() ? 'true' : 'false');
  if (!q.trim()) { box.innerHTML = ''; return; }
  if (!lastResults.length) {
    box.innerHTML = `<div class="no-results" role="status"><b>No matches for “${esc(q)}”.</b><br>Try a shorter name, an alias or a record id, or check the spelling. Search covers entities, claims, networks and source titles.${S.types.size !== usedTypes.length || S.statuses.size !== STATUS_KEYS.length || dateFilterActive() ? ' <button class="linkish" data-reset>Reset filters</button>' : ''}</div>`;
    announce(`No matches for ${q}`); return;
  }
  { const need = lastResults.filter(r => r.kind === 's' && !srcOf(r) && r.si != null).map(r => r.si); if (need.length) { srcStubLoad(need).then(() => { if (S.q === q) renderResults(); }); } }
  const hidden = lastResults.filter(r => !resultVisible(r)).length;
  box.innerHTML = lastResults.map((r, i) => {
    const terms = r.terms || []; const hid = resultVisible(r) ? '' : '<span class="hid" title="Hidden by current filters">hidden by filters</span>';
    if (r.kind === 'e') { const e = ENT.get(r.ref); const T = TYPE[e.type]; const thy = typeof isTheoryEnt === 'function' && isTheoryEnt(e); return `<button type="button" class="result" role="option" id="res-${i}" data-i="${i}"><span class="r-name">${hl(e.name, terms)}</span><span class="r-meta"><span style="color:${T.color}" aria-hidden="true">■</span> ${e.layers.map(x => layerChip(x, true)).join('')} ${esc(T.label)}${thy ? ' · <span class="thy-badge">unverified</span>' : ''}${e.province ? ' · ' + esc(e.province) : ''}${e.aliases.length ? ' · ' + hl(e.aliases.slice(0, 3).join(', '), terms) : ''}${hasTheorySwitch && hasTheorySwitch(e) ? ' · theories' : ''} ${hid}</span></button>`; }
    if (r.kind === 'l') { const l = LNK.get(r.ref); return `<button type="button" class="result" role="option" id="res-${i}" data-i="${i}"><span class="r-name">${hl(name(l.from), terms)} <span class="muted">→ ${esc(LT(l.type).label)} →</span> ${hl(name(l.to), terms)}</span><span class="r-meta">claim · ${itemLayers(l).map(x => layerChip(x, true)).join('')} ${STATUS[l.status].icon} ${esc(STATUS[l.status].short)}${l.amount_cad ? ' · ' + fmtCAD(l.amount_cad) + (isEst(l) ? ' est.' : '') : ''}${l.date ? ' · ' + esc(l.date) : ''} ${hid}</span></button>`; }
    if (r.kind === 'n') { const n = NET.get(r.ref); return `<button type="button" class="result" role="option" id="res-${i}" data-i="${i}"><span class="r-name">${hl(n.name, terms)}</span><span class="r-meta">network · ${esc(netLabel(n))} · ${n.members.length} members</span></button>`; }
    const s = srcOf(r) || { title: r.ref, cites: [], kind: 'other' }; return `<button type="button" class="result" role="option" id="res-${i}" data-i="${i}"><span class="r-name">${hl(s.title || s.url || s.key, terms)}</span><span class="r-meta">source · ${esc(s.kind === 'public_record' ? 'public record' : s.kind === 'other' ? 'other' : srcKindLabel(s.kind))}${s.date ? ' · ' + esc(s.date) : ''} · cited ${s.cites ? s.cites.length : s.nc}×</span></button>`;
  }).join('') + (hidden ? `<div class="r-foot muted">${hidden} result(s) hidden by current filters; opening one shows it anyway.</div>` : '');
  announce(`${lastResults.length} results`);
}
function pickResult(i) {
  const r = lastResults[i]; if (!r) return;
  if (r.kind === 'e') select({ node: r.ref });
  else if (r.kind === 'l') select({ link: r.ref });
  else if (r.kind === 'n') selectNet(r.ref);
  else { S.view = 'sources'; S.sq = ((srcOf(r) || {}).title || '').slice(0, 60); update(true); }
  if (S.view === 'about') setView('map');
  closeSidebarMobile();
}
$('#q').addEventListener('input', debounce(e => { S.q = e.target.value; renderResults(); if (S.view === 'index') renderIndex(); highlightSearch(); commit(false); }, 80));
$('#q').addEventListener('keydown', e => {
  const items = $$('#results .result[data-i]');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(0, Math.min(items.length - 1, activeIdx + (e.key === 'ArrowDown' ? 1 : -1))); items.forEach((x, i) => x.classList.toggle('active', i === activeIdx)); if (items[activeIdx]) { items[activeIdx].scrollIntoView({ block: 'nearest' }); $('#q').setAttribute('aria-activedescendant', items[activeIdx].id); } }
  else if (e.key === 'Enter') { e.preventDefault(); S.q = e.target.value; const q = S.q; if (SI && searchMissing(q).size) { searchLoad(q).then(() => { if (S.q === q) { renderResults(); pickResult(0); } }); return; } if (!lastResults.length || lastResults._q !== S.q) renderResults(); pickResult(activeIdx >= 0 ? activeIdx : 0); }
  else if (e.key === 'Escape') { S.q = ''; e.target.value = ''; renderResults(); highlightSearch(); commit(false); }
});
$('#results').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) pickResult(+b.dataset.i); });
document.addEventListener('keydown', e => { if (e.key === '/' && !/input|select|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); if (window.innerWidth <= 900) openSidebarMobile(); $('#q').focus(); } });
function openSidebarMobile() { document.body.classList.add('sb-open'); $('#btn-filters').setAttribute('aria-expanded', 'true'); }
function closeSidebarMobile() { document.body.classList.remove('sb-open'); $('#btn-filters').setAttribute('aria-expanded', 'false'); }
$('#btn-filters').addEventListener('click', () => (document.body.classList.contains('sb-open') ? closeSidebarMobile() : openSidebarMobile()));
$('#stage').addEventListener('click', () => closeSidebarMobile());

// ---- 20-graph.js
/* graph: cytoscape map, layouts, highlighting, keyboard navigation, focus/expand */
let cy = null, curLayout = null, prevVisibleKey = '', kbd = null;
const nodeSize = e => 18 + Math.min(46, Math.sqrt(e.degree) * 6 + (e.money_in + e.money_out > 0 ? Math.log10(e.money_in + e.money_out + 1) * 2.5 : 0));
const fontSize = e => Math.round(9 + Math.min(10, Math.sqrt(e.degree) * 1.4));
const edgeWidth = l => l.amount_cad > 0 ? Math.min(11, 1.5 + Math.log10(l.amount_cad) * 1.1) : 1.2;
const edgeColor = l => S.ecolor === 'type' ? LINK_CATS[catOf(l)].color : S.ecolor === 'layer' ? (seenOf(l).length > 1 ? '#FFFFFF' : layerInfo(seenOf(l)[0] || 'wiretap').color) : STATUS[l.status].color;
// WebGL only on a hardware GPU: on a software rasteriser (SwiftShader, llvmpipe) the canvas renderer is faster.
const USE_WEBGL = BIG && !/[?&]webgl=0/.test(location.search) && (() => { try { const gl = document.createElement('canvas').getContext('webgl2'); if (!gl) return false; if (/[?&]webgl=1/.test(location.search)) return true; const x = gl.getExtension('WEBGL_debug_renderer_info'); const r = x ? String(gl.getParameter(x.UNMASKED_RENDERER_WEBGL)) : ''; return !/swiftshader|llvmpipe|software|basic render/i.test(r); } catch { return false; } })();
// big graphs: only the best-connected nodes carry a label until the user zooms in (labels are the costliest part of the first frame)
const MAJOR = BIG ? new Set(D.entities.slice().sort((a, b) => b.degree - a.degree).slice(0, 300).map(e => e.id)) : null;
// fast fit from precomputed positions (avoids measuring every label's bounding box)
function fitFast(ids, pad = 30) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0;
  for (const id of ids) { const e = ENT.get(id); if (!e || !e.pos) return false; const [x, y] = e.pos; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; n++; }
  if (!n) return false;
  const w = cy.width(), h = cy.height(); const z = Math.max(cy.minZoom(), Math.min(cy.maxZoom(), 1.5, Math.min((w - 2 * pad) / Math.max(1, x1 - x0 + 40), (h - 2 * pad) / Math.max(1, y1 - y0 + 40))));
  cy.viewport({ zoom: z, pan: { x: w / 2 - z * (x0 + x1) / 2, y: h / 2 - z * (y0 + y1) / 2 } }); return true;
}
// big graphs draw the nodes first and add the claim lines right after the first frame (see addDeferredEdges)
let DEFER_EDGES = false;
const isThyL = l => (typeof isTheoryLnk === 'function' ? isTheoryLnk(l) : l.type === 'named_in_theory');
const isThyE = e => (typeof isTheoryEnt === 'function' ? isTheoryEnt(e) : (e.theory || e.type === 'theory'));
const edgeEl = l => { const t = LT(l.type), st = STATUS[l.status] || STATUS.reported; const a0 = t.directed === false ? 'none' : (t.arrow || 'triangle'); return { group: 'edges', classes: [isEst(l) ? 'est' : '', l.status === 'contradicted' ? 'contra' : '', 'seen' + Math.min(4, seenOf(l).length), st.dash ? 'dashed' : '', t.directed === false ? 'undirected' : '', LITE && renderGraph._hl ? 'hl' : ''].filter(Boolean).join(' '), data: { id: 'L:' + l.id, lid: l.id, source: l.from, target: l.to, color: LITE ? edgeColor(l) : STATUS[l.status].color, dash: st.dash || [1, 0], width: edgeWidth(l), arrow: BIG ? (initGraph._near ? a0 : 'none') : (t.arrow || 'triangle'), arrow0: a0, label: l.amount_cad > 0 ? fmtCAD(l.amount_cad) + (isEst(l) ? ' est.' : '') : '' } }; };
const edgeElements = () => D.links.filter(l => !isThyL(l)).map(edgeEl);
const nodeEl = e => ({ group: 'nodes', classes: 'seen' + seenTier(seenOf(e).length) + (isStoppedEv(e) ? ' ev-stopped' : '') + (MAJOR && !MAJOR.has(e.id) && !initGraph._near ? ' minor' : '') + (e.has_theory_switch ? ' has-thy' : '') + (LITE && renderGraph._hl ? ' hl' : '') + (LOD.nolabel ? ' nolabel' : ''), data: { id: e.id, label: e.name, color: TYPE[e.type].color, shape: TYPE[e.type].shape, size: nodeSize(e), fs: fontSize(e), type: e.type, province: e.province || '—' }, position: e.pos ? { x: e.pos[0], y: e.pos[1] } : { x: 0, y: 0 } });
// ---- Level of detail (phones and desktop on a large graph): the graph holds an overview (the best-connected nodes),
// what is in view once zoomed in (a spatial grid over the build-time layout, best-connected first, up to NODE_MAX),
// and everything the selection, expanded nodes, a network, lead, tour, path or overlap needs. Nodes that leave the
// view are dropped again. Phones use a tight cap; desktop uses a larger one so mid-zoom stays dense. ?lite=0 disables it.
const LOD = { grid: null, cell: 300, res: new Set(), overview: [], NODE_MAX: 1400, OVERVIEW_N: 350, ZOOM_FILL: 0.1, nolabel: false, adds: 0, removes: 0, deferFill: true };
function lodInit() {
  if (LITE) { LOD.NODE_MAX = 1400; LOD.OVERVIEW_N = 350; }
  else { LOD.NODE_MAX = 5000; LOD.OVERVIEW_N = 800; }
  const g = new Map(), c = LOD.cell;
  for (const e of D.entities) { if (isThyE(e) || !e.pos) continue; const k = Math.floor(e.pos[0] / c) + ',' + Math.floor(e.pos[1] / c); (g.get(k) || g.set(k, []).get(k)).push(e); }
  for (const a of g.values()) a.sort((x, y) => y.degree - x.degree);
  LOD.grid = g; LOD.overview = D.entities.filter(e => !isThyE(e)).sort((a, b) => b.degree - a.degree).slice(0, LOD.OVERVIEW_N).map(e => e.id);
}
function lodPins() {
  const p = new Set(); const add = id => { if (id && ENT.has(id) && !isThyE(ENT.get(id))) p.add(id); };
  const addL = id => { const l = LNK.get(id); if (l) { add(l.from); add(l.to); } };
  const hood = id => { add(id); for (const l of byNode.get(id) || []) { add(l.from); add(l.to); } };
  if (S.node) hood(S.node);
  if (S.link) addL(S.link);
  for (const id of S.expand) hood(id);
  if (S.net && NET.has(S.net)) NET.get(S.net).members.forEach(add);
  if (S.lead && LEAD.has(S.lead)) { const L = LEAD.get(S.lead); L.entities.forEach(add); L.link_ids.forEach(addL); }
  const ts = typeof tourHighlight === 'function' ? tourHighlight() : null; if (ts) { (ts.entities || []).forEach(add); (ts.links || []).forEach(addL); }
  for (const pa of PATHS || []) { pa.nodes.forEach(add); (pa.links || []).forEach(addL); }
  add(S.pa); add(S.pb); add(kbd);
  if (S.ov != null && ovAt(S.ov)) { add(ovAt(S.ov).a); add(ovAt(S.ov).b); }
  for (const id of S.thyOn || []) add(id);
  return p;
}
function lodWanted() {
  const want = lodPins(); const ok = id => !F || F.ents.has(id);
  if (LOD.deferFill) { for (const id of LOD.overview) if (ok(id)) want.add(id); return want; }
  if (F && F.ents.size <= LOD.NODE_MAX) { for (const id of F.ents) if (!isThyE(ENT.get(id))) want.add(id); return want; }
  for (const id of LOD.overview) if (ok(id)) want.add(id);
  if (!cy || S.layout !== 'network') { if (cy && S.layout !== 'network') for (const id of LOD.res) want.add(id); return want; }
  if (cy.zoom() < LOD.ZOOM_FILL) return want;
  const ext = cy.extent(), c = LOD.cell, w = ext.x2 - ext.x1, h = ext.y2 - ext.y1;
  const x1 = Math.floor((ext.x1 - w * 0.2) / c), x2 = Math.floor((ext.x2 + w * 0.2) / c), y1 = Math.floor((ext.y1 - h * 0.2) / c), y2 = Math.floor((ext.y2 + h * 0.2) / c);
  const cand = [];
  for (let gx = x1; gx <= x2; gx++) for (let gy = y1; gy <= y2; gy++) { const a = LOD.grid.get(gx + ',' + gy); if (a) for (const e of a) if (ok(e.id)) cand.push(e); }
  cand.sort((a, b) => b.degree - a.degree);
  for (const e of cand) { if (want.size >= LOD.NODE_MAX) break; want.add(e.id); }
  return want;
}
function lodSync() {
  if (!LOD_ON || !cy) return false;
  const want = lodWanted(), res = LOD.res, V = renderGraph._vis || (renderGraph._vis = new Map());
  const rm = [], add = []; for (const id of res) if (!want.has(id)) rm.push(id); for (const id of want) if (!res.has(id)) add.push(id);
  if (!rm.length && !add.length) return false;
  cy.batch(() => {
    if (rm.length) { const els = rm.map(id => cy.getElementById(id)).filter(n => n.length); const col = cy.collection(els); col.connectedEdges().forEach(ed => V.delete(ed.id())); col.remove(); for (const id of rm) { res.delete(id); V.delete(id); } }
    if (add.length) {
      cy.add(add.map(id => nodeEl(ENT.get(id)))); for (const id of add) res.add(id);
      const seen = new Set(), eds = [];
      for (const id of add) for (const l of byNode.get(id) || []) { if (seen.has(l.id) || isThyL(l)) continue; const o = l.from === id ? l.to : l.from; if (!res.has(o)) continue; seen.add(l.id); if (!cy.hasElementWithId('L:' + l.id)) eds.push(edgeEl(l)); }
      if (eds.length) cy.add(eds);
    }
  });
  LOD.adds += add.length; LOD.removes += rm.length;
  return true;
}

function addDeferredEdges() {
  if (!cy || !DEFER_EDGES) return; DEFER_EDGES = false;
  const t = performance.now(); cy.one('render', () => { TIMING.full_paint_ms = Math.round(performance.now()); }); cy.batch(() => cy.add(edgeElements()));
  renderGraph._ecolor = null; renderGraph._hl = undefined; update(false);
  TIMING.edges_ms = Math.round(performance.now()); TIMING.edges_add_ms = Math.round(performance.now() - t);
}
function initGraph() {
  const small = !BIG;
  cy = cytoscape({
    container: $('#cy'), layout: { name: 'preset', fit: false }, ...(USE_WEBGL ? { renderer: { name: 'canvas', webgl: true } } : {}), minZoom: 0.03, maxZoom: 5, boxSelectionEnabled: false, autoungrabify: BIG,
    hideEdgesOnViewport: BIG, textureOnViewport: BIG, pixelRatio: BIG ? 1 : 'auto', motionBlur: false,
    elements: [
      ...(LOD_ON ? [] : D.entities.filter(e => !isThyE(e)).map(nodeEl)),
      ...(DEFER_EDGES || LOD_ON ? [] : edgeElements()),
    ],
    style: [
      { selector: 'node', style: { 'background-color': 'data(color)', shape: 'data(shape)', width: 'data(size)', height: 'data(size)', label: 'data(label)', color: '#e2e2de', 'font-family': 'ui-monospace, Menlo, Consolas, monospace', 'font-size': 'data(fs)', 'min-zoomed-font-size': BIG ? 12 : 8, 'text-valign': 'bottom', 'text-margin-y': 4, 'text-wrap': 'ellipsis', 'text-max-width': 150, 'text-outline-color': '#07080a', 'text-outline-width': 2.5, 'border-width': 1.5, 'border-color': '#07080a' } },
      { selector: 'node.nolabel', style: { label: '' } },
      { selector: 'node.ev-stopped', style: { 'background-opacity': 0.12, 'border-color': 'data(color)', 'border-width': 2.5, 'border-style': 'dashed' } }, // hollow dashed star: blocked / didn't happen
      { selector: 'node.minor', style: { label: '' } },
      { selector: 'node.minor.sel, node.minor.nb, node.minor.hit, node.minor.path, node.minor.lead, node.minor.tour, node.minor.netm, node.minor.kbd', style: { label: 'data(label)' } },
...Array.from({ length: Math.max(0, NLAYERS - 1) }, (_, i) => i + 2).flatMap(n => [ // one tier per layer count (2…number of layers)
        { selector: `node.hl.seen${n}`, style: { 'border-color': '#FFFFFF', 'border-width': 1 + 3 * (n - 1), 'border-style': 'double' } },
        { selector: `edge.hl.seen${n}`, style: { width: e => e.data('width') + 1.5 * (n - 1), opacity: Math.min(1, 0.85 + 0.05 * n) } }]),
      { selector: 'edge', style: { width: 'data(width)', 'line-color': 'data(color)', 'target-arrow-shape': 'data(arrow)', 'target-arrow-color': 'data(color)', 'arrow-scale': 0.8, 'curve-style': small ? 'bezier' : 'straight', opacity: small ? 0.55 : 0.35, label: '', 'font-size': 9, color: '#F0E442', 'text-outline-color': '#07080a', 'text-outline-width': 2, 'font-family': 'ui-monospace, Menlo, monospace', 'min-zoomed-font-size': 7 } },
      { selector: 'edge.dashed', style: { 'line-style': 'dashed', 'line-dash-pattern': 'data(dash)' } },
      { selector: 'edge.undirected', style: { 'target-arrow-shape': 'none' } },
      { selector: 'edge.contra', style: { 'mid-target-arrow-shape': 'tee', 'mid-target-arrow-color': 'data(color)', 'arrow-scale': 1.1 } },
      { selector: 'edge.est', style: { 'mid-target-arrow-shape': 'diamond', 'mid-target-arrow-fill': 'hollow', 'mid-target-arrow-color': '#F0E442', opacity: 0.4 } },
      { selector: 'edge.showamt', style: { label: 'data(label)' } },
      { selector: '.faded', style: { opacity: 0.07, 'text-opacity': 0.12 } },
      { selector: 'node.hit', style: { 'border-color': '#F0E442', 'border-width': 3.5 } },
      { selector: 'node.kbd', style: { 'overlay-color': '#56B4E9', 'overlay-opacity': 0.25, 'overlay-padding': 6 } },
      { selector: 'node.sel', style: { 'border-color': '#ffffff', 'border-width': 4, 'z-index': 99, 'min-zoomed-font-size': 0 } },
      { selector: 'node.sol-xing', style: { 'outline-color': '#4477AA', 'outline-width': 4, 'outline-offset': 3, 'outline-opacity': 1 } },
      { selector: 'edge.sol-xing', style: { 'line-style': 'dashed', 'line-dash-pattern': [8, 4], 'underlay-color': '#4477AA', 'underlay-padding': 4, 'underlay-opacity': 0.6 } },
      { selector: 'node.nb', style: { opacity: 1, 'min-zoomed-font-size': 0 } },
      { selector: 'node.expanded', style: { 'border-color': '#56B4E9', 'border-width': 4, 'border-style': 'double' } },
      { selector: 'edge.sel', style: { opacity: 1, width: e => e.data('width') + 2, 'z-index': 99, label: 'data(label)' } },
      { selector: 'edge.nb', style: { opacity: 0.95, label: 'data(label)' } },
      { selector: 'node.netm', style: { 'border-color': '#CC79A7', 'border-width': 4, opacity: 1, 'min-zoomed-font-size': 0, 'z-index': 50 } },
      { selector: 'edge.ovl', style: { width: 1, 'line-color': '#9aa0a6', 'line-style': 'dotted', 'target-arrow-shape': 'none', 'curve-style': 'straight', opacity: 0.55, label: '', 'z-index': 1 } },
      { selector: 'edge.ovl.faded', style: { opacity: 0.04 } },
      { selector: 'node.path', style: { 'border-color': '#56B4E9', 'border-width': 4, opacity: 1, 'min-zoomed-font-size': 0, 'z-index': 80 } },
      { selector: 'edge.path', style: { opacity: 1, width: e => e.data('width') + 2.5, 'line-color': '#56B4E9', 'target-arrow-color': '#56B4E9', 'z-index': 80, label: 'data(label)' } },
      { selector: 'node.lead', style: { 'border-color': '#F0E442', 'border-width': 4, opacity: 1, 'min-zoomed-font-size': 0, 'z-index': 85 } },
      { selector: 'edge.lead', style: { opacity: 1, width: e => e.data('width') + 2.5, 'line-color': '#F0E442', 'target-arrow-color': '#F0E442', 'z-index': 85, label: 'data(label)' } },
      { selector: 'node.tour', style: { 'border-color': '#56B4E9', 'border-width': 5, opacity: 1, 'min-zoomed-font-size': 0, 'z-index': 90 } },
      { selector: 'edge.tour', style: { opacity: 1, width: e => e.data('width') + 3, 'line-color': '#56B4E9', 'target-arrow-color': '#56B4E9', 'z-index': 90, label: 'data(label)' } },
      { selector: 'edge.netl', style: { opacity: 1, width: e => e.data('width') + 2.5, 'line-color': '#CC79A7', 'target-arrow-color': '#CC79A7', label: 'data(label)', 'z-index': 50 } },
      ...(BIG ? [{ selector: 'edge.sel, edge.nb, edge.path, edge.lead, edge.tour, edge.netl', style: { 'target-arrow-shape': 'data(arrow0)' } }] : []),
      { selector: 'node.thy-node', style: { 'background-color': 'data(color)', 'background-opacity': 0.18, 'border-color': 'data(color)', 'border-width': 2.5, 'border-style': 'dashed', shape: 'vee', width: 'data(size)', height: 'data(size)', 'font-size': 'data(fs)', 'min-zoomed-font-size': 0, 'text-valign': 'top', 'text-margin-y': -10, 'text-max-width': 120, 'text-wrap': 'ellipsis', 'z-index': 40 } },
      { selector: 'edge.thy-edge', style: { 'line-style': 'dashed', 'line-dash-pattern': [6, 4], 'line-color': 'data(color)', 'target-arrow-shape': 'none', opacity: 0.85, width: 1.4, label: 'data(label)', 'font-size': 8, color: '#b0b0b0' } },
    ],
  });
  if (LOD_ON) { lodInit(); lodSync(); cy.on('viewport', debounce(() => { if (S.view === 'map' && lodSync()) renderGraph(); }, 180)); }
  cy.on('tap', 'node', ev => { kbd = ev.target.id(); select({ node: ev.target.id() }); });
  cy.on('dbltap', 'node', ev => toggleExpand(ev.target.id()));
  cy.on('tap', 'edge', ev => ev.target.hasClass('ovl') ? select({ ov: ev.target.data('ov') }) : select({ link: ev.target.data('lid') }));
  cy.on('tap', ev => { if (ev.target === cy) select({}); });
  const tip = $('#tooltip');
  cy.on('mouseover', 'node, edge', ev => {
    const t = ev.target; let html;
    if (t.isNode()) { const e = ENT.get(t.id()); html = `<b>${esc(e.name)}</b><br><span class="muted">${esc(TYPE[e.type].label)}${e.province ? ' · ' + esc(e.province) : ''} · ${e.degree} links</span>${e.money_in || e.money_out ? `<br><span class="gold">in ${fmtCAD(e.money_in) || '$0'} · out ${fmtCAD(e.money_out) || '$0'}</span>` : ''}`; }
    else if (t.hasClass('ovl')) { const o = ovAt(t.data('ov')); html = `<b>${esc(name(o.a))} ↔ ${esc(name(o.b))}</b><br>${esc(OV_TYPES[o.type]?.label || o.type)}${o.kinds && o.kinds.length ? ' (' + esc(o.kinds.join(', ')) + ')' : ''}<br><span class="muted">${esc(OV_NOTE)}</span>`; }
    if (t.isNode()) { const e = ENT.get(t.id()); html += `<br>${seenBadge(e)}${legalChips(e, true)}`; }
    if (t.hasClass('ovl')) {} else if (t.isNode()) {} else { const l = LNK.get(t.data('lid')); html = `${esc(name(l.from))} → <i>${esc(LT(l.type).label)}</i> → ${esc(name(l.to))}${l.amount_cad ? `<br><span class="gold">${fmtCADfull(l.amount_cad)}</span> ${estTag(l)}` : ''}<br>${lbadge(l)} ${itemLayers(l).map(k => layerChip(k)).join('')} ${seenBadge(l, true)}`; }
    tip.innerHTML = html; tip.hidden = false;
  });
  cy.on('mousemove', ev => { if (tip.hidden || !ev.originalEvent) return; tip.style.left = Math.min(window.innerWidth - 330, ev.originalEvent.clientX + 14) + 'px'; tip.style.top = ev.originalEvent.clientY + 12 + 'px'; });
  cy.on('mouseout', 'node, edge', () => (tip.hidden = true));
  cy.on('pan zoom', () => (tip.hidden = true));
  cy.on('zoom', debounce(() => { if (!BIG) cy.edges().toggleClass('showamt', cy.zoom() > 1.3); }, 80));
  if (BIG) cy.on('zoom', debounce(() => { if (cy.zoom() > 0.6 && !initGraph._near) { initGraph._near = true; cy.batch(() => { cy.$('node.minor').removeClass('minor'); cy.edges().forEach(e => { if (e.data('arrow0')) e.data('arrow', e.data('arrow0')); }); }); } }, 150));
  const opts = [0, 3, 5, 10, 15, 20, 30, 50, 100, 200].filter(v => v < MAXDEG);
  $('#g-maxdeg').innerHTML = opts.map(v => `<option value="${v}">${v ? v + ' links' : 'off'}</option>`).join('');
}
function gridPositions(groupOf, label) {
  const vis = cy.nodes(':visible'); const groups = [...new Set(vis.map(groupOf))].sort();
  const size = {}; vis.forEach(n => (size[groupOf(n)] = (size[groupOf(n)] || 0) + 1));
  groups.sort((a, b) => size[b] - size[a]);
  const cols = Math.ceil(Math.sqrt(groups.length)); const pos = {}, k = {};
  const cell = Math.max(380, Math.sqrt(Math.max(...Object.values(size), 1)) * 60);
  // order nodes in each group by degree so hubs sit in the middle of their spiral
  vis.sort((a, b) => ENT.get(b.id()).degree - ENT.get(a.id()).degree).forEach(n => { const g = groupOf(n), i = groups.indexOf(g); const j = k[g] = (k[g] || 0) + 1; const cx = (i % cols) * cell, cyy = Math.floor(i / cols) * cell; const a = j * 2.399, r = 26 * Math.sqrt(j); pos[n.id()] = { x: cx + Math.cos(a) * r, y: cyy + Math.sin(a) * r }; });
  return { name: 'preset', positions: n => pos[n.id()] || { x: 0, y: 0 }, animate: false, padding: 30 };
}
function layoutOpts(kind) {
  if (kind === 'rings') return { name: 'concentric', concentric: n => 10 - TYPE_ORDER.indexOf(n.data('type')), levelWidth: () => 1, minNodeSpacing: BIG ? 4 : 16, animate: false, padding: 30 };
  if (kind === 'provinces') return gridPositions(n => n.data('province'));
  if (kind === 'clusters') return gridPositions(n => ENT.get(n.id()).cluster || 'zz_unclustered');
  return { name: 'preset', positions: n => { const p = ENT.get(n.id()).pos; return p ? { x: p[0], y: p[1] } : { x: 0, y: 0 }; }, animate: false, padding: 30 };
}
function runLayout() {
  // the default layout uses the build-time positions already given to every node: just set the viewport
  if (S.layout === 'network' && !S.expand.length && !runLayout._moved && fitFast(F.ents)) { curLayout = S.layout; return; }
  const els = cy.elements(':visible'); if (!els.length) return; els.layout(layoutOpts(S.layout)).run(); curLayout = S.layout; cy.fit(els, 30);
  if (S.layout !== 'network') runLayout._moved = true; else runLayout._moved = false;
}
function renderGraph() {
  if (!cy) return;
  if (LOD_ON) lodSync();
  cy.batch(() => {
    // visibility is tracked here so unchanged elements are not touched (reading style() on every element is slow)
    const V = renderGraph._vis || (renderGraph._vis = new Map());
    cy.nodes().forEach(n => { const id = n.id(), on = F.ents.has(id); if ((V.get(id) ?? true) !== on) { V.set(id, on); n.style('display', on ? 'element' : 'none'); } });
    cy.edges().not('.ovl').forEach(e => { const id = e.id(), on = F.linkSet.has(e.data('lid')); if ((V.get(id) ?? true) !== on) { V.set(id, on); e.style('display', on ? 'element' : 'none'); } });
    if (renderGraph._ecolor !== S.ecolor) { renderGraph._ecolor = S.ecolor; cy.edges().not('.ovl').forEach(e => { const c = edgeColor(LNK.get(e.data('lid'))); e.data('color', c); }); }
    cy.nodes().removeClass('expanded'); S.expand.forEach(id => cy.$id(id).addClass('expanded'));
    if (typeof syncTheoryGraph === 'function') syncTheoryGraph();
    if (renderGraph._hl !== S.hl) { renderGraph._hl = S.hl; cy.elements().not('.ovl').toggleClass('hl', S.hl); }
  });
  const key = F.ents.size + ':' + [...F.ents].slice(0, 400).join('|') + S.layout;
  if (key !== prevVisibleKey || curLayout !== S.layout) { const first = !prevVisibleKey; prevVisibleKey = key; if (S.view === 'map') { if (S.layout !== 'network' || curLayout !== 'network' || first || S.expand.length) runLayout(); else cy.fit(cy.elements(':visible'), 30); if (isMobile() && document.body.classList.contains('panel-open') && (S.node || S.link)) focusSelection(); /* a re-fit must not push the selection under the bottom sheet */ } else curLayout = null; }
  $('#empty-map').hidden = F.ents.size > 0;
  $$('[data-layout]').forEach(b => { b.classList.toggle('on', b.dataset.layout === S.layout); b.setAttribute('aria-pressed', b.dataset.layout === S.layout); });
  $('#btn-ecolor').textContent = 'Line: ' + (S.ecolor === 'type' ? 'type' : S.ecolor === 'layer' ? 'layer' : 'status'); $('#btn-ecolor').setAttribute('aria-pressed', S.ecolor !== 'status');
  $('#g-maxdeg').value = String(S.maxdeg); if ($('#g-maxdeg').value !== String(S.maxdeg)) { const o = document.createElement('option'); o.value = S.maxdeg; o.textContent = S.maxdeg + ' links'; $('#g-maxdeg').appendChild(o); $('#g-maxdeg').value = String(S.maxdeg); }
  renderFocusBar(); syncOverlapEdges();
  highlightSelection(); highlightSearch();
}
function highlightSelection() {
  if (!cy) return;
  if (LOD_ON && !LOD.inHl) { LOD.inHl = true; try { if (lodSync()) { renderGraph(); return; } } finally { LOD.inHl = false; } }
  cy.batch(() => {
    cy.elements().removeClass('faded sel nb netm netl lead tour');
    const tourSel = typeof tourHighlight === 'function' ? tourHighlight() : null;
    if (tourSel) {
      const mem = new Set(tourSel.entities), ev = new Set(tourSel.links);
      for (const id of ev) { const l = LNK.get(id); if (l) { mem.add(l.from); mem.add(l.to); } }
      if (mem.size) { cy.elements(':visible').addClass('faded'); cy.nodes().filter(x => mem.has(x.id())).removeClass('faded').addClass('tour'); cy.edges().filter(x => ev.has(x.data('lid')) || (tourSel.neighbours && (mem.has(x.data('source')) && mem.has(x.data('target'))))).removeClass('faded').addClass('tour'); }
      highlightPath(); return;
    }
    if (S.node && cy.$id(S.node).length) {
      const n = cy.$id(S.node); const hood = n.closedNeighborhood().filter(':visible');
      cy.elements(':visible').not(hood).addClass('faded'); n.addClass('sel'); hood.edges().addClass('nb'); hood.nodes().addClass('nb');
    } else if (S.link && cy.$id('L:' + S.link).length) {
      const e = cy.$id('L:' + S.link); const keep = e.union(e.connectedNodes());
      cy.elements(':visible').not(keep).addClass('faded'); e.addClass('sel'); e.connectedNodes().addClass('sel');
    } else if (S.net && NET.has(S.net)) {
      const n = NET.get(S.net); const mem = new Set(n.members);
      const ev = new Set(n.auto ? D.links.filter(l => mem.has(l.from) && mem.has(l.to)).map(l => l.id) : n.link_ids);
      cy.elements(':visible').addClass('faded');
      cy.nodes().filter(x => mem.has(x.id())).removeClass('faded').addClass('netm');
      cy.edges().filter(x => ev.has(x.data('lid'))).removeClass('faded').addClass('netl');
    } else if (S.lead && LEAD.has(S.lead)) {
      const L = LEAD.get(S.lead); const ev = new Set(L.link_ids); const mem = new Set(L.entities);
      for (const id of ev) { const l = LNK.get(id); if (l) { mem.add(l.from); mem.add(l.to); } }
      cy.elements(':visible').addClass('faded');
      cy.nodes().filter(x => mem.has(x.id())).removeClass('faded').addClass('lead');
      cy.edges().filter(x => ev.has(x.data('lid'))).removeClass('faded').addClass('lead');
    } else if (S.ov != null && ovAt(S.ov)) {
      const o = ovAt(S.ov); const ev = new Set(o.links); const mem = new Set([o.a, o.b]);
      for (const id of o.links) { const l = LNK.get(id); if (l) { mem.add(l.from); mem.add(l.to); } }
      cy.elements(':visible').addClass('faded');
      cy.nodes().filter(x => mem.has(x.id())).removeClass('faded').addClass('nb');
      cy.$id(o.a).addClass('sel'); cy.$id(o.b).addClass('sel');
      cy.edges().filter(x => ev.has(x.data('lid')) || x.data('ov') === o.i).removeClass('faded').addClass('nb');
    }
    highlightPath();
    if (kbd) { cy.nodes('.kbd').removeClass('kbd'); cy.$id(kbd).addClass('kbd'); }
  });
}
function highlightSearch() {
  if (!cy) return;
  cy.nodes('.hit').removeClass('hit');
  if (!S.q.trim()) return;
  const ids = new Set(); lastResults.forEach(r => { if (r.kind === 'e') ids.add(r.ref); else if (r.kind === 'l') { const l = LNK.get(r.ref); ids.add(l.from); ids.add(l.to); } });
  cy.nodes().filter(n => ids.has(n.id())).addClass('hit');
}
const isMobile = () => window.innerWidth <= 900;
function revealOnMap(eles, zoomTo) {
  if (!cy || S.view !== 'map' || !eles || !eles.length) return;
  // cytoscape's .visible() returns a collection; use .length so a hidden node early-returns
  const vis = eles.filter(':visible');
  if (!vis.length) return;
  const z = zoomTo != null ? zoomTo : Math.max(cy.zoom(), BIG ? 0.85 : 1.1);
  const bb = vis.boundingBox();
  const cx = (bb.x1 + bb.x2) / 2, cyy = (bb.y1 + bb.y2) / 2;
  const rect = $('#cy').getBoundingClientRect();
  let targetY = rect.height / 2;
  if (isMobile() && document.body.classList.contains('panel-open')) {
    // keep the selection visible above the bottom sheet
    // use the sheet's final height (it may still be sliding in)
    const top = window.innerHeight - $('#panel').offsetHeight - rect.top;
    targetY = Math.max(40, top / 2);
  }
  const vp = { zoom: z, pan: { x: rect.width / 2 - cx * z, y: targetY - cyy * z } };
  // Always apply — even a small pan change recentres the selection after clicking a connection.
  // Prefer viewport: cy.animate can no-op/race with update()'s layout on large graphs; mobile+BIG already jumped.
  cy.stop(); cy.viewport(vp);
}
// mobile: the sheet can grow after the pan (lazy sections fill in); re-reveal the selected node if it ends up under the sheet
if (window.ResizeObserver) { let rt = 0; const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => {
  if (!cy || !isMobile() || !document.body.classList.contains('panel-open') || !S.node) return; const n = cy.$id(S.node); if (!n.length || !n.visible()) return;
  const bb = n.renderedBoundingBox(), r = $('#cy').getBoundingClientRect(); const sheet = $('#panel').getBoundingClientRect().top; const y = r.top + (bb.y1 + bb.y2) / 2;
  if (y > sheet - 16 || y < r.top) revealOnMap(n, cy.zoom()); }, 120); }); ro.observe($('#panel')); ro.observe($('#cy')); }
function focusSelection() {
  if (!cy || S.view !== 'map') return;
  if (S.node) revealOnMap(cy.$id(S.node));
  else if (S.link) revealOnMap(cy.$id('L:' + S.link).connectedNodes());
  else if (S.ov != null && ovAt(S.ov)) revealOnMap(cy.$id(ovAt(S.ov).a).union(cy.$id(ovAt(S.ov).b)));
  else if (S.lead && LEAD.has(S.lead)) { const els = cy.elements('.lead:visible'); if (els.length) { cy.stop(); cy.animate({ fit: { eles: els, padding: isMobile() ? 40 : 90 } }, { duration: 280 }); } }
  else if (S.net && NET.has(S.net)) { const mem = new Set(NET.get(S.net).members); const els = cy.nodes(':visible').filter(n => mem.has(n.id())); if (els.length) { cy.stop(); cy.animate({ fit: { eles: els, padding: isMobile() ? 30 : 60 } }, { duration: 280 }); } }
}
function toggleExpand(id) {
  if (!id) return;
  const i = S.expand.indexOf(id); if (i >= 0) S.expand.splice(i, 1); else S.expand.push(id);
  S.node = id; S.link = null; S.net = null; prevVisibleKey = '';
  update(true); announce(S.expand.length ? `Showing connections of ${S.expand.map(name).join(', ')}` : 'Showing the full map');
  setTimeout(() => { if (cy) cy.fit(cy.elements(':visible'), 40); }, 20);
}
function renderFocusBar() {
  const b = $('#focus-bar'); b.hidden = !S.expand.length && !S.maxdeg;
  const parts = [];
  if (S.expand.length) parts.push(`<span>Focus on connections of</span>${S.expand.map(id => `<button class="tag" data-unexpand="${esc(id)}" aria-label="Remove ${esc(name(id))} from focus">${esc(name(id))} ✕</button>`).join('')}<button class="linkish" data-clear-expand>show full map</button>`);
  if (S.maxdeg) { const hid = D.entities.filter(e => e.degree > S.maxdeg && e.id !== S.node && !S.expand.includes(e.id)).length; parts.push(`<span>${hid} hub(s) with more than ${S.maxdeg} links hidden</span><button class="linkish" data-clear-maxdeg>show hubs</button>`); }
  b.innerHTML = parts.join('<span class="sep">·</span>');
}
$('#focus-bar').addEventListener('click', e => {
  const u = e.target.closest('[data-unexpand]'); if (u) { S.expand = S.expand.filter(x => x !== u.dataset.unexpand); prevVisibleKey = ''; return update(true); }
  if (e.target.closest('[data-clear-expand]')) { S.expand = []; prevVisibleKey = ''; return update(true); }
  if (e.target.closest('[data-clear-maxdeg]')) { S.maxdeg = 0; return update(true); }
});
$$('[data-layout]').forEach(b => b.addEventListener('click', () => { S.layout = b.dataset.layout; prevVisibleKey = ''; update(); }));
$('#btn-names').addEventListener('click', e => { const on = !e.currentTarget.classList.contains('on'); e.currentTarget.classList.toggle('on', on); e.currentTarget.setAttribute('aria-pressed', on); LOD.nolabel = !on; cy.nodes().toggleClass('nolabel', !on); });
$('#btn-ecolor').addEventListener('click', () => { S.ecolor = S.ecolor === 'status' ? 'type' : S.ecolor === 'type' ? 'layer' : 'status'; update(); renderLegend(); });
$('#g-maxdeg').addEventListener('change', e => { S.maxdeg = +e.target.value; update(); });
const zoomBy = f => cy.zoom({ level: cy.zoom() * f, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
$('#zoom-in').addEventListener('click', () => zoomBy(1.25));
$('#zoom-out').addEventListener('click', () => zoomBy(0.8));
$('#zoom-fit').addEventListener('click', () => cy.fit(cy.elements(':visible'), 30));

// ---- keyboard navigation inside the graph (role=application)
const KEYS = [['Tab', 'move focus between search, filters, map and details'], ['/', 'jump to search'], ['← ↑ → ↓', 'map: move to the nearest node in that direction'], ['Enter / Space', 'map: open the highlighted node'], ['E', 'map: expand / collapse its connections'], ['F', 'follow the money through the selected entity'], ['+ / − / 0', 'map: zoom in / out / fit'], ['N', 'map: next search hit'], ['Esc', 'clear selection, focus or search']];
function nearestInDirection(fromId, dx, dy) {
  const vis = cy.nodes(':visible'); if (!vis.length) return null;
  const from = fromId && cy.$id(fromId).length && cy.$id(fromId).visible() ? cy.$id(fromId) : null;
  if (!from) { // start at the most connected visible node nearest the centre
    const ext = cy.extent(); const inView = vis.filter(n => { const p = n.position(); return p.x > ext.x1 && p.x < ext.x2 && p.y > ext.y1 && p.y < ext.y2; });
    return (inView.length ? inView : vis).max(n => ENT.get(n.id()).degree).ele.id();
  }
  const p = from.position(); let best = null, bs = Infinity;
  vis.forEach(n => { if (n === from) return; const q = n.position(); const vx = q.x - p.x, vy = q.y - p.y; const along = vx * dx + vy * dy; if (along <= 0) return; const perp = Math.abs(vx * dy - vy * dx); const s = along + perp * 2.5; if (s < bs) { bs = s; best = n; } });
  return best ? best.id() : null;
}
function setKbd(id) { if (!id) return; kbd = id; highlightSelection(); const e = ENT.get(id); $('#cy-status').textContent = `${e.name}, ${TYPE[e.type].label}, ${e.degree} connections. Enter to open.`; const n = cy.$id(id); const rp = n.renderedPosition(); if (rp.x < 30 || rp.y < 30 || rp.x > cy.width() - 30 || rp.y > cy.height() - 30) revealOnMap(n, cy.zoom()); }
$('#cy').addEventListener('keydown', e => {
  if (!cy || e.altKey || e.ctrlKey || e.metaKey) return;
  const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (dirs[e.key]) { e.preventDefault(); setKbd(nearestInDirection(kbd || S.node, ...dirs[e.key])); return; }
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const id = kbd || nearestInDirection(null); if (id) { kbd = id; select({ node: id }); } return; }
  if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1.25); return; }
  if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(0.8); return; }
  if (e.key === '0') { e.preventDefault(); cy.fit(cy.elements(':visible'), 30); return; }
  if (e.key === 'e' || e.key === 'E') { e.preventDefault(); toggleExpand(kbd || S.node); return; }
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); const hits = cy.nodes('.hit:visible').map(n => n.id()); if (hits.length) setKbd(hits[(hits.indexOf(kbd) + 1) % hits.length]); else announce('No search hits on the map'); return; }
});
$('#cy').addEventListener('focus', () => { if (!kbd && cy) { const id = S.node || nearestInDirection(null); if (id) setKbd(id); } });

// ---- 30-money.js
/* follow the money: layered sankey of money links (estimates/budgets excluded unless toggled) */
const SVGNS = 'http://www.w3.org/2000/svg';
function moneyLinks() {
  let ls = F.links.filter(l => l.amount_cad > 0 && catOf(l) === 'money' && (S.est || !isEst(l)) && l.amount_cad >= S.min && l.from !== l.to);
  if (S.mfocus && S.node) {
    // everything upstream and downstream of the selected entity
    const up = new Set([S.node]), down = new Set([S.node]); let grew = true;
    while (grew) { grew = false; for (const l of ls) { if (down.has(l.from) && !down.has(l.to)) { down.add(l.to); grew = true; } if (up.has(l.to) && !up.has(l.from)) { up.add(l.from); grew = true; } } }
    ls = ls.filter(l => (down.has(l.from) && down.has(l.to)) || (up.has(l.from) && up.has(l.to)));
  }
  ls.sort((a, b) => b.amount_cad - a.amount_cad);
  if (S.top) ls = ls.slice(0, S.top);
  return ls;
}
function renderMoney() {
  const svg = $('#sankey'); const ls = moneyLinks();
  const flows = ls.filter(isFlow), ests = ls.filter(isEst);
  const total = flows.filter(isFlowTotal).reduce((s, l) => s + l.amount_cad, 0), estT = ests.reduce((s, l) => s + l.amount_cad, 0);
  const hiddenEst = F.links.filter(l => isEst(l)).length;
  $('#m-summary').textContent = `${ls.length} flows · ${fmtCAD(total) || '$0'} recorded${S.est && estT ? ` · ${fmtCAD(estT)} estimates/budgets shown separately` : ''}`;
  $('#m-note').innerHTML = !S.est && hiddenEst ? `<span class="est">Estimate</span> ${hiddenEst} estimate/budget link${hiddenEst > 1 ? 's are' : ' is'} excluded (not money that changed hands). Tick <em>include estimates &amp; budgets</em> to show ${hiddenEst > 1 ? 'them' : 'it'} hatched.` : S.est && ests.length ? '<span class="est">Estimate</span> Hatched flows are estimates or budgets. They are not counted in the recorded total.' : '';
  $('#m-min').value = String(S.min); $('#m-top').value = String(S.top); $('#m-focus').checked = S.mfocus; $('#m-focus').disabled = !S.node;
  $('#empty-money').hidden = ls.length > 0; svg.style.display = ls.length ? '' : 'none';
  if (!ls.length) { svg.innerHTML = ''; return; }
  // columns by longest path from sources (cycle-safe)
  const nodes = new Map(); const nd = id => nodes.get(id) || nodes.set(id, { id, in: 0, out: 0, col: 0, ins: [], outs: [] }).get(id);
  for (const l of ls) { nd(l.from).out += l.amount_cad; nd(l.to).in += l.amount_cad; nd(l.from).outs.push(l); nd(l.to).ins.push(l); }
  for (let it = 0; it < 8; it++) { let ch = false; for (const l of ls) { const a = nodes.get(l.from), b = nodes.get(l.to); if (b.col < a.col + 1 && a.col < 6) { b.col = a.col + 1; ch = true; } } if (!ch) break; }
  const cols = Math.max(...[...nodes.values()].map(n => n.col)) + 1;
  const byCol = Array.from({ length: cols }, () => []); for (const n of nodes.values()) byCol[n.col].push(n);
  const val = n => Math.max(n.in, n.out); const W = Math.max(svg.parentElement.clientWidth - 20, 300 * Math.min(cols, 4)); const gap = 10;
  const maxN = Math.max(...byCol.map(c => c.length)); const H = Math.max(420, maxN * 34);
  const scale = Math.min(...byCol.map(c => (H - gap * (c.length - 1)) / Math.max(1, c.reduce((s, n) => s + Math.sqrt(val(n)), 0))));
  const hOf = n => Math.max(3, Math.sqrt(val(n)) * scale);
  const nodeW = 12, colX = i => (cols === 1 ? 40 : 30 + i * ((W - 260) / (cols - 1)));
  for (const c of byCol) { c.sort((a, b) => val(b) - val(a)); let y = 10; for (const n of c) { n.x = colX(n.col); n.y = y; n.h = hOf(n); y += n.h + gap; } }
  const lw = l => Math.max(1.2, (Math.sqrt(l.amount_cad) / Math.sqrt(Math.max(1, val(nodes.get(l.from))))) * nodes.get(l.from).h);
  for (const n of nodes.values()) { n.outs.sort((a, b) => nodes.get(a.to).y - nodes.get(b.to).y); n.ins.sort((a, b) => nodes.get(a.from).y - nodes.get(b.from).y); let o = 0; for (const l of n.outs) { l._sy = n.y + o + lw(l) / 2; o += lw(l); } let i = 0; for (const l of n.ins) { l._ty = n.y + i + Math.min(lw(l), n.h) / 2; i += Math.min(lw(l), n.h); } }
  svg.setAttribute('width', W); svg.setAttribute('height', H + 30); svg.setAttribute('viewBox', `0 0 ${W} ${H + 30}`);
  const sel = S.node;
  const paths = ls.map(l => { const a = nodes.get(l.from), b = nodes.get(l.to); const x0 = a.x + nodeW, x1 = b.x, mx = (x0 + x1) / 2; const st = STATUS[l.status]; const on = !sel || l.from === sel || l.to === sel;
    return `<path class="flow${isEst(l) ? ' est' : ''}${S.link === l.id ? ' sel' : ''}" d="M${x0},${l._sy} C${mx},${l._sy} ${mx},${l._ty} ${x1},${l._ty}" stroke="${isEst(l) ? 'url(#hatch)' : st.color}" stroke-width="${lw(l)}" ${st.dash && lw(l) < 10 ? `stroke-dasharray="${st.dash.join(' ')}"` : ''} opacity="${on ? 0.6 : 0.12}" data-link="${esc(l.id)}" tabindex="0" role="button" aria-label="${esc(`${name(l.from)} to ${name(l.to)}, ${fmtCADfull(l.amount_cad)}${isEst(l) ? ', estimate' : ''}, ${statusLabel(l.status, itemLayers(l)[0])}`)}"><title>${esc(`${name(l.from)} → ${name(l.to)}: ${fmtCADfull(l.amount_cad)}${isEst(l) ? ' (estimate/budget)' : ''} · ${statusLabel(l.status, itemLayers(l)[0])}`)}</title></path>`; }).join('');
  const rects = [...nodes.values()].map(n => { const e = ENT.get(n.id); const right = n.col === cols - 1 && cols > 1; return `<g class="mnode${sel === n.id ? ' sel' : ''}" data-node="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(e.name)}"><rect x="${n.x}" y="${n.y}" width="${nodeW}" height="${n.h}" fill="${TYPE[e.type].color}"/><text x="${right ? n.x - 6 : n.x + nodeW + 6}" y="${n.y + n.h / 2}" dy="0.35em" text-anchor="${right ? 'end' : 'start'}">${esc(e.name.length > 34 ? e.name.slice(0, 33) + '…' : e.name)} <tspan class="mv">${fmtCAD(val(n))}</tspan></text></g>`; }).join('');
  svg.innerHTML = `<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#4a4520"/><line x1="0" y1="0" x2="0" y2="6" stroke="#F0E442" stroke-width="2.5"/></pattern></defs>${paths}${rects}`;
}
$('#sankey').addEventListener('click', e => { const p = e.target.closest('[data-link]'); if (p) return select({ link: p.dataset.link }); const n = e.target.closest('[data-node]'); if (n) select({ node: n.dataset.node }); });
$('#sankey').addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; const t = e.target.closest('[data-link],[data-node]'); if (!t) return; e.preventDefault(); t.dataset.link ? select({ link: t.dataset.link }) : select({ node: t.dataset.node }); });
$('#m-min').addEventListener('change', e => { S.min = +e.target.value; update(); });
$('#m-top').addEventListener('change', e => { S.top = +e.target.value; update(); });
$('#m-focus').addEventListener('change', e => { S.mfocus = e.target.checked; update(); });

// ---- 40-timeline.js
/* timeline: lanes of dated claims (by relationship or status), zoomable; plus a keyboard-friendly list */
let tlWin = null, tlShown = 100;
function renderTimeline() {
  const basis = S.basis; const ls = F.links.filter(l => l._iv[basis]).sort((a, b) => a._iv[basis][0] - b._iv[basis][0]);
  // Events lane: event nodes with their own date (date or date_start–date_end), after the type and date filters
  const evs = D.entities.filter(e => e.type === 'event' && F.ents.has(e.id) && e._iv && Math.abs(e._iv[0]) < 1e8 && Math.abs(e._iv[1]) < 1e8).sort((a, b) => a._iv[0] - b._iv[0]);
  $('#t-group').value = S.tlgroup; $('#t-summary').textContent = `${ls.length} dated claims${evs.length ? ` · ${evs.length} event${evs.length === 1 ? '' : 's'}` : ''}${F.links.length - ls.length ? ` · ${F.links.length - ls.length} undated not shown` : ''}`;
  const any = ls.length + evs.length > 0; $('#empty-tl').hidden = any; $('#tl-wrap').hidden = !any;
  const svg = $('#tl');
  if (any) {
    const xs = evs.filter(e => e._xiv && Math.abs(e._xiv[0]) < 1e8); const d0 = Math.min(...ls.map(l => l._iv[basis][0]), ...evs.map(e => e._iv[0]), ...xs.map(e => e._xiv[0])), d1 = Math.max(...ls.map(l => l._iv[basis][1]), ...evs.map(e => e._iv[1]), ...xs.map(e => e._xiv[1])) + 1;
    if (!tlWin || tlWin.d0 !== d0 || tlWin.d1 !== d1) tlWin = { d0, d1, a: d0 - 15, b: d1 + 15 };
    const lanesKey = S.tlgroup === 'status' ? l => l.status : l => catOf(l);
    const lanes = (S.tlgroup === 'status' ? STATUS_KEYS : CAT_KEYS).filter(k => ls.some(l => lanesKey(l) === k)); if (evs.length) lanes.unshift('__events');
    const EVC = TYPE.event ? TYPE.event.color : '#00C2C7'; const W = Math.max(600, svg.parentElement.clientWidth - 10), L = 120, laneH = 46, H = lanes.length * laneH + 40;
    const x = d => L + ((d - tlWin.a) / (tlWin.b - tlWin.a)) * (W - L - 20);
    const span = tlWin.b - tlWin.a; const yrs = []; const y0 = new Date(tlWin.a * DAY).getUTCFullYear(), y1 = new Date(tlWin.b * DAY).getUTCFullYear();
    const step = span > 365 * 25 ? 5 : span > 365 * 10 ? 2 : 1;
    for (let y = y0; y <= y1; y++) if (y % step === 0) yrs.push(y);
    const ticks = span < 365 * 2 ? (() => { const t = []; for (let y = y0; y <= y1; y++) for (let m = 0; m < 12; m++) { const d = Date.UTC(y, m, 1) / DAY; if (d >= tlWin.a && d <= tlWin.b) t.push([d, m === 0 ? String(y) : new Date(d * DAY).toLocaleString('en-CA', { month: 'short', timeZone: 'UTC' })]); } return t; })() : yrs.map(y => [Date.UTC(y, 0, 1) / DAY, String(y)]);
    const stack = {};
    const marks = ls.map(l => { const iv = l._iv[basis]; const li = lanes.indexOf(lanesKey(l)); const xa = x(iv[0]), xb = Math.max(xa + 3, x(iv[1] + 1)); if (xb < L || xa > W) return ''; const k = li + ':' + Math.round(xa / 6); const off = (stack[k] = (stack[k] || 0) + 1) - 1; const yy = 30 + li * laneH + 6 + (off % 5) * 7; const st = STATUS[l.status];
      const col = S.tlgroup === 'status' ? LINK_CATS[catOf(l)].color : st.color;
      return iv[2] === 'day' ? `<circle cx="${xa}" cy="${yy + 3}" r="4" fill="${col}" class="tm${S.link === l.id ? ' sel' : ''}" data-link="${esc(l.id)}"><title>${esc(`${l.date || l.reported} · ${name(l.from)} → ${LT(l.type).label} → ${name(l.to)}${l.amount_cad ? ' · ' + fmtCAD(l.amount_cad) : ''}`)}</title></circle>` : `<rect x="${xa}" y="${yy}" width="${xb - xa}" height="6" rx="2" fill="${col}" opacity="0.55" class="tm${S.link === l.id ? ' sel' : ''}" data-link="${esc(l.id)}"><title>${esc(`${iv[2]} precision: ${l.date || l.reported} · ${name(l.from)} → ${LT(l.type).label} → ${name(l.to)}`)}</title></rect>`; }).join('');
    const evStack = {}; const evMarks = evs.map(e => { const iv = e._iv; const xa = x(iv[0]), xb = Math.max(xa + 3, x(iv[1] + 1)); if (xb < L || xa > W) return ''; const k = Math.round(xa / 8); const off = (evStack[k] = (evStack[k] || 0) + 1) - 1; const yy = 30 + 6 + (off % 5) * 7; const t = `<title>${esc(`${evDate(e)} · Event: ${e.name}${e.place ? ' · ' + e.place : ''}`)}</title>`;
      return xb - xa > 8 ? `<rect x="${xa}" y="${yy}" width="${xb - xa}" height="6" rx="3" ${isStoppedEv(e) ? `fill="${EVC}" fill-opacity="0.12" stroke="${EVC}" stroke-width="1.3" stroke-dasharray="2 1.5"` : `fill="${EVC}"`} class="tm ev${isStoppedEv(e) ? ' ev-stopped' : ''}${S.node === e.id ? ' sel' : ''}" data-node="${esc(e.id)}">${t}</rect>` : `<path d="M${xa} ${yy - 2} l2.4 4.6 5 .7 -3.6 3.5 .9 5 -4.7 -2.4 -4.7 2.4 .9 -5 -3.6 -3.5 5 -.7z" ${isStoppedEv(e) ? `fill="${EVC}" fill-opacity="0.12" stroke="${EVC}" stroke-width="1.3" stroke-dasharray="2 1.5"` : `fill="${EVC}"`} class="tm ev${isStoppedEv(e) ? ' ev-stopped' : ''}${S.node === e.id ? ' sel' : ''}" data-node="${esc(e.id)}">${t}</path>`; }).join('');
    // v1.8: dashed marker at the expected date, joined by a dashed line to the reported (actual / blocked) date
    const expMarks = xs.map(e => { const xe = x(e._xiv[0]); const same = e._iv === e._xiv; const xa = x(e._iv[0]); const yy = 30 + laneH - 12; const t = `<title>${esc(`Expected ${xDate(e.expected)} · ${e.name}${isStoppedEv(e) ? ' · ' + ((EV_STATUS[e.event_status] || {}).badge || '') : ''}`)}</title>`;
      return `<g class="tm-exp" data-node="${esc(e.id)}" data-expected-mark>${same ? '' : `<line x1="${xe}" x2="${xa}" y1="${yy}" y2="${yy}" stroke="${EVC}" stroke-width="1.5" stroke-dasharray="3 3"/>`}<circle cx="${xe}" cy="${yy}" r="4.5" fill="none" stroke="${EVC}" stroke-width="1.5" stroke-dasharray="2 2">${t}</circle>${same ? '' : `<circle cx="${xa}" cy="${yy}" r="2.5" fill="${EVC}"/>`}</g>`; }).join('');
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = lanes.map((k, i) => `<g><rect x="0" y="${30 + i * laneH}" width="${W}" height="${laneH - 4}" class="lane"/><text x="8" y="${30 + i * laneH + 26}" class="lane-l">${esc(k === '__events' ? 'Events' : S.tlgroup === 'status' ? STATUS[k].short : LINK_CATS[k].label)}</text></g>`).join('') +
      ticks.map(([d, t]) => `<g><line x1="${x(d)}" x2="${x(d)}" y1="20" y2="${H}" class="tick"/><text x="${x(d) + 3}" y="14" class="tick-l">${esc(t)}</text></g>`).join('') + marks + evMarks + expMarks;
  }
  const list = [...ls].reverse();
  $('#tl-list').innerHTML = [...evs].reverse().slice(0, tlShown).map(e => `<li class="tl-ev"><button type="button" class="linkish" data-node="${esc(e.id)}"><span class="tl-d">${esc(evDate(e) || (e.expected && xDate(e.expected) ? 'exp. ' + xDate(e.expected) : ''))}</span> <span class="kindtag">Event</span> ${evStatusBadge(e)} ${esc(e.name)}${e._xiv && e._xiv !== e._iv ? ` <span class="muted small">· expected ${esc(xDate(e.expected))}</span>` : ''}${e.place ? ` <span class="muted">· ${esc(e.place)}</span>` : ''}</button></li>`).join('') + list.slice(0, tlShown).map(l => `<li><button type="button" class="linkish" data-link="${esc(l.id)}"><span class="tl-d">${esc(basis === 'reported' ? l.reported : l.date)}</span> ${esc(name(l.from))} <span class="verb">${esc(LT(l.type).label)}</span> ${esc(name(l.to))}${l.amount_cad ? ` <span class="amt">${fmtCAD(l.amount_cad)}</span>` : ''}</button> ${estTag(l)} ${lbadge(l)}</li>`).join('');
  $('#tl-more').hidden = list.length <= tlShown && evs.length <= tlShown; // v1.9: events paged with links
}
const tlZoom = f => { if (!tlWin) return; const c = (tlWin.a + tlWin.b) / 2, h = ((tlWin.b - tlWin.a) / 2) * f; tlWin.a = c - Math.max(15, h); tlWin.b = c + Math.max(15, h); renderTimeline(); };
$('#t-zin').addEventListener('click', () => tlZoom(0.6)); $('#t-zout').addEventListener('click', () => tlZoom(1.6));
$('#t-zfit').addEventListener('click', () => { tlWin = null; renderTimeline(); });
$('#t-group').addEventListener('change', e => { S.tlgroup = e.target.value; update(); });
$('#tl-more').addEventListener('click', () => { tlShown += 200; renderTimeline(); });
$('#view-timeline').addEventListener('click', e => { const t = e.target.closest('[data-link]'); if (t) return select({ link: t.dataset.link }); const n = e.target.closest('[data-node]'); if (n) select({ node: n.dataset.node }); });
$('#tl').addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); tlZoom(e.deltaY < 0 ? 0.8 : 1.25); }, { passive: false });

// ---- 45-overlaps.js
/* overlaps: derived connections (NOT claims), overlaps view, profile section, graph overlay, path finder */
function ovVisible(o) {
  if (!S.ovtypes.has(o.type) || !F || !F.ents.has(o.a) || !F.ents.has(o.b)) return false;
  if (!o.links.length) return true;
  return o.links.some(id => F.linkSet.has(id));
}
function visibleOverlaps() { return OVS.filter(ovVisible); }
const viaLabel = (o, v) => ENT.has(v) ? entBtn(v) : NET.has(v) ? `<button type="button" class="linkish" data-net="${esc(v)}">${esc(NET.get(v).name)}</button>` : /^https?:/.test(v) ? (() => { const s = [...SRC.values()].find(x => x.url === v); return `<a href="${esc(v)}" target="_blank" rel="noopener noreferrer">${esc((s && s.title) || v.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60))}</a>`; })() : o.type === 'money_path' ? v.split('>').map(entBtn).join(' → ') : o.type === 'same_place' ? esc(provName(v)) : esc(v);
function ovSummary(o) {
  const T = OV_TYPES[o.type] || { label: o.type };
  const vias = o.via.slice(0, 3).map(v => viaLabel(o, v)).join(', ') + (o.via.length > 3 ? ` +${o.via.length - 3} more` : '');
  const kind = o.kinds && o.kinds.length ? ` <span class="kindtag">${esc(o.kinds.join(', '))}</span>` : '';
  if (o.type === 'shared_funder') return `${T.label}${kind}: both funded by ${vias}`;
  if (o.type === 'shared_recipient') return `${T.label}: both paid ${vias}`;
  if (o.type === 'shared_people') return `${T.label}${kind}: ${vias}`;
  if (o.type === 'money_path') return `${T.label} (${o.hops} hops) via ${vias}`;
  if (o.type === 'co_network') return `${T.label}: ${vias}`;
  if (o.type === 'co_cited') return `${T.label} in ${o.via.length} source${o.via.length > 1 ? 's' : ''}: ${vias}`;
  if (o.type === 'same_place') return `${T.label}: ${vias}`;
  return T.label;
}
function ovRow(o, focusId) {
  const pair = focusId ? entBtn(o.a === focusId ? o.b : o.a) : `${entBtn(o.a)} ↔ ${entBtn(o.b)}`;
  return `<li class="ov" data-type="${esc(o.type)}"><div class="ov-main"><span class="ov-ic" aria-hidden="true">⋯</span>${pair} <span class="muted">· ${ovSummary(o)}</span></div>
    <div class="ov-meta"><span class="muted">strength ${o.strength}</span>${o.total ? ` · <span class="muted">evidence links total ${fmtCAD(o.total)} (not an extra total)</span>` : ''} · <button type="button" class="linkish small" data-ov="${o.i}">${o.links.length} evidence link${o.links.length === 1 ? '' : 's'}</button></div></li>`;
}
function ovSection(id) {
  const list = (OV_BY.get(id) || []).filter(ovVisible).sort((a, b) => b.strength - a.strength);
  if (!list.length) return '<p class="muted small">No overlaps found with the current filters.</p>';
  const by = {}; for (const o of list) (by[o.type] = by[o.type] || []).push(o);
  return `<p class="ov-tag">${esc(OV_NOTE)}. The sourced links behind each one keep their own badges.</p>` + OV_TYPE_KEYS.filter(t => by[t]).map(t => `<h4 class="cat-h">${esc(OV_TYPES[t].label)} <span class="muted">${by[t].length}</span></h4><ul class="ovs">${by[t].slice(0, 12).map(o => ovRow(o, id)).join('')}${by[t].length > 12 ? `<li class="muted small">+${by[t].length - 12} more in the Overlaps view</li>` : ''}</ul>`).join('');
}
function renderOverlap(o) {
  const T = OV_TYPES[o.type] || { label: o.type, desc: '' };
  const ev = o.links.map(id => LNK.get(id)).filter(Boolean);
  return `<div class="ov-banner" role="note"><b>${esc(OV_NOTE)}.</b> No status badge applies. The claims below are the evidence, each with its own badge.</div>
    <div class="p-head"><div class="p-type"><span class="kindtag">${esc(T.label)}</span>${o.kinds && o.kinds.length ? ` <span class="kindtag">${esc(o.kinds.join(', '))}</span>` : ''} <span class="muted">strength ${o.strength}</span></div><h1 class="p-name small-h">${entBtn(o.a)} ↔ ${entBtn(o.b)}</h1></div>
    <p class="small muted">${esc(T.desc)}</p><p>${ovSummary(o)}</p>
    ${o.total ? `<p class="small">The evidence links add up to <b class="amt">${fmtCAD(o.total)}</b>. That figure is already counted in each link and is not an extra total.</p>` : ''}
    ${panelSection('Evidence: sourced claims', ev.length ? `<ul class="claims">${ev.map(l => claimRow(l)).join('')}</ul>` : '<p class="muted small">No single claim links them. This overlap comes from shared sources or a shared place.</p>', true, ev.length)}
    ${o.sources && o.sources.length ? panelSection('Source URLs', `<ul class="srcs">${o.sources.map(u => srcLink([...SRC.values()].find(s => s.url === u) || { url: u })).join('')}</ul>`, false, o.sources.length) : ''}
    <div class="p-actions"><button type="button" class="btn sm" data-path-a="${esc(o.a)}" data-path-b="${esc(o.b)}">Shortest path between them</button></div>`;
}
$('#panel').addEventListener('click', e => { const b = e.target.closest('[data-path-a]'); if (!b) return; S.pa = b.dataset.pathA; S.pb = b.dataset.pathB; setView('overlaps'); });

// ---- overlaps view
let oShown = 60;
function renderOverlapsView() {
  if (!EXTRA.loaded.overlaps) { $('#o-list').innerHTML = loadingNote('overlaps'); loadExtra('overlaps'); renderCrossLayer(); renderPathFinder(); return; }
  if (!renderOverlapsView._built) {
    renderOverlapsView._built = true;
    const cnt = {}; OVS.forEach(o => (cnt[o.type] = (cnt[o.type] || 0) + 1));
    $('#o-types').innerHTML = OV_TYPE_KEYS.map(t => chip(OV_TYPES[t].label, null, true, `data-ovt="${t}" title="${esc(OV_TYPES[t].desc)}"`, cnt[t] || 0)).join('');
    $('#pf-names').innerHTML = D.entities.length <= 5000 ? D.entities.map(e => `<option value="${esc(e.name)}">`).join('') : '';
  }
  $$('#o-types [data-ovt]').forEach(b => b.setAttribute('aria-pressed', S.ovtypes.has(b.dataset.ovt)));
  $('#o-sort').value = S.ovsort;
  const vis = visibleOverlaps();
  let html;
  if (S.ovsort === 'layers') {
    const rows = crossLayerRows();
    $('#o-summary').textContent = `${rows.length} items seen in 2 or more layers`;
    html = rows.length ? `<ol class="ovs ranked">${rows.slice(0, oShown).map(crossRow).join('')}</ol>` : '<div class="empty-inline">No entity or claim is seen in more than one source layer with the current filters.</div>';
    $('#o-more').hidden = rows.length <= oShown;
  } else if (S.ovsort === 'partners') {
    const part = new Map(); for (const o of vis) for (const [x, y] of [[o.a, o.b], [o.b, o.a]]) { let m = part.get(x); if (!m) part.set(x, (m = { set: new Set(), types: new Set(), s: 0 })); m.set.add(y); m.types.add(o.type); m.s += o.strength; }
    const rows = [...part].sort((a, b) => b[1].set.size - a[1].set.size || b[1].s - a[1].s);
    $('#o-summary').textContent = `${rows.length} entities with overlaps`;
    html = `<table class="index-table"><thead><tr><th>Entity</th><th>Overlap partners</th><th>Types</th><th>Total strength</th></tr></thead><tbody>${rows.slice(0, oShown).map(([id, m]) => `<tr><td>${entBtn(id)}</td><td>${m.set.size}</td><td class="small">${[...m.types].map(t => esc(OV_TYPES[t]?.label || t)).join(', ')}</td><td>${Math.round(m.s * 10) / 10}</td></tr>`).join('')}</tbody></table>`;
    $('#o-more').hidden = rows.length <= oShown;
  } else {
    $('#o-summary').textContent = `${vis.length} of ${OVS.length} overlaps match the filters`;
    html = vis.length ? `<ol class="ovs ranked">${vis.slice(0, oShown).map(o => ovRow(o)).join('')}</ol>` : '<div class="empty-inline">No overlaps match these filters. <button class="linkish" data-reset>Reset filters</button></div>';
    $('#o-more').hidden = vis.length <= oShown;
  }
  $('#o-list').innerHTML = html;
  renderCrossLayer();
  renderPathFinder();
}
$('#o-types').addEventListener('click', e => { const b = e.target.closest('[data-ovt]'); if (!b) return; toggleIn(S.ovtypes, b.dataset.ovt, OV_TYPE_KEYS); oShown = 60; update(); });
$('#o-sort').addEventListener('change', e => { S.ovsort = e.target.value; oShown = 60; update(); });
$('#o-more').addEventListener('click', () => { oShown += 100; renderOverlapsView(); });
$('#view-overlaps').addEventListener('click', e => {
  const t = e.target.closest('[data-node],[data-link],[data-ov],[data-net]'); if (!t || t.closest('.pathfinder .pf-row')) return;
  if (t.dataset.node) select({ node: t.dataset.node }); else if (t.dataset.link) select({ link: t.dataset.link }); else if (t.dataset.ov != null) select({ ov: +t.dataset.ov }); else if (t.dataset.net) selectNet(t.dataset.net);
});

// ---- path finder (BFS over the currently filtered, sourced links; undirected)
function shortestPaths(fromId, toId, links, max = 5, maxDepth = 8) {
  const adj = new Map(); for (const l of links) for (const [a, b] of [[l.from, l.to], [l.to, l.from]]) { let x = adj.get(a); if (!x) adj.set(a, (x = [])); x.push([b, l.id]); }
  const dist = new Map([[fromId, 0]]), par = new Map(), q = [fromId];
  for (let qi = 0; qi < q.length; qi++) { const u = q[qi], d = dist.get(u); if (u === toId || d >= maxDepth) continue; for (const [v, lid] of adj.get(u) || []) { if (!dist.has(v)) { dist.set(v, d + 1); par.set(v, [[u, lid]]); q.push(v); } else if (dist.get(v) === d + 1) par.get(v).push([u, lid]); } }
  if (fromId === toId || !dist.has(toId)) return [];
  const out = []; const rec = (v, acc, nodes) => { if (out.length >= max) return; if (v === fromId) { out.push({ links: acc.slice().reverse(), nodes: [fromId, ...nodes.slice().reverse()] }); return; } for (const [u, lid] of par.get(v)) rec(u, [...acc, lid], [...nodes, v]); };
  rec(toId, [], []); return out;
}
let PATHS = [];
const findEnt = v => { if (!v) return null; if (ENT.has(v)) return v; const lv = v.trim().toLowerCase(); const e = D.entities.find(x => x.name.toLowerCase() === lv) || D.entities.find(x => x.aliases.some(a => a.toLowerCase() === lv)); if (e) return e.id; const r = runSearch(v, 5).find(r => r.kind === 'e'); return r ? r.ref : null; };
function renderPathFinder() {
  if (document.activeElement !== $('#pf-a')) $('#pf-a').value = S.pa ? name(S.pa) : '';
  if (document.activeElement !== $('#pf-b')) $('#pf-b').value = S.pb ? name(S.pb) : '';
  $('#pf-clear').hidden = !S.pa && !S.pb;
  const out = $('#pf-out');
  if (!S.pa || !S.pb) { PATHS = []; out.innerHTML = '<p class="help">Pick two entities. The finder uses only sourced links that pass the current filters, and ignores link direction.</p>'; return; }
  $('#pf-mvia').checked = !!S.mvia;
  if (S.mvia) { const MP = moneyPaths(S.pa, S.pb, F.links, 5); PATHS = MP; out.innerHTML = moneyPathsHtml(MP, S.pa, S.pb); return; }
  PATHS = shortestPaths(S.pa, S.pb, F.links);
  if (!PATHS.length) { const all = shortestPaths(S.pa, S.pb, D.links, 1); out.innerHTML = `<p class="muted">No path between <b>${esc(name(S.pa))}</b> and <b>${esc(name(S.pb))}</b> with the current filters.${all.length ? ` A ${all[0].links.length}-step path exists with all filters off. <button class="linkish" data-reset>Reset filters</button>` : ' They are not connected in the data.'}</p>`; return; }
  out.innerHTML = `<p><b>${PATHS[0].links.length} step${PATHS[0].links.length > 1 ? 's' : ''}</b> · ${PATHS.length}${PATHS.length === 5 ? '+' : ''} shortest path${PATHS.length > 1 ? 's' : ''} <button type="button" class="btn sm" id="pf-map">Show on map</button></p>` + PATHS.map((p, i) => `<ol class="path" aria-label="Path ${i + 1}">${p.links.map((lid, j) => { const l = LNK.get(lid); const a = p.nodes[j], b = p.nodes[j + 1]; const fwd = l.from === a; return `<li>${entBtn(a)} <span class="verb">${esc(fwd ? LT(l.type).label : LT(l.type).inverse)}</span> ${entBtn(b)} ${l.amount_cad > 0 ? `<span class="amt">${fmtCAD(l.amount_cad)}</span> ${estTag(l)}` : ''} ${lbadge(l)} ${layerChips(l)} <button type="button" class="linkish small" data-link="${esc(lid)}">claim</button></li>`; }).join('')}</ol>`).join('');
}
function setPathEnd(which, v) { const id = findEnt(v); if (v && !id) { toast('No entity matches “' + v + '”'); return; } S[which] = id; update(); }
$('#pf-a').addEventListener('change', e => setPathEnd('pa', e.target.value));
$('#pf-b').addEventListener('change', e => setPathEnd('pb', e.target.value));
$('#pf-go').addEventListener('click', () => { S.pa = findEnt($('#pf-a').value); S.pb = findEnt($('#pf-b').value); if (!S.pa || !S.pb) toast('Pick two entities'); update(); });
$('#pf-swap').addEventListener('click', () => { [S.pa, S.pb] = [S.pb, S.pa]; update(); });
$('#pf-clear').addEventListener('click', () => { S.pa = S.pb = null; update(); });
for (const id of ['#pf-a', '#pf-b']) $(id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#pf-go').click(); } });
$('#pf-out').addEventListener('click', e => { if (e.target.id === 'pf-map') { setView('map'); setTimeout(() => { if (!cy) return; const els = cy.elements('.path'); if (els.length) cy.animate({ fit: { eles: els, padding: 60 } }, { duration: 280 }); }, 40); } });

// ---- graph overlay: thin dotted grey edges (optional)
function syncOverlapEdges() {
  if (!cy) return;
  cy.batch(() => {
    cy.edges('.ovl').remove();
    if (!S.ovl) return;
    const cap = BIG ? 400 : 1500; const seen = new Set(); const add = [];
    for (const o of visibleOverlaps()) { if (LOD_ON && !(cy.$id(o.a).length && cy.$id(o.b).length)) continue; const k = o.a + '|' + o.b; if (seen.has(k)) continue; seen.add(k); add.push({ group: 'edges', classes: 'ovl', data: { id: 'O:' + o.i, ov: o.i, source: o.a, target: o.b } }); if (add.length >= cap) break; }
    cy.add(add);
  });
  $('#btn-ovl').setAttribute('aria-pressed', S.ovl); $('#btn-ovl').classList.toggle('on', S.ovl);
}
function highlightPath() {
  if (!cy) return; cy.elements('.path').removeClass('path');
  if (!PATHS.length) return;
  for (const p of PATHS) { p.links.forEach(id => cy.$id('L:' + id).addClass('path')); p.nodes.forEach(id => cy.$id(id).addClass('path')); }
}
$('#btn-ovl').addEventListener('click', () => { S.ovl = !S.ovl; update(); announce(S.ovl ? 'Overlap connections shown as dotted grey lines. They are found by the map, not reported claims.' : 'Overlap connections hidden'); });

// ---- cross-layer corroboration ranking: items seen in 2+ source layers (item level; evidence sources never add a layer)
function crossLayerRows() {
  const rows = [];
  for (const id of F.ents) { const e = ENT.get(id); const n = seenOf(e).length; if (n >= 2) rows.push({ kind: 'e', id, n, w: e.degree }); }
  for (const l of F.links) { const n = seenOf(l).length; if (n >= 2) rows.push({ kind: 'l', id: l.id, n, w: (l.sources ? l.sources.length : l._ns || 0) + (STATUS_KEYS.length - STATUS_KEYS.indexOf(l.status)) }); }
  return rows.sort((a, b) => b.n - a.n || (a.kind === b.kind ? 0 : a.kind === 'l' ? -1 : 1) || b.w - a.w || a.id.localeCompare(b.id));
}
function crossRow(c) {
  const x = c.kind === 'e' ? ENT.get(c.id) : LNK.get(c.id);
  const body = c.kind === 'e' ? `${entBtn(c.id)} <span class="muted small">${esc(TYPE[x.type].label)}</span>` : `${entBtn(x.from)} <span class="verb">${esc(LT(x.type).label)}</span> ${entBtn(x.to)} <button type="button" class="linkish small" data-link="${esc(x.id)}">claim</button> ${lbadge(x)}`;
  return `<li class="ov">${seenBadge(x)} ${body} ${seenOf(x).map(k => layerChip(k, true)).join('')}${c.kind === 'l' ? ` <code class="small muted">${esc(x.id)}</code>` : ''}</li>`;
}
function renderCrossLayer() {
  const rows = crossLayerRows();
  $('#o-corr').innerHTML = `<h3 class="lbl">Cross-layer corroboration <span class="muted">${rows.length}</span></h3><p class="help">Entities and claims that two or more source layers (${esc(LAYER_KEYS.map(k => layerInfo(k).label).join(', '))}) report themselves. A public-record source on a reported claim is evidence and does not count as a layer. Several layers mentioning an item is not proof that a claim is true.</p>` +
    (rows.length ? `<ol class="ovs ranked">${rows.slice(0, 40).map(crossRow).join('')}</ol>${rows.length > 40 ? `<button type="button" class="linkish" data-ovsort="layers">All ${rows.length} →</button>` : ''}` : '<p class="muted small">None with the current filters.</p>');
}
$('#o-corr').addEventListener('click', e => { if (e.target.closest('[data-ovsort]')) { S.ovsort = 'layers'; oShown = 60; update(); } });

// ---- 50-index.js
/* index: paginated, sortable table of entities matching filters (accessible alternative to the graph) */
let iPage = 0, iSort = 'degree', iDir = -1; const I_PER = 100;
function renderIndex() {
  let rows = [...F.ents].map(id => ENT.get(id));
  if (S.q.trim()) { const hits = new Set(runSearch(S.q, 500).filter(r => r.kind === 'e').map(r => r.ref)); rows = rows.filter(e => hits.has(e.id)); }
  const key = { name: e => e.name.toLowerCase(), type: e => e.type, province: e => e.province || '~', degree: e => e.degree, money_in: e => e.money_in, money_out: e => e.money_out, overlaps: e => e.overlap_partners || 0 }[iSort];
  rows.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * iDir || a.name.localeCompare(b.name); });
  const pages = Math.max(1, Math.ceil(rows.length / I_PER)); iPage = Math.min(iPage, pages - 1);
  $('#i-summary').textContent = `${rows.length} entities${S.q.trim() ? ` matching “${S.q}”` : ''}`;
  const cols = [['name', 'Name'], ['type', 'Type'], ['province', 'Prov.'], ['layers', 'Layer'], ['degree', 'Links'], ['money_in', 'Money in'], ['money_out', 'Money out'], ['overlaps', 'Overlap partners']];
  $('#index-table thead').innerHTML = `<tr>${cols.map(([k, t]) => k === 'layers' ? `<th scope="col">${t}</th>` : `<th scope="col" aria-sort="${iSort === k ? (iDir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="th-btn" data-sort="${k}">${t}${iSort === k ? (iDir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr>`;
  $('#index-table tbody').innerHTML = rows.slice(iPage * I_PER, (iPage + 1) * I_PER).map(e => `<tr${S.node === e.id ? ' class="sel"' : ''}><td><button type="button" class="linkish" data-node="${esc(e.id)}">${esc(e.name)}</button></td><td>${typeChip(e.type)}</td><td>${esc(e.province || '')}</td><td>${itemLayers(e).map(k => layerChip(k, true)).join('')}</td><td>${e.degree}</td><td class="amt">${e.money_in ? fmtCAD(e.money_in) : ''}</td><td class="amt">${e.money_out ? fmtCAD(e.money_out) : ''}</td><td>${e.overlap_partners || ''}</td></tr>`).join('') || `<tr><td colspan="8" class="muted">No entities match. <button class="linkish" data-reset>Reset filters</button></td></tr>`;
  $('#i-pager').innerHTML = pages > 1 ? `<button class="btn sm" data-page="-1" ${iPage ? '' : 'disabled'} aria-label="Previous page">‹</button><span class="muted">page ${iPage + 1} / ${pages}</span><button class="btn sm" data-page="1" ${iPage < pages - 1 ? '' : 'disabled'} aria-label="Next page">›</button>` : '';
  const nets = F.nets;
  $('#i-nets').innerHTML = nets.length ? `<h3 class="lbl">Networks</h3><table class="index-table"><thead><tr><th>Network</th><th>Kind</th><th>Status</th><th>Members</th><th>Money (evidence links)</th></tr></thead><tbody>${nets.map(n => `<tr><td><button type="button" class="linkish" data-net="${esc(n.id)}">${esc(n.name)}</button></td><td>${esc(NETKIND[n.kind]?.label || n.kind)}</td><td>${lbadge(n)}</td><td>${n.members.length}</td><td class="amt">${n.money_cad ? fmtCAD(n.money_cad) : ''}${n.est_cad ? ` <span class="est">Estimate</span> ${fmtCAD(n.est_cad)}` : ''}</td></tr>`).join('')}</tbody></table>` : '';
}
$('#view-index').addEventListener('click', e => {
  const t = e.target.closest('[data-sort],[data-page],[data-node],[data-net]'); if (!t) return;
  if (t.dataset.sort) { if (iSort === t.dataset.sort) iDir = -iDir; else { iSort = t.dataset.sort; iDir = ['name', 'type', 'province'].includes(iSort) ? 1 : -1; } renderIndex(); }
  else if (t.dataset.page) { iPage += +t.dataset.page; renderIndex(); $('#view-index').scrollTop = 0; }
  else if (t.dataset.node) select({ node: t.dataset.node });
  else if (t.dataset.net) selectNet(t.dataset.net);
});

// ---- 55-sources.js
/* sources: searchable list of every cited source, with what cites it */
let sShown = 80;
function sourcePass(s) {
  if (S.skind !== 'all' && s.kind !== S.skind) return false;
  if (S.slayer === 'records' && !(s.records || s.kind === 'public_record')) return false;
  if (S.slayer !== 'all' && S.slayer !== 'records' && !(s.layers || []).includes(S.slayer)) return false;
  if (!layerAll() && !(s.layers || []).some(k => S.layers.has(k)) && !(S.layers.has('records') && (s.records || s.kind === 'public_record'))) return false;
  if (S.sq.trim()) { const q = S.sq.toLowerCase(); if (![s.title, s.publisher, s.url, s.registry, s.record_id, s.date].some(v => v && String(v).toLowerCase().includes(q))) return false; }
  return true;
}
function fillSourceSelects() { // generic: one option per layer
  const k = $('#s-kind'), l = $('#s-layer'); if (k.dataset.filled) return; k.dataset.filled = '1';
  k.innerHTML = '<option value="all">all</option>' + SRC_KINDS.map(x => `<option value="${esc(x)}">${esc(x === 'public_record' ? 'public records' : x === 'other' ? 'other' : srcKindLabel(x))}</option>`).join('');
  l.innerHTML = '<option value="all">all</option>' + LAYER_KEYS.map(x => `<option value="${esc(x)}">cited by ${esc(layerInfo(x).label)} items</option>`).join('');
}
function renderSources() {
  fillSourceSelects();
  if (!EXTRA.loaded.sources) { $('#s-summary').textContent = ''; const el = $('#s-list'); if (el) el.innerHTML = loadingNote('sources'); loadExtra('sources'); return; }
  const list = D.sources.filter(sourcePass).sort(S.ssort === 'cited' ? (a, b) => b.cites.length - a.cites.length : (a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  if (document.activeElement !== $('#s-q')) $('#s-q').value = S.sq; $('#s-kind').value = S.skind; $('#s-sort').value = S.ssort; $('#s-layer').value = S.slayer;
  $('#s-summary').textContent = `${list.length} of ${D.sources.length} sources${D.meta.source_groups && (D.meta.source_groups.registry_merged || D.meta.source_groups.items_merged) ? ' (same item on several platforms shown once)' : ''}`;
  const cite = ([k, id]) => k === 'e' ? `<button type="button" class="linkish" data-node="${esc(id)}">${esc(name(id))}</button>` : k === 'l' && LNK.has(id) ? (() => { const l = LNK.get(id); return `<button type="button" class="linkish" data-link="${esc(id)}">${esc(name(l.from))} → ${esc(name(l.to))}</button>`; })() : k === 'n' && NET.has(id) ? `<button type="button" class="linkish" data-net="${esc(id)}">${esc(NET.get(id).name)}</button>` : esc(id);
  $('#s-list').innerHTML = list.slice(0, sShown).map(s => { const u = safeUrl(s.url); const kind = [srcKindLabel(s.kind), srcMedium(s)].filter(Boolean).join(' · '); const lys = [...(s.layers || [])]; if ((s.records || s.kind === 'public_record') && !lys.includes('records')) lys.push('records');
    return `<li class="s-item"><div class="s-title">${u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(s.title || s.registry || s.url)}</a>` : esc(s.title || s.registry || s.key)}${ownClaimChip(s)}${paywallChip(s)}${platformLinks(s)}</div>
    <div class="s-meta"><span class="kindtag">${esc(kind)}</span> ${lys.map(k => layerChip(k)).join('')} ${[s.publisher, s.registry && s.kind === 'public_record' ? s.registry : '', s.record_id ? '#' + s.record_id : '', s.date].filter(Boolean).map(esc).join(' · ')}${s.retrieved_date ? ` <span class="retrieved">· Retrieved ${esc(s.retrieved_date)}</span>` : ''}</div>
    <details><summary>Cited by ${s.cites.length}</summary><div class="s-cites">${s.cites.slice(0, 60).map(cite).join(' · ')}${s.cites.length > 60 ? ' …' : ''}</div></details></li>`; }).join('') || '<li class="muted">No sources match.</li>';
  $('#s-more').hidden = list.length <= sShown;
}
$('#s-q').addEventListener('input', debounce(e => { S.sq = e.target.value; sShown = 80; renderSources(); commit(false); }, 120));
$('#s-kind').addEventListener('change', e => { S.skind = e.target.value; update(); });
$('#s-layer').addEventListener('change', e => { S.slayer = e.target.value; update(); });
$('#s-sort').addEventListener('change', e => { S.ssort = e.target.value; update(); });
$('#s-more').addEventListener('click', () => { sShown += 200; renderSources(); });
$('#view-sources').addEventListener('click', e => { const t = e.target.closest('[data-node],[data-link],[data-net]'); if (!t) return; if (t.dataset.node) select({ node: t.dataset.node }); else if (t.dataset.link) select({ link: t.dataset.link }); else selectNet(t.dataset.net); });

// ---- 58-events.js
/* events (v1.7): event nodes (date, place, summary, sources), event cards on profiles, the timeline Events lane,
   and the `charged` link's "Legal record" (neutral legal-status chip + note; never money, never a ranking facet).
   Posts, articles and videos are sources, never nodes. */
const isEvent = e => e && e.type === 'event';
const evDate = e => e.date || (e.date_range ? [e.date_range.start, e.date_range.end].filter(Boolean).join(' – ') : '') || '';
const evSortKey = e => e.date || e.date_range?.start || e.date_range?.end || '9999';
const evPlace = e => { const pe = e.place_id && ENT.has(e.place_id) ? ENT.get(e.place_id) : null; return [e.place && (!pe || e.place !== pe.name) ? esc(e.place) : '', pe ? entBtn(pe.id) : ''].filter(Boolean).join(', '); };
// v1.8 status: neutral badge, Expected, Stopped by, attributed reason (quoted text only)
const evStatusBadge = e => isStoppedEv(e) || isUpcomingEv(e) ? `<span class="ev-status" data-ev-status="${esc(e.event_status)}" title="Event status as the cited sources describe it">${esc((EV_STATUS[e.event_status] || {}).badge || e.event_status)}</span>` : '';
const xDate = x => x ? x.date || (x.date_range ? [x.date_range.start, x.date_range.end].filter(Boolean).join(' – ') : '') : '';
function expectedBlock(e) {
  const x = e.expected; if (!x) return '';
  return `<div class="ev-expected" data-expected><h4 class="cat-h">Expected</h4>${x.description ? `<p class="small">${esc(x.description)}</p>` : ''}${xDate(x) ? `<div class="small"><span class="muted">Expected date</span> <b>${esc(xDate(x))}</b></div>` : ''}${srcList(x.sources)}</div>`;
}
function reasonBlock(e) {
  const r = e.reason; if (!r) return '';
  const u = r.source && safeUrl(r.source.url); const src = r.source ? (u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(r.source.publisher || r.source.title || 'source')}</a>` : esc(r.source.title || r.source.publisher || 'source')) : '';
  return `<figure class="ev-reason" data-reason><figcaption class="small muted">Stated reason, quoted from the source (not a claim by this map)</figcaption><blockquote>“${esc(r.quote)}”</blockquote><div class="small">— ${esc(r.attributed_to)}${src ? ` · ${src}` : ''}</div></figure>`;
}
let PERSON_BY_NAME = null; const personByName = n => { if (!PERSON_BY_NAME) { PERSON_BY_NAME = new Map(); for (const x of D.entities) if (x.type === 'person') PERSON_BY_NAME.set(x.name.toLowerCase(), x.id); } return PERSON_BY_NAME.get(String(n).toLowerCase()); };
function peopleInvolved(e) {
  const P = e.people_involved; if (!P || !P.length) return '';
  return `<div class="ev-people" data-people-involved><h4 class="cat-h">People involved</h4><ul class="small">${P.map(x => { const id = personByName(x.name); const u = x.source && safeUrl(x.source.url); return `<li>${id ? entBtn(id) : `<b>${esc(x.name)}</b>`}${x.role ? ` — ${esc(x.role)}` : ''}${x.source ? ` <span class="muted">· named in ${u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(namedInLabel(x.source))}</a>` : esc(namedInLabel(x.source))}</span>` : ''}</li>`; }).join('')}</ul></div>`;
}
// v1.9 fundraiser-style facts: kind, venue city, ticket price, amount raised (as the sources state them)
function fundraiserFacts(e) {
  const rows = [];
  if (e.event_kind) rows.push(`<div><span class="muted">Event kind</span> <span class="ev-kind" data-ev-kind="${esc(e.event_kind)}"${(EV_KINDS[e.event_kind] || {}).desc ? ` title="${esc(EV_KINDS[e.event_kind].desc)}"` : ''}>${esc(evKindLabel(e.event_kind))}</span></div>`);
  if (e.venue_city) rows.push(`<div><span class="muted">Venue city</span> <b data-venue-city>${esc(e.venue_city)}</b></div>`);
  if (e.ticket_price_cad != null) rows.push(`<div><span class="muted">Ticket price</span> <b data-ticket-price>${esc(fmtCADfull(e.ticket_price_cad))}</b> <span class="small muted">as reported</span></div>`);
  if (e.amount_raised_cad != null) rows.push(`<div><span class="muted">Amount raised</span> <b data-amount-raised>${esc(fmtCADfull(e.amount_raised_cad))}</b> <span class="small muted">as reported; not added to money totals</span></div>`);
  return rows.length ? `<div class="ev-fund" data-ev-fund>${rows.join('')}</div>` : '';
}
// one sourced role link at an event: the person/org, its status badge and its sources
// v1.9 paging: event lists can hold thousands of rows. Render a page, keep the rest as lazy html thunks.
const PAGE_SZ = 25; const PAGES = new Map(); let pageSeq = 0;
function pagedUl(attrs, items, render, size = PAGE_SZ) {
  const head = items.slice(0, size).map(render).join('');
  if (items.length <= size) return `<ul ${attrs}>${head}</ul>`;
  const key = 'pg' + (++pageSeq); PAGES.set(key, { items, render, at: size, size }); if (PAGES.size > 200) PAGES.delete(PAGES.keys().next().value);
  return `<ul ${attrs} data-paged="${key}">${head}</ul><button type="button" class="linkish small page-more" data-page-more="${key}">Show ${Math.min(size, items.length - size)} more (${items.length - size} left)</button>`;
}
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-page-more]'); if (!b) return;
  const pg = PAGES.get(b.dataset.pageMore); const ul = document.querySelector(`[data-paged="${b.dataset.pageMore}"]`); if (!pg || !ul) { b.remove(); return; }
  ev.preventDefault(); ev.stopPropagation();
  ul.insertAdjacentHTML('beforeend', pg.items.slice(pg.at, pg.at + pg.size).map(pg.render).join('')); pg.at += pg.size;
  const left = pg.items.length - pg.at; if (left <= 0) { b.remove(); PAGES.delete(b.dataset.pageMore); } else b.textContent = `Show ${Math.min(pg.size, left)} more (${left} left)`;
}, true);
function roleRow(l, otherId) {
  const n = l.sources.length;
  return `<li class="ev-role" data-role-link="${esc(l.id)}">${entBtn(otherId)} ${badge(l.status, l.source_layer)} <button type="button" class="linkish small" data-link="${esc(l.id)}">claim</button>${l.date ? ` <span class="small muted">${esc(l.date)}</span>` : ''}<details class="c-src"><summary>${n} source${n === 1 ? '' : 's'}</summary>${srcList(l.sources)}</details></li>`;
}
// Hosted by / Speakers / Attendees: listed by role only, never grouped or labelled as a community
function eventRoles(e) {
  if (!isEvent(e)) return '';
  const ls = (byNode.get(e.id) || []).filter(l => l.to === e.id);
  const part = (title, type, key) => { const xs = ls.filter(l => l.type === type).sort((a, b) => name(a.from).localeCompare(name(b.from))); return xs.length ? panelSection(title, pagedUl(`class="ev-roles" data-ev-roles="${key}"`, xs, l => roleRow(l, l.from)), true, xs.length) : ''; };
  return part('Hosted by', 'hosted', 'hosted') + part('Speakers', 'spoke_at', 'speakers') + part('Attendees', 'attended', 'attendees');
}
// money links that carry event_id = this event. The same links are counted once in every total (never re-added here).
function moneyTiedSection(e) {
  if (!isEvent(e)) return '';
  const ls = [...new Map(moneyTiedTo(e.id).map(l => [l.id, l])).values()].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  if (!ls.length) return '';
  const tot = ls.filter(isFlow).reduce((a, l) => a + l.amount_cad, 0);
  return panelSection('Money tied to this event', `<ul class="ev-money" data-ev-money>${ls.map(l => `<li data-tied-link="${esc(l.id)}">${entBtn(l.from)} → ${entBtn(l.to)} <span class="small muted">${esc(LT(l.type).label)}</span> ${l.amount_cad != null ? `<b class="${isEst(l) ? 'est' : ''}">${esc(fmtCADfull(l.amount_cad))}</b>` : ''} ${badge(l.status, l.source_layer)} <button type="button" class="linkish small" data-link="${esc(l.id)}">claim</button>${l.date ? ` <span class="small muted">${esc(l.date)}</span>` : ''}<details class="c-src"><summary>${l.sources.length} source${l.sources.length === 1 ? '' : 's'}</summary>${srcList(l.sources)}</details></li>`).join('')}</ul>${tot ? `<p class="small"><span class="muted">Total of these links</span> <b data-ev-money-total>${esc(fmtCADfull(tot))}</b></p>` : ''}<p class="small muted">Each link is counted once in totals; listing it here does not add it again. Estimates and "other" amounts are excluded.</p>`, true, ls.length);
}
function eventCard(e, viaLinks = []) {
  const roles = [...new Set(viaLinks.map(l => LT(l.type).label))];
  return `<li class="ev-card" data-event="${esc(e.id)}"><div class="ev-head"><span class="ev-date">${esc(evDate(e) || (e.expected && xDate(e.expected) ? 'expected ' + xDate(e.expected) : 'undated'))}</span> ${evStatusBadge(e)} <button type="button" class="linkish ent" data-node="${esc(e.id)}">${esc(e.name)}</button>${evPlace(e) ? ` <span class="muted small">· ${evPlace(e)}</span>` : ''}</div>
    ${roles.length ? `<div class="small muted">${esc(roles.join(', '))}${viaLinks.map(l => ` <button type="button" class="linkish small" data-link="${esc(l.id)}">claim</button>`).join('')}</div>` : ''}
    ${e.summary ? `<p class="small">${esc(e.summary)}</p>` : ''}${e.expected && (e.expected.description || xDate(e.expected)) ? `<div class="small ev-exp-line"><span class="muted">Expected:</span> ${esc([e.expected.description, xDate(e.expected)].filter(Boolean).join(' · '))}</div>` : ''}${e.stopped_by && ENT.has(e.stopped_by) ? `<div class="small"><span class="muted">Stopped by</span> ${entBtn(e.stopped_by)}</div>` : ''}
    <details class="c-src"><summary>${e.sources.length} source${e.sources.length === 1 ? '' : 's'}</summary>${srcList(e.sources)}</details></li>`;
}
// events this entity is connected to (any link to/from an event), sorted by date
function eventsOf(id) {
  const m = new Map(); for (const l of byNode.get(id) || []) { const o = l.from === id ? l.to : l.from; if (isEvent(ENT.get(o))) (m.get(o) || m.set(o, []).get(o)).push(l); }
  return [...m.entries()].map(([eid, ls]) => [ENT.get(eid), ls]).sort((a, b) => evSortKey(a[0]).localeCompare(evSortKey(b[0])) || a[0].name.localeCompare(b[0].name));
}
function eventsSection(e) {
  if (isEvent(e)) return '';
  const ev = eventsOf(e.id); if (!ev.length) return '';
  return panelSection('Events', pagedUl('class="ev-list" data-guide="events"', ev, ([x, ls]) => eventCard(x, ls)), true, ev.length);
}
function eventFacts(e) {
  if (!isEvent(e)) return '';
  const caused = (byNode.get(e.id) || []).filter(l => l.type === 'caused');
  return `<div class="ev-facts claim-box">${isStoppedEv(e) || isUpcomingEv(e) ? `<div>${evStatusBadge(e)}</div>` : ''}<div><span class="muted">${isStoppedEv(e) ? 'Date (as reported)' : 'Date'}</span> <b>${esc(evDate(e) || 'not given')}</b></div>${e.stopped_by && ENT.has(e.stopped_by) ? `<div data-stopped-by><span class="muted">Stopped by</span> ${entBtn(e.stopped_by)}</div>` : ''}${evPlace(e) ? `<div><span class="muted">Place</span> ${evPlace(e)}</div>` : ''}${caused.length ? `<div class="small">${caused.map(l => l.to === e.id ? `Followed from ${entBtn(l.from)}` : `Led to ${entBtn(l.to)}`).join(' · ')}</div>` : ''}</div>${expectedBlock(e)}${reasonBlock(e)}${peopleInvolved(e)}`;
}
// ---- charged: Legal record
const CHARGE_NOTE = s => (LEGAL[s] || {}).note || '';
function chargeRow(l, personId) {
  const st = l.legal_status || 'unknown'; const lab = (LEGAL[st] || {}).label || 'Status unknown';
  let det = l.charge_description || ''; if (det && st !== 'convicted' && FORBID.test(det)) det = 'see the source for the stated wording';
  const so = l.legal_status_source; const u = so && safeUrl(so.url);
  const src = so ? (u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(so.publisher || so.title || 'source')}</a>` : esc(so.title || so.publisher || 'source')) : '';
  const note = CHARGE_NOTE(st);
  return `<li class="legal-rec" data-charge="${esc(l.id)}"><div class="legal-row"><span class="legal-chip" title="Legal status as the source states it. Not a finding by this map.">${esc(lab)}</span> <span class="small">${personId ? `${entBtn(l.from)}` : `${entBtn(l.from)} → ${entBtn(l.to)}`}</span>${det ? ` <span class="legal-det">${esc(det)}</span>` : ''}${src ? ` <span class="muted">· ${src}</span>` : ''}${l.legal_status_date ? ` <span class="muted">· ${esc(l.legal_status_date)}</span>` : ''} <button type="button" class="linkish small" data-link="${esc(l.id)}">claim</button></div>${note ? `<div class="legal-note">${esc(note)}</div>` : ''}</li>`;
}
function legalRecordSection(e) {
  if (e.type !== 'person') return '';
  const ls = (byNode.get(e.id) || []).filter(l => l.type === 'charged' && l.to === e.id).sort((a, b) => String(a.legal_status_date || a.date || '').localeCompare(String(b.legal_status_date || b.date || '')));
  if (!ls.length) return '';
  return panelSection('Legal record', `<ul class="legal-recs">${ls.map(l => chargeRow(l, e.id)).join('')}</ul><p class="small muted">As the cited source states it. Not a finding by this map.</p>`, true, ls.length);
}
const chargeBlock = l => l.type === 'charged' ? `<ul class="legal-recs">${chargeRow(l)}</ul>` : '';

// ---- 60-panel.js
/* panel: entity profile, claim, network card, overlap detail, overview */
const SRC_KIND_LABEL = Object.fromEntries(SRC_KINDS.map(k => [k, srcKindLabel(k)]));
const SRC_KIND_LAYER = { public_record: 'records', ...Object.fromEntries(Object.keys(LAYERS).filter(k => k !== 'records').map(k => [k, k])) };
const srcLink = s => { const u = safeUrl(s.url); const kind = SRC_KIND_LABEL[s.kind] || 'Wiretap'; const t = esc(s.title || s.registry || s.url || 'source'); const meta = [kind, srcMedium(s), s.publisher, s.registry && s.kind === 'public_record' ? s.registry : '', s.record_id ? '#' + s.record_id : '', s.date].filter(Boolean).map(esc).join(' · ') + (s.retrieved_date ? ` <span class="retrieved">· Retrieved ${esc(s.retrieved_date)}</span>` : ''); const ly = s.source_layer || (s.layers && s.layers[0]) || SRC_KIND_LAYER[s.kind]; const by = [].concat(s.added_by || []).filter(Boolean); return `<li class="src ${s.kind === 'public_record' ? 'rec' : ''}">${ly ? layerChip(ly, true) + ' ' : ''}${u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${t}</a>` : t}<span class="muted"> ${meta}</span>${ownClaimChip(s)}${paywallChip(s)}${platformLinks(s)}${by.length ? `<span class="added-by">added by ${esc(by.join(', '))}</span>` : ''}${s.note ? `<span class="src-note small muted" title="${esc(s.note)}">${esc(s.note.length > 160 ? s.note.slice(0, 157) + '…' : s.note)}</span>` : ''}</li>`; };
const platformLinks = s => s.platforms && s.platforms.length > 1 ? ` <span class="src-plat small" data-platforms="${s.platforms.length}">· also on ${s.platforms.filter(p => p.url !== s.url).map(p => { const pu = safeUrl(p.url); return pu ? `<a href="${esc(pu)}" target="_blank" rel="noopener noreferrer">${esc(p.platform || 'link')}</a>` : ''; }).filter(Boolean).join(', ')}</span>` : '';
// Naming rule: every person shows who names them ('Named in'), with the source kind and a link. Never contact or family details.
const xHandle = u => { const m = String(u || '').match(/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})(?:\/|$|\?)/); return m && !['i', 'home', 'search', 'intent', 'share'].includes(m[1].toLowerCase()) ? m[1] : ''; };
const namedInLabel = s => {
  if (s.kind === 'public_record') return 'Public record: ' + (s.registry || s.publisher || s.title || 'record');
  if (s.kind === 'official_website') return "Official website (organization's own claim)";
  const h = xHandle(s.url); if (h || /^https?:\/\/(www\.|mobile\.)?(x|twitter)\.com\//i.test(s.url || '')) return h ? `X post (@${h})` : 'X post';
  if (/youtu\.?be|rumble\.com|vimeo\.com|odysee\.com|bitchute\.com/i.test(s.url || '')) return 'Video: ' + (s.title || s.publisher || 'video');
  if (/podcast|spotify\.com\/episode|apple\.com\/.*podcast/i.test(s.url || '')) return 'Podcast: ' + (s.title || s.publisher || 'episode');
  if (!s.title && !s.publisher) { let h = ''; try { h = new URL(s.url).hostname.replace(/^www\./, ''); } catch {} return 'Source: ' + (h || s.url || 'source'); }
  return 'Article: ' + (s.title || s.publisher);
};
const namedFromRecords = e => e.type === 'person' && (e.sources || []).some(s => s.kind === 'public_record');
function namedIn(e) {
  if (e.type !== 'person') return '';
  const seen = new Set(); const items = [];
  for (const s of [...e.sources].sort((a, b) => (b.kind === 'public_record') - (a.kind === 'public_record'))) { const lab = namedInLabel(s); const k = lab + '|' + (s.url || ''); if (seen.has(k)) continue; seen.add(k); const u = safeUrl(s.url); items.push(u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" data-named-kind="${esc(s.kind)}">${esc(lab)}</a>` : `<span data-named-kind="${esc(s.kind)}">${esc(lab)}</span>`); }
  if (!items.length) return '<div class="named-in small" data-named-in><span class="muted">Named in:</span> no source listed</div>';
  const show = items.slice(0, 6), more = items.slice(6);
  return `<div class="named-in small" data-named-in><span class="muted">Named in:</span> ${show.join(' · ')}${more.length ? ` <details class="named-more"><summary>+${more.length} more</summary>${more.join(' · ')}</details>` : ''}</div>`;
}
const roleBadge = e => namedFromRecords(e) ? ` <span class="role-badge" data-role-badge title="Role as stated in the public record">${esc(e.role || 'Named in a public record')}</span>` : '';
const ownClaimBlock = e => e.official_claim ? `<div class="own-claim small" data-own-claim-block>${ownClaimChip({ kind: 'official_website' })} ${e.official_claim.summary ? esc(e.official_claim.summary) : ''} ${safeUrl(e.official_claim.url) ? `<a href="${esc(e.official_claim.url)}" target="_blank" rel="noopener noreferrer">${esc(e.official_claim.url.replace(/^https?:\/\//, ''))}</a>` : ''}${e.official_claim.checked ? ` <span class="muted">· checked ${esc(e.official_claim.checked)}</span>` : ''}</div>` : '';
const srcList = srcs => srcs && srcs.length ? `<ul class="srcs">${srcs.map(srcLink).join('')}</ul>` : '<p class="muted small">No sources listed.</p>';
const entBtn = id => `<button type="button" class="linkish ent" data-node="${esc(id)}">${esc(name(id))}</button>`;
const layerChips = x => itemLayers(x).map(k => layerChip(k)).join('');
function claimRow(l, fromId, opts = {}) {
  const out = !fromId || l.from === fromId; const t = LT(l.type); const other = out ? l.to : l.from;
  const verb = fromId ? (out ? t.label : t.inverse) : t.label;
  const amt = l.amount_cad > 0 ? `<span class="amt${isEst(l) ? ' estv' : ''}">${fmtCAD(l.amount_cad)}</span> ${estTag(l)}` : '';
  const hid = F && !F.linkSet.has(l.id) ? ' <span class="hid" title="Hidden by current filters">hidden by filters</span>' : '';
  return `<li class="claim" data-cat="${esc(t.cat)}"><div class="c-main">${fromId ? '' : entBtn(l.from) + ' '}<span class="verb">${esc(verb)}</span> ${entBtn(fromId ? other : l.to)} ${amt}</div>
    <div class="c-meta">${lbadge(l)} ${layerChips(l)}${l.date ? ` <span class="muted">${esc(l.date)}</span>` : ''} <button type="button" class="linkish small" data-link="${esc(l.id)}">claim details</button>${hid}</div>
    ${opts.sources ? srcList(l.sources) : `<details class="c-src"><summary>${l.sources.length} source${l.sources.length === 1 ? '' : 's'}</summary>${srcList(l.sources)}</details>`}</li>`;
}
function netCard(n) {
  const K = n.auto ? { label: 'Auto-detected cluster', icon: '⁂' } : (NETKIND[n.kind] || { label: 'Network', icon: '◇' });
  const money = !n.auto && (n.money_cad || n.est_cad) ? `<span class="amt">${fmtCAD(n.money_cad || 0)}</span>${n.est_cad ? ` <span class="muted">+ ${fmtCAD(n.est_cad)}</span> <span class="est">Estimate</span>` : ''} <span class="muted">across ${n.link_ids.length} evidence link(s)</span>` : '';
  return `<div class="net-card${n.auto ? ' auto' : ''}"><div class="nc-head"><span class="ic" aria-hidden="true">${K.icon}</span><b>${esc(n.auto ? n.name.replace(/^Auto-detected cluster \d+: /, '') : n.name)}</b></div>
    <div class="nc-meta"><span class="kindtag">${esc(K.label)}</span>${n.auto ? '<span class="muted">computed from link structure, not reporting</span>' : `${lbadge(n)} ${layerChips(n)}`} <span class="muted">${n.members.length} members</span></div>
    ${n.description ? `<p class="small">${esc(n.description)}</p>` : ''}${money ? `<div class="small">${money}</div>` : ''}
    <div class="nc-act"><button type="button" class="btn sm" data-net="${esc(n.id)}">${S.net === n.id ? 'Highlighted' : 'Highlight on map'}</button></div></div>`;
}
function panelSection(title, body, open = true, count) { return `<details class="psec" ${open ? 'open' : ''}><summary><h3>${esc(title)}${count != null ? ` <span class="muted">${count}</span>` : ''}</h3></summary>${body}</details>`; }
function renderEntity(e) {
  if (typeof isTheoryEnt === 'function' && isTheoryEnt(e) && typeof renderTheoryCard === 'function') return renderTheoryCard(e);
  const T = TYPE[e.type]; const links = byNode.get(e.id);
  const sums = e.summaries && Object.keys(e.summaries).length > 1 ? Object.entries(e.summaries).map(([k, v]) => `<p>${layerChip(k)} ${esc(v)}</p>`).join('') : `<p>${esc(e.summary || '')}</p>`;
  const flows = links.filter(isFlow), ests = links.filter(isEst);
  const sum = (arr, dir) => arr.filter(l => (dir === 'in' ? l.to : l.from) === e.id).reduce((s, l) => s + l.amount_cad, 0);
  const money = flows.length || ests.length ? `<div class="money-box"><div><span class="muted">Money in</span> <b class="amt">${fmtCAD(sum(flows, 'in')) || '$0'}</b></div><div><span class="muted">Money out</span> <b class="amt">${fmtCAD(sum(flows, 'out')) || '$0'}</b></div>${ests.length ? `<div class="small"><span class="est">Estimate</span> ${fmtCAD(sum(ests, 'in') + sum(ests, 'out'))} in estimates/budgets, not counted</div>` : ''}<button type="button" class="btn sm" data-follow="${esc(e.id)}">Follow the money</button></div>` : '';
  const groups = {}; for (const l of links) (groups[catOf(l)] = groups[catOf(l)] || []).push(l);
  const conn = CAT_KEYS.filter(c => groups[c]).map(c => `<h4 class="cat-h"><span class="dot sq" style="background:${LINK_CATS[c].color}" aria-hidden="true"></span>${esc(LINK_CATS[c].label)} <span class="muted">${groups[c].length}</span></h4><ul class="claims">${groups[c].sort((a, b) => (b.amount_cad || 0) - (a.amount_cad || 0)).map(l => claimRow(l, e.id)).join('')}</ul>`).join('');
  const nets = NETS.filter(n => n.members.includes(e.id) || (e.networks || []).includes(n.id));
  const clu = e.cluster && NET.get(e.cluster);
  const corr = CORR.get('e:' + e.id);
  const intro = GUIDE.entity_intros && GUIDE.entity_intros[e.id] && GUIDE.entity_intros[e.id].intro;
  const myLeads = LEADS.filter(L => L.entities.includes(e.id) || L.link_ids.some(id => { const l = LNK.get(id); return l && (l.from === e.id || l.to === e.id); }));
  return `<div class="p-head"><div class="p-type">${typeChip(e.type)}${e.type === 'event' ? ' ' + evStatusBadge(e) : ''}${e.province ? ` <span class="muted" title="${esc(provName(e.province))}">${esc(e.province)}</span>` : ''} ${layerChips(e)} ${seenBadge(e)}${e.status ? ' ' + lbadge(e) : ''}</div>
    <h1 class="p-name">${esc(e.name)}</h1>${namedFromRecords(e) ? `<div>${roleBadge(e)}</div>` : e.role ? `<div class="muted">${esc(e.role)}</div>` : ''}${namedIn(e)}${e.aliases.length ? `<div class="small muted">Also: ${esc(e.aliases.join(' · '))}</div>` : ''}${legalChips(e)}${typeof theorySwitchHtml === 'function' ? theorySwitchHtml(e) : ''}${typeof personChecksHtml === 'function' ? personChecksHtml(e) : ''}${e.unlinked && !links.length ? `<p class="unlinked-note" data-unlinked role="note"><span class="kindtag">Unlinked</span> ${esc(e.unlinked_note || 'No sourced relationship found yet; entity kept from its cited source.')}</p>` : ''}<div class="p-corr">${correctionLink('entity', e.id, e.name)}</div></div>
    ${sourceLabels(e)}
    ${typeof sourceFramingHtml === 'function' ? sourceFramingHtml(e) : ''}
    ${tagLabels(e)}
    ${e.type === 'event' ? normBlock(e) : ''}
    ${intro ? `<p class="guide-intro"><span class="kindtag">Guide</span> ${esc(intro)}</p>` : ''}
    ${eventFacts(e)}${isEvent(e) ? fundraiserFacts(e) : ''}${ownClaimBlock(e)}
    ${sums}${corr ? `<p class="small corr">Found in ${corr.map(k => layerChip(k)).join(' ')}: <span class="muted">cross-source corroboration (map finding, not a claim)</span></p>` : ''}
    <div class="p-actions"><button type="button" class="btn sm" data-expand="${esc(e.id)}">${S.expand.includes(e.id) ? 'Collapse' : 'Expand connections'}</button><button type="button" class="btn sm" data-focus="${esc(e.id)}">Show on map</button><button type="button" class="btn sm" data-path-from="${esc(e.id)}">Find a path from here</button><a class="btn sm" href="e/${encodeURIComponent(e.id)}.html">Static page</a></div>
    ${money}
    ${nextSteps(e)}
    ${myLeads.length ? panelSection('Pattern leads', `<p class="lead-note small"><strong>${esc(LEAD_NOTE)}</strong></p><ul class="ovs">${myLeads.slice(0, 8).map(L => `<li><button type="button" class="linkish" data-lead="${esc(L.id)}">${esc(L.title)}</button> <span class="muted small">${esc((LEAD_PAT[L.pattern] || {}).label || L.pattern)}</span>${leadDetailHtml(L)}</li>`).join('')}</ul>`, false, myLeads.length) : ''}
    ${legalRecordSection(e)}
    ${eventsSection(e)}${eventRoles(e)}${moneyTiedSection(e)}
    ${lobbyingFor(e)}
    ${corporateFamily(e)}
    ${chainsOf(e.id).length ? panelSection('Lobby to award', chainSection(chainsOf(e.id), { max: 12 }), true, chainsOf(e.id).length) : ''}
    ${panelSection('Connections', conn || '<p class="muted">No links.</p>', true, links.length)}
    ${nets.length || clu ? panelSection('Networks', nets.map(netCard).join('') + (clu ? netCard(clu) : ''), true, nets.length + (clu ? 1 : 0)) : ''}
    ${panelSection('Overlaps', ovSection(e.id), true, (OV_BY.get(e.id) || []).filter(ovVisible).length)}
    ${panelSection('Sources for this entity', srcList(e.sources), false, e.sources.length)}`;
}
function renderLink(l) {
  const t = LT(l.type); const corr = CORR.get('l:' + l.id);
  const thy = l.type === 'named_in_theory' || (typeof isTheoryLnk === 'function' && isTheoryLnk(l));
  if (thy) return `<div class="p-head"><div class="p-type"><span class="kindtag">Named in theory</span> ${layerChips(l)} <span class="badge thy-badge">Unverified</span></div>
    <h1 class="p-name small-h">${entBtn(l.from)} <span class="verb">${esc(t.label)}</span> ${entBtn(l.to)}</h1>
    <p class="thy-warn" role="note">${esc((D.meta.vocab && D.meta.vocab.THEORY_WARNING) || 'Unverified theory - reported claims only, educational, no wrongdoing alleged.')}</p>
    <div class="p-corr">${correctionLink('claim', l.id, claimLabel(l))}</div></div>
    ${l.description ? `<p>${esc(l.description)}</p>` : ''}
    ${panelSection('Sources', srcList(l.sources), false, l.sources.length)}`;
  return `<div class="p-head"><div class="p-type"><span class="kindtag">${esc(LINK_CATS[t.cat].label)}</span> ${layerChips(l)} ${seenBadge(l)}</div><h1 class="p-name small-h">${entBtn(l.from)} <span class="verb">${esc(t.label)}</span> ${entBtn(l.to)}</h1><div class="p-corr">${correctionLink('claim', l.id, claimLabel(l))}</div></div>
    <div class="claim-box">${lbadge(l)}${l.amount_cad > 0 ? `<div><b class="amt">${fmtCADfull(l.amount_cad)}</b> ${estTag(l)} <span class="muted">${esc(AMOUNT_KINDS[l.amount_kind]?.label || '')}</span></div>` : ''}${l.date ? `<div class="muted">Date: ${esc(l.date)}</div>` : '<div class="muted">Undated</div>'}${l.reported ? `<div class="muted">First reported: ${esc(l.reported)}</div>` : ''}</div>
    ${adminNote(l)}
    ${l.upstream_counted ? `<p class="upstream-note small" data-upstream-note>Part of upstream award ${LNK.has(l.parent_link_id) ? `<button type="button" class="linkish" data-link="${esc(l.parent_link_id)}">${esc(name(LNK.get(l.parent_link_id).from))} → ${esc(name(LNK.get(l.parent_link_id).to))}${LNK.get(l.parent_link_id).amount_cad > 0 ? ' ' + fmtCAD(LNK.get(l.parent_link_id).amount_cad) : ''}</button>` : esc(l.parent_link_id)}; not counted again.</p>` : ''}
    ${lobbyBlock(l)}
    ${chargeBlock(l)}
    ${l.descriptions && Object.keys(l.descriptions).length > 1 ? Object.entries(l.descriptions).map(([k, v]) => `<p>${layerChip(k)} ${esc(v)}</p>`).join('') : l.description ? `<p>${esc(l.description)}</p>` : ''}
    ${sourceLabels(l)}
    ${l.status_note ? `<p class="small"><b>Records check:</b> ${esc(l.status_note)}</p>` : ''}
    ${corr ? `<p class="small corr">Found in ${corr.map(k => layerChip(k)).join(' ')}: <span class="muted">cross-source corroboration</span></p>` : ''}
    ${isFlow(l) || (LT(l.type).cat === 'money') ? normBlock(l) : ''}
    ${explainSection(l)}
    ${fitsLine(l.id)}
    ${panelSection('Sources', srcList(l.sources), true, l.sources.length)}
    <p class="small muted">Claim id <code>${esc(l.id)}</code></p>`;
}
// Network storyline / timeline (v1.9): Map Guide storyline items + the network's dated evidence links (contracts, donations, lobbying, ...)
// + items derived at build time (n.timeline: dated entities and charge records linked to a member by any link, or via event_id money).
// Deduped by id (guide entries win). Display only: nothing here is added to money totals. Attendees are listed per person, never grouped.
const TL_MEM_CAP = 3;
const roleOf = (m, l) => { if (!l) return 'network member'; const t = LT(l.type); const r = l.from === m ? t.label : (t.inverse || t.label); return l.event_id && l.to !== l.event_id && l.from !== l.event_id ? `money tied to it (${r} ${name(l.from === m ? l.to : l.from)})` : r; };
const memRole = (m, lid) => { const me = ENT.get(m); const l = lid && LNK.get(lid); return `<span class="tl-mem" data-tl-mem="${esc(m)}">${entBtn(m)} <span class="muted small">${esc(roleOf(m, l))}${me && me.role ? ' · ' + esc(me.role) : ''}</span>${l ? ` <button type="button" class="linkish small" data-link="${esc(l.id)}">claim</button>` : ''}</span>`; };
function tlMembers(m) {
  const ms = m.filter(x => x[0]); if (!ms.length) return '';
  const head = ms.slice(0, TL_MEM_CAP).map(x => memRole(x[0], x[1])).join(' · '), rest = ms.slice(TL_MEM_CAP);
  return `<div class="small tl-mems">${head}${rest.length ? ` <details class="tl-more" data-tl-more><summary>+${rest.length} more</summary>${rest.map(x => memRole(x[0], x[1])).join(' · ')}</details>` : ''}</div>`;
}
const kindChip = e => `<span class="kindtag" data-tl-kind>${esc(e.type === 'event' ? (e.event_kind ? evKindLabel(e.event_kind) : 'Event') : (TYPE[e.type] || {}).label || e.type)}</span>`;
function netTimelineItems(n) {
  const sl = GUIDE.storylines && GUIDE.storylines[n.id]; const out = [], seen = new Set();
  for (const x of (sl && sl.items) || []) { const k = x.entity_id || x.link_id; if (!k || seen.has(k)) continue; seen.add(k); out.push({ g: x, d: x.date || '', k }); }
  for (const id of n.link_ids || []) { const l = LNK.get(id); if (!l || seen.has(id) || !(l.date || l.date_range)) continue; seen.add(id); out.push({ l, d: l.date || (l.date_range && l.date_range.start) || '', k: id }); }
  for (const it of n.timeline || []) { if (seen.has(it.id)) continue; if (it.k === 'c' ? !LNK.has(it.id) : !ENT.has(it.id)) continue; seen.add(it.id); out.push({ t: it, d: it.d || '', k: it.id }); }
  // timing-pattern leads touching the network (one of its evidence links, or 2+ members); display only, with the lead_detail line
  const mem = new Set(n.members || []), nl = new Set(n.link_ids || []);
  for (const L of LEADS || []) { const k = 'lead:' + L.id; if (seen.has(k)) continue; if (!(L.link_ids.some(id => nl.has(id)) || L.entities.filter(id => mem.has(id)).length >= 2)) continue; seen.add(k); out.push({ lead: L, d: (L.window && L.window.start) || '', k }); }
  return out.sort((a, b) => String(a.d).localeCompare(String(b.d)) || String(a.k).localeCompare(String(b.k)));
}
function tlItem(x) {
  if (x.lead) { const L = x.lead; return `<li class="sl-item sl-lead" data-sl="${esc(x.k)}" data-sl-from="lead"><span class="tl-d">${esc(x.d || 'undated')}</span> <span class="kindtag" data-tl-kind>${esc(LEAD_NOTE)}</span> <button type="button" class="linkish" data-lead="${esc(L.id)}">${esc(L.title)}</button>${leadDetailHtml(L)}</li>`; }
  if (x.g) { const g = x.g; const e = g.entity_id && ENT.get(g.entity_id); const stop = e && isStoppedEv(e); const mark = e && e.type === 'event' ? `<span class="sl-star${stop ? ' hollow' : ''}" aria-hidden="true">${stop ? '☆' : '★'}</span>` : '<span class="sl-dot" aria-hidden="true">•</span>';
    const btn = g.link_id && LNK.has(g.link_id) ? `<button type="button" class="linkish" data-link="${esc(g.link_id)}">${esc(g.text)}</button>` : `<button type="button" class="linkish" data-node="${esc(g.entity_id)}">${esc(g.text)}</button>`;
    return `<li class="sl-item${stop ? ' sl-stopped' : ''}" data-sl="${esc(x.k)}" data-sl-from="guide"><span class="tl-d">${esc(g.date || 'undated')}</span> ${mark} ${btn}${e && (stop || isUpcomingEv(e)) ? ' ' + evStatusBadge(e) : ''}</li>`; }
  if (x.l) { const l = x.l; return `<li class="sl-item" data-sl="${esc(l.id)}" data-sl-from="link"><span class="tl-d">${esc(l.date || l.date_range.start || '')}</span> <span class="sl-dot" aria-hidden="true">•</span> <button type="button" class="linkish" data-link="${esc(l.id)}">${esc(name(l.from))} <span class="verb">${esc(LT(l.type).label)}</span> ${esc(name(l.to))}</button>${l.amount_cad ? ` <span class="amt">${fmtCAD(l.amount_cad)}</span>` : ''} ${lbadge(l)}</li>`; }
  const it = x.t;
  if (it.k === 'c') { const l = LNK.get(it.id); return `<li class="sl-item sl-charge" data-sl="${esc(l.id)}" data-sl-from="derived"><span class="tl-d">${esc(it.d)}</span> <span class="kindtag" data-tl-kind>Charge record</span><ul class="legal-recs">${chargeRow(l)}</ul></li>`; }
  const e = ENT.get(it.id); const ev = e.type === 'event'; const stop = ev && isStoppedEv(e);
  const date = ev ? (evDate(e) || (e.expected && xDate(e.expected) ? 'expected ' + xDate(e.expected) : '')) : (e.date || (e.date_range ? [e.date_range.start, e.date_range.end].filter(Boolean).join(' – ') : ''));
  const mark = ev ? `<span class="sl-star${stop ? ' hollow' : ''}" aria-hidden="true">${stop ? '☆' : '★'}</span>` : '<span class="sl-dot" aria-hidden="true">•</span>';
  return `<li class="sl-item${stop ? ' sl-stopped' : ''}" data-sl="${esc(e.id)}" data-sl-from="derived"><span class="tl-d">${esc(date || it.d)}</span> ${mark} ${kindChip(e)} ${ev && (stop || isUpcomingEv(e)) ? evStatusBadge(e) + ' ' : ''}<button type="button" class="linkish" data-node="${esc(e.id)}">${esc(e.name)}</button>${tlMembers(it.m)}</li>`;
}
// next-step / tour hint {view:'timeline', network:id}: select the network, switch to the Timeline view and bring its Storyline/Timeline section into view
function scrollNetTimeline() { setTimeout(() => { const sl = document.querySelector('#panel [data-storyline]'); const sec = sl && (sl.closest('details,section') || sl); if (!sec) return; if (sec.tagName === 'DETAILS') sec.open = true; sec.dataset.tlOpen = '1'; sec.scrollIntoView({ block: 'start' }); }, 60); }
function openNetTimeline(id) { if (!NET.has(id)) { toast('Network not found'); return; } S.net = id; S.node = S.link = S.lead = null; S.ov = null; setView('timeline'); scrollNetTimeline(); announce(`Timeline for ${NET.get(id).name}`); }
function storylineSection(n) {
  const sl = GUIDE.storylines && GUIDE.storylines[n.id]; const items = netTimelineItems(n); if (!items.length) return '';
  const nd = items.filter(x => x.t).length;
  return panelSection(sl ? 'Storyline' : 'Timeline', `<p class="small muted">${sl ? '<span class="kindtag">Guide</span> ' : ''}Dated links, events and records in date order${nd ? `, including ${nd} item${nd === 1 ? '' : 's'} linked to members (derived from the links)` : ''}. Display only: nothing here adds to money totals.${sl && sl.tour_id ? ` <button type="button" class="linkish" data-tour-go="${esc(sl.tour_id)}">Take the tour</button>` : ''}</p>${pagedUl('class="storyline" data-storyline', items, tlItem)}`, true, items.length);
}
function renderNet(n) {
  const mem = n.members.map(id => `<li>${entBtn(id)} <span class="muted">${esc(TYPE[ENT.get(id)?.type]?.label || '')}</span></li>`).join('');
  const ev = n.auto ? D.links.filter(l => n.members.includes(l.from) && n.members.includes(l.to)) : n.link_ids.map(id => LNK.get(id)).filter(Boolean);
  return netCard(n) + storylineSection(n) + panelSection('Members', `<ul class="mem">${mem}</ul>`, true, n.members.length) + panelSection(n.auto ? 'Links inside the cluster' : 'Evidence links', `<ul class="claims">${ev.slice(0, 200).map(l => claimRow(l)).join('')}</ul>`, true, ev.length) + (n.auto ? '' : panelSection('Network sources', srcList(n.sources), false, n.sources.length));
}
function renderOverview() {
  const ents = F.ents.size, links = F.links.length; const flows = F.links.filter(isFlow); const tot = flows.filter(isFlowTotal).reduce((s, l) => s + l.amount_cad, 0);
  const est = F.links.filter(isEst).reduce((s, l) => s + l.amount_cad, 0);
  const top = [...F.ents].map(id => ENT.get(id)).sort((a, b) => b.degree - a.degree).slice(0, 8);
  const sc = {}; F.links.forEach(l => (sc[l.status] = (sc[l.status] || 0) + 1));
  const ov = visibleOverlaps().slice(0, 5);
  return `<p class="lead">${ents} entities · ${links} claims${tot ? ` · <span class="amt">${fmtCAD(tot)}</span> in recorded money flows` : ''}${est ? ` <span class="muted">(+${fmtCAD(est)} estimates/budgets not counted)</span>` : ''}</p>
    <div class="stat-badges">${STATUS_KEYS.filter(s => sc[s]).map(s => `${badge(s)} <span class="muted">${sc[s]}</span>`).join(' ')}</div>
    <p class="small muted">Click any node, line or search result for its profile. Reported claims come from the outlet's own reporting and are not independently verified.</p>
    ${panelSection('Most connected', `<ul class="mem">${top.map(e => `<li>${entBtn(e.id)} <span class="muted">${e.degree}</span></li>`).join('')}</ul>`)}
    ${ov.length ? panelSection('Strongest overlaps', `<p class="ov-tag">${esc(OV_NOTE)}</p><ul class="ovs">${ov.map(o => ovRow(o)).join('')}</ul><button type="button" class="linkish" data-view-go="overlaps">All overlaps →</button>`) : ''}`;
}
// items whose detail fields the open panel shows (progressive loading: fetched before the panel renders)
function panelNeeds() {
  if (S.node && ENT.has(S.node)) { const e = ENT.get(S.node); const ls = byNode.get(e.id) || []; const ev = ls.map(l => ENT.get(l.from === e.id ? l.to : l.from)).filter(isEvent); return [e, ...ls, ...moneyTiedTo(e.id), ...ev]; }
  if (S.link && LNK.has(S.link)) return [LNK.get(S.link)];
  if (S.net && NET.has(S.net)) { const n = NET.get(S.net); return (n.auto ? D.links.filter(l => n.members.includes(l.from) && n.members.includes(l.to)) : n.link_ids.map(id => LNK.get(id))).slice(0, 200); }
  if (S.ov != null && ovAt(S.ov)) return ovAt(S.ov).links.map(id => LNK.get(id));
  if (S.lead && LEAD.has(S.lead)) return LEAD.get(S.lead).link_ids.map(id => LNK.get(id));
  return [];
}
function renderPanel() {
  const body = $('#panel-body'); let kicker = 'Overview', html;
  const rd = ready(panelNeeds(), 'panel', () => setTimeout(renderPanel, 0));
  if (rd !== true) { const sel = !!(S.node || S.link || S.net || S.ov != null || S.lead); $('#panel-kicker').textContent = S.node ? 'Profile' : S.link ? 'Claim' : S.net ? 'Network' : S.ov != null ? 'Overlap' : S.lead ? 'Pattern lead' : 'Overview';
    body.innerHTML = rd === 'error' ? detailErr() : (S.node && ENT.has(S.node) ? `<div class="p-head"><div class="p-type">${typeChip(ENT.get(S.node).type)}</div><h1 class="p-name">${esc(ENT.get(S.node).name)}</h1></div>` : '') + loadingNote('details');
    document.body.classList.toggle('panel-open', sel); $('#btn-close').hidden = !sel; $('#btn-copy').hidden = !sel; $('#btn-print').hidden = !sel; return; }
  if (S.node && ENT.has(S.node)) { kicker = 'Profile'; html = renderEntity(ENT.get(S.node)); }
  else if (S.link && LNK.has(S.link)) { kicker = 'Claim'; html = renderLink(LNK.get(S.link)); }
  else if (S.net && NET.has(S.net)) { const n = NET.get(S.net); kicker = n.auto ? 'Auto-detected cluster' : 'Network'; html = renderNet(n); }
  else if (S.ov != null && ovAt(S.ov)) { kicker = 'Overlap'; html = renderOverlap(ovAt(S.ov)); }
  else if (S.lead && LEAD.has(S.lead)) { kicker = 'Pattern lead'; html = leadCard(LEAD.get(S.lead), true); }
  else html = renderOverview();
  $('#panel-kicker').textContent = kicker; body.innerHTML = html;
  const sel = !!(S.node || S.link || S.net || S.ov != null || S.lead);
  document.body.classList.toggle('panel-open', sel);
  $('#btn-close').hidden = !sel; $('#btn-copy').hidden = !sel; $('#btn-print').hidden = !sel;
}
$('#panel').addEventListener('click', e => {
  const t = e.target.closest('[data-node],[data-link],[data-net],[data-expand],[data-focus],[data-follow],[data-path-from],[data-ov],[data-view-go],[data-lead],[data-tour-go],[data-connect],[data-net-tl]'); if (!t) return;
  if (t.dataset.netTl) return openNetTimeline(t.dataset.netTl);
  if (t.dataset.lead) return openLead(t.dataset.lead);
  if (t.dataset.tourGo) return startTour(t.dataset.tourGo, 0);
  if (t.dataset.connect) return openConnect(t.dataset.connect);
  if (t.dataset.node) select({ node: t.dataset.node });
  else if (t.dataset.link) select({ link: t.dataset.link });
  else if (t.dataset.net) selectNet(S.net === t.dataset.net ? null : t.dataset.net);
  else if (t.dataset.expand) toggleExpand(t.dataset.expand);
  else if (t.dataset.focus) { setView('map'); setTimeout(focusSelection, 30); }
  else if (t.dataset.follow) { S.mfocus = true; S.node = t.dataset.follow; setView('money'); }
  else if (t.dataset.pathFrom) openConnect(t.dataset.pathFrom);
  else if (t.dataset.ov != null) select({ ov: +t.dataset.ov });
  else if (t.dataset.viewGo) setView(t.dataset.viewGo);
});

// ---- explain this link (Map Guide text, or an auto-generated sentence marked as such). Live values always win.
function autoSentence(l) {
  const t = LT(l.type); const st = STATUS[l.status] || STATUS.reported; const ls = seenOf(l).map(k => layerInfo(k).label);
  const amt = l.amount_cad > 0 ? ` The recorded amount is ${fmtCADfull(l.amount_cad)}${isEst(l) ? ` (${(AMOUNT_KINDS[l.amount_kind] || {}).label || 'estimate'}, not counted as money moved)` : ''}.` : '';
  return `${name(l.from)} ${t.label} ${name(l.to)}${l.date ? ` (${l.date})` : ''}, according to ${ls.join(' and ') || 'the source'}.${amt} Status: ${st.label.toLowerCase()}. ${l.sources.length} source${l.sources.length === 1 ? '' : 's'} listed.`;
}
function explainSection(l) {
  const x = EXPLAIN && EXPLAIN[l.id];
  const loading = !EXPLAIN && !EXTRA.loaded.explain; if (loading) loadExtra('explain');
  const diffs = [];
  if (x && x.guide_values) {
    const g = x.guide_values;
    if (g.status && g.status !== l.status) diffs.push(`status (guide: ${g.status}; map: ${l.status})`);
    if (g.amount != null && +g.amount !== +(l.amount_cad || 0)) diffs.push(`amount (guide: ${fmtCADfull(+g.amount) || g.amount}; map: ${fmtCADfull(l.amount_cad) || 'none'})`);
    if (g.date && g.date !== l.date) diffs.push(`date (guide: ${g.date}; map: ${l.date || 'undated'})`);
    if (g.layers && [].concat(g.layers).slice().sort().join() !== seenOf(l).slice().sort().join()) diffs.push(`layers (guide: ${[].concat(g.layers).join(', ')}; map: ${seenOf(l).join(', ')})`);
  }
  const body = loading ? loadingNote('explanation') : x && x.text ? `<p>${esc(x.text)}</p>${x.why_it_matters ? `<p class="small"><b>Why it matters:</b> ${esc(x.why_it_matters)}</p>` : ''}${x.sources && x.sources.length ? `<details class="c-src"><summary>Guide sources</summary>${srcList(x.sources)}</details>` : ''}<p class="small muted">Plain-language explanation from the Map Guide. The badge, amount and date above are the live map values.${diffs.length ? '' : ''}</p>${diffs.length ? `<p class="small guide-diff">Note: the guide text was written with a different ${esc(diffs.join('; '))}. The map shows the current value.</p>` : ''}`
    : `<p>${esc(autoSentence(l))}</p><p class="small muted"><span class="kindtag">Auto-generated</span> This sentence was generated automatically from the link's data; no guide explanation exists yet.</p>`;
  return `<section class="explain" data-guide="explain"><h3 class="lbl">Explain this link</h3>${body}${lobbyBlock(l, true)}</section>`;
}
// 'See where it fits': storylines (Map Guide) that place this entity or link; opens the network with its Storyline
let FITS = null;
function fitsOf(id) {
  if (!FITS) { FITS = new Map(); for (const [nid, sl] of Object.entries(GUIDE.storylines || {})) { if (!NET.has(nid)) continue; for (const x of sl.items || []) for (const k of [x.entity_id, x.link_id]) if (k) { const a = FITS.get(k) || FITS.set(k, []).get(k); if (!a.includes(nid)) a.push(nid); } } }
  return FITS.get(id) || [];
}
const fitsBtns = id => fitsOf(id).slice(0, 3).map(nid => `<button type="button" class="linkish" data-net="${esc(nid)}" data-fits="${esc(nid)}">See where it fits: ${esc((GUIDE.storylines[nid] || {}).title || NET.get(nid).name)}</button>`);
const fitsLine = id => { const b = fitsBtns(id); return b.length ? `<p class="small fits-line"><span class="kindtag">Guide</span> ${b.join(' · ')}</p>` : ''; };
// ---- suggested next steps (Map Guide, else auto-generated)
function nextSteps(e) {
  let steps = (GUIDE.next_steps && GUIDE.next_steps[e.id]) || null; let auto = false;
  if (!steps || !steps.length) {
    auto = true; steps = [];
    const links = (byNode.get(e.id) || []).slice().sort((a, b) => (STATUS_KEYS.indexOf(a.status) - STATUS_KEYS.indexOf(b.status)) || (b.amount_cad || 0) - (a.amount_cad || 0));
    const seenN = new Set();
    for (const l of links) { const o = l.from === e.id ? l.to : l.from; if (seenN.has(o)) continue; seenN.add(o); steps.push({ label: `See ${name(o)}`, entity_id: o }); if (steps.length >= 2) break; }
    if (links.some(isFlow)) steps.push({ label: 'Follow the money through this entity', view: 'money' });
    const tour = (GUIDE.tours || []).find(t => t.id !== 'first-visit' && t.steps.some(st => (st.entity_ids || []).includes(e.id)));
    if (tour) steps.push({ label: `Take the tour: ${tour.title}`, tour_id: tour.id });
    if (LEADS.some(L => L.entities.includes(e.id))) steps.push({ label: 'See pattern leads involving it', view: 'leads' });
    if (typeof hasTheorySwitch === 'function' && hasTheorySwitch(e)) steps.push({ label: 'Show unverified theories naming this node', thy_switch: e.id });
  }
  if (!steps.length && !fitsOf(e.id).length) return '';
  const btn = st => st.entity_id && ENT.has(st.entity_id) ? `<button type="button" class="linkish" data-node="${esc(st.entity_id)}">${esc(st.label)}</button>`
    : st.link_id && LNK.has(st.link_id) ? `<button type="button" class="linkish" data-link="${esc(st.link_id)}">${esc(st.label)}</button>`
    : st.tour_id ? `<button type="button" class="linkish" data-tour-go="${esc(st.tour_id)}">${esc(st.label)}</button>`
    : st.network && NET.has(st.network) ? `<button type="button" class="linkish" data-net-tl="${esc(st.network)}">${esc(st.label)}</button>`
    : st.thy_switch && ENT.has(st.thy_switch) ? `<button type="button" class="linkish" data-thy-switch="${esc(st.thy_switch)}">${esc(st.label)}</button>`
    : st.view === 'money' ? `<button type="button" class="linkish" data-follow="${esc(e.id)}">${esc(st.label)}</button>`
    : st.view && VIEWS.includes(st.view) ? `<button type="button" class="linkish" data-view-go="${esc(st.view)}">${esc(st.label)}</button>` : '';
  const items = [...fitsBtns(e.id), ...steps.map(btn).filter(Boolean)]; if (!items.length) return '';
  return `<section class="next-steps"><h3 class="lbl">Suggested next steps${auto ? ' <span class="kindtag">Auto-generated</span>' : ''}</h3><ul>${items.map(x => `<li>${x}</li>`).join('')}</ul></section>`;
}

// v1.10 tags: each shown as an attributed label ("Tag: X, per <source>") or "Unattributed label: X". Never a filter or facet.
function tagRef(e, ref) {
  const s = (e.sources || []).find(x => x.id === ref || x.url === ref || x.sid === ref);
  const u = safeUrl((s && s.url) || (/^https?:\/\//i.test(ref) ? ref : ''));
  let host = ''; try { host = u ? new URL(u).hostname.replace(/^www\./, '') : ''; } catch (_) {}
  const label = (s && (s.publisher || s.title)) || host || ref;
  return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : esc(label);
}
function tagLabels(e) {
  const T = e.tags || []; if (!T.length) return '';
  const TS = e.tag_sources || {};
  return `<ul class="tag-labels" data-tag-labels>${T.map(t => { const refs = TS[t] || [];
    return refs.length ? `<li data-tag-attr>Tag: ${esc(t)}, per ${refs.map(r => tagRef(e, r)).join(', ')}</li>` : `<li data-tag-unattr><span class="muted">Unattributed label:</span> ${esc(t)}</li>`; }).join('')}</ul>`;
}
// third-party label from a Bl00d Money item (quoted claim; profile/link detail ONLY, never a category, facet, colour, badge or tooltip)
function sourceLabels(x) {
  // third-party labels: quoted + attributed, profile/link detail only (never a tag, filter, facet, colour, network or tooltip)
  const L = x.source_labels || []; if (!L.length) return '';
  return L.map(y => {
    const u = safeUrl(y.url || (y.sources && y.sources[0] && y.sources[0].url));
    const text = y.display || `Label used by ${y.domain || 'the source'}: “${y.label}”`;
    return `<blockquote class="src-label">${u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>` : esc(text)} <span class="src-label-meta">${y.source_layer ? layerChip(y.source_layer, true) : ''} ${badge(y.status || 'reported')}</span><span class="sr-only"> (a third-party label, quoted; not a finding of this map)</span></blockquote>`;
  }).join('');
}

// ---- 62-lobbying.js
/* lobbying: subjects, targets, communications and registration on lobbied / lobbied_on links; "Lobbying for" on profiles;
   "Lobby to award" sequences (display-only: never badged, never added to totals). Nothing is shown when a field is absent. */
const LOBBY_LT = new Set(['lobbied', 'lobbied_on']);
const CHAIN_NOTE = 'Timing pattern'; // short UI caveat; full wording stays in data (V.CHAIN_NOTE)
const REG_TYPES = V.REGISTRANT_TYPES || {};
const CHAINS = D.chains || [];
const lob = l => (l && LOBBY_LT.has(l.type) && l.lobbying) || null;
const SUBJECTS = (() => { const c = new Map(); for (const l of D.links) for (const s of lob(l)?.subjects || []) c.set(s, (c.get(s) || 0) + 1); return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); })();
const LOBBY_TYPES_USED = [...LOBBY_LT].filter(t => D.links.some(l => l.type === t));
const subjChip = (s, attrs = '') => `<span class="subj" ${attrs}>${esc(s)}</span>`;
const partyHtml = x => !x ? '' : x.entity_id && ENT.has(x.entity_id) ? entBtn(x.entity_id) : esc(x.name);
const regLink = (u, label = 'Lobbying registry record') => { const s = safeUrl(u); return s ? `<a class="reg-link" href="${esc(s)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : ''; };
function commsList(cm) {
  return `<ol class="comms">${cm.map(c => { const s = c.source && (safeUrl(c.source.url) ? `<a href="${esc(safeUrl(c.source.url))}" target="_blank" rel="noopener noreferrer">source</a>` : esc(c.source.title || '')); return `<li><span class="tl-date">${esc(c.date || 'undated')}</span> ${c.officials ? c.officials.map(o => `<span class="official"><b>${esc(o.name)}</b>${o.title ? ` <span class="muted">(${esc(o.title)})</span>` : ''}</span>`).join('; ') : c.official ? `<b>${esc(c.official)}</b>` : ''}${c.official && c.institution ? ', ' : ''}${c.institution ? `<span>${esc(c.institution)}</span>` : ''}${s ? ` <span class="muted small">· ${s}</span>` : ''}${safeUrl(c.report_url) ? ` <a class="small comm-report" href="${esc(safeUrl(c.report_url))}" target="_blank" rel="noopener noreferrer">Communication report</a>` : ''}${c.subjects ? `<div class="comm-subj small muted">${c.subjects.map(x => `<span class="csubj">${esc(x)}</span>`).join(' ')}</div>` : ''}</li>`; }).join('')}</ol>`;
}
// link panel block (full) or compact (Explain this link)
function lobbyBlock(l, compact) {
  const x = lob(l); if (!x) return '';
  const parts = [];
  if (x.subjects) parts.push(`<div class="lob-row"><span class="lbl">Subjects</span> <span class="subjs">${x.subjects.map(s => subjChip(s)).join('')}</span></div>`);
  if (x.targets) parts.push(`<div class="lob-row"><span class="lbl">Lobbied on</span> <ul class="lob-targets">${x.targets.map(t => `<li>${partyHtml(t)}${t.entity_id && ENT.has(t.entity_id) ? ` <span class="muted small">${esc(TYPE[ENT.get(t.entity_id).type]?.label || '')}</span>` : ''}</li>`).join('')}</ul></div>`);
  if (x.communications) parts.push(compact ? `<div class="lob-row small muted">${x.communications.length} communication${x.communications.length === 1 ? '' : 's'} recorded${commRange(x.communications)}</div>` : `<div class="lob-row"><span class="lbl">Communications <span class="muted">${x.communications.length}</span></span>${commsList(x.communications)}</div>`);
  const reg = [['Client', partyHtml(x.client)], ['Firm', partyHtml(x.firm)], ['Registrant', x.registrant ? esc(x.registrant) : ''], ['Registrant type', x.registrant_type ? esc(REG_TYPES[x.registrant_type] || x.registrant_type) : ''], ['Registration start', x.registration_start ? esc(x.registration_start) : ''], ['Registration end', x.registration_end ? esc(x.registration_end) : '']].filter(r => r[1]);
  if (reg.length && !compact) parts.push(`<div class="lob-reg"><h4 class="lbl">Registration</h4><dl class="kv">${reg.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>`);
  if (x.registry_url) parts.push(`<div class="lob-row">${regLink(x.registry_url)}</div>`);
  if (!parts.length) return '';
  return compact ? `<div class="lobbying compact">${parts.join('')}</div>` : `<section class="lobbying" data-guide="lobbying"><h3 class="lbl">Lobbying detail</h3>${parts.join('')}<p class="small muted">From the lobbying registry entry as the source gives it; the claim's badge above is unchanged.</p></section>`;
}
const commRange = cm => { const d = cm.map(c => c.date).filter(Boolean).sort(); return d.length ? ` (${d[0]}${d.length > 1 && d[d.length - 1] !== d[0] ? ' – ' + d[d.length - 1] : ''})` : ''; };
// profile: "Lobbying for", grouped by subject (lobby side: links FROM this entity)
function lobbyingFor(e) {
  const ls = (byNode.get(e.id) || []).filter(l => l.from === e.id && LOBBY_LT.has(l.type));
  if (!ls.length) return '';
  const withData = ls.filter(lob); if (!withData.length) return '';
  const groups = new Map();
  for (const l of withData) for (const s of (l.lobbying.subjects && l.lobbying.subjects.length ? l.lobbying.subjects : [''])) (groups.get(s) || groups.set(s, []).get(s)).push(l);
  const keys = [...groups.keys()].sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1) || groups.get(b).length - groups.get(a).length || a.localeCompare(b));
  const body = keys.map(s => {
    const g = groups.get(s); const tg = new Map(); const cm = []; const regs = new Set();
    for (const l of g) { for (const t of l.lobbying.targets || []) { const k = t.entity_id || t.name.toLowerCase(), p = tg.get(k); tg.set(k, p && p.first_mentioned && (!t.first_mentioned || p.first_mentioned < t.first_mentioned) ? p : t); } if (l.type === 'lobbied_on' && !(l.lobbying.targets || []).some(t => t.entity_id === l.to)) tg.set(l.to, { name: name(l.to), entity_id: l.to }); cm.push(...(l.lobbying.communications || [])); if (l.lobbying.registry_url) regs.add(l.lobbying.registry_url); }
    const inst = [...new Set(g.filter(l => l.type === 'lobbied').map(l => l.to))];
    return `<div class="lob-subj"><h4>${s ? subjChip(s) : '<span class="muted">Subject not listed</span>'} <span class="muted small">${g.length} registration link${g.length === 1 ? '' : 's'}</span></h4>
      ${tg.size ? `<div class="small"><span class="lbl">Lobbied on</span> ${[...tg.values()].map(t => partyHtml(t) + (t.first_mentioned ? ` <span class="muted small tfm">Target first named in registry ${esc(t.first_mentioned)}</span>` : '')).join(' · ')}</div>` : ''}
      ${inst.length ? `<div class="small"><span class="lbl">Lobbied</span> ${inst.map(entBtn).join(' · ')}</div>` : ''}
      ${cm.length ? `<div class="small muted">${cm.length} communication${cm.length === 1 ? '' : 's'}${commRange(cm)}</div>` : ''}
      <div class="small">${g.map(l => `<button type="button" class="linkish small" data-link="${esc(l.id)}">claim</button>`).join(' ')} ${[...regs].map((u, i) => regLink(u, regs.size > 1 ? `Registry record ${i + 1}` : 'Registry record')).join(' ')}</div></div>`;
  }).join('');
  return panelSection('Lobbying for', `<div data-guide="lobbying-for">${body}</div>`, true, keys.filter(Boolean).length || undefined);
}
// "Lobby to award" sequences
const chainsOf = id => CHAINS.filter(c => c.lobby === id || c.client === id || c.target === id || c.recipient === id);
function chainRow(c) {
  const m = LNK.get(c.money_link), L = LNK.get(c.lobby_link); if (!m || !L) return '';
  return `<li class="chain"><ol class="chain-steps">
    <li>${entBtn(c.lobby)} <span class="verb">${esc(LT(L.type).label)}</span> ${entBtn(c.target)} <span class="muted small">${c.target_first_mentioned ? `Target first named in registry ${esc(c.target_first_mentioned)}` : `first communication ${esc(c.first_communication)}`}</span> <button type="button" class="linkish small" data-link="${esc(L.id)}">claim</button></li>
    <li>${c.via ? `${entBtn(c.via)} <span class="muted small">(linked to ${esc(name(c.target))})</span>` : entBtn(c.target)} <span class="verb">${esc(LT(m.type).label)}</span> ${entBtn(c.recipient)}${m.amount_cad > 0 ? ` <span class="amt">${fmtCAD(m.amount_cad)}</span>` : ''} <span class="muted small">${esc(m.date)} · ${c.gap_days} days later</span> <button type="button" class="linkish small" data-link="${esc(m.id)}">claim</button></li></ol></li>`;
}
function chainSection(list, opts = {}) {
  if (!list.length) return '';
  return `<div class="chains" data-guide="lobby-to-award"><p class="lead-note small"><strong>${esc(CHAIN_NOTE)}</strong></p><p class="small muted">Each step is a separate claim with its own badge and sources. Amounts are already counted once in the money totals; a sequence adds nothing to them.</p><ul class="chain-list">${list.slice(0, opts.max || 50).map(chainRow).join('')}</ul></div>`;
}
function renderMoneyChains() {
  const el = $('#m-chains'); if (!el) return;
  const vis = CHAINS.filter(c => F.ents.has(c.lobby) && F.linkSet.has(c.money_link) && F.linkSet.has(c.lobby_link) && (!S.mfocus || !S.node || [c.lobby, c.client, c.target, c.recipient, c.via].includes(S.node)));
  el.hidden = !vis.length; el.innerHTML = vis.length ? `<h3 class="lbl">Lobby to award <span class="muted">${vis.length}</span></h3>${chainSection(vis)}` : '';
}
$('#m-chains')?.addEventListener('click', e => { const t = e.target.closest('[data-node],[data-link]'); if (!t) return; t.dataset.link ? select({ link: t.dataset.link }) : select({ node: t.dataset.node }); });
// filters: lobbying link types + subject facet (policy topics only; never identity-based)
function lobbyPass(l) {
  if (LOBBY_LT.has(l.type) && !S.ltypes.has(l.type)) return false;
  if (S.subj.size) { const x = lob(l); if (!x || !(x.subjects || []).some(s => S.subj.has(s))) return false; }
  return true;
}
function renderLobbyFilters(first) {
  const sec = $('#f-lobby-sec'); if (!sec) return;
  if (first) {
    sec.hidden = !LOBBY_TYPES_USED.length && !SUBJECTS.length;
    const n = t => D.links.filter(l => l.type === t).length;
    $('#f-ltypes').innerHTML = [...LOBBY_LT].map(t => chip(LT(t).label, null, true, `data-ltype="${t}"${n(t) ? '' : ' title="None in the current data"'}`, n(t))).join('');
    $('#f-subj').innerHTML = SUBJECTS.length ? SUBJECTS.map(([s, c]) => chip(s, null, false, `data-subj="${esc(s)}"`, c)).join('') : '<p class="help">No subject-matter data in the current build.</p>';
  }
  $$('#f-ltypes [data-ltype]').forEach(b => b.setAttribute('aria-pressed', S.ltypes.has(b.dataset.ltype)));
  $$('#f-subj [data-subj]').forEach(b => b.setAttribute('aria-pressed', S.subj.has(b.dataset.subj)));
}
$('#f-ltypes')?.addEventListener('click', e => { const b = e.target.closest('[data-ltype]'); if (!b) return; const t = b.dataset.ltype; if (S.ltypes.has(t)) S.ltypes.delete(t); else S.ltypes.add(t); update(); });
$('#f-subj')?.addEventListener('click', e => { const b = e.target.closest('[data-subj]'); if (!b) return; const s = b.dataset.subj; if (S.subj.has(s)) S.subj.delete(s); else S.subj.add(s); update(); });
// Ethics / Lobbying Commissioner outcomes: neutral context so an administrative finding is never read as a criminal one
const ADMIN_LT = new Set(['penalized', 'investigated', 'conflict_screen']);
function adminNote(l) {
  // only commissioner outcomes: the three admin types, or a `regulated` link from (or sourced to) the Ethics / Lobbying Commissioner.
  // Never on other regulators' authorizations (e.g. a health regulator's approval).
  const COMM_RE = /conflict of interest and ethics commissioner|ethics commissioner|commissioner of lobbying|lobbying commissioner/i;
  const isComm = COMM_RE.test(ENT.get(l.from)?.name || '') || (l.sources || []).some(s => COMM_RE.test(`${s.publisher || ''} ${s.registry || ''}`));
  if (!ADMIN_LT.has(l.type) && !(l.type === 'regulated' && isComm)) return '';
  return `<p class="admin-note small" data-admin-note>An administrative finding, penalty or compliance measure by an ethics or lobbying commissioner, as the public record states it. It is not a criminal charge or conviction. Any legal status is shown only on a person's profile, exactly as its source states it.</p>`;
}

// ---- 63-intermediaries.js
// ---- money through intermediaries: multi-hop chains, corporate family, and the connection-finder mode
// Each hop is its own claim (own amount, date, source, badge). Amounts are never added across hops.
const MCHAINS = D.money_chains || [];
const MI = D.meta.intermediaries || {};
const CORP_LT = new Set(['subsidiary_of', 'owns']);
const isMoneyHopC = l => LT(l.type).cat === 'money' && !(l.amount_cad > 0 && NON_FLOW.has(l.amount_kind));
const firstSrc = l => (l.sources || [])[0];
function hopRow(h, i) {
  const l = LNK.get(h.link); if (!l) return '';
  const s = firstSrc(l);
  const kind = h.kind === 'corporate' ? '<span class="hop-kind corp" title="Corporate connector: not a payment">corporate connector</span>' : h.kind === 'documented' ? '<span class="hop-kind doc" title="This step cites the upstream award it came from (parent_link_id)">documented pass-through</span>' : h.kind === 'possible' ? '<span class="hop-kind poss" title="Later-dated money leaving the intermediary; not shown to be the same dollars">possible next step</span>' : '<span class="hop-kind">money</span>';
  const pct = l.ownership_pct != null ? ` <span class="muted small">${esc(l.ownership_pct)}%</span>` : '';
  return `<li data-hop="${i}">${kind} ${entBtn(l.from)} <span class="verb">${esc(LT(l.type).label)}</span> ${entBtn(l.to)}${pct}${l.amount_cad > 0 && h.kind !== 'corporate' ? ` <span class="amt">${fmtCAD(l.amount_cad)}</span> ${estTag(l)}` : ''} <span class="muted small">${esc(l.date || 'undated')}</span> ${lbadge(l)}${s ? ` <ul class="src-cite small">${srcLink(s)}</ul>` : ''} <button type="button" class="linkish small" data-link="${esc(l.id)}">claim</button></li>`;
}
function mchainRow(c) {
  return `<li class="mchain ${esc(c.kind)}" data-mchain="${esc(c.id)}"><p class="small ${c.kind === 'possible' ? 'possible-note' : 'doc-note'}"><strong>${c.kind === 'possible' ? 'Possible path' : 'Documented pass-through'}</strong> · ${c.hops.length} hops · ${esc(c.kind === 'possible' ? MI.possible_note || '' : MI.documented_note || '')}</p><ol class="hops">${c.hops.map(hopRow).join('')}</ol></li>`;
}
function mchainsFor(id) { return MCHAINS.filter(c => c.nodes.includes(id)); }
function renderIntermediaryChains() {
  const el = $('#m-mchains'); if (!el) return;
  const vis = MCHAINS.filter(c => c.hops.every(h => F.linkSet.has(h.link)) && (!S.mfocus || !S.node || c.nodes.includes(S.node)));
  el.hidden = !vis.length;
  { const rd = ready(vis.slice(0, 40).flatMap(c => c.hops.map(h => LNK.get(h.link))), 'money', () => { if (S.view === 'money') setTimeout(renderIntermediaryChains, 0); }); if (rd !== true) { el.innerHTML = rd === 'error' ? detailErr() : loadingNote('money chains'); return; } }
  el.innerHTML = vis.length ? `<h3 class="lbl">Money through intermediaries <span class="muted">${vis.length}</span></h3><p class="small muted">Up to ${esc(MI.max_hops || 4)} hops, strongest first. Each step shows its own amount, date, source and badge. <strong>Amounts are never added up across steps.</strong> Corporate links (subsidiary / owner) are shown as connectors, not payments.</p><ul class="mchain-list">${vis.slice(0, 40).map(mchainRow).join('')}</ul>` : '';
}
$('#m-mchains')?.addEventListener('click', e => { const t = e.target.closest('[data-node],[data-link]'); if (!t) return; t.dataset.link ? select({ link: t.dataset.link }) : select({ node: t.dataset.node }); });
// profile: Corporate family (parents, subsidiaries, owners/holdings, affiliates) with ownership % and sources
function corporateFamily(e) {
  const rows = { parents: [], subs: [], owners: [], holdings: [], affiliates: [] };
  for (const l of D.links) {
    if (l.from !== e.id && l.to !== e.id) continue;
    if (l.type === 'subsidiary_of') (l.from === e.id ? rows.parents : rows.subs).push([l, l.from === e.id ? l.to : l.from]);
    else if (l.type === 'owns') (l.to === e.id ? rows.owners : rows.holdings).push([l, l.to === e.id ? l.from : l.to]);
    else if (l.type === 'affiliated_with') rows.affiliates.push([l, l.from === e.id ? l.to : l.from]);
  }
  const n = Object.values(rows).reduce((s, r) => s + r.length, 0); if (!n) return '';
  const li = ([l, other]) => { const s = firstSrc(l); return `<li>${entBtn(other)}${l.ownership_pct != null ? ` <span class="amt" title="ownership share">${esc(l.ownership_pct)}%</span>` : ''} ${lbadge(l)} ${s ? `<ul class="src-cite small">${srcLink(s)}</ul>` : ''} <button type="button" class="linkish small" data-link="${esc(l.id)}">claim</button></li>`; };
  const grp = (t, r) => r.length ? `<h4 class="small">${t} <span class="muted">${r.length}</span></h4><ul class="corp-list">${r.map(li).join('')}</ul>` : '';
  return `<section class="corp-family" data-guide="corporate-family"><h3 class="lbl">Corporate family</h3>${grp('Parent companies', rows.parents)}${grp('Subsidiaries', rows.subs)}${grp('Owned by', rows.owners)}${grp('Owns', rows.holdings)}${grp('Affiliates', rows.affiliates)}<p class="small muted">Corporate links are relationships, not payments; they are never counted in money totals.</p></section>`;
}
// connection finder mode: money + corporate links only; money steps follow the money's direction in date order
const dLo = d => { const [y, m, dd] = String(d || '').split('-'); return y ? `${y}-${m || '01'}-${dd || '01'}` : ''; };
function moneyPaths(a, b, links, max = 3, maxHops = MI.max_hops || 4) {
  const out = []; const money = new Map(), corp = new Map();
  for (const l of links) {
    if (isMoneyHopC(l) && l.from !== l.to) (money.get(l.from) || money.set(l.from, []).get(l.from)).push(l);
    else if (CORP_LT.has(l.type)) for (const [x, y] of [[l.from, l.to], [l.to, l.from]]) (corp.get(x) || corp.set(x, []).get(x)).push([l, y]);
  }
  const run = (src, dst) => {
    const rec = (at, hops, nodes, lastDate) => {
      if (at === dst && hops.length) { out.push({ links: hops.slice(), nodes: nodes.slice(), from: src }); return; }
      if (hops.length >= maxHops) return;
      for (const l of money.get(at) || []) { if (nodes.includes(l.to) || !l.date || (lastDate && dLo(l.date) < lastDate)) continue; rec(l.to, [...hops, l.id], [...nodes, l.to], dLo(l.date)); }
      if (!hops.length || !CORP_LT.has(LNK.get(hops[hops.length - 1]).type)) for (const [l, y] of corp.get(at) || []) { if (nodes.includes(y)) continue; rec(y, [...hops, l.id], [...nodes, y], lastDate); }
    };
    rec(src, [], [src], '');
  };
  run(a, b); run(b, a);
  const firstDate = p => p.links.map(id => LNK.get(id)).find(l => !CORP_LT.has(l.type))?.date || '9999';
  return out.filter(p => p.links.some(id => !CORP_LT.has(LNK.get(id).type))).sort((x, y) => x.links.length - y.links.length || firstDate(x).localeCompare(firstDate(y))).slice(0, max);
}
function moneyPathsHtml(P, aId, bId) {
  if (!P.length) return `<p class="muted" data-mvia-empty>No chain of money and corporate links, in date order, connects <b>${esc(name(aId))}</b> and <b>${esc(name(bId))}</b> with the current filters. Turn off “Follow money through intermediaries” to see any kind of connection.</p>`;
  return `<p class="small"><strong>Money through intermediaries</strong> · money steps follow the direction of payment, in date order; corporate links are connectors. ${esc(MI.possible_note || '')}</p>` + P.map((p, i) => `<h3 class="lbl">Path ${i + 1}</h3><ol class="path mvia" aria-label="Money path ${i + 1}">${p.links.map(id => { const l = LNK.get(id); return hopRow({ link: id, kind: CORP_LT.has(l.type) ? 'corporate' : l.type === 'passed_through' && l.parent_link_id && p.links.includes(l.parent_link_id) ? 'documented' : 'money' }, 0); }).join('')}</ol>`).join('');
}

// ---- 65-leads.js
/* leads: timing patterns in public data (flagged by the records collector or detected by the map). Never a finding. */
const leadPatLabel = p => (LEAD_PAT[p] || {}).label || p;
function leadPass(L) {
  if (!S.lpat.has(L.pattern) && !(L.pattern === 'other' && S.lpat.has('other'))) return false;
  if (S.llayer !== 'all' && !(L.layers || []).includes(S.llayer)) return false;
  if (S.lprov !== 'all' && !(L.provinces || []).includes(S.lprov)) return false;
  if (S.lmin && !((L.amount_cad || 0) >= S.lmin)) return false;
  const st = L.window?.start || '', en = L.window?.end || st;
  if (S.lfrom && en && en < S.lfrom) return false;
  if (S.lto && st && st.slice(0, S.lto.length) > S.lto) return false;
  return true;
}
// timing text comes from the build (gap, a range, 'Contract date …' / 'Start date …', 'Starts …; timing unknown' or 'timing unknown'); never a made-up 0
const leadTiming = L => L.timing || { mode: 'unknown', text: 'timing unknown' };
// lead_detail (v1.10): one plain line naming both items, the gap (never 0, never for an open window) and a source for each side. Built at build time.
function leadSideHtml(x) {
  const u = x.source && safeUrl(x.source.url);
  const src = u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(x.source.label || hostOfUrl(u) || 'source')}</a>` : esc((x.source && x.source.label) || 'none given');
  return `${esc(x.who || '?')} ${esc(x.what || '')}${x.amount ? `, <span class="amt">${esc(x.amount)}</span>` : ''}, ${esc(x.date || 'undated')} (source: ${src})`;
}
function leadDetailHtml(L) {
  const d = L.lead_detail;
  if (!d) return '<p class="lead-detail small muted" data-lead-detail="pending">Detail pending</p>';
  if (!d.a) return `<p class="lead-detail small" data-lead-detail="${esc(d.origin)}">${esc(d.text)}</p>`;
  return `<p class="lead-detail small" data-lead-detail="${esc(d.origin)}">${leadSideHtml(d.a)}; ${leadSideHtml(d.b)}${d.gap_days > 0 ? `. Gap: <span data-lead-gap>${d.gap_days} days</span>` : ''}.</p>`;
}
function leadCard(L, inPanel) {
  const steps = L.link_ids.map(id => LNK.get(id)).filter(Boolean).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const tm = leadTiming(L);
  return `<article class="lead-card${S.lead === L.id ? ' on' : ''}" data-lead-card="${esc(L.id)}">
    <div class="lc-head"><span class="kindtag">${esc(leadPatLabel(L.pattern))}</span> <span class="origin">${esc(L.origin_label || '')}</span> ${(L.layers || []).map(k => layerChip(k, true)).join('')}</div>
    <h3 class="lc-title">${inPanel ? esc(L.title) : `<button type="button" class="linkish" data-lead="${esc(L.id)}">${esc(L.title)}</button>`}</h3>
    <p class="lead-note small"><strong>${esc(LEAD_NOTE)}</strong></p>
    ${leadDetailHtml(L)}
    ${L.summary ? `<p class="small">${esc(L.summary)}</p>` : ''}
    <div class="lc-ents">${L.entities.filter(id => ENT.has(id)).map(entBtn).join(' · ')}</div>
    <div class="lc-meta small">${tm.mode === 'gap' && L.window?.start ? `<span>Window ${esc(L.window.start)}${L.window.end && L.window.end !== L.window.start ? ' → ' + esc(L.window.end) : ''}</span> · ` : ''}<span class="lc-gap" data-timing="${esc(tm.mode)}">${esc(tm.text)}</span>${L.amount_cad > 0 ? ` · <span class="amt">${fmtCAD(L.amount_cad)}</span>` : ''}${(L.provinces || []).length ? ` · ${esc(L.provinces.join(', '))}` : ''}</div>
    <ol class="lc-tl">${steps.map(l => `<li><span class="tl-date">${esc(l.date || 'undated')}</span> ${entBtn(l.from)} <span class="verb">${esc(LT(l.type).label)}</span> ${entBtn(l.to)} ${l.amount_cad > 0 ? `<span class="amt">${fmtCAD(l.amount_cad)}</span> ${estTag(l)}` : ''} ${lbadge(l)} ${layerChips(l)} <button type="button" class="linkish small" data-link="${esc(l.id)}">claim</button><details class="c-src"><summary>${l.sources.length} source${l.sources.length === 1 ? '' : 's'}</summary>${srcList(l.sources)}</details></li>`).join('')}</ol>
    ${L.sources && L.sources.length ? `<details class="c-src"><summary>Lead sources (${L.sources.length})</summary>${srcList(L.sources)}</details>` : ''}
    <div class="nc-act">${inPanel ? '' : `<button type="button" class="btn sm" data-lead="${esc(L.id)}">Show on map</button>`} <span class="muted small">lead id <code>${esc(L.id)}</code></span></div>
  </article>`;
}
function openLead(id) { if (!LEAD.has(id)) return; S.node = S.link = S.net = null; S.ov = null; S.lead = id; setView('map'); setTimeout(focusSelection, 40); announce('Showing pattern lead: ' + LEAD.get(id).title); }
function renderLeads() {
  $('#lead-disclaimer').textContent = LEAD_NOTE;
  if (!EXTRA.loaded.leads) { $('#l-list').innerHTML = loadingNote('leads'); loadExtra('leads'); return; }
  if (!renderLeads._built) {
    renderLeads._built = true;
    const cnt = {}; LEADS.forEach(L => (cnt[L.pattern] = (cnt[L.pattern] || 0) + 1));
    $('#l-pats').innerHTML = Object.keys(LEAD_PAT).map(p => chip(leadPatLabel(p), null, true, `data-lpat="${p}" title="${esc(LEAD_PAT[p].desc || '')}"`, cnt[p] || 0)).join('');
    $('#l-layer').innerHTML = `<option value="all">all layers</option>` + LAYER_KEYS.map(k => `<option value="${k}">${esc(layerInfo(k).label)}</option>`).join('');
    const provs = [...new Set(LEADS.flatMap(L => L.provinces || []))].sort();
    $('#l-prov').innerHTML = `<option value="all">all</option>` + provs.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  }
  $$('#l-pats [data-lpat]').forEach(b => b.setAttribute('aria-pressed', S.lpat.has(b.dataset.lpat)));
  $('#l-layer').value = S.llayer; $('#l-prov').value = S.lprov; $('#l-min').value = String(S.lmin);
  if (document.activeElement !== $('#l-from')) $('#l-from').value = S.lfrom; if (document.activeElement !== $('#l-to')) $('#l-to').value = S.lto;
  const vis = LEADS.filter(leadPass);
  { const rd = ready(vis.flatMap(L => L.link_ids.map(id => LNK.get(id))), 'view', () => { if (S.view === 'leads') setTimeout(renderLeads, 0); }); if (rd !== true) { $('#l-summary').textContent = `${vis.length} of ${LEADS.length} leads`; $('#l-list').innerHTML = rd === 'error' ? detailErr() : loadingNote('leads'); return; } }
  $('#l-summary').textContent = `${vis.length} of ${LEADS.length} leads`;
  $('#l-list').innerHTML = vis.length ? vis.map(L => leadCard(L)).join('') : `<div class="empty-inline">${LEADS.length ? 'No leads match these filters.' : 'No timing patterns found in the current data.'}</div>`;
}
$('#l-pats').addEventListener('click', e => { const b = e.target.closest('[data-lpat]'); if (!b) return; toggleIn(S.lpat, b.dataset.lpat, Object.keys(LEAD_PAT)); update(); });
$('#l-layer').addEventListener('change', e => { S.llayer = e.target.value; update(); });
$('#l-prov').addEventListener('change', e => { S.lprov = e.target.value; update(); });
$('#l-min').addEventListener('change', e => { S.lmin = +e.target.value; update(); });
for (const [id, k] of [['#l-from', 'lfrom'], ['#l-to', 'lto']]) $(id).addEventListener('change', e => { const v = e.target.value.trim(); S[k] = v ? (dateInterval(v) ? v : null) || '' : ''; if (v && !S[k]) toast('Use YYYY, YYYY-MM or YYYY-MM-DD'); update(); });
$('#view-leads').addEventListener('click', e => {
  const t = e.target.closest('[data-lead],[data-node],[data-link]'); if (!t) return;
  if (t.dataset.lead) openLead(t.dataset.lead); else if (t.dataset.node) select({ node: t.dataset.node }); else if (t.dataset.link) select({ link: t.dataset.link });
});

// ---- networks view
function renderNetworks() {
  const cur = NETS, auto = CLUSTERS;
  $('#n-summary').textContent = `${cur.length} curated networks · ${auto.length} auto-detected clusters`;
  $('#n-list').innerHTML = cur.length ? cur.map(n => netCard(n)).join('') : '<p class="muted pad">No curated networks in this data.</p>';
  $('#n-clusters').innerHTML = auto.slice(0, 60).map(n => netCard(n)).join('') || '<p class="muted pad">None.</p>';
}
$('#view-networks').addEventListener('click', e => { const t = e.target.closest('[data-net],[data-node],[data-link]'); if (!t) return; if (t.dataset.net) { selectNet(t.dataset.net); setView('map'); setTimeout(focusSelection, 40); } else if (t.dataset.node) select({ node: t.dataset.node }); });

// ---- 68-theories.js
/* v1.11 per-node theory switch + global Theories (unverified) toggle.
   Off by default: verified map unchanged. Switch ON fans out that node's theories as dashed theory-coloured nodes
   linked only by 'named in theory'. Theory→theory opens one step at a time via each theory's own switch.
   Held items are already excluded at build time. */
const THEORY_WARN = () => (D.meta.vocab && D.meta.vocab.THEORY_WARNING) || 'Unverified theory - reported claims only, educational, no wrongdoing alleged.';
const THEORY_COLOR = () => (TYPE.theory && TYPE.theory.color) || (LAYERS.theories && LAYERS.theories.color) || '#9A9A9A';
const isTheoryEnt = e => !!(e && (e.theory || e.type === 'theory' || ((e.layers || []).length === 1 && e.layers[0] === 'theories')));
const isTheoryLnk = l => !!(l && (l.type === 'named_in_theory' || ((l.layers || []).length === 1 && l.layers[0] === 'theories')));
const theoryIdsOf = e => (e && e.named_in_theories) || [];
const relatedTheoryIds = e => (e && e.related_theory_ids) || [];
const hasTheorySwitch = e => !!(e && (theoryIdsOf(e).length || (e.type === 'theory' && relatedTheoryIds(e).length)));

function theoriesVisible() {
  // global toggle: whole theories layer. Per-node: ids in S.thyOn (verified or theory) plus their expanded theory children.
  const show = new Set();
  if (S.thy) {
    for (const e of D.entities) if (isTheoryEnt(e)) show.add(e.id);
    return show;
  }
  for (const id of S.thyOn) {
    const e = ENT.get(id); if (!e) continue;
    show.add(id);
    const kids = e.type === 'theory' ? relatedTheoryIds(e) : theoryIdsOf(e);
    for (const tid of kids) show.add(tid);
  }
  return show;
}

function theoryLinkVisible(l, thyShow) {
  if (!isTheoryLnk(l)) return false;
  if (S.thy) return thyShow.has(l.from) && thyShow.has(l.to);
  // per-node: only the named_in_theory edge from the switched verified node (or its stub) to a shown theory,
  // or theory→related theory when the parent theory switch is on.
  if (!thyShow.has(l.to) && !thyShow.has(l.from)) return false;
  for (const id of S.thyOn) {
    const e = ENT.get(id); if (!e) continue;
    if (e.type === 'theory') {
      if (relatedTheoryIds(e).includes(l.to) || relatedTheoryIds(e).includes(l.from)) return thyShow.has(l.from) && thyShow.has(l.to);
    } else {
      if (theoryIdsOf(e).includes(l.to) || theoryIdsOf(e).includes(l.from)) return true;
    }
  }
  return false;
}

function syncTheorySwitchDom(id) {
  // Keep the panel checkbox and the on-node T button in lockstep with S.thyOn (same source of truth).
  const on = S.thyOn.has(id);
  document.querySelectorAll('[data-thy-switch="' + id.replace(/"/g, '') + '"]').forEach(el => {
    const inp = el.tagName === 'INPUT' ? el : el.querySelector && el.querySelector('input[type=checkbox]');
    if (inp) { inp.checked = on; inp.setAttribute('aria-checked', on ? 'true' : 'false'); }
    if (el.classList && el.classList.contains('thy-node-sw')) { el.classList.toggle('on', on); el.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  });
}
function setTheorySwitch(id, on) {
  if (!ENT.has(id)) return;
  if (on) S.thyOn.add(id); else S.thyOn.delete(id);
  prevVisibleKey = '';
  syncTheoryGraph();
  if (typeof updating !== 'undefined' && updating) syncTheorySwitchDom(id);
  else update(true);
  // renderPanel rebuilds the checkbox from S.thyOn; re-assert DOM in case update was skipped or raced
  syncTheorySwitchDom(id);
  announce(on ? 'Theories for this node shown (unverified)' : 'Theories for this node hidden');
}

function toggleTheorySwitch(id) { setTheorySwitch(id, !S.thyOn.has(id)); }

function theorySwitchHtml(e) {
  if (!hasTheorySwitch(e)) return '';
  const on = S.thyOn.has(e.id);
  const n = e.type === 'theory' ? relatedTheoryIds(e).length : theoryIdsOf(e).length;
  return `<label class="thy-switch" data-thy-switch="${esc(e.id)}" title="Show unverified theories that name this node. Reported claims only; no wrongdoing alleged.">
    <input type="checkbox" ${on ? 'checked' : ''} aria-checked="${on}" aria-label="Show ${n} unverified theor${n === 1 ? 'y' : 'ies'}">
    <span class="thy-sw-ui" aria-hidden="true"></span>
    <span class="thy-sw-lab">Theories (${n} unverified)</span>
  </label>`;
}

function sourceFramingHtml(x) {
  const raw = x && x.source_framing; if (!raw) return '';
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map(f => {
    if (!f || !f.note) return '';
    const u = safeUrl(f.url);
    return `<aside class="src-framing" data-source-framing>
      <h3 class="lbl">Source framing</h3>
      <p class="small">${esc(f.note)}</p>
      <blockquote class="ethics-q">“${esc(f.quote || '')}”${f.timestamp ? ` <cite class="muted">${esc(f.timestamp)}</cite>` : ''}${u ? ` <a href="${esc(u)}" target="_blank" rel="noopener noreferrer">source</a>` : ''}</blockquote>
      <p class="small muted">Describes how the source groups people; not a map tag or filter.</p>
    </aside>`;
  }).join('');
}

// ---- records_checks / finding_note (display only; text comes from data, never inferred) ----
const RC_COVERAGE = { partial_access_limited: 'Partial / access-limited search coverage', partial: 'Partial search coverage', access_limited: 'Access-limited search coverage', complete: 'Coverage stated as complete by source' };
const RC_GENERIC_SCOPE = 'Search scope not stated in source (generic note, not from the source): not a clearance or absence finding.';
const rcLabel = k => String(k).replace(/_/g, ' ').replace(/\bbc\b/gi, 'BC').replace(/\bcanlii\b/gi, 'CanLII').replace(/^./, c => c.toUpperCase());
const rcList = (v, cls) => { const a = (Array.isArray(v) ? v : [v]).filter(x => x != null && x !== '' && typeof x !== 'object').map(String); return a.length ? `<ul class="${cls}">${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''; };
function rcCoverage(rc) { if (!rc) return null; const c = rc.coverage_status; return c ? (RC_COVERAGE[c] || rcLabel(c)) : 'Coverage not stated in source'; }
function rcScopeText(e, lead) {
  if (lead && lead.note) return { text: String(lead.note), from: 'source' };
  if (e && e.finding_note) return { text: String(e.finding_note), from: 'source' };
  const rc = e && e.records_checks; if (rc && rc.coverage_status) return { text: rcCoverage(rc) + (rc.result ? ': ' + rc.result : ''), from: 'source' };
  return { text: RC_GENERIC_SCOPE, from: 'generic' };
}
function rcScopeHtml(e, lead) { const s = rcScopeText(e, lead); return `<span class="thy-scope small" data-thy-scope="${s.from}">${esc(s.text)}</span>`; }
const RC_FIELDS = [['source', 'Source'], ['date', 'Date'], ['query', 'Query'], ['query_name', 'Query'], ['query_method', 'Method'], ['match', 'Match'], ['name_scope', 'Name scope'], ['court_level', 'Court level'], ['participant_type', 'Participant'], ['case_type', 'Case type'], ['query_fields', 'Fields'], ['match_options', 'Match options'], ['all', 'Results (all)'], ['cases', 'Cases'], ['count', 'Count'], ['result_count', 'Count'], ['status', 'Status'], ['coverage', 'Coverage'], ['reported_temporal_coverage', 'Temporal coverage (reported)'], ['case_details', 'Case details'], ['excluded_scope', 'Not searched'], ['limitation', 'Limit'], ['limitations', 'Limit'], ['assessment', 'Assessment']];
function rcCheckHtml(key, o) {
  if (o == null) return '';
  if (typeof o !== 'object') return `<li class="rc-check" data-rc-check="${esc(key)}"><strong>${esc(rcLabel(key))}</strong>: ${esc(String(o))}</li>`;
  const u = safeUrl(o.url); const name = rcLabel(key);
  const rows = RC_FIELDS.filter(([k]) => o[k] != null && o[k] !== '' && typeof o[k] !== 'object').map(([k, l]) => `<div><span class="muted">${esc(l)}:</span> ${esc(String(o[k]))}</div>`).join('');
  const lims = Array.isArray(o.limitations) ? o.limitations : [];
  const ns = [].concat(o.not_searched || [], o.not_run || []);
  const qs = Array.isArray(o.queries) ? o.queries.map(q => q && typeof q === 'object' ? Object.entries(q).map(([a, b]) => `${a}: ${b}`).join(', ') : String(q)) : [];
  return `<li class="rc-check" data-rc-check="${esc(key)}"><strong>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(name)}</a>` : esc(name)}</strong>${rows}${lims.length ? `<div class="muted">Limits:</div>${rcList(lims, 'rc-lims')}` : ''}${ns.length ? `<div data-rc-not-searched><span class="muted">Not searched / not run:</span> ${esc(ns.join('; '))}</div>` : ''}${qs.length ? `<div class="small muted">Queries: ${esc(qs.join(' | '))}</div>` : ''}</li>`;
}
function recordsChecksHtml(e) {
  const rc = e && e.records_checks; if (!rc || typeof rc !== 'object') return e && e.finding_note ? `<p class="small" data-finding-note>${esc(e.finding_note)}</p>` : '';
  const skip = new Set(['coverage_status', 'searched_on', 'result', 'queries_run', 'method', 'limitations', 'no_clearance_or_merits_finding', 'desktop_results']);
  const checks = [];
  const dr = rc.desktop_results && typeof rc.desktop_results === 'object' ? rc.desktop_results : null;
  if (dr) for (const [k, v] of Object.entries(dr)) if (k !== 'date' && k !== 'sources') checks.push(rcCheckHtml(k, v));
  for (const [k, v] of Object.entries(rc)) if (!skip.has(k)) checks.push(rcCheckHtml(k, v));
  return `<div class="rc" data-records-checks data-coverage="${esc(rc.coverage_status || 'unstated')}">
    <p><span class="kindtag rc-cov">${esc(rcCoverage(rc))}</span>${rc.searched_on ? ` <span class="muted small">searched ${esc(rc.searched_on)}</span>` : ''}</p>
    ${rc.result ? `<p class="small" data-rc-result>${esc(rc.result)}</p>` : ''}
    ${e.finding_note ? `<p class="small" data-finding-note>${esc(e.finding_note)}</p>` : ''}
    ${Array.isArray(rc.limitations) && rc.limitations.length ? `<h4 class="lbl small">Search limits (from source)</h4>${rcList(rc.limitations, 'rc-lims')}` : ''}
    ${checks.filter(Boolean).length ? `<h4 class="lbl small">Checks</h4><ul class="rc-checks">${checks.join('')}</ul>` : ''}
    ${rc.method ? `<details class="small"><summary>Method</summary><p>${esc(rc.method)}</p>${rcList(rc.queries_run || [], 'rc-q')}</details>` : ''}
    <p class="small rc-noclear" data-rc-noclear>${rc.no_clearance_or_merits_finding === true ? 'Source states: no clearance and no merits finding.' : 'Not a clearance or merits finding.'} Bounded searches; results are not proof of absence.</p>
  </div>`;
}
function personChecksHtml(e) {
  if (!e || e.type === 'theory' || typeof theoryIdsOf !== 'function') return '';
  const vis = theoriesVisible(); const ids = theoryIdsOf(e).filter(id => vis.has(id) && ENT.has(id) && (ENT.get(id).records_checks || ENT.get(id).finding_note));
  if (!ids.length) return '';
  return `<section class="thy-person-checks" data-person-checks><h3 class="lbl">Records checks in theories naming this person</h3><p class="thy-warn small" role="note">${esc(THEORY_WARN())}</p>${ids.map(id => `<div data-person-check="${esc(id)}">${entBtn(id)}${recordsChecksHtml(ENT.get(id))}</div>`).join('')}</section>`;
}

function findingLabel(f) {
  return ({ supported: 'supported', contradicted: 'contradicted', no_record: 'no_record' })[f] || null;
}

/** Per-lead findings only — never invent a theory-level finding from unique lead statuses. */
function theoryFindingsHtml(e) {
  const rows = [];
  // Theory-level finding: explicit field only (never invent from leads).
  const top = findingLabel(e && e.finding != null ? String(e.finding).toLowerCase() : '');
  if (top) {
    rows.push(`<p class="thy-finding-top"><span class="kindtag">${esc(top === 'no_record' ? 'no record' : top)}</span> <span class="muted small">theory finding</span>${top === 'no_record' ? ' ' + rcScopeHtml(e) : ''}</p>`);
  } else {
    rows.push(`<p class="thy-finding-top muted">No finding recorded</p>`);
  }
  // Per-lead findings with sources (data on leads[] only).
  const leads = Array.isArray(e.leads) ? e.leads.filter(l => l && typeof l === 'object') : [];
  for (const lead of leads) {
    const found = findingLabel(String(lead.found || '').toLowerCase());
    if (!found) continue;
    const text = String(lead.lead || lead.claim || lead.text || lead.id || 'Lead');
    const rawRecs = Array.isArray(lead.records) ? lead.records : [];
    const recs = rawRecs.map(r => {
      if (r && typeof r === 'object') { const u = safeUrl(r.url); const t = String(r.title || r.cite || r.note || r.url || ''); return t ? { u, t } : null; }
      if (r == null || r === '') return null; const t = String(r); return { u: /^https?:\/\//i.test(t) ? safeUrl(t) : null, t };
    }).filter(Boolean);
    const srcNote = recs.length
      ? `<ul class="thy-finding-recs">${recs.map(r => r.u ? `<li><a href="${esc(r.u)}" target="_blank" rel="noopener noreferrer">${esc(r.t)}</a></li>` : `<li>${esc(r.t)}</li>`).join('')}</ul>`
      : '<p class="muted small">No source on file for this lead check.</p>';
    rows.push(`<li data-thy-lead-finding="${esc(found)}"><span class="kindtag">${esc(found === 'no_record' ? 'no record' : found)}</span> <span>${esc(text)}</span>${found === 'no_record' ? '<br>' + rcScopeHtml(e, lead) : ''}${srcNote}</li>`);
  }
  const findings = Array.isArray(e.findings) ? e.findings : [];
  for (const f of findings) {
    if (!f || typeof f !== 'object') continue;
    const found = findingLabel(String(f.found || f.status || f.result || '').toLowerCase());
    if (!found) continue;
    const by = f.by != null ? String(f.by) : '';
    const u = safeUrl(f.source_url || f.url);
    rows.push(`<li data-thy-lead-finding="${esc(found)}"><span class="kindtag">${esc(found === 'no_record' ? 'no record' : found)}</span>${found === 'no_record' ? ' ' + rcScopeHtml(e) : ''}${by ? ` <span>${esc(by)}</span>` : ''}${u ? ` · <a href="${esc(u)}" target="_blank" rel="noopener noreferrer">source</a>` : ''}</li>`);
  }
  // Claim counts from leads[].found (only statuses present in data).
  const c = e.claim_finding_counts;
  let claimsLine = '';
  if (c && typeof c === 'object') {
    const parts = [];
    for (const k of ['supported', 'contradicted', 'no_record']) {
      const n = Number(c[k]) || 0;
      if (n > 0) parts.push(`${n} ${k === 'no_record' ? 'no record' : k}`);
    }
    if (parts.length) claimsLine = `<p class="thy-claim-counts" data-thy-claim-counts>Claims: ${esc(parts.join(' · '))}${(Number(c.no_record) || 0) > 0 ? ' <span class="muted small">(“no record” = within the stated search scope only; not clearance)</span>' : ''}</p>`;
  }
  const leadList = rows.filter(r => r.startsWith('<li')).join('');
  const head = rows.filter(r => r.startsWith('<p')).join('');
  return `<div data-thy-finding>${head}${claimsLine}${leadList ? `<ul class="thy-findings">${leadList}</ul>` : ''}<p class="muted small">(from public-record checks of the theory's leads; not a verdict on any person)</p></div>`;
}

function theoryShortLabel(e) {
  const n = e && e.name != null ? String(e.name) : '';
  if (!n) return 'Theory';
  let s = n;
  const colon = n.indexOf(':');
  if (colon > 0 && colon < 48 && n.length - colon - 1 >= 10) s = n.slice(colon + 1).trim();
  if (s.length > 40) s = s.slice(0, 38).replace(/\s+\S*$/, '').replace(/[,;:\-\s]+$/, '') + '…';
  return s || 'Theory';
}

function promotersHtml(e) {
  const ps = e.promoters || []; if (!ps.length) return '<p class="muted small">Promoter not recorded.</p>';
  return `<ul class="thy-promoters">${ps.map(p => {
    const u = safeUrl(p.url); const ch = (p.channels || []).join(', ');
    return `<li><strong>${esc(p.name)}</strong>${ch ? ` <span class="muted">· ${esc(ch)}</span>` : ''}${p.platform ? ` <span class="muted">· ${esc(p.platform)}</span>` : ''}${u ? ` · <a href="${esc(u)}" target="_blank" rel="noopener noreferrer">source</a>` : ''}${p.entity_id && ENT.has(p.entity_id) ? ` · ${entBtn(p.entity_id)}` : ''}</li>`;
  }).join('')}</ul>`;
}

function theorySourcesHtml(e) {
  const srcs = (e.sources || []).filter(s => safeUrl(s.url));
  if (srcs.length) return srcList(srcs);
  // fall back to promoter urls
  const ps = (e.promoters || []).filter(p => safeUrl(p.url));
  if (!ps.length) return '<p class="muted small">No source link on file.</p>';
  return `<ul class="sources">${ps.map(p => `<li class="src"><a href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">${esc(p.name)}</a><span class="muted"> promoter</span></li>`).join('')}</ul>`;
}

function renderTheoryCard(e) {
  return `<div class="p-head"><div class="p-type">${typeChip('theory')} ${layerChips(e)} <span class="badge thy-badge">Unverified</span></div>
    <h1 class="p-name">${esc(e.name)}</h1>
    <p class="thy-warn" data-thy-warn role="note">${esc(THEORY_WARN())}</p>
    ${theorySwitchHtml(e)}
  </div>
  <section class="thy-body" data-theory-card>
    ${e.claim_text ? `<p data-thy-claim>${esc(e.claim_text)}</p>` : ''}
    <h3 class="lbl">Promoter</h3>${promotersHtml(e)}
    <h3 class="lbl">Source</h3>${theorySourcesHtml(e)}
    <h3 class="lbl">Finding</h3>${theoryFindingsHtml(e)}
    ${e.records_checks || e.finding_note ? `<h3 class="lbl">Records checks</h3>${recordsChecksHtml(e)}` : ''}
    ${sourceFramingHtml(e)}
    ${relatedTheoryIds(e).length ? `<h3 class="lbl">Related theories</h3><ul class="thy-related">${relatedTheoryIds(e).map(id => `<li>${entBtn(id)} ${theorySwitchHtml(ENT.get(id) || { id, type: 'theory', related_theory_ids: [] })}</li>`).join('')}</ul>` : ''}
  </section>`;
}

function syncTheoryGraph() {
  if (!cy || typeof F === 'undefined' || !F) return;
  const thyShow = theoriesVisible();
  const wantNodes = new Set(thyShow);
  const wantEdges = new Set();
  // synthetic edges from a verified node to its theories when the stub→theory link exists only on the stub
  for (const id of S.thyOn) {
    const e = ENT.get(id); if (!e || e.type === 'theory') continue;
    for (const tid of theoryIdsOf(e)) {
      wantNodes.add(tid);
      wantEdges.add('thy:' + id + '>' + tid);
    }
  }
  for (const l of D.links) {
    if (!isTheoryLnk(l)) continue;
    if (S.thy) { if (thyShow.has(l.from) && thyShow.has(l.to)) wantEdges.add('L:' + l.id); continue; }
    // theory-to-theory via related: draw a dashed edge when parent theory switch is on
    for (const id of S.thyOn) {
      const e = ENT.get(id); if (!e) continue;
      if (e.type === 'theory' && (relatedTheoryIds(e).includes(l.to) || relatedTheoryIds(e).includes(l.from)) && thyShow.has(l.from) && thyShow.has(l.to)) wantEdges.add('L:' + l.id);
    }
  }
  // also show real named_in_theory links when global on
  if (S.thy) for (const l of D.links) if (isTheoryLnk(l) && thyShow.has(l.from) && thyShow.has(l.to)) wantEdges.add('L:' + l.id);

  cy.batch(() => {
    // remove stale theory ephemeral nodes/edges
    cy.nodes('.thy-node, .thy-sw').forEach(n => { if (!wantNodes.has(n.id()) && !n.hasClass('thy-sw')) n.remove(); });
    cy.edges('.thy-edge').forEach(e => { if (!wantEdges.has(e.id()) && !wantEdges.has(e.data('lid') && ('L:' + e.data('lid')))) { /* keep check below */ } });
    // ensure theory nodes exist and sit near their anchor
    for (const tid of wantNodes) {
      const e = ENT.get(tid); if (!e) continue;
      let n = cy.$id(tid);
      if (!n.length) {
        const anchor = [...S.thyOn].map(id => ENT.get(id)).find(a => a && (theoryIdsOf(a).includes(tid) || relatedTheoryIds(a).includes(tid)));
        const ap = anchor && cy.$id(anchor.id).length ? cy.$id(anchor.id).position() : (e.pos ? { x: e.pos[0], y: e.pos[1] } : { x: 0, y: 0 });
        const sib = (anchor ? (anchor.type === 'theory' ? relatedTheoryIds(anchor) : theoryIdsOf(anchor)) : [tid]);
        const ix = Math.max(0, sib.indexOf(tid));
        const ang = -Math.PI / 2 + (ix - (sib.length - 1) / 2) * 0.7;
        const r = 130 + sib.length * 12; // keep clear of parent label; larger node needs more gap
        const short = theoryShortLabel(e);
        cy.add({ group: 'nodes', classes: 'thy-node' + (e.type === 'theory' && relatedTheoryIds(e).length ? ' thy-has-sw' : ''), data: { id: tid, label: short, color: THEORY_COLOR(), shape: 'vee', size: 38, fs: 10, type: 'theory', province: '—' }, position: { x: ap.x + Math.cos(ang) * r, y: ap.y + Math.sin(ang) * r } });
      } else if (isTheoryEnt(e)) {
        n.addClass('thy-node');
        n.data('label', theoryShortLabel(e));
        n.data('size', 38);
        n.data('fs', 10);
        n.style('display', 'element');
      } else {
        n.style('display', 'element');
      }
    }
    // verified→theory synthetic edges
    for (const id of S.thyOn) {
      const e = ENT.get(id); if (!e || e.type === 'theory') continue;
      for (const tid of theoryIdsOf(e)) {
        const eid = 'thy:' + id + '>' + tid;
        if (!cy.$id(eid).length && cy.$id(id).length && cy.$id(tid).length) {
          cy.add({ group: 'edges', classes: 'thy-edge dashed', data: { id: eid, lid: eid, source: id, target: tid, color: THEORY_COLOR(), dash: [6, 4], width: 1.4, arrow: 'none', arrow0: 'none', label: 'named in theory' } });
        }
      }
      // theory→related theory
      if (e.type === 'theory') for (const tid of relatedTheoryIds(e)) {
        const eid = 'thy:' + id + '>' + tid;
        if (!cy.$id(eid).length && cy.$id(id).length && cy.$id(tid).length) {
          cy.add({ group: 'edges', classes: 'thy-edge dashed', data: { id: eid, lid: eid, source: id, target: tid, color: THEORY_COLOR(), dash: [6, 4], width: 1.4, arrow: 'none', arrow0: 'none', label: 'named in theory' } });
        }
      }
    }
    for (const id of S.thyOn) {
      const e = ENT.get(id); if (!e || e.type !== 'theory') continue;
      for (const tid of relatedTheoryIds(e)) {
        const eid = 'thy:' + id + '>' + tid;
        if (!cy.$id(eid).length && cy.$id(id).length && cy.$id(tid).length) {
          cy.add({ group: 'edges', classes: 'thy-edge dashed', data: { id: eid, lid: eid, source: id, target: tid, color: THEORY_COLOR(), dash: [6, 4], width: 1.4, arrow: 'none', arrow0: 'none', label: 'named in theory' } });
        }
      }
    }
    // hide theory layer base nodes/edges unless wanted (they may exist from initGraph)
    cy.nodes().forEach(n => {
      const e = ENT.get(n.id());
      if (!e) return;
      if (isTheoryEnt(e) && !wantNodes.has(n.id()) && !S.thyOn.has(n.id())) n.style('display', 'none');
    });
    cy.edges('.thy-edge').forEach(ed => {
      const keep = [...S.thyOn].some(id => ed.id().startsWith('thy:' + id + '>')) || (S.thy && ed.hasClass('thy-edge'));
      if (!keep && ed.id().startsWith('thy:')) ed.remove();
    });
  });
  placeTheorySwitches();
}

let thyHoverId = null;
function markThySwHot() {
  const box = $('#thy-sw-layer'); if (!box) return;
  box.querySelectorAll('.thy-node-sw').forEach(el => {
    const id = el.getAttribute('data-thy-switch');
    const hot = id === S.node || id === thyHoverId;
    el.classList.toggle('is-hot', hot);
    el.tabIndex = (hot || el.classList.contains('on')) ? 0 : -1;
  });
}
function placeTheorySwitches() {
  if (!cy) return;
  const host = $('#cy'); if (!host) return;
  let box = $('#thy-sw-layer');
  if (!box) { box = document.createElement('div'); box.id = 'thy-sw-layer'; box.setAttribute('aria-hidden', 'false'); host.appendChild(box); }
  const parts = [];
  for (const e of D.entities) {
    if (!hasTheorySwitch(e)) continue;
    if (isTheoryEnt(e) && !theoriesVisible().has(e.id) && !S.thyOn.has(e.id)) continue;
    if (!isTheoryEnt(e) && !(F && F.ents && F.ents.has(e.id))) continue;
    const n = cy.$id(e.id); if (!n.length || n.style('display') === 'none') continue;
    const p = n.renderedPosition(); const r = n.renderedWidth() / 2;
    const on = S.thyOn.has(e.id);
    const hot = e.id === S.node || e.id === thyHoverId;
    parts.push(`<button type="button" class="thy-node-sw${on ? ' on' : ''}${hot ? ' is-hot' : ''}" data-thy-switch="${esc(e.id)}" style="left:${Math.round(p.x + r - 2)}px;top:${Math.round(p.y - r - 2)}px" title="Theories (unverified)" aria-pressed="${on}" aria-label="Toggle unverified theories for ${esc(e.name)}" tabindex="${on || hot ? 0 : -1}">T</button>`);
  }
  box.innerHTML = parts.join('');
}

function bindTheoryUi() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-thy-switch]'); if (!b) return;
    // checkbox change handled separately
    if (e.target.closest('input')) return;
    e.preventDefault(); e.stopPropagation();
    toggleTheorySwitch(b.dataset.thySwitch);
  }, true);
  document.addEventListener('change', e => {
    const lab = e.target.closest('[data-thy-switch]'); if (!lab || e.target.type !== 'checkbox') return;
    setTheorySwitch(lab.dataset.thySwitch, e.target.checked);
  });
  if (cy) {
    cy.on('pan zoom position', debounce(() => placeTheorySwitches(), 40));
    cy.on('render', debounce(() => placeTheorySwitches(), 40));
    cy.on('mouseover', 'node', ev => { thyHoverId = ev.target.id(); markThySwHot(); });
    cy.on('mouseout', 'node', ev => { if (thyHoverId === ev.target.id()) thyHoverId = null; markThySwHot(); });
    cy.on('select unselect', 'node', () => markThySwHot());
  }
}

// overlap guard used by tests: expanded theory nodes must not share a position with another visible node
function theoryOverlapCount() {
  if (!cy) return 0;
  const nodes = cy.nodes(':visible').filter(n => n.style('display') !== 'none');
  let hits = 0;
  const arr = nodes.toArray();
  for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
    const a = arr[i].position(), b = arr[j].position();
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const min = (arr[i].data('size') + arr[j].data('size')) / 2 + 8;
    if (d < min) hits++;
  }
  return hits;
}

window.__wiretapTheory = { recordsChecksHtml, personChecksHtml, rcScopeText, isTheoryEnt, isTheoryLnk, theoriesVisible, setTheorySwitch, toggleTheorySwitch, syncTheoryGraph, syncTheorySwitchDom, theoryOverlapCount, THEORY_WARN, hasTheorySwitch, theoryIdsOf };

// ---- 70-export.js
/* export: filtered CSV / JSON downloads, embed / cite dialog */
const csvCell = v => { if (v == null) return ''; const s = Array.isArray(v) ? v.join('; ') : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCSV = (cols, rows) => '\uFEFF' + [cols.map(c => c[0]).join(','), ...rows.map(r => cols.map(c => csvCell(c[1](r))).join(','))].join('\r\n') + '\r\n';
function download(name, text, type) { const b = new Blob([text], { type }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); toast('Downloaded ' + name); }
const stamp = () => new Date().toISOString().slice(0, 10);
function filterNote() { const h = toHash(); return h ? 'filters: #' + h : 'no filters'; }
$('#x-ent-csv').addEventListener('click', async () => { await hydrateAll([...F.ents].map(id => ENT.get(id))); download(`noticermap-entities-${stamp()}.csv`, toCSV([['id', e => e.id], ['source_layer', e => itemLayers(e)], ['name', e => e.name], ['type', e => e.type], ['province', e => e.province], ['aliases', e => e.aliases], ['summary', e => e.summary], ['connections', e => e.degree], ['money_in_cad', e => e.money_in || ''], ['money_out_cad', e => e.money_out || ''], ['networks', e => e.networks], ['overlap_partners', e => e.overlap_partners || ''], ['source_urls', e => e.sources.map(s => s.url).filter(Boolean)]], [...F.ents].map(id => ENT.get(id))), 'text/csv'); });
$('#x-lnk-csv').addEventListener('click', async () => { await hydrateAll(F.links); download(`noticermap-links-${stamp()}.csv`, toCSV([['id', l => l.id], ['source_layer', l => itemLayers(l)], ['from_id', l => l.from], ['from', l => name(l.from)], ['type', l => l.type], ['to_id', l => l.to], ['to', l => name(l.to)], ['amount_cad', l => l.amount_cad], ['amount_kind', l => l.amount_cad ? l.amount_kind : ''], ['counts_in_money_totals', l => l.amount_cad ? (isFlow(l) ? 'yes' : 'no') : ''], ['date', l => l.date], ['status', l => l.status], ['status_label', l => statusLabel(l.status, itemLayers(l)[0])], ['description', l => l.description], ['source_urls', l => l.sources.map(s => s.url).filter(Boolean)], ['source_kinds', l => l.sources.map(s => s.kind)]], F.links), 'text/csv'); });
$('#x-ov-csv').addEventListener('click', async () => { await loadExtra('overlaps'); download(`noticermap-overlaps-${stamp()}.csv`, toCSV([['type', o => o.type], ['kind', o => o.kinds], ['a_id', o => o.a], ['a', o => name(o.a)], ['b_id', o => o.b], ['b', o => name(o.b)], ['via', o => o.via.map(v => ENT.has(v) ? name(v) : v)], ['strength', o => o.strength], ['evidence_link_ids', o => o.links], ['evidence_source_urls', o => o.sources], ['note', () => OV_NOTE]], visibleOverlaps()), 'text/csv'); });
$('#x-json').addEventListener('click', async () => { await hydrateAll([...[...F.ents].map(id => ENT.get(id)), ...F.links]); if (!EXTRA.loaded.overlaps) await loadExtra('overlaps');
  const strip = x => { const o = {}; for (const k in x) if (k[0] !== '_' && k !== 'pos') o[k] = x[k]; return o; };
  const out = { exported_at: new Date().toISOString(), view: location.href, note: `${filterNote()}. Reported claims come from the outlet's own reporting and are not independently verified. Overlaps are found by the map and are not reported claims.`, meta: { built_at: D.meta.built_at, is_sample: D.meta.is_sample }, entities: [...F.ents].map(id => strip(ENT.get(id))), links: F.links.map(strip), networks: F.nets.map(strip), overlaps: visibleOverlaps().map(o => ({ type: o.type, a: o.a, b: o.b, via: o.via, kinds: o.kinds, strength: o.strength, evidence_link_ids: o.links, evidence_source_urls: o.sources, note: OV_NOTE })) };
  download(`noticermap-${stamp()}.json`, JSON.stringify(out, null, 1), 'application/json');
});
function openDialog(title, html) { $('#dlg-title').textContent = title; $('#dlg-body').innerHTML = html; const d = $('#dlg'); if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
function openEmbed() {
  const url = location.href.split('#')[0] + (toHash() ? '#' + toHash() : '');
  const what = S.node ? name(S.node) : S.link ? `${name(LNK.get(S.link).from)} → ${name(LNK.get(S.link).to)}` : 'Canadian influence & money network';
  const cite = `NoticerMap, “${what}”. ${D.meta.is_sample ? 'EXAMPLE DATA. ' : ''}Data built ${String(D.meta.built_at).slice(0, 10)}. ${url} (accessed ${stamp()}).`;
  openDialog('Embed or cite', `<p>Embed this view (filters and selection included):</p><textarea readonly rows="3" class="code">&lt;iframe src="${esc(url)}" width="100%" height="640" style="border:0" title="NoticerMap" loading="lazy"&gt;&lt;/iframe&gt;</textarea>
    <p>Cite:</p><textarea readonly rows="3" class="code">${esc(cite)}</textarea>
    <p class="small muted">Please keep the badges in view when you quote a claim: <em>Reported</em> means it comes from the outlet's own reporting and has not been independently verified. Overlaps are found by the map, not reported claims.</p>`);
  $$('#dlg textarea').forEach(t => t.addEventListener('focus', () => t.select()));
}
$('#btn-embed').addEventListener('click', openEmbed); $('#about-embed').addEventListener('click', openEmbed);
$('#btn-keys').addEventListener('click', () => openDialog('Keyboard shortcuts', `<dl class="keys">${KEYS.map(([k, d]) => `<dt><kbd>${esc(k)}</kbd></dt><dd>${esc(d)}</dd>`).join('')}</dl>`));

// ---- 72-immigration.js
// 'Immigration and living costs, 1990 on' context aside + Immigration / people-and-boards layer toggles.
// Display only. Layer ids come from D.meta.layer_roles (data contract); nothing is guessed. Crossings are highlighted
// ONLY for items carrying an explicit crosses_layers marker naming both layers. All data text is escaped.
const SOL = window.__WIRETAP_SOL__ || { title: 'Immigration and living costs, 1990 on', countries: [], pending_countries: [] };
const SOL_TITLE = 'Immigration and living costs, 1990 on';
const SOL_ROLES = (D.meta && D.meta.layer_roles) || {};
const SOL_KEY = 'wiretap.sol.collapsed';
const SOL_TOGGLES = !!(D.meta && D.meta.sol_toggles); // feature flag: OFF until the approved fold
const solRole = r => { const id = SOL_ROLES[r]; return SOL_TOGGLES && id && LAYERS_PRESENT.includes(id) ? id : null; };
const solCollapsedByUser = () => { try { return sessionStorage.getItem(SOL_KEY) === '1'; } catch { return false; } };
const solSetCollapsed = v => { try { v ? sessionStorage.setItem(SOL_KEY, '1') : sessionStorage.removeItem(SOL_KEY); } catch { /* private mode */ } };
let solOpen = false, solTab = 0, solPrev = { imm: false, node: null, q: '' };
const solInImm = e => { const id = solRole('immigration'); return !!(id && e && ((e.layers || []).includes(id) || e.source_layer === id)); };
function solCrossing(x) { const a = solRole('immigration'), b = solRole('people_boards'); const m = x && x.crosses_layers; return !!(a && b && Array.isArray(m) && m.includes(a) && m.includes(b)); }

function solToggleHtml() {
  const row = (role, label) => { const id = solRole(role); const on = id && S.layers.has(id);
    return id ? `<button type="button" class="sol-tg${on ? ' on' : ''}" data-sol-role="${role}" aria-pressed="${!!on}">${esc((LAYERS[id] && LAYERS[id].label) || (D.meta.layer_proposed && D.meta.layer_proposed[id] && D.meta.layer_proposed[id].label) || label)}</button>`
      : `<button type="button" class="sol-tg nodata" data-sol-role="${role}" aria-disabled="true" disabled title="${SOL_TOGGLES ? 'Layer not in the data yet' : 'Off until the approved data fold'}">${esc(label)} <span class="muted small">(${SOL_TOGGLES ? 'not in data yet' : 'off until data fold'})</span></button>`; };
  return `<div class="seg" role="group" aria-label="Context layers">${row('immigration', 'Immigration')}${row('people_boards', 'People and boards (TBB network)')}</div>
    <p class="help small" data-sol-xing-note>${solRole('immigration') && solRole('people_boards') ? 'With both on, only items explicitly marked as crossing both layers are outlined.' : 'Crossing outlines need both layers in the data.'}</p>`;
}
const cell = v => v == null ? '<td class="muted" aria-label="missing">—</td>' : typeof v === 'object' ? '<td class="muted" data-sol-held aria-label="held: no traceable source for this year">held</td>' : `<td>${esc(v)}</td>`;
function solTableHtml(t, cap) {
  if (!t || !t.rows || !t.rows.length) return '';
  const heldNote = (t.held_columns || []).length ? `<p class="muted small" data-sol-held-cols>Held (no traceable source yet): ${esc(t.held_columns.join(', '))}</p>` : '';
  return `${heldNote}<details class="sol-tbl"><summary>${esc(cap)} (${t.rows.length} rows; — = missing value, held = no traceable source for that year)</summary><div class="sol-scroll" tabindex="0"><table><thead><tr>${t.columns.map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map((v, i) => i === 0 ? `<th scope="row">${esc(v)}</th>` : cell(v)).join('')}</tr>`).join('')}</tbody></table></div></details>`;
}
function solCountryHtml(c) {
  if (!c) return '<p class="muted">No country package is available yet.</p>';
  const src = c.sources || [];
  const srcById = new Map(src.map(s => [s.id, s]));
  const st = { ready: 'Ready', partial: 'Partial package', pending: 'Pending: files present but not yet usable', unavailable: 'Not available yet' }[c.status] || c.status;
  return `<p class="small"><span class="kindtag" data-sol-status="${esc(c.status)}">${esc(st)}</span></p>
  ${(c.notes || []).map(n => `<p class="small">${esc(n)}</p>`).join('')}
  ${c.analyses && c.analyses.length ? `<h4 class="lbl small">Findings from named sources</h4><ul class="sol-find">${c.analyses.map(a => `<li data-sol-finding>${a.quoted ? '“' + esc(a.text) + '”' : esc(a.text)} <span class="muted small">: ${a.url && safeUrl(a.url) ? `<a href="${esc(safeUrl(a.url))}" target="_blank" rel="noopener noreferrer">${esc(a.credit)}</a>` : esc(a.credit)}${a.verified_on ? `, checked ${esc(a.verified_on)}` : ''}</span>${a.translated ? `<br><span class="muted small" data-sol-translated>Translation supplied with the source package. Original: “${esc(a.original || '')}”</span>` : ''}</li>`).join('')}</ul>` : '<p class="muted small" data-sol-nofind>No verified findings supplied yet.</p>'}
  ${(c.charts || []).map(ch => { const s = srcById.get(ch.source_id); return `<figure class="sol-chart"><img src="${esc(ch.src)}" alt="${esc(ch.title)}" loading="lazy"><figcaption class="small">${esc(ch.title)}${ch.caption ? '. ' + esc(ch.caption) : ''}${s ? `. Source: <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>` : ''}</figcaption></figure>`; }).join('')}
  ${c.series_shown ? solTableHtml(c.yearly, 'Yearly figures') : c.yearly_preview ? `<p class="muted small" data-sol-withheld>Yearly figures (${esc(c.yearly_preview.rows)} rows) are held: no column has a traceable source yet.</p>` : ''}
  ${solTableHtml(c.key_years, 'Key years')}
  ${c.gaps && c.gaps.length ? `<details class="small"><summary>Known gaps in this data</summary><ul>${c.gaps.map(g => `<li>${esc(g)}</li>`).join('')}</ul></details>` : ''}
  ${src.length ? `<details class="small" data-sol-sources><summary>Sources (${src.length})</summary><ul class="sources">${src.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>${(s.columns || []).length ? ` <span class="muted">for ${esc(s.columns.map(a => a.column + (a.from ? ` ${a.from}–${a.to}` : '')).join(', '))}</span>` : ''}${s.accessed ? ` <span class="muted">accessed ${esc(s.accessed)}</span>` : ''}${(s.more_urls || []).map((u, i) => ` · <a href="${esc(u)}" target="_blank" rel="noopener noreferrer">link ${i + 2}</a>`).join('')}</li>`).join('')}</ul></details>` : '<p class="muted small">No source list supplied yet.</p>'}
`;
}
function solRender() {
  let el = document.getElementById('sol-aside');
  if (!el) { const anchor = document.querySelector('#sidebar [data-guide="layers"]') || document.getElementById('sidebar'); if (!anchor) return;
    el = document.createElement('section'); el.id = 'sol-aside'; el.className = 'filter sol-aside'; el.setAttribute('aria-labelledby', 'sol-h'); anchor.insertAdjacentElement(anchor.id === 'sidebar' ? 'afterbegin' : 'afterend', el);
    el.addEventListener('click', solClick); el.addEventListener('keydown', solKey); }
  const cs = SOL.countries || []; if (solTab >= cs.length) solTab = 0;
  el.innerHTML = `${solToggleHtml()}
    <h2 class="lbl" id="sol-h"><button type="button" class="sol-head" aria-expanded="${solOpen}" aria-controls="sol-body" data-sol-toggle>${esc(SOL_TITLE)}</button></h2>
    <div id="sol-body" ${solOpen ? '' : 'hidden'}>
      ${cs.length ? `<div role="tablist" aria-label="Country" class="seg sol-tabs">${cs.map((c, i) => `<button type="button" role="tab" id="sol-tab-${esc(c.key)}" aria-controls="sol-panel" aria-selected="${i === solTab}" tabindex="${i === solTab ? 0 : -1}" data-sol-tab="${i}">${esc(c.label)}</button>`).join('')}</div>` : ''}
      <div id="sol-panel" role="${cs.length ? 'tabpanel' : 'region'}" ${cs.length ? `aria-labelledby="sol-tab-${esc(cs[solTab].key)}"` : ''}>${solCountryHtml(cs[solTab])}</div>
    </div>`;
}
function solClick(e) {
  const t = e.target.closest('[data-sol-toggle],[data-sol-tab],[data-sol-role]'); if (!t) return;
  if (t.dataset.solToggle != null) { solOpen = !solOpen; solSetCollapsed(!solOpen); solRender(); document.querySelector('#sol-aside [data-sol-toggle]')?.focus(); return; }
  if (t.dataset.solTab != null) { solTab = +t.dataset.solTab; solRender(); document.querySelector(`#sol-aside [data-sol-tab="${solTab}"]`)?.focus(); return; }
  const id = solRole(t.dataset.solRole); if (!id) return;
  if (S.layers.has(id)) { if (S.layers.size === 1) { toast('At least one source layer must stay on'); return; } S.layers.delete(id); } else S.layers.add(id);
  prevVisibleKey = ''; update(true);
}
function solKey(e) { const t = e.target.closest('[data-sol-tab]'); if (!t) return; const n = (SOL.countries || []).length; let j = null;
  if (e.key === 'ArrowRight') j = (solTab + 1) % n; else if (e.key === 'ArrowLeft') j = (solTab - 1 + n) % n; else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = n - 1;
  if (j == null) return; e.preventDefault(); solTab = j; solRender(); document.querySelector(`#sol-aside [data-sol-tab="${j}"]`)?.focus(); }
function solAutoOpen(reason) { if (solOpen || solCollapsedByUser()) return false; solOpen = true; solRender(); announce(`${SOL_TITLE} opened (${reason})`); return true; }
function solSearchHit(q) { if (!q || !q.trim() || !solRole('immigration')) return false; const top = runSearch(q, 5)[0]; return !!(top && top.kind === 'e' && solInImm(ENT.get(top.ref))); } // top hit must be an immigration-layer item
function solAfterUpdate() {
  const immId = solRole('immigration'); const immOn = !!(immId && S.layers.has(immId));
  if (immOn && !solPrev.imm) solAutoOpen('Immigration layer on');
  if (S.node && S.node !== solPrev.node && solInImm(ENT.get(S.node))) solAutoOpen('immigration item selected');
  if (S.q !== solPrev.q && solSearchHit(S.q)) solAutoOpen('immigration search');
  solPrev = { imm: immOn, node: S.node, q: S.q };
  solRender(); solMarkCrossings();
}
function solMarkCrossings() {
  if (typeof cy === 'undefined' || !cy) return; cy.elements('.sol-xing').removeClass('sol-xing');
  const a = solRole('immigration'), b = solRole('people_boards'); if (!(a && b && S.layers.has(a) && S.layers.has(b))) return;
  cy.nodes().forEach(n => { if (solCrossing(ENT.get(n.id()))) n.addClass('sol-xing'); });
  cy.edges().forEach(x => { const l = LNK.get(x.data('lid')); if (solCrossing(l)) x.addClass('sol-xing'); });
}
// on-search hook (search input does not always call update)
document.getElementById('q')?.addEventListener('input', debounce(() => { if (S.q !== solPrev.q) { if (solSearchHit(S.q)) solAutoOpen('immigration search'); solPrev.q = S.q; } }, 120));
window.__wiretapSol = { SOL, roles: () => ({ immigration: solRole('immigration'), people_boards: solRole('people_boards') }), isOpen: () => solOpen, collapsedByUser: solCollapsedByUser, crossing: solCrossing, render: solRender };

// ---- 75-guide.js
/* guide: tours (step playback), connection finder, first-visit walkthrough, glossary. All optional: works with no guide files. */
const tourById = id => (GUIDE.tours || []).find(t => t.id === id);
function tourHighlight() {
  if (!S.tour || S.view !== 'map') return null;
  const t = tourById(S.tour); const st = t && t.steps[S.step]; if (!st) return null;
  return { entities: (st.entity_ids || []).filter(id => ENT.has(id)), links: (st.link_ids || []).filter(id => LNK.has(id)), neighbours: st.focus === 'neighbours' };
}
function startTour(id, step = 0) {
  if (!EXTRA.loaded.guide) { loadExtra('guide').then(() => startTour(id, step)); return; }
  const t = tourById(id); if (!t || !t.steps.length) { toast('Tour not found'); return; }
  closeWalk(true);
  S.tour = id; S.step = Math.max(0, Math.min(t.steps.length - 1, step)); applyTourStep(true);
}
function applyTourStep(push) {
  const t = tourById(S.tour); if (!t) { S.tour = null; $('#tour-card').hidden = true; return; }
  const st = t.steps[S.step];
  S.node = S.link = S.net = S.lead = null; S.ov = null;
  const view = st.view && VIEWS.includes(st.view) ? st.view : 'map';
  if (st.focus === 'path' && (st.link_ids || []).length) { PATHS = []; }
  if ((st.link_ids || []).length === 1 && !(st.entity_ids || []).length) S.link = st.link_ids[0];
  const netTl = st.network && NET.has(st.network); if (netTl) { S.net = st.network; S.link = null; }
  if (st.thy_switch && ENT.has(st.thy_switch) && typeof setTheorySwitch === 'function') setTheorySwitch(st.thy_switch, true);
  setView(netTl && !st.view ? 'timeline' : view, push);
  if (netTl) scrollNetTimeline();
  renderTourCard();
  setTimeout(() => {
    if (!cy || S.view !== 'map') return; const els = cy.elements('.tour:visible');
    if (els.length) { cy.stop(); cy.animate({ fit: { eles: els, padding: isMobile() ? 40 : 110 } }, { duration: 320 }); }
  }, 60);
  spotlightTarget(st.target);
}
// tour step {lead_id}: the lead's 'Timing pattern' label and its lead_detail line (leads load lazily)
function tourLeadHtml(st) {
  if (!st.lead_id) return '';
  if (!EXTRA.loaded.leads) { loadExtra('leads').then(() => { if (S.tour) renderTourCard(); }); return '<p class="small muted">Loading lead…</p>'; }
  const L = LEAD.get(st.lead_id); if (!L) return '';
  return `<div class="tc-lead small" data-tour-lead><span class="kindtag">${esc(LEAD_NOTE)}</span> <button type="button" class="linkish" data-lead="${esc(L.id)}">${esc(L.title)}</button>${leadDetailHtml(L)}</div>`;
}
function renderTourCard() {
  const c = $('#tour-card'); const t = tourById(S.tour); if (!t) { c.hidden = true; document.body.classList.remove('touring'); return; }
  const st = t.steps[S.step]; const n = t.steps.length;
  const ents = (st.entity_ids || []).filter(id => ENT.has(id)).slice(0, 8), lks = (st.link_ids || []).filter(id => LNK.has(id)).slice(0, 6);
  c.innerHTML = `<div class="tc-top"><span class="kindtag">Tour</span> <span class="muted small">${esc(t.title)}</span><button type="button" class="icon-btn" data-tour-exit aria-label="Exit tour">✕</button></div>
    <h2 id="tc-title">${esc(st.title || 'Step ' + (S.step + 1))}</h2><p>${esc(st.text || '')}</p>
    ${tourLeadHtml(st)}
    ${ents.length ? `<div class="small">${ents.map(entBtn).join(' · ')}</div>` : ''}
    ${lks.length ? `<ul class="claims compact">${lks.map(id => { const l = LNK.get(id); return `<li>${entBtn(l.from)} <span class="verb">${esc(LT(l.type).label)}</span> ${entBtn(l.to)} ${lbadge(l)} ${layerChips(l)} <button type="button" class="linkish small" data-link="${esc(id)}">claim</button></li>`; }).join('')}</ul>` : ''}
    <div class="tc-nav"><button type="button" class="btn sm" data-tour-prev ${S.step === 0 ? 'disabled' : ''}>← Back</button><span class="muted small" aria-live="polite">Step ${S.step + 1} of ${n}</span>${S.step < n - 1 ? '<button type="button" class="btn sm accent" data-tour-next>Next →</button>' : '<button type="button" class="btn sm accent" data-tour-exit>Finish</button>'}</div>`;
  c.hidden = false; document.body.classList.add('touring');
}
function tourGo(d) { const t = tourById(S.tour); if (!t) return; const j = S.step + d; if (j < 0 || j >= t.steps.length) return; S.step = j; applyTourStep(true); }
function exitTour() { S.tour = null; S.step = 0; $('#tour-card').hidden = true; document.body.classList.remove('touring'); clearSpot(); update(true); }
$('#tour-card').addEventListener('click', e => {
  if (e.target.closest('[data-tour-next]')) return tourGo(1);
  if (e.target.closest('[data-tour-prev]')) return tourGo(-1);
  if (e.target.closest('[data-tour-exit]')) return exitTour();
  const t = e.target.closest('[data-node],[data-link],[data-lead]'); if (!t) return;
  if (t.dataset.lead) return openLead(t.dataset.lead);
  if (t.dataset.node) select({ node: t.dataset.node }); else select({ link: t.dataset.link });
});
document.addEventListener('keydown', e => {
  if (!S.tour || $('#dlg').open || !$('#wt').hidden || !$('#disc').hidden) return;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName || '') || document.activeElement === $('#cy')) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); tourGo(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); tourGo(-1); } else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); exitTour(); }
}, true);
function renderTours() {
  if (!EXTRA.loaded.guide) { $('#tr-list').innerHTML = loadingNote('tours'); loadExtra('guide'); return; }
  const ts = (GUIDE.tours || []).filter(t => t.steps && t.steps.length);
  $('#tr-summary').textContent = ts.length ? `${ts.length} tours` : '';
  $('#tr-list').innerHTML = ts.length ? ts.map(t => `<article class="net-card tour-item"><div class="nc-head"><span class="ic" aria-hidden="true">▶</span><b>${esc(t.title)}</b></div><p class="small">${esc(t.summary || '')}</p><div class="nc-meta"><span class="muted">${t.steps.length} steps</span></div><div class="nc-act"><button type="button" class="btn sm accent" data-tour-go="${esc(t.id)}">Start tour</button> <a class="linkish small" href="#tour=${encodeURIComponent(t.id)}&step=0">link</a></div></article>`).join('')
    : '<p class="muted pad">No guided tours in this build. The map works the same without them.</p>';
}
$('#view-tours').addEventListener('click', e => { const b = e.target.closest('[data-tour-go]'); if (b) startTour(b.dataset.tourGo, 0); });

// ---- spotlight a [data-guide] element (used by tours with `target` and by the walkthrough)
const GUIDE_FALLBACK = { explain: '#cy', profile: '#panel', events: '#f-types' }; // events: the Events type chip (map), else the Type filter
function guideEl(target) {
  if (!target) return null;
  const cands = [...document.querySelectorAll(`[data-guide="${CSS.escape(target)}"]`)].filter(el => el.offsetParent !== null || el === document.body);
  if (cands.length) return cands[0];
  const fb = GUIDE_FALLBACK[target] && $(GUIDE_FALLBACK[target]); return fb && fb.offsetParent !== null ? fb : null;
}
function clearSpot() { document.querySelectorAll('.guide-spot').forEach(x => x.classList.remove('guide-spot')); }
function spotlightTarget(target) { clearSpot(); const el = guideEl(target); if (el) { el.classList.add('guide-spot'); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } return el; }

// ---- first-visit walkthrough (prefers the 'first-visit' tour; falls back to walkthrough.json, then a built-in one)
const WALK_KEY = 'wiretap-map:walkthrough-done';
const BUILTIN_WALK = { title: 'Welcome', steps: [
  { target: 'search', title: 'Search everything', text: 'Type a person, organization, bill or registry number. Press / from anywhere.' },
  { target: 'layers', title: 'Source layers', text: 'Turn the Wiretap, FringeViews, Bl00d Money and Public records layers on or off, or show only items seen in several layers.' },
  { target: 'profile', title: 'Profiles', text: 'Click a node for its profile: badges, sources, money in and out, and suggested next steps.' },
  { target: 'pathfinder', title: 'How are these connected?', text: 'Pick two entities to see up to three shortest chains of sourced links.' },
  { target: 'leads', title: 'Leads', text: 'Timing patterns in public data. A lead is a question to check, not evidence of wrongdoing.' },
  { target: 'help', title: 'Help', text: 'Replay this walkthrough at any time.' }] };
let WALK = null, walkI = 0;
function walkSteps() { const w = GUIDE.walkthrough && GUIDE.walkthrough.steps && GUIDE.walkthrough.steps.length ? GUIDE.walkthrough : BUILTIN_WALK; return w; }
function openWalk(i = 0) { if (S.tour) exitTour(); WALK = walkSteps(); walkI = i; $('#wt').hidden = false; document.body.classList.add('walking'); renderWalk(); }
function closeWalk(silent) { if ($('#wt').hidden) return; $('#wt').hidden = true; document.body.classList.remove('walking'); clearSpot(); try { localStorage.setItem(WALK_KEY, '1'); } catch { } if (!silent) $('#btn-help').focus(); }
function renderWalk() {
  const st = WALK.steps[walkI]; const n = WALK.steps.length;
  if (st.view && VIEWS.includes(st.view) && st.view !== S.view) setView(st.view);
  const el = spotlightTarget(st.target); const spot = $('#wt-spot'), card = $('#wt-card');
  if (el) { const r = el.getBoundingClientRect(); Object.assign(spot.style, { display: 'block', left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' }); }
  else spot.style.display = 'none';
  card.innerHTML = `<div class="tc-top"><span class="kindtag">${esc(WALK.title || 'Welcome')}</span><span class="muted small">${walkI + 1} / ${n}</span></div><h2 id="wt-title">${esc(st.title || '')}</h2><p>${esc(st.text || '')}</p>
    <div class="tc-nav"><button type="button" class="linkish" data-wt-skip>Skip</button><span></span><button type="button" class="btn sm" data-wt-prev ${walkI === 0 ? 'disabled' : ''}>← Back</button>${walkI < n - 1 ? '<button type="button" class="btn sm accent" data-wt-next>Next →</button>' : '<button type="button" class="btn sm accent" data-wt-skip>Done</button>'}</div>`;
  // place the card near the target, inside the viewport
  const vw = window.innerWidth, vh = window.innerHeight; const cw = Math.min(360, vw - 24);
  card.style.width = cw + 'px';
  if (el && vw > 700) { const r = el.getBoundingClientRect(); let left = r.right + 16; if (left + cw > vw - 12) left = Math.max(12, r.left - cw - 16); if (left < 12 || left + cw > vw - 12) left = Math.max(12, Math.min(vw - cw - 12, r.left)); let top = Math.max(12, Math.min(vh - card.offsetHeight - 12, r.top)); if (left === Math.max(12, Math.min(vw - cw - 12, r.left))) top = r.bottom + 12 + card.offsetHeight < vh ? r.bottom + 12 : Math.max(12, r.top - card.offsetHeight - 12); Object.assign(card.style, { left: left + 'px', top: top + 'px', bottom: 'auto' }); }
  else Object.assign(card.style, { left: (vw - cw) / 2 + 'px', top: 'auto', bottom: '16px' });
  card.querySelector('[data-wt-next],[data-wt-skip]:last-child')?.focus();
}
$('#wt').addEventListener('click', e => {
  if (e.target.closest('[data-wt-next]')) { walkI = Math.min(WALK.steps.length - 1, walkI + 1); return renderWalk(); }
  if (e.target.closest('[data-wt-prev]')) { walkI = Math.max(0, walkI - 1); return renderWalk(); }
  if (e.target.closest('[data-wt-skip]')) return closeWalk();
});
$('#wt').addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); closeWalk(); } else if (e.key === 'ArrowRight') { e.preventDefault(); $('#wt [data-wt-next]')?.click(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); $('#wt [data-wt-prev]')?.click(); } });
$('#btn-help').addEventListener('click', () => { if (!EXTRA.loaded.guide) loadExtra('guide').then(() => openWalk(0)); else openWalk(0); });
window.addEventListener('resize', debounce(() => { if (!$('#wt').hidden) renderWalk(); }, 120));
function maybeFirstVisit() {
  if (!$('#disc').hidden) { discAfter = maybeFirstVisit; return; } // the disclaimer comes first
  let done = false; try { done = localStorage.getItem(WALK_KEY) === '1'; } catch { done = true; }
  if (done || navigator.webdriver || S.tour || /(^|&)nowalk(=|&|$)/.test(location.hash.slice(1))) return;
  openWalk(0);
}

// ---- 'How are these connected?' finder: reuses shortestPaths over the filtered links; up to 3 paths
function openConnect(fromId) {
  const c = $('#connect'); c.hidden = false; document.body.classList.add('connecting');
  if (fromId && ENT.has(fromId)) { S.pa = fromId; if (S.pb === fromId) S.pb = null; }
  if (!$('#pf-names').children.length && D.entities.length <= 5000) $('#pf-names').innerHTML = D.entities.map(e => `<option value="${esc(e.name)}">`).join('');
  renderConnect(); setTimeout(() => (S.pa ? $('#cf-b') : $('#cf-a')).focus(), 20);
}
function closeConnect() { $('#connect').hidden = true; document.body.classList.remove('connecting'); $('#btn-connect').focus(); }
function renderConnect() {
  if ($('#connect').hidden) return;
  if (document.activeElement !== $('#cf-a')) $('#cf-a').value = S.pa ? name(S.pa) : '';
  if (document.activeElement !== $('#cf-b')) $('#cf-b').value = S.pb ? name(S.pb) : '';
  const out = $('#cf-out');
  if (!S.pa || !S.pb) { out.innerHTML = '<p class="help">Pick two entities. Shows up to 3 shortest chains of sourced links that pass the current filters (direction ignored). Every link keeps its status badge.</p>'; return; }
  $('#cf-mvia').checked = !!S.mvia;
  if (S.mvia) { const MP = moneyPaths(S.pa, S.pb, F.links, 3); out.innerHTML = (MP.length ? `<p><button type="button" class="btn sm" id="cf-map">Show on map</button></p>` : '') + moneyPathsHtml(MP, S.pa, S.pb); return; }
  const P = shortestPaths(S.pa, S.pb, F.links, 3);
  if (!P.length) { const all = shortestPaths(S.pa, S.pb, D.links, 1); out.innerHTML = `<p class="muted">No chain of links connects <b>${esc(name(S.pa))}</b> and <b>${esc(name(S.pb))}</b> with the current filters.${all.length ? ` A ${all[0].links.length}-step chain exists with all filters off. <button class="linkish" data-reset>Reset filters</button>` : ' They are not connected in the data.'}</p>`; return; }
  out.innerHTML = `<p><b>${P[0].links.length} step${P[0].links.length > 1 ? 's' : ''}</b> · ${P.length} path${P.length > 1 ? 's' : ''} shown <button type="button" class="btn sm" id="cf-map">Show on map</button></p>` + P.map((p, i) => `<h3 class="lbl">Path ${i + 1}</h3><ol class="path" aria-label="Path ${i + 1}">${p.links.map((lid, j) => { const l = LNK.get(lid); const a = p.nodes[j], b = p.nodes[j + 1]; const fwd = l.from === a; return `<li>${entBtn(a)} <span class="verb">${esc(fwd ? LT(l.type).label : LT(l.type).inverse)}</span> ${entBtn(b)} ${l.amount_cad > 0 ? `<span class="amt">${fmtCAD(l.amount_cad)}</span> ${estTag(l)}` : ''} ${lbadge(l)} ${layerChips(l)} <button type="button" class="linkish small" data-link="${esc(lid)}">claim</button></li>`; }).join('')}</ol>`).join('');
}
const cfSet = (which, v) => { const id = findEnt(v); if (v && !id) { toast('No entity matches “' + v + '”'); return; } S[which] = id; update(); };
$('#btn-connect').addEventListener('click', () => ($('#connect').hidden ? openConnect() : closeConnect()));
$('#cf-close').addEventListener('click', closeConnect);
for (const id of ['#cf-mvia', '#pf-mvia']) $(id)?.addEventListener('change', e => { S.mvia = e.target.checked; update(); });
$('#cf-a').addEventListener('change', e => cfSet('pa', e.target.value));
$('#cf-b').addEventListener('change', e => cfSet('pb', e.target.value));
$('#cf-go').addEventListener('click', () => { S.pa = findEnt($('#cf-a').value); S.pb = findEnt($('#cf-b').value); if (!S.pa || !S.pb) toast('Pick two entities'); update(); });
$('#cf-swap').addEventListener('click', () => { [S.pa, S.pb] = [S.pb, S.pa]; update(); });
for (const id of ['#cf-a', '#cf-b']) $(id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#cf-go').click(); } });
$('#connect').addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeConnect(); } });
$('#cf-out').addEventListener('click', e => {
  if (e.target.id === 'cf-map') { setView('map'); setTimeout(() => { if (!cy) return; const els = cy.elements('.path'); if (els.length) cy.animate({ fit: { eles: els, padding: 60 } }, { duration: 280 }); }, 40); return; }
  const t = e.target.closest('[data-node],[data-link]'); if (!t) return; if (t.dataset.node) select({ node: t.dataset.node }); else select({ link: t.dataset.link });
});

// ---- glossary: full list on About; definitions also appear as hover/tap titles on badges and layer chips
function renderGlossary() {
  const g = Object.entries(GLOSS || {}); if (!g.length) return;
  $('#about-glossary').innerHTML = `<dl class="glossary">${g.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
}
// tap on a badge / layer chip shows its definition (touch devices have no hover)
document.addEventListener('click', e => {
  const b = e.target.closest('.badge[data-gloss], .layer[data-layer-chip], .seen'); if (!b || e.target.closest('button,a')) return;
  if (!matchMedia('(hover: none)').matches) return;
  toast(b.getAttribute('title') || '');
});

// ---- 77-disclaimer.js
/* 'About this map' disclaimer (shown once, before the first-visit walkthrough) and 'Report a correction' links */
const DISC_KEY = 'wiretap-map:disclaimer-ok';
let discReturn = null, discAfter = null;
const discOpen = () => !$('#disc').hidden;
function discSeen() { try { return localStorage.getItem(DISC_KEY) === '1'; } catch { return false; } }
function openDisclaimer() {
  const d = $('#disc'); if (!d.hidden) return;
  discReturn = document.activeElement;
  // keep keyboard and screen-reader focus inside the dialog
  for (const el of document.body.children) if (el !== d && !el.inert && !/^(SCRIPT|DATALIST)$/.test(el.tagName)) { el.inert = true; el.dataset.discInert = ''; }
  d.hidden = false; document.body.classList.add('disc-open');
  setTimeout(() => $('#disc-ok').focus(), 20);
}
function closeDisclaimer() {
  const d = $('#disc'); if (d.hidden) return;
  d.hidden = true; document.body.classList.remove('disc-open');
  for (const el of document.querySelectorAll('[data-disc-inert]')) { el.inert = false; delete el.dataset.discInert; }
  try { localStorage.setItem(DISC_KEY, '1'); } catch { }
  const r = discReturn; discReturn = null; if (r && r.isConnected && r !== document.body) r.focus();
  const after = discAfter; discAfter = null; if (after) setTimeout(after, 50);
}
// first visit: after boot, unless already acknowledged (automation skips it like the walkthrough; ?disclaimer=1 forces it)
function maybeDisclaimer() {
  const force = /[?&]disclaimer=1(&|$)/.test(location.search);
  if (force || (!discSeen() && !navigator.webdriver)) openDisclaimer();
}
$('#disc-ok').addEventListener('click', closeDisclaimer);
$('#disc').addEventListener('keydown', e => {
  e.stopPropagation(); // no map shortcuts while it is open
  if (e.key === 'Escape') { e.preventDefault(); closeDisclaimer(); return; }
  if (e.key !== 'Tab') return;
  const f = $$('#disc button, #disc a[href]'); if (!f.length) return;
  const i = f.indexOf(document.activeElement);
  if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } else if (i < 0) { e.preventDefault(); f[0].focus(); }
});
document.addEventListener('click', e => { if (e.target.closest('[data-disclaimer]')) { e.preventDefault(); if (window.innerWidth <= 900 && document.body.classList.contains('sb-open')) closeSidebarMobile(); openDisclaimer(); } });

// ---- 'Report a correction': target set by data-overrides.json "corrections_url" (or CORRECTIONS_URL at build time)
const CORR_URL = (D.meta && D.meta.corrections_url) || '';
function correctionLink(kind, id, label) {
  const txt = `<span class="ic" aria-hidden="true">✎</span>Report a correction`;
  const aria = `Report a correction to ${kind === 'claim' ? 'claim' : ''} ${label} (id ${id})`.replace(/\s+/g, ' ');
  if (CORR_URL) { const u = CORR_URL.replaceAll('{id}', encodeURIComponent(id)).replaceAll('{name}', encodeURIComponent(label)); return `<a class="corr-link" href="${esc(u)}" target="_blank" rel="noopener" aria-label="${esc(aria)}">${txt}</a>`; }
  return `<button type="button" class="corr-link" data-correct="${esc(kind)}" data-correct-id="${esc(id)}" aria-haspopup="dialog" aria-label="${esc(aria)}">${txt}</button>`;
}
const claimLabel = l => `${name(l.from)} ${LT(l.type).label} ${name(l.to)}`;
function openCorrection(kind, id) {
  const isClaim = kind === 'claim'; const it = isClaim ? LNK.get(id) : ENT.get(id); if (!it) return;
  const label = isClaim ? claimLabel(it) : it.name;
  openDialog('Report a correction', `<dl class="corr-entry"><dt>Entry</dt><dd>${esc(label)}</dd><dt>Kind</dt><dd>${isClaim ? 'Claim' : 'Profile (' + esc(TYPE[it.type]?.label || it.type) + ')'}</dd><dt>ID</dt><dd><code>${esc(id)}</code></dd></dl>
    <p>A corrections contact will be added before public launch.</p>
    <p class="small muted">Until then, keep the entry name and id above with your note so the correction can be matched to this entry. Every claim links to its sources so you can check them yourself.</p>`);
}
document.addEventListener('click', e => { const b = e.target.closest('[data-correct]'); if (b) openCorrection(b.dataset.correct, b.dataset.correctId); });

// ---- 90-main.js
const TIMING = {};
let AUTO_EXTRAS = [];
/* main: views, selection, update loop, boot */
function setView(v, push = true) {
  if (!VIEWS.includes(v)) v = 'map';
  S.view = v;
  for (const x of VIEWS) { const on = x === v; $('#view-' + x).hidden = !on; const t = $('#tab-' + x); t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; t.classList.toggle('on', on); }
  if (v === 'map' && cy) { cy.resize(); if (curLayout !== S.layout) { prevVisibleKey = ''; } }
  update(push);
}
function select(sel, push = true) {
  S.node = sel.node || null; S.link = sel.link || null; S.net = sel.net || null; S.ov = sel.ov != null ? sel.ov : null; S.lead = sel.lead || null;
  if (S.tour && (S.node || S.link)) { S.tour = null; $('#tour-card').hidden = true; document.body.classList.remove('touring'); clearSpot(); }
  if (S.node) kbd = S.node;
  update(push);
  if (S.node || S.link || S.ov != null) { setTimeout(focusSelection, 30); const e = S.node ? name(S.node) : S.link ? 'claim' : 'overlap'; announce(`Opened ${e}`); }
  if (window.innerWidth <= 900 && (S.node || S.link || S.ov != null)) document.body.classList.add('panel-open');
}
function selectNet(id) { S.net = id; S.node = S.link = S.lead = null; S.ov = null; update(true); if (id) { setTimeout(focusSelection, 30); announce(`Highlighting ${NET.get(id).name}`); } }
let updating = false;
function update(push) {
  if (updating) return; updating = true;
  try {
    F = filtered();
    renderFilters();
    const n = F.ents.size, l = F.links.length;
    $('#filter-count').textContent = `${n} of ${D.entities.length} entities · ${l} of ${D.links.length} claims`;
    if (S.view === 'map') renderGraph(); else if (cy) { renderGraph(); }
    if (S.view === 'money') { renderMoney(); renderIntermediaryChains(); renderMoneyChains(); }
    if (S.view === 'timeline') renderTimeline();
    if (S.view === 'networks') renderNetworks();
    if (S.view === 'leads') renderLeads();
    if (S.view === 'tours') renderTours();
    if (S.view === 'overlaps') renderOverlapsView(); else if (S.pa && S.pb) { PATHS = S.mvia ? moneyPaths(S.pa, S.pb, F.links, 5) : shortestPaths(S.pa, S.pb, F.links); highlightSelection(); }
    if (S.view === 'index') renderIndex();
    if (S.view === 'sources') renderSources();
    if (S.view === 'overlaps' && cy) highlightSelection();
    renderPanel(); renderConnect();
    if (typeof solAfterUpdate === 'function') solAfterUpdate();
    if (S.tour && $('#tour-card').hidden && EXTRA.loaded.guide) renderTourCard();
    commit(push);
  } finally { updating = false; }
}
// tabs (roving tabindex + arrows)
$$('.tabs [role=tab]').forEach(t => t.addEventListener('click', () => setView(t.dataset.view)));
$('.tabs').addEventListener('keydown', e => { const tabs = $$('.tabs [role=tab]'); const i = tabs.indexOf(document.activeElement); if (i < 0) return; let j = null; if (e.key === 'ArrowRight') j = (i + 1) % tabs.length; else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length; else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = tabs.length - 1; if (j == null) return; e.preventDefault(); tabs[j].focus(); setView(tabs[j].dataset.view); });
$('#btn-close').addEventListener('click', () => { select({}); document.body.classList.remove('panel-open', 'panel-full'); });
$('#btn-copy').addEventListener('click', async () => { const url = location.href; try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { openDialog('Copy link', `<textarea readonly rows="3" class="code">${esc(url)}</textarea>`); } });
$('#btn-print').addEventListener('click', () => window.print());
$('#panel-grip').addEventListener('click', () => { const full = document.body.classList.toggle('panel-full'); $('#panel-grip').setAttribute('aria-expanded', full); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || $('#dlg').open) return;
  if (document.activeElement === $('#q')) return;
  if (document.body.classList.contains('sb-open')) return closeSidebarMobile();
  if (S.expand.length) { S.expand = []; prevVisibleKey = ''; return update(true); }
  if (S.node || S.link || S.net || S.ov != null || S.lead) select({});
});
function onExtraLoaded(name) {
  if (name === 'guide') { renderGlossary(); renderLegend(); if (S.tour) { if (tourById(S.tour)) applyTourStep(false); else S.tour = null; } }
  if (name === 'sources') $('#sb-updated').textContent = sbText();
  if (name === 'overlaps') $('#sb-updated').textContent = sbText();
  if (!updating) update(false);
}
const sbText = () => { const built = new Date(D.meta.built_at); const upd = isNaN(built) ? '' : built.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }); return `Data last updated ${upd}${D.meta.data_updated ? ' · source files ' + String(D.meta.data_updated).slice(0, 10) : ''} · ${D.entities.length} entities · ${D.links.length} claims · ${EXTRA.loaded.sources ? D.sources.length : D.meta.counts?.sources ?? '…'} sources · ${EXTRA.loaded.overlaps ? OVS.length : '…'} overlaps`; };
window.addEventListener('popstate', () => { fromHash(); lastHash = toHash(); $('#q').value = S.q; renderResults(); setView(S.view, false); });
window.addEventListener('hashchange', () => { if (location.hash.slice(1) === lastHash) return; fromHash(); lastHash = toHash(); $('#q').value = S.q; renderResults(); setView(S.view, false); });
window.addEventListener('resize', debounce(() => { if (cy && S.view === 'map') cy.resize(); if (S.view === 'money') renderMoney(); if (S.view === 'timeline') renderTimeline(); }, 150));

// ---- boot
(function boot() {
  const P = k => (TIMING.stages = TIMING.stages || {})[k] = Math.round(performance.now());
  P('boot_start');
  if (D.meta.is_sample) $('#sample-banner').hidden = false;
  const built = new Date(D.meta.built_at); const upd = isNaN(built) ? '' : built.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  $('#built-at').textContent = upd ? `data updated ${upd}` : '';
  $('#sb-updated').textContent = sbText();
  $('#about-build').textContent = `Build ${String(D.meta.built_at).slice(0, 16).replace('T', ' ')} UTC · ${D.meta.is_sample ? 'example data' : 'real data'} · layers: ${LAYERS_PRESENT.map(k => layerInfo(k).label).join(', ')}`;
  $('#about-keys').innerHTML = `<dl class="keys">${KEYS.map(([k, d]) => `<dt><kbd>${esc(k)}</kbd></dt><dd>${esc(d)}</dd>`).join('')}</dl>`;
  renderLegend();
  fromHash(); lastHash = toHash();
  $('#q').value = S.q;
  DEFER_EDGES = BIG && !LOD_ON && !S.node && !S.link && !S.net && !S.lead && !S.tour && S.ov == null && !/[?&]edges=now/.test(location.search);
  P('before_graph'); try { initGraph();
  if (typeof bindTheoryUi === 'function') bindTheoryUi();
  if (typeof syncTheoryGraph === 'function') syncTheoryGraph(); } catch (err) { console.error(err); $('#cy').innerHTML = '<p class="empty">The graph could not be drawn in this browser. The Index view has the same data.</p>'; }
  P('graph_init'); F = filtered(); renderResults(); P('filtered');
  setView(S.view, false); P('set_view');
  if (S.node || S.link) setTimeout(focusSelection, 60);
  const ld = $('#loading'); ld.classList.add('done'); setTimeout(() => ld.remove(), 300);
  document.body.classList.add('ready');
  maybeDisclaimer();
  // first paint: measured when cytoscape has drawn its first frame
  const t0 = window.__WIRETAP_T0 || 0; TIMING.boot_ms = Math.round(performance.now() - t0);
  const mark = () => { if (TIMING.first_paint_ms == null) { TIMING.first_paint_ms = Math.round(performance.now() - t0); TIMING.webgl = typeof USE_WEBGL !== 'undefined' && USE_WEBGL; const pendingLod = LOD_ON && LOD.deferFill; if (!DEFER_EDGES && !pendingLod) TIMING.full_paint_ms = TIMING.first_paint_ms; setTimeout(() => { addDeferredEdges(); if (pendingLod) { LOD.deferFill = false; const changed = lodSync(); if (changed && typeof renderGraph === 'function') renderGraph(); if (changed && cy) cy.one('render', () => { if (TIMING.full_paint_ms == null) TIMING.full_paint_ms = Math.round(performance.now() - t0); }); else TIMING.full_paint_ms = Math.round(performance.now() - t0); } setTimeout(kick, 0); }, 0); } };
  // lazy extras after first paint (search first: it is the most likely next action)
  // LITE devices fetch overlaps and the source list only when a view needs them (search and explanations are chunked)
  const want = LITE ? ['guide', 'leads'] : ['search', 'guide', 'leads', 'overlaps', 'sources', 'explain'];
  AUTO_EXTRAS = want;
  const kick = () => { for (const n of want) loadExtra(n); Promise.all(want.slice(0, 5).map(n => new Promise(r => (EXTRA.loaded[n] ? r() : (EXTRA.waiters[n] = EXTRA.waiters[n] || []).push(r))))).then(() => { TIMING.extras_ms = Math.round(performance.now() - t0); setTimeout(maybeFirstVisit, 50); }); };
  // the extras start loading once the map has drawn its first frame
  if (cy) { cy.one('render', mark); requestAnimationFrame(() => requestAnimationFrame(mark)); } else mark();
})();
// test / debugging hook (read-only accessors)
window.__wiretap = { sol: () => window.__wiretapSol, timing: () => TIMING, extras: () => ({ ...EXTRA.loaded }), extrasReady: () => AUTO_EXTRAS.length > 0 && AUTO_EXTRAS.every(k => EXTRA.loaded[k]), lite: () => LITE, lod: () => LOD_ON, chunks: () => ({ lite: LITE, lod: LOD_ON, node_max: LOD.NODE_MAX, overview_n: LOD.OVERVIEW_N, buckets_loaded: DET.have.size, buckets_pending: DET.pending.size, shards_loaded: SH.data.size, graph_nodes: cy ? cy.nodes().length : 0, graph_edges: cy ? cy.edges().length : 0, lod_adds: LOD.adds, lod_removes: LOD.removes }), hydrated: id => isHyd(ENT.get(id) || LNK.get(id)), runSearch: q => runSearch(q), searchLoad, leads: () => LEADS, guide: () => GUIDE, startTour, openWalk, openConnect, openDisclaimer, closeDisclaimer, data: () => D, cy: () => cy, state: () => S, filtered: () => F, overlaps: () => OVS, paths: () => PATHS, shortestPaths, update, select, setView, theory: () => window.__wiretapTheory, setTheorySwitch: typeof setTheorySwitch === 'function' ? setTheorySwitch : null };

})();
