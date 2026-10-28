/* VA/CR Activities tab: cost-reduction ideas from the shop CR decks and VA/CR sheets (dataset cr_ideas).
   Reads the shared kit (window.AK) and the dashboard filters; adds its own CR filters as dash params (cr*). */
(() => {
  const AK = window.AK; if (!AK) return;
  const { tip, table } = AK;
  const CATS = ['Reduce', 'ReUse', 'Resource', 'Localize', 'Commonize', 'Specs Change', 'Automation'];
  const CATC = { Reduce: '#051C2C', ReUse: '#1F9E89', Resource: '#2251FF', Localize: '#00A9F4', Commonize: '#7B61FF', 'Specs Change': '#E0A100', Automation: '#0B6E99' };
  const CATB = { Reduce: 'Cut consumption, motion or energy in the current process', ReUse: 'Give worn tools, molds and parts a second life', Resource: 'Buy the same item cheaper from another source', Localize: 'Replace an imported item with a local one', Commonize: 'Share one item or utility across parts and lines', 'Specs Change': 'Change the part design to drop cost or a process step', Automation: 'Machines or sensors take over manual work' };
  const STS = ['Completed', 'In Progress', 'Pending', 'Proposal'];
  const STC = { Completed: '#1E8C5A', 'In Progress': '#E0A100', Pending: '#8E9AA6', Proposal: '#C9D1D9' };
  const MODS = ['CD70', 'CG125', 'Pridor', 'All models', 'Non-motorcycle'];
  const MODC = { CD70: '#051C2C', CG125: '#2251FF', Pridor: '#00A9F4', 'All models': '#1F9E89', 'Non-motorcycle': '#B9C1C9' };
  const SHOPS = ['Clutch', 'Press Shop', 'Ignition Coil', 'Piston', 'Carburetor', 'CIF Machining', 'HPDC / Die Cast', 'Polymer'];
  const SHC = ['#051C2C', '#2251FF', '#00A9F4', '#1F9E89', '#7B61FF', '#0B6E99', '#E0A100', '#8E9AA6'];
  const shopC = s => SHC[Math.max(0, SHOPS.indexOf(s)) % SHC.length];
  const QS = ['Q1', 'Q2', 'Q3', 'Q4'], QL = { Q1: 'Q1 · Jul–Sep 26', Q2: 'Q2 · Oct–Dec 26', Q3: 'Q3 · Jan–Mar 27', Q4: 'Q4 · Apr–Jun 27' };
  const fRs = v => { v = +v || 0; const a = Math.abs(v); return a >= 1e6 ? 'Rs ' + d3.format(',.2f')(v / 1e6) + 'M' : a >= 1e3 ? 'Rs ' + d3.format(',.0f')(v / 1e3) + 'K' : 'Rs ' + d3.format(',')(Math.round(v)); };
  const fM = v => d3.format(',.2f')((+v || 0) / 1e6);
  const fU = v => v == null ? '—' : 'Rs ' + d3.format(',.2~f')(v);
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';
  const mon = s => { const [y, m] = String(s).split('-'); return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1] + '-' + y.slice(2); };
  const q = s => document.querySelector(s);
  const P = () => dash.params() || {};
  const KEYS = ['crcat', 'crshop', 'crst', 'crq', 'crmodel', 'crsrc', 'crsel'];
  const set = o => dash.setParams(o);
  const tog = (k, v) => set({ [k]: P()[k] === v ? 0 : v, crsel: 0 });

  /* styles */
  if (!q('#vacr-css')) { const st = document.createElement('style'); st.id = 'vacr-css'; st.textContent = `
.ael #savings .crbar{display:flex;flex-wrap:wrap;gap:8px 10px;align-items:flex-end;padding:10px 14px;background:#fff;border:1px solid var(--line);border-top:3px solid var(--navy);margin-bottom:14px}
.ael #savings .crbar label{display:flex;flex-direction:column;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);gap:3px}
.ael #savings .crbar select{font:inherit;font-size:12.5px;padding:5px 8px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--ink);min-width:130px}
.ael #savings .crbar select.fon{background:#FFE8A3;border-color:#E0A100;color:#000;font-weight:600}
.ael #savings .crbar .seg{display:inline-flex;border:1px solid var(--line);border-radius:4px;overflow:hidden;margin-left:auto}
.ael #savings .crbar .seg button{font:inherit;font-size:12px;padding:6px 11px;border:0;background:#fff;color:var(--mut);cursor:pointer}
.ael #savings .crbar .seg button.on{background:var(--navy);color:#fff}
.ael #savings .crmh{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:6px}.ael #savings .crmh h3{margin-bottom:4px}
.ael #savings .crmt{display:inline-flex;gap:4px}.ael #savings .crmt button{font:inherit;font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:4px;border:1px solid #D5DBE1;background:#E9EDF1;color:#5A6670;cursor:pointer}
.ael #savings .crmt button.on{background:var(--navy);border-color:var(--navy);color:#fff}
.ael #savings .crmt button:disabled{opacity:.42;cursor:not-allowed}
.ael #savings .crcrumbs{display:flex;flex-wrap:wrap;gap:6px;margin:-6px 0 12px;min-height:0}
.ael #savings .crcrumbs button{font:inherit;font-size:11.5px;border:1px solid #E0A100;background:#FFF6DA;color:#000;border-radius:12px;padding:2px 10px;cursor:pointer}
.ael #savings .crcrumbs button:hover{background:#FFE8A3}
.ael #savings .crhead{display:flex;align-items:baseline;gap:12px;margin:2px 0 10px}
.ael #savings .crhead h2{font-family:var(--font-anthropic-serif);font-weight:400;font-size:24px;color:var(--navy);margin:0}
.ael #savings .crhead span{font-size:12px;color:var(--mut)}
.ael #savings .crdon{display:grid;grid-template-columns:minmax(130px,170px) minmax(0,1fr);gap:12px;align-items:center}
@media (max-width:620px){.ael #savings .crdon{grid-template-columns:1fr}}
.ael #savings .crleg{display:flex;flex-direction:column;gap:2px;font-size:12px}
.ael #savings .crleg div{display:grid;grid-template-columns:10px minmax(0,1fr) auto 32px;gap:7px;align-items:center;padding:4px 6px;border-radius:3px;cursor:pointer}.ael #savings .crleg span{line-height:1.25}
.ael #savings .crleg div:hover{background:var(--soft)} .ael #savings .crleg div.sel{background:#EEF4FF;font-weight:600} .ael #savings .crleg div.dim{opacity:.4}
.ael #savings .crleg i{width:10px;height:10px;border-radius:2px;display:block}
.ael #savings .crleg b{font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap} .ael #savings .crleg em{font-style:normal;color:var(--mut);text-align:right;font-variant-numeric:tabular-nums}
.ael #savings .crsub{font-size:11.5px;color:var(--mut);margin:-4px 0 8px}
.ael #savings .crcap{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);margin-left:6px;font-weight:600}
.ael #savings .crdet{border-left:3px solid var(--blue);background:#fff}
.ael #savings .crdet .dg{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px 18px;margin:10px 0}
.ael #savings .crdet .dg div span{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
.ael #savings .crdet .dg div b{font-family:var(--font-anthropic-serif);font-weight:400;font-size:20px;color:var(--navy)}
.ael #savings .crdet .ba{display:grid;grid-template-columns:1fr 1fr;gap:12px} @media (max-width:620px){.ael #savings .crdet .ba{grid-template-columns:1fr}}
.ael #savings .crdet .ba div{background:var(--soft);padding:8px 10px;font-size:12.5px} .ael #savings .crdet .ba div span{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);margin-bottom:3px}
.ael #savings .crdet .nt{font-size:12px;color:var(--mut);margin-top:8px} .ael #savings .crdet .x{position:absolute;right:12px;top:10px;font:inherit;font-size:12px;border:1px solid var(--line);background:#fff;border-radius:4px;padding:2px 9px;cursor:pointer}
.ael #savings .catp{display:inline-block;padding:1px 8px;border-radius:9px;font-size:11px;font-weight:600;color:#fff;white-space:nowrap}
.ael #savings .stp{display:inline-flex;align-items:center;gap:5px;font-size:12px;white-space:nowrap} .ael #savings .stp i{width:8px;height:8px;border-radius:50%;display:inline-block}
.ael #savings table.tb tbody tr{cursor:pointer} .ael #savings table.tb td.n{text-align:right;font-variant-numeric:tabular-nums}
.ael #savings .mx td{text-align:right;font-variant-numeric:tabular-nums;cursor:pointer} .ael #savings .mx td:first-child{text-align:left;font-weight:600;cursor:pointer}
.ael #savings .mx td.z{color:#C9D1D9;cursor:default} .ael #savings .mx tr.tot td{font-weight:700;border-top:2px solid var(--navy);cursor:default}
`; document.head.appendChild(st); }

  /* the tab's markup (kept here so the main page stays under the size limit) */
  { const sec = q('#savings'); if (sec && !q('#cr-bar')) sec.innerHTML = "<div class=\"crbar\" id=\"cr-bar\"><label>Category<select id=\"cr-f-cat\" aria-label=\"CR category\"></select></label><label>Status<select id=\"cr-f-st\" aria-label=\"CR status\"></select></label><label>Target quarter<select id=\"cr-f-q\" aria-label=\"Target quarter\"></select></label><label>Source<select id=\"cr-f-src\" aria-label=\"Source\"></select></label><span class=\"crmt\" id=\"cr-metric\" role=\"group\" aria-label=\"Measure for the whole tab\" style=\"margin-left:auto;align-self:center\"><button type=\"button\" data-m=\"annual\">Annual CR</button><button type=\"button\" data-m=\"unit\">Per Unit CR</button><button type=\"button\" data-m=\"count\">Ideas</button></span></div>\n<div class=\"crcrumbs\" id=\"cr-crumbs\"></div>\n<div class=\"crhead\"><h2>VA/CR Cost Reduction Ideas</h2><span id=\"cr-asof\"></span></div>\n<div class=\"grid\">\n<div class=\"card wide kpicard\" id=\"c-cr-kpi\"><div class=\"ktiles\" id=\"cr-kpi\" data-source=\"cr_ideas\"></div></div>\n<div class=\"card wide crdet\" id=\"c-cr-det\" hidden><div id=\"cr-det\" data-source=\"cr_ideas\"></div></div>\n</div>\n<div class=\"grid\" style=\"grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr))\">\n<div class=\"card\" id=\"c-cr-cat\"><div class=\"crmh\"><h3>By Category</h3><span class=\"crmt\" id=\"cr-catm\" role=\"group\" aria-label=\"By Category measure\"><button type=\"button\" data-m=\"annual\">Annual CR</button><button type=\"button\" data-m=\"unit\">Per Unit CR</button><button type=\"button\" data-m=\"count\">Ideas</button></span></div><div class=\"crdon\"><div id=\"cr-d-cat\" data-source=\"cr_ideas\"></div><div class=\"crleg\" id=\"cr-l-cat\"></div></div></div>\n<div class=\"card\" id=\"c-cr-shop\"><div class=\"crmh\"><h3>By Shop</h3><span class=\"crmt\" id=\"cr-shopm\" role=\"group\" aria-label=\"By Shop measure\"><button type=\"button\" data-m=\"annual\">Annual CR</button><button type=\"button\" data-m=\"unit\">Per Unit CR</button><button type=\"button\" data-m=\"count\">Ideas</button></span></div><div class=\"crdon\"><div id=\"cr-d-shop\" data-source=\"cr_ideas\"></div><div class=\"crleg\" id=\"cr-l-shop\"></div></div></div>\n<div class=\"card\" id=\"c-cr-mod\"><div class=\"crmh\"><h3>By Model</h3><span class=\"crmt\" id=\"cr-modm\" role=\"group\" aria-label=\"By Model measure\"><button type=\"button\" data-m=\"annual\">Annual CR</button><button type=\"button\" data-m=\"unit\">Per Unit CR</button><button type=\"button\" data-m=\"count\">Ideas</button></span></div><div class=\"crdon\"><div id=\"cr-d-mod\" data-source=\"cr_ideas\"></div><div class=\"crleg\" id=\"cr-l-mod\"></div></div></div>\n</div>\n<div class=\"grid\">\n<div class=\"card\" id=\"c-cr-q\"><h3>Savings Pipeline by Target Quarter</h3><p class=\"crsub\">Stacked by status \u00b7 click a quarter to filter</p><div class=\"chart\" id=\"cr-q\" data-source=\"cr_ideas\"></div></div>\n<div class=\"card\" id=\"c-cr-mt\"><h3>Impact by Model</h3><p class=\"crsub\">Saving per unit is the sum of per-unit savings on that model's parts</p><div class=\"tbox\"><table class=\"tb\" id=\"tb-cr-mod\" data-source=\"cr_ideas\" data-row-key=\"model\"><thead><tr><th data-field=\"model\">Model</th><th class=\"n\" data-field=\"ideas\">Ideas</th><th class=\"n\" data-field=\"cr_unit\">Rs / unit</th><th class=\"n\" data-field=\"monthly\">Rs / month</th><th class=\"n\" data-field=\"annual\">Rs M / year</th><th class=\"n\" data-field=\"done\">Achieved Rs M</th></tr></thead><tbody></tbody></table></div></div>\n<div class=\"card wide\" id=\"c-cr-mx\"><h3>Shop \u00d7 Category <span class=\"crcap\">Rs M a year</span></h3><p class=\"crsub\">Click a cell, shop or category to drill down</p><div class=\"tbox\" id=\"cr-mx\" data-source=\"cr_ideas\"></div></div>\n<div class=\"card wide\" id=\"c-cr-st\"><h3>Impact by Shop</h3><p class=\"crsub\">Press Shop makes clutch plates, so the top Shop filter shows it under Clutch</p><div class=\"tbox\"><table class=\"tb\" id=\"tb-cr-shop\" data-source=\"cr_ideas\" data-row-key=\"shop\"><thead><tr><th data-field=\"shop\">Shop</th><th class=\"n\" data-field=\"ideas\">Ideas</th><th class=\"n\" data-field=\"done\">Completed</th><th class=\"n\" data-field=\"cr_unit\">Rs / unit</th><th class=\"n\" data-field=\"monthly\">Rs / month</th><th class=\"n\" data-field=\"annual\">Rs M / year</th></tr></thead><tbody></tbody></table></div></div>\n<div class=\"card wide\" id=\"c-cr-reg\"><h3>Idea Register</h3><p class=\"crsub\">Click an idea for its before/after detail \u00b7 annual = monthly saving \u00d7 12</p><input class=\"q\" id=\"q-cr\" placeholder=\"Search idea, part, shop or category\" aria-label=\"Search ideas\"><div class=\"tbox\" style=\"max-height:520px\"><table class=\"tb\" id=\"tb-cr\" data-source=\"cr_ideas\" data-row-key=\"key,model\"><thead><tr><th data-field=\"key\">Ref</th><th data-field=\"shop\">Shop</th><th data-field=\"model\">Model</th><th data-field=\"part\">Part</th><th data-field=\"item\">Idea</th><th data-field=\"category\">Category</th><th data-field=\"status\">Status</th><th data-field=\"target\">Target</th><th class=\"n\" data-field=\"cr_unit\">Rs / unit</th><th class=\"n\" data-field=\"monthly_pkr\">Rs / month</th><th class=\"n\" data-field=\"annual_pkr\">Rs M / year</th><th class=\"n\" data-field=\"investment_pkr\">Investment Rs M</th></tr></thead><tbody></tbody></table></div></div>\n</div>";
    /* donut card titles: the drill-down hint shows as a tooltip on hover */
    ['c-cr-cat', 'c-cr-shop', 'c-cr-mod'].forEach(id => { const h = q('#' + id + ' h3'); if (!h || h._t) return; h._t = 1; h.style.cursor = 'help';
      h.addEventListener('mousemove', ev => tip.show(ev, [h.textContent, 'Click a slice or row to drill down'])); h.addEventListener('mouseleave', () => tip.hide()); }); }

  /* filters: the dashboard's Shop and Model on top, plus the CR filters below the tabs */
  const rowsAll = () => { const d = dash.data('cr_ideas'); return d && d.status === 'ok' ? d.data.map(r => ({ ...r, monthly_pkr: +r.monthly_pkr || 0, annual_pkr: +r.annual_pkr || 0, cr_unit: r.cr_unit == null || r.cr_unit === '' ? null : +r.cr_unit, investment_pkr: r.investment_pkr == null || r.investment_pkr === '' ? null : +r.investment_pkr })) : null; };
  const modelOf = r => MODS.includes(r.model) ? r.model : 'Non-motorcycle';
  const srcOf = r => /VA\/CR sheet/.test(r.source) ? 'VA/CR sheets' : 'Shop CR plans';
  const pass = (r, p, g, skip) => (g.shop === 'All' || r.dash_shop === g.shop) && (g.model === 'All' || r.model === g.model || r.model === 'All models')
    && (skip === 'cat' || !p.crcat || r.category === p.crcat) && (skip === 'shop' || !p.crshop || r.shop === p.crshop) && (skip === 'model' || !p.crmodel || modelOf(r) === p.crmodel)
    && (!p.crst || r.status === p.crst) && (!p.crq || r.quarter === p.crq) && (!p.crsrc || srcOf(r) === p.crsrc);
  const metric = () => window.__vacrMetric || 'annual';
  const mval = rs => metric() === 'count' ? new Set(rs.map(r => r.key)).size : metric() === 'unit' ? d3.sum(rs, r => r.cr_unit || 0) : d3.sum(rs, r => metric() === 'monthly' ? r.monthly_pkr : r.annual_pkr);
  const fV = v => metric() === 'count' ? v : metric() === 'unit' ? d3.format(',.2f')(v) : fM(v);
  const mfmt = v => metric() === 'count' ? d3.format(',')(v) + (v === 1 ? ' idea' : ' ideas') : metric() === 'unit' ? 'Rs ' + d3.format(',.2f')(v) + ' / unit' : fRs(v);
  const mname = () => ({ annual: 'Annual saving (run-rate)', monthly: 'Monthly saving', unit: 'Saving per unit (sum of the ideas\' Rs / unit)', count: 'Number of ideas' })[metric()];

  /* donut with a legend; click a slice or a legend row to filter, again to clear */
  function donutCard(el, leg, items, key, colorOf, briefOf, o = {}) {
    el.replaceChildren(); leg.replaceChildren();
    const tot = d3.sum(items, d => d.v), sel = P()[key];
    const w = Math.max(130, Math.min(170, el.clientWidth || 170)), r = w / 2, h = w;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${w} ${h}`).style('max-width', w + 'px').style('display', 'block').style('margin', '0 auto');
    const g = svg.append('g').attr('transform', `translate(${r},${r})`);
    const arcs = d3.pie().sort(null).value(d => d.v).padAngle(0.012)(items.filter(d => d.v > 0));
    const arc = d3.arc().innerRadius(r * 0.62).outerRadius(r - 4), arcH = d3.arc().innerRadius(r * 0.62).outerRadius(r);
    const tipL = d => [d.name, o.fmt ? `${o.name}: ${o.fmt(d.v)} (${pct(d.v, tot)} of total)` : `${mname()}: ${mfmt(d.v)} (${pct(d.v, tot)} of total)`, `Annual ${fRs(d.annual)} · monthly ${fRs(d.monthly)} · ${d.n} idea${d.n === 1 ? '' : 's'} (${d.done} completed)`, ...(briefOf ? [briefOf(d.name)] : []), ...d.top.map((t, i) => `${i + 1}. ${t}`), sel === d.name ? 'Click to clear this filter' : 'Click to show only these ideas'].filter(Boolean);
    g.selectAll('path').data(arcs).join('path').attr('d', a => (sel === a.data.name ? arcH : arc)(a)).attr('fill', a => colorOf(a.data.name))
      .attr('opacity', a => !sel || sel === a.data.name ? 1 : 0.28).attr('stroke', '#fff').attr('stroke-width', 1).style('cursor', 'pointer')
      .on('mousemove', (ev, a) => tip.show(ev, tipL(a.data))).on('mouseleave', () => tip.hide()).on('click', (ev, a) => { tip.hide(); tog(key, a.data.name); });
    const s = sel && items.find(d => d.name === sel), cv = s ? s.v : (o.total != null ? o.total : tot);
    g.append('text').attr('text-anchor', 'middle').attr('y', -4).style('font-family', 'var(--font-anthropic-serif)').style('font-size', r * 0.26 + 'px').style('fill', '#051C2C').text(o.fmt ? o.fmt(cv) : metric() === 'count' ? d3.format(',')(cv) : fRs(cv).replace('Rs ', ''));
    g.append('text').attr('text-anchor', 'middle').attr('y', r * 0.2).style('font-size', '10px').style('letter-spacing', '.08em').style('fill', '#5A6670').text(s ? (s.name.length > 16 ? s.name.slice(0, 15) + '…' : s.name).toUpperCase() : (o.label || (metric() === 'count' ? 'IDEAS' : metric() === 'monthly' ? 'PKR / MONTH' : 'PKR / YEAR')));
    if (!arcs.length) g.append('text').attr('text-anchor', 'middle').attr('y', 4).style('fill', '#5A6670').text('No ideas');
    items.forEach(d => { const row = document.createElement('div'); if (sel === d.name) row.className = 'sel'; else if (sel || !d.v) row.className = 'dim';
      const i = document.createElement('i'); i.style.background = colorOf(d.name); const n = document.createElement('span'); n.textContent = d.name; const b = document.createElement('b'); b.textContent = o.fmt ? o.fmt(d.v) : metric() === 'count' ? d3.format(',')(d.v) : fRs(d.v).replace('Rs ', ''); const e = document.createElement('em'); e.textContent = pct(d.v, tot);
      row.append(i, n, b, e); row.addEventListener('click', () => tog(key, d.name)); row.addEventListener('mousemove', ev => tip.show(ev, tipL(d))); row.addEventListener('mouseleave', () => tip.hide()); leg.appendChild(row); });
  }
  const group = (rs, names, fn) => names.map(name => { const v = rs.filter(r => fn(r) === name), ideas = d3.rollups(v, x => ({ a: d3.sum(x, r => r.annual_pkr), item: x[0].item, shop: x[0].shop }), r => r.key).sort((a, b) => b[1].a - a[1].a);
    return { name, v: mval(v), annual: d3.sum(v, r => r.annual_pkr), monthly: d3.sum(v, r => r.monthly_pkr), n: ideas.length, done: new Set(v.filter(r => r.status === 'Completed').map(r => r.key)).size, top: ideas.slice(0, 3).filter(x => x[1].a > 0).map(([, o]) => `${o.item} (${o.shop}) ${fRs(o.a)}/yr`) }; });

  /* savings by target quarter, stacked by status */
  function quarterBars(el, rs) {
    el.replaceChildren(); const w = Math.max(300, el.clientWidth || 600), h = 230, m = { l: 46, r: 10, t: 14, b: 40 };
    const data = QS.map(qq => { const o = { q: qq }; STS.forEach(s => { o[s] = mval(rs.filter(r => r.quarter === qq && r.status === s)); }); o.tot = d3.sum(STS, s => o[s]); o.rows = rs.filter(r => r.quarter === qq); return o; });
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${w} ${h}`);
    const x = d3.scaleBand(QS, [m.l, w - m.r]).padding(0.38), y = d3.scaleLinear([0, d3.max(data, d => d.tot) || 1], [h - m.b, m.t]).nice();
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(w - m.l - m.r)).tickFormat(v => metric() === 'count' || metric() === 'unit' ? d3.format(',')(v) : d3.format('.2~s')(v).replace('G', 'B'))).call(g => { g.select('.domain').remove(); g.selectAll('line').attr('stroke', '#E2E6EB'); g.selectAll('text').attr('fill', '#5A6670').style('font-size', '10.5px'); });
    const sel = P().crq;
    data.forEach(d => { let y0 = 0; STS.forEach(s => { const v = d[s]; if (!v) return; svg.append('rect').attr('x', x(d.q)).attr('width', x.bandwidth()).attr('y', y(y0 + v)).attr('height', Math.max(0, y(y0) - y(y0 + v))).attr('fill', STC[s]).attr('opacity', !sel || sel === d.q ? 1 : 0.3).style('cursor', 'pointer')
        .on('mousemove', ev => tip.show(ev, [`${QL[d.q]} · ${s}`, `${mname()}: ${mfmt(v)}`, ...d3.rollups(d.rows.filter(r => r.status === s), x => d3.sum(x, r => r.annual_pkr), r => r.item).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n, a]) => `· ${n} ${fRs(a)}/yr`), 'Click to filter this quarter'])).on('mouseleave', () => tip.hide()).on('click', () => { tip.hide(); tog('crq', d.q); }); y0 += v; });
      svg.append('text').attr('x', x(d.q) + x.bandwidth() / 2).attr('y', y(d.tot) - 5).attr('text-anchor', 'middle').style('font-size', '11px').style('font-weight', 600).style('fill', '#051C2C').text(d.tot ? mfmt(d.tot).replace(' ideas', '').replace(' idea', '') : '');
      svg.append('text').attr('x', x(d.q) + x.bandwidth() / 2).attr('y', h - m.b + 16).attr('text-anchor', 'middle').style('font-size', '11px').style('fill', '#051C2C').style('cursor', 'pointer').text(QL[d.q]).on('click', () => tog('crq', d.q)); });
    const lg = svg.append('g').attr('transform', `translate(${m.l},${h - 10})`); let lx = 0; STS.forEach(s => { lg.append('rect').attr('x', lx).attr('y', -8).attr('width', 9).attr('height', 9).attr('fill', STC[s]); const t = lg.append('text').attr('x', lx + 13).attr('y', 0).style('font-size', '10.5px').style('fill', '#5A6670').text(s); lx += 13 + t.node().getComputedTextLength() + 16; });
  }

  /* shop x category matrix */
  function matrix(el, rs) {
    el.replaceChildren(); const t = document.createElement('table'); t.className = 'tb mx'; t.setAttribute('data-source', 'cr_ideas'); const th = document.createElement('thead'), hr = document.createElement('tr');
    ['Shop', ...CATS, 'Total'].forEach((c, i) => { const h = document.createElement('th'); h.textContent = c; if (i) h.style.textAlign = 'right'; if (CATS.includes(c)) { h.style.cursor = 'pointer'; h.title = CATB[c]; h.addEventListener('click', () => tog('crcat', c)); if (P().crcat === c) h.style.background = '#FFE8A3'; } hr.appendChild(h); }); th.appendChild(hr); t.appendChild(th);
    const tb = document.createElement('tbody'), shops = SHOPS.filter(s => rs.some(r => r.shop === s)), mx = d3.max(shops, s => d3.max(CATS, c => mval(rs.filter(r => r.shop === s && r.category === c)))) || 1;
    const cell = (tr, v, list, label, onClick) => { const td = document.createElement('td'); if (!v) { td.className = 'z'; td.textContent = '–'; } else { td.textContent = fV(v); td.style.background = `rgba(34,81,255,${0.06 + 0.5 * v / mx})`; if (v / mx > 0.55) td.style.color = '#fff';
      td.addEventListener('mousemove', ev => tip.show(ev, [label, `${mname()}: ${mfmt(v)}`, ...d3.rollups(list, x => d3.sum(x, r => r.annual_pkr), r => r.item).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, a]) => `· ${n} ${fRs(a)}/yr`), 'Click to drill into these ideas'])); td.addEventListener('mouseleave', () => tip.hide()); td.addEventListener('click', () => { tip.hide(); onClick(); }); } tr.appendChild(td); };
    shops.forEach(s => { const tr = document.createElement('tr'), a = document.createElement('td'); a.textContent = s; a.title = 'Click to filter this shop'; a.addEventListener('click', () => tog('crshop', s)); if (P().crshop === s) a.style.background = '#FFE8A3'; tr.appendChild(a);
      CATS.forEach(c => { const l = rs.filter(r => r.shop === s && r.category === c); cell(tr, mval(l), l, `${s} · ${c}`, () => set({ crshop: s, crcat: c, crsel: 0 })); });
      const l = rs.filter(r => r.shop === s); const td = document.createElement('td'); td.textContent = fV(mval(l)); td.style.fontWeight = 600; tr.appendChild(td); tb.appendChild(tr); });
    const tr = document.createElement('tr'); tr.className = 'tot'; const a = document.createElement('td'); a.textContent = 'Total'; tr.appendChild(a); [...CATS, null].forEach(c => { const td = document.createElement('td'); const v = mval(c ? rs.filter(r => r.category === c) : rs); td.textContent = v ? fV(v) : '–'; tr.appendChild(td); }); tb.appendChild(tr);
    t.appendChild(tb); el.appendChild(t);
    if (!shops.length) { el.replaceChildren(); const d = document.createElement('div'); d.className = 'empty'; d.textContent = 'No ideas for this selection'; el.appendChild(d); }
  }

  const catPill = (td, v) => { const s = document.createElement('span'); s.className = 'catp'; s.style.background = CATC[v] || '#5A6670'; s.textContent = v; s.title = CATB[v] || ''; td.appendChild(s); };
  const stPill = (td, v) => { const s = document.createElement('span'); s.className = 'stp'; const i = document.createElement('i'); i.style.background = STC[v] || '#ccc'; s.append(i, document.createTextNode(v)); td.appendChild(s); };

  function detail(el, rs, all) {
    const k = P().crsel, card = q('#c-cr-det'); if (!card) return; const lines = k ? all.filter(r => r.key === k) : [];
    card.hidden = !lines.length; el.replaceChildren(); if (!lines.length) return; const r0 = lines[0];
    const h = document.createElement('h3'); h.textContent = `${r0.key} · ${r0.item}`; const x = document.createElement('button'); x.className = 'x'; x.textContent = 'Close ✕'; x.addEventListener('click', () => set({ crsel: 0 }));
    const sub = document.createElement('div'); sub.className = 'crsub'; sub.textContent = `${r0.shop} · ${r0.part} · ${[...new Set(lines.map(r => r.model_label || r.model))].join(', ')} · target ${mon(r0.target)} (${QL[r0.quarter] || r0.quarter})`;
    const tags = document.createElement('div'); const cp = document.createElement('span'); catPill(cp, r0.category); const sp = document.createElement('span'); sp.style.marginLeft = '10px'; stPill(sp, r0.status); tags.append(cp, sp);
    const dg = document.createElement('div'); dg.className = 'dg'; const cr = d3.max(lines, r => r.cr_unit);
    [['Saving per unit', cr == null ? '—' : fU(cr) + (r0.cr_unit_plan != null && r0.cr_unit_plan !== cr ? ` (plan ${fU(r0.cr_unit_plan)})` : '')], ['Monthly saving', fRs(d3.sum(lines, r => r.monthly_pkr))], ['Annual saving (run-rate)', fRs(d3.sum(lines, r => r.annual_pkr))], ['Investment', r0.investment_pkr ? fRs(r0.investment_pkr) + (r0.payback ? ` · payback ${r0.payback}` : '') : '—']]
      .forEach(([a, b]) => { const d = document.createElement('div'); const s = document.createElement('span'); s.textContent = a; const v = document.createElement('b'); v.textContent = b; d.append(s, v); dg.appendChild(d); });
    const how = document.createElement('div'); how.style.fontSize = '13px'; how.textContent = r0.how;
    const ba = document.createElement('div'); ba.className = 'ba'; [['Before', r0.before], ['After', r0.after]].forEach(([a, b]) => { const d = document.createElement('div'); const s = document.createElement('span'); s.textContent = a; d.append(s, document.createTextNode(b || '—')); ba.appendChild(d); });
    const nt = document.createElement('div'); nt.className = 'nt';
    nt.textContent = (lines.length > 1 ? 'By model: ' + lines.map(r => `${r.model_label || r.model} ${fRs(r.monthly_pkr)}/month`).join(' · ') + '. ' : '') + `Source: ${r0.source}${r0.slide ? ', slide ' + r0.slide : ''}.` + (r0.note ? ' ' + r0.note : '');
    el.append(x, h, sub, tags, dg, how, ba, nt);
  }

  function selBox(id, ph, opts, key) { const s = q('#' + id); if (!s) return; const cur = P()[key] || ''; if (s.dataset.k !== opts.join('|')) { s.dataset.k = opts.join('|'); s.replaceChildren(); [['', ph], ...opts.map(o => Array.isArray(o) ? o : [o, o])].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; s.appendChild(o); }); }
    s.value = cur; s.classList.toggle('fon', !!cur); if (!s._b) { s._b = 1; s.addEventListener('change', () => set({ [key]: s.value || 0, crsel: 0 })); } }

  function crumbs(el) { el.replaceChildren(); const p = P(); const names = { crcat: 'Category', crshop: 'Shop', crst: 'Status', crq: 'Quarter', crmodel: 'Model', crsrc: 'Source' };
    Object.keys(names).forEach(k => { if (!p[k]) return; const b = document.createElement('button'); b.textContent = `${names[k]}: ${k === 'crq' ? QL[p[k]] : p[k]}  ✕`; b.title = 'Remove this filter'; b.addEventListener('click', () => set({ [k]: 0, crsel: 0 })); el.appendChild(b); }); }

  function tile(kt, l, v, s, col) { const t = document.createElement('div'); t.className = 'ktile'; const a = document.createElement('div'); a.className = 'tl'; a.textContent = l; const b = document.createElement('div'); b.className = 'tv'; b.textContent = v; if (col) b.style.color = col; const c = document.createElement('div'); c.className = 'ts'; c.textContent = s; t.append(a, b, c); kt.appendChild(t); }

  window.__vacr = g => {
    const sec = q('#savings'); if (!sec) return;
    const all = rowsAll(), st = dash.data('cr_ideas').status;
    const hd = q('#cr-asof'); if (hd) hd.textContent = st === 'ok' ? `${new Set((all || []).map(r => r.key)).size} ideas from ${new Set((all || []).map(r => r.source)).size} decks · FY 2026-27` : st === 'error' ? 'Failed to load' : 'Loading…';
    if (!all) { ['#cr-kpi', '#cr-d-cat', '#cr-d-shop', '#cr-d-mod', '#cr-q', '#cr-mx', '#cr-det'].forEach(s => { const e = q(s); if (e) e.replaceChildren(); }); return; }
    const p = P();
    selBox('cr-f-cat', 'All categories', CATS, 'crcat'); selBox('cr-f-st', 'All statuses', STS, 'crst');
    selBox('cr-f-q', 'All quarters', QS.map(x => [x, QL[x]]), 'crq'); selBox('cr-f-src', 'All sources', ['Shop CR plans', 'VA/CR sheets'], 'crsrc');
    /* tab-wide measure: off by default; one button on at a time, the others locked until it is switched off again */
    document.querySelectorAll('#cr-metric button').forEach(b => { const on = b.dataset.m === window.__vacrMetric; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.disabled = !!window.__vacrMetric && !on;
      b.title = on ? 'Applied to the whole tab. Click again to switch it off' : window.__vacrMetric ? 'Switch off the active measure first' : 'Apply this measure to the whole tab'; });
    crumbs(q('#cr-crumbs'));
    const rs = all.filter(r => pass(r, p, g)), keys = new Set(rs.map(r => r.key));
    /* KPI tiles */
    { const kt = q('#cr-kpi'); kt.replaceChildren(); const ann = d3.sum(rs, r => r.annual_pkr), mo = d3.sum(rs, r => r.monthly_pkr), done = rs.filter(r => r.status === 'Completed'), ip = rs.filter(r => r.status === 'In Progress'), inv = d3.rollups(rs.filter(r => r.investment_pkr), v => v[0].investment_pkr, r => r.key);
      const n = s => new Set(rs.filter(r => r.status === s).map(r => r.key)).size;
      tile(kt, 'Annual saving (run-rate)', fRs(ann), `${fRs(mo)} a month · ${keys.size} ideas`);
      tile(kt, 'Achieved (completed)', fRs(d3.sum(done, r => r.annual_pkr)), `${pct(d3.sum(done, r => r.annual_pkr), ann)} of the run-rate · ${n('Completed')} ideas`, '#1E8C5A');
      tile(kt, 'In progress', fRs(d3.sum(ip, r => r.annual_pkr)), `${n('In Progress')} ideas being implemented`, '#B07A00');
      tile(kt, 'Pending + proposals', fRs(d3.sum(rs.filter(r => r.status === 'Pending' || r.status === 'Proposal'), r => r.annual_pkr)), `${n('Pending')} pending · ${n('Proposal')} VA/CR proposals`);
      tile(kt, 'Investment needed', inv.length ? fRs(d3.sum(inv, d => d[1])) : '—', inv.length ? `${inv.length} idea${inv.length === 1 ? '' : 's'} need capex` : 'No capex in this selection'); }
    /* donuts (each ignores its own filter so the other slices stay visible) */
    /* each donut has its own Annual CR / Per Unit CR / Ideas switch (one on at a time) */
    const measured = (box, key, mr, names, fn) => { window.__vacrM = window.__vacrM || { mod: window.__vacrModM }; const gl = window.__vacrMetric, mm = gl || (['unit', 'count'].includes(window.__vacrM[key]) ? window.__vacrM[key] : 'annual'), bx = q('#' + box);
      if (bx) bx.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b.dataset.m === mm); b.setAttribute('aria-pressed', String(b.dataset.m === mm)); b.disabled = !!gl; b.title = gl ? 'Set by the measure buttons at the top of the tab' : ''; if (!b._b) { b._b = 1; b.addEventListener('click', () => { window.__vacrM[key] = b.dataset.m; window.__draw && window.__draw(); }); } });
      const items = group(mr, names, fn).map(it => ({ ...it, v: mm === 'unit' ? d3.sum(mr.filter(r => fn(r) === it.name), r => r.cr_unit || 0) : mm === 'count' ? it.n : it.annual }));
      const opt = mm === 'count' ? { fmt: v => d3.format(',')(v), name: 'Number of ideas', label: 'IDEAS', total: new Set(mr.map(r => r.key)).size } : mm === 'unit' ? { fmt: v => 'Rs ' + d3.format(',.2f')(v), name: 'Saving per unit (sum of the ideas\' Rs / unit)', label: 'RS / UNIT' } : { fmt: v => fRs(v).replace('Rs ', ''), name: 'Annual saving', label: 'PKR / YEAR' };
      return [items, opt]; };
    { const [it, o] = measured('cr-catm', 'cat', all.filter(r => pass(r, p, g, 'cat')), CATS, r => r.category); donutCard(q('#cr-d-cat'), q('#cr-l-cat'), it, 'crcat', c => CATC[c], c => CATB[c], o); }
    const shopRows = all.filter(r => pass(r, p, g, 'shop'));
    { const [it, o] = measured('cr-shopm', 'shop', shopRows, SHOPS.filter(s => all.some(r => r.shop === s)), r => r.shop); donutCard(q('#cr-d-shop'), q('#cr-l-shop'), it, 'crshop', shopC, null, o); }
    { const [it, o] = measured('cr-modm', 'mod', all.filter(r => pass(r, p, g, 'model')), MODS, modelOf);
    donutCard(q('#cr-d-mod'), q('#cr-l-mod'), it, 'crmodel', m => MODC[m], m => m === 'All models' ? 'Ideas that apply to every motorcycle model (shop-wide tools, utilities and consumables)' : m === 'Non-motorcycle' ? 'Polymer parts for other customers: lids, buckets, Civic cover' : `Ideas specific to ${m}`, o); }
    quarterBars(q('#cr-q'), rs); matrix(q('#cr-mx'), rs);
    /* impact by model */
    { const tm = q('#tb-cr-mod'), data = MODS.map(m => { const l = rs.filter(r => modelOf(r) === m); return { model: m, ideas: new Set(l.map(r => r.key)).size, cr_unit: d3.sum(l, r => r.cr_unit || 0), monthly: d3.sum(l, r => r.monthly_pkr), annual: d3.sum(l, r => r.annual_pkr), done: d3.sum(l.filter(r => r.status === 'Completed'), r => r.annual_pkr) }; }).filter(d => d.ideas);
      table(tm, data, [{ k: 'model' }, { k: 'ideas', n: 1 }, { k: 'cr_unit', n: 1, fmt: v => d3.format(',.2f')(v) }, { k: 'monthly', n: 1, fmt: v => d3.format(',')(Math.round(v)) }, { k: 'annual', n: 1, fmt: fM }, { k: 'done', n: 1, fmt: fM, color: v => v > 0 ? '#1E8C5A' : null }], { sort: 'annual', onRow: r => tog('crmodel', r.model), sel: r => p.crmodel === r.model }); }
    /* by shop */
    { const ts = q('#tb-cr-shop'), data = SHOPS.map(s => { const l = rs.filter(r => r.shop === s); return { shop: s, ideas: new Set(l.map(r => r.key)).size, done: new Set(l.filter(r => r.status === 'Completed').map(r => r.key)).size, cr_unit: d3.sum(l, r => r.cr_unit || 0), monthly: d3.sum(l, r => r.monthly_pkr), annual: d3.sum(l, r => r.annual_pkr) }; }).filter(d => d.ideas);
      table(ts, data, [{ k: 'shop' }, { k: 'ideas', n: 1 }, { k: 'done', n: 1 }, { k: 'cr_unit', n: 1, fmt: v => d3.format(',.2f')(v) }, { k: 'monthly', n: 1, fmt: v => d3.format(',')(Math.round(v)) }, { k: 'annual', n: 1, fmt: fM }], { sort: 'annual', onRow: r => tog('crshop', r.shop), sel: r => p.crshop === r.shop }); }
    /* idea register */
    { const ti = q('#tb-cr'), qi = q('#q-cr');
      table(ti, rs, [{ k: 'key' }, { k: 'shop' }, { k: 'model' }, { k: 'part' }, { k: 'item' }, { k: 'category', render: catPill }, { k: 'status', render: stPill, cmp: (a, b) => STS.indexOf(a) - STS.indexOf(b) }, { k: 'target', fmt: mon }, { k: 'cr_unit', n: 1, fmt: v => d3.format(',.2~f')(v) }, { k: 'monthly_pkr', n: 1, fmt: v => d3.format(',')(Math.round(v)) }, { k: 'annual_pkr', n: 1, fmt: fM }, { k: 'investment_pkr', n: 1, fmt: fM }],
        { q: qi, sort: 'annual_pkr', onRow: r => set({ crsel: p.crsel === r.key ? 0 : r.key }), sel: r => p.crsel === r.key });
      if (!ti._t) { ti._t = 1; ti.addEventListener('mousemove', ev => { const tr = ev.target.closest('tbody tr'); if (!tr || !tr.cells[0]) return tip.hide(); const k = tr.cells[0].textContent.trim(), r = all.find(x => x.key === k); if (!r) return tip.hide(); tip.show(ev, [`${r.key} · ${r.item}`, r.how, `Before: ${r.before || '—'}`, `After: ${r.after || '—'}`, 'Click for the full detail']); }); ti.addEventListener('mouseleave', () => tip.hide()); }
      if (qi && !qi._b) { qi._b = 1; qi.addEventListener('input', () => window.__draw()); } }
    detail(q('#cr-det'), rs, all);
  };

  /* controls */
  document.querySelectorAll('#cr-metric button').forEach(b => b.addEventListener('click', () => { const m = b.dataset.m; if (window.__vacrMetric && window.__vacrMetric !== m) return; window.__vacrMetric = window.__vacrMetric === m ? null : m; window.__draw && window.__draw(); }));
  const clr = document.getElementById('f-clear'); if (clr) clr.addEventListener('click', () => { const o = {}; KEYS.forEach(k => { o[k] = 0; }); set(o); });
  if (window.__page === 'savings' && window.__draw) window.__draw();
})();
