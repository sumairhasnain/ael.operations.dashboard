/* VA/CR Activities tab: entrance animation, played each time the tab is opened (not on filter changes).
   Cards rise in, KPI and donut-centre figures count up, each donut has its own entrance (sweep, radial bloom, petal turn),
   quarter bars rise with a soft spring, conversion-cost stacks build up layer by layer, table rows cascade.
   Respects the viewer's reduced-motion setting. */
(() => {
  const q = s => document.querySelector(s), qa = (s, r) => [...(r || document).querySelectorAll(s)];
  const sec = q('#savings'); if (!sec || typeof d3 === 'undefined') return;
  const still = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* the page drawn last time: when this draw is for the VA/CR tab and the last one was not, the tab has just been opened */
  let lastPage = null;
  const hookDraw = () => { const d = window.__draw; if (typeof d !== 'function' || d._a) return !!(d && d._a); const w = (...a) => { try { return d(...a); } finally { lastPage = window.__page; } }; w._a = 1; window.__draw = w; return true; };
  if (!hookDraw()) document.addEventListener('DOMContentLoaded', hookDraw);
  const EASE = 'cubic-bezier(.22,.8,.24,1)', SPRING = 'cubic-bezier(.34,1.45,.55,1)';
  const anim = (el, kf, o) => { try { return el.animate(kf, { fill: 'backwards', easing: EASE, ...o }); } catch (e) { return null; } };

  /* numbers: count up from zero, keeping the prefix, suffix and decimals of the final text */
  const countUp = (el, dur, delay) => { const t = el.textContent, m = t.match(/-?\d[\d,]*\.?\d*/); if (!m) return; const raw = m[0], v = +raw.replace(/,/g, ''); if (!isFinite(v) || !v) return;
    const dec = (raw.split('.')[1] || '').length, comma = raw.includes(','), pre = t.slice(0, m.index), post = t.slice(m.index + raw.length);
    const fmt = x => (comma ? d3.format(`,.${dec}f`) : d3.format(`.${dec}f`))(x); const t0 = performance.now() + delay;
    el.textContent = pre + fmt(0) + post; const step = now => { const k = Math.min(1, Math.max(0, (now - t0) / dur)), e = 1 - Math.pow(1 - k, 3); el.textContent = pre + fmt(v * e) + post; if (k < 1) requestAnimationFrame(step); else el.textContent = t; }; requestAnimationFrame(step); };

  /* donuts: three different entrances */
  const donut = (host, style, delay) => { const svg = host && host.querySelector('svg'); if (!svg) return; const g = svg.querySelector('g'); const paths = qa('path', g).filter(p => p.__data__ && p.__data__.startAngle != null);
    if (!paths.length) return; const vb = svg.viewBox.baseVal, r = (vb && vb.width ? vb.width : 170) / 2; const inner = r * 0.62;
    const outerOf = p => { const d = p.getAttribute('d') || ''; return /A\s*([\d.]+)/.test(d) ? +d.match(/A\s*([\d.]+)/)[1] : r - 4; };
    paths.forEach((p, i) => { const a = p.__data__, ro = outerOf(p), fin = p.getAttribute('d'), pad = a.padAngle || 0;
      if (style === 'sweep') {          /* one continuous clockwise sweep around the ring */
        const total = paths[paths.length - 1].__data__.endAngle, dur = 1100;
        d3.select(p).attr('d', d3.arc().innerRadius(inner).outerRadius(ro).padAngle(pad)({ ...a, endAngle: a.startAngle }))
          .transition().delay(delay + 1100 * a.startAngle / total).duration(Math.max(80, dur * (a.endAngle - a.startAngle) / total)).ease(d3.easeLinear)
          .attrTween('d', () => { const ip = d3.interpolate(a.startAngle, a.endAngle); return t => d3.arc().innerRadius(inner).outerRadius(ro).padAngle(pad)({ ...a, endAngle: ip(t) }); })
          .on('end', () => p.setAttribute('d', fin)); }
      else if (style === 'bloom') {     /* each slice grows outward from the hole, one after another */
        d3.select(p).attr('d', d3.arc().innerRadius(inner).outerRadius(inner + 0.5).padAngle(pad)(a))
          .transition().delay(delay + i * 110).duration(700).ease(d3.easeBackOut.overshoot(1.6))
          .attrTween('d', () => { const ip = d3.interpolate(inner + 0.5, ro); return t => d3.arc().innerRadius(inner).outerRadius(ip(t)).padAngle(pad)(a); })
          .on('end', () => p.setAttribute('d', fin)); }
      else {                            /* petals: slices fan out from 12 o'clock while the ring turns into place */
        d3.select(p).attr('d', d3.arc().innerRadius(inner).outerRadius(ro).padAngle(pad)({ ...a, startAngle: 0, endAngle: 0 }))
          .transition().delay(delay + 150).duration(1000).ease(d3.easeCubicOut)
          .attrTween('d', () => { const s0 = d3.interpolate(0, a.startAngle), e0 = d3.interpolate(0, a.endAngle); return t => d3.arc().innerRadius(inner).outerRadius(ro).padAngle(pad)({ ...a, startAngle: s0(t), endAngle: e0(t) }); })
          .on('end', () => p.setAttribute('d', fin)); } });
    if (style === 'petal') { svg.style.transformOrigin = '50% 50%'; anim(svg, [{ transform: 'rotate(-120deg) scale(.86)', opacity: .5 }, { transform: 'none', opacity: 1 }], { duration: 1150, delay: delay + 150 }); }
    qa('text', g).forEach((t, i) => { anim(t, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: delay + 500 + i * 120 }); if (i === 0) countUp(t, 1100, delay + 300); });
    const leg = host.parentElement && host.parentElement.querySelector('.crleg'); if (leg) qa(':scope > div', leg).forEach((row, i) => anim(row, [{ opacity: 0, transform: 'translateX(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: delay + 250 + i * 55 })); };

  /* bars */
  const rise = (rects, base, o) => rects.forEach((r, i) => { r.style.transformBox = 'fill-box'; r.style.transformOrigin = base; anim(r, [{ transform: base.includes('100%') ? 'scaleY(0)' : 'scaleX(0)' }, { transform: 'none' }], { duration: o.dur, delay: o.delay(r, i), easing: o.easing || EASE }); });

  const play = () => {
    if (still()) return;
    /* cards and KPI tiles */
    qa('.card, .crbar, .crcrumbs', sec).filter(c => !c.hidden).forEach((c, i) => anim(c, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: Math.min(i, 12) * 55 }));
    qa('#cr-kpi .ktile').forEach((t, i) => { anim(t, [{ opacity: 0, transform: 'translateY(10px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 120 + i * 110 }); const v = t.querySelector('.tv'); if (v) countUp(v, 1200, 160 + i * 110); });
    /* donuts: sweep, bloom, petal */
    donut(q('#cr-d-cat'), 'sweep', 250); donut(q('#cr-d-shop'), 'bloom', 380); donut(q('#cr-d-mod'), 'petal', 480);
    /* quarter bars: each quarter's stack rises together with a soft spring, quarter by quarter */
    { const svg = q('#cr-q svg'); if (svg) { const bars = qa('rect', svg).filter(r => +r.getAttribute('width') > 12 && r.getAttribute('height') > 0);
      const xs = [...new Set(bars.map(r => r.getAttribute('x')))]; rise(bars, '50% 100%', { dur: 780, easing: SPRING, delay: r => 350 + xs.indexOf(r.getAttribute('x')) * 140 });
      qa('text', svg).filter(t => t.style.fontWeight === '600').forEach((t, i) => anim(t, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 1000 + i * 140 })); } }
    /* shop x category matrix: cells light up in a diagonal wave */
    qa('#cr-mx td').forEach(td => { const tr = td.parentElement, r = tr.rowIndex || 0, c = td.cellIndex || 0; anim(td, [{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: 300 + (r + c) * 35 }); });
    /* tables: first rows cascade */
    ['#tb-cr-mod', '#tb-cr-shop', '#tb-cr', '#tb-ccv', '#tb-ccv-i'].forEach((s, k) => qa(s + ' tbody tr').slice(0, 14).forEach((tr, i) => anim(tr, [{ opacity: 0, transform: 'translateX(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 250 + k * 60 + i * 40 })));
    /* conversion cost: each product's stack builds bottom-up, layer by layer; boxes arrive left to right */
    qa('#cc-grid .ccbox').forEach((b, bi) => { anim(b, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 200 + bi * 70 });
      const svg = b.querySelector('svg'); if (!svg) return; const rects = qa('rect', svg), xs = [...new Set(rects.map(r => r.getAttribute('x')))].sort((a, c) => a - c), layer = new Map();
      rects.forEach(r => { const x = r.getAttribute('x'), n = layer.get(x) || 0; layer.set(x, n + 1); r._l = n; r._b = xs.indexOf(x); });
      rise(rects, '50% 100%', { dur: 420, delay: r => 320 + bi * 70 + r._b * 260 + r._l * 120 });
      qa('text', svg).forEach(t => anim(t, [{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: 900 + bi * 70 })); });
  };

  const wrap = name => { const f = window[name]; if (typeof f !== 'function' || f._a) return; const w = g => { f(g); if (lastPage !== 'savings') requestAnimationFrame(play); }; w._a = 1; window[name] = w; };
  wrap('__conv');
})();
