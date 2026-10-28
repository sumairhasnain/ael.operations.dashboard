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
      return { n: c.name, id: c.emp_id, s: c.section, g: c.grade, a: c.absent, ap: pa ? d3.sum(v, r => r.absent) / pa * 100 : null, ot: c.ot_hours, ot3: d3.sum(v, r => r.ot_hours) }; })
      .sort((x, y) => y.a - x.a || y.ot - x.ot || x.n.localeCompare(y.n));
    const col = v => v == null ? '' : v > 10 ? 'color:#D0312D;font-weight:600' : v > 5 ? 'color:#E0A100;font-weight:600' : '';
    const sec = !section;
    pop.innerHTML = `<div class="hd">${esc(area)}${section ? ' · ' + esc(section) : ''} <span>— ${rows.length} people · ${mon(m)}</span></div>` + (rows.length ? `<table><thead><tr><th>Name</th><th>EMP ID</th>${sec ? '<th>Section</th>' : ''}<th class="n">Absent days</th><th class="n">Absent % (3-mo avg)</th><th class="n">OT h (${mon(m)})</th><th class="n">OT h (3 mo)</th></tr></thead><tbody>` +
      rows.map(r => `<tr><td>${esc(r.n)}</td><td>${esc(r.id)}</td>${sec ? `<td>${esc(r.s)}</td>` : ''}<td class="n">${nf(r.a)}</td><td class="n" style="${col(r.ap)}">${r.ap == null ? '—' : d3.format('.1f')(r.ap) + '%'}</td><td class="n">${nf(r.ot)}</td><td class="n">${nf(r.ot3)}</td></tr>`).join('') + '</tbody></table>'
      : `<div class="ft">No person-level attendance for ${mon(m)}.</div>`) +
      `<div class="ft">Absent days count working days only (Sundays skipped). 3-month figures cover ${have.length ? have.map(mon).join(', ') : '—'}${have.length < 3 ? ' so far' : ''}.</div>`;
    pop.style.display = 'block'; pop.scrollTop = 0;
    const rc = td.getBoundingClientRect(), pw = Math.min(pop.offsetWidth, innerWidth - 16), ph = pop.offsetHeight;
    let x = rc.right + 8; if (x + pw > innerWidth - 8) x = Math.max(8, rc.left - pw - 8); if (x < 8) x = 8;
    pop.style.left = x + 'px'; pop.style.top = Math.max(8, Math.min(rc.top - 10, innerHeight - ph - 8)) + 'px';
  };
  window.__wf = (tbl, p) => { P = p || {}; if (tbl._wf) return; tbl._wf = 1;
    tbl.addEventListener('mouseover', ev => { const td = ev.target.closest('td'); if (!td || !td.closest('tbody') || td.cellIndex > 1 || td.parentElement.children.length < 3) return;
      const tr = td.parentElement; show(td, tr.children[0].textContent, td.cellIndex === 1 ? tr.children[1].textContent : null); });
    tbl.addEventListener('mouseout', ev => { const td = ev.target.closest('td'); if (td && td.cellIndex <= 1 && !(ev.relatedTarget && pop.contains(ev.relatedTarget))) hide(); });
  };
})();
