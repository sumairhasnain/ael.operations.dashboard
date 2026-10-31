/* Opening Stock tab (31 Oct, Umair): stock read from the Atlas stock feed for every Atlas portal code plus every MB52 code.
   Shown to everyone in the Claude artifact; on the portal, to whoever has the "Opening Stock" tab ticked in Users.
   OS.blob is the uploaded snapshot (row layout above toRow); OS.at is when it was read.
   OS.trial marks a temporary trial read that Umair will ask to remove before the 23:30 snapshot. */
(() => {
  const OS = { blob: '85ace66ebc6c569a1004960b7e550774', at: '31 Oct 19:14', trial: true, label: 'Nov 2026 opening stock' };
  const nf = d3.format(',.0f'), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let rows = null, loading = false, built = false;
  const css = document.createElement('style'); css.textContent = `#openstock .oshd{display:flex;align-items:baseline;gap:12px;margin:2px 0 12px;flex-wrap:wrap}#openstock .oshd h2{font-family:var(--font-anthropic-serif);font-weight:400;font-size:24px;color:var(--navy);margin:0}#openstock .oshd span{font-size:12px;color:var(--mut)}
#openstock .ostr{display:inline-block;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;background:#FFF1D6;color:#8A5A00;border:1px solid #F0D49A;border-radius:3px;padding:2px 7px}
#openstock .osk{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))}#openstock .osk>div{padding:2px 18px;border-left:1px solid var(--line)}#openstock .osk>div:first-child{border-left:0;padding-left:4px}
#openstock .osk .tl{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}#openstock .osk .tv{font-family:var(--font-anthropic-serif);font-size:28px;color:var(--navy);margin-top:4px}#openstock .osk .ts{font-size:11.5px;color:var(--mut)}
#openstock .osbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px}#openstock select,#openstock input{font:inherit;font-size:12.5px;padding:5px 8px;border:1px solid #D5DBE1;border-radius:4px}#openstock input{min-width:260px}`;
  document.head.appendChild(css);
  /* No viewer restriction here (Umair, 31 Oct): on the portal the tab follows the per-user tab ticks in Users (id "openstock"). */
  const portal = () => window.__PORTAL;
  async function init() {
    const P = portal(); if (P && P.canTab && !P.canTab('openstock')) return;
    const tabs = document.getElementById('tabs'), root = document.getElementById('ael') || document.body; if (!tabs || document.getElementById('t-openstock')) return;
    const b = document.createElement('button'); b.className = 'tab'; b.id = 't-openstock'; b.setAttribute('role', 'tab'); b.dataset.p = 'openstock'; b.textContent = OS.trial ? 'Opening Stock (trial)' : 'Opening Stock'; b.title = 'Month-opening stock read from the Atlas stock feed';
    b.addEventListener('click', ev => { ev.stopPropagation(); open(); }, true); tabs.appendChild(b);
    const sec = document.createElement('section'); sec.className = 'page'; sec.id = 'openstock'; const last = [...root.querySelectorAll('section.page')].pop(); if (last) last.after(sec); else root.appendChild(sec);
    if (location.hash === '#openstock') open();
  }
  function open() { window.__page = 'openstock'; document.querySelectorAll('#ael .page, section.page').forEach(s => s.classList.toggle('on', s.id === 'openstock'));
    document.querySelectorAll('#tabs .tab').forEach(t => t.setAttribute('aria-selected', t.id === 't-openstock' ? 'true' : 'false')); render(); }
  const SRC = ['Atlas portal', 'MB52 list', 'Both'];
  /* Portal: the opening_stock dataset in Supabase (database rules allow it only to users with this tab). Claude artifact: the uploaded file. */
  async function load() {
    const Pt = window.Portal;
    if (portal() && Pt && Pt.sb) { const { data, error } = await Pt.sb.from('datasets').select('data').eq('name', 'opening_stock').maybeSingle(); if (error || !data) throw new Error('no data'); return data.data; }
    return (await fetch('/_blob/' + OS.blob)).json();
  }
  /* Row: [material, description, stock, source, opening, incoming, safety stock, vendor stock, schedule MTD, receipt MTD, production MTD, {day: [schedule, receipt]}] */
  const toRow = a => ({ mat: a[0], desc: a[1], q: +a[2] || 0, src: SRC[a[3]] || a[3], op: +a[4] || 0, inc: +a[5] || 0, ss: +a[6] || 0, vs: +a[7] || 0, sch: +a[8] || 0, rcv: +a[9] || 0, prd: +a[10] || 0, days: a[11] || null });
  const SHOW = [['', 'All codes'], ['stock', 'With stock'], ['sch', 'Vendor scheduled this month'], ['prd', 'Produced this month'], ['below', 'Stock below safety stock']];
  let pick = null;
  async function render() {
    const sec = document.getElementById('openstock'); if (!sec) return;
    if (!built) { built = true; sec.innerHTML = `<div class="oshd"><h2>Opening Stock</h2>${OS.trial ? '<span class="ostr">Temporary trial</span>' : ''}<span id="os-sub"></span></div><div class="grid"><div class="card wide kpicard"><div class="osk" id="os-k"></div></div>
<div class="card wide"><h3>Materials</h3><div class="osbar"><input id="os-q" placeholder="Search material or description" aria-label="Search"><select id="os-show" aria-label="Show">${SHOW.map(([v, t]) => `<option value="${v}"${v === 'stock' ? ' selected' : ''}>${t}</option>`).join('')}</select><select id="os-src" aria-label="Code source"><option value="">All sources</option>${SRC.map(s => `<option>${s}</option>`).join('')}</select><span id="os-n" style="font-size:12px;color:var(--mut)"></span></div><div class="tbox" id="os-t" style="max-height:560px"></div><p class="small" style="font-size:11.5px;color:var(--mut);margin:8px 0 0">Stock, Opening, Incoming, Safety Stock and Vendor Stock come from the Atlas stock feed for every code. Vendor schedule and receipt come from the Atlas receiving feed and production from the Atlas production feed, so they exist only for the codes Atlas tracks. Click a vendor-scheduled code to see its receipts by day.</p></div>
<div class="card wide" id="os-dcard" style="display:none"><h3 id="os-dh"></h3><div class="tbox" id="os-d"></div></div></div>`;
      ['os-q', 'os-src', 'os-show'].forEach(id => sec.querySelector('#' + id).addEventListener('input', table));
      sec.querySelector('#os-t').addEventListener('click', ev => { const tr = ev.target.closest('tr[data-m]'); if (!tr) return; pick = tr.dataset.m; detail(); }); }
    const sub = sec.querySelector('#os-sub');
    if (!OS.blob) { sub.textContent = 'The Nov 2026 opening stock is read on 31 Oct at 23:30 and appears here after that.'; sec.querySelector('#os-k').innerHTML = '<div><div class="tl">Status</div><div class="tv" style="font-size:20px">Waiting for snapshot</div></div>'; return; }
    sub.textContent = `${OS.trial ? 'Trial read' : OS.label} · Atlas feeds read ${OS.at} · Atlas portal and MB52 codes`;
    if (!rows && !loading) { loading = true; try { rows = (await load()).map(toRow); } catch (e) { sub.textContent = 'Could not load the snapshot'; } loading = false; }
    if (!rows) return;
    const st = rows.filter(r => r.q > 0), sc = rows.filter(r => r.sch > 0), pr = rows.filter(r => r.prd > 0), bl = rows.filter(r => r.ss > 0 && r.q < r.ss), nod = rows.filter(r => r.desc === '' && r.q === 0);
    const ssum = d3.sum(sc, r => r.sch), rsum = d3.sum(sc, r => Math.min(r.rcv, r.sch));
    sec.querySelector('#os-k').innerHTML = [['Codes read', nf(rows.length), nf(nod.length) + ' not found in the stock feed'], ['Codes with stock', nf(st.length), nf(d3.sum(st, r => r.q)) + ' units in total'], ['Below safety stock', nf(bl.length), 'codes with a safety stock set'], ['Vendor scheduled', nf(sc.length), (ssum ? Math.round(rsum / ssum * 100) : 0) + '% of schedule received MTD'], ['Produced this month', nf(pr.length), nf(d3.sum(pr, r => r.prd)) + ' units MTD']].map(([a, b, c]) => `<div><div class="tl">${a}</div><div class="tv">${b}</div><div class="ts">${c}</div></div>`).join('');
    table();
  }
  const cell = v => v ? nf(v) : '<span style="color:#B8C0C8">—</span>';
  function table() {
    const sec = document.getElementById('openstock'); if (!rows || !sec) return;
    const q = sec.querySelector('#os-q').value.toLowerCase(), sr = sec.querySelector('#os-src').value, sh = sec.querySelector('#os-show').value;
    const f = { '': () => true, stock: r => r.q !== 0, sch: r => r.sch > 0 || r.rcv > 0, prd: r => r.prd > 0, below: r => r.ss > 0 && r.q < r.ss }[sh] || (() => true);
    const key = sh === 'sch' ? (r => r.sch) : sh === 'prd' ? (r => r.prd) : sh === 'below' ? (r => r.ss - r.q) : (r => r.q);
    const rs = rows.filter(r => (!sr || r.src === sr) && f(r) && (!q || (r.mat + ' ' + r.desc).toLowerCase().includes(q))).sort((a, b) => key(b) - key(a));
    sec.querySelector('#os-n').textContent = `${nf(rs.length)} codes` + (rs.length > 500 ? ' · top 500 shown, search to narrow' : '');
    sec.querySelector('#os-t').innerHTML = `<table class="tb"><thead><tr><th>Material</th><th>Material Description</th><th class="n">Stock</th><th class="n">Opening</th><th class="n">Incoming</th><th class="n">Safety Stock</th><th class="n">Vendor Stock</th><th class="n">Vendor Schedule MTD</th><th class="n">Vendor Receipt MTD</th><th class="n">Production MTD</th><th>Source</th></tr></thead><tbody>${rs.slice(0, 500).map(r => `<tr${r.days ? ` data-m="${esc(r.mat)}" style="cursor:pointer" title="Click for receipts by day"` : ''}><td>${esc(r.mat)}</td><td>${esc(r.desc)}</td><td class="n">${nf(r.q)}</td><td class="n">${cell(r.op)}</td><td class="n">${cell(r.inc)}</td><td class="n">${cell(r.ss)}</td><td class="n">${cell(r.vs)}</td><td class="n">${cell(r.sch)}</td><td class="n">${cell(r.rcv)}</td><td class="n">${cell(r.prd)}</td><td>${r.src}</td></tr>`).join('')}</tbody></table>`;
  }
  function detail() {
    const sec = document.getElementById('openstock'), r = rows && rows.find(x => x.mat === pick); const card = sec.querySelector('#os-dcard');
    if (!r || !r.days) { card.style.display = 'none'; return; }
    const ds = Object.keys(r.days).sort(); let cs = 0, cr = 0;
    const lines = ds.map(d => { const [s, v] = r.days[d]; cs += s; cr += v; return [d, s, v, cs, cr]; });
    sec.querySelector('#os-dh').textContent = `${r.mat} · ${r.desc} · vendor schedule and receipt by day`;
    sec.querySelector('#os-d').innerHTML = `<table class="tb"><thead><tr><th>Date</th><th class="n">Schedule</th><th class="n">Receipt</th><th class="n">Cum. schedule</th><th class="n">Cum. receipt</th><th class="n">Gap</th></tr></thead><tbody>${lines.map(([d, s, v, a, b]) => `<tr><td>${d}</td><td class="n">${cell(s)}</td><td class="n">${cell(v)}</td><td class="n">${nf(a)}</td><td class="n">${nf(b)}</td><td class="n" style="color:${b < a ? '#D0312D' : 'inherit'}">${nf(b - a)}</td></tr>`).join('')}</tbody></table>`;
    card.style.display = ''; card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  const d0 = window.__draw; if (d0) window.__draw = (...a) => { const r = d0(...a); if (window.__page === 'openstock') { try { render(); } catch (e) {} } return r; };
  init();
})();
