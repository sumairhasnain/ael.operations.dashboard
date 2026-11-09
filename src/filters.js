/* 8 Nov 2026: the filters & tabs script, moved out of dashboard.html as-is to keep the page under the artifact size limit. It must stay where its <script src> tag is (after the kit script, before the drawing script). */
/* ---------- filters & tabs ---------- */
(() => {
const SHOPS = ['Clutch','Ignition Coil','Drum Gear','Carburetor','Piston','CIF Machining','HPDC / Die Cast','Polymer','Bridge Fork Top','Cushion','Hubs','Carb Child Parts'];
const MONTHS = ['2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12'];
const MODELS = ['CD70','CD-Dream','CG125','CG125S','Pridor','CB125F','CB150F','K4AA'];
window.__MODELS = MODELS; window.__SHOPS = SHOPS; window.__MONTHS = MONTHS; /* window.__TODAY is set in dashboard.html (the refresh tasks edit it there) */
const mEnd = m => { const [y, mm] = m.split('-').map(Number); return `${m}-${String(new Date(Date.UTC(y, mm, 0)).getUTCDate()).padStart(2, '0')}`; };
window.__mEnd = mEnd;
const sShop = document.getElementById('f-shop'), sMonth = document.getElementById('f-month'), iDate = document.getElementById('f-date'), sShift = document.getElementById('f-shift'), sModel = document.getElementById('f-model'), sPart = document.getElementById('f-part');
sShop.replaceChildren(new Option('All shops', 'All'), ...SHOPS.map(s => new Option(s, s)));
sModel.replaceChildren(new Option('All models', 'All'), ...MODELS.map(s => new Option(s, s)));
sMonth.replaceChildren(...MONTHS.map(m => new Option(d3.utcFormat('%b %Y')(new Date(m + '-01T00:00:00Z')), m)));
const setDefaults = () => { const p = dash.params(); if (!p.month) dash.setParams({ shop: 'All', model: 'All', month: '2026-11', asof: window.__ASOF0.asof, shift: 'All' }); };
setDefaults();
sShop.addEventListener('change', () => dash.setParams({ shop: sShop.value, sf: 0, pf: 0 }));
sModel.addEventListener('change', () => dash.setParams({ model: sModel.value, mf: 0, pf: 0 }));

const pList = document.getElementById('f-part-list'), pX = document.getElementById('f-part-x'); let _ps = [], _pi = -1, _pL = [];
const pickPart = code => { pList.hidden = true; sPart.setAttribute('aria-expanded', 'false'); dash.setParams({ pf: code || 0, vpart: 0, ihpart: 0, dpart: 0, cp: 0 }); if (!code) sPart.value = ''; };
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const showSug = () => { const t = sPart.value.trim().toLowerCase(), ws = t.split(/\s+/).filter(Boolean);
const hit = r => { const h = (r.part + ' ' + r.code).toLowerCase(); return ws.every(w => h.includes(w)); };
_ps = (ws.length ? _pL.filter(hit).sort((a, b) => { const sa = a.part.toLowerCase().startsWith(ws[0]) || a.code.startsWith(ws[0]) ? 0 : 1, sb = b.part.toLowerCase().startsWith(ws[0]) || b.code.startsWith(ws[0]) ? 0 : 1; return sa - sb; }) : _pL).slice(0, 15); _pi = -1;
const mark = x => { let o = esc(x); ws.forEach(w => { o = o.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<b>$1</b>'); }); return o; };
pList.innerHTML = _ps.length ? _ps.map((r, i) => `<div role="option" data-i="${i}"><span>${mark(r.part.trim())}</span><small>${mark(r.code)}</small></div>`).join('') + (ws.length ? '' : `<div class="pn">Type to narrow ${_pL.length} parts</div>`) : '<div class="pn">No part matches</div>';
pList.hidden = false; sPart.setAttribute('aria-expanded', 'true'); };
const moveSug = d => { const it = [...pList.querySelectorAll('div[data-i]')]; if (!it.length) return; _pi = (_pi + d + it.length) % it.length; it.forEach((e, i) => e.classList.toggle('on', i === _pi)); it[_pi].scrollIntoView({ block: 'nearest' }); };
sPart.addEventListener('focus', () => { sPart.select(); showSug(); });
sPart.addEventListener('input', showSug);
sPart.addEventListener('keydown', ev => { if (ev.key === 'ArrowDown') { ev.preventDefault(); if (pList.hidden) showSug(); moveSug(1); } else if (ev.key === 'ArrowUp') { ev.preventDefault(); moveSug(-1); }
else if (ev.key === 'Enter') { ev.preventDefault(); if (!sPart.value.trim()) pickPart(0); else { const r = _ps[_pi >= 0 ? _pi : 0]; if (r) pickPart(r.code); } sPart.blur(); }
else if (ev.key === 'Escape') { pList.hidden = true; sPart.blur(); } });
pList.addEventListener('mousedown', ev => { const d = ev.target.closest('div[data-i]'); if (!d) return; ev.preventDefault(); pickPart(_ps[+d.dataset.i].code); sPart.blur(); });
sPart.addEventListener('blur', () => setTimeout(() => { pList.hidden = true; sPart.setAttribute('aria-expanded', 'false'); window.__syncFilters(); }, 120));
pX.addEventListener('click', () => pickPart(0));

let _pl = {};
const partList = () => { const A = dash.data('atlas_parts'), K = dash.data('atlas_child_stock'), B = dash.data('atlas_bom'); const a = A.status === 'ok' ? (window.__shopx ? window.__shopx(A.data) : A.data) : [], k = K.status === 'ok' ? K.data : [], b = B.status === 'ok' ? B.data : [];
if (_pl.a === a && _pl.k === k && _pl.b === b) return _pl.rows;
const mm = new Map(a.map(r => [String(r.code), String(r.models || r.model || '').split('/').filter(Boolean)])), shs = r => { const v = r.shops; if (Array.isArray(v)) return v; try { const j = JSON.parse(v); if (Array.isArray(j)) return j; } catch (e) {} return v ? String(v).split('/').map(x => x.trim()).filter(Boolean) : []; };
const bm = new Map(); b.forEach(x => { const set = bm.get(String(x.code)) || new Set(); String(x.fg || '').split(/[;,]/).forEach(f => (mm.get(f.split(':')[0].trim()) || []).forEach(m => set.add(m))); bm.set(String(x.code), set); });
const rows = new Map(); a.forEach(r => rows.set(String(r.code), { code: String(r.code), part: r.part || String(r.code), shops: [r.shop, ...shs(r)].filter(Boolean), mods: mm.get(String(r.code)) || [] }));
k.forEach(r => { if (!rows.has(String(r.code))) rows.set(String(r.code), { code: String(r.code), part: r.part || String(r.code), shops: [r.shop].filter(Boolean), mods: [...(bm.get(String(r.code)) || [])], vendor: 1 }); });
_pl = { a, k, b, rows: [...rows.values()].sort((x, y) => d3.ascending(x.part, y.part) || d3.ascending(x.code, y.code)) }; return _pl.rows; };
let _pk = '';
const fillParts = p => { const L = partList().filter(r => (p.shop === 'All' || r.shops.includes(p.shop)) && (p.model === 'All' || r.mods.includes(p.model)) || r.code === p.pf), key = [p.shop, p.model, L.length, _pl.rows && _pl.rows.length].join('|');
if (key !== _pk) { _pk = key; _pL = L; sPart.placeholder = `All parts (${L.length}) · type to search`; }
const cur = p.pf ? L.find(r => r.code === p.pf) : null; if (document.activeElement !== sPart) sPart.value = cur ? `${cur.part.trim()} · ${cur.code}` : ''; sPart.title = sPart.value; pX.hidden = !p.pf; };
sShift.addEventListener('change', () => dash.setParams({ shift: sShift.value }));
document.getElementById('f-clear').addEventListener('click', () => {
document.querySelectorAll('#ael input.q').forEach(i => { i.value = ''; });
const bv = document.getElementById('s-bomv'); if (bv) bv.value = 'all';
dash.setParams({ shop: 'All', model: 'All', shift: 'All', sf: 0, mf: 0, pf: 0, product: 0, ihpart: 0, cp: 0, dpart: 0, vend: 0, vpart: 0, day: 0, ihb: 0, wfa: 0 });
window.__draw && window.__draw(); });
sMonth.addEventListener('change', () => { const m = sMonth.value; const e = mEnd(m); dash.setParams({ month: m, asof: (window.__TODAY >= m + '-01' && window.__TODAY <= e) ? window.__TODAY : e }); });
iDate.addEventListener('change', () => { const v = iDate.value; if (v && iDate.validity.valid && v >= '2026-06-01' && v <= '2026-12-31') dash.setParams({ month: v.slice(0, 7), asof: v }); });
iDate.addEventListener('blur', () => { iDate.value = dash.params().asof || ''; });
let _dt = { src: null, v: null };
window.__dataTo = () => { const d = dash.data('atlas_parts_daily'); if (!d || d.status !== 'ok') return window.__TODAY; if (d.data !== _dt.src) { let mx = ''; for (const r of d.data) if ((r.prod_actual != null || r.disp_actual != null) && r.date > mx) mx = r.date; _dt = { src: d.data, v: mx && mx < window.__TODAY ? mx : window.__TODAY }; } return _dt.v; };
window.__P = () => { const p = dash.params(); const month = p.month || '2026-11', e = mEnd(month); let asof = p.asof || window.__TODAY; if (asof < month + '-01' || asof > e) asof = e;
const __pb = { shop: p.shop || 'All', model: MODELS.includes(p.model) ? p.model : 'All', product: p.product || null, ihpart: p.ihpart || null, cp: p.cp ? String(p.cp) : null, dpart: p.dpart || null, month, start: month + '-01', end: e, asof, shift: p.shift || 'All', sf: !!p.sf && (p.shop || 'All') !== 'All', mf: !!p.mf && MODELS.includes(p.model), pf: p.pf ? String(p.pf) : null, actEnd: [asof, window.__TODAY, window.__dataTo()].sort()[0], future: month + '-01' > window.__TODAY };
const base = __pb; base.full = { ...base }; const dy = String(p.day || '');
if (/^\d{4}-\d{2}-\d{2}$/.test(dy) && dy >= base.start && dy <= base.end) return { ...base, day: dy, start: dy, end: dy, asof: dy, actEnd: [dy, window.__TODAY, window.__dataTo()].sort()[0], full: base.full };
return { ...base, day: null }; };
window.__syncFilters = () => { const p = window.__P(); { const dt = window.__dataTo(), el = document.getElementById('f-data'); if (el) el.textContent = p.day ? `Showing ${+p.day.slice(8)} ${new Date(p.day + 'T00:00:00Z').toLocaleString('en', { month: 'short', timeZone: 'UTC' })} only · click the bar again or Clear filters` : ''; /* 9 Nov (Umair): the 'Plan to … · Atlas actuals to …' line is no longer shown */ } sShop.value = p.shop; sModel.value = p.model; fillParts(p); sMonth.value = p.month; sShift.value = p.shift; if (document.activeElement !== iDate) iDate.value = p.asof; 
const cm = window.__TODAY.slice(0, 7), on = (el, v) => el && el.classList.toggle('fon', !!v);
on(sShop, p.shop !== 'All'); on(sModel, p.model !== 'All'); on(sPart, !!p.pf); on(sShift, p.shift !== 'All'); on(sMonth, p.month !== cm); on(iDate, !!p.day || p.asof !== (p.month === cm ? window.__TODAY : p.end)); window.__clearState(); };

const NOT_FILTER = new Set(['month', 'asof', '_day', 'capsh', 'shop', 'model', 'shift']);
window.__clearState = () => { const btn = document.getElementById('f-clear'); if (!btn) return; const root = document.getElementById('ael');
const dd = !!root.querySelector('.filters .fon:not(#f-clear)'), pr = Object.entries(dash.params() || {}).some(([k, v]) => !NOT_FILTER.has(k) && !(k === 'invoff' && String(v).split('|').every(c => ['Raw Material', 'Lubricants', 'Production parts'].includes(c))) && v !== 0 && v !== '0' && v !== '' && v != null && v !== false && v !== 'All' && v !== 'all');
const tx = [...root.querySelectorAll('input.q')].some(i => i.value.trim()), vw = [...root.querySelectorAll('select[data-default]')].some(e => e.value !== e.dataset.default) || ((document.getElementById('s-bomv') || {}).value || 'all') !== 'all';
const act = dd || pr || tx || vw; btn.classList.toggle('fon', act); root.querySelectorAll('button.qclr').forEach(b => b.classList.toggle('fon', act)); btn.title = act ? 'Filters are applied: click to clear them all' : 'Reset shop, model, shift, vendor and part selections (keeps month and date)'; };
document.getElementById('ael').addEventListener('input', ev => { if (ev.target.matches('input.q')) window.__clearState(); });
document.getElementById('ael').addEventListener('change', ev => { if (ev.target.matches('select')) setTimeout(window.__clearState, 0); });
const pages = ['overview','production','product','vendor','inhouse','quality','maintenance','oee','capacity','efficiency','workforce','inventory','cost','savings','issues','projects','bom'];
window.__page = 'overview';
const show = (p, link) => { if (!pages.includes(p)) p = 'overview'; window.__page = p;
document.querySelectorAll('#ael .page').forEach(s => s.classList.toggle('on', s.id === p));
document.querySelectorAll('#tabs .tab').forEach(b => b.setAttribute('aria-selected', b.dataset.p === p ? 'true' : 'false'));
if (link) dash.setLink(p); window.__draw && window.__draw(); };
window.__show = p => show(p, true);
window.__setShifts = async (machine, n, base) => { if (window.__PORTAL && window.__PORTAL.saveShifts) { await window.__PORTAL.saveShifts(machine, n); return; }
let m = {}; try { m = JSON.parse(dash.params().capsh || '{}') || {}; } catch (e) { m = {}; } if (n === base) delete m[machine]; else m[machine] = n; dash.setParams({ capsh: Object.keys(m).length ? JSON.stringify(m) : 0 }); };
window.__resetShifts = async machines => { if (window.__PORTAL && window.__PORTAL.saveShifts) { for (const mc of machines) await window.__PORTAL.saveShifts(mc, null); return; } dash.setParams({ capsh: 0 }); };
document.getElementById('tabs').addEventListener('click', ev => { const b = ev.target.closest('.tab'); if (!b) return; show(b.dataset.p, true); });
show(location.hash.slice(1) || 'overview', false);
[['q-parts', 'q-parts2'], ['q-parts2', 'q-parts']].forEach(([a, b]) => document.getElementById(a).addEventListener('input', () => { document.getElementById(b).value = document.getElementById(a).value; }));
['q-parts','q-parts2','q-prod','q-ih','q-wf','q-bd','q-crit','q-iss','q-vt','q-vs','q-bom','q-capm','q-fih','q-fv','q-fs'].forEach(id => document.getElementById(id).addEventListener('input', () => window.__draw()));
})();
/* 9 Nov (Umair): the filter row stays hidden; hovering the funnel button beside the title opens it, and it stays open until the
   cursor leaves the dark top pane (not while a box in it is still being used). The funnel turns amber while any filter is applied. */
(() => { const hdr = document.querySelector('.ael .hdr'), tog = document.getElementById('f-tog'), fl = hdr && hdr.querySelector('.filters'), clr = document.getElementById('f-clear');
  if (!hdr || !tog || !fl) return; let over = false;
  const set = v => { hdr.classList.toggle('fopen', v); tog.setAttribute('aria-expanded', String(v)); };
  const busy = () => fl.contains(document.activeElement) && /^(SELECT|INPUT)$/.test(document.activeElement.tagName);
  tog.addEventListener('mouseenter', () => set(true)); tog.addEventListener('click', () => set(!hdr.classList.contains('fopen')));
  hdr.addEventListener('mouseenter', () => { over = true; }); hdr.addEventListener('mouseleave', () => { over = false; setTimeout(() => { if (!over && !busy()) set(false); }, 250); });
  fl.addEventListener('focusout', () => setTimeout(() => { if (!over && !busy()) set(false); }, 300));
  if (clr) { const sync = () => { const a = clr.classList.contains('fon'); tog.classList.toggle('fon', a); tog.title = a ? 'Filters are applied · hover to see them' : 'Filters'; }; new MutationObserver(sync).observe(clr, { attributes: true, attributeFilter: ['class'] }); sync(); }
})();
