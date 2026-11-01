/* F.O.M tab (1 Nov, Umair): month report in the layout of the AEL "Manufacturing Sales" sheet, on a 16:9 page.
   Actuals come from Atlas: sales (dispatch) month to date for finished parts, production for in-house castings and
   piston SPD (Atlas has no dispatch for those). Lines Atlas does not cover show a dash until a source is linked.
   Budgets come later from Umair's SharePoint budget file; until then Budget and % show a dash.
   FOM.blob is the uploaded data file (Claude artifact); on the portal the "fom" dataset is read from the database. */
(() => {
  const FOM = { blob: 'ff93fd78f00ec881c859a22e44244002' };
  const nf = d3.format(',.0f'), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let data = null, loading = false, built = false, month = null;
  const css = document.createElement('style'); css.textContent = `
#fom .fombar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:2px 0 12px}#fom .fombar h2{font-family:var(--font-anthropic-serif);font-weight:400;font-size:24px;color:var(--navy);margin:0 8px 0 0}
#fom .fombar button{font:inherit;font-size:12.5px;padding:5px 12px;border:0;border-radius:4px;background:#E9EDF1;color:var(--navy);cursor:pointer}#fom .fombar button.on{background:#051C2C;color:#fff}
#fom .fombar .fn{font-size:12px;color:var(--mut)}
#fom .pg{container-type:inline-size;width:100%;max-width:1500px;aspect-ratio:16/9;background:#fff;border:1px solid #D5DBE1;box-shadow:0 2px 10px rgba(5,28,44,.08);padding:1.1cqw 1.2cqw;box-sizing:border-box;display:flex;flex-direction:column;gap:.9cqw;overflow:hidden;font-family:var(--font-anthropic-sans)}
#fom .ttl{background:#1F3A5F;color:#fff;text-align:center;font-weight:700;font-size:1.05cqw;letter-spacing:.04em;padding:.35cqw 0}
#fom .cols{display:grid;grid-template-columns:1fr 1fr;gap:.9cqw;flex:1;min-height:0}#fom .col{display:flex;flex-direction:column;gap:.9cqw;min-width:0}
#fom table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:.8cqw;color:#111}
#fom th,#fom td{border:1px solid #9AA5B1;padding:.18cqw .4cqw;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#fom .sec th{background:#1F3A5F;color:#fff;font-weight:700;text-align:center;letter-spacing:.02em;border-color:#1F3A5F}
#fom .grp th{font-weight:700;text-align:center;border-color:#fff}#fom .grp .m{background:#000;color:#fff}#fom .grp .y{background:#9B9B9B;color:#fff}#fom .grp .b{background:#fff;border-color:#9AA5B1}
#fom .hd th{background:#fff;font-weight:700;text-align:center}#fom .hd th:first-child{text-align:left}
#fom td.n{text-align:right;font-variant-numeric:tabular-nums}#fom td.a{background:#DCE6F1}#fom td.p{text-align:center}
#fom tr.tot td{font-weight:700}#fom tr.sub td{background:#D9D9D9;font-weight:700}#fom tr.dt td{background:#EEF3F9;font-weight:700}
#fom .na{color:#9AA5B1}#fom sup{font-size:.6cqw;color:#5A6670;line-height:0}
#fom .det{border-collapse:collapse}#fom .det .sec th{text-align:left}#fom .det .hd th{background:#E9E2CF}
#fom .ft{font-size:.66cqw;color:#5A6670;line-height:1.35;margin-top:auto}`;
  document.head.appendChild(css);
  const portal = () => window.__PORTAL;
  function init() {
    const P = portal(); if (P && P.canTab && !P.canTab('fom')) return;
    const tabs = document.getElementById('tabs'), root = document.getElementById('ael') || document.body; if (!tabs || document.getElementById('t-fom')) return;
    const b = document.createElement('button'); b.className = 'tab'; b.id = 't-fom'; b.setAttribute('role', 'tab'); b.dataset.p = 'fom'; b.textContent = 'F.O.M'; b.title = 'Manufacturing sales for the month and the year, budget vs actual';
    b.addEventListener('click', ev => { ev.stopPropagation(); open(); }, true);
    const os = document.getElementById('t-openstock'); if (os) os.before(b); else tabs.appendChild(b);
    const sec = document.createElement('section'); sec.className = 'page'; sec.id = 'fom'; const last = [...root.querySelectorAll('section.page')].pop(); if (last) last.after(sec); else root.appendChild(sec);
    if (location.hash === '#fom') open();
  }
  function open() { window.__page = 'fom'; document.querySelectorAll('#ael .page, section.page').forEach(s => s.classList.toggle('on', s.id === 'fom'));
    document.querySelectorAll('#tabs .tab').forEach(t => t.setAttribute('aria-selected', t.id === 't-fom' ? 'true' : 'false')); render(); }
  const one = x => Array.isArray(x) ? x[0] : x;
  async function load() {
    const Pt = window.Portal;
    if (portal() && Pt && Pt.sb) { const { data, error } = await Pt.sb.from('datasets').select('data').eq('name', 'fom').maybeSingle(); if (error || !data) throw new Error('no data'); return one(data.data); }
    /* Claude artifact: the "fom" dataset (kept current by the F.O.M update task); the uploaded file is the fallback */
    try { const d = window.dash && dash.data('fom'); if (d && d.status === 'ok' && d.data && d.data.length) { const o = one(d.data); for (const k of ['months', 'budget', 'codes', 'source']) if (typeof o[k] === 'string') o[k] = JSON.parse(o[k]); return o; } } catch (e) {}
    return one(await (await fetch('/_blob/' + FOM.blob)).json());
  }
  /* report layout: [id, label, kind]; kind: '' item, 'tot' total, 'sub' grey sub-heading, 'dt' detail total */
  const TC = [['tc_cushion', 'CUSHION'], ['tc_clutch', 'CLUTCH'], ['tc_carb', 'CARBURETOR'], ['tc_dgs', 'DRUM GEAR SHIFT'], ['tc_oilpump', 'OIL PUMP'], ['tc_coil', 'COIL IGNITION'], ['tc_piston', 'PISTON']];
  const PO = [['po_batc', 'BATTERY CONTAINERS'], ['po_batl', 'BATTERY LIDS'], ['po_mc', 'MOTORCYCLE PARTS'], ['po_car', 'CAR PARTS'], ['po_spd', 'POLYMER SPD'], ['po_pack', 'Packaging & Warehousing']];
  const CI = [['ci_sleeve', 'SLEEVE'], ['ci_cyl', 'CYLINDER'], ['-', 'AAL PARTS', 'sub'], ['ci_boss', 'BOSS CLUTCH CENTER'], ['ci_dp', 'DRIVE PLATE'], ['ci_dg', 'DRUM GEAR']];
  const AL = [['al_cyl', 'CYLINDER CG (CASTED)'], ['al_bft', 'BFT'], ['al_hub', 'HUB FRONT / REAR'], ['al_cov', 'COVERS'], ['al_bs', 'BRAKE SHOE'], ['al_hpdc', 'CLUTCH INHOUSE (HPDC)']];
  const SP = [['-', 'INHOUSE', 'sub'], ['sp_piston', 'PISTON SPD'], ['-', 'CUSHION PARTS', 'sub'], ['sp_ff', 'FRONT FORK'], ['sp_rc', 'REAR CUSHION'], ['sp_clutch', 'Clutch SPD'], ['sp_other', 'OTHER PARTS'], ['-', 'VENDOR', 'sub'], ['sp_vendor', 'VENDOR']];
  function fy(m) { const s = +(data.fy_start || '07'); const [y, mo] = m.split('-').map(Number); const y0 = mo >= s ? y : y - 1; return Object.keys(data.months).filter(k => { const [ky, km] = k.split('-').map(Number); return (ky > y0 || (ky === y0 && km >= s)) && k <= m; }); }
  const val = (ms, id) => { const v = ms.map(k => (data.months[k] || {})[id]); return v.some(x => x != null) ? d3.sum(v, x => x || 0) : null; };
  const bud = (ms, id) => { const B = data.budget; if (!B) return null; const v = ms.map(k => (B[k] || {})[id]); return v.some(x => x != null) ? d3.sum(v, x => x || 0) : null; };
  const num = v => v == null ? '<span class="na">—</span>' : nf(v), dec = v => v == null ? '<span class="na">—</span>' : d3.format(',.2f')(v);
  const pct = (a, b) => (a == null || !b) ? '<span class="na">—</span>' : Math.round(a / b * 100) + '%';
  const mark = id => '';
  function cells(id, mm, yy, cls) { const am = val(mm, id), bm = bud(mm, id), ay = val(yy, id), by = bud(yy, id);
    return `<td class="n a">${num(am)}</td><td class="n">${num(bm)}</td><td class="p">${pct(am, bm)}</td><td class="n a">${num(ay)}</td><td class="n">${num(by)}</td><td class="p">${pct(ay, by)}</td>`; }
  function sum(ids, ms, f) { const v = ids.map(id => f(ms, id)); return v.every(x => x == null) ? null : d3.sum(v, x => x || 0); }
  function totCells(ids, mm, yy) { const am = sum(ids, mm, val), bm = sum(ids, mm, bud), ay = sum(ids, yy, val), by = sum(ids, yy, bud);
    return `<td class="n a">${num(am)}</td><td class="n">${num(bm)}</td><td class="p">${pct(am, bm)}</td><td class="n a">${num(ay)}</td><td class="n">${num(by)}</td><td class="p">${pct(ay, by)}</td>`; }
  const head = (title, w) => `<colgroup><col style="width:${w}%">${'<col>'.repeat(6)}</colgroup><thead><tr class="sec"><th colspan="7">${title}</th></tr><tr class="grp"><th class="b"></th><th class="m" colspan="3">FOR THE MONTH</th><th class="y" colspan="3">FOR THE YEAR</th></tr><tr class="hd"><th>PRODUCT</th><th>Actual</th><th>Budget</th><th>%</th><th>Actual</th><th>Budget</th><th>%</th></tr></thead>`;
  function block(title, rows, mm, yy, totLabel, extra = '') {
    const ids = rows.filter(r => r[0] !== '-').map(r => r[0]);
    return `<table>${head(title, 30)}<tbody>${rows.map(([id, lab, k]) => k === 'sub' ? `<tr class="sub"><td colspan="7">${esc(lab)}</td></tr>` : `<tr><td title="${esc(tip(id))}">${esc(lab)}${mark(id)}</td>${cells(id, mm, yy)}</tr>`).join('')}<tr class="tot"><td>${totLabel}</td>${totCells(ids, mm, yy)}</tr>${extra}</tbody></table>`;
  }
  const tip = id => { const c = (data.codes || {})[id]; if (!c) return id === 'sp_piston' ? 'Typed in the AEL sheet (SPD Demand)' : ''; const n = c.filter(x => x[3] !== 0).length; return `${n} SAP codes with movement (${c.filter(x => x[2] === 'P').length ? 'sales and production' : 'sales'}), same factors as the AEL F.O.M sheet`; };
  async function render() {
    const sec = document.getElementById('fom'); if (!sec) return;
    if (!built) { built = true; sec.innerHTML = `<div class="fombar"><h2>F.O.M</h2><span id="fom-m"></span><span class="fn" id="fom-n"></span></div><div class="pg" id="fom-pg"></div>`;
      sec.querySelector('#fom-m').addEventListener('click', ev => { const b = ev.target.closest('button[data-m]'); if (!b) return; month = b.dataset.m; draw(); }); }
    if (!data && !loading) { loading = true; try { data = await load(); } catch (e) { sec.querySelector('#fom-n').textContent = 'Could not load the report data'; } loading = false; }
    if (!data) return;
    const ms = Object.keys(data.months).sort(); if (!month || !ms.includes(month)) month = ms[ms.length - 1];
    sec.querySelector('#fom-m').innerHTML = ms.map(m => `<button data-m="${m}"${m === month ? ' class="on"' : ''}>${MN[+m.slice(5) - 1]} ${m.slice(0, 4)}</button>`).join(' ');
    draw();
  }
  function draw() {
    const sec = document.getElementById('fom'); if (!data || !sec) return;
    sec.querySelectorAll('#fom-m button').forEach(b => b.classList.toggle('on', b.dataset.m === month));
    const mm = [month], yy = fy(month), lab = m => MN[+m.slice(5) - 1] + ' ' + m.slice(2, 4);
    const src = (data.source || {})[month]; sec.querySelector('#fom-n').textContent = `Year = ${lab(yy[0])} to ${lab(month)} · ` + (src === 'sheet' ? 'AEL F.O.M sheet (SAP MB51)' : `live from Atlas to ${data.asof}; lines Atlas can't cover show — until SAP MB51 is linked`) + (data.budget ? ' · budget 2026-27' : '');
    const ciIds = CI.filter(r => r[0] !== '-').map(r => r[0]), alIds = AL.map(r => r[0]);
    const aci = `<table>${head('ALUMINIUM AND CAST IRON PARTS (UNITS)', 30)}<tbody><tr><td>CAST IRON PARTS</td>${totCells(ciIds, mm, yy)}</tr><tr><td>ALUMINIUM PARTS</td>${totCells(alIds, mm, yy)}</tr><tr class="tot"><td>TOTAL</td>${totCells(ciIds.concat(alIds), mm, yy)}</tr></tbody></table>`;
    const dcell = id => { const a = val(mm, id), b = bud(mm, id); return `<td class="n">${num(a)}</td><td class="n">${num(b)}</td><td class="p">${pct(a, b)}</td>`; };
    const dtot = ids => { const a = sum(ids, mm, val), b = sum(ids, mm, bud); return `<td class="n">${num(a)}</td><td class="n">${num(b)}</td><td class="p">${pct(a, b)}</td>`; };
    const det = `<table class="det"><colgroup><col style="width:40%"><col><col><col></colgroup><thead><tr class="sec"><th>CAST IRON AND ALUMINIUM PARTS DETAILS</th><th colspan="3" style="background:#fff;color:#111;text-align:center;border-color:#9AA5B1">FOR THE MONTH</th></tr><tr class="hd"><th>PRODUCT</th><th>Actual</th><th>Budget</th><th>%</th></tr></thead><tbody>
${CI.map(([id, l, k]) => k === 'sub' ? `<tr class="sub"><td colspan="4">${l}</td></tr>` : `<tr><td title="${esc(tip(id))}">${l}${mark(id)}</td>${dcell(id)}</tr>`).join('')}<tr class="dt"><td>CAST IRON PARTS</td>${dtot(ciIds)}</tr>
${AL.map(([id, l]) => `<tr><td title="${esc(tip(id))}">${l}${mark(id)}</td>${dcell(id)}</tr>`).join('')}<tr class="dt"><td>ALUMINIUM PARTS</td>${dtot(alIds)}</tr></tbody></table>`;
    const all = (f, ms, id) => ms.every(k => ((f === bud ? data.budget : data.months)[k] || {})[id] != null) ? f(ms, id) : null;   /* revenue / raw material: a year figure only when every month has one */
    const xc = (id, mm, yy) => { const am = val(mm, id), bm = bud(mm, id), ay = all(val, yy, id), by = all(bud, yy, id); return `<td class="n a">${dec(am)}</td><td class="n">${dec(bm)}</td><td class="p">${pct(am, bm)}</td><td class="n a">${dec(ay)}</td><td class="n">${dec(by)}</td><td class="p">${pct(ay, by)}</td>`; };
    const poExtra = `<tr class="tot"><td style="font-size:.68cqw">RAW MATERIAL USED (METRIC TONS)</td>${xc('x_rm', mm, yy)}</tr><tr class="tot"><td>REVENUE (RS. IN MILLION)</td>${xc('x_rev_po', mm, yy)}</tr>`;
    const spExtra = `<tr class="tot"><td>REVENUE (RS. IN MILLION)</td>${xc('x_rev_sp', mm, yy)}</tr>`;
    sec.querySelector('#fom-pg').innerHTML = `<div class="ttl">MANUFACTURING SALES · ${MN[+month.slice(5) - 1].toUpperCase()} ${month.slice(0, 4)}</div><div class="cols"><div class="col">
${block('TECHNICAL COLLABORATION PARTS (UNITS)', TC, mm, yy, 'TOTAL')}${aci}${block('SPARE PARTS', SP, mm, yy, 'TOTAL', spExtra)}</div><div class="col">
${block('POLYMER (UNITS)', PO, mm, yy, 'TOTAL', poExtra)}${det}
<div class="ft">Year = from 1 July, all months added (Jul–Oct). Jul–Oct actuals: AEL F.O.M sheet, Oct-26 Final (SAP MB51 sales 601/602 and production 101/102, same code lists and factors). From Nov: lines Atlas covers are live from Atlas sales and production with the same code lists; the rest show — until SAP MB51 is linked. Budget: AEL budget 2026-27. Revenue and raw material are shown where the sheet has them. Hover a product for its SAP codes.</div></div></div>`;
  }
  const d0 = window.__draw; if (d0) window.__draw = (...a) => { const r = d0(...a); if (window.__page === 'fom') { try { render(); } catch (e) {} } return r; };
  init();
})();
