/* Cost of Production tab (Umair, 11 Nov 2026). COGM = Direct material + Indirect material + Direct labour + Utilities.
   Dataset cogm (tools/cogm_build.py):
     Direct material   SAP MB51 261 less 262 of purchased materials (parts made in-house left out, so nothing is counted twice)
     Indirect material SAP 201/202 cost-centre issues: Tools, Consumables, Spares, Lubricants
     Direct labour     attendance workbook per person: Rs 42,500 a month, day = 42,500 / 26, hour = day / 8;
                       wages = 42,500 x (working days so far / 26) less absent days x day rate; overtime = OT hours x hour rate x 1.5
     Utilities         electricity: MWh per shop (utilities sheet) x Rs 32/kWh; a month not on the sheet yet is estimated from the last one
   Follows the Month and Shop filters. */
(() => {
  const AK = window.AK; if (!AK) return;
  const { C, tip, box, empty } = AK;
  const nf = d3.format(','), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = m => MN[+m.slice(5, 7) - 1] + '-' + m.slice(2, 4);
  const pm = v => v == null ? '—' : Math.abs(v) >= 1e6 ? d3.format(',.1f')(v / 1e6) + ' M' : Math.abs(v) >= 1e3 ? d3.format(',.0f')(v / 1e3) + ' k' : nf(Math.round(v));
  const EL = [['Direct material', '#051C2C'], ['Indirect material', '#2251FF'], ['Direct labour', '#00A9F4'], ['Utilities', '#B9C1C9']];
  const COL = Object.fromEntries(EL);
  const ORDER = ['Clutch', 'Drum Gear', 'Ignition Coil', 'Hubs', 'Carb Child Parts', 'Machining', 'Carburetor', 'CIF Machining', 'Cast Iron Machining', 'Bridge Fork Top', 'HPDC / Die Cast', 'Aluminium Foundry', 'Piston', 'Polymer', 'Cushion'];
  const css = document.createElement('style'); css.textContent = `
.ael #cost .cpk{display:flex;flex-wrap:wrap;gap:10px 22px;margin:2px 0 4px}
.ael #cost .cpk .t{border-left:3px solid #051C2C;padding:2px 0 2px 10px;min-width:150px}
.ael #cost .cpk .l{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#5B6770}
.ael #cost .cpk .v{font-family:var(--font-anthropic-serif);font-size:22px;color:#051C2C;font-variant-numeric:tabular-nums;line-height:1.25}
.ael #cost .cpk .v .p{font-family:var(--font-anthropic-sans);font-size:13px;color:#5B6770}
.ael #cost .cpk .d{font-size:11.5px;color:#5B6770}
.ael #cost .cplg{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:11.5px;color:#5A6670;margin:2px 0 6px}
.ael #cost .cplg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
.ael #cost .cpnote{font-size:11.5px;color:#5B6770;margin-top:6px;line-height:1.45}
.ael #cost table.cpt{width:100%;border-collapse:collapse;font-size:12.5px;font-variant-numeric:tabular-nums}
.ael #cost table.cpt th{font-weight:600;color:#5B6770;text-align:right;padding:6px 8px;border-bottom:1px solid #D5DBE1;white-space:nowrap;font-size:11.5px}
.ael #cost table.cpt th:first-child,.ael #cost table.cpt td:first-child{text-align:left}
.ael #cost table.cpt td{text-align:right;padding:6px 8px;border-bottom:1px solid #EEF1F4;white-space:nowrap}
.ael #cost table.cpt tr.tot td{font-weight:700;border-top:1px solid #051C2C;border-bottom:0}
.ael #cost table.cpt tr.sel td{background:#EEF1F4}
.ael #cost .smpc{color:#8A949E;font-style:italic}`;
  document.head.appendChild(css);
  const data = () => { const d = window.dash && dash.data('cogm'); return d && d.status === 'ok' ? (Array.isArray(d.data) ? d.data : []) : d && d.status === 'error' ? 'err' : null; };
  const leg = () => `<div class="cplg">${EL.map(([n, c]) => `<span><i style="background:${c}"></i>${n}${n === 'Utilities' ? ' (electricity & gas)' : ''}</span>`).join('')}</div>`;

  function render(P) {
    const sec = document.getElementById('cost'); if (!sec) return;
    const R = data(), K = document.getElementById('cp-kpi');
    if (!K) return;
    if (R === 'err') { ['cp-kpi', 'cp-shop', 'cp-trend', 'cp-tab', 'cp-lab'].forEach(id => empty(document.getElementById(id), '● Failed to load')); return; }
    if (!R) return;
    const SH = P.shop && P.shop !== 'All' ? P.shop : '';
    const months = [...new Set(R.map(r => r.month))].sort(), m = months.includes(P.month) ? P.month : months[months.length - 1];
    const cur = R.filter(r => r.month === m && r.element !== 'Labour detail' && (!SH || r.shop === SH));
    const asof = (R.find(r => r.asof) || {}).asof || '';
    const partial = m === asof.slice(0, 7);
    const tot = e => d3.sum(cur.filter(r => !e || r.element === e), r => r.value_pkr);
    const T = tot();
    // KPI tiles
    const lab = R.filter(r => r.month === m && r.element === 'Labour detail' && (!SH || r.shop === SH));
    const ppl = d3.sum(lab, r => r.people);
    K.innerHTML = `<div class="cpk">
      <div class="t"><div class="l">Cost of production</div><div class="v">${pm(T)} <span class="p">PKR · ${mon(m)}${partial ? ' to ' + (+asof.slice(8)) + ' ' + MN[+asof.slice(5, 7) - 1] : ''}</span></div><div class="d">${SH ? esc(SH) : 'All shops'}</div></div>
      ${EL.map(([e, c]) => { const v = tot(e); return `<div class="t" style="border-left-color:${c}"><div class="l">${e}</div><div class="v">${pm(v)} <span class="p">${T ? Math.round(100 * v / T) : 0}%</span></div><div class="d">${e === 'Direct labour' ? (ppl ? nf(ppl) + ' people' : 'no attendance for this month') : e === 'Utilities' ? (cur.some(r => r.element === 'Utilities' && r.estimate) ? 'electricity & gas · estimated' : 'electricity & gas · ' + d3.format(',.0f')(d3.sum(cur.filter(r => r.element === 'Utilities'), r => r.mwh || 0)) + ' MWh') : e === 'Direct material' ? 'purchased material to production' : 'tools, consumables, spares, lubes'}</div></div>`; }).join('')}
    </div>`;
    // by shop (stacked horizontal)
    const es = document.getElementById('cp-shop');
    const byS = d3.rollup(cur, v => Object.fromEntries(EL.map(([e]) => [e, d3.sum(v.filter(r => r.element === e), r => r.value_pkr)])), r => r.shop);
    const shops = [...byS.keys()].sort((a, b) => { const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b); });
    document.getElementById('cp-shop-lg').innerHTML = leg();
    if (!shops.length) empty(es, 'No cost data for this month'); else {
      const rh = 26, mt = 4, lw = 150, h = shops.length * rh + mt + 22; const { svg, w } = box(es, h);
      const mx = d3.max(shops, s => d3.sum(EL, ([e]) => Math.max(0, byS.get(s)[e]))) || 1; const x = d3.scaleLinear().domain([0, mx]).range([0, w - lw - 70]);
      shops.forEach((s, i) => { const o = byS.get(s), y = mt + i * rh; let x0 = lw;
        svg.append('text').attr('x', lw - 8).attr('y', y + rh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11.5).attr('fill', C.navy).text(s);
        EL.forEach(([e, c]) => { const v = Math.max(0, o[e]); if (!v) return; const ww = x(v);
          svg.append('rect').attr('x', x0).attr('y', y + 5).attr('width', Math.max(0.5, ww)).attr('height', rh - 10).attr('fill', c)
            .on('mousemove', ev => tip.show(ev, [s, `${e}: ${pm(v)} PKR`, ...(e === 'Utilities' ? [`Electricity ${d3.format(',.1f')(d3.sum(cur.filter(r => r.shop === s && r.element === e), r => r.mwh || 0))} MWh x Rs 32/kWh${cur.some(r => r.shop === s && r.element === e && r.estimate) ? ' (estimate)' : ''}`] : []), `Shop total: ${pm(d3.sum(EL, ([k]) => o[k]))} PKR`])).on('mouseleave', tip.hide); x0 += ww; });
        svg.append('text').attr('x', x0 + 6).attr('y', y + rh / 2 + 4).attr('font-size', 11).attr('fill', '#5B6770').text(pm(d3.sum(EL, ([k]) => o[k]))); });
      svg.append('line').attr('x1', lw).attr('x2', lw).attr('y1', mt).attr('y2', mt + shops.length * rh).attr('stroke', C.navy);
    }
    // monthly trend (stacked columns)
    const et = document.getElementById('cp-trend'); document.getElementById('cp-trend-lg').innerHTML = leg();
    const byM = months.map(mm => { const v = R.filter(r => r.month === mm && r.element !== 'Labour detail' && (!SH || r.shop === SH)); return { m: mm, ...Object.fromEntries(EL.map(([e]) => [e, d3.sum(v.filter(r => r.element === e), r => r.value_pkr)])) }; });
    { const h = 240, mb = 34, mt = 18; const { svg, w } = box(et, h); const x = d3.scaleBand().domain(months).range([44, w - 8]).padding(0.32);
      const mx = d3.max(byM, o => d3.sum(EL, ([e]) => Math.max(0, o[e]))) || 1; const y = d3.scaleLinear().domain([0, mx * 1.08]).range([h - mb, mt]);
      y.ticks(4).forEach(t => { svg.append('line').attr('x1', 44).attr('x2', w - 8).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', '#EEF1F4');
        svg.append('text').attr('x', 38).attr('y', y(t) + 4).attr('text-anchor', 'end').attr('font-size', 10.5).attr('fill', '#5B6770').text(t ? d3.format(',.0f')(t / 1e6) + 'M' : '0'); });
      byM.forEach(o => { let y0 = y(0); const tt = d3.sum(EL, ([e]) => Math.max(0, o[e]));
        EL.forEach(([e, c]) => { const v = Math.max(0, o[e]); if (!v) return; const hh = y(0) - y(v); y0 -= hh;
          svg.append('rect').attr('x', x(o.m)).attr('y', y0).attr('width', x.bandwidth()).attr('height', Math.max(0.5, hh)).attr('fill', c).attr('opacity', o.m === m ? 1 : 0.55)
            .on('mousemove', ev => tip.show(ev, [mon(o.m) + (o.m === asof.slice(0, 7) ? ' (month to date)' : ''), `${e}: ${pm(v)} PKR${e === 'Utilities' && R.some(r => r.month === o.m && r.element === 'Utilities' && r.estimate) ? ' (estimate)' : ''}`, `Total: ${pm(tt)} PKR`, ...(e === 'Direct labour' || o['Direct labour'] ? [] : ['No attendance data for this month'])])).on('mouseleave', tip.hide); });
        svg.append('text').attr('x', x(o.m) + x.bandwidth() / 2).attr('y', y(tt) - 5).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', C.navy).attr('font-weight', o.m === m ? 700 : 400).text(pm(tt));
        svg.append('text').attr('x', x(o.m) + x.bandwidth() / 2).attr('y', h - mb + 16).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', '#5B6770').text(mon(o.m) + (o.m === asof.slice(0, 7) ? '*' : '')); });
      svg.append('line').attr('x1', 44).attr('x2', w - 8).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', C.navy); }
    // table by shop
    const tb = document.getElementById('cp-tab'); const sub = (s, e, k) => d3.sum(cur.filter(r => r.shop === s && r.element === e && (!k || r.sub === k)), r => r.value_pkr);
    const cols = [['Direct material', 'Direct material'], ['Tools', 'Indirect material', 'Tools'], ['Consumables', 'Indirect material', 'Consumables'], ['Spares', 'Indirect material', 'Spares'], ['Lubricants', 'Indirect material', 'Lubricants'],
      ['Wages', 'Direct labour', 'Wages'], ['Overtime', 'Direct labour', 'Overtime'], ['Electricity', 'Utilities', 'Electricity'], ['Gas', 'Utilities', 'Gas']];
    const allS = [...new Set(R.filter(r => r.month === m && r.element !== 'Labour detail').map(r => r.shop))].filter(s => !SH || s === SH)
      .sort((a, b) => { const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b); });
    const row = s => { const v = cols.map(([, e, k]) => sub(s, e, k)), t = d3.sum(v); return `<tr><td>${esc(s)}</td>${v.map((x, i) => `<td${i >= 7 && cur.some(r => r.element === 'Utilities' && r.estimate) ? ' class="smpc"' : ''}>${x ? pm(x) : '—'}</td>`).join('')}<td><b>${pm(t)}</b></td><td>${T ? (100 * t / T).toFixed(1) + '%' : '—'}</td></tr>`; };
    const totV = cols.map(([, e, k]) => d3.sum(cur.filter(r => r.element === e && (!k || r.sub === k)), r => r.value_pkr));
    tb.innerHTML = `<table class="cpt"><thead><tr><th>Shop</th>${cols.map(([n]) => `<th>${n}</th>`).join('')}<th>COGM</th><th>Share</th></tr></thead><tbody>${allS.map(row).join('')}
      <tr class="tot"><td>Total</td>${totV.map(v => `<td>${pm(v)}</td>`).join('')}<td>${pm(T)}</td><td>100%</td></tr></tbody></table>`;
    unit(R, m, SH, cur, partial);
    // labour detail
    const tl = document.getElementById('cp-lab'), L0 = lab[0];
    if (!lab.length) tl.innerHTML = '<p class="cpnote">No attendance data for this month (the attendance workbook starts in October 2026).</p>'; else {
      const ls = lab.slice().sort((a, b) => { const ia = ORDER.indexOf(a.shop), ib = ORDER.indexOf(b.shop); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
      const lrow = r => { const wg = r.wages_pkr || 0, ot = r.ot_pkr || 0;
        return `<tr><td>${esc(r.shop)}</td><td>${nf(r.people)}</td><td>${pm(r.people * r.wage * (partial ? 1 : 1))}</td><td>${d3.format(',.1f')(r.absent_days)}</td><td>${pm(r.absent_pkr)}</td><td>${pm(wg)}</td><td>${d3.format(',.0f')(r.ot_hours)}</td><td>${pm(ot)}</td><td><b>${pm(wg + ot)}</b></td><td>${r.people ? nf(Math.round((wg + ot) / r.people)) : '—'}</td></tr>`; };
      const s = k => d3.sum(lab, r => r[k]), sw = d3.sum(lab, r => r.wages_pkr || 0), so = d3.sum(lab, r => r.ot_pkr || 0);
      tl.innerHTML = `<table class="cpt"><thead><tr><th>Shop</th><th>People</th><th>Full-month wages</th><th>Absent days</th><th>Absent deduction</th><th>Wages ${partial ? 'to date' : ''}</th><th>OT hours</th><th>OT cost (1.5×)</th><th>Labour cost</th><th>Per person</th></tr></thead><tbody>${ls.map(lrow).join('')}
        <tr class="tot"><td>Total</td><td>${nf(s('people'))}</td><td>${pm(s('people') * L0.wage)}</td><td>${d3.format(',.1f')(s('absent_days'))}</td><td>${pm(s('absent_pkr'))}</td><td>${pm(sw)}</td><td>${d3.format(',.0f')(s('ot_hours'))}</td><td>${pm(so)}</td><td>${pm(sw + so)}</td><td>${s('people') ? nf(Math.round((sw + so) / s('people'))) : '—'}</td></tr></tbody></table>
        <p class="cpnote">Rs ${nf(L0.wage)} a month per person · day rate Rs ${d3.format(',.2f')(L0.day_rate)} (÷ 26) · hour rate Rs ${d3.format(',.2f')(L0.hour_rate)} (÷ 8) · overtime at 1.5× the hour rate.${partial ? ` ${mon(m)} wages are counted for the working days so far (Sundays left out), less absent days.` : ''}</p>`;
    }
  }
  /* 11 Nov 19:08 (Umair): finished-product level. Each shop's cost element / the shop's actual production volume (finished
     products; in-house parts for a shop that makes no finished product) = Rs per unit; every finished product of the shop
     carries those rates (volume-based allocation). */
  let pq = '';
  function unit(R, m, SH, cur, partial) {
    const tu = document.getElementById('cp-unit'), tp = document.getElementById('cp-prod'); if (!tu || !tp) return;
    const V = new Map(R.filter(r => r.month === m && r.element === 'Volume').map(r => [r.shop, r]));
    const cols = [['Direct material', 'Direct material'], ['Tools', 'Indirect material', 'Tools'], ['Consumables', 'Indirect material', 'Consumables'], ['Spares', 'Indirect material', 'Spares'],
      ['Lubricants', 'Indirect material', 'Lubricants'], ['Labour', 'Direct labour'], ['Electricity', 'Utilities', 'Electricity'], ['Gas', 'Utilities', 'Gas']];
    const val = (s, e, k) => d3.sum(cur.filter(r => r.shop === s && r.element === e && !r.spd && (!k || r.sub === k)), r => r.value_pkr);   /* OEM only: SPD's material share is shown in its own table */
    const rs = v => v == null || !isFinite(v) ? '—' : v >= 100 ? d3.format(',.0f')(v) : d3.format(',.1f')(v);
    const shops = [...new Set(cur.map(r => r.shop))].filter(s => !SH || s === SH).sort((a, b) => { const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b); });
    const rate = {};
    const row = s => { const v = V.get(s), u = v && v.units; const per = cols.map(([, e, k]) => u ? val(s, e, k) / u : null), t = u ? d3.sum(per) : null; if (u) rate[s] = { per, t };
      return `<tr><td>${esc(s)}</td><td>${u ? nf(u) : '—'}</td><td style="text-align:left;color:#5B6770">${v ? (v.basis === 'Finished' ? 'finished' : v.basis === 'sets' ? 'sets (FF + RC)' : 'in-house parts') : 'no Atlas production'}</td>${per.map(x => `<td>${rs(x)}</td>`).join('')}<td><b>${rs(t)}</b></td></tr>`; };
    tu.innerHTML = `<table class="cpt"><thead><tr><th>Shop</th><th>Units produced</th><th style="text-align:left">Volume basis</th>${cols.map(([n]) => `<th>${n}</th>`).join('')}<th>COGM Rs/unit</th></tr></thead><tbody>${shops.map(row).join('')}</tbody></table>
      <p class="cpnote">Rs per unit = each cost element of the shop ÷ the shop's actual production${partial ? ' to date' : ''} (Atlas). CIF = Sleeve CG (in-house), Cylinder Pridor, Drive Plate casting and Boss Clutch Center Pridor casting (SAP production). Cushion = Front Forks and Rear Cushions in motorcycle sets. Aluminium Foundry cost is shared to Bridge Fork Top and Piston by their production. Zinc (ZDC) is under Carburetor. ${cur.some(r => r.spd) ? 'SPD parts made in-house take their share of direct and indirect material (by SAP standard cost of SPD vs OEM production), so these rates are for OEM products only. ' : ''}Electricity ${cur.some(r => r.element === 'Utilities' && r.estimate) ? 'is estimated for this month' : 'from the utilities sheet at Rs 32/kWh'}.</p>`;
    const P = R.filter(r => r.month === m && r.element === 'Product' && (!SH || r.shop === SH) && rate[r.shop]);
    const qq = pq.trim().toLowerCase(), list = P.filter(r => !qq || (r.code + ' ' + r.part + ' ' + r.model + ' ' + r.shop).toLowerCase().includes(qq))
      .sort((a, b) => { const ia = ORDER.indexOf(a.shop), ib = ORDER.indexOf(b.shop); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || b.units - a.units; });
    tp.innerHTML = `<input class="q" id="cp-pq" placeholder="Search product, code, model or shop" aria-label="Search products" value="${esc(pq)}" style="margin-bottom:8px">
      <table class="cpt"><thead><tr><th>Product</th><th>Code</th><th>Shop</th><th>Units produced</th>${cols.map(([n]) => `<th>${n}</th>`).join('')}<th>COGM Rs/unit</th><th>Total cost</th></tr></thead><tbody>
      ${list.map(r => { const k = rate[r.shop]; return `<tr><td>${esc(r.part || r.code)}${r.model ? ` <span style="color:#5B6770">· ${esc(r.model)}</span>` : ''}</td><td>${esc(r.code)}</td><td style="text-align:left">${esc(r.shop)}</td><td>${nf(r.units)}</td>${k.per.map(x => `<td>${rs(x)}</td>`).join('')}<td><b>${rs(k.t)}</b></td><td>${pm(k.t * r.units)}</td></tr>`; }).join('') || '<tr><td colspan="13">No finished production for this selection</td></tr>'}</tbody></table>${spdT(R, m, SH, V, qq, rs)}`;
    const qi = document.getElementById('cp-pq'); if (qi) qi.oninput = () => { pq = qi.value; const pos = qi.selectionStart; unit(R, m, SH, cur, partial); const n = document.getElementById('cp-pq'); n.focus(); n.setSelectionRange(pos, pos); };
  }
  /* 11 Nov 22:24 (Umair): SPD parts made in-house carry their own share of the shop's material; OEM rates exclude it */
  function spdT(R, m, SH, V, qq, rs) {
    const L = R.filter(r => r.month === m && r.element === 'SPD product' && (!SH || r.shop === SH) && (!qq || (r.code + ' ' + r.part + ' ' + r.shop).toLowerCase().includes(qq)))
      .sort((a, b) => { const ia = ORDER.indexOf(a.shop), ib = ORDER.indexOf(b.shop); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || b.material_pkr - a.material_pkr; });
    if (!L.length) return '';
    const sh = [...new Set(L.map(r => r.shop))].map(s => { const v = V.get(s) || {}; return `${esc(s)} ${v.spd_share != null ? (100 * v.spd_share).toFixed(1) + '%' : ''}`; }).join(' · ');
    return `<h4 style="margin:16px 0 6px;font-size:13px">SPD parts made in-house: material allocated</h4>
      <table class="cpt"><thead><tr><th>SPD part</th><th>Code</th><th>Shop</th><th>Units produced</th><th>SAP std Rs/unit</th><th>Material Rs/unit</th><th>Material allocated</th></tr></thead><tbody>
      ${L.map(r => `<tr><td>${esc(r.part || r.code)}</td><td>${esc(r.code)}</td><td style="text-align:left">${esc(r.shop)}</td><td>${nf(r.units)}</td><td>${rs(r.std_unit)}</td><td><b>${rs(r.material_unit)}</b></td><td>${pm(r.material_pkr)}</td></tr>`).join('')}
      <tr><td><b>Total</b></td><td></td><td></td><td><b>${nf(d3.sum(L, r => r.units))}</b></td><td></td><td></td><td><b>${pm(d3.sum(L, r => r.material_pkr))}</b></td></tr></tbody></table>
      <p class="cpnote">Each shop's SPD share of direct + indirect material = SPD production at SAP standard cost ÷ (OEM finished + SPD production at standard): ${sh}. Within a shop it is split across SPD parts by their standard value. Labour and utilities stay on OEM products. SPD from vendors (no in-house production) is not included.</p>`;
  }
  window.__costRender = render;
  const d0 = window.__draw; if (d0) window.__draw = (...a) => { const r = d0(...a); if (window.__page === 'cost') { try { render(window.__P()); } catch (e) { console.error(e); } } return r; };
  try { if (window.__page === 'cost' && window.__P) render(window.__P()); } catch (e) {}
})();
