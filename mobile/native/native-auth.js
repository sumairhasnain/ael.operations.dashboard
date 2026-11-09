/* AEL Operations app: device sign-in (remember password, Face ID / fingerprint).
   Loaded only inside the iOS/Android app. The website is unchanged.
   Credentials live in the iOS Keychain / Android Keystore, never in localStorage.
   Biometric-protected entries are hardware-bound: they cannot be read without a live Face ID / fingerprint check. */
(() => {
  const Cap = window.Capacitor;
  if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;
  const NB = Cap.Plugins && Cap.Plugins.NativeBiometric;
  const P = window.Portal;
  if (!NB || !P) return;

  const SRV_BIO = 'com.ael.operations.bio';      // biometric-gated
  const SRV_PWD = 'com.ael.operations.remember'; // device-protected, for "remember password" without biometrics
  const PEND = 'ael_pending_cred';               // sessionStorage: typed credentials waiting for a successful sign-in
  const PREF = 'ael_device_pref';                // localStorage: which options the user ticked (no secrets)
  const ACCESS_CURRENT_SET = 1;                  // AccessControl.BIOMETRY_CURRENT_SET

  const ss = { get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} }, del: k => { try { sessionStorage.removeItem(k); } catch (e) {} } };
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }, del: k => { try { localStorage.removeItem(k); } catch (e) {} } };
  const prefs = () => { try { return JSON.parse(ls.get(PREF) || '{}') || {}; } catch (e) { return {}; } };
  const setPrefs = o => ls.set(PREF, JSON.stringify(o));

  let avail = { isAvailable: false, biometryType: 0 };
  const bioName = () => ({ 1: 'Touch ID', 2: 'Face ID', 3: 'fingerprint', 4: 'face unlock', 5: 'iris unlock', 6: 'Face / fingerprint' }[avail.biometryType] || 'biometrics');
  const probe = async () => { try { avail = await NB.isAvailable({ useFallback: false }); } catch (e) { avail = { isAvailable: false, biometryType: 0 }; } return avail; };

  const forget = async () => {
    for (const server of [SRV_BIO, SRV_PWD]) { try { await NB.deleteCredentials({ server }); } catch (e) { /* nothing stored */ } }
    ls.del(PREF); ss.del(PEND);
  };

  /* Save what the user asked for, once a sign-in has really succeeded. */
  const persist = async ({ email, password }) => {
    const p = prefs();
    try {
      if (p.bio && avail.isAvailable) {
        await NB.setCredentials({ username: email, password, server: SRV_BIO, accessControl: ACCESS_CURRENT_SET, title: 'Enable ' + bioName(), negativeButtonText: 'Cancel' });
        try { await NB.deleteCredentials({ server: SRV_PWD }); } catch (e) {}
      } else if (p.remember) {
        await NB.setCredentials({ username: email, password, server: SRV_PWD });
      }
    } catch (e) {
      // user cancelled the biometric prompt, or the device refused: fall back to nothing saved
      setPrefs({ ...p, bio: false });
    }
  };

  /* ---------- capture credentials typed on the sign-in form; save them after sign-in succeeds ---------- */
  const watchSignIn = f => {
    f.addEventListener('submit', () => {
      const email = f.email.value.trim().toLowerCase(), password = f.password.value;
      const remember = !!document.getElementById('nd-remember')?.checked, bio = !!document.getElementById('nd-bio')?.checked;
      setPrefs({ remember: remember || bio, bio });
      if (email && password) ss.set(PEND, JSON.stringify({ email, password }));
    }, true);
  };

  /* A password change (including the forced first-time change) must also refresh the saved copy. */
  if (P.sb && P.sb.auth && P.sb.auth.updateUser) {
    const orig = P.sb.auth.updateUser.bind(P.sb.auth);
    P.sb.auth.updateUser = async (attrs, ...rest) => {
      const r = await orig(attrs, ...rest);
      if (!r.error && attrs && attrs.password && r.data && r.data.user) {
        const email = (r.data.user.email || '').toLowerCase();
        ss.set(PEND, JSON.stringify({ email, password: attrs.password }));
        const p = prefs(); if (p.remember || p.bio) { await probe(); await persist({ email, password: attrs.password }); ss.del(PEND); }
      }
      return r;
    };
  }

  /* After the portal's own guard accepts the session on the dashboard, store the credentials. */
  const flushPending = async () => {
    const raw = ss.get(PEND); if (!raw || !P.sb) return;
    const { data: { session } } = await P.sb.auth.getSession(); if (!session) return;
    const prof = await P.profile(); if (!prof || !prof.active || prof.must_change_password) return; // wait for the real password
    let cred; try { cred = JSON.parse(raw); } catch (e) { return; }
    if (cred.email !== (prof.email || '').toLowerCase()) { ss.del(PEND); return; }
    await probe(); await persist(cred); ss.del(PEND);
  };

  /* ---------- sign-in page ---------- */
  const signInPage = async f => {
    await probe();
    const stored = { bio: false, pwd: false };
    try { stored.bio = !!(await NB.isCredentialsSaved({ server: SRV_BIO })).isSaved; } catch (e) {}
    try { stored.pwd = !!(await NB.isCredentialsSaved({ server: SRV_PWD })).isSaved; } catch (e) {}
    const p = prefs();
    const m = document.getElementById('m'), say = (t, cls = '') => { m.className = 'msg ' + cls; m.textContent = t; };

    // forgot-password emails open in a browser, not in the app
    const forgot = document.getElementById('forgot');
    if (forgot) forgot.parentElement.innerHTML = '<span style="font-size:13px;color:#6b7280">Forgot your password? Ask the portal admin to reset it.</span>';

    // options under the password box
    const box = document.createElement('div'); box.style.cssText = 'margin:4px 0 16px;display:grid;gap:10px;font-size:14px';
    const row = (id, label, checked) => `<label style="display:flex;gap:10px;align-items:center;cursor:pointer"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} style="width:20px;height:20px"> ${label}</label>`;
    box.innerHTML = row('nd-remember', 'Remember my password on this device', p.remember || stored.pwd || stored.bio)
      + (avail.isAvailable ? row('nd-bio', 'Unlock with ' + bioName(), p.bio || stored.bio) : '');
    f.querySelector('#go').before(box);
    const rem = box.querySelector('#nd-remember'), bio = box.querySelector('#nd-bio');
    if (bio) { bio.addEventListener('change', () => { if (bio.checked) rem.checked = true; }); rem.addEventListener('change', () => { if (!rem.checked) bio.checked = false; }); }
    watchSignIn(f);

    const finish = async (email, password, how) => {
      const { error } = await P.sb.auth.signInWithPassword({ email, password });
      if (error) {
        if (/banned/i.test(error.message)) { say('Your account is disabled. Please contact the portal admin.', 'bad'); }
        else if (/rate|many/i.test(error.message)) { say('Too many attempts. Please wait a few minutes and try again.', 'warn'); }
        else if (/network|fetch|failed/i.test(error.message)) { say('No connection. Check your internet and try again.', 'warn'); }
        else { await forget(); f.password.value = ''; say('Your saved password no longer works (it may have been reset). Please sign in with your new password.', 'warn'); }
        return false;
      }
      const prof = await P.profile();
      if (!prof || !prof.active) { await P.sb.auth.signOut(); say('Your account is not set up or is disabled. Please contact the portal admin.', 'bad'); return false; }
      await P.log(how === 'bio' ? 'login_biometric' : 'login');
      P.go(prof.must_change_password ? 'change-password.html?first=1' : 'app.html');
      return true;
    };

    // saved + biometric: offer the quick button (and prompt straight away)
    if (stored.bio && avail.isAvailable) {
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn block'; btn.style.marginBottom = '12px';
      btn.textContent = 'Sign in with ' + bioName();
      f.querySelector('#go').before(btn);
      const run = async () => {
        btn.disabled = true;
        try {
          const c = await NB.getSecureCredentials({ server: SRV_BIO, title: 'AEL Operations', subtitle: 'Sign in to the portal', negativeButtonText: 'Use password' });
          ss.del(PEND);
          f.email.value = c.username;
          if (!(await finish(c.username.toLowerCase(), c.password, 'bio'))) btn.disabled = false;
        } catch (e) {
          btn.disabled = false;
          if (e && (e.code === '21' || e.code === 21)) { await forget(); say('Your ' + bioName() + ' settings changed. Please sign in with your password once to set it up again.', 'warn'); }
        }
      };
      btn.onclick = run;
      if (!new URLSearchParams(location.search).get('m')) setTimeout(run, 350); // no auto-prompt right after idle sign-out or a message
    } else if (stored.pwd) {
      try { const c = await NB.getCredentials({ server: SRV_PWD }); f.email.value = c.username; f.password.value = c.password; } catch (e) {}
    }

    // "forget this device" link
    if (stored.bio || stored.pwd) {
      const a = document.createElement('button'); a.type = 'button'; a.className = 'link'; a.textContent = 'Forget saved login on this device';
      a.onclick = async () => { await forget(); location.reload(); };
      f.appendChild(Object.assign(document.createElement('p'), { style: 'margin-top:12px' })).appendChild(a);
    }
  };

  /* ---------- change-password page: let the user remove the saved login ---------- */
  const settingsCard = async () => {
    const f = document.getElementById('f'); if (!f || !/change-password/.test(location.pathname)) return;
    const card = document.createElement('p'); card.style.cssText = 'margin-top:20px;font-size:13px;color:#6b7280';
    card.innerHTML = 'Saved login on this device: <button type="button" class="link" id="nd-forget">Forget it</button>';
    f.appendChild(card);
    card.querySelector('#nd-forget').onclick = async () => { await forget(); card.textContent = 'Saved login removed from this device.'; };
  };

  document.addEventListener('DOMContentLoaded', () => {
    const f = document.getElementById('f');
    if (f && f.email && f.password && document.getElementById('forgot')) signInPage(f);
    else { settingsCard(); flushPending(); }
  });
})();
