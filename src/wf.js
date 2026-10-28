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
  const PSH = ['Clutch', 'Drum Gear', 'Ignition Coil', 'Hubs', 'Carb Child Parts', 'Carburetor', 'CIF Machining', 'Bridge Fork Top', 'HPDC / Die Cast', 'Piston', 'Polymer', 'Fuel Cock'];
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
     Production tab's Daily Production card: the name on the left, the figure on the right. The two "by Area" charts show the
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
        k.innerHTML = '<div class="ksel"><div class="sn"></div><div class="mn"></div></div><div class="kmini" style="min-width:0"><div class="kl"></div><div class="kv"></div><div class="ks"></div></div>'; hd.appendChild(k); }
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
    const tb = document.getElementById('tb-wfoa'), nf1 = v => v ? fx(v) : '—';
    table(tb, fl, [{ k: 'name' }, { k: 'emp_id' }, { k: 'area' }, { k: 'section' }, { k: 'absent', n: 1, fmt: nf1 }, { k: 'abs_in_ot_weeks', n: 1, fmt: nf1 }, { k: 'ot_hours', n: 1, fmt: nf1 }, { k: 'ot_in_abs_weeks', n: 1, fmt: nf1, color: () => '#D0312D' },
      { k: 'absent_with_ot_days', n: 1, fmt: nf1, color: v => v > 0 ? '#8B1E1B' : null }, { k: 'sw', n: 1, fmt: nf1 }, { k: 'xp', n: 1, fmt: nf1 }], { q: document.getElementById('q-wfoa'), sort: 'sw', dir: -1 });
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
