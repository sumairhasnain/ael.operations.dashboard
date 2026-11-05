/* SPD Supplies - Plan Vs Actual (Production tab; Umair, 5 Nov 2026).
   Plan: the month's sheet of Asif Iqbal's SPD workbook ('SPD STATUS ...xlsx', sheet '01. SPD (Nov 26)'), read once and frozen
   for the whole month (tools/spd_plan.py). Actual: goods issue 601 less 602 of the plan's AAL SPD codes from the daily SAP MB51
   file (tools/sap_spd.py) - all of it leaves the FG stores KHI 0008, KHI 0019 and SKP 0008. Dataset spd_supply.
   Bars per part group: light grey = month plan, dark = supplied so far; the dashed tick is the plan phased to date (from the
   sheet's daily columns; some lines carry only a month total). Click a group to see its parts; the Shop filter narrows groups. */
(() => {
  const AK = window.AK; if (!AK) return;
  const { C, tip, box, empty } = AK;
  const nf = d3.format(','), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dmy = s => s ? `${+s.slice(8, 10)} ${MN[+s.slice(5, 7) - 1]}` : '—';
  const SHOP = { 'FRONT FORK R/L SET': 'Cushion', 'CUSHION ASSY REAR': 'Cushion', 'DAMPER REAR CUSHION': 'Cushion', 'SPRINGS': 'Cushion', 'PIPE FRONT FORK': 'Cushion',
    'CAP ASSY NOISE SUPPR': 'Ignition Coil', 'PISTON KIT': 'Piston', 'CYLINDER KIT': 'CIF Machining', 'CLUTCH ASSY': 'Clutch', 'CLUTCH HOUSING ASSY': 'Clutch',
    'PRESSURE PLATE': 'Clutch', 'MUDGUARD FR/RR FENDER': 'Polymer', 'CASE METER': 'Polymer', 'CARBURETOR': 'Carburetor', 'FUEL COCK ASSY': 'Fuel Cock' };
  const title = s => String(s || '').toLowerCase().replace(/(^|[\s\/(-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  let drill = null;
  const css = document.createElement('style'); css.textContent = `
.ael #c-p-spd .spsub{font-size:12px;color:var(--mut);margin:-4px 0 8px;line-height:1.4}
.ael #c-p-spd .spsub b{color:var(--navy);font-weight:600}
.ael #c-p-spd .spsw{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:-1px;margin:0 4px 0 6px}
.ael #c-p-spd .spback{cursor:pointer;color:var(--navy);text-decoration:underline;margin-right:6px}
.ael #c-p-spd .chart{max-height:812px;overflow-y:auto;scrollbar-color:#C9CED4 transparent;scrollbar-width:thin}`;
  document.head.appendChild(css);
  function ensure() {
    const grid = document.querySelector('#production .grid'); if (!grid || document.getElementById('c-p-spd')) return;
    const card = document.createElement('div'); card.className = 'card wide'; card.id = 'c-p-spd';
    card.innerHTML = `<h3 title="Plan: SPD workbook (Asif Iqbal), frozen for the month. Actual: SAP MB51 goods issue 601 less 602 on the plan's AAL SPD codes, from the FG stores KHI 0008, KHI 0019 and SKP 0008.">SPD Supplies - Plan Vs Actual</h3><div class="spsub" id="sp-sub"></div><div class="chart" id="sp-chart"></div>`;
    const after = document.getElementById('c-p-transit') || document.getElementById('c-p-daily'); if (after) after.after(card); else grid.appendChild(card);
  }
  function render(P) {
    ensure(); const card = document.getElementById('c-p-spd'); if (!card) return;
    const el = document.getElementById('sp-chart'), sub = document.getElementById('sp-sub');
    const d = window.dash && dash.data('spd_supply');
    if (!d || d.status !== 'ok') { card.hidden = false; sub.textContent = ''; if (d && d.status === 'error') empty(el, '● Failed to load'); else el.replaceChildren(); return; }
    const T = Array.isArray(d.data) ? d.data[0] : d.data; let M = (T && T.months) || {};
    if (typeof M === 'string') { try { M = JSON.parse(M); } catch (e) { M = {}; } }
    const m = M[P.month] ? P.month : null;
    if (!m) { card.hidden = !Object.keys(M).length; sub.textContent = ''; empty(el, 'No SPD plan frozen for this month'); return; }
    const mo = M[m]; let items = mo.items || [];
    if (P.shop) { items = items.filter(i => SHOP[i.group] === P.shop); if (!items.length) { card.hidden = true; return; } }
    card.hidden = false;
    const day = Math.min(+((mo.asof || '').slice(8, 10)) || 0, 31);
    const ptd = i => d3.sum((i.plan_days || []).slice(0, day));
    let rows;
    if (drill && items.some(i => i.group === drill)) {
      rows = items.filter(i => i.group === drill).map(i => ({ key: i.code, lab: i.desc || i.code, sub2: `${i.code}${i.model ? ' · ' + i.model : ''}`, plan: i.plan, act: i.actual, ptd: ptd(i), it: [i] }))
        .filter(r => r.plan || r.act).sort((a, b) => b.plan - a.plan || b.act - a.act);
    } else {
      drill = null; const G = d3.group(items, i => i.group);
      rows = [...G].map(([g, a]) => ({ key: g, lab: title(g), sub2: `${a.length} part${a.length === 1 ? '' : 's'}${a[0].resp ? ' · ' + a[0].resp : ''}`, plan: d3.sum(a, i => i.plan), act: d3.sum(a, i => i.actual), ptd: d3.sum(a, ptd), it: a, grp: true }))
        .filter(r => r.plan || r.act).sort((a, b) => b.plan - a.plan);
    }
    const tp = d3.sum(rows, r => r.plan), ta = d3.sum(rows, r => r.act);
    sub.innerHTML = (drill ? `<span class="spback" id="sp-back">‹ All groups</span><b>${esc(title(drill))}</b> · ` : '') +
      `<i class="spsw" style="background:#CDD3DA"></i>month plan <i class="spsw" style="background:${C.navy}"></i>supplied ` +
      `<i class="spsw" style="background:transparent;border-left:2px dashed ${C.navy};border-radius:0;width:0"></i>plan to date · ` +
      `<b>${nf(ta)}</b> of ${nf(tp)} (${tp ? Math.round(ta / tp * 100) : 0}%) to ${dmy(mo.asof)}`;
    const bk = document.getElementById('sp-back'); if (bk) bk.onclick = () => { drill = null; render(window.__P()); };
    if (!rows.length) { empty(el, 'No SPD plan or supply for this selection'); return; }
    const rh = 38, mt = 6, h = rows.length * rh + mt + 6; const { svg, w } = box(el, h);
    const cut = s => s.length > 36 ? s.slice(0, 35) + '…' : s;
    const lw = Math.min(Math.max(...rows.map(r => cut(r.lab).length)) * 6.6 + 14, w * .40);
    const mx = d3.max(rows, r => Math.max(r.plan, r.act, r.ptd)) || 1, x = d3.scaleLinear([0, mx], [lw, w - 92]);
    rows.forEach((r, k) => {
      const y0 = mt + k * rh, g = svg.append('g'), pct = r.plan ? Math.round(r.act / r.plan * 100) : null;
      const behind = r.ptd > 0 && r.act < r.ptd, col = behind ? C.bad : C.navy;
      g.append('text').attr('x', 0).attr('y', y0 + rh / 2 - 2).attr('font-size', 12).style('fill', C.navy).style('font-weight', 600).text(cut(r.lab));
      g.append('text').attr('x', 0).attr('y', y0 + rh / 2 + 12).attr('font-size', 10.5).style('fill', '#5A6670').text(r.sub2);
      if (r.plan) g.append('rect').attr('x', lw).attr('y', y0 + 7).attr('width', Math.max(1, x(r.plan) - lw)).attr('height', rh - 14).attr('fill', '#CDD3DA');
      if (r.act) g.append('rect').attr('x', lw).attr('y', y0 + 12).attr('width', Math.max(1, x(r.act) - lw)).attr('height', rh - 24).attr('fill', col);
      if (r.ptd > 0) g.append('line').attr('x1', x(r.ptd)).attr('x2', x(r.ptd)).attr('y1', y0 + 4).attr('y2', y0 + rh - 4).attr('stroke', C.navy).attr('stroke-width', 1.5).attr('stroke-dasharray', '3 2');
      g.append('text').attr('x', x(Math.max(r.plan, r.act, r.ptd)) + 6).attr('y', y0 + rh / 2 + 4).attr('font-size', 12).style('fill', col).style('font-weight', 700)
        .text(pct == null ? nf(r.act) + ' (no plan)' : `${nf(r.act)} · ${pct}%`);
      const lines = [r.grp ? title(r.key) : (r.it[0].desc || r.key), r.grp ? r.sub2 : `${r.it[0].code} · AHL ${r.it[0].ahl_code || '—'} · ${r.it[0].model || ''}`,
        `Month plan (frozen ${dmy((mo.plan_frozen_at || '').slice(0, 10))}): ${nf(r.plan)}`,
        r.ptd > 0 ? `Plan to ${dmy(mo.asof)} (sheet's daily phasing): ${nf(r.ptd)}` : 'No daily phasing to date in the sheet',
        `Supplied to ${dmy(mo.asof)} (601 less 602): ${nf(r.act)}${pct == null ? '' : ` · ${pct}% of month`}`];
      if (!r.grp) { const bs = r.it[0].by_store || {}; Object.keys(bs).forEach(s => lines.push(`  ${s}: ${nf(bs[s])}`)); }
      else lines.push('Click to see the parts');
      g.append('rect').attr('x', 0).attr('y', y0).attr('width', w).attr('height', rh).attr('fill', 'transparent').style('cursor', r.grp ? 'pointer' : 'default')
        .on('mousemove', ev => tip.show(ev, lines)).on('mouseleave', tip.hide)
        .on('click', () => { if (r.grp) { tip.hide(); drill = r.key; render(window.__P()); } });
    });
    svg.append('line').attr('x1', lw).attr('x2', lw).attr('y1', mt).attr('y2', h).attr('stroke', C.navy);
    const sv = el.querySelector('svg'); if (sv) sv.setAttribute('preserveAspectRatio', 'xMinYMin meet');
  }
  const d0 = window.__draw; if (d0) window.__draw = (...a) => { const r = d0(...a); if (window.__page === 'production') { try { render(window.__P()); } catch (e) {} } return r; };
  try { if (window.__page === 'production' && window.__P) render(window.__P()); } catch (e) {}
})();
