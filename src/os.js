/* Opening Stock tab (31 Oct, Umair): stock read from the Atlas stock feed for every Atlas portal code plus every MB52 code.
   Shown to everyone in the Claude artifact; on the portal, to whoever has the "Opening Stock" tab ticked in Users.
   OS.blob is the uploaded snapshot (a JSON list of [material, description, stock, source]); OS.at is when it was read.
   OS.trial marks a temporary trial read that Umair will ask to remove before the 23:30 snapshot. */
(() => {
  const OS = { blob: 'ae8a94eb39b1e937be52e4289c03f5ec', at: '31 Oct 16:55', trial: true, label: 'Nov 2026 opening stock' };
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
  async function render() {
    const sec = document.getElementById('openstock'); if (!sec) return;
    if (!built) { built = true; sec.innerHTML = `<div class="oshd"><h2>Opening Stock</h2>${OS.trial ? '<span class="ostr">Temporary trial</span>' : ''}<span id="os-sub"></span></div><div class="grid"><div class="card wide kpicard"><div class="osk" id="os-k"></div></div>
<div class="card wide"><h3>By Code Source</h3><div class="tbox" id="os-g"></div></div><div class="card wide"><h3>Materials</h3><div class="osbar"><input id="os-q" placeholder="Search material or description" aria-label="Search"><select id="os-src" aria-label="Code source"><option value="">All sources</option>${SRC.map(s => `<option>${s}</option>`).join('')}</select><label style="font-size:12.5px"><input type="checkbox" id="os-nz" checked style="min-width:0"> Only with stock</label><span id="os-n" style="font-size:12px;color:var(--mut)"></span></div><div class="tbox" id="os-t" style="max-height:560px"></div></div></div>`;
      ['os-q', 'os-src', 'os-nz'].forEach(id => sec.querySelector('#' + id).addEventListener('input', table)); }
    const sub = sec.querySelector('#os-sub');
    if (!OS.blob) { sub.textContent = 'The Nov 2026 opening stock is read on 31 Oct at 23:30 and appears here after that.'; sec.querySelector('#os-k').innerHTML = '<div><div class="tl">Status</div><div class="tv" style="font-size:20px">Waiting for snapshot</div></div>'; return; }
    sub.textContent = `${OS.trial ? 'Trial read' : OS.label} · Atlas stock feed read ${OS.at} · Atlas portal and MB52 codes`;
    if (!rows && !loading) { loading = true; try { rows = (await load()).map(([mat, desc, q, s]) => ({ mat, desc, q: +q || 0, src: SRC[s] || s })); } catch (e) { sub.textContent = 'Could not load the snapshot'; } loading = false; }
    if (!rows) return;
    const st = rows.filter(r => r.q > 0), neg = rows.filter(r => r.q < 0), nod = rows.filter(r => r.desc === '' && r.q === 0);
    sec.querySelector('#os-k').innerHTML = [['Codes read', nf(rows.length), 'Atlas portal plus MB52, no duplicates'], ['Codes with stock', nf(st.length), nf(d3.sum(st, r => r.q)) + ' units in total'], ['Zero stock', nf(rows.length - st.length - neg.length), nf(nod.length) + ' not found in the feed'], ['Negative stock', nf(neg.length), 'worth checking in SAP']].map(([a, b, c]) => `<div><div class="tl">${a}</div><div class="tv">${b}</div><div class="ts">${c}</div></div>`).join('');
    const g = SRC.map(s => { const v = rows.filter(r => r.src === s); return [s, v.length, v.filter(r => r.q > 0).length, d3.sum(v, r => Math.max(0, r.q))]; });
    sec.querySelector('#os-g').innerHTML = `<table class="tb"><thead><tr><th>Source</th><th class="n">Codes</th><th class="n">With stock</th><th class="n">Stock units</th></tr></thead><tbody>${g.map(([s, n, k, q]) => `<tr><td>${s}</td><td class="n">${nf(n)}</td><td class="n">${nf(k)}</td><td class="n">${nf(q)}</td></tr>`).join('')}</tbody></table>`;
    table();
  }
  function table() {
    const sec = document.getElementById('openstock'); if (!rows || !sec) return;
    const q = sec.querySelector('#os-q').value.toLowerCase(), sr = sec.querySelector('#os-src').value, nz = sec.querySelector('#os-nz').checked;
    const rs = rows.filter(r => (!sr || r.src === sr) && (!nz || r.q !== 0) && (!q || (r.mat + ' ' + r.desc).toLowerCase().includes(q))).sort((a, b) => b.q - a.q);
    sec.querySelector('#os-n').textContent = `${nf(rs.length)} codes` + (rs.length > 500 ? ' · top 500 by stock shown, search to narrow' : '');
    sec.querySelector('#os-t').innerHTML = `<table class="tb"><thead><tr><th>Material</th><th>Material Description</th><th class="n">Opening Stock</th><th>Source</th></tr></thead><tbody>${rs.slice(0, 500).map(r => `<tr><td>${esc(r.mat)}</td><td>${esc(r.desc)}</td><td class="n">${nf(r.q)}</td><td>${r.src}</td></tr>`).join('')}</tbody></table>`;
  }
  const d0 = window.__draw; if (d0) window.__draw = (...a) => { const r = d0(...a); if (window.__page === 'openstock') { try { render(); } catch (e) {} } return r; };
  init();
})();
