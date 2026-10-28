/* VA/CR Activities tab: conversion cost per unit (Labor, Tools & Cons., Utilities, Repair & Maint.), 2025-26 vs 2026-27,
   from the shops' "Conversion Cost Analysis" slides (dataset cr_conv), tied to the CR ideas (cr_ideas) that drive each element.
   Filters: the dashboard's Shop and Model, the CR Model filter, and its own dash params ccprod (product), ccel (cost element);
   the selected idea (crsel) is shared with the ideas register. */
(() => {
  const AK = window.AK; if (!AK) return;
  const { tip, table, empty, box } = AK;
  const q = s => document.querySelector(s);
  const P = () => dash.params() || {};
  const set = o => dash.setParams(o);
  const EL = ['Direct / Indirect Labor', 'Tools & Cons.', 'Utilities', 'Repair & Maint.'];
  const ELC = { 'Direct / Indirect Labor': '#0B2265', 'Tools & Cons.': '#A6A6A6', Utilities: '#A9C4F0', 'Repair & Maint.': '#F8CBAD' };
  const ELS = { 'Direct / Indirect Labor': 'Labor', 'Tools & Cons.': 'Tools & Cons.', Utilities: 'Utilities', 'Repair & Maint.': 'Repair & Maint.' };
  const f1 = v => v == null ? '—' : d3.format(',.2~f')(v);
  const MODS = ['CD70', 'CG125', 'Pridor', 'All models'];
  /* which conversion-cost element an idea works on (from its wording); a cheaper bought-in part is material, not conversion */
  const elOf = r => { const t = `${r.item} ${r.how}`.toLowerCase();
    if (/imported piston|material cost|raw material/.test(t)) return 'Material';
    if (/energy|\bkw\b|electric heater|gas to electric|\bpower\b|\blpg\b|compressor/.test(t)) return 'Utilities';
    if (/automat|manpower|operator|gripper|guided vehicle|multi-spindle|winding|press machine/.test(t)) return 'Direct / Indirect Labor';
    if (/spare|sensor|contactor|refurbish|repair|mainten|potting plant/.test(t)) return 'Repair & Maint.';
    return 'Tools & Cons.'; };

  if (!q('#conv-css')) { const st = document.createElement('style'); st.id = 'conv-css'; st.textContent = `
.ael #savings .cchead{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px;margin-bottom:6px}
.ael #savings .cchead h3{margin:0}
.ael #savings .ccctl{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ael #savings .ccctl select{font:inherit;font-size:12px;padding:4px 7px;border:1px solid var(--line);border-radius:4px;background:#fff;min-width:150px}
.ael #savings .ccctl select.fon{background:#FFE8A3;border-color:#E0A100;font-weight:600}
.ael #savings .ccel{display:inline-flex;flex-wrap:wrap;gap:4px}
.ael #savings .ccel button{font:inherit;font-size:11.5px;font-weight:600;padding:4px 9px;border-radius:4px;border:1px solid var(--line);background:#fff;color:var(--ink);cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.ael #savings .ccel button i{width:9px;height:9px;border-radius:2px;display:inline-block}
.ael #savings .ccel button.on{background:var(--navy);color:#fff;border-color:var(--navy)}
.ael #savings .ccgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin:8px 0 12px}
.ael #savings .ccbox{border:1px solid var(--line);border-radius:10px;padding:8px 10px 4px;background:#fff;cursor:pointer;transition:opacity .15s,box-shadow .15s}
.ael #savings .ccbox:hover{box-shadow:0 1px 6px rgba(5,28,44,.15)} .ael #savings .ccbox.sel{border:2px solid var(--blue);padding:7px 9px 3px} .ael #savings .ccbox.dim{opacity:.32}
.ael #savings .ccbox .t{display:flex;justify-content:space-between;align-items:baseline;gap:6px;font-weight:600;font-size:13px;color:var(--navy)}
.ael #savings .ccbox .t span{font-size:10.5px;font-weight:600;color:var(--navy);border:1px solid var(--navy);border-radius:4px;padding:0 5px;white-space:nowrap}
.ael #savings .ccbox .nt{font-size:10.5px;color:var(--mut);line-height:1.3;margin:2px 0 4px}
.ael #savings .ccsplit{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px} @media (max-width:900px){.ael #savings .ccsplit{grid-template-columns:1fr}}
.ael #savings .ccsub{font-size:11.5px;color:var(--mut);margin:-2px 0 8px}
.ael #savings table.tb td.n{text-align:right;font-variant-numeric:tabular-nums}
.ael #savings .ccsav{color:#1E8C5A;font-weight:600} .ael #savings .ccup{color:#D0312D;font-weight:600}
`; document.head.appendChild(st); }

  const mount = () => { if (q('#c-cc')) return true; const sec = q('#savings'); if (!sec || !q('#c-cr-reg')) return false;   /* placed at the bottom of the tab, after the ideas tables */
    const w = document.createElement('div'); w.className = 'grid'; w.innerHTML = `<div class="card wide" id="c-cc"><div class="cchead"><h3>Conversion Cost per Unit (Rs) · 2025-26 vs 2026-27</h3>
<div class="ccctl"><select id="cc-f-prod" aria-label="Product"></select><select id="cc-f-idea" aria-label="CR idea"></select><span class="ccel" id="cc-el" role="group" aria-label="Cost element"></span></div></div>
<div class="ccsub" id="cc-sub"></div><div class="ccgrid" id="cc-grid"></div>
<div class="ccsplit"><div><div class="ccsub" style="font-weight:600;color:var(--navy);font-size:12.5px">Saving per unit by product and cost element</div><div class="tbox"><table class="tb" id="tb-ccv"><thead><tr><th data-k="product">Product</th><th data-k="y0" class="n">Previous FY</th><th data-k="y1" class="n">Latest FY</th><th data-k="sav" class="n">Saving</th><th data-k="pct" class="n">% change</th><th data-k="lab" class="n">Labor</th><th data-k="tool" class="n">Tools &amp; Cons.</th><th data-k="util" class="n">Utilities</th><th data-k="rm" class="n">Repair &amp; Maint.</th><th data-k="cop" class="n">% of COP</th><th data-k="ideas" class="n">CR ideas Rs/unit</th></tr></thead><tbody></tbody></table></div></div>
<div><div class="ccsub" style="font-weight:600;color:var(--navy);font-size:12.5px" id="cc-ih">CR ideas behind the conversion saving</div><div class="tbox"><table class="tb" id="tb-ccv-i"><thead><tr><th data-k="key">#</th><th data-k="item">Idea</th><th data-k="prod">Product</th><th data-k="el">Element</th><th data-k="cr_unit" class="n">Rs/unit</th><th data-k="status">Status</th></tr></thead><tbody></tbody></table></div></div></div></div>`;
    sec.appendChild(w);
    const clr = document.getElementById('f-clear'); if (clr) clr.addEventListener('click', () => set({ ccprod: 0, ccel: 0 })); return true; };

  function stack(el, years, val, o) {   // stacked bars for one product, one bar per year
    const h = 190, { svg, w } = box(el, h), m = { t: 26, b: 22, l: 6, r: 6 };
    const tot = y => d3.sum(EL, e => val(y, e) || 0), max = d3.max(o.scaleMax ? [o.scaleMax] : years.map(tot)) || 1;
    const x = d3.scaleBand(years, [m.l, w - m.r]).padding(.38), y = d3.scaleLinear([0, max * 1.05], [h - m.b, m.t]);
    years.forEach((yr, i) => { let acc = 0; EL.forEach(e => { const v = val(yr, e) || 0; if (!v) return; const y0 = y(acc), y1 = y(acc + v); const dimEl = o.el && o.el !== e;
      svg.append('rect').attr('x', x(yr)).attr('y', y1).attr('width', x.bandwidth()).attr('height', Math.max(.5, y0 - y1)).attr('fill', ELC[e]).attr('opacity', dimEl ? .25 : 1).style('cursor', 'pointer')
        .on('mousemove', ev => tip.show(ev, [`${o.prod} · ${yr}`, `${e}: Rs ${f1(v)} per unit`, `Total conversion: Rs ${f1(tot(yr))}`, 'Click to show only this element']))
        .on('mouseleave', tip.hide).on('click', ev => { ev.stopPropagation(); tip.hide(); set({ ccel: o.el === e ? 0 : e }); });
      if (y0 - y1 > 13) svg.append('text').attr('x', x(yr) + x.bandwidth() / 2).attr('y', (y0 + y1) / 2 + 4).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('pointer-events', 'none')
        .style('fill', e === 'Direct / Indirect Labor' ? '#fff' : '#051C2C').style('font-weight', 600).attr('opacity', dimEl ? .4 : 1).text(f1(v));
      acc += v; });
      const show = o.el ? val(yr, o.el) || 0 : acc;
      svg.append('text').attr('x', x(yr) + x.bandwidth() / 2).attr('y', y(acc) - 6).attr('text-anchor', 'middle').attr('font-size', 12).style('font-weight', 700).style('fill', '#051C2C').text(f1(show));
      svg.append('text').attr('x', x(yr) + x.bandwidth() / 2).attr('y', h - 6).attr('text-anchor', 'middle').attr('font-size', 10.5).style('fill', '#5A6670').text(yr); });
    if (years.length >= 2) { const a = years[years.length - 2], b = years[years.length - 1], va = o.el ? val(a, o.el) || 0 : tot(a), vb = o.el ? val(b, o.el) || 0 : tot(b), d = vb - va;
      const xx = x(b) + x.bandwidth() + 4; if (xx < w - 4 && d) { const g = svg.append('g'); g.append('text').attr('x', Math.min(xx, w - 40)).attr('y', y(Math.max(tot(b), 0)) + 6).attr('font-size', 11.5).style('font-weight', 700)
        .style('fill', d < 0 ? '#1E8C5A' : '#D0312D').text((d < 0 ? '▼ ' : '▲ ') + f1(Math.abs(d))); } } }

  window.__conv = g => {
    if (!mount()) return;
    const cd = dash.data('cr_conv'), id = dash.data('cr_ideas');
    if (!cd || cd.status !== 'ok' || !id || id.status !== 'ok') { const gr = q('#cc-grid'); if (gr && cd && cd.status === 'error') empty(gr, '● Conversion cost data failed to load'); return; }
    const p = P(), C0 = cd.data.map(r => ({ ...r, rs_unit: +r.rs_unit, cop_pct: r.cop_pct == null || r.cop_pct === '' ? null : +r.cop_pct }));
    const ideasAll = id.data.map(r => ({ ...r, cr_unit: r.cr_unit == null || r.cr_unit === '' ? null : +r.cr_unit }));
    const mOk = (m, sel) => sel === 'All' || !sel || m === sel || m === 'All models';
    const C = C0.filter(r => (g.shop === 'All' || r.dash_shop === g.shop) && mOk(r.model, g.model) && (!p.crmodel || r.model === p.crmodel || r.model === 'All models' || p.crmodel === 'All models'));
    const prods = [...new Set(C.map(r => r.product))], prod = prods.includes(p.ccprod) ? p.ccprod : '', el = EL.includes(p.ccel) ? p.ccel : '';
    const meta = new Map(C0.map(r => [r.product, r]));
    /* ideas that belong to a product: same shop, and the same model (or an all-model idea) */
    const ideaProd = (r, pr) => { const m = meta.get(pr); return m && r.dash_shop === m.dash_shop && (r.model === m.model || r.model === 'All models' || m.model === 'All models'); };
    const KP = { done: r => r.status === 'Completed', ip: r => r.status === 'In Progress', pend: r => r.status === 'Pending' || r.status === 'Proposal', capex: r => +r.investment_pkr > 0 };   /* the KPI tiles at the top of the tab */
    const ideasPass = r => (!p.crcat || r.category === p.crcat) && (!p.crst || r.status === p.crst) && (!p.crq || r.quarter === p.crq) && (!KP[p.crkpi] || KP[p.crkpi](r)) && elOf(r) !== 'Material';
    const selIdea = p.crsel ? ideasAll.filter(r => r.key === p.crsel) : [];
    const ideaHit = pr => !selIdea.length || selIdea.some(r => ideaProd(r, pr));

    /* controls */
    const sp = q('#cc-f-prod'); sp.replaceChildren(new Option('All products', '')); prods.forEach(x => sp.appendChild(new Option(x, x))); sp.value = prod; sp.classList.toggle('fon', !!prod); sp.onchange = () => set({ ccprod: sp.value || 0 });
    const ideaOpts = [...new Map(ideasAll.filter(r => ideasPass(r) && prods.some(pr => ideaProd(r, pr))).map(r => [r.key, r])).values()].sort((a, b) => a.key.localeCompare(b.key));
    const si = q('#cc-f-idea'); si.replaceChildren(new Option('All CR ideas', '')); ideaOpts.forEach(r => si.appendChild(new Option(`${r.key} · ${r.item}`.slice(0, 60), r.key)));
    si.value = ideaOpts.some(r => r.key === p.crsel) ? p.crsel : ''; si.classList.toggle('fon', !!si.value); si.onchange = () => set({ crsel: si.value || 0 });
    const eb = q('#cc-el'); eb.replaceChildren(); [['', 'All elements']].concat(EL.map(e => [e, ELS[e]])).forEach(([k, lb]) => { const b = document.createElement('button'); b.type = 'button'; b.className = (el === k ? 'on' : '');
      if (k) { const i = document.createElement('i'); i.style.background = ELC[k]; b.appendChild(i); } b.appendChild(document.createTextNode(lb)); b.addEventListener('click', () => set({ ccel: k || 0 })); eb.appendChild(b); });
    q('#cc-sub').textContent = 'Rs per unit, from the shops\' Conversion Cost Analysis slides. Click a product to focus it, a bar segment to isolate that cost element; the CR idea picker highlights the products it applies to.';

    /* small multiples */
    const gr = q('#cc-grid'); gr.replaceChildren();
    const shown = prods.filter(pr => !prod || pr === prod);
    if (!shown.length) { empty(gr, 'No conversion cost slide for this shop / model'); }
    const tv = (pr, fy, e) => { const rs = C.filter(r => r.product === pr && r.fy === fy && (!e || r.element === e)); return rs.length ? d3.sum(rs, r => r.rs_unit) : null; };
    shown.forEach(pr => { const m = meta.get(pr), yrs = [...new Set(C.filter(r => r.product === pr).map(r => r.fy))].sort();
      const bx = document.createElement('div'); bx.className = 'ccbox' + (prod === pr ? ' sel' : '') + (ideaHit(pr) ? '' : ' dim'); bx.title = 'Click to focus this product';
      const t = document.createElement('div'); t.className = 't'; t.append(document.createTextNode(pr)); const ylast = yrs[yrs.length - 1], cop = (C.find(r => r.product === pr && r.fy === ylast) || {}).cop_pct;
      if (cop != null) { const s = document.createElement('span'); s.textContent = `Conv. ${cop}% of COP`; t.appendChild(s); }
      const ch = document.createElement('div'); bx.append(t, ch); if (m.note) { const n = document.createElement('div'); n.className = 'nt'; n.textContent = m.note; bx.appendChild(n); }
      bx.addEventListener('click', () => set({ ccprod: prod === pr ? 0 : pr })); gr.appendChild(bx);
      stack(ch, yrs, (fy, e) => tv(pr, fy, e), { el, prod: pr }); });

    /* product table */
    const ideasFor = pr => ideasAll.filter(r => ideasPass(r) && ideaProd(r, pr) && (!el || elOf(r) === el));
    const rows = prods.map(pr => { const yrs = [...new Set(C.filter(r => r.product === pr).map(r => r.fy))].sort(), a = yrs[yrs.length - 2], b = yrs[yrs.length - 1];
      const d = e => { const x = tv(pr, a, e), y = tv(pr, b, e); return x == null || y == null ? null : +(x - y).toFixed(2); };
      const y0 = tv(pr, a, el), y1 = tv(pr, b, el), il = ideasFor(pr);
      return { product: pr, fa: a, fb: b, y0, y1, sav: d(el), pct: y0 ? (y1 - y0) / y0 * 100 : null, lab: d('Direct / Indirect Labor'), tool: d('Tools & Cons.'), util: d('Utilities'), rm: d('Repair & Maint.'),
        cop: (C.find(r => r.product === pr && r.fy === b) || {}).cop_pct, ideas: il.length ? d3.sum([...new Map(il.map(r => [r.key, r])).values()], r => r.cr_unit || 0) : null, n: il.length }; });
    const sv = v => v == null ? '—' : (v > 0 ? '▼ ' : v < 0 ? '▲ ' : '') + f1(Math.abs(v)), sc = v => v > 0 ? '#1E8C5A' : v < 0 ? '#D0312D' : null;
    table(q('#tb-ccv'), rows.filter(r => !prod || r.product === prod), [{ k: 'product' }, { k: 'y0', n: 1, fmt: (v, r) => f1(v) + (r.fa !== '2025-26' ? ` (${r.fa})` : '') }, { k: 'y1', n: 1, fmt: (v, r) => f1(v) + (r.fb !== '2026-27' ? ` (${r.fb})` : '') }, { k: 'sav', n: 1, fmt: sv, color: sc },
      { k: 'pct', n: 1, fmt: v => v == null ? '—' : d3.format('+.1f')(v) + '%', color: v => v < 0 ? '#1E8C5A' : v > 0 ? '#D0312D' : null },
      { k: 'lab', n: 1, fmt: sv, color: sc }, { k: 'tool', n: 1, fmt: sv, color: sc }, { k: 'util', n: 1, fmt: sv, color: sc }, { k: 'rm', n: 1, fmt: sv, color: sc },
      { k: 'cop', n: 1, fmt: v => v == null ? '—' : v + '%' }, { k: 'ideas', n: 1, fmt: (v, r) => v == null ? '—' : f1(v) + ` (${new Set(ideasFor(r.product).map(x => x.key)).size})` }],
      { sort: 'sav', dir: -1, onRow: r => set({ ccprod: prod === r.product ? 0 : r.product }), sel: r => prod === r.product });

    /* ideas behind it */
    const il = []; (prod ? [prod] : prods).forEach(pr => ideasFor(pr).forEach(r => il.push({ ...r, prod: pr, el: elOf(r) })));
    const ik = new Map(); il.forEach(r => { const k = r.key + '|' + r.prod; if (!ik.has(k)) ik.set(k, r); });
    q('#cc-ih').textContent = 'CR ideas behind the conversion saving' + (prod ? ' · ' + prod : '') + (el ? ' · ' + ELS[el] : '');
    table(q('#tb-ccv-i'), [...ik.values()], [{ k: 'key' }, { k: 'item' }, { k: 'prod' }, { k: 'el', render: (td, v) => { const i = document.createElement('i'); i.style.cssText = `display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;background:${ELC[v]}`; td.append(i, document.createTextNode(ELS[v] || v)); } },
      { k: 'cr_unit', n: 1, fmt: v => v == null ? '—' : f1(v) }, { k: 'status' }], { sort: 'cr_unit', dir: -1, onRow: r => set({ crsel: p.crsel === r.key ? 0 : r.key }), sel: r => p.crsel === r.key });
  };
})();
