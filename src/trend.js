/* Manpower tab: "Trend" toggle (Umair, 10 Nov 2026). A button at the top right of the navy title pane, shown only while the
   Manpower tab is open. Default label "Trend": the tab shows the current month as before. Clicked, it reads "Current Month"
   and the tab switches to month-to-month trends of absenteeism and overtime by shop (by area when a shop is filtered),
   from sp_attendance (area/section/day) and sp_attendance_people (person/month). Absenteeism = absent / (present + absent)
   on working days (Sundays left out), the same rule as the current-month view. The running month is marked "to date". */
(() => {
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = m => MON[+m.slice(5) - 1] + '-' + m.slice(2, 4);
  const SQ = ['Clutch', 'Drum Gear', 'Ignition Coil', 'Hubs', 'Carb Child Parts', 'Carburetor', 'CIF Machining', 'Bridge Fork Top', 'HPDC / Die Cast', 'Aluminium Foundry', 'Piston', 'Polymer'];
  const NAVY = '#051C2C', BLUE = '#2251FF', CYAN = '#00A9F4', BAD = '#D0312D', WARN = '#C98300', GOOD = '#1E8C5A', MUT = '#5A6670', LINE = '#E2E6EB';
  const PAL = ['#051C2C', '#2251FF', '#00A9F4', '#7A5CFA', '#1E8C5A', '#C98300', '#D0312D', '#8C96A0', '#0F6E8C', '#B5487A', '#5B8C1E', '#3D4F8C', '#A0522D', '#2E7D7A'];
  const f1 = d3.format('.1f'), f0 = d3.format(',.0f'), f2 = d3.format('.2f');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let on = false;

  const css = document.createElement('style');
  css.textContent = `.ael #f-trend{margin-left:auto;height:28px;padding:0 14px;border:1px solid #4A6680;border-radius:4px;background:transparent;color:#fff;font:600 12px/1 inherit;letter-spacing:.3px;cursor:pointer;display:inline-flex;align-items:center;gap:7px}
.ael #f-trend[hidden]{display:none} .ael #f-trend:hover{border-color:var(--cyan)} .ael #f-trend.on{background:var(--cyan);border-color:var(--cyan);color:var(--navy)} .ael #f-trend svg{flex:none}
.ael #workforce.wtr>:not(#wf-trend){display:none!important} .ael #workforce:not(.wtr)>#wf-trend{display:none}
.ael .wtc{position:relative;width:100%;min-height:120px} .ael #wf-trend .ssub{font-size:12px;color:var(--mut);margin:-4px 0 8px} .ael #wf-trend svg text{font-family:inherit}
.ael .wtk{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.ael .wtk .t{border:1px solid var(--line);padding:10px 12px;background:var(--soft)} .ael .wtk .l{font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.4px}
.ael .wtk .v{font-size:24px;color:var(--navy);margin-top:3px;font-variant-numeric:tabular-nums} .ael .wtk .d{font-size:12px;margin-top:2px} .ael .wtk .p{font-size:11px;color:var(--mut);margin-top:2px}
.ael .wtsm{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px} .ael .wtsm .s{border:1px solid var(--line);padding:8px 10px}
.ael .wtsm .s h4{margin:0;font-size:12px;font-weight:600;color:var(--ink);display:flex;justify-content:space-between;gap:6px} .ael .wtsm .s h4 b{font-weight:600}
.ael .wttb{overflow:auto} .ael .wttb table{border-collapse:collapse;width:100%;font-size:12px} .ael .wttb th{background:var(--soft);text-align:right;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap;font-weight:600}
.ael .wttb th:first-child,.ael .wttb td:first-child{text-align:left;position:sticky;left:0;background:#fff} .ael .wttb th:first-child{background:var(--soft)}
.ael .wttb td{padding:5px 8px;border-bottom:1px solid #EEF1F4;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums} .ael .wttb tr.tot td{font-weight:600;border-top:2px solid var(--navy)}
.ael .wttb th.grp{text-align:center;border-left:1px solid var(--line)} .ael .wttb td.gl,.ael .wttb th.gl{border-left:1px solid var(--line)}
.wttip{position:fixed;z-index:70;pointer-events:none;background:#051C2C;color:#fff;font-size:12px;line-height:1.45;padding:7px 10px;border-radius:4px;box-shadow:0 6px 18px rgba(5,28,44,.25);display:none;max-width:280px}
.wttip b{font-weight:600}`;
  document.head.appendChild(css);
  const tip = document.createElement('div'); tip.className = 'wttip'; document.body.appendChild(tip);
  const tipOn = (ev, html) => { tip.innerHTML = html; tip.style.display = 'block'; const w = tip.offsetWidth, h = tip.offsetHeight; let x = ev.clientX + 14, y = ev.clientY + 14; if (x + w > innerWidth - 8) x = ev.clientX - w - 14; if (y + h > innerHeight - 8) y = ev.clientY - h - 14; tip.style.left = x + 'px'; tip.style.top = y + 'px'; };
  const tipOff = () => { tip.style.display = 'none'; };
  const hov = (sel, html) => sel.on('mousemove', (ev, d) => tipOn(ev, html(d))).on('mouseleave', tipOff);

  /* ---------- data ---------- */
  const rowsOf = id => { try { const d = window.dash && dash.data(id); return d && d.status === 'ok' ? d.data || [] : []; } catch (e) { return []; } };
  const wfShops = r => /KEIHIN|ZINC/i.test(r.area) ? ['Carburetor'] : r.shop === 'Aluminium Foundry' ? ['Piston', 'Bridge Fork Top'] : [r.shop];
  const work = d => new Date(d + 'T00:00:00Z').getUTCDay() !== 0;
  function model() {
    const P = (window.__P && window.__P()) || (window.dash && dash.params()) || {}, shop = P.shop || 'All';
    const all = rowsOf('sp_attendance').filter(r => shop === 'All' || wfShops(r).includes(shop));
    const key = shop === 'All' ? (r => r.shop) : (r => r.area);
    const months = [...new Set(all.map(r => r.date.slice(0, 7)))].sort();
    const cur = (window.__TODAY || '').slice(0, 7);
    const agg = v => { const w = v.filter(r => work(r.date)), pa = d3.sum(w, r => r.present + r.absent), pres = d3.sum(w, r => r.present);
      const days = new Set(w.map(r => r.date)).size, hcd = d3.rollups(v, x => d3.sum(x, r => r.headcount), r => r.date);
      return { abs: pa ? d3.sum(w, r => r.absent) / pa * 100 : null, absd: d3.sum(w, r => r.absent), leave: d3.sum(w, r => r.leave), ot: d3.sum(v, r => r.ot_hours),
        otpd: pres ? d3.sum(v, r => r.ot_hours) / pres : null, otday: days ? d3.sum(v, r => r.ot_hours) / days : null, hc: hcd.length ? d3.mean(hcd, d => d[1]) : null, days, pres }; };
    const plant = new Map(months.map(m => [m, agg(all.filter(r => r.date.startsWith(m)))]));
    const g = d3.rollup(all, v => new Map(months.map(m => [m, agg(v.filter(r => r.date.startsWith(m)))])), key);
    const ix = k => { const i = SQ.indexOf(k); return i < 0 ? 99 : i; };
    const groups = [...g.keys()].sort((a, b) => ix(a) - ix(b) || a.localeCompare(b));
    /* repeat absentees: people with 3+ absent days in both of the last two months */
    const ppl = rowsOf('sp_attendance_people').filter(r => shop === 'All' || wfShops(r).includes(shop));
    const rep = new Map(); if (months.length > 1) { const [a, b] = months.slice(-2), pk = r => r.emp_id + '|' + r.name + '|' + r.area;
      const prevSet = new Set(ppl.filter(r => r.month === a && r.absent >= 3).map(pk));
      ppl.filter(r => r.month === b && r.absent >= 3 && prevSet.has(pk(r))).forEach(r => { const k = key(r); rep.set(k, (rep.get(k) || 0) + 1); }); }
    return { shop, months, cur, plant, g, groups, rep, label: shop === 'All' ? 'Shop' : 'Area' };
  }
  const mlab = (m, cur) => mon(m) + (m === cur ? ' (to date)' : '');
  const absCol = v => v == null ? '#C9D0D7' : d3.scaleLinear().domain([0, 5, 8, 12, 20]).range(['#1E8C5A', '#8CC5A0', '#F2C14E', '#E7843C', '#D0312D']).clamp(true)(v);

  /* ---------- page scaffold ---------- */
  function scaffold() {
    const sec = document.getElementById('workforce'); if (!sec || document.getElementById('wf-trend')) return sec;
    const w = document.createElement('div'); w.id = 'wf-trend'; w.className = 'grid';
    w.innerHTML = `<div class="card wide"><h3>Month-to-Month Manpower Trend <span class="chip snap" id="wt-scope"></span></h3><div class="ssub" id="wt-sub"></div><div class="wtk" id="wt-kpi"></div></div>
<div class="card"><h3>Absenteeism % by Month</h3><div class="ssub">Working days only · target 5%</div><div class="wtc" id="wt-abs"></div></div>
<div class="card"><h3>Overtime Hours by Month</h3><div class="ssub" id="wt-ots"></div><div class="wtc" id="wt-ot"></div></div>
<div class="card"><h3>Absenteeism Heatmap</h3><div class="ssub">Absent % of present + absent days · green at or below the 5% target</div><div class="wtc" id="wt-hab"></div></div>
<div class="card"><h3>Overtime Intensity Heatmap</h3><div class="ssub">Overtime hours per present man-day (fair across part months)</div><div class="wtc" id="wt-hot"></div></div>
<div class="card"><h3>Absenteeism Change vs Last Month</h3><div class="ssub" id="wt-dsub"></div><div class="wtc" id="wt-dab"></div></div>
<div class="card"><h3>Overtime per Present Day: Change vs Last Month</h3><div class="ssub" id="wt-dsub2"></div><div class="wtc" id="wt-dot"></div></div>
<div class="card wide"><h3>Scorecards</h3><div class="ssub">Line: absenteeism % by month (dashed = 5% target) · bars: overtime hours per present man-day</div><div class="wtsm" id="wt-sm"></div></div>
<div class="card wide"><h3>Month-to-Month Table</h3><div class="ssub" id="wt-tsub"></div><div class="wttb" id="wt-tb"></div></div>`;
    sec.appendChild(w); return sec;
  }
  const box = id => { const el = document.getElementById(id); el.replaceChildren(); return el; };
  const emptyMsg = (el, t) => { const d = document.createElement('div'); d.style.cssText = 'color:#5A6670;font-size:12px;padding:24px 4px'; d.textContent = t; el.appendChild(d); };

  /* ---------- charts ---------- */
  function kpis(M) {
    const el = box('wt-kpi'), ms = M.months, a = M.plant.get(ms[ms.length - 1]), b = ms.length > 1 ? M.plant.get(ms[ms.length - 2]) : null;
    const tile = (lab, v, fmt, pv, better, extra) => { const d = v != null && pv != null ? v - pv : null, good = d == null ? null : better === 'down' ? d <= 0 : d >= 0;
      const t = document.createElement('div'); t.className = 't';
      t.innerHTML = `<div class="l">${esc(lab)}</div><div class="v">${v == null ? '—' : fmt(v)}</div><div class="d" style="color:${d == null || Math.abs(d) < 1e-9 ? MUT : good ? GOOD : BAD}">${d == null ? (b ? '—' : 'first month on file') : (d > 0 ? '▲ ' : d < 0 ? '▼ ' : '') + fmt(Math.abs(d)).replace('%', ' pts') + ' vs ' + mon(ms[ms.length - 2])}</div>${extra ? `<div class="p">${esc(extra)}</div>` : ''}`; el.appendChild(t); };
    tile('Absenteeism · ' + mlab(ms[ms.length - 1], M.cur), a.abs, v => f1(v) + '%', b && b.abs, 'down', 'Target 5%');
    tile('Overtime per present day', a.otpd, v => f2(v) + ' h', b && b.otpd, 'down', 'OT hours ÷ present man-days');
    tile('Overtime hours per working day', a.otday, v => f0(v) + ' h', b && b.otday, 'down', f0(a.ot) + ' h over ' + a.days + ' working days');
    tile('Average headcount', a.hc, v => f0(v), b && b.hc, 'up');
    tile('Absent man-days per working day', a.days ? a.absd / a.days : null, v => f1(v), b && b.days ? b.absd / b.days : null, 'down', f0(a.absd) + ' absent days in the month');
  }
  function plantAbs(M) {
    const el = box('wt-abs'), ms = M.months, W = Math.max(320, el.clientWidth || 440), H = 230, m = { t: 22, r: 14, b: 34, l: 40 };
    const vals = ms.map(k => ({ m: k, v: M.plant.get(k).abs, o: M.plant.get(k) })), mx = Math.max(8, d3.max(vals, d => d.v || 0) * 1.25);
    const x = d3.scaleBand(ms, [m.l, W - m.r]).padding(.38), y = d3.scaleLinear([0, mx], [H - m.b, m.t]).nice();
    const s = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%');
    s.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(v => v + '%').tickSize(-(W - m.l - m.r))).call(g => { g.select('.domain').remove(); g.selectAll('line').attr('stroke', LINE); g.selectAll('text').attr('fill', MUT); });
    s.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickFormat(k => mlab(k, M.cur)).tickSize(0)).call(g => { g.select('.domain').attr('stroke', LINE); g.selectAll('text').attr('fill', NAVY).attr('dy', '1.1em'); });
    const b = s.selectAll('rect.b').data(vals).join('rect').attr('x', d => x(d.m)).attr('width', x.bandwidth()).attr('y', d => y(d.v || 0)).attr('height', d => y(0) - y(d.v || 0)).attr('fill', d => d.v > 10 ? BAD : d.v > 5 ? WARN : NAVY).attr('opacity', d => d.m === M.cur ? .8 : 1);
    hov(b, d => `<b>${mlab(d.m, M.cur)}</b><br>Absenteeism ${f1(d.v)}%<br>${f0(d.o.absd)} absent man-days over ${d.o.days} working days<br>Leave ${f0(d.o.leave)} days · average headcount ${f0(d.o.hc)}`);
    s.selectAll('text.v').data(vals).join('text').attr('x', d => x(d.m) + x.bandwidth() / 2).attr('y', d => y(d.v || 0) - 5).attr('text-anchor', 'middle').attr('font-size', 12).attr('font-weight', 600).attr('fill', NAVY).text(d => d.v == null ? '' : f1(d.v) + '%');
    s.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(5)).attr('y2', y(5)).attr('stroke', GOOD).attr('stroke-width', 1.5).attr('stroke-dasharray', '5 4');
    s.append('text').attr('x', W - m.r).attr('y', y(5) - 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', GOOD).text('Target 5%');
  }
  function otStack(M) {
    const el = box('wt-ot'), ms = M.months, G = M.groups, W = Math.max(320, el.clientWidth || 440), H = 230, m = { t: 22, r: 14, b: 34, l: 52 };
    document.getElementById('wt-ots').textContent = `Total hours by ${M.label.toLowerCase()} · labels show hours per working day so a part month compares fairly`;
    const col = new Map(G.map((k, i) => [k, PAL[i % PAL.length]]));
    const data = ms.map(k => { const o = { m: k }; G.forEach(gk => { o[gk] = (M.g.get(gk).get(k) || {}).ot || 0; }); return o; });
    const st = d3.stack().keys(G)(data), mx = d3.max(data, d => d3.sum(G, k => d[k])) || 1;
    const x = d3.scaleBand(ms, [m.l, W - m.r]).padding(.38), y = d3.scaleLinear([0, mx * 1.15], [H - m.b, m.t]).nice();
    const s = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%');
    s.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('~s')).tickSize(-(W - m.l - m.r))).call(g => { g.select('.domain').remove(); g.selectAll('line').attr('stroke', LINE); g.selectAll('text').attr('fill', MUT); });
    s.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickFormat(k => mlab(k, M.cur)).tickSize(0)).call(g => { g.select('.domain').attr('stroke', LINE); g.selectAll('text').attr('fill', NAVY).attr('dy', '1.1em'); });
    st.forEach(layer => { const r = s.append('g').selectAll('rect').data(layer.map(d => ({ k: layer.key, m: d.data.m, y0: d[0], y1: d[1] }))).join('rect')
      .attr('x', d => x(d.m)).attr('width', x.bandwidth()).attr('y', d => y(d.y1)).attr('height', d => Math.max(0, y(d.y0) - y(d.y1))).attr('fill', col.get(layer.key)).attr('stroke', '#fff').attr('stroke-width', .6);
      hov(r, d => { const o = M.g.get(d.k).get(d.m) || {}; return `<b>${esc(d.k)} · ${mlab(d.m, M.cur)}</b><br>Overtime ${f0(d.y1 - d.y0)} h<br>${o.otpd == null ? '' : f2(o.otpd) + ' h per present man-day'}`; }); });
    s.selectAll('text.v').data(ms).join('text').attr('x', k => x(k) + x.bandwidth() / 2).attr('y', k => y(d3.sum(G, g => data.find(d => d.m === k)[g])) - 5).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', NAVY).attr('font-weight', 600)
      .text(k => { const o = M.plant.get(k); return f0(o.ot) + ' h · ' + f0(o.otday) + '/day'; });
    const lg = d3.select(el).append('div').style('display', 'flex').style('flex-wrap', 'wrap').style('gap', '4px 12px').style('font-size', '11px').style('color', MUT).style('margin-top', '4px');
    G.forEach(k => lg.append('span').html(`<i style="display:inline-block;width:9px;height:9px;background:${col.get(k)};margin-right:4px;vertical-align:-1px"></i>${esc(k)}`));
  }
  function heat(id, M, val, fmt, color, tipf) {
    const el = box(id), ms = M.months, G = M.groups, W = Math.max(320, el.clientWidth || 440), lw = 132, cw = Math.max(54, (W - lw - 8) / ms.length), rh = 24, H = G.length * rh + 30;
    const s = d3.select(el).append('svg').attr('viewBox', `0 0 ${lw + cw * ms.length + 8} ${H}`).attr('width', '100%');
    s.selectAll('text.mh').data(ms).join('text').attr('x', (k, i) => lw + i * cw + cw / 2).attr('y', 14).attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', 600).attr('fill', NAVY).text(k => mlab(k, M.cur).replace(' (to date)', '*'));
    G.forEach((g, j) => { s.append('text').attr('x', lw - 8).attr('y', 24 + j * rh + rh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', NAVY).text(g.length > 20 ? g.slice(0, 19) + '…' : g);
      const c = s.append('g').selectAll('g').data(ms.map(k => ({ g, m: k, o: M.g.get(g).get(k) || {} }))).join('g').attr('transform', (d, i) => `translate(${lw + i * cw},${22 + j * rh})`);
      c.append('rect').attr('width', cw - 3).attr('height', rh - 3).attr('rx', 2).attr('fill', d => color(val(d.o)));
      c.append('text').attr('x', (cw - 3) / 2).attr('y', rh / 2 + 3).attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', 600).style('fill', d => { const v = val(d.o); if (v == null) return MUT; const c = d3.rgb(color(v)); return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) > 150 ? NAVY : '#fff'; }).text(d => { const v = val(d.o); return v == null ? '—' : fmt(v); });
      hov(c, d => tipf(d)); });
    if (ms.includes(M.cur)) d3.select(el).append('div').style('font-size', '11px').style('color', MUT).text('* month to date');
  }
  function delta(id, sub, M, val, fmt, unit) {
    const el = box(id), ms = M.months; document.getElementById(sub).textContent = ms.length > 1 ? `${mon(ms[ms.length - 1])}${ms[ms.length - 1] === M.cur ? ' to date' : ''} vs ${mon(ms[ms.length - 2])} · green = better, red = worse` : '';
    if (ms.length < 2) return emptyMsg(el, 'Needs two months of attendance; the file has ' + ms.map(mon).join(', ') + ' so far.');
    const [pm, lm] = ms.slice(-2), d = M.groups.map(g => { const a = val(M.g.get(g).get(lm) || {}), b = val(M.g.get(g).get(pm) || {}); return { g, a, b, d: a != null && b != null ? a - b : null }; }).filter(x => x.d != null).sort((x, y) => y.d - x.d);
    const W = Math.max(320, el.clientWidth || 440), rh = 22, lw = 132, H = d.length * rh + 20, ext = d3.max(d, x => Math.abs(x.d)) || 1, x = d3.scaleLinear([-ext, ext], [lw + 58, W - 62]);
    const s = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%');
    s.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', H - 6).attr('stroke', '#9AA5B1');
    const r = s.selectAll('g').data(d).join('g').attr('transform', (q, i) => `translate(0,${6 + i * rh})`);
    r.append('text').attr('x', lw - 8).attr('y', rh / 2 + 2).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', NAVY).text(q => q.g.length > 20 ? q.g.slice(0, 19) + '…' : q.g);
    r.append('rect').attr('x', q => Math.min(x(0), x(q.d))).attr('width', q => Math.abs(x(q.d) - x(0))).attr('y', 3).attr('height', rh - 8).attr('fill', q => q.d > 0 ? BAD : GOOD).attr('opacity', .85);
    r.append('text').attr('x', q => q.d > 0 ? x(q.d) + 4 : x(q.d) - 4).attr('y', rh / 2 + 2).attr('text-anchor', q => q.d > 0 ? 'start' : 'end').attr('font-size', 11).attr('fill', q => q.d > 0 ? BAD : GOOD).text(q => +fmt(Math.abs(q.d)) === 0 ? '0' + unit : (q.d > 0 ? '+' : '−') + fmt(Math.abs(q.d)) + unit);
    hov(r, q => `<b>${esc(q.g)}</b><br>${mon(pm)}: ${fmt(q.b)}${unit === ' pts' ? '%' : ' h'}<br>${mon(lm)}${lm === M.cur ? ' (to date)' : ''}: ${fmt(q.a)}${unit === ' pts' ? '%' : ' h'}<br>Change ${(q.d > 0 ? '+' : '−') + fmt(Math.abs(q.d)) + unit}`);
  }
  function multiples(M) {
    const el = box('wt-sm'), ms = M.months;
    M.groups.forEach(g => { const v = ms.map(k => ({ m: k, o: M.g.get(g).get(k) || {} })), last = v[v.length - 1].o, prev = v.length > 1 ? v[v.length - 2].o : null;
      const d = prev && last.abs != null && prev.abs != null ? last.abs - prev.abs : null;
      const c = document.createElement('div'); c.className = 's';
      c.innerHTML = `<h4><span>${esc(g)}</span><b style="color:${absCol(last.abs)}">${last.abs == null ? '—' : f1(last.abs) + '%'}${d == null ? '' : ` <span style="font-weight:400;font-size:11px;color:${d > 0 ? BAD : GOOD}">${d > 0 ? '▲' : '▼'}${f1(Math.abs(d))}</span>`}</b></h4>`;
      el.appendChild(c);
      const W = 200, H = 70, x = d3.scalePoint(ms, [10, W - 10]).padding(.3), ya = d3.scaleLinear([0, Math.max(10, d3.max(v, q => q.o.abs || 0) * 1.2)], [H - 14, 6]), yo = d3.scaleLinear([0, Math.max(.5, d3.max(v, q => q.o.otpd || 0) * 1.2)], [H - 14, 22]);
      const s = d3.select(c).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%');
      const bw = Math.min(22, (W - 20) / ms.length * .5);
      s.selectAll('rect').data(v).join('rect').attr('x', q => x(q.m) - bw / 2).attr('width', bw).attr('y', q => yo(q.o.otpd || 0)).attr('height', q => yo(0) - yo(q.o.otpd || 0)).attr('fill', '#C7D3F5');
      s.append('line').attr('x1', 4).attr('x2', W - 4).attr('y1', ya(5)).attr('y2', ya(5)).attr('stroke', GOOD).attr('stroke-dasharray', '3 3');
      s.append('path').datum(v.filter(q => q.o.abs != null)).attr('fill', 'none').attr('stroke', NAVY).attr('stroke-width', 2).attr('d', d3.line(q => x(q.m), q => ya(q.o.abs)));
      const p = s.selectAll('circle').data(v.filter(q => q.o.abs != null)).join('circle').attr('cx', q => x(q.m)).attr('cy', q => ya(q.o.abs)).attr('r', 3.5).attr('fill', q => absCol(q.o.abs)).attr('stroke', NAVY);
      s.selectAll('text').data(ms).join('text').attr('x', k => x(k)).attr('y', H - 2).attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', MUT).text(k => mon(k) + (k === M.cur ? '*' : ''));
      hov(s.selectAll('rect,circle'), q => `<b>${esc(g)} · ${mlab(q.m, M.cur)}</b><br>Absenteeism ${q.o.abs == null ? '—' : f1(q.o.abs) + '%'}<br>Overtime ${f0(q.o.ot || 0)} h · ${q.o.otpd == null ? '—' : f2(q.o.otpd)} h per present day<br>Average headcount ${q.o.hc == null ? '—' : f0(q.o.hc)}`);
    });
  }
  function tableOf(M) {
    const el = box('wt-tb'), ms = M.months, two = ms.length > 1, [pm, lm] = ms.slice(-2);
    document.getElementById('wt-tsub').textContent = `Absent % on working days, overtime hours and overtime per present man-day by ${M.label.toLowerCase()}` + (two ? `; repeat absentees = people with 3+ absent days in both ${mon(pm)} and ${mon(lm)}` : '');
    const cell = (o, k) => k === 'abs' ? (o.abs == null ? '—' : `<span style="color:${o.abs > 10 ? BAD : o.abs > 5 ? WARN : GOOD};font-weight:600">${f1(o.abs)}%</span>`) : k === 'ot' ? f0(o.ot || 0) : (o.otpd == null ? '—' : f2(o.otpd));
    const dlt = (a, b, f, u) => a == null || b == null ? '—' : `<span style="color:${a - b > 0 ? BAD : GOOD}">${a - b > 0 ? '▲' : a - b < 0 ? '▼' : ''} ${f(Math.abs(a - b))}${u}</span>`;
    let h = `<table><thead><tr><th rowspan="2">${M.label}</th>${ms.map(k => `<th class="grp" colspan="3">${mlab(k, M.cur)}</th>`).join('')}${two ? '<th class="grp" colspan="3">Change</th>' : ''}</tr><tr>${ms.map(() => '<th class="gl">Abs %</th><th>OT h</th><th>OT h/day</th>').join('')}${two ? '<th class="gl">Abs pts</th><th>OT h/day</th><th>Repeat absentees</th>' : ''}</tr></thead><tbody>`;
    const line = (lab, mp, cls, rep) => { h += `<tr${cls ? ` class="${cls}"` : ''}><td>${esc(lab)}</td>${ms.map(k => { const o = mp.get(k) || {}; return `<td class="gl">${cell(o, 'abs')}</td><td>${cell(o, 'ot')}</td><td>${cell(o, 'otpd')}</td>`; }).join('')}`;
      if (two) { const a = mp.get(lm) || {}, b = mp.get(pm) || {}; h += `<td class="gl">${dlt(a.abs, b.abs, f1, ' pts')}</td><td>${dlt(a.otpd, b.otpd, f2, '')}</td><td>${rep == null ? '—' : rep}</td>`; } h += '</tr>'; };
    M.groups.forEach(g => line(g, M.g.get(g), '', M.rep.get(g) || 0));
    line(M.shop === 'All' ? 'All shops' : M.shop, M.plant, 'tot', two ? d3.sum([...M.rep.values()]) : null);
    el.innerHTML = h + '</tbody></table>';
  }

  function render() {
    const sec = scaffold(); if (!sec) return; sec.classList.toggle('wtr', on); if (!on) return;
    const M = model(), ids = ['wt-abs', 'wt-ot', 'wt-hab', 'wt-hot', 'wt-dab', 'wt-dot', 'wt-sm', 'wt-tb', 'wt-kpi'];
    document.getElementById('wt-scope').textContent = M.shop === 'All' ? 'All shops' : M.shop;
    if (!M.months.length) { ids.forEach(i => emptyMsg(box(i), 'Attendance data not loaded yet')); document.getElementById('wt-sub').textContent = ''; return; }
    document.getElementById('wt-sub').textContent = `${M.months.length} month${M.months.length > 1 ? 's' : ''} on file: ${M.months.map(k => mlab(k, M.cur)).join(', ')} · by ${M.label.toLowerCase()} · source: Daily Attendance (SharePoint)`;
    kpis(M); plantAbs(M); otStack(M);
    heat('wt-hab', M, o => o.abs, v => f1(v) + '%', absCol, d => `<b>${esc(d.g)} · ${mlab(d.m, M.cur)}</b><br>Absenteeism ${d.o.abs == null ? '—' : f1(d.o.abs) + '%'}<br>${f0(d.o.absd || 0)} absent man-days · average headcount ${d.o.hc == null ? '—' : f0(d.o.hc)}`);
    const otMax = d3.max(M.groups, g => d3.max(M.months, k => (M.g.get(g).get(k) || {}).otpd || 0)) || 1, otCol = d3.scaleSequential([0, otMax], d3.interpolateRgb('#D6E2FF', '#051C2C'));
    heat('wt-hot', M, o => o.otpd, v => f2(v), v => v == null ? '#C9D0D7' : otCol(v), d => `<b>${esc(d.g)} · ${mlab(d.m, M.cur)}</b><br>${d.o.otpd == null ? '—' : f2(d.o.otpd)} OT hours per present man-day<br>Total overtime ${f0(d.o.ot || 0)} h`);
    delta('wt-dab', 'wt-dsub', M, o => o.abs, f1, ' pts'); delta('wt-dot', 'wt-dsub2', M, o => o.otpd, f2, ' h');
    multiples(M); tableOf(M);
  }

  /* ---------- toggle button (Manpower tab only) ---------- */
  function button() {
    let b = document.getElementById('f-trend'); const top = document.querySelector('.ael .hdr .top'); if (!top) return null;
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.id = 'f-trend'; b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => { on = !on; label(b); render(); }); top.appendChild(b); label(b); }
    b.hidden = window.__page !== 'workforce'; return b;
  }
  function label(b) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
    b.innerHTML = on ? '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2 6.5h12M5 1.5v3M11 1.5v3" stroke="currentColor" stroke-width="1.4"/></svg>Current Month'
      : '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M1.5 12.5l4-4 3 2.5 6-6.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M11 4.5h3.5V8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>Trend';
    b.title = on ? 'Back to the current month view' : 'Show month-to-month trends of absenteeism and overtime by shop'; }
  const sync = () => { try { button(); if (window.__page === 'workforce') render(); } catch (e) { console.warn('trend', e); } };
  const d0 = window.__draw; if (d0) window.__draw = (...a) => { const r = d0(...a); sync(); return r; };
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.ael .tab')) setTimeout(sync, 0); }, true);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (on && window.__page === 'workforce') render(); }, 200); });
  sync();
})();
