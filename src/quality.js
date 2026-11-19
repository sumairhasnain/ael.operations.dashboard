/* Quality tab (19 Nov 2026, Umair): incoming and in-house quality from SAP for every finished good and every SAP BOM sub-level.
   Data: dataset "quality_sap" (tools/quality_build.py from the MB51 quality movements + MB52 hold stock).
   SAP has no defect codes, so defect names are cleaned from the SAP posting text and grouped into defect types by keywords.
   Lots are goods receipts (101): part + vendor + posting date + Reference (DC). Everything is on this one page:
   KPIs, daily trend, defect Pareto with drill-down to defect names, vendor and part scorecards, hold ageing, time to
   disposition, critical-parts monitoring, BOM drill-down from an FG to its sub-level items, lot and event logs, and
   panels for line-rejection logs, warranty and Cp/Cpk (Cp/Cpk can be worked out here from pasted measurements). */
(() => {
  const nf = d3.format(','), n1 = d3.format(',.1f'), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dmy = s => s ? `${+s.slice(8, 10)} ${MN[+s.slice(5, 7) - 1]}` : '—';
  const qf = v => v == null || isNaN(v) ? '—' : Math.abs(v) >= 100 ? nf(Math.round(v)) : Math.abs(v) >= 10 ? n1(v) : d3.format(',.2~f')(v);
  const rs = v => v == null || !v ? '—' : Math.abs(v) >= 1e6 ? `${n1(v / 1e6)}M` : Math.abs(v) >= 1e3 ? `${nf(Math.round(v / 1e3))}K` : nf(Math.round(v));
  const ppm = (r, b) => b > 0 && r <= b ? r / b * 1e6 : null;   /* no PPM when the rejected stock came from receipts before this month (rejected > received) */
  const TC = { 'Dimensional': '#2251FF', 'Plating / Surface': '#00A9F4', 'Crack / Breakage': '#D0312D', 'Leakage': '#7B4FB8', 'Missing / Assembly': '#C98300', 'Material / Hardness': '#1E8C5A', 'Process allowance': '#8A6D3B', 'Other': '#9AA5B1', 'Unspecified': '#C9CED4' };
  const KIND = { qi_reject: 'Rejected at inspection', reject_transfer: 'Moved to rejection store', rej_store_out: 'Moved out of rejection store', rtv: 'Returned to vendor', scrap: 'Scrapped', block: 'Blocked (hold)', unblock: 'Released from block', rej_count_adj: 'Count adjustment in rejection store', return_rps: 'Return into rejection store (RPS)' };
  const ST = { origin: 'All', level: 'All', src: 'All', q: '', sel: null, dtype: null, fg: null, view: 'events', psort: 'rej', vsort: 'rej' };
  let D = null, built = false, lastP = null;
  const css = document.createElement('style'); css.textContent = `
#quality .qbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:2px 0 8px}
#quality .qbar h2{font-family:var(--font-anthropic-serif,inherit);font-weight:400;font-size:24px;color:var(--navy);margin:0 10px 0 0}
#quality .grp{display:inline-flex;gap:3px;align-items:center;margin-right:6px}#quality .grp>span{font-size:11.5px;color:var(--mut);margin-right:3px}
#quality .chip{font:inherit;font-size:12px;padding:4px 10px;border:0;border-radius:14px;background:#E9EDF1;color:var(--navy);cursor:pointer}
#quality .chip.on{background:#051C2C;color:#fff}
#quality .qbar input[type=search]{font:inherit;font-size:12.5px;padding:5px 8px;border:1px solid var(--line);border-radius:4px;width:230px;color:var(--navy)}
#quality .src{font-size:11.5px;color:var(--mut);margin:-2px 0 8px;line-height:1.4}
#quality .selbar{display:none;align-items:center;gap:8px;font-size:12.5px;margin:0 0 10px;padding:6px 10px;background:#EAF0FF;border-left:3px solid #2251FF;color:var(--navy)}
#quality .selbar.on{display:flex}#quality .selbar button{font:inherit;font-size:12px;border:0;background:#D0312D;color:#fff;border-radius:4px;padding:3px 9px;cursor:pointer;margin-left:auto}
#quality .kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:12px}
#quality .kpi{background:#fff;border:1px solid var(--line);border-top:3px solid var(--navy);padding:9px 11px;min-width:0}
#quality .kpi span{display:block;font-size:11.5px;color:var(--mut);line-height:1.25}#quality .kpi b{display:block;font-size:21px;color:var(--navy);font-weight:600;margin:3px 0 1px;font-variant-numeric:tabular-nums}
#quality .kpi small{display:block;font-size:11px;color:var(--mut);line-height:1.3}
#quality .kpi.r{border-top-color:#D0312D}#quality .kpi.o{border-top-color:#C98300}#quality .kpi.g{border-top-color:#1E8C5A}#quality .kpi.b{border-top-color:#2251FF}
#quality .row2{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:12px;margin-bottom:12px}
#quality .row2e{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;margin-bottom:12px}
#quality .row3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:12px}
#quality .card{min-width:0}#quality .card h3{margin:0 0 2px;font-size:14px;color:var(--navy)}#quality .card .h{font-size:11.5px;color:var(--mut);margin-bottom:8px;line-height:1.35}
#quality .seg{display:flex;gap:4px;flex-wrap:wrap;margin:0 0 8px}
#quality .seg button{font:inherit;font-size:12px;padding:4px 9px;border:1px solid var(--line);background:#fff;color:var(--navy);border-radius:4px;cursor:pointer}
#quality .seg button.on{background:#051C2C;color:#fff;border-color:#051C2C}#quality .seg button i{font-style:normal;opacity:.7;margin-left:4px}
#quality .tw{max-height:460px;overflow:auto;border:1px solid var(--line)}
#quality table{width:100%;border-collapse:collapse;font-size:12px}
#quality th{position:sticky;top:0;background:#F4F6F9;color:var(--navy);font-weight:600;text-align:left;padding:6px 7px;border-bottom:1px solid var(--line);white-space:nowrap;z-index:1}
#quality th[data-s]{cursor:pointer}#quality th[data-s]:hover{color:#2251FF}
#quality td{padding:5px 7px;border-bottom:1px solid #EEF1F4;vertical-align:top}#quality td.n,#quality th.n{text-align:right;font-variant-numeric:tabular-nums}
#quality tr.it{cursor:pointer}#quality tr.it:hover td{background:#F4F8FF}#quality tr.sel td{background:#EAF0FF}#quality td .cd{display:block;font-size:10.5px;color:var(--mut)}
#quality .tag{display:inline-block;font-size:10.5px;font-weight:600;padding:1px 6px;border-radius:8px;white-space:nowrap}
#quality .t-r{background:#FDECEA;color:#B42318}#quality .t-o{background:#FFF3E0;color:#9A6200}#quality .t-g{background:#E8F6EE;color:#1E6B4A}#quality .t-b{background:#EAF0FF;color:#2251FF}#quality .t-n{background:#F0F2F5;color:#5A6670}
#quality .ins{font-size:12.5px;line-height:1.5;color:var(--ink);margin:0;padding-left:16px}#quality .ins li{margin-bottom:5px}
#quality .note{font-size:11px;color:var(--mut);margin-top:6px;line-height:1.4}
#quality svg text{font-family:inherit}#quality .ax text{font-size:10.5px;fill:#5A6670}#quality .ax path,#quality .ax line{stroke:#C9CED4}
#quality .lg{display:flex;gap:12px;flex-wrap:wrap;font-size:11.5px;color:var(--mut);margin:4px 0}#quality .lg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
#quality .empty{padding:22px;color:var(--mut);font-size:12.5px;text-align:center}
#quality .wait{border:1px dashed #C9CED4;background:#FAFBFC;padding:12px;font-size:12px;color:var(--mut);line-height:1.5}
#quality .wait b{color:var(--navy)}#quality .wait code{font-size:11px;background:#EEF1F4;padding:1px 4px;border-radius:3px}
#quality .tree td.p{white-space:nowrap}#quality .tree .lv{display:inline-block;font-size:10px;color:#5A6670;background:#F0F2F5;border-radius:3px;padding:0 4px;margin-right:5px}
#quality .bar{position:relative;height:10px;background:#F0F2F5;border-radius:2px;min-width:70px}#quality .bar i{position:absolute;left:0;top:0;bottom:0;border-radius:2px}
#quality .cpk textarea{width:100%;height:92px;font:12px/1.35 ui-monospace,monospace;border:1px solid var(--line);border-radius:4px;padding:6px;box-sizing:border-box}
#quality .cpk .r{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0;font-size:12px;color:var(--mut)}
#quality .cpk input{font:inherit;font-size:12px;width:80px;padding:4px 6px;border:1px solid var(--line);border-radius:4px}
#quality .cpk .out{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:6px 0}
#quality .cpk .out div{border:1px solid var(--line);padding:5px 7px}#quality .cpk .out span{display:block;font-size:10.5px;color:var(--mut)}#quality .cpk .out b{font-size:16px;color:var(--navy)}
#qa-tip{position:fixed;z-index:9999;pointer-events:none;background:#fff;border:1px solid #C9CED4;box-shadow:0 6px 20px rgba(5,28,44,.18);padding:9px 11px;font-size:11.5px;color:#051C2C;max-width:560px;display:none;border-radius:4px;line-height:1.45}
#qa-tip table{border-collapse:collapse;margin-top:5px;font-size:11px}#qa-tip td,#qa-tip th{padding:2px 6px;border-bottom:1px solid #EEF1F4;text-align:left;white-space:nowrap}
@media (max-width:1100px){#quality .kpis{grid-template-columns:repeat(2,minmax(0,1fr))}#quality .row2,#quality .row2e,#quality .row3{grid-template-columns:1fr}}`;
  document.head.appendChild(css);
  const one = x => Array.isArray(x) ? x[0] : x;
  function data() {
    const a = window.dash && dash.data('quality_sap');
    if (!a || a.status !== 'ok' || !a.data || !a.data.length) return a && a.status === 'error' ? 'err' : a && a.status === 'denied' ? 'denied' : null;
    if (!D) {
      D = one(a.data); ['events', 'releases', 'lots', 'disp', 'pending', 'holds', 'stock', 'received', 'produced', 'parts', 'vendors', 'tree', 'critical', 'fg_names', 'fg_shop'].forEach(k => { if (typeof D[k] === 'string') D[k] = JSON.parse(D[k]); });
      D.P = new Map(Object.entries(D.parts || {})); D.V = D.vendors || {};
      D.events.forEach(e => { e.lvl = (D.P.get(e.code) || {}).lvl; });
      D.crit = new Map((D.critical || []).map(c => [c.code, c]));
    }
    return 'ok';
  }
  const tip = (() => { let t = null; return { show(ev, html) { if (!t) { t = document.createElement('div'); t.id = 'qa-tip'; document.body.appendChild(t); } t.innerHTML = html; t.style.display = 'block'; this.move(ev); },
    move(ev) { if (!t) return; const w = t.offsetWidth, h = t.offsetHeight; let x = ev.clientX + 14, y = ev.clientY + 14; if (x + w > innerWidth - 8) x = ev.clientX - w - 14; if (y + h > innerHeight - 8) y = Math.max(8, ev.clientY - h - 14); t.style.left = x + 'px'; t.style.top = y + 'px'; },
    hide() { if (t) t.style.display = 'none'; } }; })();
  const part = c => D.P.get(c) || {};
  const pname = c => { const e = D.events.find(x => x.code === c); return (e && e.part) || part(c).name || (D.stock.find(s => s.code === c) || {}).part || (D.crit.get(c) || {}).part || c; };
  const vname = v => v ? (D.V[v] || `Vendor ${v}`) : 'In-house';
  const lvlTag = l => l == null ? '<span class="tag t-n">not in BOM</span>' : l === 0 ? '<span class="tag t-b">FG</span>' : `<span class="tag t-n">L${l}</span>`;
  const srcOf = c => { const p = part(c); return p.src || ''; };
  /* ---------- filters ---------- */
  const shopOk = (c, P) => !P || !P.shop || P.shop === 'All' || part(c).shop === P.shop || (part(c).fg || []).some(f => (D.fg_shop || {})[f] === P.shop);
  const lvlOk = c => { const l = part(c).lvl; return ST.level === 'All' || (ST.level === 'FG' ? l === 0 : ST.level === 'Sub' ? l > 0 : l == null); };
  const srcOk = c => ST.src === 'All' || srcOf(c) === ST.src;
  const selOk = (code, vendor, e) => { const s = ST.sel; if (!s) return true; if (s.t === 'part') return code === s.v; if (s.t === 'vendor') return vendor === s.v; if (s.t === 'fg') return (part(code).fg || []).includes(s.v) || code === s.v;
    if (s.t === 'defect') return e && e.defect === s.v; if (s.t === 'dtype') return e && e.dtype === s.v; if (s.t === 'day') return e && e.d === s.v; return true; };
  const qOk = (code, vendor, e) => !ST.q || `${code} ${pname(code)} ${vendor || ''} ${vname(vendor)} ${e ? e.defect + ' ' + e.text + ' ' + e.ref : ''}`.toLowerCase().includes(ST.q);
  const oOk = o => ST.origin === 'All' || (ST.origin === 'Vendor' ? o === 'vendor' : o === 'inhouse');
  const evOk = (e, P) => shopOk(e.code, P) && lvlOk(e.code) && srcOk(e.code) && oOk(e.origin) && selOk(e.code, e.vendor, e) && qOk(e.code, e.vendor, e);
  const codeOk = (c, v, P, o) => shopOk(c, P) && lvlOk(c) && srcOk(c) && (o == null || oOk(o)) && selOk(c, v, null) && qOk(c, v, null) && !(ST.sel && /defect|dtype|day/.test(ST.sel.t));
  function setSel(t, v, lab) { ST.sel = ST.sel && ST.sel.t === t && ST.sel.v === v ? null : { t, v, lab }; draw(); }
  /* ---------- shell ---------- */
  function shell(sec) {
    sec.innerHTML = `<div class="qbar"><h2>Quality</h2>
<span class="grp"><span>Source</span>${['All', 'Vendor', 'In-house'].map(x => `<button class="chip" data-g="origin" data-v="${x}">${x}</button>`).join('')}</span>
<span class="grp"><span>BOM level</span>${[['All', 'All'], ['FG', 'Finished goods'], ['Sub', 'Sub-levels'], ['None', 'Not in BOM']].map(([v, l]) => `<button class="chip" data-g="level" data-v="${v}">${l}</button>`).join('')}</span>
<span class="grp"><span>Part type</span>${['All', 'In-house', 'Vendor', 'Imported'].map(x => `<button class="chip" data-g="src" data-v="${x}">${x}</button>`).join('')}</span>
<input type="search" id="qa-q" placeholder="Search part, code, vendor, defect or DC"></div>
<div class="src" id="qa-src"></div><div class="selbar" id="qa-sel"><span id="qa-selt"></span><button id="qa-clr">Clear filter</button></div>
<div class="kpis" id="qa-k"></div>
<div class="row2"><div class="card"><h3>Daily rejections</h3><div class="h">Quantity rejected per posting day: vendor parts (rejected at inspection, sent back from QI) and in-house (moved to the rejection store, scrapped). Line = rejection value (Rs). Click a day to filter the page.</div><div id="qa-trend"></div><div class="lg"><span><i style="background:#2251FF"></i>Vendor</span><span><i style="background:#C98300"></i>In-house</span><span><i style="background:#D0312D;height:2px;vertical-align:3px"></i>Value (Rs)</span></div></div>
<div class="card"><h3 id="qa-part">Defect Pareto</h3><div class="h" id="qa-ph">Rejected quantity by defect type. Click a bar to drill down to the defect names inside it.</div><div id="qa-pareto"></div></div></div>
<div class="row2e"><div class="card"><h3>Vendor quality scorecard</h3><div class="h">Receipts, rejections and PPM per vendor this month (rejected ÷ received × 1,000,000), returns, open QI and the days a lot waits for the inspection decision. Click a vendor to filter.</div><div class="tw" id="qa-vt"></div></div>
<div class="card"><h3>Part quality summary</h3><div class="h">Every finished good and SAP BOM item with a rejection or stock on hold. Click a part to filter; hover for its events.</div><div class="tw" id="qa-pt"></div></div></div>
<div class="row3"><div class="card"><h3>Stock on hold now</h3><div class="h">SAP MB52 today: quality-inspection stock by how long it has waited since its receipt, blocked stock, and stock in the rejection stores (KHI 0009/0012, SKP 0007/0012).</div><div id="qa-hold"></div></div>
<div class="card"><h3>Time to decision and disposition</h3><div class="h">Days from goods receipt to the QI decision (release or reject), from receipt to return to vendor, and from block to release.</div><div id="qa-time"></div></div>
<div class="card"><h3>Defect types by vendor</h3><div class="h">Which vendors bring which kind of defect (rejected quantity). Bubbles sized by quantity.</div><div id="qa-mx"></div></div></div>
<div class="card" style="margin-bottom:12px"><h3>Critical parts monitoring</h3><div class="h">Atlas critical parts (stock under safety): how much of their stock is locked in QI, blocked or the rejection store, and what was rejected this month. Red = quality-locked stock would lift the part above 50% of safety stock if released.</div><div class="tw" id="qa-crit" style="max-height:420px"></div></div>
<div class="row2"><div class="card"><h3>BOM drill-down</h3><div class="h" id="qa-bh">Pick a finished good: every sub-level item of its SAP BOM that has a rejection or stock on hold, indented by level, with what it rolls up to per FG.</div><select id="qa-fg" style="font:inherit;font-size:12.5px;padding:5px 8px;border:1px solid var(--line);border-radius:4px;max-width:100%;margin-bottom:8px"></select><div class="tw tree" id="qa-tree" style="max-height:420px"></div></div>
<div class="card"><h3>Analyst notes</h3><div class="h">What the SAP quality postings say for the current filter.</div><ul class="ins" id="qa-ins"></ul></div></div>
<div class="card" style="margin-bottom:12px"><h3 id="qa-lt">Lots and events</h3><div class="seg" id="qa-seg"></div><div class="tw" id="qa-log" style="max-height:520px"></div><div class="note" id="qa-ln"></div></div>
<div class="row3"><div class="card"><h3>Line rejection by defect</h3><div class="wait" id="qa-line"></div></div>
<div class="card"><h3>Warranty and market returns</h3><div id="qa-war"></div></div>
<div class="card cpk"><h3>Process capability (Cp / Cpk)</h3><div id="qa-cpk"></div></div></div>`;
    sec.querySelector('.qbar').addEventListener('click', e => { const b = e.target.closest('button[data-g]'); if (!b) return; ST[b.dataset.g] = b.dataset.v; draw(); });
    const qi = sec.querySelector('#qa-q'); let tq; qi.oninput = () => { clearTimeout(tq); tq = setTimeout(() => { ST.q = qi.value.trim().toLowerCase(); draw(); }, 200); };
    sec.querySelector('#qa-clr').onclick = () => { ST.sel = null; ST.dtype = null; draw(); };
    sec.querySelector('#qa-seg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; ST.view = b.dataset.v; draw(); });
    const fs = sec.querySelector('#qa-fg'); fs.onchange = () => { ST.fg = fs.value || null; draw(); };
    cpkPanel(sec.querySelector('#qa-cpk'));
    built = true;
  }
  function render(P) {
    const sec = document.getElementById('quality'); if (!sec) return; if (P) lastP = P;
    const s = data();
    if (s !== 'ok') { built = false; sec.innerHTML = `<div class="qbar"><h2>Quality</h2></div><div class="empty">${s === 'err' ? 'The quality data could not be loaded.' : s === 'denied' ? 'You do not have access to the quality data.' : 'Loading SAP quality data…'}</div>`; return; }
    if (!built || !sec.querySelector('#qa-k')) shell(sec);
    draw();
  }
  window.__qualityRender = render;
  /* ---------- main draw ---------- */
  function draw() {
    const sec = document.getElementById('quality'); if (!sec || !D) return; const P = lastP || (window.__P ? window.__P() : {});
    sec.querySelectorAll('.qbar .chip').forEach(b => b.classList.toggle('on', ST[b.dataset.g] === b.dataset.v));
    const shopTxt = P.shop && P.shop !== 'All' ? ` · shop filter <b>${esc(P.shop)}</b> (from the filter bar)` : '';
    sec.querySelector('#qa-src').innerHTML = `SAP MB51 quality movements (${esc(D.file)}, to ${dmy(D.asof)}) and MB52 stock (${esc(D.mb52_file)}). Defect names come from the SAP posting text; SAP has no defect codes, inspection lot numbers or batches in these files, so a lot is one goods receipt (part + vendor + date + DC). November only: the SharePoint MB51 folder holds this month's files; trends grow day by day from here.${shopTxt}`;
    const sb = sec.querySelector('#qa-sel'); sb.classList.toggle('on', !!ST.sel); sec.querySelector('#qa-selt').innerHTML = ST.sel ? `Filtered to <b>${esc(ST.sel.lab)}</b>` : '';
    const E = D.events.filter(e => evOk(e, P)), R = E.filter(e => e.rej && e.q > 0);
    const rcvF = D.received.filter(r => codeOk(r.code, r.vendor, P, 'vendor'));
    const qiPairs = new Set(D.lots.filter(x => x.qi).map(x => x.code + '|' + x.vendor));
    const rcvQI = d3.sum(rcvF.filter(r => qiPairs.has(r.code + '|' + r.vendor)), r => r.qty);
    const prodF = Object.entries(D.produced).filter(([c]) => codeOk(c, '', P, 'inhouse'));
    const RV = R.filter(e => e.origin === 'vendor'), RI = R.filter(e => e.origin === 'inhouse');
    const stock = D.stock.filter(s => codeOk(s.code, s.qi_vendor, P, null));
    const lots = D.lots.filter(x => x.qi && codeOk(x.code, x.vendor, P, 'vendor'));
    const decided = lots.filter(x => x.ok_d || x.rej_d).map(x => dd(x.d, x.rej_d && x.ok_d ? (x.rej_d < x.ok_d ? x.rej_d : x.ok_d) : (x.ok_d || x.rej_d)));
    const sum = (a, f) => d3.sum(a, f);
    const qiQ = sum(stock, s => s.qi), qiV = sum(stock, s => s.qi * s.rate), blQ = sum(stock, s => s.blocked), blV = sum(stock, s => s.blocked * s.rate), rjQ = sum(stock, s => s.rej_store), rjV = sum(stock, s => s.rej_store * s.rate);
    const rtv = E.filter(e => e.kind === 'rtv' && e.q > 0), scr = E.filter(e => e.kind === 'scrap' && e.q > 0);
    const oldest = d3.max(stock.filter(s => s.qi && s.qi_days != null), s => s.qi_days);
    const vppm = ppm(sum(RV.filter(e => e.kind !== 'rej_store_out'), e => e.q), rcvQI);
    const critHit = (D.critical || []).filter(c => shopOk(c.code, P) && (R.some(e => e.code === c.code) || stock.some(s => s.code === c.code && (s.qi || s.blocked || s.rej_store))));
    const carry = R.filter(e => e.period && e.period < D.asof.slice(0, 7));
    const K = [
      ['r', 'Rejected this month', qf(sum(R, e => e.q)), `Rs ${rs(sum(R, e => e.val))} · ${R.length} postings · ${new Set(R.map(e => e.code)).size} parts${carry.length ? ` · incl. ${qf(sum(carry, e => e.q))} from ${[...new Set(carry.map(e => e.period))].map(m => MN[+m.slice(5) - 1]).join(', ')} posted now` : ''}`],
      ['b', 'Vendor incoming PPM', vppm == null ? '—' : nf(Math.round(vppm)), `${qf(sum(RV, e => e.q))} rejected of ${qf(rcvQI)} received on QI-inspected parts`],
      ['o', 'In-house rejection', qf(sum(RI, e => e.q)), `Rs ${rs(sum(RI, e => e.val))} · ${new Set(RI.map(e => e.code)).size} parts${prodF.length ? ` · production ${qf(sum(prodF, d => d[1]))}` : ''}`],
      ['', 'Returned to vendor', qf(sum(rtv, e => e.q)), `${rtv.length} returns · ${new Set(rtv.map(e => e.vendor)).size} vendors · Rs ${rs(sum(rtv, e => e.val))}`],
      ['', 'Scrapped', qf(sum(scr, e => e.q)), `${scr.length} postings · Rs ${rs(sum(scr, e => e.val))}`],
      ['o', 'In QI now', qf(qiQ), `Rs ${rs(qiV)} · ${stock.filter(s => s.qi).length} part/locations${oldest != null ? ` · oldest ${oldest} days` : ''}`],
      ['r', 'Blocked now', qf(blQ), `Rs ${rs(blV)} · ${stock.filter(s => s.blocked).length} part/locations`],
      ['r', 'In rejection stores', qf(rjQ), `Rs ${rs(rjV)} · waiting for return or scrap`],
      ['g', 'Days to QI decision', decided.length ? n1(d3.median(decided)) : '—', decided.length ? `median of ${decided.length} lots · 90% within ${d3.quantile(decided.sort(d3.ascending), .9)} days` : 'no decided lots'],
      ['r', 'Critical parts hit', nf(critHit.length), `of ${(D.critical || []).length} critical parts have a rejection or held stock`]];
    sec.querySelector('#qa-k').innerHTML = K.map(([c, l, v, s]) => `<div class="kpi ${c}"><span>${l}</span><b>${v}</b><small>${s}</small></div>`).join('');
    trend(sec.querySelector('#qa-trend'), R);
    pareto(sec.querySelector('#qa-pareto'), R, sec);
    vendors(sec.querySelector('#qa-vt'), P, E, R, rcvF, lots);
    partsT(sec.querySelector('#qa-pt'), P, E, R, stock);
    holdC(sec.querySelector('#qa-hold'), stock);
    timeC(sec.querySelector('#qa-time'), lots, E, P);
    matrix(sec.querySelector('#qa-mx'), RV);
    critT(sec.querySelector('#qa-crit'), P, R, stock);
    treeT(sec, P, R, stock);
    logT(sec, P, E, lots);
    insights(sec.querySelector('#qa-ins'), { P, E, R, RV, RI, stock, lots, decided, vppm, rcvQI, rtv, scr, critHit, qiQ, qiV, blV, rjV });
    waiting(sec, E);
  }
  const dd = (a, b) => a && b ? Math.max(0, Math.round((new Date(b) - new Date(a)) / 864e5)) : null;
  /* ---------- daily trend ---------- */
  function trend(el, R) {
    const days = d3.timeDays(new Date(D.asof.slice(0, 7) + '-01'), d3.timeDay.offset(new Date(D.asof), 1)).map(d => d3.timeFormat('%Y-%m-%d')(d));
    const g = new Map(days.map(d => [d, { d, v: 0, i: 0, val: 0, n: 0 }]));
    R.forEach(e => { const x = g.get(e.d); if (!x) return; x[e.origin === 'vendor' ? 'v' : 'i'] += e.q; x.val += e.val || 0; x.n++; });
    const A = [...g.values()]; if (!d3.sum(A, a => a.v + a.i)) { el.innerHTML = '<div class="empty">No rejections for this filter.</div>'; return; }
    const W = el.clientWidth || 640, H = 240, m = { l: 52, r: 52, t: 14, b: 26 };
    const x = d3.scaleBand().domain(days).range([m.l, W - m.r]).padding(.18), y = d3.scaleLinear().domain([0, d3.max(A, a => a.v + a.i) * 1.12]).nice().range([H - m.b, m.t]);
    const y2 = d3.scaleLinear().domain([0, (d3.max(A, a => a.val) || 1) * 1.12]).nice().range([H - m.b, m.t]);
    const s = d3.create('svg').attr('width', W).attr('height', H);
    s.append('g').attr('class', 'ax').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(days.filter((d, i) => i % 2 === 0)).tickFormat(d => +d.slice(8)));
    s.append('g').attr('class', 'ax').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('~s')));
    s.append('g').attr('class', 'ax').attr('transform', `translate(${W - m.r},0)`).call(d3.axisRight(y2).ticks(5).tickFormat(v => rs(v)));
    const sel = ST.sel && ST.sel.t === 'day' ? ST.sel.v : null;
    const gg = s.append('g').selectAll('g').data(A).join('g').style('cursor', 'pointer').attr('opacity', d => sel && d.d !== sel ? .35 : 1);
    gg.append('rect').attr('x', d => x(d.d)).attr('width', x.bandwidth()).attr('y', d => y(d.v)).attr('height', d => y(0) - y(d.v)).attr('fill', '#2251FF');
    gg.append('rect').attr('x', d => x(d.d)).attr('width', x.bandwidth()).attr('y', d => y(d.v + d.i)).attr('height', d => y(d.v) - y(d.v + d.i)).attr('fill', '#C98300');
    gg.filter(d => d.v + d.i > 0).append('text').attr('x', d => x(d.d) + x.bandwidth() / 2).attr('y', d => y(d.v + d.i) - 3).attr('text-anchor', 'middle').attr('font-size', 9.5).attr('fill', '#051C2C').text(d => d3.format('~s')(d.v + d.i));
    s.append('path').datum(A).attr('fill', 'none').attr('stroke', '#D0312D').attr('stroke-width', 1.6).attr('d', d3.line().x(d => x(d.d) + x.bandwidth() / 2).y(d => y2(d.val)));
    gg.append('rect').attr('x', d => x(d.d)).attr('width', x.bandwidth()).attr('y', m.t).attr('height', H - m.b - m.t).attr('fill', 'transparent')
      .on('mousemove', (ev, d) => tip.show(ev, `<b>${dmy(d.d)}</b><br>Vendor ${qf(d.v)} · In-house ${qf(d.i)} · Rs ${rs(d.val)}<br>${d.n} postings${dayTop(R, d.d)}`)).on('mouseleave', () => tip.hide())
      .on('click', (ev, d) => setSel('day', d.d, dmy(d.d)));
    el.innerHTML = ''; el.appendChild(s.node());
  }
  const dayTop = (R, d) => { const t = d3.rollups(R.filter(e => e.d === d), v => d3.sum(v, e => e.q), e => e.part).sort((a, b) => b[1] - a[1]).slice(0, 5); return t.length ? '<table>' + t.map(([p, q]) => `<tr><td>${esc(p)}</td><td style="text-align:right">${qf(q)}</td></tr>`).join('') + '</table>' : ''; };
  /* ---------- pareto with drill-down ---------- */
  function pareto(el, R, sec) {
    const drill = ST.dtype; const rows = drill ? R.filter(e => (e.dtype || 'Unspecified') === drill) : R;
    const key = e => drill ? (e.defect || 'No defect named') : (e.dtype || 'Unspecified');
    const g = d3.rollups(rows, v => ({ q: d3.sum(v, e => e.q), val: d3.sum(v, e => e.val), n: v.length, parts: new Set(v.map(e => e.code)).size, vend: new Set(v.filter(e => e.vendor).map(e => e.vendor)).size }), key).sort((a, b) => b[1].q - a[1].q).slice(0, 14);
    sec.querySelector('#qa-part').innerHTML = drill ? `Defect Pareto · <span style="color:${TC[drill] || '#051C2C'}">${esc(drill)}</span> <button class="chip" id="qa-up" style="margin-left:6px">← all types</button>` : 'Defect Pareto';
    sec.querySelector('#qa-ph').textContent = drill ? 'Defect names inside this type, from the SAP posting text. Click a name to filter the page to it.' : 'Rejected quantity by defect type. Click a bar to drill down to the defect names inside it.';
    const up = sec.querySelector('#qa-up'); if (up) up.onclick = () => { ST.dtype = null; if (ST.sel && ST.sel.t === 'defect') ST.sel = null; draw(); };
    if (!g.length) { el.innerHTML = '<div class="empty">No rejections for this filter.</div>'; return; }
    const tot = d3.sum(g, d => d[1].q); let acc = 0; const cum = g.map(d => (acc += d[1].q) / tot);
    const W = el.clientWidth || 480, bh = 20, m = { l: 190, r: 70, t: 6, b: 6 }, H = m.t + m.b + g.length * (bh + 6);
    const x = d3.scaleLinear().domain([0, d3.max(g, d => d[1].q)]).range([m.l, W - m.r]);
    const s = d3.create('svg').attr('width', W).attr('height', H);
    const row = s.selectAll('g').data(g).join('g').attr('transform', (d, i) => `translate(0,${m.t + i * (bh + 6)})`).style('cursor', 'pointer');
    row.append('text').attr('x', m.l - 6).attr('y', bh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11.5).attr('fill', '#051C2C').text(d => d[0].length > 30 ? d[0].slice(0, 29) + '…' : d[0]);
    row.append('rect').attr('x', m.l).attr('height', bh).attr('width', d => Math.max(1, x(d[1].q) - m.l)).attr('fill', d => drill ? (TC[drill] || '#2251FF') : (TC[d[0]] || '#9AA5B1'))
      .attr('opacity', d => ST.sel && ST.sel.t === 'defect' && ST.sel.v !== d[0] ? .35 : 1);
    row.append('text').attr('x', d => x(d[1].q) + 4).attr('y', bh / 2 + 4).attr('font-size', 11).attr('fill', '#5A6670').text((d, i) => `${qf(d[1].q)} · ${Math.round(cum[i] * 100)}%`);
    row.on('mousemove', (ev, d) => tip.show(ev, `<b>${esc(d[0])}</b><br>${qf(d[1].q)} rejected · Rs ${rs(d[1].val)} · ${d[1].n} postings<br>${d[1].parts} parts · ${d[1].vend} vendors · ${n1(d[1].q / tot * 100)}% of the total`)).on('mouseleave', () => tip.hide())
      .on('click', (ev, d) => { tip.hide(); if (!drill) { ST.dtype = d[0]; draw(); } else setSel('defect', d[0] === 'No defect named' ? '' : d[0], `defect “${d[0]}”`); });
    el.innerHTML = ''; el.appendChild(s.node());
  }
  /* ---------- vendor scorecard ---------- */
  function vendors(el, P, E, R, rcvF, lots) {
    const vs = new Set([...rcvF.map(r => r.vendor), ...R.filter(e => e.vendor).map(e => e.vendor)]);
    const rows = [...vs].map(v => {
      const rv = R.filter(e => e.vendor === v), rc = rcvF.filter(r => r.vendor === v), lt = lots.filter(x => x.vendor === v);
      const qi = new Set(lt.map(x => x.code)); const rcq = d3.sum(rc.filter(r => qi.has(r.code)), r => r.qty);
      const rej = d3.sum(rv.filter(e => e.kind !== 'rej_store_out'), e => e.q), dec = lt.filter(x => x.ok_d || x.rej_d).map(x => dd(x.d, x.ok_d || x.rej_d));
      const top = d3.rollups(rv.filter(e => e.defect), a => d3.sum(a, e => e.q), e => e.defect).sort((a, b) => b[1] - a[1])[0];
      return { v, name: vname(v), parts: new Set(rc.map(r => r.code)).size, rcv: d3.sum(rc, r => r.qty), rcq, rej, ppm: ppm(rej, rcq), rtv: d3.sum(rv.filter(e => e.kind === 'rtv'), e => e.q),
        val: d3.sum(rv, e => e.val), open: d3.sum(lt, x => x.open), lots: lt.length, dec: dec.length ? d3.median(dec) : null, top: top ? top[0] : '' };
    }).filter(r => r.rej > 0 || r.open > 0 || ST.sel);
    const k = ST.vsort; rows.sort((a, b) => (b[k] ?? -1) - (a[k] ?? -1) || b.rej - a.rej);
    if (!rows.length) { el.innerHTML = '<div class="empty">No vendor rejections or open inspection lots for this filter.</div>'; return; }
    const pc = (p, r) => p == null ? (r.rej > r.rcq ? '<span class="tag t-n" title="Rejected more than received this month: the rejected stock came from earlier receipts">earlier lots</span>' : '—') : `<span class="tag ${p > 10000 ? 't-r' : p > 2000 ? 't-o' : 't-g'}">${nf(Math.round(p))}</span>`;
    el.innerHTML = `<table><thead><tr><th>Vendor</th><th class="n" data-s="parts">Parts</th><th class="n" data-s="rcv">Received</th><th class="n" data-s="rej">Rejected</th><th class="n" data-s="ppm">PPM</th><th class="n" data-s="rtv">Returned</th><th class="n" data-s="val">Rs</th><th class="n" data-s="open">In QI</th><th class="n" data-s="dec">Days to decide</th><th>Top defect</th></tr></thead><tbody>${rows.slice(0, 120).map(r => `<tr class="it${ST.sel && ST.sel.t === 'vendor' && ST.sel.v === r.v ? ' sel' : ''}" data-v="${esc(r.v)}"><td>${esc(r.name)}<span class="cd">${esc(r.v)}</span></td><td class="n">${r.parts}</td><td class="n">${qf(r.rcv)}</td><td class="n">${qf(r.rej)}</td><td class="n">${pc(r.ppm, r)}</td><td class="n">${qf(r.rtv)}</td><td class="n">${rs(r.val)}</td><td class="n">${qf(r.open)}</td><td class="n">${r.dec == null ? '—' : n1(r.dec)}</td><td>${esc(r.top)}</td></tr>`).join('')}</tbody></table>`;
    el.onclick = e => { const th = e.target.closest('th[data-s]'); if (th) { ST.vsort = th.dataset.s; draw(); return; } const tr = e.target.closest('tr.it'); if (tr) setSel('vendor', tr.dataset.v, vname(tr.dataset.v)); };
  }
  /* ---------- part summary ---------- */
  function partsT(el, P, E, R, stock) {
    const cs = new Set([...R.map(e => e.code), ...stock.map(s => s.code), ...E.filter(e => e.kind === 'block').map(e => e.code)]);
    const rows = [...cs].filter(c => codeOk(c, '', P, null) || (ST.sel && ST.sel.t !== 'vendor')).map(c => {
      const r = R.filter(e => e.code === c), st = stock.filter(s => s.code === c), p = part(c);
      const base = d3.sum(D.received.filter(x => x.code === c), x => x.qty) + (D.produced[c] || 0);
      const top = d3.rollups(r.filter(e => e.defect), a => d3.sum(a, e => e.q), e => e.defect).sort((a, b) => b[1] - a[1])[0];
      return { c, name: pname(c), lvl: p.lvl, shop: p.shop, src: p.src, crit: p.crit, base, rej: d3.sum(r, e => e.q), val: d3.sum(r, e => e.val), ppm: ppm(d3.sum(r, e => e.q), base),
        rtv: d3.sum(r.filter(e => e.kind === 'rtv'), e => e.q), scrap: d3.sum(E.filter(e => e.code === c && e.kind === 'scrap' && e.q > 0), e => e.q), qi: d3.sum(st, s => s.qi), bl: d3.sum(st, s => s.blocked), rj: d3.sum(st, s => s.rej_store),
        hold: d3.sum(st, s => (s.qi + s.blocked + s.rej_store) * s.rate), top: top ? top[0] : '', vend: [...new Set(r.filter(e => e.vendor).map(e => e.vendor))] };
    }).filter(r => r.rej || r.qi || r.bl || r.rj);
    const k = ST.psort; rows.sort((a, b) => (b[k] ?? -1) - (a[k] ?? -1));
    if (!rows.length) { el.innerHTML = '<div class="empty">Nothing rejected or on hold for this filter.</div>'; return; }
    el.innerHTML = `<table><thead><tr><th>Part</th><th>Level</th><th>Shop</th><th class="n" data-s="rej">Rejected</th><th class="n" data-s="ppm">PPM</th><th class="n" data-s="rtv">Returned</th><th class="n" data-s="qi">In QI</th><th class="n" data-s="bl">Blocked</th><th class="n" data-s="rj">Rej. store</th><th class="n" data-s="hold">Held Rs</th><th>Top defect</th></tr></thead><tbody>${rows.slice(0, 250).map(r => `<tr class="it${ST.sel && ST.sel.t === 'part' && ST.sel.v === r.c ? ' sel' : ''}" data-c="${esc(r.c)}"><td>${esc(r.name)}${r.crit ? ' <span class="tag t-r">critical</span>' : ''}<span class="cd">${esc(r.c)} · ${esc(r.src || '—')}${r.vend.length ? ' · ' + r.vend.map(vname).map(esc).join(', ') : ''}</span></td><td>${lvlTag(r.lvl)}</td><td>${esc(r.shop || '—')}</td><td class="n">${qf(r.rej)}</td><td class="n">${r.ppm == null ? '—' : nf(Math.round(r.ppm))}</td><td class="n">${qf(r.rtv)}</td><td class="n">${qf(r.qi)}</td><td class="n">${qf(r.bl)}</td><td class="n">${qf(r.rj)}</td><td class="n">${rs(r.hold)}</td><td>${esc(r.top)}</td></tr>`).join('')}</tbody></table>`;
    el.onclick = e => { const th = e.target.closest('th[data-s]'); if (th) { ST.psort = th.dataset.s; draw(); return; } const tr = e.target.closest('tr.it'); if (tr) setSel('part', tr.dataset.c, pname(tr.dataset.c)); };
    el.onmouseover = e => { const tr = e.target.closest('tr.it'); if (!tr) return; tip.show(e, partTip(tr.dataset.c, E)); }; el.onmousemove = e => tip.move(e); el.onmouseleave = () => tip.hide();
  }
  const partTip = (c, E) => { const ev = E.filter(e => e.code === c && e.kind !== 'qi_release').slice(-12); const p = part(c);
    return `<b>${esc(pname(c))}</b> · ${esc(c)}<br>${p.lvl == null ? 'Not in the SAP BOMs on the dashboard' : p.lvl === 0 ? 'Finished good' : `BOM level ${p.lvl}`}${(p.fg || []).length ? ' · used in ' + p.fg.slice(0, 3).map(f => esc((D.fg_names || {})[f] || f)).join(', ') : ''}${p.rate ? ` · Rs ${n1(p.rate)} each` : ''}
${ev.length ? '<table><tr><th>Date</th><th>What</th><th>Qty</th><th>Defect / text</th><th>Vendor</th></tr>' + ev.map(e => `<tr><td>${dmy(e.d)}</td><td>${KIND[e.kind] || e.kind}</td><td style="text-align:right">${qf(e.q)}</td><td>${esc((e.defect || e.text || '').slice(0, 34))}</td><td>${esc(e.vendor ? vname(e.vendor).slice(0, 22) : '')}</td></tr>`).join('') + '</table>' : '<br><i>No postings this month; stock on hold only.</i>'}`; };
  /* ---------- hold now ---------- */
  function holdC(el, stock) {
    const B = [['0–2 days', 0, 2], ['3–7 days', 3, 7], ['8–15 days', 8, 15], ['16–30 days', 16, 30], ['Over 30 days', 31, 1e9], ['Received before this month or in-house', null, null]];
    const qiR = B.map(([l, a, b]) => { const s = stock.filter(x => x.qi && (a == null ? x.qi_days == null : x.qi_days != null && x.qi_days >= a && x.qi_days <= b)); return { l, q: d3.sum(s, x => x.qi), v: d3.sum(s, x => x.qi * x.rate), n: s.length, top: s.sort((p, q) => q.qi * q.rate - p.qi * p.rate).slice(0, 6) }; });
    const ex = [{ l: 'Blocked', q: d3.sum(stock, x => x.blocked), v: d3.sum(stock, x => x.blocked * x.rate), n: stock.filter(x => x.blocked).length, top: stock.filter(x => x.blocked).sort((p, q) => q.blocked * q.rate - p.blocked * p.rate).slice(0, 6), k: 'blocked' },
      { l: 'Rejection stores', q: d3.sum(stock, x => x.rej_store), v: d3.sum(stock, x => x.rej_store * x.rate), n: stock.filter(x => x.rej_store).length, top: stock.filter(x => x.rej_store).sort((p, q) => q.rej_store * q.rate - p.rej_store * p.rate).slice(0, 6), k: 'rej_store' }];
    const A = [...qiR.map(r => ({ ...r, k: 'qi', l: 'QI ' + r.l })), ...ex]; const mx = d3.max(A, a => a.v) || 1;
    const col = a => a.k === 'qi' ? (/Over|16/.test(a.l) ? '#D0312D' : /8–15/.test(a.l) ? '#C98300' : '#2251FF') : a.k === 'blocked' ? '#7B4FB8' : '#5A6670';
    el.innerHTML = `<table><thead><tr><th>Stock</th><th class="n">Qty</th><th class="n">Rs</th><th style="width:38%"></th></tr></thead><tbody>${A.map((a, i) => `<tr class="it" data-i="${i}"><td>${a.l}<span class="cd">${a.n} part/locations</span></td><td class="n">${qf(a.q)}</td><td class="n">${rs(a.v)}</td><td><div class="bar"><i style="width:${a.v / mx * 100}%;background:${col(a)}"></i></div></td></tr>`).join('')}</tbody></table><div class="note">QI age = days since the oldest receipt of that part that SAP has not yet released or rejected. Value at SAP issue rate (else MB52 unit value); ${stock.filter(s => !s.rate).length} part/locations have no rate.</div>`;
    el.onmouseover = e => { const tr = e.target.closest('tr.it'); if (!tr) return; const a = A[+tr.dataset.i]; tip.show(e, `<b>${a.l}</b> · largest by value<table>${a.top.map(s => `<tr><td>${esc(s.part)}</td><td>${s.plant} ${s.sloc}</td><td style="text-align:right">${qf(s[a.k])}</td><td style="text-align:right">Rs ${rs(s[a.k] * s.rate)}</td><td>${a.k === 'qi' && s.qi_since ? 'since ' + dmy(s.qi_since) + ' · ' + esc(vname(s.qi_vendor).slice(0, 18)) : ''}</td></tr>`).join('')}</table>`); };
    el.onmousemove = e => tip.move(e); el.onmouseleave = () => tip.hide();
  }
  /* ---------- time to decision / disposition ---------- */
  function timeC(el, lots, E, P) {
    const dec = lots.filter(x => x.ok_d || x.rej_d).map(x => dd(x.d, x.ok_d && x.rej_d ? (x.ok_d < x.rej_d ? x.ok_d : x.rej_d) : (x.ok_d || x.rej_d)));
    const rtv = E.filter(e => e.kind === 'rtv' && e.q > 0 && e.days_from_receipt != null).map(e => e.days_from_receipt);
    const hl = D.holds.filter(h => codeOk(h.code, '', P, null)), rel = hl.filter(h => h.how === 'released').map(h => h.days), open = hl.filter(h => h.how === 'open');
    const S = [['Receipt → QI decision', dec, '#2251FF'], ['Receipt → return to vendor', rtv, '#D0312D'], ['Block → release', rel, '#7B4FB8']];
    const bins = [0, 1, 2, 3, 5, 8, 15, 31], lab = ['same day', '1', '2', '3–4', '5–7', '8–14', '15–30', '30+'];
    const H = (a) => bins.map((b, i) => a.filter(v => v >= b && (i === bins.length - 1 || v < bins[i + 1])).length);
    el.innerHTML = S.map(([t, a, c]) => { const h = H(a), mx = d3.max(h) || 1; return `<div style="margin-bottom:10px"><div style="font-size:12px;color:var(--navy);font-weight:600">${t} <span style="font-weight:400;color:var(--mut)">· ${a.length ? `median ${n1(d3.median(a))} days, ${a.length} lots` : 'none this month'}</span></div>
<div style="display:flex;gap:3px;align-items:flex-end;height:46px;margin-top:4px">${h.map((v, i) => `<div title="${lab[i]} days: ${v}" style="flex:1;background:${c};opacity:${v ? .85 : .12};height:${Math.max(2, v / mx * 44)}px"></div>`).join('')}</div>
<div style="display:flex;gap:3px;font-size:9.5px;color:var(--mut)">${lab.map(l => `<div style="flex:1;text-align:center">${l}</div>`).join('')}</div></div>`; }).join('') +
      `<div class="note">${open.length ? `<b>${open.length}</b> blocks still open (${qf(d3.sum(open, h => h.qty))} units, oldest ${d3.max(open, h => h.days)} days): ${open.sort((a, b) => b.days - a.days).slice(0, 3).map(h => `${esc(pname(h.code))} (${h.days} d${h.reason ? ', ' + esc(h.reason.slice(0, 30)) : ''})`).join('; ')}.` : 'No open blocks.'} Rejections waiting for return or scrap: ${D.pending.filter(p => codeOk(p.code, p.vendor, P, null)).length}.</div>`;
  }
  /* ---------- vendor × defect type matrix ---------- */
  function matrix(el, RV) {
    const R = RV.filter(e => e.dtype && e.dtype !== 'Unspecified'); if (!R.length) { el.innerHTML = '<div class="empty">No named vendor defects for this filter.</div>'; return; }
    const vs = d3.rollups(R, v => d3.sum(v, e => e.q), e => e.vendor).sort((a, b) => b[1] - a[1]).slice(0, 10).map(d => d[0]);
    const ts = d3.rollups(R, v => d3.sum(v, e => e.q), e => e.dtype).sort((a, b) => b[1] - a[1]).map(d => d[0]);
    const W = el.clientWidth || 360, m = { l: 160, r: 46, t: 76, b: 6 }, rh = 24, H = m.t + m.b + vs.length * rh;
    const x = d3.scaleBand().domain(ts).range([m.l, W - m.r]), y = d3.scaleBand().domain(vs).range([m.t, H - m.b]);
    const cell = new Map(d3.rollups(R, v => d3.sum(v, e => e.q), e => e.vendor + '|' + e.dtype)); const mx = d3.max([...cell.values()]) || 1; const r = d3.scaleSqrt().domain([0, mx]).range([2.5, Math.min(x.bandwidth(), rh) / 2 - 1]);
    const s = d3.create('svg').attr('width', W).attr('height', H);
    s.append('g').selectAll('text').data(ts).join('text').attr('transform', d => `translate(${x(d) + x.bandwidth() / 2},${m.t - 6}) rotate(-35)`).attr('font-size', 10.5).attr('fill', '#5A6670').text(d => d);
    s.append('g').selectAll('text').data(vs).join('text').attr('x', m.l - 6).attr('y', d => y(d) + rh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', '#051C2C').style('cursor', 'pointer').text(d => vname(d).slice(0, 16) + ' ' + d).on('click', (ev, d) => setSel('vendor', d, vname(d)));
    vs.forEach(v => ts.forEach(t => { const q = cell.get(v + '|' + t); if (!q) return; s.append('circle').attr('cx', x(t) + x.bandwidth() / 2).attr('cy', y(v) + rh / 2).attr('r', r(q)).attr('fill', TC[t] || '#9AA5B1').attr('opacity', .85)
      .on('mousemove', ev => tip.show(ev, `<b>${esc(vname(v))}</b> · ${esc(t)}<br>${qf(q)} rejected`)).on('mouseleave', () => tip.hide()); }));
    el.innerHTML = ''; el.appendChild(s.node());
  }
  /* ---------- critical parts ---------- */
  function critT(el, P, R, stock) {
    const rows = (D.critical || []).filter(c => shopOk(c.code, P) && qOk(c.code, '', null)).map(c => {
      const st = D.stock.filter(s => s.code === c.code), r = R.filter(e => e.code === c.code);
      const qi = d3.sum(st, s => s.qi), bl = d3.sum(st, s => s.blocked), rj = d3.sum(st, s => s.rej_store), lock = qi + bl;
      const daily = d3.rollup(r, v => d3.sum(v, e => e.q), e => e.d);
      return { ...c, qi, bl, rj, lock, after: c.ss ? (c.stock + lock) / c.ss * 100 : null, rej: d3.sum(r, e => e.q), last: r.length ? r[r.length - 1] : null, daily, src: part(c.code).src || '', lvl: part(c.code).lvl };
    }).sort((a, b) => (b.lock + b.rej) - (a.lock + a.rej) || a.cover - b.cover);
    if (!rows.length) { el.innerHTML = '<div class="empty">No critical parts for this filter.</div>'; return; }
    const days = d3.timeDays(new Date(D.asof.slice(0, 7) + '-01'), d3.timeDay.offset(new Date(D.asof), 1)).map(d => d3.timeFormat('%Y-%m-%d')(d));
    const spark = m => { const v = days.map(d => m.get(d) || 0), mx = d3.max(v); if (!mx) return '<span style="color:#C9CED4">no rejections</span>'; return `<svg width="${days.length * 4}" height="18">${v.map((t, i) => `<rect x="${i * 4}" y="${18 - t / mx * 17}" width="3" height="${t / mx * 17}" fill="#D0312D"/>`).join('')}</svg>`; };
    el.innerHTML = `<table><thead><tr><th>Critical part</th><th>Shop</th><th>Level</th><th class="n">Safety</th><th class="n">Stock</th><th class="n">Cover %</th><th class="n">In QI</th><th class="n">Blocked</th><th class="n">Rej. store</th><th class="n">Cover % if QI/blocked released</th><th class="n">Rejected (month)</th><th>Daily rejections</th><th>Last defect</th></tr></thead><tbody>${rows.map(r => `<tr class="it" data-c="${esc(r.code)}"><td>${esc(r.part)}<span class="cd">${esc(r.code)} · ${esc(r.src || '—')}</span></td><td>${esc(r.shop)}</td><td>${lvlTag(r.lvl)}</td><td class="n">${qf(r.ss)}</td><td class="n">${qf(r.stock)}</td><td class="n"><span class="tag ${r.cover < 25 ? 't-r' : r.cover < 50 ? 't-o' : 't-g'}">${r.cover}%</span></td><td class="n">${qf(r.qi)}</td><td class="n">${qf(r.bl)}</td><td class="n">${qf(r.rj)}</td><td class="n">${r.lock ? `<span class="tag ${r.after >= 50 && r.cover < 50 ? 't-r' : 't-b'}">${Math.round(r.after)}%</span>` : '—'}</td><td class="n">${qf(r.rej)}</td><td>${spark(r.daily)}</td><td>${r.last ? esc((r.last.defect || KIND[r.last.kind] || '').slice(0, 32)) + ' · ' + dmy(r.last.d) : '—'}</td></tr>`).join('')}</tbody></table>`;
    el.onclick = e => { const tr = e.target.closest('tr.it'); if (tr) setSel('part', tr.dataset.c, pname(tr.dataset.c)); };
  }
  /* ---------- BOM drill-down ---------- */
  function treeT(sec, P, R, stock) {
    const fs = sec.querySelector('#qa-fg'), el = sec.querySelector('#qa-tree');
    const fgs = Object.keys(D.tree || {}).filter(f => !P.shop || P.shop === 'All' || (D.fg_shop || {})[f] === P.shop);
    const score = f => d3.sum((D.tree[f] || []), t => d3.sum(R.filter(e => e.code === t[1]), e => e.val) + d3.sum(stock.filter(s => s.code === t[1]), s => (s.qi + s.blocked + s.rej_store) * s.rate));
    const ord = fgs.map(f => [f, score(f)]).sort((a, b) => b[1] - a[1]);
    if (!ST.fg || !fgs.includes(ST.fg)) ST.fg = ord.length ? ord[0][0] : null;
    fs.innerHTML = ord.map(([f, v]) => `<option value="${esc(f)}"${f === ST.fg ? ' selected' : ''}>${esc((D.fg_names || {})[f] || f)} · ${esc(f)}${v ? ' · Rs ' + rs(v) : ''}</option>`).join('');
    if (!ST.fg) { el.innerHTML = '<div class="empty">No finished good of this shop has quality activity in its BOM.</div>'; return; }
    const T = D.tree[ST.fg] || [];
    const rows = [[0, ST.fg, '', 1, (D.fg_names || {})[ST.fg] || ST.fg], ...T].map(t => {
      const c = t[1], r = R.filter(e => e.code === c), st = stock.filter(s => s.code === c);
      return { lvl: t[0], c, name: t[4], per: t[3], rej: d3.sum(r, e => e.q), val: d3.sum(r, e => e.val), qi: d3.sum(st, s => s.qi), bl: d3.sum(st, s => s.blocked) + d3.sum(st, s => s.rej_store),
        hv: d3.sum(st, s => (s.qi + s.blocked + s.rej_store) * s.rate), top: (d3.rollups(r.filter(e => e.defect), a => d3.sum(a, e => e.q), e => e.defect).sort((a, b) => b[1] - a[1])[0] || [''])[0], src: part(c).src };
    });
    const totV = d3.sum(rows, r => r.val), totH = d3.sum(rows, r => r.hv);
    sec.querySelector('#qa-bh').innerHTML = `Pick a finished good: every sub-level item of its SAP BOM that has a rejection or stock on hold, indented by level. This FG: <b>Rs ${rs(totV)}</b> rejected and <b>Rs ${rs(totH)}</b> held across its BOM this month.`;
    el.innerHTML = `<table><thead><tr><th>Item</th><th class="n">Per FG</th><th class="n">Rejected</th><th class="n">Rs</th><th class="n">In QI</th><th class="n">Blocked + rej.</th><th>Top defect</th></tr></thead><tbody>${rows.map(r => `<tr class="it" data-c="${esc(r.c)}"><td class="p" style="padding-left:${7 + r.lvl * 14}px">${r.lvl ? '└ ' : ''}<span class="lv">${r.lvl ? 'L' + r.lvl : 'FG'}</span>${esc(r.name)}<span class="cd" style="padding-left:${r.lvl ? 22 : 0}px">${esc(r.c)}${r.src ? ' · ' + esc(r.src) : ''}</span></td><td class="n">${qf(r.per)}</td><td class="n">${r.rej ? `<b style="color:#B42318">${qf(r.rej)}</b>` : '—'}</td><td class="n">${rs(r.val)}</td><td class="n">${qf(r.qi) === '0' ? '—' : qf(r.qi)}</td><td class="n">${r.bl ? qf(r.bl) : '—'}</td><td>${esc(r.top)}</td></tr>`).join('')}</tbody></table>`;
    el.onclick = e => { const tr = e.target.closest('tr.it'); if (tr) setSel('part', tr.dataset.c, pname(tr.dataset.c)); };
  }
  /* ---------- lot and event logs ---------- */
  function logT(sec, P, E, lots) {
    const V = [['events', 'Rejection, return, scrap and hold postings', E.filter(e => e.kind !== 'rej_count_adj').length], ['lots', 'Receipts (lots) awaiting a QI decision', lots.filter(x => x.open > 0).length], ['decided', 'Inspected lots', lots.filter(x => x.ok || x.rej).length], ['pending', 'Rejections waiting for return or scrap', D.pending.filter(p => codeOk(p.code, p.vendor, P, null)).length], ['holds', 'Blocks (holds)', D.holds.filter(h => codeOk(h.code, '', P, null)).length]];
    sec.querySelector('#qa-seg').innerHTML = V.map(([v, l, n]) => `<button data-v="${v}" class="${ST.view === v ? 'on' : ''}">${l}<i>${n}</i></button>`).join('');
    const el = sec.querySelector('#qa-log'), note = sec.querySelector('#qa-ln'); let h = '';
    if (ST.view === 'events') {
      const rows = E.filter(e => e.kind !== 'rej_count_adj').slice().reverse();
      h = `<table><thead><tr><th>Date</th><th>Part</th><th>Level</th><th>What</th><th class="n">Qty</th><th class="n">Rs</th><th>Vendor</th><th>Defect</th><th>Type</th><th>Store</th><th>DC / reference</th><th>Lot (receipt)</th><th>SAP text</th></tr></thead><tbody>${rows.slice(0, 600).map(e => `<tr><td>${dmy(e.d)}<span class="cd">${e.t || ''}${e.e && e.e !== e.d ? ' · entered ' + dmy(e.e) : ''}</span></td><td>${esc(e.part)}<span class="cd">${esc(e.code)}</span></td><td>${lvlTag(e.lvl)}</td><td><span class="tag ${e.rej ? 't-r' : e.kind === 'unblock' ? 't-g' : e.kind === 'block' ? 't-o' : 't-n'}">${KIND[e.kind] || e.kind}</span>${e.dclass ? ` <span class="tag t-b">Class ${e.dclass}</span>` : ''}</td><td class="n">${qf(e.q)}</td><td class="n">${rs(e.val)}</td><td>${e.vendor ? esc(vname(e.vendor)) + `<span class="cd">${esc(e.vendor)}</span>` : '<span style="color:var(--mut)">In-house</span>'}</td><td>${esc(e.defect)}</td><td>${e.dtype ? `<span class="tag" style="background:${TC[e.dtype] || '#9AA5B1'}22;color:${TC[e.dtype] || '#5A6670'}">${esc(e.dtype)}</span>` : ''}</td><td>${esc(e.plant)} ${esc(e.frm || '')}${e.to ? ' → ' + esc(e.to) : ''}</td><td>${esc(e.ref)}${e.doc ? `<span class="cd">doc ${esc(e.doc)}</span>` : ''}</td><td>${e.lot_d ? `${dmy(e.lot_d)} · ${qf(e.lot_qty)}<span class="cd">${e.days_from_receipt} days after receipt${e.lot_match === 'DC' ? ' · DC ' + esc(e.lot_ref) : ' · latest receipt'}</span>` : ''}</td><td style="max-width:260px">${esc(e.text)}</td></tr>`).join('')}</tbody></table>`;
      note.textContent = `${rows.length} postings${rows.length > 600 ? ' (latest 600 shown; narrow with the filters)' : ''}. Returns to vendor are tied to the receipt whose DC number they name, else to the latest receipt of that part from that vendor before the return.`;
    } else if (ST.view === 'lots' || ST.view === 'decided') {
      const rows = (ST.view === 'lots' ? lots.filter(x => x.open > 0) : lots.filter(x => x.ok || x.rej)).slice().sort((a, b) => ST.view === 'lots' ? (a.d < b.d ? -1 : 1) : (b.d < a.d ? -1 : 1));
      h = `<table><thead><tr><th>Received</th><th>Part</th><th>Level</th><th>Vendor</th><th>DC / reference</th><th class="n">Lot qty</th><th class="n">Released</th><th class="n">Rejected</th><th class="n">Waiting</th><th>Decision</th><th class="n">Days</th><th class="n">Returned</th><th>PO</th></tr></thead><tbody>${rows.slice(0, 600).map(x => { const dec = x.ok_d || x.rej_d; const days = dec ? dd(x.d, dec) : dd(x.d, D.asof);
        return `<tr><td>${dmy(x.d)}<span class="cd">${x.t || ''} · ${esc(x.plant)} ${esc(x.sloc || '')}</span></td><td>${esc(pname(x.code))}<span class="cd">${esc(x.code)}</span></td><td>${lvlTag(part(x.code).lvl)}</td><td>${esc(vname(x.vendor))}<span class="cd">${esc(x.vendor)}</span></td><td>${esc(x.ref)}${x.doc ? `<span class="cd">doc ${esc(x.doc)}</span>` : ''}</td><td class="n">${qf(x.qty)}</td><td class="n">${qf(x.ok)}</td><td class="n">${x.rej ? `<b style="color:#B42318">${qf(x.rej)}</b>` : '—'}</td><td class="n">${x.open ? `<span class="tag ${days > 7 ? 't-r' : days > 2 ? 't-o' : 't-n'}">${qf(x.open)}</span>` : '—'}</td><td>${dec ? dmy(dec) : '<span style="color:var(--mut)">waiting</span>'}</td><td class="n">${days ?? '—'}</td><td class="n">${x.rtv ? qf(x.rtv) + (x.rtv_d ? ' · ' + dmy(x.rtv_d) : '') : '—'}</td><td>${esc(x.po || '')}</td></tr>`; }).join('')}</tbody></table>`;
      note.textContent = 'QI decisions (SAP 321 release, 350 / 321 into a rejection store) are matched to receipts of the same part and vendor oldest first. Only parts that SAP posts through quality inspection are listed; most bought-out parts go straight to unrestricted stock.';
    } else if (ST.view === 'pending') {
      const rows = D.pending.filter(p => codeOk(p.code, p.vendor, P, null)).sort((a, b) => b.days - a.days);
      h = `<table><thead><tr><th>Rejected on</th><th>Part</th><th>Vendor</th><th class="n">Qty</th><th class="n">Days waiting</th><th>Defect</th></tr></thead><tbody>${rows.map(p => `<tr><td>${dmy(p.rej_d)}</td><td>${esc(pname(p.code))}<span class="cd">${esc(p.code)}</span></td><td>${esc(vname(p.vendor))}</td><td class="n">${qf(p.qty)}</td><td class="n"><span class="tag ${p.days > 15 ? 't-r' : p.days > 7 ? 't-o' : 't-n'}">${p.days}</span></td><td>${esc(p.defect)}</td></tr>`).join('')}</tbody></table>`;
      note.textContent = 'Rejected this month and not yet returned to the vendor or scrapped in SAP (matched by part and vendor, oldest first).';
    } else {
      const rows = D.holds.filter(x => codeOk(x.code, '', P, null)).sort((a, b) => (a.how === 'open' ? -1 : 1) - (b.how === 'open' ? -1 : 1) || b.days - a.days);
      h = `<table><thead><tr><th>Blocked on</th><th>Part</th><th class="n">Qty</th><th>Status</th><th>Released on</th><th class="n">Days</th><th>Reason (SAP text)</th></tr></thead><tbody>${rows.map(x => `<tr><td>${dmy(x.from_d)}</td><td>${esc(pname(x.code))}<span class="cd">${esc(x.code)}</span></td><td class="n">${qf(x.qty)}</td><td><span class="tag ${x.how === 'open' ? 't-o' : 't-g'}">${x.how}</span></td><td>${dmy(x.to_d)}</td><td class="n">${x.days}</td><td>${esc(x.reason)}</td></tr>`).join('')}</tbody></table>`;
      note.textContent = 'SAP 344 (unrestricted → blocked) matched to 343 (blocked → unrestricted) for the same part, oldest first.';
    }
    el.innerHTML = h || '<div class="empty">Nothing for this filter.</div>';
  }
  /* ---------- insights ---------- */
  function insights(el, X) {
    const L = [], S = (a, f) => d3.sum(a, f);
    const tv = d3.rollups(X.RV.filter(e => e.vendor), v => ({ q: S(v, e => e.q), val: S(v, e => e.val), d: [...new Set(v.map(e => e.defect).filter(Boolean))] }), e => e.vendor).sort((a, b) => b[1].val - a[1].val);
    if (tv.length) L.push(`<b>${esc(vname(tv[0][0]))}</b> accounts for the most rejected value from vendors (Rs ${rs(tv[0][1].val)}, ${qf(tv[0][1].q)} pcs${tv[0][1].d.length ? '; ' + tv[0][1].d.slice(0, 3).map(esc).join(', ') : ''}).${tv[1] ? ` Next: ${tv.slice(1, 3).map(([v, o]) => `${esc(vname(v))} (Rs ${rs(o.val)})`).join(', ')}.` : ''}`);
    const named = X.R.filter(e => e.dtype && !/Unspecified|Process/.test(e.dtype)); const tt = d3.rollups(named, v => S(v, e => e.q), e => e.dtype).sort((a, b) => b[1] - a[1]);
    if (tt.length) L.push(`Of the rejections that name a defect, <b>${esc(tt[0][0])}</b> leads (${qf(tt[0][1])} pcs, ${Math.round(tt[0][1] / S(named, e => e.q) * 100)}%). Repeats of the same defect on the same part point to a process that is not under control at the supplier: ${d3.rollups(named, v => v.length, e => e.code + '|' + e.defect).filter(d => d[1] > 1).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${esc(pname(k.split('|')[0]))} – ${esc(k.split('|')[1])} (${n}×)`).join('; ') || 'none repeat this month'}.`);
    const unn = X.R.filter(e => !e.defect || /no defect named/.test(e.defect)); if (unn.length) L.push(`<b>${Math.round(S(unn, e => e.q) / Math.max(1, S(X.R, e => e.q)) * 100)}%</b> of the rejected quantity has no defect written in SAP (${unn.length} postings, e.g. the October in-house rejection transfer and 350 QI → blocked postings). Asking stores / QC to write the defect in the item text of 350, 311 and 551 postings would make this Pareto complete.`);
    if (X.vppm != null) L.push(`Incoming PPM on parts SAP inspects is <b>${nf(Math.round(X.vppm))}</b> (${qf(S(X.RV.filter(e => e.kind !== 'rej_store_out'), e => e.q))} of ${qf(X.rcvQI)}). Lots wait a median ${X.decided.length ? n1(d3.median(X.decided)) : '—'} days for the decision; ${X.lots.filter(x => x.open > 0 && dd(x.d, D.asof) > 7).length} receipts are still waiting after more than a week.`);
    const big = X.stock.filter(s => s.qi && s.qi_days != null && s.qi_days > 7).sort((a, b) => b.qi * b.rate - a.qi * a.rate).slice(0, 3);
    L.push(`Rs <b>${rs(X.qiV)}</b> is in QI, Rs ${rs(X.blV)} blocked and Rs ${rs(X.rjV)} in the rejection stores. ${big.length ? 'Oldest QI stock worth chasing: ' + big.map(s => `${esc(s.part)} (${qf(s.qi)}, ${s.qi_days} days, ${esc(vname(s.qi_vendor))})`).join('; ') + '.' : ''}`);
    if (X.critHit.length) L.push(`<b>${X.critHit.length} critical parts</b> have stock in QI/blocked or were rejected this month. Releasing their QI stock is the fastest way to lift their cover: ${X.critHit.map(c => ({ c, q: d3.sum(D.stock.filter(s => s.code === c.code), s => s.qi + s.blocked) })).filter(o => o.q).sort((a, b) => b.q - a.q).slice(0, 3).map(o => `${esc(o.c.part)} (${qf(o.q)} held, cover ${o.c.cover}%)`).join('; ') || '—'}.`);
    const ih = X.RI.filter(e => e.kind === 'rej_store_out'); if (ih.length) L.push(`The October in-house rejection was moved out of KHI 0009 on ${dmy(ih[0].d)}: ${qf(S(ih, e => e.q))} pcs on ${new Set(ih.map(e => e.code)).size} carburetor child parts (Rs ${rs(S(ih, e => e.val))}). It names no defect per part; a shop rejection log would show why.`);
    el.innerHTML = L.map(s => `<li>${s}</li>`).join('');
  }
  /* ---------- panels waiting for data ---------- */
  function waiting(sec, E) {
    sec.querySelector('#qa-line').innerHTML = `<b>Needs the shops' QC rejection sheets.</b> SAP only shows the quantity a shop moves to the rejection store or scraps (shown above as in-house rejection), not the defect found on the line, the station or the shift.<br><br>Put the daily line-rejection sheets in SharePoint <code>Portal Data/Quality</code> with one row per defect: <code>date · shop · line/station · shift · part code · defect type · defect name · qty checked · qty rejected</code>. They will be joined to the BOM and to this page by part code.`;
    const rr = E.filter(e => e.kind === 'return_rps');
    sec.querySelector('#qa-war').innerHTML = `<div class="wait" style="margin-bottom:8px"><b>Warranty claims are not in SAP MB51 / MB52.</b> A claims file (claim no, date, model, frame/engine no, km, part code, failure mode, dealer, vendor) in <code>Portal Data/Quality</code> will fill this card with field failures per 1,000 bikes by model and part.</div>
${rr.length ? `<div class="h"><b>What SAP does show:</b> ${rr.length} receipts into the KHI 0012 rejection store against RPS gate passes this month (${qf(d3.sum(rr, e => e.q))} pcs). These look like returns from the market or spare-parts side; confirm before treating them as warranty.</div><div class="tw" style="max-height:200px"><table><thead><tr><th>Date</th><th>Part</th><th class="n">Qty</th><th>Gate pass</th></tr></thead><tbody>${rr.slice().reverse().map(e => `<tr><td>${dmy(e.d)}</td><td>${esc(e.part)}<span class="cd">${esc(e.code)}</span></td><td class="n">${qf(e.q)}</td><td>${esc(e.ref || e.text)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
  }
  /* ---------- Cp / Cpk ---------- */
  function cpkPanel(el) {
    el.innerHTML = `<div class="h">SAP holds no measurements. Paste readings of one characteristic (e.g. bore dia) for any in-house or vendor part and its limits to get Cp / Cpk now; a QC measurement file in <code>Portal Data/Quality</code> (part, characteristic, LSL, USL, reading, date) would make this automatic for every part.</div>
<textarea id="qa-cv" placeholder="Readings, one per line or separated by commas / spaces"></textarea>
<div class="r">LSL <input id="qa-lsl" type="number" step="any"> USL <input id="qa-usl" type="number" step="any"> <span>Part / characteristic <input id="qa-cn" style="width:150px" placeholder="optional"></span></div>
<div class="out" id="qa-co"></div><div id="qa-ch"></div><div class="note" id="qa-cnote">Cp = (USL − LSL) / 6σ; Cpk = min(USL − mean, mean − LSL) / 3σ, σ = sample standard deviation. Automotive PPAP expects Cpk ≥ 1.67 for new processes and ≥ 1.33 ongoing.</div>`;
    const go = () => {
      const v = (el.querySelector('#qa-cv').value.match(/-?\d+(\.\d+)?/g) || []).map(Number), L = parseFloat(el.querySelector('#qa-lsl').value), U = parseFloat(el.querySelector('#qa-usl').value), o = el.querySelector('#qa-co'), ch = el.querySelector('#qa-ch');
      if (v.length < 2) { o.innerHTML = ''; ch.innerHTML = ''; return; }
      const m = d3.mean(v), sd = d3.deviation(v) || 0; const cp = isFinite(L) && isFinite(U) && sd ? (U - L) / (6 * sd) : null;
      const cpk = sd ? Math.min(isFinite(U) ? (U - m) / (3 * sd) : Infinity, isFinite(L) ? (m - L) / (3 * sd) : Infinity) : null;
      const out = v.filter(x => (isFinite(L) && x < L) || (isFinite(U) && x > U)).length;
      const c = k => k == null || !isFinite(k) ? '' : k >= 1.67 ? '#1E8C5A' : k >= 1.33 ? '#C98300' : '#D0312D';
      o.innerHTML = [['n', v.length], ['Mean', d3.format('.4~f')(m)], ['σ', d3.format('.4~f')(sd)], ['Out of limits', out], ['Cp', cp == null ? '—' : cp.toFixed(2), c(cp)], ['Cpk', cpk == null || !isFinite(cpk) ? '—' : cpk.toFixed(2), c(cpk)], ['Min', d3.min(v)], ['Max', d3.max(v)]].map(([l, x, col]) => `<div><span>${l}</span><b style="${col ? 'color:' + col : ''}">${x}</b></div>`).join('');
      const W = el.clientWidth || 300, H = 110, lo = d3.min([d3.min(v), isFinite(L) ? L : Infinity]), hi = d3.max([d3.max(v), isFinite(U) ? U : -Infinity]); const pad = (hi - lo) * .08 || 1;
      const x = d3.scaleLinear().domain([lo - pad, hi + pad]).range([4, W - 4]); const bins = d3.bin().domain(x.domain()).thresholds(14)(v); const y = d3.scaleLinear().domain([0, d3.max(bins, b => b.length)]).range([H - 16, 4]);
      const s = d3.create('svg').attr('width', W).attr('height', H);
      s.selectAll('rect').data(bins).join('rect').attr('x', b => x(b.x0) + 1).attr('width', b => Math.max(0, x(b.x1) - x(b.x0) - 2)).attr('y', b => y(b.length)).attr('height', b => H - 16 - y(b.length)).attr('fill', '#2251FF').attr('opacity', .75);
      [[L, 'LSL'], [U, 'USL']].forEach(([t, l]) => { if (!isFinite(t)) return; s.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', 2).attr('y2', H - 16).attr('stroke', '#D0312D').attr('stroke-dasharray', '3 2'); s.append('text').attr('x', x(t)).attr('y', H - 4).attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#D0312D').text(l); });
      s.append('line').attr('x1', x(m)).attr('x2', x(m)).attr('y1', 2).attr('y2', H - 16).attr('stroke', '#051C2C');
      ch.innerHTML = ''; ch.appendChild(s.node());
    };
    el.addEventListener('input', go);
  }
  if (window.dash && dash.onData) dash.onData(() => { if (window.__page === 'quality') render(); });
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (window.__page === 'quality' && D) draw(); }, 250); });
  let tries = 0; const wait = setInterval(() => { tries++; if (window.__page === 'quality' && !D) render(); if (D || tries > 60) clearInterval(wait); }, 1000);
})();
