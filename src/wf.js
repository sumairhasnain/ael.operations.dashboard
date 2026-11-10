/* Manpower tab: hover an Area or Section in "By Area & Section" to see the people in it (dataset sp_attendance_people,
   one row per person per month). Shows this month's absent days and overtime, and the 3-month figures (selected month and
   the two before it, as far as the data goes). The panel stays open while the pointer is on it, so long lists can scroll. */
(() => {
  const nf = d3.format(',.1~f'), MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = m => MON[+m.slice(5) - 1] + '-' + m.slice(2, 4);
  const back = (m, k) => { const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5) - 1 - k, 1)); return d.toISOString().slice(0, 7); };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const css = document.createElement('style');
  css.textContent = `.wfpop{position:fixed;z-index:60;background:#fff;border:1px solid #D5DCE3;box-shadow:0 10px 28px rgba(5,28,44,.18);border-radius:6px;max-height:62vh;overflow:auto;font-size:12px;color:#051C2C;display:none}
.wfpop .hd{position:sticky;top:0;background:#051C2C;color:#fff;padding:7px 10px;font-weight:600;z-index:2}.wfpop .hd span{font-weight:400;opacity:.8}
.wfpop table{border-collapse:collapse;width:100%}.wfpop th{position:sticky;top:31px;background:#F3F5F8;text-align:left;font-weight:600;padding:5px 8px;border-bottom:1px solid #D5DCE3;white-space:nowrap}
.wfpop td{padding:4px 8px;border-bottom:1px solid #EEF1F4;white-space:nowrap}.wfpop .n{text-align:right;font-variant-numeric:tabular-nums}.wfpop .ft{padding:6px 10px;color:#5A6670;font-size:11px}
#tb-wf tbody td:nth-child(-n+2){cursor:help;text-decoration:underline dotted #9AA5B1}`;
  document.head.appendChild(css);
  const pop = document.createElement('div'); pop.className = 'wfpop'; document.body.appendChild(pop);
  let cur = null, tH = null, P = {};
  const hide = () => { clearTimeout(tH); tH = setTimeout(() => { pop.style.display = 'none'; cur = null; }, 180); };
  pop.addEventListener('mouseenter', () => clearTimeout(tH)); pop.addEventListener('mouseleave', hide);
  const show = (td, area, section) => {
    const key = area + '|' + (section || ''); clearTimeout(tH); if (cur === key && pop.style.display === 'block') return; cur = key;
    const all = (dash.data('sp_attendance_people') || {}).data || [];
    const m = P.month || (window.__TODAY || '').slice(0, 7), w = [back(m, 2), back(m, 1), m];
    const mine = all.filter(r => r.area === area && (!section || r.section === section));
    const by = d3.group(mine.filter(r => w.includes(r.month)), r => r.emp_id + '|' + r.name);
    const have = w.filter(x => mine.some(r => r.month === x));
    const rows = [...by.values()].filter(v => v.some(r => r.month === m)).map(v => { const c = v.find(r => r.month === m), pa = d3.sum(v, r => r.present + r.absent);
      return { n: c.name, id: c.emp_id, s: c.section, g: c.grade, a: c.absent, am: c.present + c.absent ? c.absent / (c.present + c.absent) * 100 : null, ap: pa ? d3.sum(v, r => r.absent) / pa * 100 : null, ot: c.ot_hours, ot3: d3.sum(v, r => r.ot_hours) }; })
      .sort((x, y) => y.a - x.a || y.ot - x.ot || x.n.localeCompare(y.n));
    const col = v => v == null ? '' : v > 10 ? 'color:#D0312D;font-weight:600' : v > 5 ? 'color:#E0A100;font-weight:600' : '';
    const sec = !section;
    pop.innerHTML = `<div class="hd">${esc(area)}${section ? ' · ' + esc(section) : ''} <span>— ${rows.length} people · ${mon(m)}</span></div>` + (rows.length ? `<table><thead><tr><th>Name</th><th>EMP ID</th>${sec ? '<th>Section</th>' : ''}<th class="n">Absent days</th><th class="n">Absent % (${mon(m)})</th><th class="n">Absent % (3-mo avg)</th><th class="n">OT h (${mon(m)})</th><th class="n">OT h (3 mo)</th></tr></thead><tbody>` +
      rows.map(r => `<tr><td>${esc(r.n)}</td><td>${esc(r.id)}</td>${sec ? `<td>${esc(r.s)}</td>` : ''}<td class="n">${nf(r.a)}</td><td class="n" style="${col(r.am)}">${r.am == null ? '—' : d3.format('.1f')(r.am) + '%'}</td><td class="n" style="${col(r.ap)}">${r.ap == null ? '—' : d3.format('.1f')(r.ap) + '%'}</td><td class="n">${nf(r.ot)}</td><td class="n">${nf(r.ot3)}</td></tr>`).join('') + '</tbody></table>'
      : `<div class="ft">No person-level attendance for ${mon(m)}.</div>`) +
      `<div class="ft">Absent days count working days only (Sundays skipped). 3-month figures cover ${have.length ? have.map(mon).join(', ') : '—'}${have.length < 3 ? ' so far' : ''}.</div>`;
    pop.style.display = 'block'; pop.scrollTop = 0;
    const rc = td.getBoundingClientRect(), pw = Math.min(pop.offsetWidth, innerWidth - 16), ph = pop.offsetHeight;
    let x = rc.right + 8; if (x + pw > innerWidth - 8) x = Math.max(8, rc.left - pw - 8); if (x < 8) x = 8;
    pop.style.left = x + 'px'; pop.style.top = Math.max(8, Math.min(rc.top - 10, innerHeight - ph - 8)) + 'px';
  };
  /* rows for the By Area & Section table that have no attendance at all: sections on the sheet's roster with nothing marked
     in the selected dates, and production shops that have no area in the sheet. Rows never marked are shaded red below. */
  const PSH = ['Clutch', 'Drum Gear', 'Ignition Coil', 'Hubs', 'Carb Child Parts', 'Carburetor', 'CIF Machining', 'Bridge Fork Top', 'HPDC / Die Cast', 'Piston', 'Polymer'];
  window.__wfMiss = (p, rows, sel) => {
    const ppl = (dash.data('sp_attendance_people') || {}).data || [], att = (dash.data('sp_attendance') || {}).data || [];
    const inShop = r => p.shop === 'All' || (/KEIHIN|ZINC/i.test(r.area) ? ['Carburetor'] : r.shop === 'Aluminium Foundry' ? ['Piston', 'Bridge Fork Top'] : [r.shop]).includes(p.shop);
    const have = new Set(rows.map(r => r.key)), out = [];
    d3.rollups(ppl.filter(r => r.month === p.month && inShop(r) && (!sel || r.area === sel)), v => ({ n: v.length, shop: v[0].shop }), r => r.area + '|' + r.section)
      .forEach(([k, o]) => { if (!have.has(k)) { const [area, section] = k.split('|'); out.push({ key: k, area, section, shop: o.shop, hc: o.n }); } });
    if (!sel) { const cov = new Set([...att, ...ppl].map(r => r.shop)); PSH.forEach(s => { if (!cov.has(s) && (p.shop === 'All' || p.shop === s)) out.push({ key: s + '|', area: s, section: null, shop: s, hc: null }); }); }
    return out;
  };
  /* KPI corner, top right of each Manpower chart, while a shop (top filter) or an area (bar click) is picked. Styled like the
     Production tab's Daily Production card: the name on the left, level with the figure on the right. The two "by Area" charts show the
     period's absenteeism % and overtime % (overtime hours against present man-days at 8 hours each); the two daily charts
     show the last day entered. */
  const kpis = (p, sel, rf) => {
    const on = !!(rf && rf.length && (sel || p.shop !== 'All')), sun = r => new Date(r.date + 'T00:00:00Z').getUTCDay() === 0, w = (rf || []).filter(r => !sun(r));
    const f0 = d3.format(','), f1 = d3.format(',.1f'), fx = d3.format(',.1~f'), pres = d3.sum(w, r => r.present), abs = d3.sum(w, r => r.absent), ot = d3.sum(rf || [], r => r.ot_hours);
    const dd = s => +s.slice(8) + ' ' + MON[+s.slice(5, 7) - 1], wd = s => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(s + 'T00:00:00Z').getUTCDay()] + ' ' + dd(s);
    const per = p.day ? dd(p.day) : +(p.start || '01').slice(-2) + '–' + dd(p.actEnd || p.end), hc = d3.sum(d3.rollups(rf || [], v => d3.max(v, r => r.headcount), r => r.area + '|' + r.section), d => d[1]);
    const ap = pres + abs ? abs / (pres + abs) * 100 : null, op = pres ? ot / (pres * 8) * 100 : null, acol = v => v > 10 ? '#D0312D' : v > 5 ? '#E0A100' : '#051C2C';
    const la = d3.max(w.filter(r => r.present + r.absent > 0), r => r.date), lw = la ? w.filter(r => r.date === la) : [], lp = d3.sum(lw, r => r.present), lab = d3.sum(lw, r => r.absent), lap = lp + lab ? lab / (lp + lab) * 100 : null;
    const lo = d3.max((rf || []).filter(r => r.ot_hours > 0), r => r.date), lr = lo ? rf.filter(r => r.date === lo) : [], loh = d3.sum(lr, r => r.ot_hours), lon = d3.sum(lr, r => r.ot_people);
    [['c-w-abs', 'Absenteeism · ' + per, ap == null ? '—' : f1(ap) + '%', `absent ${fx(abs)} of ${fx(pres + abs)} man-days · target 5%`, acol(ap)],
     ['c-w-ot', 'Overtime · ' + per, op == null ? '—' : f1(op) + '%', `${f0(Math.round(ot))} OT hours on ${fx(pres)} present days (8-h shift)`, '#051C2C'],
     ['c-w-dabs', la ? 'Last day entered · ' + wd(la) : 'Last day entered', lap == null ? '—' : f1(lap) + '%', la ? `absent ${fx(lab)} of ${fx(lp + lab)} marked · target 5%` : 'no attendance marked', acol(lap)],
     ['c-w-dot', lo ? 'Last overtime day · ' + wd(lo) : 'Last overtime day', lo ? f0(Math.round(loh)) + ' h' : '—', lo ? `${f0(lon)} people · ${fx(lon ? loh / lon : 0)} h each` : 'no overtime entered', '#051C2C']].forEach(([id, kl, kv, ks, colr]) => {
      const card = document.getElementById(id); if (!card) return; let hd = card.querySelector('.chd');
      if (!hd) { const h3 = card.querySelector('h3'); if (!h3) return; hd = document.createElement('div'); hd.className = 'chd'; h3.before(hd); hd.appendChild(h3);
        const k = document.createElement('div'); k.className = 'kwrap'; k.style.marginLeft = 'auto';
        k.innerHTML = '<div class="ksel" style="justify-content:flex-start;padding-top:17px"><div class="sn"></div><div class="mn"></div></div><div class="kmini" style="min-width:0"><div class="kl"></div><div class="kv"></div><div class="ks"></div></div>'; hd.appendChild(k); }
      const k = hd.querySelector('.kwrap'); k.style.display = on ? '' : 'none'; if (!on) return;
      k.querySelector('.sn').textContent = sel || p.shop; k.querySelector('.mn').textContent = (sel ? 'Area' : 'Shop') + ' · ' + f0(hc) + ' people';
      k.querySelector('.kl').textContent = kl; const v = k.querySelector('.kv'); v.textContent = kv; v.style.color = colr; k.querySelector('.ks').textContent = ks; });
  };
  /* Overtime while absent (Umair, 28 Oct): people cut 1.0x for absent days who earn 1.5x overtime in the same week.
     From sp_attendance_people: ot_in_abs_weeks (overtime hours in Mon-Sun weeks with an absence), abs_in_ot_weeks (absent days in
     weeks with overtime), absent_with_ot_days (days marked absent that also carry overtime). Swapped hours = the smaller of those
     absent hours (8 a day) and that overtime: hours moved from normal pay to overtime pay; extra pay = half of them. */
  const oaCss = document.createElement('style');
  oaCss.textContent = `#c-w-oa .oag{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:18px}@media (max-width:900px){#c-w-oa .oag{grid-template-columns:1fr}}
#c-w-oa .oak{display:flex;flex-wrap:wrap;gap:8px 22px;margin:2px 0 10px}#c-w-oa .oak div{border-left:3px solid #D0312D;padding:2px 0 2px 10px}
#c-w-oa .oak span{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#5B6770}#c-w-oa .oak b{font-family:var(--font-anthropic-serif);font-weight:400;font-size:22px;color:#051C2C}
#c-w-oal .wfoat{font:inherit;font-size:12.5px;font-weight:600;padding:5px 12px;border:1px solid #D5DBE1;border-radius:4px;background:#EEF1F4;color:#5A6670;cursor:pointer;white-space:nowrap;margin-left:6px}#c-w-oal .wfoat:hover{background:#E2E7EC}#c-w-oal .wfoat.on{background:#051C2C;border-color:#051C2C;color:#fff}
#c-w-oa .oas{font-size:11.5px;color:#5A6670;margin:-4px 0 8px;line-height:1.4}`;
  document.head.appendChild(oaCss);
  const oa = (p, sel) => {
    const AK = window.AK; if (!AK) return; const { C, tip, box, empty, table } = AK; let card = document.getElementById('c-w-oa');
    if (!card) { const host = document.getElementById('c-w-list'); if (!host) return;
      card = document.createElement('div'); card.className = 'card wide'; card.id = 'c-w-oa';
      card.innerHTML = '<h3>Overtime While Absent</h3><div class="oas" id="wf-oa-sub"></div><div class="oak" id="wf-oa-k"></div><div class="oag"><div><div class="chart" id="wf-oa-sc"></div></div><div><div style="font-size:12px;font-weight:600;color:#051C2C;margin:0 0 4px">By area: swapped hours (people)</div><div class="chart" id="wf-oa-ar"></div></div></div>';
      const card2 = document.createElement('div'); card2.className = 'card wide'; card2.id = 'c-w-oal';
      card2.innerHTML = '<h3>Who: Overtime in the Same Week as an Absence</h3><input class="q" id="q-wfoa" placeholder="Search name, EMP ID, area or section" aria-label="Search people"><div class="tbox"><table class="tb" id="tb-wfoa"><thead><tr><th data-k="name">Name</th><th data-k="emp_id">EMP ID</th><th data-k="area">Area</th><th data-k="section">Section</th><th class="n" data-k="absent">Absent days</th><th class="n" data-k="abs_in_ot_weeks">Absent in OT weeks</th><th class="n" data-k="ot_hours">OT hours</th><th class="n" data-k="ot_in_abs_weeks">OT in absent weeks</th><th class="n" data-k="absent_with_ot_days">Absent + OT same day</th><th class="n" data-k="sw">Swapped hours</th><th class="n" data-k="xp">Extra pay (h)</th></tr></thead><tbody></tbody></table></div>';
      host.after(card, card2); const qi = card2.querySelector('#q-wfoa'); qi.addEventListener('input', () => window.__draw && window.__draw()); }
    const all = (dash.data('sp_attendance_people') || {}).data || [], m = p.month || (window.__TODAY || '').slice(0, 7);
    const inShop = r => p.shop === 'All' || (/KEIHIN|ZINC/i.test(r.area) ? ['Carburetor'] : r.shop === 'Aluminium Foundry' ? ['Piston', 'Bridge Fork Top'] : [r.shop]).includes(p.shop);
    const base = all.filter(r => r.month === m && inShop(r)), rs = base.filter(r => !sel || r.area === sel).map(r => { const sw = Math.min((r.abs_in_ot_weeks || 0) * 8, r.ot_in_abs_weeks || 0); return { ...r, sw, xp: sw / 2 }; });
    const fl = rs.filter(r => r.sw > 0), f0 = d3.format(','), fx = d3.format(',.1~f'), sc = document.getElementById('wf-oa-sc'), ar = document.getElementById('wf-oa-ar');
    document.getElementById('wf-oa-sub').textContent = `${mon(m)}${sel ? ' · ' + sel : p.shop !== 'All' ? ' · ' + p.shop : ''}. Each dot is a person: absent days in the month (across) against overtime hours (up). Red dots did overtime in the same week (Mon–Sun) they were absent, so the absence is cut at 1.0× while the hours come back at 1.5×; dark red also have overtime on a day marked absent. Bigger dot = more overtime in those weeks. Swapped hours = the smaller of the absent hours (8 a day) and that overtime; the extra pay is half of them.`;
    const K = document.getElementById('wf-oa-k'); K.replaceChildren();
    [['People', f0(fl.length), `of ${f0(rs.length)}`], ['Overtime in absent weeks', f0(Math.round(d3.sum(fl, r => r.ot_in_abs_weeks))) + ' h', ''], ['Swapped hours', f0(Math.round(d3.sum(fl, r => r.sw))) + ' h', ''], ['Extra pay', f0(Math.round(d3.sum(fl, r => r.xp))) + ' h', 'at the normal rate'], ['Absent + OT same day', f0(d3.sum(rs, r => r.absent_with_ot_days || 0)), f0(rs.filter(r => r.absent_with_ot_days > 0).length) + ' people']]
      .forEach(([l, v, s]) => { const d = document.createElement('div'); d.innerHTML = `<span>${esc(l)}</span><b>${esc(v)}</b>${s ? ` <span style="display:inline;letter-spacing:0;text-transform:none">${esc(s)}</span>` : ''}`; K.appendChild(d); });
    if (!rs.some(r => 'ot_in_abs_weeks' in r)) { empty(sc, 'Week-level overtime is not in the attendance data yet'); ar.replaceChildren(); }
    else if (!rs.length) { empty(sc, 'No people for this selection'); ar.replaceChildren(); }
    else {
      const H = 300, { svg, w } = box(sc, H), M = { l: 40, r: 12, t: 10, b: 34 }, xm = Math.max(4, d3.max(rs, r => r.absent) || 0) + .6, ym = (d3.max(rs, r => r.ot_hours) || 10) * 1.08;
      const x = d3.scaleLinear([0, xm], [M.l, w - M.r]), y = d3.scaleLinear([0, ym], [H - M.b, M.t]), rr = d3.scaleSqrt([0, d3.max(fl, r => r.ot_in_abs_weeks) || 1], [3, 9]);
      svg.append('rect').attr('x', x(.5)).attr('y', M.t).attr('width', x(xm) - x(.5)).attr('height', y(Math.min(8, ym)) - M.t).attr('fill', '#FDECEC');
      svg.append('text').attr('x', w - M.r - 4).attr('y', M.t + 13).attr('text-anchor', 'end').attr('font-size', 10.5).style('fill', '#D0312D').text('absent and on overtime');
      const ax = svg.append('g').attr('transform', `translate(0,${H - M.b})`).call(d3.axisBottom(x).ticks(Math.min(10, Math.ceil(xm))).tickSizeOuter(0)), ay = svg.append('g').attr('transform', `translate(${M.l},0)`).call(d3.axisLeft(y).ticks(5).tickSizeOuter(0));
      [ax, ay].forEach(g => { g.selectAll('text').attr('font-size', 10).style('fill', '#5A6670'); g.selectAll('path,line').attr('stroke', '#C9D1D9'); });
      svg.append('text').attr('x', (M.l + w - M.r) / 2).attr('y', H - 4).attr('text-anchor', 'middle').attr('font-size', 10.5).style('fill', '#5A6670').text('Absent days in the month');
      svg.append('text').attr('transform', `translate(11,${(M.t + H - M.b) / 2}) rotate(-90)`).attr('text-anchor', 'middle').attr('font-size', 10.5).style('fill', '#5A6670').text('Overtime hours');
      const jit = r => { let h2 = 0; for (const ch of String(r.emp_id) + r.name) h2 = (h2 * 31 + ch.charCodeAt(0)) % 997; return (h2 / 997 - .5) * .36; };
      [...rs.filter(r => !r.sw), ...fl.sort((a, b) => a.sw - b.sw)].forEach(r => { const f = r.sw > 0;
        svg.append('circle').attr('cx', x(Math.max(0, r.absent + jit(r)))).attr('cy', y(r.ot_hours)).attr('r', f ? rr(r.ot_in_abs_weeks) : 2.6)
          .attr('fill', f ? (r.absent_with_ot_days > 0 ? '#8B1E1B' : '#D0312D') : '#B9C1C9').attr('fill-opacity', f ? .8 : .55).attr('stroke', f ? '#fff' : 'none').attr('stroke-width', .8)
          .on('mousemove', ev => tip.show(ev, [r.name + ' · ' + r.emp_id, r.area + ' · ' + r.section, `Absent ${fx(r.absent)} days · overtime ${fx(r.ot_hours)} h this month`,
            ...(f ? [`Overtime in weeks with an absence: ${fx(r.ot_in_abs_weeks)} h (absent ${fx(r.abs_in_ot_weeks)} days in those weeks)`, r.absent_with_ot_days ? `Overtime on ${r.absent_with_ot_days} day(s) marked absent` : '', `Swapped ${fx(r.sw)} h → extra pay ${fx(r.xp)} h`] : ['No overtime in a week with an absence'])].filter(Boolean)))
          .on('mouseleave', tip.hide); });
      /* by area */
      const ga = d3.rollups(base.map(r => ({ ...r, sw: Math.min((r.abs_in_ot_weeks || 0) * 8, r.ot_in_abs_weeks || 0) })), v => ({ sw: d3.sum(v, r => r.sw), n: v.filter(r => r.sw > 0).length, hc: v.length }), r => r.area).filter(d => d[1].sw > 0).sort((a, b) => b[1].sw - a[1].sw);
      if (!ga.length) empty(ar, 'Nobody did overtime in a week they were absent'); else {
        const rh = 24, h3 = ga.length * rh + 6, bx = box(ar, h3), lw = 132, xs = d3.scaleLinear([0, d3.max(ga, d => d[1].sw)], [lw, bx.w - 70]);
        ga.forEach(([a, o], i) => { const y0 = 3 + i * rh, g = bx.svg.append('g').style('cursor', 'pointer').style('opacity', sel && sel !== a ? .35 : 1);
          g.append('text').attr('x', 0).attr('y', y0 + rh / 2 + 4).attr('font-size', 11.5).style('fill', '#051C2C').style('font-weight', sel === a ? 700 : 500).text(a.length > 22 ? a.slice(0, 21) + '…' : a);
          g.append('rect').attr('x', lw).attr('y', y0 + 4).attr('width', Math.max(1, xs(o.sw) - lw)).attr('height', rh - 8).attr('fill', '#D0312D');
          g.append('text').attr('x', xs(o.sw) + 5).attr('y', y0 + rh / 2 + 4).attr('font-size', 11).style('fill', '#051C2C').style('font-weight', 600).text(`${f0(Math.round(o.sw))} h (${o.n})`);
          g.append('rect').attr('x', 0).attr('y', y0).attr('width', bx.w).attr('height', rh).attr('fill', 'transparent')
            .on('mousemove', ev => tip.show(ev, [a, `${o.n} of ${o.hc} people did overtime in a week they were absent`, `Swapped hours ${f0(Math.round(o.sw))} · extra pay ${f0(Math.round(o.sw / 2))} h`, sel === a ? 'Click to show all areas' : 'Click to filter the page to this area']))
            .on('mouseleave', tip.hide).on('click', () => { tip.hide(); dash.setParams({ wfa: sel === a ? 0 : a }); }); }); } }
    const tb = document.querySelector('#c-w-oal table.tb'), nf1 = v => v ? fx(v) : '—';
    /* 10 Nov (Umair): 'Top 10 Absentees' toggle beside this table's Clear filters. On = the 10 people with the most absent days in the
       month, from everyone in the selected shop (top filter pane) and area, whether or not they did overtime. Kept in the wfoat param. */
    const t10 = !!dash.params().wfoat, rows = t10 ? rs.filter(r => r.absent > 0).sort((a, b) => b.absent - a.absent || (b.sw || 0) - (a.sw || 0)).slice(0, 10) : fl;
    tb.id = t10 ? 'tb-wfoa10' : 'tb-wfoa';   /* own sort memory per view, so Top 10 opens sorted by absent days */
    table(tb, rows, [{ k: 'name' }, { k: 'emp_id' }, { k: 'area' }, { k: 'section' }, { k: 'absent', n: 1, fmt: nf1 }, { k: 'abs_in_ot_weeks', n: 1, fmt: nf1 }, { k: 'ot_hours', n: 1, fmt: nf1 }, { k: 'ot_in_abs_weeks', n: 1, fmt: nf1, color: () => '#D0312D' },
      { k: 'absent_with_ot_days', n: 1, fmt: nf1, color: v => v > 0 ? '#8B1E1B' : null }, { k: 'sw', n: 1, fmt: nf1 }, { k: 'xp', n: 1, fmt: nf1 }], { q: document.getElementById('q-wfoa'), sort: t10 ? 'absent' : 'sw', dir: -1 });
    const bar = document.getElementById('q-wfoa').closest('.qbar');
    if (bar) { let tg = bar.querySelector('.wfoat');
      if (!tg) { tg = document.createElement('button'); tg.type = 'button'; tg.className = 'wfoat'; tg.textContent = 'Top 10 Absentees';
        tg.title = 'Show the 10 people with the most absent days this month (in the shop chosen at the top, if any)';
        tg.addEventListener('click', () => dash.setParams({ wfoat: dash.params().wfoat ? 0 : 1 }));
        const qc = bar.querySelector('.qclr'); qc ? qc.after(tg) : bar.appendChild(tg);
        const fc = document.getElementById('f-clear'); if (fc && !fc._wfoat) { fc._wfoat = 1; fc.addEventListener('click', () => dash.setParams({ wfoat: 0 })); } }
      tg.classList.toggle('on', t10); tg.setAttribute('aria-pressed', t10); }
    const h3 = document.querySelector('#c-w-oal h3'); if (h3) h3.textContent = t10 ? `Who: Top 10 Absentees${p.shop !== 'All' ? ' · ' + p.shop : ''}` : 'Who: Overtime in the Same Week as an Absence';
  };
  window.__wf = (tbl, p, sel, rf) => { P = p || {}; kpis(P, sel, rf); try { oa(P, sel); } catch (e) { console.error(e); }
    tbl.querySelectorAll('tbody tr').forEach(tr => { const c = tr.children; if (c.length < 3) return; const last = c[c.length - 1];
      if (c[1].textContent === '—') { last.textContent = 'Not in sheet'; last.title = 'This shop has no area in the SharePoint attendance sheet'; }
      else if (c[2].textContent === '0') { last.textContent = 'Overtime only'; last.style.color = '#5A6670'; last.style.fontWeight = ''; last.title = 'Only the Overtime sheet uses this section; these people\'s attendance sits under their own sections'; }
      const miss = /^Not /.test(last.textContent); tr.style.background = miss ? '#FDECEC' : ''; tr.title = miss ? 'No attendance entered for this ' + (c[1].textContent === '—' ? 'shop' : 'section') + ' so far' : ''; });
    /* a Clear filter button on both "by Area" charts while a bar is selected */
    ['c-w-abs', 'c-w-ot'].forEach(id => { const h = document.querySelector('#' + id + ' h3'); if (!h) return; let b = h.querySelector('.wfclr');
      if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'qclr fon wfclr'; b.textContent = 'Clear filter'; b.style.cssText = 'margin-left:6px;font-size:11.5px;padding:3px 10px'; b.addEventListener('click', () => dash.setParams({ wfa: 0 })); h.appendChild(b); }
      b.hidden = !sel; b.title = sel ? 'Showing ' + sel + ' only: click to show all areas' : ''; });
    if (tbl._wf) return; tbl._wf = 1;
    tbl.addEventListener('mouseover', ev => { const td = ev.target.closest('td'); if (!td || !td.closest('tbody') || td.cellIndex > 1 || td.parentElement.children.length < 3) return;
      const tr = td.parentElement; show(td, tr.children[0].textContent, td.cellIndex === 1 ? tr.children[1].textContent : null); });
    tbl.addEventListener('mouseout', ev => { const td = ev.target.closest('td'); if (td && td.cellIndex <= 1 && !(ev.relatedTarget && pop.contains(ev.relatedTarget))) hide(); });
  };
})();
/* Excel / PDF export of the "By Area & Section" table (2 Nov, Umair): two buttons beside its search box and Clear filters.
   Each exports the rows as the table shows them now (search, filters and sort applied). The files are built here
   (a plain .xlsx workbook and a .pdf), so no outside library is needed. In the Claude artifact the file goes through
   the downloads capability (the viewer confirms the save); on the portal it downloads straight from the browser. */
