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
  const EL = [['Direct material', '#CFDAE5'], ['Indirect material', '#1D3FD6'], ['Direct labour', '#C2410C'], ['Utilities', '#0B6E4F']];   // 12 Nov (Umair): light material, dark high-contrast others
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

  /* 13 Nov 15:55 (Umair): direct material per finished product follows its SAP BOM (sap_bom_cost: level-1 parts at the
     moving-average MB51 261 rate). The shop's actual OEM direct material is kept as the total and shared across products in
     proportion to units x BOM material per unit; CD70's three BOM alternatives are weighted by that month's drive-plate issues.
     Products with no SAP BOM yet keep the shop average. Indirect material, labour and utilities stay at the shop average. */
  const bomOf = () => { const d = window.dash && dash.data('sap_bom_cost'); if (!d || d.status !== 'ok') return null; let k = Array.isArray(d.data) ? d.data[0] : d.data; if (typeof k === 'string') { try { k = JSON.parse(k); } catch (e) { return null; } } return k; };
  function bomMat(code, m) {
    const K = bomOf(); if (!K) return null; const fc = (typeof K.fg_cost === 'string' ? JSON.parse(K.fg_cost) : K.fg_cost || []).filter(x => x.fg === code); if (!fc.length) return null;
    const U = typeof K.usage === 'string' ? JSON.parse(K.usage) : K.usage || {}, w = (U[m] || {}).alt_w;
    if (fc.length === 1 || !w) return (fc.find(x => x.alt === '1') || fc[0]).mat_unit;
    const tw = d3.sum(fc, x => w[x.alt] || 0); return tw ? d3.sum(fc, x => x.mat_unit * (w[x.alt] || 0)) / tw : fc[0].mat_unit;
  }
  /* returns Map code -> direct material Rs/unit for the shop's OEM products, or null when no product has a BOM */
  function dmSplit(prods, dmTotal, m) {
    const W = prods.map(r => ({ r, b: bomMat(r.code, m) })); if (!W.some(x => x.b)) return null;
    const avg = d3.sum(W.filter(x => x.b), x => x.b * x.r.units) / (d3.sum(W.filter(x => x.b), x => x.r.units) || 1);
    W.forEach(x => { x.w = x.b || avg; }); const den = d3.sum(W, x => x.w * x.r.units); if (!den) return null;
    return new Map(W.map(x => [x.r.code, { dm: dmTotal * x.w / den, bom: x.b }]));
  }
  /* 13 Nov 16:37 (Umair): the iceberg drawing is shared by 'COGM per Unit by Shop / OEM Product' and 'COGM by Month'. */
  function ice(es, G, o) {
      const h = o.h || 460, mt = 34, mb = 40, ml = 56, CV = EL.filter(([e]) => e !== 'Direct material'), MC = EL.find(([e]) => e === 'Direct material')[1];
      const bx = box(es, h), svg = bx.svg, w = bx.w - 50; es.style.position = 'relative'; svg.attr('viewBox', `0 0 ${w} ${h}`).attr('width', 'calc(100% - 50px)').style('margin-left', '50px').style('overflow', 'visible');
      const wl = Math.round(mt + 0.5 * (h - mb - mt)), bot = h - mb - 16, f0 = d3.format(',.0f'), rsu = o.f, cvOf = g => d3.sum(CV, ([e]) => Math.max(0, g.v[e] || 0));
      const yu = d3.scaleLinear().domain([0, d3.max(G, cvOf) || 1]).range([wl, mt + 12]).nice();
      const mAuto = d3.max(G, g => Math.max(0, g.v['Direct material'] || 0)) || 1, skey = o.skey, YM = window.__ymax || (window.__ymax = {});
      const mOver = YM[skey] > 0 ? Math.min(YM[skey], mAuto * 6) : null, yd = d3.scaleLinear().domain([0, mOver || mAuto]).range([wl, bot]); if (!mOver) yd.nice();
      const kf_ = v => v >= 1e4 ? d3.format('.3~s')(v) : f0(v);
      { const top0 = yd.domain()[1], ctl = document.createElement('div'); ctl.className = 'yscl'; ctl.style.top = (wl - 2) + 'px'; ctl.style.height = (bot - wl + 6) + 'px';
        const rg = document.createElement('input'); rg.type = 'range'; const toV = q => mAuto * Math.pow(10, q / 500); rg.min = '-1000'; rg.max = '400'; rg.step = '1';   /* 12 Nov 13:42 (Umair): both ways, from 1/100 to about 6x the auto scale */
        rg.value = String(Math.round(500 * Math.log10(top0 / mAuto))); rg.title = 'Material scale: drag down to stretch the material bars, up to shrink them'; rg.setAttribute('aria-label', 'Material scale maximum'); rg.style.height = Math.max(50, bot - wl - 62) + 'px';
        const rs = document.createElement('button'); rs.type = 'button'; rs.className = 'yrs'; rs.innerHTML = '&#x21BA;'; rs.title = 'Reset material scale'; rs.setAttribute('aria-label', 'Reset material scale'); rs.disabled = !mOver;
        const vx = document.createElement('input'); vx.type = 'text'; vx.className = 'yv'; vx.value = kf_(top0); vx.title = 'Bottom of the material scale: click to type a value (e.g. 3000 or 3k)'; vx.setAttribute('aria-label', 'Material scale maximum value');
        let tmr; const set = v => { if (v == null || !(v > 0)) delete YM[skey]; else YM[skey] = v; clearTimeout(tmr); tmr = setTimeout(() => window.__draw(), 40); };
        rg.addEventListener('input', () => { const v = toV(+rg.value); vx.value = kf_(v); set(v); }); rs.addEventListener('click', () => set(null));
        vx.addEventListener('focus', () => { vx.value = String(Math.round(top0)); vx.select(); });
        vx.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); vx.blur(); } else if (ev.key === 'Escape') { vx.value = kf_(top0); vx.blur(); } });
        vx.addEventListener('change', () => { const t = vx.value.trim().toLowerCase().replace(/,/g, ''), mm = t.match(/^([\d.]+)\s*([km]?)$/); if (!mm) { vx.value = kf_(top0); return; } set(+mm[1] * (mm[2] === 'k' ? 1e3 : mm[2] === 'm' ? 1e6 : 1)); });
        ctl.append(rg, rs, vx); es.appendChild(ctl); }
      const x0 = d3.scaleBand().domain(G.map((g, i) => i)).range([ml, w - 8]).paddingInner(G.length > 8 ? 0.35 : 0.5).paddingOuter(0.15), bw = x0.bandwidth();
      const df = svg.append('defs'), gid = 'ice' + Math.random().toString(36).slice(2, 7), cid = 'icc' + gid;
      const lg_ = df.append('linearGradient').attr('id', gid).attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 1); lg_.append('stop').attr('offset', 0).attr('stop-color', MC); lg_.append('stop').attr('offset', 1).attr('stop-color', '#F1F5F9');
      df.append('clipPath').attr('id', cid).append('rect').attr('x', 0).attr('y', wl).attr('width', w).attr('height', bot - wl + 1);
      svg.append('rect').attr('x', ml - 6).attr('y', wl).attr('width', w - ml - 2).attr('height', bot - wl).attr('fill', '#F4F7FA');
      yu.ticks(4).forEach(t => { if (!t) return; svg.append('line').attr('x1', ml).attr('x2', w - 8).attr('y1', yu(t)).attr('y2', yu(t)).attr('stroke', '#EEF1F4');
        svg.append('text').attr('x', ml - 8).attr('y', yu(t) + 3.5).attr('text-anchor', 'end').attr('font-size', 10).attr('fill', '#5B6770').text(o.tick(t)); });
      yd.ticks(4).forEach(t => { if (!t) return; svg.append('line').attr('x1', ml).attr('x2', w - 8).attr('y1', yd(t)).attr('y2', yd(t)).attr('stroke', '#E4EAF0').attr('stroke-dasharray', '2 3');
        svg.append('text').attr('x', ml - 8).attr('y', yd(t) + 3.5).attr('text-anchor', 'end').attr('font-size', 10).attr('fill', '#8CA0B3').text(o.tick(t)); });
      svg.append('text').attr('transform', `translate(12,${(mt + wl) / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#5B6770').text(o.up);
      svg.append('text').attr('transform', `translate(12,${(wl + bot) / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#8CA0B3').text(o.down);
      const gM = svg.append('g').attr('clip-path', `url(#${cid})`), gL = svg.append('g'), lens = svg.append('g').attr('pointer-events', 'none').style('display', 'none');
      G.forEach((g, i) => { const gx = x0(i), cx = gx + bw / 2, t = d3.sum(EL, ([e]) => Math.max(0, g.v[e] || 0)), cv = cvOf(g), m = Math.max(0, g.v['Direct material'] || 0);
        const L = o.tip(g, t), op = g.dim ? 0.55 : 1;
        // above the waterline
        let y0 = 0; CV.forEach(([e, c]) => { const v = Math.max(0, g.v[e] || 0); if (!v) return; const yt = yu(y0 + v), hh = yu(y0) - yt;
          svg.append('rect').attr('x', gx).attr('y', yt).attr('width', bw).attr('height', Math.max(1, hh)).attr('fill', c).attr('stroke', '#fff').attr('stroke-width', 0.6).attr('opacity', op).attr('pointer-events', 'none');
          if (hh >= 14 && bw >= 30) svg.append('text').attr('x', cx).attr('y', yt + hh / 2 + 3.5).attr('text-anchor', 'middle').attr('font-size', 9.5).style('fill', '#fff').attr('pointer-events', 'none').text(rsu(v));
          y0 += v; });
        if (cv) svg.append('text').attr('x', cx).attr('y', yu(cv) - 6).attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', 700).attr('fill', C.navy).text(o.cvLab(cv));
        // below the waterline
        if (m) { const yb = yd(m), cut = m > yd.domain()[1], yb2 = Math.min(yb, bot), tipD = Math.min(7, (yb2 - wl) / 3);
          gM.append('path').attr('d', cut ? `M${gx},${wl} L${gx + bw},${wl} L${gx + bw},${bot + 2} L${gx},${bot + 2} Z` : `M${gx},${wl} L${gx + bw},${wl} L${gx + bw - 3},${yb2} L${cx + 3},${yb2 + tipD} L${gx + 3},${yb2} Z`)
            .attr('fill', `url(#${gid})`).attr('stroke', '#AEBBC8').attr('stroke-width', 0.8).attr('opacity', op)
            .on('mousemove', ev => tip.show(ev, [...L, `▸ Direct material: ${o.mLab(m)} (${t ? Math.round(100 * m / t) : 0}%)`])).on('mouseleave', tip.hide);
          const inB = !cut && yb2 + tipD + 13 > bot + 4; svg.append('text').attr('x', cx).attr('y', cut ? bot - 6 : inB ? yb2 - 8 : yb2 + tipD + 13).attr('text-anchor', 'middle').attr('font-size', 10).attr('font-weight', cut ? 700 : 400).attr('fill', '#5E7387').attr('pointer-events', 'none').text((cut ? '▼ ' : '') + rsu(m)); }
        const fs_ = G.length > 12 ? 9.5 : 11, mc = Math.max(6, Math.floor(bw / (fs_ * 0.56))), nm_ = g.name, lab = nm_.length > mc ? nm_.slice(0, mc - 1) + '…' : nm_;
        const lc = o.labClick && o.labClick(g);   /* 13 Nov 18:13 (Umair): clicking a shop name or its Rs / unit applies the Shop filter */
        const t1 = svg.append('text').attr('x', cx).attr('y', h - mb + 16).attr('text-anchor', 'middle').attr('font-size', fs_).attr('fill', g.dim ? '#5B6770' : C.navy).style('font-weight', g.bold ? 700 : 400).text(lab); t1.append('title').text(lc ? g.name + ' - click to filter the dashboard to this shop' : g.name);
        const t2 = svg.append('text').attr('x', cx).attr('y', h - mb + 29).attr('text-anchor', 'middle').attr('font-size', 9.5).style('fill', '#051C2C').style('font-weight', 600).text(o.lab2(g, t)); t2.append('title').text(o.lab2t(g, t) + (lc ? ' - click to filter the dashboard to this shop' : ''));
        if (lc) [t1, t2].forEach(e => e.style('cursor', 'pointer').on('mouseenter', () => { t1.style('text-decoration', 'underline'); t2.style('text-decoration', 'underline'); }).on('mouseleave', () => { t1.style('text-decoration', null); t2.style('text-decoration', null); }).on('click', ev => { ev.stopPropagation(); tip.hide(); lc(); }));  // 13 Nov 14:40 (Umair): total Rs/unit instead of units
        // hover target for the upper half: opens the magnifier lens
        gL.append('rect').attr('x', gx - 2).attr('y', mt - 4).attr('width', bw + 4).attr('height', wl - mt + 4).attr('fill', 'transparent').style('cursor', 'zoom-in')
          .on('mouseenter', () => showLens(g, i)).on('mouseleave', () => lens.style('display', 'none')).on('click', () => o.click && o.click(g));
      });
      svg.append('line').attr('x1', ml - 6).attr('x2', w - 8).attr('y1', wl).attr('y2', wl).attr('stroke', '#2B6CB0').attr('stroke-width', 1.6).attr('stroke-dasharray', '7 4');
      svg.append('text').attr('x', 2).attr('y', wl + 12).attr('text-anchor', 'start').attr('font-size', 9.5).attr('fill', '#2B6CB0').text('waterline');
      function showLens(g, i) {   /* magnifier: the three upper elements enlarged in a round lens beside the bar */
        lens.selectAll('*').remove(); const cv = cvOf(g); if (!cv) return; const R_ = Math.min(96, (wl - mt) / 2 + 22), gx = x0(i), cx0 = gx + bw / 2;
        const right = cx0 + bw / 2 + R_ * 2 + 16 < w, lx = right ? cx0 + bw / 2 + R_ + 12 : cx0 - bw / 2 - R_ - 12, ly = Math.max(R_ + 4, (mt + wl) / 2);
        lens.append('line').attr('x1', right ? gx + bw : gx).attr('y1', yu(cv)).attr('x2', lx + (right ? -R_ : R_) * 0.72).attr('y2', ly - R_ * 0.5).attr('stroke', '#8C96A0').attr('stroke-dasharray', '3 3');
        lens.append('circle').attr('cx', lx).attr('cy', ly).attr('r', R_ + 3).style('fill', '#fff').attr('stroke', '#8C96A0').attr('stroke-width', 3).style('filter', 'drop-shadow(0 4px 10px rgba(0,0,0,.18))');
        const lid = 'lz' + gid; lens.append('clipPath').attr('id', lid).append('circle').attr('cx', lx).attr('cy', ly).attr('r', R_);
        const z = lens.append('g').attr('clip-path', `url(#${lid})`), zb = Math.min(96, R_ * 1.05), zs = d3.scaleLinear([0, cv], [ly + R_ * 0.55, ly - R_ * 0.42]);
        z.append('rect').attr('x', lx - zb / 2).attr('y', zs(0)).attr('width', zb).attr('height', R_).attr('fill', MC);
        z.append('text').attr('x', lx).attr('y', zs(0) + 15).attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#5B6770').text('material ' + rsu(g.v['Direct material'] || 0));
        let y0 = 0; CV.forEach(([e, c]) => { const v = Math.max(0, g.v[e] || 0); if (!v) return; const hh = zs(y0) - zs(y0 + v);
          z.append('rect').attr('x', lx - zb / 2).attr('y', zs(y0 + v)).attr('width', zb).attr('height', hh).attr('fill', c).attr('stroke', '#fff');
          if (hh >= 11) z.append('text').attr('x', lx).attr('y', zs(y0 + v) + hh / 2 + 4).attr('text-anchor', 'middle').attr('font-size', 11.5).attr('font-weight', 600).style('fill', '#fff').text(rsu(v) + (hh >= 26 && zb >= 80 ? ' ' + e.split(' ')[e.startsWith('Direct') ? 1 : 0].replace('Utilities', 'utilities') : ''));
          else z.append('text').attr('x', lx + zb / 2 + 4).attr('y', zs(y0 + v / 2) + 4).attr('font-size', 10.5).attr('font-weight', 600).style('fill', c).text(rsu(v));
          y0 += v; });
        z.append('text').attr('x', lx).attr('y', zs(cv) - 8).attr('text-anchor', 'middle').attr('font-size', 11.5).attr('font-weight', 700).attr('fill', C.navy).text(o.cvLab(cv) + o.unitS);
        const nm = g.name.length > 22 ? g.name.slice(0, 21) + '…' : g.name; z.append('text').attr('x', lx).attr('y', ly - R_ + 16).attr('text-anchor', 'middle').attr('font-size', 9.5).attr('fill', '#5B6770').text('🔍 ' + nm);
        lens.raise().style('display', null); }
    
  }
  const rsu0 = v => v >= 100 ? d3.format(',.0f')(v) : d3.format(',.1f')(v);
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
    /* 11 Nov 23:18 (Umair): vertical columns, one per cost element, for each shop. With a shop picked in the filter pane the
       chart shows that shop's finished products instead (OEM products at the shop's OEM rates, SPD parts at their allocated cost). */
    const es = document.getElementById('cp-shop'), h3 = document.querySelector('#c-cp-shop h3');
    document.getElementById('cp-shop-lg').innerHTML = leg();
    let G = [];   /* 12 Nov 00:00 (Umair): Rs per unit, OEM only. Shop view: each element (OEM share) / the shop's units produced; product view: each OEM product of the shop at its shop's rate */
    const VU = new Map(R.filter(r => r.month === m && r.element === 'Volume').map(r => [r.shop, r.units]));
    const oemBy = s => Object.fromEntries(EL.map(([e]) => [e, d3.sum(cur.filter(r => r.shop === s && r.element === e && !r.spd), r => r.value_pkr)]));
    if (!SH) {
      G = [...new Set(cur.map(r => r.shop))].filter(s => VU.get(s)).sort((a, b) => { const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b); })
        .map(s => { const T = oemBy(s), u = VU.get(s); return { name: s, units: u, pk: T, v: Object.fromEntries(EL.map(([e]) => [e, T[e] / u])), sub: '' }; }).filter(g => d3.sum(EL, ([e]) => g.v[e]));
      if (h3) h3.textContent = 'COGM per Unit by Shop (OEM, Rs / unit)';
    } else {
      const vo = VU.get(SH), T = oemBy(SH), rate = Object.fromEntries(EL.map(([e]) => [e, vo ? T[e] / vo : 0]));
      const PR = R.filter(r => r.month === m && r.element === 'Product' && r.shop === SH), DS = dmSplit(PR, T['Direct material'] || 0, m);
      PR.forEach(r => { const v = { ...rate }, q = DS && DS.get(r.code); if (q) v['Direct material'] = q.dm; G.push({ name: r.part || r.code, code: r.code, units: r.units, sub: r.model || 'OEM', bom: q && q.bom, v, pk: Object.fromEntries(EL.map(([e]) => [e, v[e] * r.units])) }); });
      G.sort((a, b) => b.units - a.units);
      if (h3) h3.textContent = 'COGM per Unit by OEM Product · ' + SH + ' (Rs / unit)';
    }
    /* 12 Nov 13:29 (Umair): iceberg chart. Waterline = 0. Above it, indirect material + labour + utilities per unit (what the shop
       controls) on their own scale, with a magnifier lens on hover. Below it, direct material per unit hangs down on its own scale; the
       light grey slider on the left changes only that lower scale. */
    if (!G.length) empty(es, SH ? 'No finished production for ' + SH + ' this month' : 'No cost data for this month'); else {
      { const old = document.getElementById('cp-shop-clr'); if (old) old.remove();   /* 13 Nov 18:13 (Umair): Clear filter at the top right, same pill as Totals */
        if (SH && h3) { const bt = document.createElement('button'); bt.type = 'button'; bt.id = 'cp-shop-clr'; bt.className = 'qclr fon'; bt.textContent = 'Clear filter'; bt.title = 'Back to all shops';
          h3.parentElement.style.position = 'relative'; bt.style.cssText = 'position:absolute;right:16px;top:12px';   /* red, as Clear filters in the filter pane (13 Nov 18:20) */
          bt.addEventListener('click', ev => { ev.stopPropagation(); dash.setParams({ shop: 'All', model: 'All', sf: 0, pf: 0 }); }); h3.parentElement.appendChild(bt); } }
      ice(es, G, { labClick: g => !SH && (window.__SHOPS || []).includes(g.name) ? () => dash.setParams({ shop: g.name, sf: 0, pf: 0 }) : null, skey: 'c-cp-mat|' + (SH || 'All'), f: rsu0, tick: d3.format(',.0f'), up: 'Conversion, Rs / unit ↑', down: 'Material, Rs / unit ↓', unitS: ' / unit',
        cvLab: v => 'Rs ' + rsu0(v), mLab: v => 'Rs ' + rsu0(v) + '/unit', lab2: (g, t) => (g.sub ? g.sub + ' · ' : '') + 'Rs ' + rsu0(t) + ' / unit',
        lab2t: (g, t) => `Total cost per unit (material + indirect material + labour + utilities): Rs ${rsu0(t)} · ${nf(g.units)} units`,
        tip: (g, t) => [g.name + (g.code ? ' · ' + g.code : ''), `${nf(g.units)} units produced`, ...(g.bom ? [`Direct material shared by SAP BOM (Rs ${rsu0(g.bom)}/unit at moving average)`] : []), ...EL.map(([e]) => `${e}: Rs ${rsu0(g.v[e])}/unit · ${pm(g.pk[e])} PKR`), `Total: Rs ${rsu0(t)}/unit · ${pm(d3.sum(EL, ([e]) => g.pk[e]))} PKR`] });
    }
    // monthly trend (stacked columns)
    const et = document.getElementById('cp-trend'); document.getElementById('cp-trend-lg').innerHTML = leg();
    /* 12 Nov 13:49 (Umair): with a shop filter the month chart shows Rs / unit (OEM cost / OEM units, as in the iceberg). The 'Totals'
       button at the top right of the title switches it back to the monthly PKR totals for that shop. */
    const PU = !!SH && !window.__cpTot, th3 = document.querySelector('#c-cp-trend h3');
    if (th3) { th3.textContent = PU ? 'COGM per Unit by Month · ' + SH + ' (OEM, Rs / unit)' : 'COGM by Month' + (SH ? ' · ' + SH : '');
      if (SH) { const bt = document.createElement('button'); bt.type = 'button'; bt.textContent = PU ? 'Totals' : 'Per unit'; bt.title = PU ? 'Show the monthly PKR totals for ' + SH : 'Show cost per unit by month';
        th3.parentElement.style.position = 'relative'; bt.style.cssText = 'position:absolute;right:16px;top:12px;font:inherit;font-size:11.5px;font-weight:600;padding:3px 12px;border:1px solid ' + (PU ? '#C9D1D9' : '#051C2C') + ';border-radius:14px;background:' + (PU ? '#fff' : '#051C2C') + ';color:' + (PU ? '#051C2C' : '#fff') + ';cursor:pointer';
        bt.addEventListener('click', ev => { ev.stopPropagation(); window.__cpTot = PU; window.__draw(); }); th3.appendChild(bt); } }
    const VM = new Map(R.filter(r => r.element === 'Volume' && r.shop === SH).map(r => [r.month, r.units]));
    const byM = months.map(mm => { const v = R.filter(r => r.month === mm && r.element !== 'Labour detail' && (!SH || r.shop === SH) && (!PU || !r.spd)), u = PU ? VM.get(mm) : 1;
      return { m: mm, u, ...Object.fromEntries(EL.map(([e]) => [e, PU && !u ? 0 : d3.sum(v.filter(r => r.element === e), r => r.value_pkr) / (u || 1)])) }; });
    const rsu_ = v => v >= 100 ? d3.format(',.0f')(v) : d3.format(',.1f')(v), fv = v => PU ? 'Rs ' + rsu_(v) : pm(v), unitTxt = PU ? '/unit' : ' PKR';
    /* 13 Nov 16:37 (Umair): the month chart is an iceberg too - direct material hangs below the waterline, indirect material,
       labour and utilities stand above it; the filters and the Totals / Per unit button apply as before. */
    { const asM = asof.slice(0, 7), mF = v => PU ? rsu_(v) : d3.format('.3~s')(v).replace('G', 'B'), fvT = v => PU ? 'Rs ' + rsu_(v) : pm(v);
      const GM = byM.map(o => ({ name: mon(o.m) + (o.m === asM ? '*' : ''), mm: o.m, u: o.u, dim: o.m !== m, bold: o.m === m, v: Object.fromEntries(EL.map(([e]) => [e, PU && !o.u ? 0 : o[e]])) }));
      if (!GM.some(g => d3.sum(EL, ([e]) => g.v[e]))) empty(et, 'No cost data'); else
      ice(et, GM, { h: 400, skey: 'c-cp-trm|' + (SH || 'All') + (PU ? '|u' : '|t'), f: mF, tick: v => PU ? d3.format(',.0f')(v) : d3.format('.2~s')(v).replace('G', 'B'),
        up: 'Conversion, ' + (PU ? 'Rs / unit' : 'PKR') + ' ↑', down: 'Material, ' + (PU ? 'Rs / unit' : 'PKR') + ' ↓', unitS: PU ? ' / unit' : '',
        cvLab: v => PU ? 'Rs ' + rsu_(v) : pm(v), mLab: v => fvT(v) + unitTxt, lab2: (g, t) => PU && !g.u ? 'no output' : fvT(t) + (PU ? ' / unit' : ''),
        lab2t: (g, t) => `Total cost${PU ? ' per unit' : ''} (material + indirect material + labour + utilities): ${fvT(t)}${unitTxt}${PU ? ' · ' + nf(g.u || 0) + ' OEM units' : ''}`,
        tip: (g, t) => [mon(g.mm) + (g.mm === asM ? ' (month to date)' : ''), ...(PU ? [`${nf(g.u || 0)} OEM units produced`] : []), ...EL.map(([e]) => `${e}: ${fvT(g.v[e])}${unitTxt}${e === 'Utilities' && R.some(r => r.month === g.mm && r.element === 'Utilities' && r.estimate) ? ' (estimate)' : ''}`), `Total: ${fvT(t)}${unitTxt}`, ...(g.v['Direct labour'] ? [] : ['No attendance data for this month'])] }); }
    // table by shop
    const tb = document.getElementById('cp-tab'); const sub = (s, e, k) => d3.sum(cur.filter(r => r.shop === s && r.element === e && (!k || r.sub === k)), r => r.value_pkr);
    const cols = [['Direct material', 'Direct material'], ['Tools', 'Indirect material', 'Tools'], ['Consumables', 'Indirect material', 'Consumables'], ['Spares', 'Indirect material', 'Spares'], ['Lubricants', 'Indirect material', 'Lubricants'],
      ['Wages', 'Direct labour', 'Wages'], ['Overtime', 'Direct labour', 'Overtime'], ['Electricity', 'Utilities', 'Electricity'], ['Gas', 'Utilities', 'Gas']];
    const allS = [...new Set(R.filter(r => r.month === m && r.element !== 'Labour detail').map(r => r.shop))].filter(s => !SH || s === SH)
      .sort((a, b) => { const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b); });
    /* 11 Nov 22:45 (Umair): hold the pointer on a value for 2 seconds to see what is behind it */
    const LD = new Map(R.filter(r => r.month === m && r.element === 'Labour detail').map(r => [r.shop, r]));
    const VV = new Map(R.filter(r => r.month === m && r.element === 'Volume').map(r => [r.shop, r]));
    const f0 = d3.format(',.0f');
    const why = (s, e, k, lab) => { const rr = cur.filter(r => r.shop === s && r.element === e && (!k || r.sub === k)); const v = d3.sum(rr, r => r.value_pkr); if (!v) return null;
      const oem = d3.sum(rr.filter(r => !r.spd), r => r.value_pkr), spd = v - oem, d = (rr.find(r => !r.spd && r.detail) || {}).detail || {}, base = rr.find(r => !r.spd) || {}, vo = VV.get(s), st = d3.sum(cols, ([, e2, k2]) => sub(s, e2, k2));
      const L = [`${s} · ${lab}`, `${pm(v)} PKR · ${st ? (100 * v / st).toFixed(1) : 0}% of the shop's COGM`];
      if (spd) L.push(`OEM ${pm(oem)} · SPD ${pm(spd)} (${(100 * spd / v).toFixed(1)}%)`);
      if (vo && vo.units) L.push(`Rs ${f0(oem / vo.units)} per OEM unit (${nf(vo.units)} units)`);
      if (base.from_alf) L.push(`incl. ${pm(base.from_alf)} shared from Aluminium Foundry by production`);
      if (e === 'Direct material' && d.top) { L.push(`${d.n_items} materials issued (261 less 262), top ones:`); d.top.forEach(t => L.push(`  ${t.code} ${t.part}: ${pm(t.value)}${t.qty ? ' · ' + nf(t.qty) + ' pcs' : ''}`)); }
      if (e === 'Indirect material' && d.ccs) d.ccs.forEach(c => L.push(`  Cost centre ${c.cc}: ${pm(c.value)} · ${nf(c.lines || 0)} issue lines`));
      const ld = LD.get(s);
      if (k === 'Wages' && ld) L.push(`${nf(ld.people)} people x Rs ${nf(ld.wage)}${partial ? ' (working days so far)' : ''}`, `less ${d3.format(',.1f')(ld.absent_days)} absent days x Rs ${d3.format(',.0f')(ld.day_rate)} = ${pm(ld.absent_pkr)}`);
      if (k === 'Overtime' && ld) L.push(`${d3.format(',.1f')(ld.ot_hours)} OT hours x Rs ${d3.format(',.2f')(ld.hour_rate)} x 1.5`);
      if (k === 'Electricity') { const mw = d3.sum(rr, r => r.mwh || 0); L.push(`${d3.format(',.1f')(mw)} MWh x Rs 32/kWh${rr.some(r => r.estimate) ? ' · estimated from last month, pro rata' : ''}`); }
      if (k === 'Gas' && d.knm3 != null) L.push(`${d3.format(',.2f')(d.knm3)} thousand Nm3 x Rs ${d.rate}/Nm3${rr.some(r => r.estimate) ? ' · estimated from last month, pro rata' : ''}`);
      return L; };
    const TIPS = []; const tipCell = (s, i, x) => { const L = x ? why(s, cols[i][1], cols[i][2], cols[i][0]) : null; if (!L) return ''; TIPS.push(L); return ` data-tip="${TIPS.length - 1}" style="cursor:help"`; };
    const row = s => { const v = cols.map(([, e, k]) => sub(s, e, k)), t = d3.sum(v); return `<tr><td>${esc(s)}</td>${v.map((x, i) => `<td${i >= 7 && cur.some(r => r.element === 'Utilities' && r.estimate) ? ' class="smpc"' : ''}${tipCell(s, i, x)}>${x ? pm(x) : '—'}</td>`).join('')}<td><b>${pm(t)}</b></td><td>${T ? (100 * t / T).toFixed(1) + '%' : '—'}</td></tr>`; };
    const totV = cols.map(([, e, k]) => d3.sum(cur.filter(r => r.element === e && (!k || r.sub === k)), r => r.value_pkr));
    tb.innerHTML = `<table class="cpt"><thead><tr><th>Shop</th>${cols.map(([n]) => `<th>${n}</th>`).join('')}<th>COGM</th><th>Share</th></tr></thead><tbody>${allS.map(row).join('')}
      <tr class="tot"><td>Total</td>${totV.map(v => `<td>${pm(v)}</td>`).join('')}<td>${pm(T)}</td><td>100%</td></tr></tbody></table>
      <p class="cpnote">Hold the pointer on a value for 2 seconds to see its details.</p>`;
    let tmr = null, last = null;
    tb.querySelectorAll('td[data-tip]').forEach(td => { const L = TIPS[+td.dataset.tip];
      td.addEventListener('mouseenter', ev => { last = ev; clearTimeout(tmr); tmr = setTimeout(() => tip.show(last, L), 2000); });
      td.addEventListener('mousemove', ev => { last = ev; });
      td.addEventListener('mouseleave', () => { clearTimeout(tmr); tip.hide(); }); });
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
      <p class="cpnote">Rs per unit = each cost element of the shop ÷ the shop's actual production${partial ? ' to date' : ''} (Atlas). CIF = Sleeve CG (in-house), Cylinder Pridor, Drive Plate casting and Boss Clutch Center Pridor casting (SAP production). Cushion = Front Forks and Rear Cushions in motorcycle sets. Aluminium Foundry cost is shared to Bridge Fork Top and Piston by their production. Zinc (ZDC) is under Carburetor. ${cur.some(r => r.spd) ? 'SPD parts made in-house take their share of every cost element (by SAP standard cost of SPD vs OEM production), so these rates are for OEM products only. ' : ''}Electricity ${cur.some(r => r.element === 'Utilities' && r.estimate) ? 'is estimated for this month' : 'from the utilities sheet at Rs 32/kWh'}.</p>`;
    const P = R.filter(r => r.month === m && r.element === 'Product' && (!SH || r.shop === SH) && rate[r.shop]);
    const iDM = cols.findIndex(([, e]) => e === 'Direct material'), DSP = new Map();
    if (iDM >= 0) [...new Set(P.map(r => r.shop))].forEach(s => { const d = dmSplit(P.filter(r => r.shop === s), val(s, 'Direct material', cols[iDM][2]), m); if (d) DSP.set(s, d); });
    const qq = pq.trim().toLowerCase(), list = P.filter(r => !qq || (r.code + ' ' + r.part + ' ' + r.model + ' ' + r.shop).toLowerCase().includes(qq))
      .sort((a, b) => { const ia = ORDER.indexOf(a.shop), ib = ORDER.indexOf(b.shop); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || b.units - a.units; });
    tp.innerHTML = `<input class="q" id="cp-pq" placeholder="Search product, code, model or shop" aria-label="Search products" value="${esc(pq)}" style="margin-bottom:8px">
      <table class="cpt"><thead><tr><th>Product</th><th>Code</th><th>Shop</th><th>Units produced</th>${cols.map(([n]) => `<th>${n}</th>`).join('')}<th>COGM Rs/unit</th><th>Total cost</th></tr></thead><tbody>
      ${list.map(r => { let k = rate[r.shop]; const q = DSP.get(r.shop) && DSP.get(r.shop).get(r.code); if (q) { const per = k.per.slice(); per[iDM] = q.dm; k = { per, t: d3.sum(per) }; } return `<tr><td>${esc(r.part || r.code)}${r.model ? ` <span style="color:#5B6770">· ${esc(r.model)}</span>` : ''}</td><td>${esc(r.code)}</td><td style="text-align:left">${esc(r.shop)}</td><td>${nf(r.units)}</td>${k.per.map(x => `<td>${rs(x)}</td>`).join('')}<td><b>${rs(k.t)}</b></td><td>${pm(k.t * r.units)}</td></tr>`; }).join('') || '<tr><td colspan="13">No finished production for this selection</td></tr>'}</tbody></table>${spdT(R, m, SH, V, qq, rs)}`;
    const qi = document.getElementById('cp-pq'); if (qi) qi.oninput = () => { pq = qi.value; const pos = qi.selectionStart; unit(R, m, SH, cur, partial); const n = document.getElementById('cp-pq'); n.focus(); n.setSelectionRange(pos, pos); };
  }
  /* 11 Nov 22:24 (Umair): SPD parts made in-house carry their own share of the shop's material; OEM rates exclude it */
  function spdT(R, m, SH, V, qq, rs) {
    const L = R.filter(r => r.month === m && r.element === 'SPD product' && (!SH || r.shop === SH) && (!qq || (r.code + ' ' + r.part + ' ' + r.shop).toLowerCase().includes(qq)))
      .sort((a, b) => { const ia = ORDER.indexOf(a.shop), ib = ORDER.indexOf(b.shop); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || b.cost_pkr - a.cost_pkr; });
    if (!L.length) return '';
    const sh = [...new Set(L.map(r => r.shop))].map(s => { const v = V.get(s) || {}; return `${esc(s)} ${v.spd_share != null ? (100 * v.spd_share).toFixed(1) + '%' : ''}`; }).join(' · ');
    return `<h4 style="margin:16px 0 6px;font-size:13px">SPD parts made in-house: cost allocated</h4>
      <table class="cpt"><thead><tr><th>SPD part</th><th>Code</th><th>Shop</th><th>Units produced</th><th>SAP std Rs/unit</th><th>Direct material</th><th>Indirect material</th><th>Labour</th><th>Utilities</th><th>COGM Rs/unit</th><th>Total cost</th></tr></thead><tbody>
      ${L.map(r => `<tr><td>${esc(r.part || r.code)}</td><td>${esc(r.code)}</td><td style="text-align:left">${esc(r.shop)}</td><td>${nf(r.units)}</td><td>${rs(r.std_unit)}</td><td>${rs(r.dm_unit)}</td><td>${rs(r.im_unit)}</td><td>${rs(r.lab_unit)}</td><td>${rs(r.util_unit)}</td><td><b>${rs(r.cost_unit)}</b></td><td>${pm(r.cost_pkr)}</td></tr>`).join('')}
      <tr><td><b>Total</b></td><td></td><td></td><td><b>${nf(d3.sum(L, r => r.units))}</b></td><td></td><td></td><td></td><td></td><td></td><td></td><td><b>${pm(d3.sum(L, r => r.cost_pkr))}</b></td></tr></tbody></table>
      <p class="cpnote">Each shop's SPD share of every cost element (direct material, tools, consumables, spares, lubricants, labour, electricity, gas) = SPD production at SAP standard cost ÷ (OEM finished + SPD production at standard): ${sh}. Within a shop it is split across SPD parts by their standard value. SPD from vendors (no in-house production) is not included.</p>`;
  }
  window.__costRender = render;
  const d0 = window.__draw; if (d0) window.__draw = (...a) => { const r = d0(...a); if (window.__page === 'cost') { try { render(window.__P()); } catch (e) { console.error(e); } } return r; };
  try { if (window.__page === 'cost' && window.__P) render(window.__P()); } catch (e) {}
})();
