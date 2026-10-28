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
  window.__wf = (tbl, p, sel, rf) => { P = p || {}; kpis(P, sel, rf);
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
