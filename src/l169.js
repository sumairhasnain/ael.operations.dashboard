/* Production tab 16:9 view (29 Oct, Umair, trial). One screen, 16:9, three bands:
     Row 1  Trend:     Daily Production | Cumulative Plan vs Actual
     Row 2  Breakdown: Plan vs Actual by Shop | by Model / Part | Monthly Trend
     Row 3  Detail:    Part Compliance - Finished Goods | Other Parts | Finished Part vs Components
   Hold the pointer on a chart title for 2 seconds to open that visual large; it stays interactive.
   Click outside it (or press Esc) to go back. A "16:9 view" button at the top of the tab switches the
   layout on/off; the choice is remembered in this browser. Removing this file and its script tag undoes it. */
(() => {
  const PG = document.getElementById('production'); if (!PG) return;
  const GRID = PG.querySelector('.grid'); if (!GRID) return;
  const KEY = 'ael.l169';
  const AREA = {
    'c-p-daily': '1 / 1 / 2 / 7', 'c-p-cum': '1 / 7 / 2 / 13',
    'c-p-shop': '2 / 1 / 3 / 5', 'c-p-model': '2 / 5 / 3 / 9', 'c-p-trend': '2 / 9 / 3 / 13',
    'c-p-parts': '3 / 1 / 4 / 5', 'c-p-parts2': '3 / 5 / 4 / 9', 'c-p-comp': '3 / 9 / 4 / 13'
  };
  const BAND = [['Trend', 1], ['Breakdown', 2], ['Detail', 3]];
  const css = document.createElement('style');
  css.textContent = `
#production .l169-bar{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin:0 0 8px;font-size:12px;color:var(--mut,#5B6770)}
#production .l169-btn{border:1px solid #C9D1D9;background:#fff;color:#051C2C;font:inherit;font-size:12px;padding:4px 10px;border-radius:4px;cursor:pointer}
#production .l169-btn[aria-pressed="true"]{background:#051C2C;color:#fff;border-color:#051C2C}
#production.l169 .grid{display:grid;grid-template-columns:22px repeat(12,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));gap:10px;margin:0 auto 14px}
#production.l169 .l169-band{display:flex;align-items:center;justify-content:center;writing-mode:vertical-rl;transform:rotate(180deg);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:#5B6770;font-weight:600;border-right:2px solid #051C2C}
#production.l169 .grid > .card{grid-column:auto;display:flex;flex-direction:column;overflow:hidden;padding:10px 12px;min-height:0}
#production.l169 .grid > .card > h3, #production.l169 .grid > .card > .chd h3{font-size:13.5px;margin-bottom:4px}
#production.l169 .grid > .card .chart{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
#production.l169 .grid > .card .chart > svg{flex:1 1 auto;min-height:0;height:auto;width:100%}
#production.l169 .grid > .card .tbox{flex:1;min-height:0;max-height:none}
#production.l169 .grid > .card .q{margin-bottom:6px}
#production.l169 .card h3{cursor:zoom-in;position:relative}
#production.l169 .card h3::after{content:'';position:absolute;left:0;bottom:-2px;height:2px;width:0;background:#2251FF}
#production.l169 .card h3.l169-arm::after{width:100%;transition:width 2s linear}
.l169-ov{position:fixed;inset:0;z-index:45;background:rgba(5,28,44,.45);display:flex;align-items:center;justify-content:center}
.l169-ov .l169-pane{width:min(94vw,calc(88vh * 16 / 9));height:min(88vh,calc(94vw * 9 / 16));background:#fff;border-radius:6px;box-shadow:0 20px 60px rgba(5,28,44,.35);display:flex;flex-direction:column;overflow:hidden}
.l169-ov .l169-pane > .card{flex:1;min-height:0;border:0;display:flex;flex-direction:column;padding:16px 20px;overflow:auto}
.l169-ov .l169-pane > .card .chart{flex:1;min-height:0;display:flex;flex-direction:column}
.l169-ov .l169-pane > .card .chart > svg{flex:1 1 auto;min-height:0;height:auto;width:100%}
.l169-ov .l169-pane > .card .tbox{flex:1;min-height:0;max-height:none}
.l169-ov .l169-hint{padding:6px 20px 8px;font-size:11px;color:#5B6770;border-top:1px solid #EEF1F4}
.ael .tip{z-index:70}`;
  document.head.appendChild(css);
  let on = true; try { const v = localStorage.getItem(KEY); if (v === '0') on = false; } catch (e) {}
  const bar = document.createElement('div'); bar.className = 'l169-bar';
  bar.innerHTML = '<span>Hold the pointer on a chart title for 2 s to enlarge it</span><button type="button" class="l169-btn">16:9 view</button>';
  PG.insertBefore(bar, GRID); const btn = bar.querySelector('button'), hint = bar.querySelector('span');
  const bands = BAND.map(([t, r]) => { const d = document.createElement('div'); d.className = 'l169-band'; d.textContent = t; d.style.gridArea = `${r} / 1 / ${r + 1} / 2`; return d; });
  /* columns shift by one for the band labels */
  const area = id => AREA[id].split(' / ').map((v, i) => i % 2 ? +v + 1 : +v).join(' / ');
  const size = () => { if (!on || !PG.classList.contains('l169') || !PG.clientWidth) return; /* hidden tab: size on next draw */
    const avail = Math.max(420, innerHeight - 24), w = Math.min(PG.clientWidth, avail * 16 / 9); /* the page scrolls, so the grid fills one screen height */
    GRID.style.width = w + 'px'; GRID.style.height = (w * 9 / 16) + 'px'; };
  const apply = () => {
    PG.classList.toggle('l169', on); btn.setAttribute('aria-pressed', String(on)); hint.style.display = on ? '' : 'none';
    btn.title = on ? '16:9 view is on. Click for the standard long page.' : 'Switch to the one-screen 16:9 view';
    Object.keys(AREA).forEach(id => { const c = document.getElementById(id); if (c) c.style.gridArea = on ? area(id) : ''; });
    bands.forEach(b => on ? GRID.appendChild(b) : b.remove());
    if (!on) { GRID.style.width = ''; GRID.style.height = ''; } else size();
    if (window.__page === 'production' && window.__draw) window.__draw();
  };
  btn.addEventListener('click', () => { on = !on; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} close(); apply(); });
  /* zoom: hold on a title for 2 s */
  let ov = null, ph = null, card = null, tmr = null, armed = null;
  const disarm = () => { clearTimeout(tmr); if (armed) armed.classList.remove('l169-arm'); armed = null; };
  const close = () => { if (!ov) return; ph.replaceWith(card); ov.remove(); ov = ph = card = null; size(); if (window.__draw) window.__draw(); };
  const open = c => { if (ov) return; card = c; ph = document.createElement('div'); ph.className = 'card'; ph.style.gridArea = c.style.gridArea; ph.style.background = '#F3F5F8';
    c.replaceWith(ph); ov = document.createElement('div'); ov.className = 'l169-ov';
    const pane = document.createElement('div'); pane.className = 'l169-pane'; pane.appendChild(card);
    const h = document.createElement('div'); h.className = 'l169-hint'; h.textContent = 'Click outside this panel or press Esc to go back'; pane.appendChild(h);
    ov.appendChild(pane); (document.getElementById('ael') || document.body).appendChild(ov);
    ov.addEventListener('mousedown', ev => { if (ev.target === ov) close(); });
    if (window.__draw) window.__draw(); };
  PG.addEventListener('mouseover', ev => { if (!on || ov) return; const h = ev.target.closest('.grid > .card h3'); if (!h || h === armed) return; disarm();
    armed = h; void h.offsetWidth; h.classList.add('l169-arm'); tmr = setTimeout(() => { const c = h.closest('.card'); disarm(); open(c); }, 2000); });
  PG.addEventListener('mouseout', ev => { if (armed && !armed.contains(ev.relatedTarget)) disarm(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') close(); });
  window.addEventListener('resize', () => { if (!on) return; size(); if (window.__page === 'production' && window.__draw) window.__draw(); });
  const ob = new MutationObserver(() => { if (window.__page !== 'production') close(); }); ob.observe(PG, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
  const d0 = window.__draw; if (d0) window.__draw = (...a) => { if (window.__page === 'production') size(); return d0(...a); };
  apply();
})();
