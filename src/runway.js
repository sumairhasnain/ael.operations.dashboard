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
  /* 31 Oct (Umair): a casting used only for one in-house machined part is covered against that part's machining plan,
     not the finished-goods plan. */
  const USEFOR = { '6503800001': '6510213002' };
  const item = (M, c) => {
    const s = M.stock.get(c); if (!s) return null;
    const ps = M.par.get(c), need = USEFOR[c] ? M.daily(USEFOR[c]) : ps && ps.length ? d3.sum(ps, x => x.q * M.daily(x.f)) || M.daily(c) : M.daily(c);
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
    return { c, part: s.part || (M.info.get(c) || {}).part || c, src, stock, vstock: +s.vendor_stock || 0, need, days, note: USEFOR[c] ? `Need is the ${USEFOR[c]} machining plan in Atlas (${nf(need)} a day), the only part this casting is used for.` : '', out: isFinite(days) ? addWd(T, Math.floor(days)) : null, nx, nxd, how, lvl, vendors: s.vendors || '' };
  };
  /* 31 Oct (Umair): alternate codes of one part share one stock pool. Hovering any of them shows a single bar on the
     combined closing stock of all the codes, against the one daily need; the vendor panel beside it is unchanged. */
  const ALTG = [{ name: 'Drive Plate CD70 · all codes', codes: ['6510213002', '6510213011', '6510213012', '6010213013'] }];
  const grpItem = (M, c) => { const G = ALTG.find(g => g.codes.includes(c)); if (!G) return null;
    const its = G.codes.map(k => item(M, k)).filter(Boolean); if (!its.length) return null;
    const stock = d3.sum(its, r => r.stock), vstock = d3.sum(its, r => r.vstock), need = d3.max(its, r => r.need) || 0, T = M.T;
    const nx = its.map(r => r.nx).filter(Boolean).sort()[0] || null, how = nx ? (its.find(r => r.nx === nx) || {}).how || '' : '';
    const days = need > 0 ? stock / need : Infinity, nxd = nx ? wdBetween(T, nx) : null, gap = days < 30 && (nxd == null || nxd > days);
    return { c, part: G.name, src: its.every(r => r.src === its[0].src) ? its[0].src : 'In-house + vendor', stock, vstock, need, days, out: isFinite(days) ? addWd(T, Math.floor(days)) : null, nx, nxd, how, lvl: gap ? 'bad' : days < 7 ? 'warn' : 'ok',
      note: 'Combined stock: ' + its.map(r => r.c + ' ' + nf(r.stock)).join(' + ') + ' = ' + nf(stock) + '.' };
  };
  const COL = { bad: '#D0312D', warn: '#E0A100', ok: '#1E8C5A' };
  const build = (code, part) => {
    const M = model(), c = String(code || ''), set = new Set([c]);
    (M.kids.get(c) || []).forEach(k => set.add(k));
    let rows = [...set].map(k => (k === c && grpItem(M, k)) || item(M, k)).filter(Boolean);
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
      + `<div class="ft">${rows[0] && rows[0].note ? esc(rows[0].note) + ' ' : ''}Bar: Atlas stock ÷ average daily need at this month's plan (working days, Sundays off). Dot: next delivery. In-house = next planned production day in Atlas; vendor = expected from the last 30 days' receipts (Atlas has no booked delivery dates).${more ? ` ${more} more components not shown.` : ''}</div>`;
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
   Plan vs Actual - By Shop or in the Shop filter. It then runs the full width under By Shop (which shows just that shop) and By Model / By Part. With all shops it is hidden. */
(() => {
  const css = document.createElement('style');
  css.textContent = `#production .grid > #c-p-daily{display:none}
#production.shf .grid > #c-p-daily{display:block}
#production.shf #c-p-shop .chart{min-height:0}
#production.shf #c-p-shop{display:flex;flex-direction:column;padding-bottom:4px} #c-p-shop > .kwrap{margin-top:auto;padding-top:12px;justify-content:flex-start} #c-p-shop > .kwrap .ksel{justify-content:flex-start;padding-top:17px} /* KPI card at the bottom edge; shop name level with the day's quantity */
#production.shf #c-p-daily .chart{min-height:0} #production.shf #c-p-daily h3{margin-bottom:0}
#c-p-model .legend{display:none} /* By Model / By Part: same legend as By Shop on the left */`;
  document.head.appendChild(css);
  const d0 = window.__draw; if (!d0) return;
  window.__draw = (...a) => { const pg = document.getElementById('production'); let s = 'All'; try { s = window.__P().shop; } catch (e) {}
    const on = !!s && s !== 'All'; if (pg) pg.classList.toggle('shf', on);
    /* the shop / last-day KPI card sits at the bottom left of By Shop while a shop is picked; back in Daily Production otherwise */
    const kw = document.querySelector('#c-p-daily .kwrap, #c-p-shop > .kwrap'), sh = document.getElementById('c-p-shop'), hd = document.querySelector('#c-p-daily .chd');
    if (kw && sh && hd) { if (on && kw.parentElement !== sh) sh.appendChild(kw); else if (!on && kw.parentElement !== hd) hd.appendChild(kw); }
    return d0(...a); };
})();

/* Part Compliance - Other Parts (31 Oct, Umair): vendor-supplied alternate codes are not Atlas production parts, so the table
   never listed them. Each one now shows directly under the in-house code it replaces: Month plan / Plan MTD = vendor schedule,
   Produced = received from vendors (atlas_vendor_supply), stock and safety level from SAP. Add more pairs to ALT as needed. */
(() => {
  const ALT = { '6010213013': { of: '6510213011', part: 'DRIVE PLATE CD70 SEMI MACH (VEN)', shop: 'Clutch', models: 'CD70' } };
  const AK = window.AK, d0 = window.__draw; if (!AK || !d0) return;
  const nf = AK.nf, C = AK.C;
  const add = () => { const T = document.getElementById('tb-parts2'); if (!T || !T.tBodies[0]) return; const tb = T.tBodies[0];
    let p; try { p = window.__P(); } catch (e) { return; }
    const VS = dash.data('atlas_vendor_supply'), PS = dash.data('atlas_part_stock'); if (!VS || VS.status !== 'ok') return;
    const q = ((document.getElementById('q-parts2') || {}).value || '').toLowerCase();
    tb.querySelectorAll('tr.altv').forEach(r => r.remove());
    Object.entries(ALT).forEach(([code, a]) => {
      if (p.shop && p.shop !== 'All' && p.shop !== a.shop) return; if (p.model && p.model !== 'All' && !a.models.split(/[\/,]\s*/).includes(p.model)) return;
      if (q && ![code, a.part, a.shop, a.models].join(' ').toLowerCase().includes(q)) return;
      let pt = 0, pp = 0, pa = 0; (VS.data || []).forEach(r => { if (String(r.code) !== code || r.date < p.start || r.date > p.end) return; pt += +r.scheduled || 0; if (r.date <= p.asof) { pp += +r.scheduled || 0; pa += +r.received || 0; } });
      const st = PS && PS.status === 'ok' ? (PS.data || []).find(r => String(r.code) === code) : null, stk = st && st.stock != null ? +st.stock : null, ss = st && +st.safety > 0 ? +st.safety : null;
      const pc = pp ? Math.round(pa / pp * 100) : null;
      const tr = document.createElement('tr'); tr.className = 'altv'; tr.style.background = '#FAFBFC';
      const cells = [code, a.part, a.shop, a.models, ss, stk, pt || null, pp || null, pa, pc, null, null, null];
      cells.forEach((v, i) => { const td = document.createElement('td'); if (i >= 4) td.className = 'n';
        td.textContent = v == null ? '—' : i === 9 ? v + '%' : i >= 4 ? nf(v) : v;
        if (i === 1) td.title = `Vendor-supplied alternate of ${a.of}. Plan = vendor schedule, Produced = received from vendors.`;
        if (i === 5 && stk != null && ss && stk < ss) { td.style.color = C.bad; td.style.fontWeight = 600; }
        if (i === 9 && pc != null && pc < 95) { td.style.color = pc < 80 ? C.bad : C.warn; td.style.fontWeight = 600; }
        if (i === 8) td.title = 'Received from vendors this month to date';
        tr.appendChild(td); });
      const anchor = [...tb.rows].find(r => r.cells[0] && r.cells[0].textContent.trim() === a.of);
      if (anchor) anchor.after(tr); else tb.appendChild(tr); });
  };
  window.__draw = (...a) => { const r = d0(...a); try { add(); } catch (e) { console.warn('altv', e); } return r; };
  const qi = document.getElementById('q-parts2'); if (qi) qi.addEventListener('input', () => setTimeout(add, 0));
})();

/* Product tab, Product Compliance (31 Oct, Umair): each product is tagged by the trend of its monthly production compliance
   over its last three months with a plan (least-squares slope; MTD counts as the latest month): Declining (falling 5+ points
   a month), Improving (rising 5+ points a month), Stable (in between, or fewer than two months). The buttons at the top right
   filter the chart; several can be on together, none on = all products. */
(() => {
  const AK = window.AK, d0 = window.__draw; if (!AK || !d0) return;
  const CAT = [{ k: 'dec', t: 'Declining', c: '#B02622', b: 'Compliance falling by 5+ points a month over the last three months' }, { k: 'sta', t: 'Stable', c: '#5A6670', b: 'Compliance within ±5 points a month over the last three months' }, { k: 'imp', t: 'Improving', c: '#1E8C5A', b: 'Compliance rising by 5+ points a month over the last three months' }];
  const on = new Set(), TH = 0.05;
  const css = document.createElement('style'); css.textContent = '#c-pr-matrix{position:relative}#pr-trend{position:absolute;top:12px;right:16px;display:flex;gap:4px}#pr-trend button{font-size:12px;padding:5px 12px;display:inline-flex;align-items:center;gap:6px}#pr-trend i{display:inline-block;width:8px;height:8px;border-radius:50%}#pr-trend b{font-weight:600}';
  document.head.appendChild(css);
  const mon = s => d3.utcFormat('%b')(new Date(s.slice(0, 7) + '-01T00:00:00Z'));
  const run = () => {
    if (window.__page !== 'product' || !window.__pa || !window.__dims) return;
    const card = document.getElementById('c-pr-matrix'), el = card && card.querySelector('.chart'); if (!el) return;
    if (['atlas_parts_daily', 'atlas_parts'].some(id => (dash.data(id) || {}).status !== 'ok')) return;
    let bar = document.getElementById('pr-trend');
    if (!bar) { bar = document.createElement('span'); bar.id = 'pr-trend'; bar.className = 'crmt'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Compliance trend');
      CAT.forEach(c => { const b = document.createElement('button'); b.type = 'button'; b.dataset.k = c.k; b.title = c.b; b.innerHTML = `<i style="background:${c.c}"></i>${c.t} <b></b>`;
        b.addEventListener('click', () => { on.has(c.k) ? on.delete(c.k) : on.add(c.k); window.__draw(); }); bar.appendChild(b); });
      card.appendChild(bar); }
    const p = window.__P(), T = window.__TODAY, cm = T.slice(0, 7), months = window.__MONTHS.filter(m => m <= cm);
    const byM = new Map(months.map(m => [m, new Map(window.__pa(p, m + '-01', m === cm ? T : window.__mEnd(m), 'Finished').map(r => [r.code, r]))]));
    const dims = window.__dims(), codes = [...new Set([...byM.values()].flatMap(mm => [...mm.values()].filter(r => r.pp > 0).map(r => r.code)))].filter(c => dims.get(c));
    const tot = c => d3.sum(months, m => (byM.get(m).get(c) || {}).pp || 0);
    codes.sort((a, b) => dims.get(a).shop.localeCompare(dims.get(b).shop) || tot(b) - tot(a));
    const val = (c, m) => { const r = byM.get(m).get(c); return r && r.pp ? r.pa / r.pp : null; };
    const cls = new Map(codes.map(c => { const pts = months.map((m, i) => [i, val(c, m)]).filter(d => d[1] != null).slice(-3);
      if (pts.length < 2) return [c, 'sta']; const mx = d3.mean(pts, d => d[0]), my = d3.mean(pts, d => d[1]);
      const sl = d3.sum(pts, d => (d[0] - mx) * (d[1] - my)) / (d3.sum(pts, d => (d[0] - mx) ** 2) || 1);
      return [c, sl <= -TH ? 'dec' : sl >= TH ? 'imp' : 'sta']; }));
    bar.querySelectorAll('button').forEach(b => { const k = b.dataset.k, n = codes.filter(c => cls.get(c) === k).length; b.querySelector('b').textContent = n; const a = on.has(k); b.classList.toggle('on', a); b.setAttribute('aria-pressed', String(a)); });
    if (!on.size) return;
    const rows = codes.filter(c => on.has(cls.get(c)));
    AK.heat(el, rows, months, val, { xFmt: m => mon(m) + (m === cm ? ' (MTD)' : ''), yFmt: c => dims.get(c).part, name: 'Production vs plan', dom: [0.6, 0.85, 0.97, 1.1], dark: 1.0, onRow: c => dash.setParams({ product: c }) });
  };
  window.__draw = (...a) => { const r = d0(...a); try { run(); } catch (e) { console.warn('prtrend', e); } return r; };
})();
