/* Clutch - material against the SAP BOM (Cost tab; Umair, 13 Nov 2026 14:37).
   Shows when the Shop filter is Clutch (or All). Datasets sap_bom + sap_bom_cost (tools/sap_bom_build.py).
   Rates: moving-average price SAP issues at (MB51 261 less 262 amount / quantity). Never the receipt rate for cost.
   Standard = clutch output that month (MB51 101 less 102 of the 5 clutch FG codes) x level-1 BOM quantity; CD70's three BOM
   alternatives are weighted by that month's issues of the three drive plates. Actual = 261 less 262 of the same components.
   A component also used in SPD clutch assemblies (9110/9120/9130… codes, not yet read from CS03) shows extra issues. */
(() => {
  const AK = window.AK; if (!AK) return;
  const { tip } = AK;
  const nf = d3.format(','), r2 = d3.format(',.2f'), pc = d3.format('+.1%');
  const mk = v => { const a = Math.abs(v); return (v < 0 ? '-' : '') + (a >= 1e6 ? d3.format(',.1f')(a / 1e6) + 'M' : a >= 1e3 ? d3.format(',.0f')(a / 1e3) + 'k' : d3.format(',.0f')(a)); };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const obj = v => { if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return null; } } return v; };
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], ml = m => MN[+m.slice(5) - 1] + ' ' + m.slice(2, 4);
  const FGN0 = { '9010113004': 'CD70', '9020113004': 'CG125', '9030113004': 'Pridor (INH)', '9030113005': 'Pridor (INH parts)', '9070113004': 'CB150F', '9010910002': 'CD70', '9020910002': 'CG125', '9030910003': 'Pridor' };
  let FGN = FGN0;
  const css = document.createElement('style'); css.textContent = `
.ael #c-cp-bom .sbsub{font-size:12px;color:var(--mut);margin:-4px 0 10px;line-height:1.45}
.ael #c-cp-bom .sbsub b{color:var(--navy);font-weight:600}
.ael #c-cp-bom h4{font-size:13px;margin:14px 0 6px;color:var(--navy)}
.ael #c-cp-bom table{width:100%;border-collapse:collapse;font-size:12.5px}
.ael #c-cp-bom th{text-align:left;font-weight:600;color:#5A6670;font-size:11.5px;padding:6px 8px;border-bottom:1px solid #DDE3EA;background:#F7F9FB;position:sticky;top:0;cursor:pointer}
.ael #c-cp-bom td{padding:5px 8px;border-bottom:1px solid #EEF1F4}
.ael #c-cp-bom .n{text-align:right;font-variant-numeric:tabular-nums}
.ael #c-cp-bom .vbox{max-height:420px;overflow:auto}
.ael #c-cp-bom .bad{color:#D0312D;font-weight:600}.ael #c-cp-bom .ok{color:#0B6E4F;font-weight:600}
.ael #c-cp-bom .two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.35fr);gap:18px}
@media (max-width:900px){.ael #c-cp-bom .two{grid-template-columns:1fr}}`;
  document.head.appendChild(css);
  let sk = 'vv', sd = -1;
  function ensure() {
    const grid = document.querySelector('#cost .grid'); if (!grid || document.getElementById('c-cp-bom')) return;
    const card = document.createElement('div'); card.className = 'card wide'; card.id = 'c-cp-bom'; card.hidden = true;
    card.innerHTML = `<h3 title="Standard = output (MB51 101 of the shop's FG codes) x level-1 BOM quantity from SAP CS03. Actual = MB51 261 less 262 of the same components. Both valued at the moving-average price SAP issues at." style="cursor:help">Material against SAP BOM <span class="chip snap" id="cb-asof"></span></h3>
<div class="sbsub" id="cb-sub"></div><div class="ktiles" id="cb-kt"></div>
<div class="two"><div><h4>Standard vs actual material by month (Rs)</h4><div class="chart" id="cb-trend"></div></div>
<div><h4>Material per unit (BOM x moving average)</h4><div class="tbox"><table id="cb-fg"><thead></thead><tbody></tbody></table></div></div></div>
<h4 id="cb-vh">Component usage against BOM</h4><div class="vbox"><table id="cb-var"><thead></thead><tbody></tbody></table></div>`;
    const after = document.getElementById('c-cp-unit'); if (after) after.after(card); else grid.appendChild(card);
  }
  function render(P) {
    ensure(); const card = document.getElementById('c-cp-bom'); if (!card) return;
    const db = window.dash && dash.data('sap_bom'), dc = window.dash && dash.data('sap_bom_cost');
    if (!db || !dc || db.status !== 'ok' || dc.status !== 'ok') { card.hidden = true; return; } card.hidden = false;
    const B = obj(Array.isArray(db.data) ? db.data[0] : db.data) || {}, K = obj(Array.isArray(dc.data) ? dc.data[0] : dc.data) || {};
    /* 13 Nov 21:13 (Umair): one card per Shop filter (Clutch, Ignition Coil); with All shops the BOM shops are added together */
    const SH = P.shop && P.shop !== 'All' ? P.shop : '', fgA = obj(B.fgs) || [], shops = [...new Set(fgA.map(f => f.shop || 'Clutch'))];
    if (SH && !shops.includes(SH)) { card.hidden = true; return; }
    const fgs = fgA.filter(f => !SH || (f.shop || 'Clutch') === SH), fgSet = new Set(fgs.map(f => f.fg)), SHL = SH || shops.join(' + ');
    FGN = Object.fromEntries(fgs.map(f => [f.fg, (FGN0[f.fg] || f.part) + (!SH && shops.length > 1 && f.shop !== 'Clutch' ? ' ' + (f.shop === 'Ignition Coil' ? 'coil' : f.shop) : '')]));
    const R = obj(K.rates) || {}, FC = (obj(K.fg_cost) || []).filter(c => fgSet.has(c.fg)), U0 = obj(K.usage) || {}, part = new Map();
    const byShop = U0 && !Object.keys(U0).some(k => /^\d{4}-\d{2}$/.test(k)) ? U0 : { Clutch: U0 }, U = {};
    Object.entries(byShop).filter(([sh]) => !SH || sh === SH).forEach(([, mm]) => Object.entries(mm).forEach(([m, x]) => { const o = U[m] || (U[m] = { units: {}, lines: [] }); Object.assign(o.units, x.units); o.lines.push(...x.lines); }));
    (obj(B.tree) || []).forEach(t => part.set(t.code, t.part));
    const months = Object.keys(U).sort(), M = U[P.month] ? P.month : months[months.length - 1];
    document.getElementById('cb-asof').textContent = 'SAP MB51 to ' + (K.mb51_to || '');
    const pend = new Set(); fgs.forEach(f => (f.pending || []).forEach(c => pend.add(c)));
    document.getElementById('cb-sub').innerHTML = `<b>${ml(M)}${M === months[months.length - 1] ? ' (to date)' : ''}</b> · BOM from SAP CS03 for ${fgSet.size} ${esc(SHL)} finished goods, valued at the <b>moving-average price</b> SAP issues at (MB51 261)` +
      (pend.size ? ` · ${pend.size} sub-assemblies still to be read in CS03 (they sit below level 1, so this card is not affected)` : '') + '';
    const val = (x, i) => x.lines.reduce((s, l) => s + (l[i] || 0) * (l[3] || 0), 0);
    const u = U[M], sv = val(u, 1), av = val(u, 2), units = d3.sum(Object.values(u.units || {}));
    // tiles
    const kt = document.getElementById('cb-kt'); kt.replaceChildren();
    const tile = (l, v, s, col) => { const t = document.createElement('div'); t.className = 'ktile'; t.innerHTML = '<div class="tl"></div><div class="tv"></div><div class="ts"></div>'; t.querySelector('.tl').textContent = l; const e = t.querySelector('.tv'); e.textContent = v; if (col) e.style.color = col; t.querySelector('.ts').textContent = s; kt.appendChild(t); };
    tile(`${SH || 'BOM shops'} output (SAP)`, nf(units), Object.entries(u.units).filter(([, v]) => v).map(([k, v]) => `${FGN[k]} ${nf(v)}`).join(' · '));
    tile('Material as per BOM', 'Rs ' + mk(sv), `Rs ${r2(units ? sv / units : 0)} per unit`);
    tile('Material issued (261)', 'Rs ' + mk(av), `Rs ${r2(units ? av / units : 0)} per unit`);
    tile('Issued over BOM', 'Rs ' + mk(av - sv), sv ? pc(av / sv - 1) + ' of BOM' : '', av - sv > 0.02 * sv ? '#D0312D' : '#0B6E4F');
    // trend
    { const el = document.getElementById('cb-trend'), h = 230, mt = 14, mb = 26, ml_ = 46; el.replaceChildren(); const w = Math.max(300, el.clientWidth || 500);
      const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${w} ${h}`).attr('height', h);
      const D = months.map(m => ({ m, s: val(U[m], 1), a: val(U[m], 2) })), x = d3.scaleBand(months, [ml_, w - 6]).padding(0.25), x1 = d3.scaleBand(['s', 'a'], [0, x.bandwidth()]).padding(0.08);
      const y = d3.scaleLinear([0, d3.max(D, d => Math.max(d.s, d.a)) || 1], [h - mb, mt]).nice();
      y.ticks(4).forEach(t => { svg.append('line').attr('x1', ml_).attr('x2', w - 6).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', '#EEF1F4'); svg.append('text').attr('x', ml_ - 6).attr('y', y(t) + 3.5).attr('text-anchor', 'end').attr('font-size', 10).style('fill', '#5A6670').text(mk(t)); });
      D.forEach(d => { const g = svg.append('g').attr('transform', `translate(${x(d.m)},0)`), on = d.m === M;
        [['s', '#A9B8F5', d.s], ['a', '#1D3FD6', d.a]].forEach(([k, c, v]) => g.append('rect').attr('x', x1(k)).attr('y', y(v)).attr('width', x1.bandwidth()).attr('height', y(0) - y(v)).attr('fill', c).attr('opacity', on ? 1 : 0.55));
        const dv = d.s ? d.a / d.s - 1 : 0; g.append('text').attr('x', x.bandwidth() / 2).attr('y', y(Math.max(d.s, d.a)) - 4).attr('text-anchor', 'middle').attr('font-size', 10).style('fill', dv > 0.02 ? '#D0312D' : '#0B6E4F').style('font-weight', 600).text(pc(dv));
        svg.append('text').attr('x', x(d.m) + x.bandwidth() / 2).attr('y', h - 8).attr('text-anchor', 'middle').attr('font-size', 10.5).style('fill', on ? '#051C2C' : '#5A6670').style('font-weight', on ? 700 : 400).text(ml(d.m) + (d.m === months[months.length - 1] ? '*' : ''));
        svg.append('rect').attr('x', x(d.m)).attr('y', mt).attr('width', x.bandwidth()).attr('height', h - mb - mt).attr('fill', 'transparent').style('cursor', 'pointer')
          .on('mousemove', ev => tip.show(ev, [ml(d.m), `As per BOM: Rs ${nf(Math.round(d.s))}`, `Issued (261): Rs ${nf(Math.round(d.a))}`, `Difference: Rs ${nf(Math.round(d.a - d.s))} (${pc(dv)})`, 'Click to show this month'])).on('mouseleave', tip.hide)
          .on('click', () => { tip.hide(); dash.setParams({ month: d.m }); }); });
      const lg = svg.append('g').attr('transform', `translate(${ml_},4)`); [['As per BOM', '#A9B8F5'], ['Issued (261)', '#1D3FD6']].forEach(([t, c], i) => { lg.append('rect').attr('x', i * 110).attr('y', 0).attr('width', 10).attr('height', 10).attr('fill', c); lg.append('text').attr('x', i * 110 + 14).attr('y', 9).attr('font-size', 10.5).style('fill', '#5A6670').text(t); }); }
    // per-FG material per unit
    { const tb = document.querySelector('#cb-fg tbody'); document.querySelector('#cb-fg thead').innerHTML = '<tr><th>Product</th><th class="n">Rs / unit</th><th class="n">At latest prices</th><th class="n">SAP FG rate</th><th>Biggest items</th></tr>';
      tb.replaceChildren(...FC.map(c => { const f = fgs.find(x => x.fg === c.fg && x.alt === c.alt) || {}, fr = R[c.fg], tr = document.createElement('tr'), dv = c.mat_unit_rcv / c.mat_unit - 1;
        tr.innerHTML = `<td>${FGN[c.fg]}${f.alt_note ? ` <span style="color:#5A6670">· ${esc(f.alt_note.replace(' drive plate', ''))}</span>` : ''}</td><td class="n"><b>${r2(c.mat_unit)}</b></td><td class="n ${Math.abs(dv) > 0.02 ? (dv > 0 ? 'bad' : 'ok') : ''}">${r2(c.mat_unit_rcv)}</td><td class="n">${fr ? r2(fr.rate) : '—'}</td><td style="font-size:11.5px;color:#5A6670">${(c.lines || []).slice(0, 3).map(l => esc((l.part || l.code).slice(0, 24)) + ' ' + d3.format('.0%')((l.v || 0) / c.mat_unit)).join(' · ')}</td>`;
        tr.addEventListener('mousemove', ev => tip.show(ev, [`${FGN[c.fg]} (${c.fg}) · BOM alt ${c.alt}`, ...(c.lines || []).map(l => `${l.code} ${(l.part || '').slice(0, 30)}: ${l.qty_fg} x = Rs ${r2(l.v || 0)}`), `Total at moving average: Rs ${r2(c.mat_unit)}`, `At latest receipt prices: Rs ${r2(c.mat_unit_rcv)} (${pc(dv)})`])); tr.addEventListener('mouseleave', tip.hide); return tr; })); }
    // component variance
    { document.getElementById('cb-vh').textContent = `Component usage against BOM - ${ml(M)}${M === months[months.length - 1] ? ' to date' : ''} (level 1, sorted by Rs over BOM)`;
      const rows = u.lines.map(([c, s, a, r]) => ({ c, p: part.get(c) || '', s, a, r, vq: a - s, vp: s ? a / s - 1 : null, vv: (a - s) * (r || 0) }));
      const cols = [['c', 'Code'], ['p', 'Part'], ['s', 'As per BOM', 1], ['a', 'Issued (261)', 1], ['vq', 'Difference', 1], ['vp', '%', 1], ['r', 'Moving avg Rs', 1], ['vv', 'Rs over BOM', 1]];
      const th = document.querySelector('#cb-var thead'); th.innerHTML = '<tr>' + cols.map(([k, l, n]) => `<th data-k="${k}" class="${n ? 'n' : ''}">${l}${sk === k ? (sd > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('') + '</tr>';
      th.querySelectorAll('th').forEach(t => t.onclick = () => { const k = t.dataset.k; sd = sk === k ? -sd : -1; sk = k; render(window.__P ? window.__P() : P); });
      rows.sort((x, y) => { const a = x[sk], b = y[sk]; return (typeof a === 'number' || typeof b === 'number' ? ((a ?? -1e18) - (b ?? -1e18)) : String(a).localeCompare(String(b))) * sd; });
      document.querySelector('#cb-var tbody').replaceChildren(...rows.map(o => { const tr = document.createElement('tr'), big = o.vp != null && Math.abs(o.vp) > 0.05;
        tr.innerHTML = `<td>${o.c}</td><td>${esc(o.p)}</td><td class="n">${nf(Math.round(o.s))}</td><td class="n">${nf(Math.round(o.a))}</td><td class="n">${nf(Math.round(o.vq))}</td><td class="n ${big ? (o.vp > 0 ? 'bad' : 'ok') : ''}">${o.vp == null ? '—' : pc(o.vp)}</td><td class="n">${o.r == null ? '—' : r2(o.r)}</td><td class="n ${o.vv > 0 && big ? 'bad' : ''}">${nf(Math.round(o.vv))}</td>`;
        tr.addEventListener('mousemove', ev => tip.show(ev, [o.p, o.c, `As per BOM: ${nf(Math.round(o.s))} (output x BOM qty)`, `Issued to production orders (261 less 262): ${nf(Math.round(o.a))}`, ...(o.vp > 0.05 ? ['Over BOM: issued ahead of output, scrap, or also used in SPD clutch assemblies not yet in this BOM'] : o.vp < -0.05 ? ['Under BOM: output made from stock issued in an earlier month'] : [])])); tr.addEventListener('mouseleave', tip.hide); return tr; })); }
  }
  window.__cbRender = render;
  const d0 = window.__draw; if (d0) window.__draw = (...a) => { const r = d0(...a); if (window.__page === 'cost') { try { render(window.__P ? window.__P() : {}); } catch (e) { console.error(e); } } return r; };
  try { if (window.__page === 'cost' && window.__P) render(window.__P()); } catch (e) {}
})();
