/* Opening Stock tab (31 Oct, Umair): month-opening SAP stock snapshot (MB52 layout), shown only to the artifact's owner.
   The tab button and page are added here and appear only when claude.use("user").isOwner() is true.
   OS.blob is the uploaded snapshot (a JSON list of MB52 rows); OS.at is when it was taken. */
(() => {
  const OS = { blob: null, at: null, label: 'Nov 2026 opening stock' };
  const nf = d3.format(',.0f'), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let rows = null, loading = false, built = false;
  const css = document.createElement('style'); css.textContent = `#openstock .oshd{display:flex;align-items:baseline;gap:12px;margin:2px 0 12px;flex-wrap:wrap}#openstock .oshd h2{font-family:var(--font-anthropic-serif);font-weight:400;font-size:24px;color:var(--navy);margin:0}#openstock .oshd span{font-size:12px;color:var(--mut)}
#openstock .osk{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))}#openstock .osk>div{padding:2px 18px;border-left:1px solid var(--line)}#openstock .osk>div:first-child{border-left:0;padding-left:4px}
#openstock .osk .tl{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}#openstock .osk .tv{font-family:var(--font-anthropic-serif);font-size:28px;color:var(--navy);margin-top:4px}#openstock .osk .ts{font-size:11.5px;color:var(--mut)}
#openstock .osbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px}#openstock select,#openstock input{font:inherit;font-size:12.5px;padding:5px 8px;border:1px solid #D5DBE1;border-radius:4px}#openstock input{min-width:260px}`;
  document.head.appendChild(css);
  let tries = 0;
  async function init() {
    const c = window.claude && window.claude.use ? window.claude : null; if (!c) { if (tries++ < 40) setTimeout(init, 500); return; }
    let owner = false; try { const u = await c.use('user'); owner = u ? await u.isOwner() : false; } catch (e) {} if (!owner) return;
    const tabs = document.getElementById('tabs'), root = document.getElementById('ael') || document.body; if (!tabs || document.getElementById('t-openstock')) return;
    const b = document.createElement('button'); b.className = 'tab'; b.id = 't-openstock'; b.setAttribute('role', 'tab'); b.dataset.p = 'openstock'; b.textContent = 'Opening Stock'; b.title = 'Visible only to you';
    b.addEventListener('click', ev => { ev.stopPropagation(); open(); }, true); tabs.appendChild(b);
    const sec = document.createElement('section'); sec.className = 'page'; sec.id = 'openstock'; const last = [...root.querySelectorAll('section.page')].pop(); if (last) last.after(sec); else root.appendChild(sec);
    if (location.hash === '#openstock') open();
  }
  function open() { window.__page = 'openstock'; document.querySelectorAll('#ael .page, section.page').forEach(s => s.classList.toggle('on', s.id === 'openstock'));
    document.querySelectorAll('#tabs .tab').forEach(t => t.setAttribute('aria-selected', t.id === 't-openstock' ? 'true' : 'false')); render(); }
  async function render() {
    const sec = document.getElementById('openstock'); if (!sec) return;
    if (!built) { built = true; sec.innerHTML = `<div class="oshd"><h2>Opening Stock</h2><span id="os-sub"></span></div><div class="grid"><div class="card wide kpicard"><div class="osk" id="os-k"></div></div>
<div class="card wide"><h3>By Material Group</h3><div class="tbox" id="os-g"></div></div><div class="card wide"><h3>Materials</h3><div class="osbar"><input id="os-q" placeholder="Search material, description or storage location" aria-label="Search"><select id="os-grp" aria-label="Material group"></select><label style="font-size:12.5px"><input type="checkbox" id="os-nz" checked style="min-width:0"> Only with stock</label><span id="os-n" style="font-size:12px;color:var(--mut)"></span></div><div class="tbox" id="os-t" style="max-height:560px"></div></div></div>`;
      ['os-q', 'os-grp', 'os-nz'].forEach(id => sec.querySelector('#' + id).addEventListener('input', table)); }
    const sub = sec.querySelector('#os-sub');
    if (!OS.blob) { sub.textContent = 'The Nov 2026 opening stock snapshot is taken on 31 Oct at 23:30 and appears here after that. Visible only to you.'; sec.querySelector('#os-k').innerHTML = '<div><div class="tl">Status</div><div class="tv" style="font-size:20px">Waiting for snapshot</div></div>'; return; }
    sub.textContent = `${OS.label} · SAP stock taken ${OS.at} · MB52 layout · visible only to you`;
    if (!rows && !loading) { loading = true; try { rows = await (await fetch('/_blob/' + OS.blob)).json(); } catch (e) { sub.textContent = 'Could not load the snapshot'; } loading = false; }
    if (!rows) return;
    const st = rows.filter(r => (+r.unr || 0) + (+r.qi || 0) + (+r.transit || 0) + (+r.blocked || 0) > 0), val = d3.sum(rows, r => +r.value || 0);
    sec.querySelector('#os-k').innerHTML = [['Materials with stock', nf(new Set(st.map(r => r.mat)).size), `${nf(rows.length)} MB52 lines`], ['Stock value', 'Rs ' + d3.format(',.1f')(val / 1e6) + 'M', 'unrestricted, at SAP value'], ['Quality inspection', nf(d3.sum(rows, r => +r.qi || 0)), 'units'], ['Blocked', nf(d3.sum(rows, r => +r.blocked || 0)), 'units']].map(([a, b, c]) => `<div><div class="tl">${a}</div><div class="tv">${b}</div><div class="ts">${c}</div></div>`).join('');
    const g = d3.rollups(rows, v => ({ n: new Set(v.filter(r => +r.unr > 0).map(r => r.mat)).size, q: d3.sum(v, r => +r.unr || 0), val: d3.sum(v, r => +r.value || 0) }), r => r.group || '—').sort((a, b) => b[1].val - a[1].val);
    sec.querySelector('#os-g').innerHTML = `<table class="tb"><thead><tr><th>Material group</th><th class="n">Materials in stock</th><th class="n">Unrestricted qty</th><th class="n">Value Rs M</th><th class="n">Share</th></tr></thead><tbody>${g.map(([k, o]) => `<tr><td>${esc(k)}</td><td class="n">${nf(o.n)}</td><td class="n">${nf(o.q)}</td><td class="n">${d3.format(',.2f')(o.val / 1e6)}</td><td class="n">${val ? Math.round(o.val / val * 100) + '%' : '—'}</td></tr>`).join('')}</tbody></table>`;
    const sel = sec.querySelector('#os-grp'); if (!sel.options.length) { [['', 'All material groups'], ...g.map(([k]) => [k, k])].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); }); }
    table();
  }
  function table() {
    const sec = document.getElementById('openstock'); if (!rows || !sec) return;
    const q = sec.querySelector('#os-q').value.toLowerCase(), gp = sec.querySelector('#os-grp').value, nz = sec.querySelector('#os-nz').checked;
    const rs = rows.filter(r => (!gp || r.group === gp) && (!nz || (+r.unr || 0) + (+r.qi || 0) + (+r.transit || 0) + (+r.blocked || 0) > 0) && (!q || [r.mat, r.desc, r.sloc].join(' ').toLowerCase().includes(q))).sort((a, b) => (+b.value || 0) - (+a.value || 0));
    sec.querySelector('#os-n').textContent = `${nf(rs.length)} lines` + (rs.length > 500 ? ' · top 500 by value shown, search to narrow' : '');
    sec.querySelector('#os-t').innerHTML = `<table class="tb"><thead><tr><th>Plant</th><th>SLoc</th><th>Group</th><th>Material</th><th>Description</th><th>UoM</th><th class="n">Unrestricted</th><th class="n">Quality insp.</th><th class="n">Transit</th><th class="n">Blocked</th><th class="n">Value Rs</th></tr></thead><tbody>${rs.slice(0, 500).map(r => `<tr><td>${esc(r.plant)}</td><td>${esc(r.sloc)}</td><td>${esc(r.group)}</td><td>${esc(r.mat)}</td><td>${esc(r.desc)}</td><td>${esc(r.uom)}</td><td class="n">${nf(+r.unr || 0)}</td><td class="n">${nf(+r.qi || 0)}</td><td class="n">${nf(+r.transit || 0)}</td><td class="n">${nf(+r.blocked || 0)}</td><td class="n">${nf(+r.value || 0)}</td></tr>`).join('')}</tbody></table>`;
  }
  const d0 = window.__draw; if (d0) window.__draw = (...a) => { const r = d0(...a); if (window.__page === 'openstock') { try { render(); } catch (e) {} } return r; };
  init();
})();
