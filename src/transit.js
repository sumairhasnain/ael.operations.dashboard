/* In-Transit Quantities - By Shop (Production tab; Umair, 4 Nov 2026).
   Production the casting and press shops posted in SAP (101 into their own storage location) that the main store has not
   yet received (315), net of what the shop issued straight to production orders from its own location (261/262) and of
   what went to the dispatch store 0008 for SPD / direct sale. For Clutch Press only 0003 counts as the store (Umair, 4 Nov).
   Dataset sap_transit (tools/sap_transit.py from the daily MB51 file). The card shows only when the Shop filter - picked
   in the filter bar or by clicking a shop on a chart - is HPDC / Die Cast, CIF Machining, Piston or Bridge Fork Top
   (Aluminium Foundry casts both) or Clutch (Clutch Press). Red: more than half a day of that part's output; yellow: less. */
(() => {
  const AK = window.AK; if (!AK) return;
  const { C, tip, box, empty } = AK;
  const nf = d3.format(','), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SHOW = { 'HPDC / Die Cast': ['HPDC / Die Cast'], 'CIF Machining': ['CIF Casting'], 'Piston': ['Aluminium Foundry'], 'Bridge Fork Top': ['Aluminium Foundry'], 'Clutch': ['Clutch Press'] };
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dmy = s => s ? `${+s.slice(8)} ${MN[+s.slice(5, 7) - 1]}` : '—';
  const css = document.createElement('style'); css.textContent = `
.ael #c-p-transit .trsub{font-size:12px;color:var(--mut);margin:-4px 0 8px;line-height:1.4}
.ael #c-p-transit .trsub b{color:var(--navy);font-weight:600}
.ael #c-p-transit .trsw{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:-1px;margin:0 4px 0 6px}
.ael #c-p-transit .chart{max-height:420px;overflow:auto}`;
  document.head.appendChild(css);
  function ensure() {
    const grid = document.querySelector('#production .grid'); if (!grid || document.getElementById('c-p-transit')) return;
    const card = document.createElement('div'); card.className = 'card wide'; card.id = 'c-p-transit'; card.hidden = true;
    card.innerHTML = `<h3>In-Transit Quantities - By Shop</h3><div class="trsub" id="tr-sub"></div><div class="chart" id="tr-chart"></div>`;
    const after = document.getElementById('c-p-daily'); if (after) after.after(card); else grid.appendChild(card);
  }
  function render(P) {
    ensure(); const card = document.getElementById('c-p-transit'); if (!card) return;
    const shops = SHOW[P.shop]; if (!shops) { card.hidden = true; return; }
    card.hidden = false; const el = document.getElementById('tr-chart'), sub = document.getElementById('tr-sub');
    const d = window.dash && dash.data('sap_transit');
    if (!d || d.status !== 'ok') { sub.textContent = ''; if (d && d.status === 'error') empty(el, '● Failed to load'); else el.replaceChildren(); return; }
    const T = Array.isArray(d.data) ? d.data[0] : d.data; const M = (T && T.months) || {};
    const m = M[P.month] ? P.month : Object.keys(M).sort().pop();
    if (!m) { sub.textContent = ''; empty(el, 'No SAP MB51 movements loaded yet'); return; }
    const mo = M[m]; const items = (mo.items || []).filter(i => shops.includes(i.shop) && i.in_transit > 0).sort((a, b) => b.in_transit - a.in_transit);
    const tot = d3.sum(items, i => i.in_transit), red = items.filter(i => i.flag === 'red').length;
    const wd = shops.map(s => (mo.working_days || {})[s] || 0).reduce((a, b) => Math.max(a, b), 0);
    sub.innerHTML = `<b>${esc(shops.join(' + '))}</b> · ${MN[+m.slice(5, 7) - 1]} ${m.slice(0, 4)} to ${dmy(mo.to)} · production the shop posted in SAP (101) that the store has not yet received (315), net of parts the shop issued straight to production orders from its own location and of parts sent to the dispatch store for SPD / direct sale. ${P.shop === 'Clutch' ? 'Only main store 0003 counts as received for the press. ' : ''}` +
      `<i class="trsw" style="background:${C.bad}"></i>more than half a day of that part's output (${wd} working day${wd === 1 ? '' : 's'} so far) <i class="trsw" style="background:${C.warn}"></i>less than half a day · ` +
      (items.length ? `<b>${nf(tot)}</b> units in transit on ${items.length} part${items.length === 1 ? '' : 's'}, <b>${red}</b> red` : 'nothing in transit');
    if (!items.length) { empty(el, 'Nothing posted ahead of store receipt for this shop'); return; }
    const rh = 38, mt = 6, h = items.length * rh + mt + 6; const { svg, w } = box(el, h);
    const lab = i => (i.part || i.code).length > 36 ? (i.part || i.code).slice(0, 35) + '…' : (i.part || i.code);
    const lw = Math.min(Math.max(...items.map(i => lab(i).length)) * 6.6 + 14, w * .42);
    const mx = d3.max(items, i => Math.max(i.in_transit, i.half_day)) || 1, x = d3.scaleLinear([0, mx], [lw, w - 70]);
    items.forEach((i, k) => { const y0 = mt + k * rh, g = svg.append('g'), col = i.flag === 'red' ? C.bad : C.warn;
      g.append('text').attr('x', 0).attr('y', y0 + rh / 2 - 2).attr('font-size', 12).style('fill', C.navy).style('font-weight', 600).text(lab(i));
      g.append('text').attr('x', 0).attr('y', y0 + rh / 2 + 12).attr('font-size', 10.5).style('fill', '#5A6670').text(`${i.code} · posted ${nf(i.posted)} · received ${nf(i.received)}${i.direct ? ' · direct ' + nf(i.direct) : ''}${i.spd ? ' · SPD/dispatch ' + nf(i.spd) : ''}`);
      g.append('rect').attr('x', lw).attr('y', y0 + 8).attr('width', Math.max(1, x(i.in_transit) - lw)).attr('height', rh - 16).attr('fill', col);
      g.append('line').attr('x1', x(i.half_day)).attr('x2', x(i.half_day)).attr('y1', y0 + 4).attr('y2', y0 + rh - 4).attr('stroke', C.navy).attr('stroke-width', 1.5).attr('stroke-dasharray', '3 2');
      g.append('text').attr('x', x(i.in_transit) + 6).attr('y', y0 + rh / 2 + 4).attr('font-size', 12).style('fill', col).style('font-weight', 700).text(nf(i.in_transit));
      g.append('rect').attr('x', 0).attr('y', y0).attr('width', w).attr('height', rh).attr('fill', 'transparent')
        .on('mousemove', ev => tip.show(ev, [i.part || i.code, `${i.code} · ${i.shop}`, `Posted by the shop (101): ${nf(i.posted)}`, `Received by the store (315): ${nf(i.received)}`, i.direct ? `Issued straight from the shop location (261): ${nf(i.direct)}` : 'No direct issues from the shop location', i.spd ? `Sent to the dispatch store 0008 for SPD / sale: ${nf(i.spd)}` : 'Nothing sent to the dispatch store', `In transit: ${nf(i.in_transit)} (${i.flag === 'red' ? 'more' : 'less'} than half a day's output, ${nf(i.half_day)})`, `Last posted ${dmy(i.last_posted)} · last received by store ${dmy(i.last_received)}`])).on('mouseleave', tip.hide); });
    svg.append('line').attr('x1', lw).attr('x2', lw).attr('y1', mt).attr('y2', h).attr('stroke', C.navy);
    const sv = el.querySelector('svg'); if (sv) sv.setAttribute('preserveAspectRatio', 'xMinYMin meet');
  }
  const d0 = window.__draw; if (d0) window.__draw = (...a) => { const r = d0(...a); if (window.__page === 'production') { try { render(window.__P()); } catch (e) {} } return r; };
  try { if (window.__page === 'production' && window.__P) render(window.__P()); } catch (e) {}
})();
