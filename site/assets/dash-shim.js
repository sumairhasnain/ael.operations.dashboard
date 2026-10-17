/* AEL Operations Portal — runs the Operations Dashboard inside the portal.
   Provides the small `dash` API the dashboard page expects, backed by Supabase. */
(async () => {
  const P = window.Portal, root = document.getElementById('dash-root');
  if (!P.configured) { root.innerHTML = '<div class="wrap"><div class="msg"></div></div>'; P.notConfigured(root.querySelector('.msg')); return; }
  const me = await P.guard(); if (!me) return;
  const bar = P.topbar(me, 'app', 'Loading data…');
  const syncEl = bar.querySelector('#p-sync');

  const allowed = new Set(P.tabsFor(me));
  const order = P.TABS.map(t => t.id);
  window.__PORTAL = { today: P.todayPKT(), canTab: t => allowed.has(t), firstTab: order.find(t => allowed.has(t)) || 'overview' };

  /* ---------- dash API ---------- */
  const store = {}, cbs = [];
  const PKEY = 'ael_dash_params';
  let params = {};
  try { params = JSON.parse(sessionStorage.getItem(PKEY) || '{}') || {}; } catch (e) { params = {}; }
  let queued = false;
  const fire = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; cbs.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }); };
  window.dash = {
    data: id => store[id] || { status: 'loading', data: [] },
    onData: f => { cbs.push(f); },
    params: () => ({ ...params }),
    setParams: o => { params = { ...params, ...o }; try { sessionStorage.setItem(PKEY, JSON.stringify(params)); } catch (e) {} fire(); },
    setLink: p => { try { history.replaceState(null, '', '#' + p); } catch (e) {} },
    colors: []
  };

  /* ---------- mount the dashboard page ---------- */
  const tpl = document.getElementById('dash-src');
  const frag = tpl.content.cloneNode(true);
  const scripts = [...frag.querySelectorAll('script')]; scripts.forEach(s => s.remove());
  frag.querySelectorAll('#tabs .tab').forEach(b => { if (!allowed.has(b.dataset.p)) b.classList.add('locked'); });
  frag.querySelectorAll('.ael .page').forEach(s => { if (!allowed.has(s.id)) s.classList.add('locked'); });
  root.replaceChildren(frag);
  if (location.hash && !allowed.has(location.hash.slice(1))) history.replaceState(null, '', '#' + window.__PORTAL.firstTab);

  // datasets the visible tabs need
  const needed = new Set();
  root.querySelectorAll('.page:not(.locked) [data-source]').forEach(el => el.dataset.source.split(/\s+/).filter(Boolean).forEach(d => needed.add(d)));

  for (const s of scripts) { const n = document.createElement('script'); n.textContent = s.textContent; root.appendChild(n); }

  /* ---------- load data ---------- */
  let stamps = {};
  const loadOne = async name => {
    const { data, error } = await P.sb.from('datasets').select('data,updated_at').eq('name', name).maybeSingle();
    if (error) { store[name] = { status: 'error', data: [] }; console.error(name, error); }
    else if (!data) store[name] = { status: 'denied', data: [] };
    else { store[name] = { status: 'ok', data: Array.isArray(data.data) ? data.data : (data.data && data.data.rows) || [] }; stamps[name] = data.updated_at; }
    fire();
  };
  const showSync = () => {
    const ts = Object.values(stamps).sort().pop();
    syncEl.textContent = ts ? `Data synced ${P.pkt(ts)} PKT` : 'No data synced yet';
  };
  const refresh = async (first = false) => {
    const { data: list, error } = await P.sb.from('datasets').select('name,updated_at');
    if (error) { syncEl.textContent = 'Could not reach the data store'; if (first) [...needed].forEach(n => { store[n] = { status: 'error', data: [] }; }); fire(); return; }
    const avail = new Map(list.map(r => [r.name, r.updated_at]));
    const todo = [];
    for (const n of needed) {
      if (!avail.has(n)) { if (!store[n] || store[n].status !== 'denied') { store[n] = { status: 'denied', data: [] }; } continue; }
      if (first || avail.get(n) !== stamps[n]) todo.push(n);
    }
    await Promise.all(todo.map(loadOne));
    showSync(); fire();
  };
  await refresh(true);
  try { if (!sessionStorage.getItem('ael_opened')) { sessionStorage.setItem('ael_opened', '1'); P.log('open_dashboard'); } } catch (e) {}
  setInterval(() => { if (document.visibilityState === 'visible') refresh(false); }, 5 * 60e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(false); });
})();
