/* Purchasing tab (18 Nov 2026, Umair): ME5A purchase requisitions and POs on the item reference (SAP material code) of the
   Tools, Consumables, Spares, Lubricants and Raw Material inventory, with SAP MB51 receipts and MB52 stock.
   Data: dataset "me5a" (tools/me5a_build.py) and "market" (USD/PKR, Pakistan CPI, aluminium, copper, steel; monthly).
   Everything is on this one page: KPIs, critical runway, proposed PRs, pending PRs, POs awaiting delivery, excess on order,
   lead and processing times, and price analysis against market data. Hover any item row for its individual PRs. */
(() => {
  const nf = d3.format(','), n1 = d3.format(',.1f'), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dmy = s => s ? `${+s.slice(8, 10)} ${MN[+s.slice(5, 7) - 1]} ${s.slice(2, 4)}` : '—';
  const mlab = m => `${MN[+m.slice(5, 7) - 1]} ${m.slice(2, 4)}`;
  const qf = v => v == null ? '—' : Math.abs(v) >= 100 ? nf(Math.round(v)) : Math.abs(v) >= 10 ? n1(v) : d3.format(',.2~f')(v);
  const mpkr = v => v == null ? '—' : Math.abs(v) >= 1e6 ? `${n1(v / 1e6)}M` : Math.abs(v) >= 1e3 ? `${nf(Math.round(v / 1e3))}K` : nf(Math.round(v));
  const CATS = ['Tools', 'Consumables', 'Spares', 'Lubricants', 'Raw Material'];
  const CC = { Tools: '#2251FF', Consumables: '#00A9F4', Spares: '#1E8C5A', Lubricants: '#C98300', 'Raw Material': '#7B4FB8', 'No material code': '#9AA5B1', Other: '#C9CED4' };
  /* market drivers: an item follows a market series by what it is made of / where it comes from (editable in the Price card) */
  const DRV = [['alu', 'Aluminium', /ALUMIN|ALLOY INGOT|\bADC ?1?2\b|\bAL\b|ALU\b|A356|LM ?6|LM ?24/i], ['cu', 'Copper', /COPPER|BRASS|BRONZE|ENAMEL|\bCU\b|WINDING WIRE/i],
    ['steel', 'Steel', /STEEL|\bMS\b|S45C|SCM|SKD|\bEN ?\d|HSS|SHEET|\bPLATE\b|\bBAR\b|\bROD\b|PIPE|BOLT|\bNUT\b|SCREW|WASHER|SPRING|BEARING|CHAIN|WIRE ROPE|ANGLE|CHANNEL|INSERT|DRILL|REAMER|TAP\b|END ?MILL|CUTTER/i]];
  const driverOf = i => { const t = `${i.part} ${i.code}`; for (const [k, , rx] of DRV) if (rx.test(t)) return k; return (i.sups || []).some(s => /^4/.test(s)) || /IMPORT/i.test(i.part) ? 'fx' : 'cpi'; };
  const DNAME = { alu: 'Aluminium', cu: 'Copper', steel: 'Steel', fx: 'Imported (USD/PKR)', cpi: 'Local (CPI)' };
  const ST = { cat: 'All', shop: 'All', q: '', view: 'crit', stale: false, drv: 'all', mkt: 'usdpkr', mode: 'index', sel: null, sort: null };
  let D = null, M = null, built = false;
  const css = document.createElement('style'); css.textContent = `
#purchasing .pbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:2px 0 10px}
#purchasing .pbar h2{font-family:var(--font-anthropic-serif,inherit);font-weight:400;font-size:24px;color:var(--navy);margin:0 10px 0 0}
#purchasing .chip{font:inherit;font-size:12.5px;padding:5px 11px;border:0;border-radius:14px;background:#E9EDF1;color:var(--navy);cursor:pointer}
#purchasing .chip.on{background:#051C2C;color:#fff}
#purchasing .pbar select,#purchasing .pbar input{font:inherit;font-size:12.5px;padding:5px 8px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--navy)}
#purchasing .pbar input[type=search]{width:200px}
#purchasing .src{font-size:11.5px;color:var(--mut);margin:-4px 0 10px}
#purchasing .kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:12px}
#purchasing .kpi{background:#fff;border:1px solid var(--line);border-top:3px solid var(--navy);padding:9px 11px;cursor:pointer;min-width:0}
#purchasing .kpi.on{box-shadow:0 0 0 2px #2251FF inset}
#purchasing .kpi span{display:block;font-size:11.5px;color:var(--mut);line-height:1.25}#purchasing .kpi b{display:block;font-size:22px;color:var(--navy);font-weight:600;margin:3px 0 1px;font-variant-numeric:tabular-nums}
#purchasing .kpi small{display:block;font-size:11px;color:var(--mut);line-height:1.3}
#purchasing .kpi.r{border-top-color:var(--bad)}#purchasing .kpi.o{border-top-color:var(--warn)}#purchasing .kpi.g{border-top-color:var(--good)}#purchasing .kpi.b{border-top-color:var(--blue)}
#purchasing .row2{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:12px;margin-bottom:12px}
#purchasing .row3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:12px}
#purchasing .card h3{margin:0 0 2px;font-size:14px;color:var(--navy)}#purchasing .card .h{font-size:11.5px;color:var(--mut);margin-bottom:8px;line-height:1.35}
#purchasing .seg{display:flex;gap:4px;flex-wrap:wrap;margin:0 0 8px}
#purchasing .seg button{font:inherit;font-size:12px;padding:5px 10px;border:1px solid var(--line);background:#fff;color:var(--navy);border-radius:4px;cursor:pointer}
#purchasing .seg button.on{background:#051C2C;color:#fff;border-color:#051C2C}#purchasing .seg button i{font-style:normal;opacity:.7;margin-left:4px}
#purchasing .tw{max-height:520px;overflow:auto;border:1px solid var(--line)}
#purchasing table{width:100%;border-collapse:collapse;font-size:12px}
#purchasing th{position:sticky;top:0;background:#F4F6F9;color:var(--navy);font-weight:600;text-align:left;padding:6px 7px;border-bottom:1px solid var(--line);white-space:nowrap;cursor:pointer;z-index:1}
#purchasing td{padding:5px 7px;border-bottom:1px solid #EEF1F4;vertical-align:top}#purchasing td.n,#purchasing th.n{text-align:right;font-variant-numeric:tabular-nums}
#purchasing tr.it:hover td{background:#F4F8FF}#purchasing td .cd{display:block;font-size:10.5px;color:var(--mut)}
#purchasing .tag{display:inline-block;font-size:10.5px;font-weight:600;padding:1px 6px;border-radius:8px;white-space:nowrap}
#purchasing .t-r{background:#FDECEA;color:#B42318}#purchasing .t-o{background:#FFF3E0;color:#9A6200}#purchasing .t-g{background:#E8F6EE;color:#1E6B4A}#purchasing .t-b{background:#EAF0FF;color:#2251FF}#purchasing .t-n{background:#F0F2F5;color:#5A6670}
#purchasing .rw{position:relative;height:12px;background:#F0F2F5;border-radius:2px;min-width:120px}
#purchasing .rw i{position:absolute;left:0;top:0;bottom:0;border-radius:2px}#purchasing .rw u{position:absolute;top:-3px;bottom:-3px;width:2px;background:#051C2C}
#purchasing .rw em{position:absolute;top:-2px;width:8px;height:8px;margin-left:-4px;margin-top:4px;border-radius:50%;background:#2251FF;border:1px solid #fff}
#purchasing .ins{font-size:12.5px;line-height:1.5;color:var(--ink);margin:0;padding-left:16px}#purchasing .ins li{margin-bottom:4px}
#purchasing .note{font-size:11px;color:var(--mut);margin-top:6px;line-height:1.4}
#purchasing svg text{font-family:inherit}#purchasing .ax text{font-size:10.5px;fill:#5A6670}#purchasing .ax path,#purchasing .ax line{stroke:#C9CED4}
#purchasing .lg{display:flex;gap:12px;flex-wrap:wrap;font-size:11.5px;color:var(--mut);margin:4px 0}#purchasing .lg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
#purchasing .pctl{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px;font-size:12px;color:var(--mut)}
#purchasing .pctl select{font:inherit;font-size:12px;padding:4px 6px;border:1px solid var(--line);border-radius:4px;color:var(--navy)}
#purchasing .empty{padding:24px;color:var(--mut);font-size:13px;text-align:center}
#pu-tip{position:fixed;z-index:9999;pointer-events:none;background:#fff;border:1px solid #C9CED4;box-shadow:0 6px 20px rgba(5,28,44,.18);padding:9px 11px;font-size:11.5px;color:#051C2C;max-width:620px;display:none;border-radius:4px}
#pu-tip b{color:#051C2C}#pu-tip table{border-collapse:collapse;margin-top:5px;font-size:11px}#pu-tip td,#pu-tip th{padding:2px 6px;border-bottom:1px solid #EEF1F4;text-align:left;white-space:nowrap}#pu-tip th{color:#5A6670;font-weight:600}
@media (max-width:1100px){#purchasing .kpis{grid-template-columns:repeat(3,minmax(0,1fr))}#purchasing .row2,#purchasing .row3{grid-template-columns:1fr}}`;
  document.head.appendChild(css);
  const portal = () => window.__PORTAL;
  const one = x => Array.isArray(x) ? x[0] : x;
  function init() {
    const P = portal(); if (P && P.canTab && !P.canTab('purchasing')) return;
    const tabs = document.getElementById('tabs'), root = document.getElementById('ael') || document.body; if (!tabs || document.getElementById('t-purchasing')) return;
    const b = document.createElement('button'); b.className = 'tab'; b.id = 't-purchasing'; b.setAttribute('role', 'tab'); b.dataset.p = 'purchasing'; b.textContent = 'Purchasing';
    b.title = 'ME5A purchase requisitions and POs: shortages, pending PRs, POs awaiting delivery, lead times, excess on order and price analysis';
    b.addEventListener('click', ev => { ev.stopPropagation(); open(); }, true);
    const inv = document.getElementById('t-inventory'); if (inv) inv.after(b); else tabs.appendChild(b);
    const sec = document.createElement('section'); sec.className = 'page'; sec.id = 'purchasing'; const last = [...root.querySelectorAll('section.page')].pop(); if (last) last.after(sec); else root.appendChild(sec);
    if (location.hash === '#purchasing') open();
  }
  function open() { window.__page = 'purchasing'; document.querySelectorAll('#ael .page, section.page').forEach(s => s.classList.toggle('on', s.id === 'purchasing'));
    document.querySelectorAll('#tabs .tab').forEach(t => t.setAttribute('aria-selected', t.id === 't-purchasing' ? 'true' : 'false')); try { history.replaceState(null, '', '#purchasing'); } catch (e) {} render(); }
  function data() {
    const a = window.dash && dash.data('me5a'), m = window.dash && dash.data('market');
    if (!a || a.status !== 'ok' || !a.data || !a.data.length) return a && a.status === 'error' ? 'err' : a && a.status === 'denied' ? 'denied' : null;
    if (!D) { D = one(a.data); ['items', 'open', 'monthly', 'lt_cat', 'targets', 'files'].forEach(k => { if (typeof D[k] === 'string') D[k] = JSON.parse(D[k]); });
      D.items.forEach(i => { i.drv = driverOf(i); i.crit = i.bought && i.use_month > 0 && (i.stock <= 0 || (i.cover != null && i.cover < i.lt)); });
      D.byCode = new Map(D.items.map(i => [i.code, i])); }
    if (!M && m && m.status === 'ok' && m.data && m.data.length) { M = one(m.data); if (typeof M.series === 'string') M.series = JSON.parse(M.series); }
    return 'ok';
  }
  const tip = (() => { let t = null; return { show(ev, html) { if (!t) { t = document.createElement('div'); t.id = 'pu-tip'; document.body.appendChild(t); } t.innerHTML = html; t.style.display = 'block'; this.move(ev); },
    move(ev) { if (!t) return; const w = t.offsetWidth, h = t.offsetHeight; let x = ev.clientX + 14, y = ev.clientY + 14; if (x + w > innerWidth - 8) x = ev.clientX - w - 14; if (y + h > innerHeight - 8) y = Math.max(8, ev.clientY - h - 14); t.style.left = x + 'px'; t.style.top = y + 'px'; },
    hide() { if (t) t.style.display = 'none'; } }; })();
  const prTip = i => {
    const rows = (i.det || []).map(r => `<tr><td>${esc(r.pr)}/${esc(r.it)}</td><td>${dmy(r.d)}</td><td class="n">${qf(r.q)}</td><td>${r.st === 'B' ? `PO ${esc(r.po || '')} · ${dmy(r.pod)}` : r.rx ? '<span style="color:#9A6200">awaiting release</span>' : '<span style="color:#B42318">no PO yet</span>'}</td>
<td>${r.rel && r.d ? Math.max(0, Math.round((new Date(r.rel) - new Date(r.d)) / 864e5)) + 'd' : '—'}</td><td>${r.pod && r.rel ? Math.max(0, Math.round((new Date(r.pod) - new Date(r.rel)) / 864e5)) + 'd' : '—'}</td>
<td>${r.done ? 'received ' + dmy(r.done) + (r.pod ? ` (${Math.round((new Date(r.done) - new Date(r.pod)) / 864e5)}d)` : '') : r.st === 'B' ? (r.got ? `${qf(r.got)} of ${qf(r.qo)} in` : 'awaited') : '—'}</td><td>${esc(r.by || '')}</td><td>${esc((r.sup || '').slice(0, 26))}</td></tr>`).join('');
    return `<b>${esc(i.part)}</b> · ${esc(i.code)} · ${esc(i.cat)}<br>Stock ${qf(i.stock)} ${esc(i.uom)} · use ${qf(i.use_month)}/month · cover ${i.cover == null ? '—' : i.cover + ' days'} · lead time ${i.lt} days (${i.lt_src === 'history' ? `median of ${i.lt_n} POs` : i.lt_src === 'planned' ? 'SAP planned delivery time' : 'category median'})<br>
PR approval median ${i.appr == null ? '—' : i.appr + 'd'} · PR → PO median ${i.p2o == null ? '—' : i.p2o + 'd'} · ${i.prs} PR lines since Jan 2024${(i.sups || []).length ? ' · suppliers ' + i.sups.map(esc).join(', ') : ''}
${rows ? `<table><tr><th>PR/item</th><th>PR date</th><th>Qty</th><th>Status</th><th>Approve</th><th>PR→PO</th><th>Supply</th><th>By</th><th>Supplier</th></tr>${rows}</table>` : '<br><i>No PR since Jan 2024</i>'}`;
  };
  function shell(sec) {
    sec.innerHTML = `<div class="pbar"><h2>Purchasing</h2><span id="pu-cats"></span><select id="pu-shop"></select><input type="search" id="pu-q" placeholder="Search item, code, PR or PO"><label style="font-size:12px;color:var(--mut)"><input type="checkbox" id="pu-stale"> include PRs/POs older than 6 months</label></div>
<div class="src" id="pu-src"></div><div class="kpis" id="pu-k"></div>
<div class="row2"><div class="card"><h3 id="pu-tt"></h3><div class="h" id="pu-th"></div><div class="seg" id="pu-seg"></div><div class="tw" id="pu-tw"></div><div class="note" id="pu-tn"></div></div>
<div class="card"><h3>Runway of critical items</h3><div class="h">Days of stock (bar) against lead time (black line); blue dots are POs still due, at their required date. Red bar = stock runs out before a new supply can arrive.</div><div id="pu-run"></div><div class="lg"><span><i style="background:#D0312D"></i>runs out inside lead time</span><span><i style="background:#C98300"></i>under 1.5 × lead time</span><span><i style="background:#1E8C5A"></i>covered</span><span><i style="background:#2251FF;border-radius:50%"></i>PO due</span></div></div></div>
<div class="row3"><div class="card"><h3>PR and PO processing time</h3><div class="h">Median days per month of PR date: PR → PO (bars) and PO → full receipt (line). Material-coded PRs, KHI + SKP.</div><div id="pu-proc"></div></div>
<div class="card"><h3>Pending PRs by age</h3><div class="h">PR lines with no PO yet, by days since the PR date and item category.</div><div id="pu-age"></div></div>
<div class="card"><h3>Lead time by category</h3><div class="h">Median days from PO date to the receipt that completed the PO (each dot an item's median; box = middle half).</div><div id="pu-lt"></div></div></div>
<div class="row2"><div class="card"><h3>Price analysis against market data</h3><div class="h" id="pu-ph"></div><div class="pctl" id="pu-pc"></div><div id="pu-pch"></div><div class="lg" id="pu-plg"></div><ul class="ins" id="pu-pins"></ul></div>
<div class="card"><h3>Biggest price moves</h3><div class="h">Average receipt price, last 3 months vs the same 3 months a year earlier (SAP MB51 101). Click a row to chart that item alone.</div><div class="tw" style="max-height:440px" id="pu-mv"></div></div></div>
<div class="card" style="margin-bottom:12px"><h3>Insights</h3><ul class="ins" id="pu-ins"></ul></div>`;
    const cats = sec.querySelector('#pu-cats');
    cats.innerHTML = ['All', ...CATS].map(c => `<button class="chip" data-c="${c}">${c}</button>`).join(' ');
    cats.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; ST.cat = b.dataset.c; draw(); });
    const shops = [...new Set(D.items.map(i => i.shop).filter(Boolean))].sort();
    const ss = sec.querySelector('#pu-shop'); ss.innerHTML = `<option value="All">All shops</option>${shops.map(s => `<option>${esc(s)}</option>`).join('')}`; ss.onchange = () => { ST.shop = ss.value; draw(); };
    const qi = sec.querySelector('#pu-q'); let tq; qi.oninput = () => { clearTimeout(tq); tq = setTimeout(() => { ST.q = qi.value.trim().toLowerCase(); draw(); }, 200); };
    sec.querySelector('#pu-stale').onchange = e => { ST.stale = e.target.checked; draw(); };
    built = true;
  }
  const fItem = i => (ST.cat === 'All' || i.cat === ST.cat) && (ST.shop === 'All' || i.shop === ST.shop) && (!ST.q || `${i.code} ${i.part} ${(i.det || []).map(d => d.pr + ' ' + (d.po || '')).join(' ')}`.toLowerCase().includes(ST.q));
  const fLine = l => (ST.cat === 'All' || l.cat === ST.cat) && (ST.shop === 'All' || (D.byCode.get(l.code) || {}).shop === ST.shop) && (!ST.q || `${l.code || ''} ${l.txt} ${l.pr} ${l.po || ''} ${l.by || ''}`.toLowerCase().includes(ST.q));
  function render() {
    const sec = document.getElementById('purchasing'); if (!sec) return;
    const s = data();
    if (s !== 'ok') { built = false; sec.innerHTML = `<div class="pbar"><h2>Purchasing</h2></div><div class="empty">${s === 'err' ? 'The ME5A data could not be loaded.' : s === 'denied' ? 'You do not have access to the purchasing data.' : 'Loading ME5A data…'}</div>`; return; }
    if (!built || !sec.querySelector('#pu-k')) shell(sec);
    draw();
  }
  function draw() {
    const sec = document.getElementById('purchasing'); if (!sec || !D) return;
    sec.querySelectorAll('#pu-cats .chip').forEach(b => b.classList.toggle('on', b.dataset.c === ST.cat));
    const I = D.items.filter(fItem), O = D.open.filter(fLine);
    const prs = O.filter(l => l.kind === 'pr' && (ST.stale || l.age == null || l.age <= 183)), pos = O.filter(l => l.kind === 'po' && (ST.stale || !l.stale));
    const prI = prs.filter(l => CATS.includes(l.cat)), poI = pos.filter(l => CATS.includes(l.cat));
    const short = I.filter(i => i.short), prop = I.filter(i => i.prop > 0), crit = I.filter(i => i.crit), exc = I.filter(i => i.excess_q > 0);
    sec.querySelector('#pu-src').textContent = `SAP ME5A (SharePoint Portal Data/ME5A: ${(D.files || []).map(f => f.replace('.xlsx.txt', '').replace(/_/g, ' ')).join(', ')}), MB51 receipts and MB52 stock, as of ${dmy(D.asof)}. Item reference: Tools, Consumables, Spares, Lubricants and Raw Material codes in the Inventory tab (plants KHI + SKP; ATDMC plant MDP left out, ${nf(D.lines_mdp)} lines). The 2023 ME5A file has lost its text columns and is not used.`;
    const sumv = (a, f) => d3.sum(a, f);
    const propV = sumv(prop, i => i.prop * (i.unit || 0)), prV = sumv(prI, l => l.val), poV = sumv(poI, l => l.open_v);
    const rx = prI.filter(l => l.rx).length, old = d3.max(prI, l => l.age) || 0, late = poI.filter(l => l.late > 0).length;
    const lts = I.filter(i => i.lt_src === 'history').map(i => i.lt), p2os = I.map(i => i.p2o).filter(v => v != null);
    const ix = priceIndex(I.filter(i => (i.price || []).length >= 2));
    const lastY = ix.length > 15 ? (ix[ix.length - 1][1] / (ix[ix.length - 13] || ix[0])[1] - 1) * 100 : null;
    const K = [['crit', 'r', 'Critical items', nf(crit.length), `${short.length} short incl. open PRs/POs`],
      ['prop', 'o', 'Proposed PRs', nf(prop.length), `≈ Rs ${mpkr(propV)} to raise (not Raw Material)`],
      ['pr', 'b', 'Pending PRs (no PO)', nf(prI.length), `Rs ${mpkr(prV)} · ${rx} awaiting release · oldest ${old}d`],
      ['po', 'b', 'POs awaiting delivery', nf(poI.length), `Rs ${mpkr(poV)} open · ${late} past PR required date`],
      ['lt', 'g', 'Median lead time', `${lts.length ? Math.round(d3.median(lts)) : '—'} d`, `PO → receipt · PR → PO ${p2os.length ? Math.round(d3.median(p2os)) : '—'} d`],
      ['exc', 'r', 'Excess on order', `Rs ${mpkr(sumv(exc, i => i.excess_v))}`, `${exc.length} items · PR/PO beyond need`]];
    const kd = sec.querySelector('#pu-k'); kd.innerHTML = K.map(([v, c, t, b, s]) => `<div class="kpi ${c}${ST.view === v ? ' on' : ''}" data-v="${v}"><span>${t}</span><b>${b}</b><small>${s}</small></div>`).join('');
    kd.onclick = e => { const k = e.target.closest('.kpi'); if (!k) return; ST.view = k.dataset.v; ST.sort = null; draw(); };
    table(sec, { I, crit, prop, prs: prI, prsAll: prs, pos: poI, posAll: pos, exc });
    runway(sec.querySelector('#pu-run'), crit);
    proc(sec.querySelector('#pu-proc'));
    ageing(sec.querySelector('#pu-age'), prI);
    ltBox(sec.querySelector('#pu-lt'), I);
    price(sec, I);
    movers(sec.querySelector('#pu-mv'), I);
    insights(sec.querySelector('#pu-ins'), { I, crit, prop, prI, poI, exc, propV, prV, poV, lastY, late });
  }
  /* ---------- the one big table, five views ---------- */
  function table(sec, X) {
    const V = { crit: 'Critical items: stock runs out inside the lead time', prop: 'Prospective PR quantities for items in shortage', pr: 'Pending PRs: no PO yet', po: 'Approved POs: delivery awaited (last 6 months)', exc: 'Excess on order', lt: 'Lead and processing time by item' };
    const H = { crit: 'Items bought through PRs, with use in the last 6 months, whose days of stock are fewer than their lead time (or nothing in stock). Pipeline = open PR + open PO quantity.',
      prop: 'Short = stock + open PR + open PO below the reorder point (daily use × lead time × 1.5). Proposed PR brings the item up to daily use × (lead time + days target: Tools 60, Consumables 45, Spares 180, Lubricants 45). Only items bought through PRs since Jan 2024; Raw Material left out.',
      pr: 'PR lines with processing status N (no PO). "Awaiting release" = not yet released in SAP. Hover a row for the item\'s PR history.',
      po: 'PO lines not yet fully received. Received is matched from MB51 receipts first-in-first-out per item (MB51 has no PO number), so it is an estimate. Required date is the PR delivery date.',
      exc: 'Open PR + PO quantity above what the order-up-to level needs: stock already covers the days target, or the item has had no use for 6 months.',
      lt: 'Median days per item: PR approval (PR date → release), PR → PO (release → PO date) and lead time (PO date → receipt completing the PO). Hover for the individual PRs.' };
    sec.querySelector('#pu-tt').textContent = V[ST.view]; sec.querySelector('#pu-th').textContent = H[ST.view];
    const cnt = { crit: X.crit.length, prop: X.prop.length, pr: X.prs.length, po: X.pos.length, exc: X.exc.length, lt: X.I.filter(i => i.prs).length };
    const seg = sec.querySelector('#pu-seg'); seg.innerHTML = Object.keys(V).map(k => `<button data-v="${k}" class="${ST.view === k ? 'on' : ''}">${{ crit: 'Critical', prop: 'Propose PR', pr: 'Pending PRs', po: 'POs awaited', exc: 'Excess on order', lt: 'Lead & processing' }[k]}<i>${nf(cnt[k])}</i></button>`).join('');
    seg.onclick = e => { const b = e.target.closest('button'); if (!b) return; ST.view = b.dataset.v; ST.sort = null; draw(); };
    const item = i => `<td>${esc(i.part)}<span class="cd">${esc(i.code)} · ${esc(i.cat)}${i.shop ? ' · ' + esc(i.shop) : ''}</span></td>`;
    const runout = i => i.cover == null ? '—' : dmy(new Date(Date.parse(D.asof) + i.cover * 864e5).toISOString().slice(0, 10));
    let cols, rows, sortKey;
    if (ST.view === 'crit' || ST.view === 'prop' || ST.view === 'exc' || ST.view === 'lt') {
      const src = ST.view === 'crit' ? X.crit : ST.view === 'prop' ? X.prop : ST.view === 'exc' ? X.exc : X.I.filter(i => i.prs);
      if (ST.view === 'crit') cols = [['Item', null], ['Stock', 'stock'], ['Use/mo', 'use_month'], ['Cover d', 'cover'], ['Lead d', 'lt'], ['Runs out', 'cover'], ['Open PR', 'pr_open'], ['Open PO', 'po_open'], ['Next PO due', 'po_next'], ['Propose', 'prop'], ['Status', null]];
      if (ST.view === 'prop') cols = [['Item', null], ['Stock', 'stock'], ['Use/mo', 'use_month'], ['Lead d', 'lt'], ['Open PR', 'pr_open'], ['Open PO', 'po_open'], ['Reorder pt', 'rop'], ['Order-up-to', 'upto'], ['Propose PR', 'prop'], ['≈ Value', '_pv']];
      if (ST.view === 'exc') cols = [['Item', null], ['Stock', 'stock'], ['Use/mo', 'use_month'], ['Cover d', 'cover'], ['Open PR', 'pr_open'], ['Open PO', 'po_open'], ['Excess qty', 'excess_q'], ['Excess Rs', 'excess_v'], ['Note', null]];
      if (ST.view === 'lt') cols = [['Item', null], ['PRs', 'prs'], ['Approval d', 'appr'], ['PR→PO d', 'p2o'], ['Lead d', 'lt'], ['Basis', 'lt_src'], ['Open PR', 'pr_open_n'], ['Open PO', 'po_open_n'], ['Suppliers', null]];
      src.forEach(i => { i._pv = i.prop * (i.unit || 0); });
      const def = { crit: ['cover', 1], prop: ['_pv', -1], exc: ['excess_v', -1], lt: ['lt', -1] }[ST.view];
      const [sk, sd] = ST.sort || def; sortKey = sk;
      const arr = src.slice().sort((a, b) => ((a[sk] ?? -1e15) > (b[sk] ?? -1e15) ? 1 : (a[sk] ?? -1e15) < (b[sk] ?? -1e15) ? -1 : 0) * sd);
      rows = arr.slice(0, 400).map(i => {
        const tag = i.stock <= 0 ? '<span class="tag t-r">out of stock</span>' : i.cover != null && i.cover < i.lt ? '<span class="tag t-r">runs out before supply</span>' : '<span class="tag t-o">tight</span>';
        const covered = i.po_next && i.cover != null && Date.parse(i.po_next) <= Date.parse(D.asof) + i.cover * 864e5;
        let tds;
        if (ST.view === 'crit') tds = `${item(i)}<td class="n">${qf(i.stock)}</td><td class="n">${qf(i.use_month)}</td><td class="n">${i.cover ?? '—'}</td><td class="n">${i.lt}</td><td>${runout(i)}</td><td class="n">${i.pr_open ? qf(i.pr_open) : '—'}</td><td class="n">${i.po_open ? qf(i.po_open) : '—'}</td><td>${i.po_next ? dmy(i.po_next) + (covered ? '' : ' <span class="tag t-r">late</span>') : '—'}</td><td class="n">${i.prop ? qf(Math.ceil(i.prop)) : '—'}</td><td>${tag}${i.pr_open_rx ? ' <span class="tag t-o">PR not released</span>' : ''}</td>`;
        if (ST.view === 'prop') tds = `${item(i)}<td class="n">${qf(i.stock)}</td><td class="n">${qf(i.use_month)}</td><td class="n">${i.lt}</td><td class="n">${i.pr_open ? qf(i.pr_open) : '—'}</td><td class="n">${i.po_open ? qf(i.po_open) : '—'}</td><td class="n">${qf(i.rop)}</td><td class="n">${qf(i.upto)}</td><td class="n"><b>${qf(Math.ceil(i.prop))}</b> ${esc(i.uom)}</td><td class="n">${i.unit ? mpkr(i._pv) : '—'}</td>`;
        if (ST.view === 'exc') tds = `${item(i)}<td class="n">${qf(i.stock)}</td><td class="n">${qf(i.use_month)}</td><td class="n">${i.cover ?? '—'}</td><td class="n">${i.pr_open ? qf(i.pr_open) : '—'}</td><td class="n">${i.po_open ? qf(i.po_open) : '—'}</td><td class="n"><b>${qf(i.excess_q)}</b></td><td class="n">${mpkr(i.excess_v)}</td><td>${i.use_month ? '' : '<span class="tag t-n">no use in 6 months</span>'}${i.fo ? ' <span class="tag t-b">framework PR</span>' : ''}</td>`;
        if (ST.view === 'lt') tds = `${item(i)}<td class="n">${i.prs}</td><td class="n">${i.appr ?? '—'}</td><td class="n">${i.p2o ?? '—'}</td><td class="n"><b>${i.lt}</b></td><td>${i.lt_src === 'history' ? `${i.lt_n} PO${i.lt_n > 1 ? 's' : ''}` : i.lt_src}</td><td class="n">${i.pr_open_n || '—'}</td><td class="n">${i.po_open_n || '—'}</td><td>${(i.sups || []).map(esc).join(', ')}</td>`;
        return `<tr class="it" data-c="${esc(i.code)}">${tds}</tr>`; });
    } else {
      const src = ST.view === 'pr' ? X.prs : X.pos;
      if (ST.view === 'pr') cols = [['Item / text', null], ['PR / item', 'pr'], ['PR date', 'd'], ['Age d', 'age'], ['Qty', 'q'], ['Value', 'val'], ['Released', 'rx'], ['Requisitioner', 'by'], ['Lead d', '_lt'], ['Stock cover', '_cov']];
      else cols = [['Item / text', null], ['PO', 'po'], ['PO date', 'pod'], ['Ordered', 'qo'], ['Received', 'got'], ['Open', 'open'], ['Open Rs', 'open_v'], ['Required', 'deld'], ['Late d', 'late'], ['Supplier', 'sup']];
      src.forEach(l => { const i = D.byCode.get(l.code); l._lt = i ? i.lt : null; l._cov = i ? i.cover : null; });
      const def = ST.view === 'pr' ? ['age', -1] : ['late', -1]; const [sk, sd] = ST.sort || def; sortKey = sk;
      const arr = src.slice().sort((a, b) => ((a[sk] ?? -1e15) > (b[sk] ?? -1e15) ? 1 : (a[sk] ?? -1e15) < (b[sk] ?? -1e15) ? -1 : 0) * sd);
      rows = arr.slice(0, 500).map(l => {
        const it = `<td>${esc(l.txt)}<span class="cd">${esc(l.code || 'no material code')} · ${esc(l.cat)} · ${esc(l.plant)}</span></td>`;
        if (ST.view === 'pr') return `<tr class="it" data-c="${esc(l.code || '')}">${it}<td>${esc(l.pr)}/${esc(l.it)}</td><td>${dmy(l.d)}</td><td class="n">${l.age ?? '—'}</td><td class="n">${qf(l.q)} ${esc(l.uom)}</td><td class="n">${mpkr(l.val)}</td><td>${l.rx ? '<span class="tag t-o">awaiting</span>' : '<span class="tag t-g">released</span>'}</td><td>${esc(l.by || '')}</td><td class="n">${l._lt ?? '—'}</td><td class="n">${l._cov == null ? '—' : l._cov + ' d'}</td></tr>`;
        return `<tr class="it" data-c="${esc(l.code || '')}">${it}<td>${esc(l.po)}</td><td>${dmy(l.pod)}</td><td class="n">${qf(l.qo)}</td><td class="n">${l.got ? qf(l.got) : '—'}</td><td class="n"><b>${qf(l.open)}</b></td><td class="n">${mpkr(l.open_v)}</td><td>${dmy(l.deld)}</td><td class="n">${l.late ? `<span style="color:#B42318">${l.late}</span>` : '—'}</td><td>${esc((l.sup || '').slice(0, 30))}${l.stale ? ' <span class="tag t-n">over 6 months</span>' : ''}</td></tr>`; });
    }
    const tw = sec.querySelector('#pu-tw');
    tw.innerHTML = rows.length ? `<table><thead><tr>${cols.map(([t, k], j) => `<th class="${j ? 'n' : ''}" data-k="${k || ''}">${t}${k && k === sortKey ? (ST.sort && ST.sort[1] > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>` : '<div class="empty">Nothing here for this filter.</div>';
    tw.querySelector('thead') && (tw.querySelector('thead').onclick = e => { const th = e.target.closest('th'); if (!th || !th.dataset.k) return; const k = th.dataset.k; ST.sort = ST.sort && ST.sort[0] === k ? [k, -ST.sort[1]] : [k, -1]; draw(); });
    tw.onmouseover = e => { const tr = e.target.closest('tr.it'); if (!tr) return; const i = D.byCode.get(tr.dataset.c); if (i) tip.show(e, prTip(i)); else tip.hide(); };
    tw.onmousemove = e => tip.move(e); tw.onmouseleave = () => tip.hide();
    const total = { crit: X.crit.length, prop: X.prop.length, exc: X.exc.length, lt: X.I.filter(i => i.prs).length, pr: X.prs.length, po: X.pos.length }[ST.view];
    sec.querySelector('#pu-tn').textContent = (total > rows.length ? `Showing ${rows.length} of ${nf(total)}. ` : '') + (ST.view === 'pr' ? `${nf(X.prsAll.length - X.prs.length)} more pending PR lines are for codes outside the item reference (production parts, services with no material code).` : ST.view === 'po' ? `${nf(X.posAll.length - X.pos.length)} more open PO lines are for codes outside the item reference.` : '');
  }
  /* ---------- runway chart ---------- */
  function runway(el, crit) {
    const W = el.clientWidth || 520, A = crit.slice().sort((a, b) => (b.use_month * (b.unit || 0)) - (a.use_month * (a.unit || 0))).slice(0, 16);
    if (!A.length) { el.innerHTML = '<div class="empty">No critical items for this filter.</div>'; return; }
    const H = A.length * 26 + 30, L = 200, R = 14, x = d3.scaleLinear().domain([0, d3.max(A, i => Math.max(i.lt * 1.6, i.cover || 0, ...(i.det || []).map(() => 0))) || 60]).nice().range([L, W - R]);
    const svg = d3.create('svg').attr('width', W).attr('height', H);
    svg.append('g').attr('class', 'ax').attr('transform', `translate(0,${H - 20})`).call(d3.axisBottom(x).ticks(6).tickFormat(d => d + 'd'));
    A.forEach((i, k) => { const y = 6 + k * 26, c = i.cover ?? 0, col = c < i.lt ? '#D0312D' : c < i.lt * 1.5 ? '#C98300' : '#1E8C5A';
      const g = svg.append('g').style('cursor', 'default').on('mousemove', ev => tip.show(ev, prTip(i))).on('mouseleave', () => tip.hide());
      g.append('text').attr('x', L - 6).attr('y', y + 12).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', '#051C2C').text(i.part.length > 27 ? i.part.slice(0, 26) + '…' : i.part);
      g.append('rect').attr('x', L).attr('y', y + 2).attr('width', W - R - L).attr('height', 14).attr('fill', '#F0F2F5');
      g.append('rect').attr('x', L).attr('y', y + 2).attr('width', Math.max(2, x(Math.min(c, x.domain()[1])) - L)).attr('height', 14).attr('fill', col);
      g.append('line').attr('x1', x(i.lt)).attr('x2', x(i.lt)).attr('y1', y - 1).attr('y2', y + 19).attr('stroke', '#051C2C').attr('stroke-width', 2);
      if (i.po_next) { const dd = Math.round((Date.parse(i.po_next) - Date.parse(D.asof)) / 864e5); g.append('circle').attr('cx', x(Math.max(0, Math.min(dd, x.domain()[1])))).attr('cy', y + 9).attr('r', 4.5).attr('fill', '#2251FF').attr('stroke', '#fff'); }
      g.append('text').attr('x', Math.min(W - R - 2, x(Math.min(c, x.domain()[1])) + 4)).attr('y', y + 13).attr('font-size', 10.5).attr('fill', '#051C2C').attr('text-anchor', x(c) > W - 60 ? 'end' : 'start').text(i.stock <= 0 ? 'out' : `${c}d`); });
    el.replaceChildren(svg.node());
  }
  /* ---------- processing time ---------- */
  function proc(el) {
    const A = (D.monthly || []).filter(m => m.m >= '2024-01'); const W = el.clientWidth || 380, H = 210, L = 30, R = 10, T = 8, B = 22;
    const x = d3.scaleBand().domain(A.map(m => m.m)).range([L, W - R]).padding(.25), y = d3.scaleLinear().domain([0, d3.max(A, m => Math.max(m.p2o || 0, m.lt || 0)) || 30]).nice().range([H - B, T]);
    const svg = d3.create('svg').attr('width', W).attr('height', H);
    svg.append('g').attr('class', 'ax').attr('transform', `translate(0,${H - B})`).call(d3.axisBottom(x).tickValues(A.map(m => m.m).filter((m, k) => k % 4 === 0)).tickFormat(mlab));
    svg.append('g').attr('class', 'ax').attr('transform', `translate(${L},0)`).call(d3.axisLeft(y).ticks(5));
    svg.selectAll('rect.b').data(A).join('rect').attr('x', m => x(m.m)).attr('width', x.bandwidth()).attr('y', m => y(m.p2o || 0)).attr('height', m => y(0) - y(m.p2o || 0)).attr('fill', '#AAE6F0')
      .on('mousemove', (ev, m) => tip.show(ev, `<b>${mlab(m.m)}</b><br>${m.prs} PR lines · ${m.po} with PO<br>PR → PO median ${m.p2o ?? '—'} d · PO → receipt median ${m.lt ?? '—'} d<br>Approval median ${m.appr ?? '—'} d · PR value Rs ${mpkr(m.val)}`)).on('mouseleave', () => tip.hide());
    const ln = d3.line().defined(m => m.lt != null).x(m => x(m.m) + x.bandwidth() / 2).y(m => y(m.lt));
    svg.append('path').attr('d', ln(A)).attr('fill', 'none').attr('stroke', '#051C2C').attr('stroke-width', 2);
    el.replaceChildren(svg.node()); const lg = document.createElement('div'); lg.className = 'lg'; lg.innerHTML = '<span><i style="background:#AAE6F0"></i>PR → PO days</span><span><i style="background:#051C2C"></i>PO → receipt days</span><span>Recent months are lower because slow POs are still open.</span>'; el.appendChild(lg);
  }
  /* ---------- pending PR ageing ---------- */
  function ageing(el, prs) {
    const B = [['0–30', 0, 30], ['31–60', 31, 60], ['61–90', 61, 90], ['91–180', 91, 180], ['181–365', 181, 365], ['> 1 yr', 366, 1e9]];
    const cats = CATS.filter(c => prs.some(l => l.cat === c));
    const rows = B.map(([n, a, b]) => { const o = { n }; cats.forEach(c => { o[c] = prs.filter(l => l.cat === c && l.age >= a && l.age <= b).length; }); return o; });
    const W = el.clientWidth || 380, H = 210, L = 30, R = 10, T = 8, Bm = 22;
    const st = d3.stack().keys(cats)(rows), x = d3.scaleBand().domain(B.map(b => b[0])).range([L, W - R]).padding(.25), y = d3.scaleLinear().domain([0, d3.max(st.length ? st[st.length - 1] : [[0, 1]], d => d[1]) || 1]).nice().range([H - Bm, T]);
    const svg = d3.create('svg').attr('width', W).attr('height', H);
    svg.append('g').attr('class', 'ax').attr('transform', `translate(0,${H - Bm})`).call(d3.axisBottom(x)); svg.append('g').attr('class', 'ax').attr('transform', `translate(${L},0)`).call(d3.axisLeft(y).ticks(5));
    st.forEach(s => svg.append('g').selectAll('rect').data(s).join('rect').attr('x', d => x(d.data.n)).attr('width', x.bandwidth()).attr('y', d => y(d[1])).attr('height', d => y(d[0]) - y(d[1])).attr('fill', CC[s.key])
      .on('mousemove', (ev, d) => tip.show(ev, `<b>${d.data.n} days</b><br>${cats.map(c => `${c}: ${d.data[c]}`).join('<br>')}`)).on('mouseleave', () => tip.hide()));
    el.replaceChildren(svg.node()); const lg = document.createElement('div'); lg.className = 'lg'; lg.innerHTML = cats.map(c => `<span><i style="background:${CC[c]}"></i>${c}</span>`).join(''); el.appendChild(lg);
  }
  /* ---------- lead time box by category ---------- */
  function ltBox(el, I) {
    const cats = CATS.filter(c => I.some(i => i.cat === c && i.lt_src === 'history'));
    const W = el.clientWidth || 380, H = 210, L = 90, R = 14, T = 6, B = 22;
    const vals = I.filter(i => i.lt_src === 'history').map(i => i.lt), mx = Math.min(d3.quantile(vals.sort(d3.ascending), .97) || 120, 240);
    const y = d3.scaleBand().domain(cats).range([T, H - B]).padding(.3), x = d3.scaleLinear().domain([0, mx]).nice().range([L, W - R]);
    const svg = d3.create('svg').attr('width', W).attr('height', H);
    svg.append('g').attr('class', 'ax').attr('transform', `translate(0,${H - B})`).call(d3.axisBottom(x).ticks(6).tickFormat(d => d + 'd')); svg.append('g').attr('class', 'ax').attr('transform', `translate(${L},0)`).call(d3.axisLeft(y));
    cats.forEach(c => { const v = I.filter(i => i.cat === c && i.lt_src === 'history').map(i => i.lt).sort(d3.ascending); if (!v.length) return;
      const q1 = d3.quantile(v, .25), q2 = d3.quantile(v, .5), q3 = d3.quantile(v, .75), yy = y(c), h = y.bandwidth();
      v.forEach((t, k) => svg.append('circle').attr('cx', x(Math.min(t, mx))).attr('cy', yy + h / 2 + ((k * 7) % 11 - 5)).attr('r', 2).attr('fill', CC[c]).attr('opacity', .35));
      svg.append('rect').attr('x', x(q1)).attr('width', Math.max(2, x(q3) - x(q1))).attr('y', yy).attr('height', h).attr('fill', 'none').attr('stroke', '#051C2C');
      svg.append('line').attr('x1', x(q2)).attr('x2', x(q2)).attr('y1', yy).attr('y2', yy + h).attr('stroke', '#051C2C').attr('stroke-width', 2.5);
      svg.append('rect').attr('x', L).attr('y', yy).attr('width', W - R - L).attr('height', h).attr('fill', 'transparent').on('mousemove', ev => tip.show(ev, `<b>${c}</b><br>${v.length} items with completed POs<br>median ${Math.round(q2)} d · middle half ${Math.round(q1)}–${Math.round(q3)} d`)).on('mouseleave', () => tip.hide()); });
    el.replaceChildren(svg.node());
  }
  /* ---------- price index (chain-linked, geometric mean of month-on-month price relatives, unit mix-ups dropped) ---------- */
  function priceIndex(items) {
    const months = [...new Set(items.flatMap(i => i.price.map(p => p[0])))].sort(); if (!months.length) return [];
    const last = new Map(); let ix = 100; const out = [];
    months.forEach(m => { const rel = [];
      items.forEach(i => { const p = i.price.find(q => q[0] === m); if (!p) return; const l = last.get(i.code); if (l) { const r = p[1] / l; if (r > 0.5 && r < 2) rel.push(r); } last.set(i.code, p[1]); });
      if (out.length && rel.length >= Math.min(3, items.length)) ix *= Math.exp(d3.mean(rel, Math.log)); out.push([m, ix, rel.length]); });
    return out;
  }
  const mser = k => (M && M.series && M.series[k] && M.series[k].data) || [];
  function price(sec, I) {
    const ctl = sec.querySelector('#pu-pc');
    const drvs = ['all', 'alu', 'cu', 'steel', 'fx', 'cpi'];
    if (!ctl.dataset.b) { ctl.dataset.b = 1;
      ctl.innerHTML = `Items <select id="pu-drv">${drvs.map(d => `<option value="${d}">${d === 'all' ? 'All items with receipts' : 'Driver: ' + DNAME[d]}</option>`).join('')}</select>
 against <select id="pu-mkt"><option value="usdpkr">USD/PKR</option><option value="cpi">Pakistan CPI</option><option value="alu">Aluminium (USD)</option><option value="alupkr">Aluminium in PKR</option><option value="cu">Copper (USD)</option><option value="cupkr">Copper in PKR</option><option value="steel">Steel mill products</option></select>
 view <select id="pu-mode"><option value="index">Index (first month = 100)</option><option value="yoy">Change vs a year earlier (%)</option></select> <span id="pu-selx"></span>`;
      ctl.querySelector('#pu-drv').onchange = e => { ST.drv = e.target.value; ST.sel = null; draw(); };
      ctl.querySelector('#pu-mkt').onchange = e => { ST.mkt = e.target.value; draw(); };
      ctl.querySelector('#pu-mode').onchange = e => { ST.mode = e.target.value; draw(); }; }
    ctl.querySelector('#pu-drv').value = ST.drv; ctl.querySelector('#pu-mkt').value = ST.mkt; ctl.querySelector('#pu-mode').value = ST.mode;
    if (ST.mkt === 'cpi' && ST.mode === 'index') { ST.mode = 'yoy'; ctl.querySelector('#pu-mode').value = 'yoy'; }
    const sel = ST.sel ? D.byCode.get(ST.sel) : null;
    ctl.querySelector('#pu-selx').innerHTML = sel ? `<span class="tag t-b">${esc(sel.part.slice(0, 34))}</span> <a href="#" id="pu-clr" style="font-size:12px">show the group again</a>` : '';
    const cl = ctl.querySelector('#pu-clr'); if (cl) cl.onclick = e => { e.preventDefault(); ST.sel = null; draw(); };
    const pool = sel ? [sel] : I.filter(i => (i.price || []).length >= 2 && (ST.drv === 'all' || i.drv === ST.drv));
    sec.querySelector('#pu-ph').textContent = sel ? `Monthly receipt price of ${sel.part} (${sel.code}), PKR per ${sel.uom}, against ${mname()}.` : `Purchase price index of ${pool.length} items (${ST.drv === 'all' ? 'all drivers' : DNAME[ST.drv]}; average month-on-month price change, chain-linked) against ${mname()}.`;
    const el = sec.querySelector('#pu-pch');
    let ix = sel ? sel.price.map(p => [p[0], p[1]]) : priceIndex(pool).map(p => [p[0], p[1]]);
    const mk = mkt(); const months = [...new Set([...ix.map(p => p[0]), ...mk.map(p => p[0])])].filter(m => m >= '2024-01').sort();
    const first = m0 => s => { const b = s.find(p => p[0] >= m0); return b ? s.map(p => [p[0], p[1] / b[1] * 100]) : []; };
    const yoy = s => { const mp = new Map(s); return s.map(([m, v]) => { const y0 = `${+m.slice(0, 4) - 1}${m.slice(4)}`; return mp.has(y0) ? [m, (v / mp.get(y0) - 1) * 100] : null; }).filter(Boolean); };
    let A, B2;
    if (ST.mode === 'index') { const m0 = ix.length ? ix[0][0] : months[0]; A = first(m0)(ix); B2 = first(m0)(mk); }
    else { A = yoy(ix); B2 = ST.mkt === 'cpi' ? mk : yoy(mk); }
    const W = el.clientWidth || 600, H = 260, L = 40, R = 12, T = 10, Bm = 24;
    if (!A.length) { el.innerHTML = '<div class="empty">Not enough receipt prices for this selection.</div>'; sec.querySelector('#pu-plg').innerHTML = ''; sec.querySelector('#pu-pins').innerHTML = ''; return; }
    const xs = [...new Set([...A, ...B2].map(p => p[0]))].sort(), x = d3.scalePoint().domain(xs).range([L, W - R]);
    const ext = d3.extent([...A, ...B2].map(p => p[1])); const y = d3.scaleLinear().domain([Math.min(ext[0], ST.mode === 'index' ? 90 : -5), Math.max(ext[1], ST.mode === 'index' ? 110 : 5)]).nice().range([H - Bm, T]);
    const svg = d3.create('svg').attr('width', W).attr('height', H);
    svg.append('g').attr('class', 'ax').attr('transform', `translate(0,${H - Bm})`).call(d3.axisBottom(x).tickValues(xs.filter((m, k) => k % 3 === 0)).tickFormat(mlab));
    svg.append('g').attr('class', 'ax').attr('transform', `translate(${L},0)`).call(d3.axisLeft(y).ticks(6).tickFormat(d => ST.mode === 'index' ? d : d + '%'));
    svg.append('line').attr('x1', L).attr('x2', W - R).attr('y1', y(ST.mode === 'index' ? 100 : 0)).attr('y2', y(ST.mode === 'index' ? 100 : 0)).attr('stroke', '#9AA5B1').attr('stroke-dasharray', '3 3');
    const ln = d3.line().x(p => x(p[0])).y(p => y(p[1]));
    svg.append('path').attr('d', ln(B2)).attr('fill', 'none').attr('stroke', '#C98300').attr('stroke-width', 2).attr('stroke-dasharray', '5 3');
    svg.append('path').attr('d', ln(A)).attr('fill', 'none').attr('stroke', '#2251FF').attr('stroke-width', 2.5);
    const ov = svg.append('rect').attr('x', L).attr('y', T).attr('width', W - R - L).attr('height', H - Bm - T).attr('fill', 'transparent');
    const ma = new Map(A), mb = new Map(B2);
    ov.on('mousemove', ev => { const [px] = d3.pointer(ev); const m = xs.reduce((b, k) => Math.abs(x(k) - px) < Math.abs(x(b) - px) ? k : b, xs[0]);
      const f = v => v == null ? '—' : ST.mode === 'index' ? n1(v) : (v > 0 ? '+' : '') + n1(v) + '%'; tip.show(ev, `<b>${mlab(m)}</b><br><span style="color:#2251FF">${sel ? 'Item price' : 'Purchase price index'}</span>: ${f(ma.get(m))}<br><span style="color:#9A6200">${mname()}</span>: ${f(mb.get(m))}`); }).on('mouseleave', () => tip.hide());
    el.replaceChildren(svg.node());
    sec.querySelector('#pu-plg').innerHTML = `<span><i style="background:#2251FF"></i>${sel ? 'item receipt price' : 'purchase price index'}</span><span><i style="background:#C98300"></i>${mname()}</span><span>Sources: SAP MB51; ${esc(src())}</span>`;
    // correlation of monthly changes and pass-through
    const ch = s => { const r = []; for (let k = 1; k < s.length; k++) r.push([s[k][0], s[k][1] / s[k - 1][1] - 1]); return new Map(r); };
    let corr = null; if (ST.mode === 'index' && ix.length > 6) { const a = ch(ix), b = ch(mk); const ks = [...a.keys()].filter(k => b.has(k)); if (ks.length > 6) corr = pearson(ks.map(k => a.get(k)), ks.map(k => b.get(k))); }
    const ins = [];
    if (ix.length > 1) { const a0 = ix[0], a1 = ix[ix.length - 1], b0 = mk.find(p => p[0] >= a0[0]), b1 = mk[mk.length - 1];
      ins.push(`${sel ? 'Price' : 'The index'} moved <b>${(a1[1] / a0[1] - 1 >= 0 ? '+' : '') + n1((a1[1] / a0[1] - 1) * 100)}%</b> from ${mlab(a0[0])} to ${mlab(a1[0])}` + (b0 && ST.mkt !== 'cpi' ? `, while ${mname()} moved ${(b1[1] / b0[1] - 1 >= 0 ? '+' : '') + n1((b1[1] / b0[1] - 1) * 100)}% (${mlab(b0[0])} to ${mlab(b1[0])}).` : '.'));
      if (ST.mkt === 'cpi') { const c = mser('cpi').filter(p => p[0] >= a0[0]); if (c.length) { const cum = c.reduce((v, p) => v * Math.pow(1 + p[1] / 100, 1 / 12), 1); ins.push(`Pakistan CPI implies roughly <b>+${n1((cum - 1) * 100)}%</b> over the same period (compounded from the monthly year-on-year rates), so ${a1[1] / a0[1] - 1 > cum - 1 ? 'purchase prices rose faster than general inflation' : 'purchase prices rose slower than general inflation'}.`); } } }
    if (corr != null) ins.push(`Month-to-month, ${sel ? 'this price' : 'the index'} and ${mname()} have a correlation of <b>${d3.format('.2f')(corr)}</b> (${Math.abs(corr) < .2 ? 'little link' : Math.abs(corr) < .5 ? 'some link' : 'strong link'}). Receipt prices usually follow market moves with a lag of one to three months.`);
    if (!sel) { const byD = d3.rollups(I.filter(i => (i.price || []).length >= 2), v => v.length, i => i.drv); ins.push(`Items by market driver: ${byD.sort((a, b) => b[1] - a[1]).map(([k, n]) => `${DNAME[k]} ${n}`).join(', ')}. Driver is guessed from the item name and supplier code (4xxxxx = foreign supplier); pick a driver above to compare that group alone.`); }
    sec.querySelector('#pu-pins').innerHTML = ins.map(s => `<li>${s}</li>`).join('');
  }
  const pearson = (a, b) => { const ma = d3.mean(a), mb = d3.mean(b); let s = 0, sa = 0, sb = 0; a.forEach((v, k) => { s += (v - ma) * (b[k] - mb); sa += (v - ma) ** 2; sb += (b[k] - mb) ** 2; }); return sa && sb ? s / Math.sqrt(sa * sb) : null; };
  const mname = () => ({ usdpkr: 'USD/PKR', cpi: 'Pakistan CPI (YoY %)', alu: 'Aluminium (USD/t)', alupkr: 'Aluminium in PKR', cu: 'Copper (USD/t)', cupkr: 'Copper in PKR', steel: 'Steel mill products index' }[ST.mkt]);
  const src = () => { const k = { alupkr: 'alu', cupkr: 'cu' }[ST.mkt] || ST.mkt; const s = M && M.series && M.series[k]; return s ? s.src + (/pkr$/.test(ST.mkt) ? '; State Bank of Pakistan USD/PKR' : '') : 'market data not loaded'; };
  function mkt() { if (/pkr$/.test(ST.mkt) && ST.mkt !== 'usdpkr') { const b = mser(ST.mkt.replace('pkr', '')), fx = new Map(mser('usdpkr')); return b.filter(p => fx.has(p[0])).map(p => [p[0], p[1] * fx.get(p[0])]); } return mser(ST.mkt); }
  /* ---------- movers ---------- */
  function movers(el, I) {
    const last = D.asof.slice(0, 7), mm = k => { const d = new Date(Date.UTC(+last.slice(0, 4), +last.slice(5, 7) - 1 - k, 1)); return d.toISOString().slice(0, 7); };
    const now3 = [mm(0), mm(1), mm(2), mm(3)], ago3 = [mm(12), mm(13), mm(14), mm(15)];
    const R = I.filter(i => (i.price || []).length >= 2).map(i => { const P = new Map(i.price); const a = now3.map(m => P.get(m)).filter(v => v != null), b = ago3.map(m => P.get(m)).filter(v => v != null);
      if (!a.length || !b.length) return null; const ch = d3.mean(a) / d3.mean(b) - 1; if (ch > 2 || ch < -0.67) return null; return { i, ch, a: d3.mean(a), b: d3.mean(b) }; }).filter(Boolean).sort((p, q) => Math.abs(q.ch) * (q.i.use_month * (q.i.unit || 1)) - Math.abs(p.ch) * (p.i.use_month * (p.i.unit || 1)));
    if (!R.length) { el.innerHTML = '<div class="empty">Not enough receipt prices a year apart for this filter.</div>'; return; }
    const sp = i => { const v = i.price.slice(-18).map(p => p[1]); if (v.length < 2) return ''; const mn = d3.min(v), mx = d3.max(v) || 1; return `<svg width="70" height="18"><path d="${v.map((t, k) => `${k ? 'L' : 'M'}${(k / (v.length - 1) * 68 + 1).toFixed(1)},${(17 - (mx === mn ? 8 : (t - mn) / (mx - mn) * 16)).toFixed(1)}`).join('')}" fill="none" stroke="#2251FF" stroke-width="1.5"/></svg>`; };
    el.innerHTML = `<table><thead><tr><th>Item</th><th class="n">Year ago</th><th class="n">Now</th><th class="n">Change</th><th>18 months</th><th>Driver</th></tr></thead><tbody>${R.slice(0, 60).map(r => `<tr class="it" data-c="${esc(r.i.code)}" style="cursor:pointer"><td>${esc(r.i.part)}<span class="cd">${esc(r.i.code)} · per ${esc(r.i.uom)}</span></td><td class="n">${qf(r.b)}</td><td class="n">${qf(r.a)}</td><td class="n" style="color:${r.ch > 0.05 ? '#B42318' : r.ch < -0.05 ? '#1E6B4A' : '#5A6670'};font-weight:600">${(r.ch > 0 ? '+' : '') + n1(r.ch * 100)}%</td><td>${sp(r.i)}</td><td><span class="tag t-n">${DNAME[r.i.drv]}</span></td></tr>`).join('')}</tbody></table>`;
    el.onclick = e => { const tr = e.target.closest('tr.it'); if (!tr) return; ST.sel = tr.dataset.c; const s = D.byCode.get(ST.sel); if (s) { ST.mkt = { alu: 'alupkr', cu: 'cupkr', steel: 'steel', fx: 'usdpkr', cpi: 'cpi' }[s.drv] || 'usdpkr'; ST.mode = ST.mkt === 'cpi' ? 'yoy' : 'index'; } draw(); document.getElementById('pu-pch').scrollIntoView({ block: 'center', behavior: 'smooth' }); };
    el.onmouseover = e => { const tr = e.target.closest('tr.it'); if (!tr) return; const i = D.byCode.get(tr.dataset.c); if (i) tip.show(e, prTip(i)); }; el.onmousemove = e => tip.move(e); el.onmouseleave = () => tip.hide();
  }
  /* ---------- insights ---------- */
  function insights(el, X) {
    const L = [];
    const out = X.crit.filter(i => i.stock <= 0), noPipe = X.crit.filter(i => !i.pr_open && !i.po_open);
    if (X.crit.length) L.push(`<b>${X.crit.length} items</b> run out before a new supply can arrive (${out.length} already out of stock). <b>${noPipe.length}</b> of them have no open PR or PO at all — start with ${noPipe.slice().sort((a, b) => b.use_month * (b.unit || 0) - a.use_month * (a.unit || 0)).slice(0, 3).map(i => esc(i.part)).join(', ') || '—'}.`);
    if (X.prop.length) L.push(`Raising the <b>${X.prop.length} proposed PRs</b> would cost about <b>Rs ${mpkr(X.propV)}</b> at current stock prices; the largest are ${X.prop.slice().sort((a, b) => b.prop * (b.unit || 0) - a.prop * (a.unit || 0)).slice(0, 3).map(i => `${esc(i.part)} (${qf(Math.ceil(i.prop))} ${esc(i.uom)})`).join(', ')}.`);
    const rx = X.prI.filter(l => l.rx), old = X.prI.filter(l => l.age > 30);
    if (X.prI.length) L.push(`<b>${X.prI.length} PR lines</b> (Rs ${mpkr(X.prV)}) are waiting for a PO; ${rx.length} are not yet released and ${old.length} are older than 30 days. PR approval is usually same-day, so the wait is in buying (PR → PO).`);
    if (X.poI.length) L.push(`<b>${X.poI.length} PO lines</b> worth Rs ${mpkr(X.poV)} are still awaited; ${X.late} are past the required date. Chase the suppliers with the most late lines: ${d3.rollups(X.poI.filter(l => l.late > 0 && l.sup), v => v.length, l => l.sup).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, n]) => `${esc(s)} (${n})`).join(', ') || '—'}.`);
    const ex = X.exc.slice().sort((a, b) => b.excess_v - a.excess_v);
    if (ex.length) L.push(`<b>Rs ${mpkr(d3.sum(ex, i => i.excess_v))}</b> of open PRs/POs is more than needed (${ex.filter(i => !i.use_month).length} items had no use in 6 months). Review before receipt: ${ex.slice(0, 3).map(i => `${esc(i.part)} (Rs ${mpkr(i.excess_v)})`).join(', ')}.`);
    const lc = D.lt_cat || {}; L.push(`Typical lead time from PO to receipt: ${Object.entries(lc).map(([c, v]) => `${c} ${v} d`).join(', ')}. Items with no completed PO use their category's median.`);
    if (X.lastY != null) { const fx = mser('usdpkr'), cpi = mser('cpi'); L.push(`Purchase prices of the items shown are <b>${(X.lastY >= 0 ? '+' : '') + n1(X.lastY)}%</b> on a year ago; Pakistan CPI is ${cpi.length ? cpi[cpi.length - 1][1] + '% (' + mlab(cpi[cpi.length - 1][0]) + ')' : '—'} and the rupee moved ${fx.length > 12 ? n1((fx[fx.length - 1][1] / fx[fx.length - 13][1] - 1) * 100) + '% against the dollar' : '—'} over the same year.`); }
    el.innerHTML = L.map(s => `<li>${s}</li>`).join('');
  }
  const d0 = window.__draw; if (d0) window.__draw = (...a) => { const r = d0(...a); if (window.__page === 'purchasing') { try { render(); } catch (e) { console.error(e); } } return r; };
  if (window.dash && dash.onData) dash.onData(() => { if (window.__page === 'purchasing') render(); });
  init();
  let tries = 0; const wait = setInterval(() => { tries++; if (window.__page === 'purchasing' && !D) render(); if (D || tries > 60) clearInterval(wait); }, 1000);
})();
