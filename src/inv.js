/* Inventory tab, SAP part: stock on hand (MB52), receipts into stock (101/102) and shop issues (201/202).
   Datasets sap_stock, sap_flow, sap_cc, sap_rcv_sup. Reads the shared kit (window.AK) and the dashboard's Shop / Model / Month filters;
   its own filters are dash params invoff (categories switched off by the toggle buttons, '|'-joined) and invage (age bucket). */
(() => {
  const AK = window.AK; if (!AK) return;
  const { C, tip, table, vbar, pvaH, hrank, empty, box } = AK;
  const q = s => document.querySelector(s);
  const P = () => dash.params() || {};
  const set = o => dash.setParams(o);
  const fM = v => { const a = Math.abs(v || 0); return a >= 1e9 ? d3.format(',.2f')(v / 1e9) + ' bn' : a >= 1e6 ? d3.format(',.1f')(v / 1e6) + ' M' : a >= 1e3 ? d3.format(',.0f')(v / 1e3) + ' k' : d3.format(',.0f')(v || 0); };
  const fRs = v => 'Rs ' + fM(v);
  const nf = d3.format(','), n2 = d3.format(',.2~f');
  const mon = s => { const [y, m] = String(s).split('-'); return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1] + '-' + y.slice(2); };
  const dmy = s => s ? `${+s.slice(8)} ${mon(s.slice(0, 7)).slice(0, 3)} ${s.slice(2, 4)}` : '—';
  const CATS = ['Consumables', 'Tools', 'Spares', 'Lubricants', 'Production parts'];
  const CATC = { Consumables: '#051C2C', Tools: '#2251FF', Spares: '#00A9F4', Lubricants: '#1F9E89', 'Production parts': '#B9C1C9' };
  const CATB = { Consumables: 'Material codes starting 10.. and 15.. (includes ingots, resin and other raw material), lubricants left out', Tools: 'Material codes starting 20.., lubricants left out', Spares: 'Material codes starting 25..', Lubricants: 'Engine, gear, hydraulic, cutting and industrial oils and greases, whatever the code', 'Production parts': 'Other codes (30.., 50.., 60.., 65.., 90.., 91..): child, in-house and finished parts' };
  const STG = ['Imported parts', 'Vendor parts', 'Outsourced', 'In-house WIP', 'Finished', 'Raw material', 'Shop spares & consumables', ''];
  const STC = { 'Imported parts': '#051C2C', 'Vendor parts': '#2251FF', Outsourced: '#7B61FF', 'In-house WIP': '#00A9F4', Finished: '#1F9E89', 'Raw material': '#E0A100', 'Shop spares & consumables': '#AAE6F0', '': '#C9D1D9' };
  const STN = s => s || 'Other';
  const AGES = ['0–90 days', '91–180 days', '181–365 days', 'Over 1 year', 'Not received since Jan 2024'];
  const AGEC = { '0–90 days': '#051C2C', '91–180 days': '#2251FF', '181–365 days': '#E0A100', 'Over 1 year': '#D0312D', 'Not received since Jan 2024': '#8B1E1B' };
  const SH = { 'Carb Child Parts': 'Carburetor' };   // the SAP groups do not split Carburetor from its child parts
  const shopOk = (sh, g) => g.shop === 'All' || sh === g.shop || SH[sh] === g.shop || SH[g.shop] === sh;

  if (!q('#inv-css')) { const st = document.createElement('style'); st.id = 'inv-css'; st.textContent = `
.ael #inventory .ivhead{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;margin:0 0 10px}
.ael #inventory .ivhead h2{font-family:var(--font-anthropic-serif);font-weight:400;font-size:24px;color:var(--navy);margin:0}
.ael #inventory .ivhead span{font-size:12px;color:var(--mut)}
.ael #inventory .ivbar{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:flex-end;padding:10px 14px;background:#fff;border:1px solid var(--line);border-top:3px solid var(--navy);margin-bottom:14px}
.ael #inventory .ivbar label{display:flex;flex-direction:column;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);gap:3px}
.ael #inventory .ivbar select{font:inherit;font-size:12.5px;padding:5px 8px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);min-width:150px}
.ael #inventory .ivbar select.fon{background:#FFE8A3;border-color:#E0A100;color:#000;font-weight:600}
.ael #inventory .ivbar .nt{font-size:11.5px;color:var(--mut);margin-left:auto;max-width:520px;line-height:1.35}
.ael #inventory .ivk{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:10px;margin-bottom:14px}
.ael #inventory .ivk div{background:#fff;border:1px solid var(--line);border-left:3px solid var(--navy);padding:10px 12px;cursor:default}
.ael #inventory .ivk span{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
.ael #inventory .ivk b{display:block;font-family:var(--font-anthropic-serif);font-weight:400;font-size:24px;color:var(--navy);margin:2px 0}
.ael #inventory .ivk em{font-style:normal;font-size:11.5px;color:var(--mut)}
.ael #inventory .ivdon{display:grid;grid-template-columns:minmax(130px,170px) minmax(0,1fr);gap:12px;align-items:center}
@media (max-width:620px){.ael #inventory .ivdon{grid-template-columns:1fr}}
.ael #inventory .ivleg{display:flex;flex-direction:column;gap:2px;font-size:12px}
.ael #inventory .ivleg div{display:grid;grid-template-columns:10px minmax(0,1fr) auto 34px;gap:7px;align-items:center;padding:4px 6px;border-radius:3px;cursor:pointer}
.ael #inventory .ivleg div:hover{background:var(--soft)} .ael #inventory .ivleg div.sel{background:#EEF4FF;font-weight:600} .ael #inventory .ivleg div.dim{opacity:.4}
.ael #inventory .ivleg i{width:10px;height:10px;border-radius:2px;display:block}
.ael #inventory .ivleg b{font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap} .ael #inventory .ivleg em{font-style:normal;color:var(--mut);text-align:right;font-variant-numeric:tabular-nums}
.ael #inventory .ivsub{font-size:11.5px;color:var(--mut);margin:-4px 0 8px}
.ael #inventory .ivcat{display:inline-block;padding:1px 7px;border-radius:9px;font-size:11px;font-weight:600;color:#fff;white-space:nowrap}
.ael #inventory .ivh{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:6px 10px}.ael #inventory .ivh h3{margin-bottom:6px}
.ael #inventory .ivtog{display:flex;flex-wrap:wrap;gap:5px;justify-content:flex-end}
.ael #inventory .ivtog button{font:inherit;font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:4px;cursor:pointer;border:1px solid var(--c);background:var(--c);color:#fff;transition:background .12s,color .12s}
.ael #inventory .ivtog button.off{background:#fff;color:var(--c);opacity:.55;font-weight:500}
.ael #inventory .ivtog button:hover{opacity:1}
.ael #inventory table.tb td.n{text-align:right;font-variant-numeric:tabular-nums}
.ael #inventory .ivsep{grid-column:1/-1;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);font-weight:600;border-bottom:1px solid var(--line);padding:8px 0 4px;margin-top:4px}
`; document.head.appendChild(st); }

  { const host = q('#inv-sap'); if (host && !q('#iv-bar')) host.innerHTML = `
<div class="ivhead"><h2>Inventory in SAP</h2><span id="iv-asof"></span></div>
<div class="ivbar" id="iv-bar"><label>Age since last receipt<select id="iv-f-age" aria-label="Stock age"></select></label><div class="nt" id="iv-note"></div></div>
<div class="ivk" id="iv-kpi"></div>
<div class="grid">
<div class="card" id="c-iv-cat"><div class="ivh"><h3>Stock Value by Category</h3><div class="ivtog" id="iv-tog" role="group" aria-label="Categories shown on this tab"></div></div><div class="ivdon"><div class="chart" id="iv-d-cat"></div><div class="ivleg" id="iv-l-cat"></div></div></div>
<div class="card" id="c-iv-shop"><h3>Stock Value by Shop &amp; Stage</h3><div class="ivsub">Click a shop to filter the whole dashboard</div><div class="chart" id="iv-shop"></div></div>
<div class="card" id="c-iv-rcv"><h3>Received into Stock by Month</h3><div class="ivsub">Purchase receipts from suppliers and production put into stock (SAP 101 less 102)</div><div class="chart" id="iv-rcv"></div></div>
<div class="card" id="c-iv-cons"><h3>Shop Consumption by Month</h3><div class="ivsub">Issues to cost centres (SAP 201 less 202 returns), raw material excluded</div><div class="chart" id="iv-cons"></div></div>
<div class="card" id="c-iv-cc"><h3>Consumption by Cost Centre</h3><div class="ivsub" id="iv-cc-sub"></div><div class="chart" id="iv-cc"></div></div>
<div class="card" id="c-iv-sup"><h3>Top Suppliers Received</h3><div class="ivsub" id="iv-sup-sub"></div><div class="chart" id="iv-sup"></div></div>
<div class="card" id="c-iv-age"><h3>Stock Age since Last Receipt</h3><div class="ivsub">Value on hand, by days since the material was last received. Click a bar to filter</div><div class="chart" id="iv-age"></div></div>
<div class="card" id="c-iv-slow"><h3>Largest Aged Stock (over 180 days)</h3><div class="ivsub">No receipt in the last 180 days, by value on hand</div><div class="chart" id="iv-slow"></div></div>
<div class="card wide" id="c-iv-reg"><h3>Stock Register</h3><input class="q" id="q-iv" placeholder="Search material, code, group or location" aria-label="Search stock"><div class="tbox"><table class="tb" id="tb-iv"><thead><tr><th data-k="code">Code</th><th data-k="part">Material</th><th data-k="shop">Shop</th><th data-k="category">Category</th><th data-k="stage">Stage</th><th data-k="stock" class="n">Stock</th><th data-k="uom">UoM</th><th data-k="value_pkr" class="n">Value (Rs)</th><th data-k="qi" class="n">QI / Blocked</th><th data-k="last_rcv">Last received</th><th data-k="last_issue">Last issued</th><th data-k="issue_90d" class="n">Issued 90 d</th><th data-k="cover_days" class="n">Cover (days)</th><th data-k="slocs">Store loc.</th></tr></thead><tbody></tbody></table></div></div>
<div class="ivsep">Atlas: safety stock and vendor supply</div>
</div>`;
    const qi = q('#q-iv'); if (qi) qi.addEventListener('input', () => window.__draw());
    const clr = document.getElementById('f-clear'); if (clr) clr.addEventListener('click', () => set({ invage: 0 }));   /* the category toggles are left as they are: only a click on a button changes them */ }

  const rows = id => { const d = dash.data(id); return d && d.status === 'ok' ? d.data : null; };
  const num = (r, ks) => { ks.forEach(k => { if (r[k] != null && r[k] !== '') r[k] = +r[k]; else r[k] = null; }); return r; };
  let _c = {};
  const load = () => { const s = rows('sap_stock'), f = rows('sap_flow'), c = rows('sap_cc'), u = rows('sap_rcv_sup');
    if (_c.s === s && _c.f === f && _c.c === c && _c.u === u) return _c;
    _c = { s, f, c, u,
      S: s ? s.map(r => num({ ...r }, ['stock', 'qi', 'blocked', 'transit', 'value_pkr', 'unit_pkr', 'rcv_90d', 'issue_90d', 'cover_days', 'age_days'])) : null,
      F: f ? f.map(r => num({ ...r }, ['value_pkr', 'lines'])) : null, CC: c ? c.map(r => num({ ...r }, ['value_pkr', 'lines'])) : null, U: u ? u.map(r => num({ ...r }, ['value_pkr', 'lines'])) : null };
    return _c; };

  function selBox(id, all, opts, key, counts) { const el = q('#' + id); if (!el) return; const cur = P()[key] || '';
    el.replaceChildren(new Option(all, '')); opts.forEach(o => el.appendChild(new Option(counts ? `${o} (${counts(o)})` : o, o))); el.value = opts.includes(cur) ? cur : '';
    el.classList.toggle('fon', !!el.value); el.onchange = () => set({ [key]: el.value || 0 }); }

  function legendDonut(dEl, lEl, items, togg, center) {   // slices of switched-off categories are left out; their legend rows stay, faded, to switch them back on
    const shown = items.filter(x => !x.off), tot = d3.sum(shown, x => x.value);
    lEl.replaceChildren(); items.forEach(x => { const d = document.createElement('div'); if (x.off) d.className = 'dim';
      const i = document.createElement('i'); i.style.background = x.color; const s = document.createElement('span'); s.textContent = x.label; const b = document.createElement('b'); b.textContent = fM(x.value); const e = document.createElement('em'); e.textContent = x.off || !tot ? '—' : d3.format('.0%')(x.value / tot);
      d.append(i, s, b, e); d.title = (x.off ? 'Left out. Click to include. ' : 'Click to leave out. ') + (x.brief || ''); d.addEventListener('click', () => togg(x.label)); lEl.appendChild(d); });
    if (!shown.length || !tot) { empty(dEl, 'All categories are switched off'); return; }
    const h = 170, { svg, w } = box(dEl, h), r = Math.min(h / 2 - 6, w / 2 - 6), g = svg.append('g').attr('transform', `translate(${w / 2},${h / 2})`);
    g.selectAll('path').data(d3.pie().value(d => Math.max(0, d.value)).sort(null)(shown)).join('path').attr('d', d3.arc().innerRadius(r * .6).outerRadius(r)).attr('fill', d => d.data.color)
      .attr('stroke', '#fff').style('cursor', 'pointer')
      .on('mousemove', (ev, d) => tip.show(ev, [d.data.label, fRs(d.data.value) + ' · ' + d3.format('.0%')(d.data.value / tot), d.data.n + ' materials', d.data.brief || '', 'Click to leave this category out'].filter(Boolean)))
      .on('mouseleave', tip.hide).on('click', (ev, d) => { tip.hide(); togg(d.data.label); });
    g.append('text').attr('text-anchor', 'middle').attr('y', 2).style('font-family', 'var(--font-anthropic-serif)').style('font-size', '18px').style('fill', C.navy).text(fM(tot));
    g.append('text').attr('text-anchor', 'middle').attr('y', 18).attr('font-size', 10).style('fill', '#5A6670').text(center); }

  function stackH(el, cats, keys, get, o) {   // horizontal stacked bars: cats on rows, keys as segments
    if (!cats.length) return empty(el, o.emptyMsg || 'No data for this selection');
    const rh = 26, h = cats.length * rh + 34, { svg, w } = box(el, h);
    const t = svg.append('text').attr('font-size', 11.5).text(d3.max(cats, c => c) || ''); const lw = Math.min(w * .34, d3.max(cats, c => { t.text(c); return t.node().getComputedTextLength(); }) + 12); t.remove();
    const tot = c => d3.sum(keys, k => Math.max(0, get(c, k) || 0)), x = d3.scaleLinear([0, d3.max(cats, tot) * 1.12 || 1], [lw, w - 8]);
    cats.forEach((c, i) => { const y0 = 4 + i * rh; let acc = 0; const g = svg.append('g').style('cursor', o.onClick ? 'pointer' : 'default');
      g.append('text').attr('x', 0).attr('y', y0 + rh / 2 + 4).attr('font-size', 11.5).style('fill', C.navy).style('font-weight', o.bold && o.bold(c) ? 700 : 500).text(c);
      keys.forEach(k => { const v = Math.max(0, get(c, k) || 0); if (!v) return; g.append('rect').attr('x', x(acc)).attr('y', y0 + 4).attr('width', Math.max(.5, x(acc + v) - x(acc))).attr('height', rh - 8).attr('fill', o.color(k))
        .on('mousemove', ev => tip.show(ev, [c, `${o.name(k)}: ${fRs(v)}`, `Shop total: ${fRs(tot(c))}`])).on('mouseleave', tip.hide); acc += v; });
      g.append('text').attr('x', x(acc) + 5).attr('y', y0 + rh / 2 + 4).attr('font-size', 11).style('fill', C.navy).style('font-weight', 600).text(fM(acc));
      if (o.onClick) g.on('click', () => o.onClick(c)); });
    const lg = document.createElement('div'); lg.className = 'legend'; keys.forEach(k => { if (!cats.some(c => get(c, k))) return; const s = document.createElement('span'), i = document.createElement('i'); i.style.background = o.color(k); s.append(i, document.createTextNode(o.name(k))); lg.appendChild(s); }); el.appendChild(lg); }

  window.__inv = g => {
    const host = q('#inv-sap'); if (!host) return;
    const st = ['sap_stock', 'sap_flow', 'sap_cc', 'sap_rcv_sup'].map(id => dash.data(id).status);
    if (st.includes('error')) { const k = q('#iv-kpi'); if (k) { k.replaceChildren(); const d = document.createElement('div'); d.textContent = '● SAP inventory data failed to load'; k.appendChild(d); } return; }
    const D = load(); if (!D.S || !D.F || !D.CC || !D.U) return;
    const p = P(), off = String(p.invoff || '').split('|').filter(c => CATS.includes(c)), on = c => !off.includes(c), age = AGES.includes(p.invage) ? p.invage : '';
    const togg = c => { const now = String(P().invoff || '').split('|').filter(x => CATS.includes(x)), o = now.includes(c) ? now.filter(x => x !== c) : [...now, c]; set({ invoff: o.length ? o.join('|') : 0 }); };
    { const tg = q('#iv-tog'); tg.replaceChildren(); CATS.forEach(c => { const b = document.createElement('button'); b.type = 'button'; b.textContent = c; b.style.setProperty('--c', CATC[c]); b.className = on(c) ? '' : 'off';
      b.setAttribute('aria-pressed', on(c)); b.title = (on(c) ? 'Included. Click to leave ' : 'Left out. Click to include ') + c + ' across this tab'; b.addEventListener('click', () => togg(c)); tg.appendChild(b); }); }
    const mOk = r => g.model === 'All' || String(r.models || '').split('/').includes(g.model);
    const base = D.S.filter(r => shopOk(r.shop, g) && mOk(r));
    const pass = (r, skip) => (skip === 'cat' || on(r.category)) && (skip === 'age' || !age || r.age_bucket === age);
    const S = base.filter(r => pass(r));
    const stockAsOf = (D.S.find(r => r.asof) || {}).asof || '', flowTo = (D.F.find(r => r.asof) || {}).asof || '';
    const months = [...new Set(D.F.map(r => r.month))].sort(), M = months.includes(g.month) ? g.month : months[months.length - 1];
    const prev3 = months.filter(m => m < M).slice(-3), part = M === flowTo.slice(0, 7);
    q('#iv-asof').textContent = `Stock: SAP MB52, ${dmy(stockAsOf)} · Receipts and issues to ${dmy(flowTo)}` + (g.model !== 'All' ? ` · Model ${g.model} matched on the material description` : '');
    q('#iv-note').textContent = (g.shop !== 'All' ? `Shop ${g.shop}: materials linked to the shop through Atlas, their SAP group or a clear raw-material name. ` : '') + 'Consumption is SAP 201/202 to cost centres; production orders (261) are not in these files.';
    selBox('iv-f-age', 'All ages', AGES.filter(a => base.some(r => r.age_bucket === a && pass(r, 'age'))), 'invage');

    /* flows for the shop / category filters */
    const F = D.F.filter(r => shopOk(r.shop, g) && on(r.category));
    const fsum = (m, kind) => d3.sum(F.filter(r => r.month === m && r.kind === kind && true), r => r.value_pkr);
    const pace = part ? +flowTo.slice(8) / new Date(+M.slice(0, 4), +M.slice(5), 0).getDate() : 1;   // a part month is compared with the same share of the average month
    const avg3 = kind => prev3.length ? d3.mean(prev3, m => fsum(m, kind)) * pace : null;

    /* KPI tiles */
    const kp = q('#iv-kpi'); kp.replaceChildren();
    const tv = d3.sum(S, r => r.value_pkr), aged = d3.sum(S.filter(r => r.age_days == null || r.age_days > 180), r => r.value_pkr), qb = S.filter(r => r.qi > 0 || r.blocked > 0).length;
    const tile = (lbl, v, sub, color, tipL) => { const d = document.createElement('div'); if (color) d.style.borderLeftColor = color; const a = document.createElement('span'); a.textContent = lbl; const b = document.createElement('b'); b.textContent = v; const e = document.createElement('em'); e.textContent = sub; d.append(a, b, e);
      if (tipL) { d.addEventListener('mousemove', ev => tip.show(ev, tipL)); d.addEventListener('mouseleave', tip.hide); } kp.appendChild(d); };
    const vs = (v, a) => a ? ` · ${v >= a ? '+' : ''}${Math.round((v - a) / a * 100)}% vs 3-mo ${part ? 'pace' : 'avg'}` : '';
    const pr = fsum(M, 'Purchase'), pd = fsum(M, 'Production'), cs = fsum(M, 'Consumption');
    tile('Stock value', fRs(tv), `${nf(S.length)} materials on hand`, C.navy, ['Unrestricted stock value in SAP', fRs(tv), `${nf(S.length)} materials`, stockAsOf ? 'MB52 of ' + dmy(stockAsOf) : '']);
    tile('Quality / blocked', nf(qb), 'materials with stock in QI or blocked', qb ? C.warn : C.navy);
    tile('Received from suppliers', fRs(pr), mon(M) + (part ? ' to date' : '') + vs(pr, avg3('Purchase')), C.blue, ['Purchase receipts (101 less 102)', mon(M) + ': ' + fRs(pr), prev3.length ? 'Average of ' + prev3.map(mon).join(', ') + ': ' + fRs(avg3('Purchase')) : '']);
    tile('Production into stock', fRs(pd), mon(M) + (part ? ' to date' : '') + vs(pd, avg3('Production')), C.cyan, ['Goods receipts without a supplier: production put into stock', mon(M) + ': ' + fRs(pd)]);
    tile('Shop consumption', fRs(cs), mon(M) + (part ? ' to date' : '') + vs(cs, avg3('Consumption')), C.teal, ['Issues to cost centres (201 less 202), raw material left out', mon(M) + ': ' + fRs(cs), prev3.length ? (part ? '3-month average, same share of the month: ' : '3-month average: ') + fRs(avg3('Consumption')) : '']);
    tile('Aged over 180 days', fRs(aged), tv ? d3.format('.0%')(aged / tv) + ' of stock value' : '', aged / (tv || 1) > .15 ? C.bad : C.warn, ['No receipt in the last 180 days (or none since Jan 2024)', fRs(aged)]);

    /* category donut */
    const Sc = base.filter(r => pass(r, 'cat'));
    legendDonut(q('#iv-d-cat'), q('#iv-l-cat'), CATS.map(c => { const rs = Sc.filter(r => r.category === c); return { label: c, value: d3.sum(rs, r => r.value_pkr), n: rs.length, color: CATC[c], brief: CATB[c], off: !on(c) }; }).filter(x => x.value > 0), togg, off.length ? 'stock shown' : 'stock value');
    

    /* by shop and stage */
    const isShop = r => r.shop && r.shop !== '—' && r.shop !== 'Other';
    const gs = d3.rollup(S.filter(isShop), v => d3.rollup(v, w => d3.sum(w, r => r.value_pkr), r => r.stage), r => r.shop);
    const shops = [...gs.keys()].sort((a, b) => d3.sum(gs.get(b).values()) - d3.sum(gs.get(a).values()));
    const un = d3.sum(S.filter(r => !isShop(r)), r => r.value_pkr);
    stackH(q('#iv-shop'), shops, STG, (c, k) => (gs.get(c) || new Map()).get(k) || 0, { color: k => STC[k], name: STN, bold: c => g.shop === c,
      onClick: c => set(g.shop === c ? { shop: 'All', sf: 0, pf: 0 } : { shop: c, sf: 1, pf: 0 }), emptyMsg: 'No shop stock for this selection' });
    if (un > 0 && g.shop === 'All') { const n = document.createElement('div'); n.className = 'ivsub'; n.style.marginTop = '6px'; n.textContent = `Plus ${fRs(un)} not tied to one shop (common raw material, lubricants, general stores).`; q('#iv-shop').appendChild(n); }

    /* receipts and consumption by month */
    const rk = [{ key: 'Purchase', name: 'From suppliers', color: C.navy }, { key: 'Production', name: 'From production', color: C.cyan }];
    vbar(q('#iv-rcv'), months, rk, (m, k) => Math.max(0, fsum(m, k)), { stack: 1, h: 250, xFmt: mon, yFmt: v => fM(v).replace(' ', ''), fmt: fRs, focus: M, onClick: m => set({ month: m }) });
    const ck = CATS.filter(c => F.some(r => r.kind === 'Consumption' && r.category === c));
    vbar(q('#iv-cons'), months, ck.map(c => ({ key: c, name: c, color: CATC[c] })), (m, c) => Math.max(0, d3.sum(F.filter(r => r.month === m && r.kind === 'Consumption' && r.category === c), r => r.value_pkr)), { stack: 1, h: 250, xFmt: mon, yFmt: v => fM(v).replace(' ', ''), fmt: fRs, focus: M, emptyMsg: 'No issues for this selection', onClick: m => set({ month: m }) });

    /* cost centres: month vs 3-month average */
    const CCm = D.CC.filter(r => shopOk(r.shop, g) && on(r.category));
    const ccs = d3.rollup(CCm, v => v[0].label, r => r.cc), ccv = (cc, m) => d3.sum(CCm.filter(r => r.cc === cc && r.month === m), r => r.value_pkr);
    const ccRows = [...ccs.keys()].map(cc => ({ label: ccs.get(cc), actual: ccv(cc, M), plan: prev3.length ? d3.mean(prev3, m => ccv(cc, m)) : 0 })).filter(r => r.actual > 0 || r.plan > 0)
      .sort((a, b) => b.actual - a.actual || b.plan - a.plan).slice(0, 12).map(r => ({ ...r, tip: [r.label, `${mon(M)}${part ? ' to date' : ''}: ${fRs(r.actual)}`, `3-month average: ${fRs(r.plan)}`] }));
    q('#iv-cc-sub').textContent = `${mon(M)}${part ? ' to date' : ''} against the average of ${prev3.map(mon).join(', ') || 'earlier months'}. Shop names on cost centres are read from what each one draws`;
    pvaH(q('#iv-cc'), ccRows, { inv: 1, planName: '3-month average', actName: mon(M), fmt: fRs, rh: 26, emptyMsg: 'No issues to cost centres for this selection' });

    /* suppliers */
    const U = D.U.filter(r => r.month === M && shopOk(r.shop, g) && on(r.category));
    const us = d3.rollups(U, v => ({ v: d3.sum(v, r => r.value_pkr), n: d3.sum(v, r => r.lines), name: v[0].name }), r => r.supplier).sort((a, b) => b[1].v - a[1].v).slice(0, 10);
    q('#iv-sup-sub').textContent = `Purchase receipts in ${mon(M)}${part ? ' to date' : ''}` + (g.shop !== 'All' ? ' for ' + g.shop + ' materials' : '') + (U.length ? '' : ' (supplier detail kept for the last 3 months)');
    hrank(q('#iv-sup'), us.map(([k, o]) => ({ label: o.name.length > 30 ? o.name.slice(0, 29) + '…' : o.name, sub: `${k} · ${nf(o.n)} receipt lines`, value: o.v, tip: [o.name, 'Supplier ' + k, fRs(o.v), nf(o.n) + ' receipt lines'] })), { fmt: fM, rh: 34, emptyMsg: 'No supplier receipts for this selection' });

    /* ageing */
    const Sa = base.filter(r => pass(r, 'age'));
    vbar(q('#iv-age'), AGES, CATS.filter(c => Sa.some(r => r.category === c)).map(c => ({ key: c, name: c, color: CATC[c] })), (a, c) => d3.sum(Sa.filter(r => r.age_bucket === a && r.category === c), r => r.value_pkr),
      { stack: 1, h: 250, rot: 1, yFmt: v => fM(v).replace(' ', ''), fmt: fRs, focus: age || null, onClick: a => set({ invage: age === a ? 0 : a }), emptyMsg: 'No stock for this selection' });
    const slow = S.filter(r => r.age_days == null || r.age_days > 180).sort((a, b) => b.value_pkr - a.value_pkr).slice(0, 10);
    hrank(q('#iv-slow'), slow.map(r => ({ label: (r.part || r.code).length > 34 ? (r.part || r.code).slice(0, 33) + '…' : (r.part || r.code), sub: `${r.code} · ${r.last_rcv ? 'last in ' + dmy(r.last_rcv) : 'no receipt since Jan 2024'}${r.shop ? ' · ' + r.shop : ''}`, value: r.value_pkr,
      tip: [r.part, r.code + ' · ' + r.category, `${n2(r.stock)} ${r.uom} on hand · ${fRs(r.value_pkr)}`, r.last_rcv ? 'Last received ' + dmy(r.last_rcv) + ` (${r.age_days} days)` : 'No receipt since Jan 2024', r.last_issue ? 'Last issued ' + dmy(r.last_issue) : 'No cost-centre issue on record'] })), { fmt: fM, rh: 34, emptyMsg: 'No aged stock for this selection' });

    /* register */
    table(q('#tb-iv'), S, [{ k: 'code' }, { k: 'part' }, { k: 'shop', fmt: v => v || '—' }, { k: 'category', render: (td, v) => { const s = document.createElement('span'); s.className = 'ivcat'; s.style.background = CATC[v] || '#B9C1C9'; s.textContent = v; td.appendChild(s); } },
      { k: 'stage', fmt: v => v || '—' }, { k: 'stock', n: 1, fmt: v => n2(v) }, { k: 'uom' }, { k: 'value_pkr', n: 1, fmt: v => nf(Math.round(v)) },
      { k: 'qi', n: 1, fmt: (v, r) => (r.qi || r.blocked) ? n2(r.qi || 0) + ' / ' + n2(r.blocked || 0) : '—', color: (v, r) => r.qi || r.blocked ? C.warn : null },
      { k: 'last_rcv', fmt: dmy, color: (v, r) => r.age_days == null || r.age_days > 365 ? C.bad : r.age_days > 180 ? C.warn : null }, { k: 'last_issue', fmt: dmy }, { k: 'issue_90d', n: 1, fmt: v => v > 0 ? n2(v) : v < 0 ? 'net return' : '—' },
      { k: 'cover_days', n: 1, fmt: v => v == null ? '—' : nf(v), color: v => v != null && v < 15 ? C.bad : null }, { k: 'slocs' }], { q: q('#q-iv'), sort: 'value_pkr', dir: -1 });
  };
})();
