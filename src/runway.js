/* Stock runway hover (29 Oct, Umair): on "Part Compliance - Other Parts", the row tooltip shows, beside the vendor panel, how long the part
   and its BOM components (in-house made and vendor supplied) will last at the current month's plan, against the next delivery.
   Bar = today to projected run-out (Atlas stock / average daily need). Dot = next delivery: in-house = next planned
   production day in Atlas; vendor = expected from the last 30 days' delivery pattern (Atlas has no booked delivery dates). */
(() => {
  const css = document.createElement('style');
  css.textContent = `.rwpop{position:fixed;z-index:61;pointer-events:none;background:#fff;border:1px solid #D5DCE3;box-shadow:0 10px 28px rgba(5,28,44,.18);border-radius:6px;font-size:12px;color:#051C2C;display:none;width:600px;max-width:calc(100vw - 16px)}
.rwpop .hd{background:#051C2C;color:#fff;padding:7px 10px;font-weight:600;border-radius:6px 6px 0 0}.rwpop .hd span{font-weight:400;opacity:.8}
.rwpop svg{display:block}.rwpop .ft{padding:6px 10px 8px;color:#5A6670;font-size:11px;line-height:1.4}.rwpop .fl{margin:6px 10px 0;display:inline-block;font-size:11px;font-weight:600;color:#B02622;background:#FBE3E3;border-radius:10px;padding:2px 9px}`;
  document.head.appendChild(css);
  const pop = document.createElement('div'); pop.className = 'rwpop'; document.body.appendChild(pop);
  const D = id => ((window.dash && dash.data(id)) || {}).data || [];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const nf = d3.format(',.0f'), df = d3.utcFormat('%-d %b');
  const dt = s => new Date(s + 'T00:00:00Z'), iso = d => d.toISOString().slice(0, 10);
  /* working days (Mon-Sat) between and after dates */
  const addWd = (s, n) => { const d = dt(s); let k = 0; while (k < n) { d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay()) k++; } return iso(d); };
  const wdBetween = (a, b) => { let n = 0; const d = dt(a), e = dt(b); while (d < e) { d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay()) n++; } return n; };
  let cache = {};
  const model = () => {
    const T = window.__TODAY || iso(new Date()), m = T.slice(0, 7), pd = D('atlas_parts_daily'), cs = D('atlas_child_stock'), bom = D('atlas_bom'), vs = D('atlas_vendor_supply');
    if (cache.pd === pd && cache.cs === cs && cache.vs === vs && cache.T === T) return cache;
    const tot = new Map(), plan = new Map(), futP = new Map(), lastA = new Map();
    pd.forEach(r => { const c = String(r.code); if (r.date.startsWith(m)) { tot.set(r.date, (tot.get(r.date) || 0) + (r.prod_plan || 0)); plan.set(c, (plan.get(c) || 0) + (r.prod_plan || 0)); }
      if (r.date > T && r.prod_plan > 0 && (!futP.get(c) || r.date < futP.get(c))) futP.set(c, r.date);
      if (r.date <= T && r.prod_actual > 0 && (!lastA.get(c) || r.date > lastA.get(c))) lastA.set(c, r.date); });
    const nWd = [...tot.values()].filter(v => v > 5000).length || 26, daily = c => (plan.get(String(c)) || 0) / nWd;
    const par = new Map(), info = new Map();
    bom.forEach(b => { const c = String(b.code); info.set(c, b); String(b.fg || '').split(';').forEach(t => { const [f, q] = t.split(':'); if (f) (par.get(c) || par.set(c, []).get(c)).push({ f, q: +q || 1 }); }); });
    const kids = new Map(); par.forEach((ps, c) => ps.forEach(({ f }) => (kids.get(f) || kids.set(f, new Set()).get(f)).add(c)));
    const from = iso(new Date(dt(T).getTime() - 30 * 864e5)), rc = new Map();
    vs.forEach(r => { if (r.date > from && r.date <= T && +r.received > 0) { const c = String(r.code); (rc.get(c) || rc.set(c, new Set()).get(c)).add(r.date); } });
    cache = { pd, cs, vs, T, daily, par, kids, info, futP, lastA, rc, stock: new Map(cs.map(r => [String(r.code), r])) };
    return cache;
  };
  const item = (M, c) => {
    const s = M.stock.get(c); if (!s) return null;
    const ps = M.par.get(c), need = ps && ps.length ? d3.sum(ps, x => x.q * M.daily(x.f)) || M.daily(c) : M.daily(c);
    const src = s.source || (M.info.get(c) || {}).source || 'Vendor', T = M.T;
    let nx = null, how = '';
    if (src === 'In-house') {
      if (M.futP.get(c)) { nx = M.futP.get(c); how = 'next planned production'; }
      else if (M.lastA.get(c) && wdBetween(M.lastA.get(c), T) <= 10) { nx = addWd(T, 1); how = 'in production (est.)'; }
    } else {
      const ds = [...(M.rc.get(c) || [])].sort();
      if (ds.length) { const g = ds.length > 1 ? d3.median(d3.pairs(ds).map(([a, b]) => wdBetween(a, b))) : 6, last = ds[ds.length - 1];
        const due = addWd(last, Math.max(1, Math.round(g))); nx = due > T ? due : addWd(T, 1); how = `expected · ${ds.length} deliveries in 30 days`; }
    }
    const stock = Math.max(0, +s.stock || 0), days = need > 0 ? stock / need : Infinity, nxd = nx ? wdBetween(T, nx) : null;
    const gap = days < 30 && (nxd == null || nxd > days), lvl = gap ? 'bad' : days < 7 ? 'warn' : 'ok';
    return { c, part: s.part || (M.info.get(c) || {}).part || c, src, stock, vstock: +s.vendor_stock || 0, need, days, out: isFinite(days) ? addWd(T, Math.floor(days)) : null, nx, nxd, how, lvl, vendors: s.vendors || '' };
  };
  const COL = { bad: '#D0312D', warn: '#E0A100', ok: '#1E8C5A' };
  const build = (code, part) => {
    const M = model(), c = String(code || ''), set = new Set([c]);
    (M.kids.get(c) || []).forEach(k => set.add(k));
    let rows = [...set].map(k => item(M, k)).filter(Boolean);
    if (!rows.length) return null;
    rows.sort((a, b) => (a.c === c ? -1 : b.c === c ? 1 : 0) || ({ bad: 0, warn: 1, ok: 2 }[a.lvl] - { bad: 0, warn: 1, ok: 2 }[b.lvl]) || a.days - b.days);
    const more = rows.length > 12 ? rows.length - 12 : 0; rows = rows.slice(0, 12);
    const W = 580, L = 200, R = 120, H0 = 10, RH = 40, H = H0 + rows.length * RH + 24, X = v => L + Math.min(30, Math.max(0, v)) / 30 * (W - L - R);
    let g = `<line x1="${X(0)}" y1="4" x2="${X(0)}" y2="${H - 20}" stroke="#051C2C"/><text x="${X(0)}" y="${H - 6}" font-size="10.5" text-anchor="middle" fill="#051C2C">Today</text>`
      + [10, 20].map(v => `<line x1="${X(v)}" y1="4" x2="${X(v)}" y2="${H - 20}" stroke="#EEF1F4"/><text x="${X(v)}" y="${H - 6}" font-size="10" text-anchor="middle" fill="#9AA5B1">+${v}</text>`).join('')
      + `<text x="${X(30)}" y="${H - 6}" font-size="10" text-anchor="middle" fill="#5B6770">+30 wd</text>`;
    rows.forEach((r, i) => {
      const y = H0 + i * RH, by = y + 8, nm = r.part.length > 30 ? r.part.slice(0, 29) + '…' : r.part, col = COL[r.lvl];
      g += `<text x="0" y="${y + 14}" font-size="11.5" font-weight="${r.c === c ? 700 : 500}" fill="#051C2C">${esc(nm)}</text>`
        + `<text x="0" y="${y + 28}" font-size="10" fill="#5B6770">${r.src} · stock ${nf(r.stock)}${r.vstock ? ' (+' + nf(r.vstock) + ' at vendor)' : ''} · ${r.need > 0 ? nf(r.need) + '/day' : 'no plan'}</text>`
        + `<rect x="${X(0)}" y="${by}" width="${Math.max(2, X(r.days) - X(0))}" height="14" rx="2" fill="${col}"/>`;
      if (r.days > 30) g += `<text x="${X(30) + 3}" y="${by + 11}" font-size="11" fill="${col}">›</text>`;
      if (r.nxd != null) { const cx = X(r.nxd); if (r.lvl === 'bad' && r.nxd > r.days) g += `<line x1="${X(r.days)}" y1="${by + 7}" x2="${cx - 6}" y2="${by + 7}" stroke="#D0312D" stroke-dasharray="3 3"/>`;
        g += `<circle cx="${cx}" cy="${by + 7}" r="5.5" fill="#051C2C" stroke="#fff" stroke-width="1.5"/>`; }
      const rt = (r.need > 0 ? (r.days > 30 ? 'Lasts 30+ days' : 'Runs out ' + df(dt(r.out))) : 'No use planned') + '|' + (r.nx ? 'Next ' + df(dt(r.nx)) + (r.how.startsWith('expected') || r.how.includes('est') ? ' (est.)' : '') : r.src === 'In-house' ? 'No production planned' : 'No delivery in 30 days');
      const [t1, t2] = rt.split('|');
      g += `<text x="${W - R + 10}" y="${y + 14}" font-size="11" font-weight="600" fill="${col}">${esc(t1)}</text><text x="${W - R + 10}" y="${y + 28}" font-size="10" fill="#5B6770">${esc(t2)}</text>`;
    });
    const nBad = rows.filter(r => r.lvl === 'bad').length;
    return `<div class="hd">${esc(part || c)} <span>— Stock runway · run-out vs next delivery</span></div>`
      + (nBad ? `<div class="fl">${nBad > 1 ? nBad + ' items run' : '1 item runs'} out before the next delivery</div>` : '')
      + `<svg viewBox="-10 0 ${W + 10} ${H}" width="100%" height="${H}" style="margin-top:6px">${g}</svg>`
      + `<div class="ft">Bar: Atlas stock ÷ average daily need at this month's plan (working days, Sundays off). Dot: next delivery. In-house = next planned production day in Atlas; vendor = expected from the last 30 days' receipts (Atlas has no booked delivery dates).${more ? ` ${more} more components not shown.` : ''}</div>`;
  };
  let cur = null;
  window.__rw = (ev, o) => {
    const key = o && o.code; if (!key) return false;
    if (cur !== key) { const h = build(key, o.part); if (!h) { cur = null; pop.style.display = 'none'; return false; } pop.innerHTML = h; cur = key; }
    pop.style.display = 'block';
    const pw = pop.offsetWidth, ph = pop.offsetHeight; let x = ev.clientX + 14; if (x + pw > innerWidth - 8) x = Math.max(8, ev.clientX - pw - 14);
    pop.style.left = x + 'px'; pop.style.top = Math.max(8, Math.min(ev.clientY + 12, innerHeight - ph - 8)) + 'px'; return true;
  };
  window.__rwH = () => { pop.style.display = 'none'; cur = null; };
  /* Part Compliance - Other Parts (29 Oct, Umair): the runway sits beside the vendor-receiving panel in the same row tooltip
     (#vpop, built by __vendHover). Rows with no vendor panel show the runway on its own. */
  window.__rwHTML = build;
  const orig = window.__vendHover;
  if (orig) window.__vendHover = tables => { orig(tables);
    const T = tables.find(t => t && t.id === 'tb-parts2'); if (!T || T.__rwh) return; T.__rwh = 1;
    T.addEventListener('mousemove', ev => { const tr = ev.target.closest('tbody tr'), vp = document.getElementById('vpop'); if (!tr || !tr.cells[1] || !vp) return;
      const code = tr.cells[0].textContent.trim(), shown = vp.style.display !== 'none' && vp.dataset.code === code;
      if (vp.dataset.rw !== code || (shown && !vp.querySelector('.rwpop'))) {
        const h = build(code, tr.cells[1].textContent.trim());
        if (!shown) { vp.replaceChildren(); vp.dataset.code = code; }
        else { const col = document.createElement('div'); col.style.cssText = 'display:flex;flex-direction:column;gap:8px'; col.append(...vp.children); vp.replaceChildren(col); }
        if (h) { const b = document.createElement('div'); b.className = 'rwpop'; b.style.cssText = 'position:static;display:block;flex:none'; b.innerHTML = h; vp.appendChild(b); }
        vp.dataset.rw = code; if (!vp.children.length) return; }
      if (!vp.children.length) return;
      vp.style.display = 'flex'; vp.style.flexDirection = 'row'; vp.style.alignItems = 'flex-start';
      const w = vp.offsetWidth, hgt = vp.offsetHeight; let x = ev.clientX + 16, y = ev.clientY + 12;
      if (x + w > innerWidth - 8) x = Math.max(8, ev.clientX - w - 16); if (y + hgt > innerHeight - 8) y = Math.max(8, innerHeight - hgt - 8);
      vp.style.left = x + 'px'; vp.style.top = y + 'px'; });
    T.addEventListener('mouseleave', () => { const vp = document.getElementById('vpop'); if (vp) { vp.style.display = 'none'; vp.style.flexDirection = vp.style.alignItems = ''; vp.dataset.rw = ''; vp.dataset.code = ''; vp.replaceChildren(); } });
  };
})();

