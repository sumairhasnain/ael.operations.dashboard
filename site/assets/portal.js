/* AEL Operations Portal — shared sign-in, guard, idle logout and top bar. */
(() => {
  const C = window.PORTAL_CONFIG || {};
  const TABS = [
    ['overview', 'Critical Issues'], ['production', 'Production'], ['product', 'Product Overview'], ['vendor', 'Vendor Supply'],
    ['inhouse', 'In-house'], ['quality', 'Quality'], ['maintenance', 'Maintenance'], ['oee', 'OEE'],
    ['capacity', 'Capacity'], ['efficiency', 'Efficiency'], ['workforce', 'Manpower'], ['inventory', 'Inventory'],
    ['cost', 'Cost'], ['savings', 'VA/CR Activities'], ['issues', 'Issues'], ['projects', 'Projects'], ['bom', 'B.O.M']
  ].map(([id, name]) => ({ id, name }));
  const RESTRICTED = ['cost', 'savings', 'workforce'];
  const DEFAULT_TABS = TABS.map(t => t.id).filter(t => !RESTRICTED.includes(t));
  const configured = C.supabaseUrl && !/YOUR-PROJECT/.test(C.supabaseUrl) && C.supabaseKey && !/PASTE-/.test(C.supabaseKey);

  const sb = configured ? window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }
  };
  const go = page => location.replace(page);
  const pkt = (ts, withTime = true) => ts ? new Date(ts).toLocaleString('en-GB', {
    timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {})
  }) : '—';
  const todayPKT = () => new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);

  const P = window.Portal = { sb, C, TABS, RESTRICTED, DEFAULT_TABS, esc, pkt, todayPKT, go, configured };

  P.notConfigured = el => {
    el.innerHTML = `<div class="msg warn"><b>Portal not connected yet.</b> Open <code>site/assets/config.js</code> and paste your Supabase Project URL and publishable key (setup guide, step 3).</div>`;
  };

  P.log = ev => sb ? sb.rpc('log_event', { p_event: ev, p_ua: navigator.userAgent }).then(() => {}, () => {}) : Promise.resolve();

  P.profile = async () => {
    if (!sb) return null;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    if (error || !data) return null;
    return { ...data, session };
  };

  P.tabsFor = prof => prof.role === 'viewer' ? TABS.map(t => t.id).filter(t => (prof.tabs || []).includes(t)) : TABS.map(t => t.id);

  /* Check the visitor is signed in and allowed here. Redirects otherwise. */
  P.guard = async ({ admin = false, allowMustChange = false } = {}) => {
    if (!sb) return null;
    const prof = await P.profile();
    if (!prof) { go('index.html'); return null; }
    if (!prof.active) { await sb.auth.signOut(); go('index.html?m=disabled'); return null; }
    if (prof.must_change_password && !allowMustChange) { go('change-password.html?first=1'); return null; }
    if (admin && prof.role !== 'admin') { go('app.html'); return null; }
    P.me = prof;
    P.startIdle();
    sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && !P._leaving) go('index.html'); });
    return prof;
  };

  P.signOut = async (ev = 'logout', q = '') => {
    P._leaving = true;
    await P.log(ev);
    try { await sb.auth.signOut(); } catch (e) { /* already signed out */ }
    go('index.html' + q);
  };

  /* ---------- auto logout after inactivity (shared across tabs) ---------- */
  P.startIdle = () => {
    if (P._idle) return; P._idle = true;
    const limit = (+C.idleMinutes || 60) * 60e3, KEY = 'ael_last_activity';
    let last = Date.now(), lastWrite = 0, toast = null;
    const mark = () => { last = Date.now(); if (last - lastWrite > 15e3) { ls.set(KEY, String(last)); lastWrite = last; } if (toast) { toast.remove(); toast = null; } };
    ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(e => addEventListener(e, mark, { passive: true }));
    mark();
    setInterval(() => {
      const shared = +ls.get(KEY) || 0, idle = Date.now() - Math.max(last, shared), left = limit - idle;
      if (left <= 0) { P.signOut('auto_logout', '?m=idle'); return; }
      if (left < 120e3 && !toast) {
        toast = document.createElement('div'); toast.className = 'toast';
        toast.innerHTML = `No activity for a while. You'll be signed out in 2 minutes.<br><button class="btn sm ghost">Stay signed in</button>`;
        toast.querySelector('button').onclick = mark; document.body.appendChild(toast);
      }
    }, 15e3);
  };

  /* ---------- top bar ---------- */
  P.topbar = (prof, current, extra = '') => {
    const bar = document.createElement('header'); bar.className = 'pbar';
    const name = prof.full_name || prof.email;
    bar.innerHTML = `<div class="brand"><span class="dot"></span>${esc(C.orgName || 'AEL Operations Portal')}</div>
      <nav>
        <span class="sync" id="p-sync">${extra}</span>
        <a href="app.html" class="${current === 'app' ? 'on' : ''}">Dashboard</a>
        ${prof.role === 'admin' ? `<a href="admin.html" class="${current === 'admin' ? 'on' : ''}">Users</a>` : ''}
        <a href="change-password.html" class="${current === 'pw' ? 'on' : ''}">Change password</a>
        <span class="who">${esc(name)}<span class="role">${esc(prof.role)}</span></span>
        <button type="button" id="p-out">Sign out</button>
      </nav>`;
    bar.querySelector('#p-out').onclick = () => P.signOut();
    document.body.prepend(bar);
    return bar;
  };

  /* ---------- passwords ---------- */
  P.pwChecks = (p, email = '') => [
    ['At least 10 characters', p.length >= 10],
    ['Contains a letter', /[A-Za-z]/.test(p)],
    ['Contains a number', /\d/.test(p)],
    ['Not your email', !email || !p.toLowerCase().includes(email.split('@')[0].toLowerCase())]
  ];
  P.genPassword = () => {
    const L = 'abcdefghjkmnpqrstuvwxyz', U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', D = '23456789', all = L + U + D;
    const r = n => { const a = new Uint32Array(n); crypto.getRandomValues(a); return [...a]; };
    const pick = (set, x) => set[x % set.length];
    const x = r(12); let s = [pick(U, x[0]), pick(L, x[1]), pick(D, x[2]), pick(D, x[3])];
    for (let i = 4; i < 12; i++) s.push(pick(all, x[i]));
    const y = r(12); for (let i = s.length - 1; i > 0; i--) { const j = y[i] % (i + 1); [s[i], s[j]] = [s[j], s[i]]; }
    return s.slice(0, 4).join('') + '-' + s.slice(4, 8).join('') + '-' + s.slice(8).join('');
  };
  P.pwToggle = root => root.querySelectorAll('.pw').forEach(w => {
    const i = w.querySelector('input'), b = w.querySelector('button');
    b.onclick = () => { const show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.textContent = show ? 'Hide' : 'Show'; };
  });
})();
