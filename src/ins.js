/* Insights tab (3 Nov, Umair): ranked, checkable insights built from the dashboard's own data, McKinsey-style.
   Content comes from the "insights" dataset, which tools/insights_build.py makes from Atlas, SAP MB52, SharePoint
   attendance, the VA/CR decks and Jira (never the sample smp_* data). Every statement carries its source.
   Claude artifact: dash.data('insights') (fallback: the uploaded file INS.blob). Portal: the "insights" dataset. */
(() => {
  const INS = { blob: 'a380ac8cec9865321c80dda4996eb370' };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fm = v => { v = +v || 0; const a = Math.abs(v); return a >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : a >= 1e4 ? Math.round(v / 1e3) + 'K' : d3.format(',')(Math.round(v)); };
  const pct = v => v == null ? '—' : (Math.round(v * 10) / 10) + '%';
  const C = { navy: '#051C2C', blue: '#2251FF', red: '#D0312D', amb: '#C98300', grn: '#1E8C5A', gry: '#C9D1D9', mut: '#5A6670', soft: '#F4F6F9' };
  let data = null, built = false, filt = 'All';
  const css = document.createElement('style'); css.textContent = `
#insights{--ix:#051C2C}
#insights .ihd{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;border-bottom:2px solid #051C2C;padding-bottom:10px;margin:4px 0 16px}
#insights .ihd h2{font-family:var(--font-anthropic-serif);font-weight:400;font-size:30px;color:#051C2C;margin:0;line-height:1.1}
#insights .ihd .sub{font-size:13px;color:#5A6670;margin-top:4px}
#insights .chips{display:flex;gap:6px;flex-wrap:wrap}#insights .chips button{font:inherit;font-size:12.5px;font-weight:600;padding:5px 12px;border:1px solid #D5DBE1;border-radius:14px;background:#EEF1F4;color:#5A6670;cursor:pointer}
#insights .chips button.on{background:#051C2C;border-color:#051C2C;color:#fff}
#insights .sec{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#2251FF;margin:22px 0 8px}
#insights .kp{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
#insights .k{background:#fff;border:1px solid #E2E6EB;border-top:3px solid #051C2C;padding:12px 14px}#insights .k.bad{border-top-color:#D0312D}#insights .k.warn{border-top-color:#C98300}#insights .k.ok{border-top-color:#1E8C5A}
#insights .k .l{font-size:12px;font-weight:700;color:#5A6670;text-transform:uppercase;letter-spacing:.05em}
#insights .k .v{font-family:var(--font-anthropic-serif);font-size:34px;color:#051C2C;line-height:1.1;margin:4px 0 2px}#insights .k .v small{font-size:15px;color:#5A6670;margin-left:3px}
#insights .k .d{font-size:12px;font-weight:700;margin-left:8px;vertical-align:4px}
#insights .k .s{font-size:12.5px;color:#5A6670}#insights .k .f{font-size:12.5px;font-weight:700;color:#D0312D;margin-top:5px}
#insights .pulse{display:flex;gap:10px;align-items:center;background:#EEF3FF;border-left:4px solid #2251FF;padding:9px 14px;margin-top:12px;font-size:13.5px;color:#051C2C}
#insights .pulse b{font-weight:700}
#insights .dec{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
#insights .dc{background:#fff;border:1px solid #E2E6EB;padding:14px 16px;display:flex;flex-direction:column;gap:6px;position:relative}
#insights .dc .no{font-family:var(--font-anthropic-serif);font-size:28px;color:#2251FF;line-height:1}
#insights .dc .ar{position:absolute;top:14px;right:14px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5A6670}
#insights .dc h4{margin:0;font-size:15px;line-height:1.3;color:#051C2C}#insights .dc p{margin:0;font-size:13px;line-height:1.45;color:#2B3A47}
#insights .dc .im{font-size:13px;font-weight:700;color:#1E8C5A}#insights .dc .src{font-size:11.5px;color:#8A949E;margin-top:auto}
#insights .cf{display:inline-block;font-size:10.5px;font-weight:700;padding:1px 7px;border-radius:9px;margin-left:6px;vertical-align:1px}#insights .cf.v{background:#E3F2EA;color:#1E8C5A}#insights .cf.c{background:#FFF1D6;color:#9A6400}
#insights .more{margin-top:12px;background:#fff;border:1px solid #E2E6EB}#insights .more summary{cursor:pointer;padding:10px 16px;font-weight:700;font-size:13.5px;color:#051C2C}
#insights .ml{display:grid;grid-template-columns:110px 1fr;border-top:1px solid #EEF1F4;padding:10px 16px;gap:12px;font-size:13px}#insights .ml .a{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5A6670;padding-top:2px}
#insights .ml b{color:#051C2C}#insights .ml .im{color:#1E8C5A;font-weight:700}#insights .ml .src{color:#8A949E;font-size:11.5px}
#insights .ex{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
#insights .x{background:#fff;border:1px solid #E2E6EB;padding:14px 18px 12px;min-width:0}#insights .x.w{grid-column:1/-1}
#insights .x .xn{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#5A6670}
#insights .x h3{font-family:var(--font-anthropic-serif);font-weight:400;font-size:19px;line-height:1.25;color:#051C2C;margin:3px 0 10px}
#insights .x .xs{font-size:11.5px;color:#8A949E;border-top:1px solid #EEF1F4;padding-top:6px;margin-top:8px}
#insights .x svg{display:block;width:100%;height:auto;overflow:visible}#insights .x svg text{font-family:inherit}
#insights table.it{width:100%;border-collapse:collapse;font-size:13px}#insights .it th{text-align:left;color:#5A6670;font-weight:600;border-bottom:2px solid #051C2C;padding:5px 8px;white-space:nowrap}
#insights .it td{padding:5px 8px;border-bottom:1px solid #EEF1F4}#insights .it .n{text-align:right;font-variant-numeric:tabular-nums}
#insights .hc{display:inline-block;min-width:44px;text-align:center;padding:2px 6px;border-radius:9px;font-size:12px;font-weight:700;color:#fff}
#insights .chk{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}#insights .ck{background:#fff;border:1px solid #E2E6EB;padding:12px 14px;display:flex;gap:12px;align-items:flex-start}
#insights .ck .cn{font-family:var(--font-anthropic-serif);font-size:28px;line-height:1;min-width:36px;text-align:right}#insights .ck .ct{font-size:13px;font-weight:700;color:#051C2C}#insights .ck .cd{font-size:12px;color:#5A6670;margin-top:3px}
#insights .meth{font-size:12px;color:#5A6670;line-height:1.5;margin:22px 0 6px;border-top:1px solid #E2E6EB;padding-top:10px}
#insights .lg{font-size:12px;color:#5A6670;margin-top:6px}#insights .lg i{display:inline-block;width:11px;height:11px;margin:0 5px 0 12px;vertical-align:-1px}
@media (max-width:1300px){#insights .kp{grid-template-columns:repeat(3,minmax(0,1fr))}#insights .dec{grid-template-columns:repeat(2,minmax(0,1fr))}#insights .chk{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:900px){#insights .ex{grid-template-columns:1fr}#insights .kp,#insights .dec,#insights .chk{grid-template-columns:1fr}}`;
  document.head.appendChild(css);
  const portal = () => window.__PORTAL;
  function init() {
    const P = portal(); if (P && P.canTab && !P.canTab('insights')) return;
    const tabs = document.getElementById('tabs'), root = document.getElementById('ael') || document.body; if (!tabs || document.getElementById('t-insights')) return;
    const b = document.createElement('button'); b.className = 'tab'; b.id = 't-insights'; b.setAttribute('role', 'tab'); b.dataset.p = 'insights'; b.textContent = 'Insights'; b.title = 'Ranked, checkable insights and the decisions they point to';
    b.addEventListener('click', ev => { ev.stopPropagation(); open(); }, true);
    const ov = document.getElementById('t-overview'); if (ov) ov.after(b); else tabs.prepend(b);
    const sec = document.createElement('section'); sec.className = 'page'; sec.id = 'insights'; const last = [...root.querySelectorAll('section.page')].pop(); if (last) last.after(sec); else root.appendChild(sec);
    if (location.hash === '#insights') open();
  }
  function open() {
    window.__page = 'insights'; document.querySelectorAll('#ael .page, section.page').forEach(s => s.classList.toggle('on', s.id === 'insights'));
    document.querySelectorAll('#tabs .tab').forEach(t => t.setAttribute('aria-selected', t.id === 't-insights' ? 'true' : 'false')); render();
  }
  async function load() {
    const Pt = window.Portal, one = x => Array.isArray(x) ? x[0] : x;
    if (portal() && Pt && Pt.sb) { const { data, error } = await Pt.sb.from('datasets').select('data').eq('name', 'insights').maybeSingle(); if (error || !data) throw new Error('no data'); return one(data.data); }
    try { const d = window.dash && dash.data('insights'); if (d && d.status === 'ok' && d.data && d.data.length) { const o = one(d.data); Object.keys(o).forEach(k => { if (typeof o[k] === 'string' && /^[[{]/.test(o[k])) try { o[k] = JSON.parse(o[k]); } catch (e) {} }); return o; } } catch (e) {}
    if (INS.blob) return one(await (await fetch('/_blob/' + INS.blob)).json());
    throw new Error('no data');
  }
  /* ---------- small chart helpers (plain SVG) ---------- */
  function hbars(rows, o = {}) {
    const W = o.w || 640, lw = o.lw || 170, bh = o.bh || 20, gap = o.gap || 7, mx = o.max || d3.max(rows, r => r.v) || 1, H = rows.length * (bh + gap);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'bar chart')}">`;
    rows.forEach((r, i) => { const y = i * (bh + gap), bw = Math.max(2, (W - lw - 150) * r.v / mx);
      s += `<text x="${lw - 8}" y="${y + bh / 2 + 4.5}" text-anchor="end" font-size="13" fill="${C.navy}">${esc(r.l)}</text><rect x="${lw}" y="${y}" width="${bw}" height="${bh}" fill="${r.c || C.navy}"/>` +
        (r.c2 != null ? `<rect x="${lw}" y="${y}" width="${Math.max(0, (W - lw - 150) * r.v2 / mx)}" height="${bh}" fill="${r.c2}"/>` : '') +
        `<text x="${lw + bw + 7}" y="${y + bh / 2 + 4.5}" font-size="13" font-weight="600" fill="${C.navy}">${esc(r.t)}</text>`; });
    return s + '</svg>';
  }
  function trendBars(tr) {
    const W = 640, H = 230, mx = d3.max(tr, d => Math.max(d.dp, d.da)) || 1, step = (W - 60) / tr.length;
    let s = `<svg viewBox="0 0 ${W} ${H}">`;
    tr.forEach((d, i) => { const x = 40 + i * step, h1 = (H - 60) * d.dp / mx, h2 = (H - 60) * d.da / mx, p = d.dp ? d.da / d.dp * 100 : null;
      s += `<rect x="${x}" y="${H - 28 - h1}" width="${step * .32}" height="${h1}" fill="${C.gry}"/><rect x="${x + step * .34}" y="${H - 28 - h2}" width="${step * .32}" height="${h2}" fill="${C.navy}"/>` +
        `<text x="${x + step * .33}" y="${H - 34 - Math.max(h1, h2)}" text-anchor="middle" font-size="14" font-weight="700" fill="${p >= 97 ? C.grn : p >= 90 ? C.amb : C.red}">${p == null ? '' : Math.round(p) + '%'}</text>` +
        `<text x="${x + step * .33}" y="${H - 8}" text-anchor="middle" font-size="13" fill="${C.mut}">${esc(d.label)}</text>`; });
    return s + '</svg>';
  }
  function cumLine(cum) {
    const W = 640, H = 250, n = cum.length, mx = d3.max(cum, d => Math.max(d[1], d[2])) || 1, X = d => 50 + (d - 1) * (W - 80) / Math.max(1, n - 1), Y = v => H - 30 - (H - 50) * v / mx;
    const pl = i => cum.map(d => `${X(d[0]).toFixed(1)},${Y(d[i]).toFixed(1)}`).join(' ');
    let s = `<svg viewBox="0 0 ${W} ${H}">`;
    [0, .5, 1].forEach(f => { s += `<line x1="50" x2="${W - 30}" y1="${Y(mx * f)}" y2="${Y(mx * f)}" stroke="#EEF1F4"/><text x="44" y="${Y(mx * f) + 4}" text-anchor="end" font-size="12" fill="${C.mut}">${fm(mx * f)}</text>`; });
    s += `<polyline points="${pl(1)}" fill="none" stroke="${C.gry}" stroke-width="3"/><polyline points="${pl(2)}" fill="none" stroke="${C.navy}" stroke-width="3"/>`;
    [1, 8, 15, 22, 29].filter(d => d <= n).forEach(d => { s += `<text x="${X(d)}" y="${H - 10}" text-anchor="middle" font-size="12" fill="${C.mut}">${d}</text>`; });
    const L = cum[n - 1]; s += `<text x="${W - 30}" y="${Y(L[1]) - 8}" text-anchor="end" font-size="13" font-weight="700" fill="${C.mut}">Plan ${fm(L[1])}</text><text x="${W - 30}" y="${Y(L[2]) + 30}" text-anchor="end" font-size="13" font-weight="700" fill="${C.navy}">Actual ${fm(L[2])}</text>`;
    return s + '</svg>';
  }
  const col = v => v == null ? C.gry : v < 50 ? C.red : v < 80 ? C.amb : C.grn;
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], mon = m => MN[+m.slice(5) - 1];
  function ex(n, title, body, src, wide) { return `<div class="x${wide ? ' w' : ''}"><div class="xn">Exhibit ${n}</div><h3>${title}</h3>${body}<div class="xs">Source: ${esc(src)}</div></div>`; }
  /* ---------- page ---------- */
  async function render() {
    const sec = document.getElementById('insights'); if (!sec) return;
    if (!data) { sec.innerHTML = '<div style="padding:30px;color:#5A6670">Loading insights…</div>'; try { data = await load(); } catch (e) { sec.innerHTML = '<div style="padding:30px;color:#5A6670">Insights are not available yet.</div>'; return; } }
    const D0 = data, dl = D0.delivery, su = D0.supply, pe = D0.people, co = D0.cost, ac = D0.actions;
    const areas = ['All', ...new Set([...D0.decisions, ...D0.more].map(c => c.area))];
    const card = (c, i) => `<div class="dc"><div class="no">${i + 1}</div><div class="ar">${esc(c.area)}</div><h4>${esc(c.head)}<span class="cf ${c.conf === 'Verified' ? 'v' : 'c'}">${esc(c.conf)}</span></h4><p>${esc(c.body)}</p><div class="im">${esc(c.impact)}</div><div class="src">Source: ${esc(c.src)}</div></div>`;
    const all = [...D0.decisions, ...D0.more].filter(c => filt === 'All' || c.area === filt);
    const top = filt === 'All' ? D0.decisions : all.slice(0, 5), rest = filt === 'All' ? D0.more : all.slice(5);
    const arrow = k => k.prev == null || k.val == null ? '' : (() => { const d = k.val - k.prev, good = k.better === 'up' ? d >= 0 : d <= 0; return `<span class="d" style="color:${good ? C.grn : C.red}">${d >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(d * 10) / 10)} pts</span>`; })();
    const kp = D0.kpis.map(k => `<div class="k ${k.state}"><div class="l">${esc(k.label)}</div><div class="v">${k.unit === 'Rs M' ? 'Rs ' + d3.format(',')(k.val) + '<small>M</small>' : (k.val == null ? '—' : k.val) + '<small>' + esc(k.unit) + '</small>'}${arrow(k)}</div><div class="s">${esc(k.sub)}</div><div class="f">${esc(k.flag)}</div></div>`).join('');
    const pu = D0.pulse ? `<div class="pulse"><b>${esc(D0.pulse.label)} so far:</b>${D0.pulse.disp_plan_td != null ? ` dispatch ${fm(D0.pulse.disp_act)} against ${fm(D0.pulse.disp_plan_td)} planned to date, gap ${fm(D0.pulse.gap_td)}.` : ` production plan ${fm(D0.pulse.prod_plan)} units loaded. ${esc(D0.pulse.note)} The insights below use ${esc(D0.period_label)}, the last closed month.`}</div>` : '';
    const shopT = `<table class="it"><tr><th>Shop (finished goods)</th><th class="n">Production</th><th class="n">Dispatch</th><th class="n">Units short</th></tr>` + dl.shops.slice(0, 9).map(s => `<tr><td>${esc(s.shop)}</td><td class="n" style="color:${s.prod == null ? C.mut : s.prod >= 97 ? C.grn : s.prod >= 90 ? C.amb : C.red};font-weight:700">${s.prod == null ? 'plan missing' : Math.round(s.prod) + '%'}</td><td class="n" style="color:${s.disp >= 97 ? C.grn : s.disp >= 90 ? C.amb : C.red};font-weight:700">${Math.round(s.disp)}%</td><td class="n">${fm(s.short)}</td></tr>`).join('') + '</table>';
    const vm = su.vmonths;
    const heat = `<table class="it"><tr><th>Vendor</th>${vm.map(m => `<th class="n">${mon(m)}</th>`).join('')}<th class="n">Units short</th></tr>` + su.chronic.map(v => `<tr><td>${esc(v.vendor)}</td>${vm.map(m => `<td class="n"><span class="hc" style="background:${col(v.months[m])}">${v.months[m] == null ? '–' : v.months[m] + '%'}</span></td>`).join('')}<td class="n">${fm(v.short)}</td></tr>`).join('') + `</table><div class="lg"><i style="background:${C.red}"></i>under 50%<i style="background:${C.amb}"></i>50–79%<i style="background:${C.grn}"></i>80%+</div>`;
    const xT = `<table class="it"><tr><th>Item</th><th>Category</th><th class="n">Cover</th><th class="n">Excess Rs</th></tr>` + co.excess.map(r => `<tr><td>${esc(r.part)}</td><td>${esc(r.cat)}</td><td class="n">${r.cover == null ? 'no use recorded' : r.cover > 1825 ? 'over 5 years' : d3.format(',')(r.cover) + ' days'}</td><td class="n">${fm(r.excess)}</td></tr>`).join('') + '</table>';
    const oT = `<table class="it"><tr><th>#</th><th>Open issue</th><th>Shop</th><th>Priority</th><th class="n">Last raised</th></tr>` + ac.open.map(r => `<tr><td>${r.id}</td><td>${esc(r.item)}</td><td>${esc(r.shop)}</td><td><span class="hc" style="background:${r.priority === 'Critical' ? C.red : C.amb}">${esc(r.priority || '–')}</span></td><td class="n">${esc((r.last || '').slice(8) + ' ' + (r.last ? MN[+r.last.slice(5, 7) - 1] : ''))}</td></tr>`).join('') + '</table>';
    const wk = pe.weekday.map(([d, p]) => ({ l: d, v: p, t: pct(p), c: p >= 15 ? C.red : p >= 11 ? C.amb : C.grn }));
    const crRows = co.cr.map(r => ({ l: r.shop, v: r.plan / 1e6, c: '#DCE3EA', v2: r.done / 1e6, c2: r.done / r.plan >= .6 ? C.grn : r.done / r.plan >= .25 ? C.amb : C.red, t: `Rs ${(r.plan / 1e6).toFixed(1)}M · ${Math.round(r.done / r.plan * 100)}% done` }));
    const mvc = { 'Moved in last 90 days': C.grn, '91–365 days': C.amb, 'Over 1 year': C.red, 'No movement since Jan 2024': C.red };
    const cvc = { 'Under 15 days': C.grn, '15–30 days': C.grn, '30–90 days': C.grn, '90–180 days': C.amb, 'Over 180 days': C.red, 'No use in 6 months': C.red, 'Use not recorded': C.gry };
    let n = 0; const X = () => ++n;
    sec.innerHTML = `
<div class="ihd"><div><h2>Insights</h2><div class="sub">Analysis month ${esc(D0.period_label)} · attendance ${esc(D0.att_period)} · inventory ${esc(D0.inv_asof)} · built ${esc(D0.asof)} from the dashboard's own data</div></div>
<div class="chips" role="group" aria-label="Filter insights by area">${areas.map(a => `<button type="button" data-a="${esc(a)}" class="${a === filt ? 'on' : ''}">${esc(a)}</button>`).join('')}</div></div>
<div class="sec">Executive summary</div><div class="kp">${kp}</div>${pu}
<div class="sec">${filt === 'All' ? 'Five decisions for this week' : esc(filt) + ': top insights'}</div><div class="dec">${top.map(card).join('') || '<div class="dc"><p>No insights in this area.</p></div>'}</div>
${rest.length ? `<details class="more"${filt !== 'All' ? ' open' : ''}><summary>${rest.length} more insight${rest.length > 1 ? 's' : ''}</summary>${rest.map(c => `<div class="ml"><div class="a">${esc(c.area)}</div><div><b>${esc(c.head)}</b><span class="cf ${c.conf === 'Verified' ? 'v' : 'c'}">${esc(c.conf)}</span><div>${esc(c.body)}</div><div class="im">${esc(c.impact)}</div><div class="src">Source: ${esc(c.src)}</div></div></div>`).join('')}</details>` : ''}
<div class="sec">Delivery</div><div class="ex">
${ex(X(), `Dispatch missed plan in ${dl.trend.filter(d => d.dp && d.da / d.dp < .97).length} of the last ${dl.trend.length} months`, trendBars(dl.trend) + `<div class="lg"><i style="background:${C.gry}"></i>dispatch plan<i style="background:${C.navy}"></i>dispatch actual</div>`, 'atlas_parts_daily, all finished parts; dispatch % above each pair')}
${ex(X(), `Cumulative dispatch, ${esc(D0.period_label)}: the gap opens with each weekly plan block`, cumLine(dl.cum) + `<div class="lg">${pct(dl.back)} of the month's dispatch went out in the last 7 days · average ${fm(dl.avg_day)} a working day</div>`, 'atlas_parts_daily, disp_plan and disp_actual by day')}
${ex(X(), `Three parts make up most of the ${fm(dl.gross)}-unit gross shortfall`, hbars(dl.gaps.map((g, i) => ({ l: g.part, v: g.short, t: `${fm(g.short)} · ${Math.round(g.act / g.plan * 100)}%`, c: i < 3 ? C.red : C.amb })), { lw: 220 }) + `<div class="lg">Net gap ${fm(dl.net)} after parts that shipped above plan.</div>`, 'atlas_parts_daily, finished parts')}
${ex(X(), 'Shop scorecard: where the units went missing', shopT, 'atlas_parts_daily + atlas_parts')}
</div>
<div class="sec">Supply</div><div class="ex">
${ex(X(), `${su.chronic.length} vendors have missed schedule for three months or more`, heat, 'atlas_vendor_supply, schedule compliance by month')}
${ex(X(), 'Parts below safety stock, by shop (and how many are at zero)', hbars(su.stock_shops.map(s => ({ l: s.shop, v: s.n, t: `${s.n} parts · ${s.zero} at zero`, c: s.zero ? C.red : C.amb })), { lw: 160 }) + `<div class="lg">At zero: ${esc(su.zero.slice(0, 8).map(z => z.part).join(', '))}${su.zero.length > 8 ? '…' : ''}</div>`, 'atlas_stock_critical')}
</div>
<div class="sec">People</div><div class="ex">
${ex(X(), `Absenteeism by area, with overtime hours (${esc(D0.att_period)})`, hbars(pe.areas.map(a => ({ l: a[0], v: a[1], t: `${pct(a[1])} · OT ${d3.format(',')(a[2])} h`, c: a[1] >= 15 ? C.red : a[1] >= 10 ? C.amb : C.grn })), { lw: 200, max: 25, bh: 18, gap: 6 }), 'sp_attendance')}
${ex(X(), `Overtime is covering absence: ${d3.format(',')(pe.swap_hrs)} hours in absent weeks`, `<div style="display:flex;gap:28px;margin-bottom:12px"><div><div style="font-family:var(--font-anthropic-serif);font-size:34px">${d3.format(',')(pe.swap_people)}</div><div class="lg" style="margin:0">people with overtime in a week they were absent</div></div><div><div style="font-family:var(--font-anthropic-serif);font-size:34px">${pct(pe.abs_conc)}</div><div class="lg" style="margin:0">of absent days from ${pe.abs_conc_n} people (${pct(pe.abs_conc_pct)} of staff) absent 5+ days</div></div></div>` + hbars(wk, { lw: 60, max: 25, bh: 16, gap: 5, label: 'absenteeism by weekday' }), 'sp_attendance_people (rule: min(absent days × 8, overtime in those weeks)); weekday from sp_attendance')}
</div>
<div class="sec">Cost and cash</div><div class="ex">
${ex(X(), `Cost reduction: Rs ${(d3.sum(co.cr, r => r.done) / 1e6).toFixed(1)}M banked of Rs ${(d3.sum(co.cr, r => r.plan) / 1e6).toFixed(1)}M planned a year`, hbars(crRows, { lw: 150 }) + `<div class="lg">${co.behind.length} ideas behind their Finance month (${esc(co.behind.join(', '))}) · ${co.fin_only} Finance budget lines with no matching idea (${esc(co.fin_shops.map(([s, k]) => s + ' ' + k).join(', '))})</div>`, 'cr_ideas (VA/CR decks + Finance CR budget 2026-27)')}
${ex(X(), 'Inventory by last movement and by days of cover', hbars(co.move.map(([k, v]) => ({ l: k, v: v / 1e6, t: 'Rs ' + d3.format(',')(Math.round(v / 1e6)) + 'M', c: mvc[k] || C.navy })), { lw: 200, bh: 18, gap: 5 }) + '<div style="height:10px"></div>' + hbars(co.cover.map(([k, v]) => ({ l: k, v: v / 1e6, t: 'Rs ' + d3.format(',')(Math.round(v / 1e6)) + 'M', c: cvc[k] || C.navy })), { lw: 200, bh: 16, gap: 4 }), 'sap_stock (SAP MB52)')}
${ex(X(), 'Biggest stock above the cover target', xT, 'sap_stock, excess over cover target', true)}
</div>
<div class="sec">Actions</div><div class="ex">
${ex(X(), `${esc(ac.issues_shop[0][0])} raises the most meeting issues; ${ac.n_noev} of ${ac.n_closed} closed issues lack evidence`, hbars(ac.issues_shop.map(([s, k], i) => ({ l: s, v: k, t: String(k), c: i === 0 ? C.red : C.navy })), { lw: 150, bh: 18, gap: 5 }) + '<div style="height:8px"></div>' + oT, 'atlas_issues')}
${ex(X(), `${ac.jira_overdue} of ${ac.jira_open} open Jira activities are past their due date`, hbars(ac.jira_owner.map(([a, k]) => ({ l: a, v: k, t: String(k), c: k >= 7 ? C.red : C.amb })), { lw: 170 }), 'jira_issues')}
</div>
<div class="sec">Exception checks run on every rebuild</div><div class="chk">${D0.checks.map(c => `<div class="ck"><div class="cn" style="color:${c.n ? C.red : C.grn}">${c.n}</div><div><div class="ct">${esc(c.name)}</div><div class="cd">${esc(c.detail)}</div><div class="cd" style="color:#8A949E">${esc(c.src)}</div></div></div>`).join('')}</div>
<div class="meth">How this page is built: every figure is recomputed from the dashboard's datasets (Atlas BAPI, SAP MB52, SharePoint attendance, VA/CR decks and Finance CR budget, Jira); sample datasets are never used. Insights are ranked by size of impact, with at most two from one area in the top five. "Check data" marks findings that may be a data or plan-upload problem rather than a shop problem; confirm before acting. The analysis month moves to the current month once it has five days of dispatch posted.</div>`;
    sec.querySelectorAll('.chips button').forEach(b => b.addEventListener('click', () => { filt = b.dataset.a; render(); }));
  }
  const tryInit = () => { try { init(); } catch (e) { console.error(e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryInit); else tryInit();
  setTimeout(tryInit, 1500); setTimeout(tryInit, 4000);
})();