/* Production tab (29 Oct, Umair): Daily Production (with its KPI) shows only when a shop is picked, by clicking its bar in
   Plan vs Actual - By Shop or in the Shop filter. It then sits under By Shop (which shows just that shop), with By Model / By Part
   on the right of both. With all shops it is hidden. */
(() => {
  const css = document.createElement('style');
  css.textContent = `#production .grid > #c-p-daily{display:none}
#production.shf .grid > #c-p-daily{display:block}
#production.shf #c-p-shop .legend{display:none} #production.shf #c-p-shop .chart{min-height:0} /* same legend as the chart on the right */
@media (min-width: 960px){#production.shf .grid{grid-template-rows:auto 1fr}
#production.shf .grid > #c-p-shop{grid-column:1;grid-row:1;align-self:start}
#production.shf .grid > #c-p-daily{grid-column:1;grid-row:2}
#production.shf .grid > #c-p-model{grid-column:2;grid-row:1 / span 2}}`;
  document.head.appendChild(css);
  const d0 = window.__draw; if (!d0) return;
  window.__draw = (...a) => { const pg = document.getElementById('production'); let s = 'All'; try { s = window.__P().shop; } catch (e) {}
    if (pg) pg.classList.toggle('shf', !!s && s !== 'All'); return d0(...a); };
})();