(() => {
  const ICON = '<svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" style="vertical-align:-2px;margin-right:5px"><path d="M8 1.5v8.2M4.6 6.6 8 10l3.4-3.4M2.5 11.5v2h11v-2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const css = document.createElement('style');
  css.textContent = '.ael button.qexp{font:inherit;font-size:12.5px;font-weight:600;padding:5px 12px;border:1px solid #D5DBE1;border-radius:4px;background:#fff;color:#051C2C;cursor:pointer;white-space:nowrap}.ael button.qexp:hover{background:#F0F3F6}.ael button.qexp:disabled{opacity:.5;cursor:wait}';
  document.head.appendChild(css);
  const enc = new TextEncoder();
  /* ---- read the table as shown ---- */
  function grab(tbl) {
    const head = [...tbl.tHead.rows[0].cells].map(th => (th.dataset.lbl || th.textContent).replace(/[▲▼]\d?/g, '').trim());
    const trs = [...tbl.tBodies[0].rows].filter(tr => tr.cells.length === head.length), rows = trs.map(tr => [...tr.cells].map(td => td.textContent.trim()));
    /* the colour each cell carries on screen (red / amber flags), as hex, so the files keep the same colour coding */
    const hex = c => { const m = (c || '').match(/\d+/g); return m && m.length >= 3 ? m.slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join('').toUpperCase() : ''; };
    const clr = trs.map(tr => [...tr.cells].map(td => td.style.color ? hex(getComputedStyle(td).color) : ''));
    const numCol = head.map((_, i) => rows.length > 0 && rows.every(r => r[i] === '—' || r[i] === '' || /^-?[\d,]+(\.\d+)?%?$/.test(r[i])));
    return { head, rows, numCol, clr };
  }
  const toNum = s => { if (s === '—' || s === '') return null; const p = s.endsWith('%'); const v = +s.replace(/[,%]/g, ''); return isNaN(v) ? s : p ? +(v / 100).toFixed(8) : v; };
  /* ---- tiny zip (stored, no compression) for the .xlsx ---- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const parts = [], cen = []; let off = 0;
    const u16 = v => [v & 255, (v >>> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    files.forEach(([name, text]) => { const nm = enc.encode(name), data = enc.encode(text), c = crc32(data);
      const loc = [0x50, 0x4b, 3, 4, ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(data.length), ...u32(data.length), ...u16(nm.length), ...u16(0)];
      parts.push(new Uint8Array(loc), nm, data);
      cen.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(data.length), ...u32(data.length), ...u16(nm.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nm);
      off += loc.length + nm.length + data.length; });
    const cl = cen.reduce((t, a) => t + a.length, 0);
    return new Blob([...parts, ...cen, new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cl), ...u32(off), ...u16(0)])]);
  }
  const x = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const col = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  function xlsx(t, title) {
    const cols = [...new Set(t.clr.flat().filter(Boolean))], xf = (kind, c) => c ? 5 + cols.indexOf(c) * 3 + kind : [0, 2, 4][kind];
    const cell = (v, r, c, st) => { const ref = col(c) + r; if (v == null) return `<c r="${ref}"${st ? ` s="${st}"` : ''}/>`; return typeof v === 'number' ? `<c r="${ref}" s="${st || 0}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"${st ? ` s="${st}"` : ''}><is><t xml:space="preserve">${x(v)}</t></is></c>`; };
    const pct = t.head.map((h, i) => t.numCol[i] && t.rows.some(r => r[i].endsWith('%')));
    let rows = `<row r="1">${cell(title, 1, 0, 3)}</row><row r="3">${t.head.map((h, i) => cell(h, 3, i, 1)).join('')}</row>`;
    t.rows.forEach((r, j) => { rows += `<row r="${j + 4}">${r.map((v, i) => { const n = t.numCol[i] ? toNum(v) : (v === '—' ? null : v); return cell(n, j + 4, i, xf(typeof n === 'number' ? (pct[i] ? 2 : 1) : 0, t.clr[j][i])); }).join('')}</row>`; });
    const widths = t.head.map((h, i) => Math.min(48, Math.max(h.length, ...t.rows.map(r => r[i].length)) + 3));
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData><autoFilter ref="A3:${col(t.head.length - 1)}${t.rows.length + 3}"/></worksheet>`;
    const extraF = cols.map(c => `<font><b/><sz val="11"/><color rgb="FF${c}"/><name val="Calibri"/></font>`).join(''), extraX = cols.map((c, k) => [0, 164, 165].map(nf => `<xf numFmtId="${nf}" fontId="${3 + k}" fillId="0" borderId="0" xfId="0" applyFont="1"${nf ? ' applyNumberFormat="1"' : ''}/>`).join('')).join('');
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.##"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts><fonts count="' + (3 + cols.length) + '"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="13"/><name val="Calibri"/></font>' + extraF + '</fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF051C2C"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="' + (5 + cols.length * 3) + '"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' + extraX + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    return zip([
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="By Area &amp; Section" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">\'By Area &amp; Section\'!$A$3:$' + col(t.head.length - 1) + '$' + (t.rows.length + 3) + '</definedName></definedNames></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ['xl/worksheets/sheet1.xml', sheet], ['xl/styles.xml', styles]]);
  }
  /* ---- simple PDF: A4 landscape, Helvetica, repeated header on every page ---- */
  function pdf(t, title, sub) {
    const W = 842, H = 595, M = 28, fs = 7.6, lh = 13, cw = s => [...String(s)].reduce((a, c) => a + (/[0-9]/.test(c) ? 0.556 : /[ilj.,'|:;]/.test(c) ? 0.278 : /[A-Z]/.test(c) ? 0.667 : /[mw]/.test(c) ? 0.833 : 0.52), 0) * fs;
    const tx = s => String(s).replace(/[^\x20-\x7E]/g, c => c === '—' || c === '–' ? '-' : c === '·' ? '-' : '?').replace(/[\\()]/g, '\\$&');
    const need = t.head.map((h, i) => Math.max(cw(h) * 1.06, ...t.rows.map(r => cw(r[i]))) + 8), tot = need.reduce((a, b) => a + b, 0), sc = Math.min(1, (W - 2 * M) / tot), wd = need.map(v => v * sc);
    const clip = (s, w) => { s = String(s); if (cw(s) <= w - 6) return s; while (s.length > 1 && cw(s + '...') > w - 6) s = s.slice(0, -1); return s + '...'; };
    const per = Math.floor((H - 2 * M - 50) / lh), pages = [];
    for (let i = 0; i < Math.max(1, t.rows.length); i += per) pages.push(t.rows.slice(i, i + per));
    const streams = pages.map((rows, pi) => { let s = `BT /F2 12 Tf ${M} ${H - M - 4} Td (${tx(title)}) Tj ET BT /F1 7.5 Tf ${M} ${H - M - 18} Td (${tx(sub + ' - page ' + (pi + 1) + ' of ' + pages.length)}) Tj ET\n`;
      let y = H - M - 40; s += `0.02 0.11 0.17 rg ${M} ${y - 4} ${wd.reduce((a, b) => a + b, 0)} ${lh} re f 1 1 1 rg\n`;
      let xx = M; t.head.forEach((h, i) => { const v = clip(h, wd[i]); s += `BT /F2 ${fs} Tf ${t.numCol[i] ? xx + wd[i] - 3 - cw(v) * 1.06 : xx + 3} ${y} Td (${tx(v)}) Tj ET\n`; xx += wd[i]; });
      s += '0 0 0 rg\n';
      rows.forEach((r, ri) => { y -= lh; if (ri % 2) s += `0.96 0.97 0.98 rg ${M} ${y - 4} ${wd.reduce((a, b) => a + b, 0)} ${lh} re f 0 0 0 rg\n`; xx = M;
        r.forEach((v, i) => { v = clip(v, wd[i]); const c = t.clr[pi * per + ri][i], rgb = c ? [0, 2, 4].map(k => (parseInt(c.slice(k, k + 2), 16) / 255).toFixed(3)).join(' ') + ' rg ' : ''; s += `BT ${rgb}/${c ? 'F2' : 'F1'} ${fs} Tf ${t.numCol[i] ? xx + wd[i] - 3 - cw(v) * (c ? 1.06 : 1) : xx + 3} ${y} Td (${tx(v)}) Tj ET${c ? ' 0 0 0 rg' : ''}\n`; xx += wd[i]; }); });
      return s; });
    const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
    const kids = []; streams.forEach(st => { const sn = objs.length + 1; objs.push(`<< /Length ${enc.encode(st).length} >>\nstream\n${st}endstream`); const pn = objs.length + 1; objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${sn} 0 R >>`); kids.push(pn); });
    objs[1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
    let out = '%PDF-1.4\n', offs = []; objs.forEach((o, i) => { offs.push(enc.encode(out).length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = enc.encode(out).length; out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new Blob([out]);
  }
  /* ---- save ---- */
  async function save(blob, filename) {
    try { const c = window.claude && window.claude.use ? window.claude : null, d = c ? await c.use('downloads') : null;
      if (d) { try { await d.save({ filename, data: blob }); } catch (e) { if (e && e.code !== 'declined') alert('Could not save the file (' + (e.code || e) + ').'); } return; } } catch (e) {}
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function context() {
    const p = window.__P ? window.__P() : {}, m = p.month || (window.__TODAY || '').slice(0, 7), mon = m ? new Date(m + '-01T00:00:00Z').toLocaleString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
    const q = (document.getElementById('q-wf') || {}).value || '';
    return { mon, stamp: (window.__TODAY || new Date().toISOString().slice(0, 10)), sub: ['Manpower · By Area & Section', mon, p.shop && p.shop !== 'All' ? 'Shop: ' + p.shop : '', q ? 'Search: ' + q : '', 'exported ' + new Date().toLocaleString('en-GB', { timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) + ' PKT'].filter(Boolean).join(' · ') };
  }
  function addButtons() {
    const qi = document.getElementById('q-wf'), bar = qi && qi.closest('.qbar'), tbl = document.getElementById('tb-wf');
    if (!bar || !tbl || bar.querySelector('.qexp')) return;
    const mk = (lab, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'qexp'; if (lab === 'Excel') b.style.marginLeft = 'auto'; b.innerHTML = ICON + lab; b.title = `Download this table (rows as shown now) as ${lab}`;
      b.addEventListener('click', async () => { b.disabled = true; try { const t = grab(tbl); if (!t.rows.length) { alert('No rows to export for this selection.'); return; } const c = context(); await fn(t, c); } finally { b.disabled = false; } }); return b; };
    const fn = c => `Manpower by Area & Section ${c.mon || c.stamp}`.replace(/[\\/:*?"<>|]/g, '-');
    bar.append(mk('Excel', (t, c) => save(xlsx(t, 'Manpower: By Area & Section · ' + c.mon), fn(c) + '.xlsx')), mk('PDF', (t, c) => save(pdf(t, 'Manpower: By Area & Section', c.sub), fn(c) + '.pdf')));
  }
  window.__wfExport = { xlsx, pdf };
  const w0 = window.__wf; window.__wf = (...a) => { const r = w0(...a); try { addButtons(); } catch (e) { console.error(e); } return r; };
  addButtons();
})();
