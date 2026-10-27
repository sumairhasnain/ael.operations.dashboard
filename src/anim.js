/* Entrance animations for every tab of the dashboard, played when a tab is opened (not on filter changes).
   All tabs: cards rise in one after another, KPI figures count up, vertical bars rise from the baseline column by column,
   horizontal bars grow from the left row by row, heat-map cells light up in a diagonal wave, lines draw themselves,
   markers pop in, value labels fade in once their bars land, and the first table rows cascade in.
   Donuts get one of three entrances in turn (clockwise sweep, radial bloom, petal fan).
   VA/CR Activities keeps its own choreography (spring quarter bars, conversion-cost stacks built layer by layer).
   Charts whose data arrives after the tab opened are animated when they first draw.
   Respects the viewer's reduced-motion setting. */
(() => {
  const q = s => document.querySelector(s), qa = (s, r) => [...(r || document).querySelectorAll(s)];
  if (typeof d3 === 'undefined') return;
  const still = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(.22,.8,.24,1)', SPRING = 'cubic-bezier(.34,1.45,.55,1)';
  const anim = (el, kf, o) => { try { return el.animate(kf, { fill: 'backwards', easing: EASE, ...o }); } catch (e) { return null; } };
  const done = new WeakSet();   // svgs already animated

  /* numbers: count up from zero, keeping the prefix, suffix and decimals of the final text */
  const countUp = (el, dur, delay) => { const t = el.textContent, m = t.match(/-?\d[\d,]*\.?\d*/); if (!m) return; const raw = m[0], v = +raw.replace(/,/g, ''); if (!isFinite(v) || !v) return;
    const dec = (raw.split('.')[1] || '').length, comma = raw.includes(','), pre = t.slice(0, m.index), post = t.slice(m.index + raw.length);
    const fmt = x => (comma ? d3.format(`,.${dec}f`) : d3.format(`.${dec}f`))(x); const t0 = performance.now() + delay;
    el.textContent = pre + fmt(0) + post; const step = now => { if (el.textContent.indexOf(pre) !== 0) return; const k = Math.min(1, Math.max(0, (now - t0) / dur)), e = 1 - Math.pow(1 - k, 3); el.textContent = pre + fmt(v * e) + post; if (k < 1) requestAnimationFrame(step); else el.textContent = t; }; requestAnimationFrame(step); };

  /* donuts: radii are read from each slice's own path, so this works for every donut on the dashboard */
  const radii = p => { const r = [...(p.getAttribute('d') || '').matchAll(/A\s*([\d.]+)/g)].map(m => +m[1]); return r.length ? [r.length > 1 ? Math.min(...r) : 0, Math.max(...r)] : null; };
  const donut = (svg, style, delay) => { const paths = qa('path', svg).filter(p => p.__data__ && p.__data__.startAngle != null); if (!paths.length) return false;
    const total = d3.max(paths, p => p.__data__.endAngle) || 2 * Math.PI, g = paths[0].parentNode;
    paths.forEach((p, i) => { const a = p.__data__, rr = radii(p); if (!rr) return; const [ri, ro] = rr, fin = p.getAttribute('d'), pad = a.padAngle || 0, arc = d3.arc().padAngle(pad);
      const sel = d3.select(p).interrupt();
      if (style === 'sweep') {
        sel.attr('d', arc.innerRadius(ri).outerRadius(ro)({ ...a, endAngle: a.startAngle })).transition().delay(delay + 1000 * a.startAngle / total).duration(Math.max(80, 1000 * (a.endAngle - a.startAngle) / total)).ease(d3.easeLinear)
          .attrTween('d', () => { const ip = d3.interpolate(a.startAngle, a.endAngle); return t => arc.innerRadius(ri).outerRadius(ro)({ ...a, endAngle: ip(t) }); }).on('end interrupt', () => p.setAttribute('d', fin)); }
      else if (style === 'bloom') {
        sel.attr('d', arc.innerRadius(ri).outerRadius(ri + .5)(a)).transition().delay(delay + i * 100).duration(680).ease(d3.easeBackOut.overshoot(1.6))
          .attrTween('d', () => { const ip = d3.interpolate(ri + .5, ro); return t => arc.innerRadius(ri).outerRadius(ip(t))(a); }).on('end interrupt', () => p.setAttribute('d', fin)); }
      else {
        sel.attr('d', arc.innerRadius(ri).outerRadius(ro)({ ...a, startAngle: 0, endAngle: 0 })).transition().delay(delay + 120).duration(1000).ease(d3.easeCubicOut)
          .attrTween('d', () => { const s0 = d3.interpolate(0, a.startAngle), e0 = d3.interpolate(0, a.endAngle); return t => arc.innerRadius(ri).outerRadius(ro)({ ...a, startAngle: s0(t), endAngle: e0(t) }); }).on('end interrupt', () => p.setAttribute('d', fin)); } });
    if (style === 'petal') { svg.style.transformOrigin = '50% 50%'; anim(svg, [{ transform: 'rotate(-120deg) scale(.86)', opacity: .5 }, { transform: 'none', opacity: 1 }], { duration: 1100, delay: delay + 120 }); }
    qa('text', g).forEach((t, i) => { anim(t, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: delay + 450 + i * 100 }); if (i === 0) countUp(t, 1100, delay + 250); });
    return true; };

  /* any chart: work out what is in it and give each kind of mark its entrance */
  const mode = a => { const c = new Map(); a.forEach(v => c.set(v, (c.get(v) || 0) + 1)); return d3.max([...c.values()]) || 0; };
  let donutN = 0;
  const chart = (svg, delay) => {
    if (done.has(svg)) return; done.add(svg);
    const vb = svg.viewBox && svg.viewBox.baseVal, W = vb && vb.width ? vb.width : svg.clientWidth, H = vb && vb.height ? vb.height : svg.clientHeight;
    if (!W || !H || (W < 140 && H < 50 && !svg.closest('.ktile'))) return;
    if (donut(svg, ['sweep', 'bloom', 'petal'][donutN++ % 3], delay)) return;
    const inTick = el => !!el.closest('.tick, .legend, .lg');
    const bars = qa('rect', svg).filter(r => { const w = +r.getAttribute('width'), h = +r.getAttribute('height'), f = (r.getAttribute('fill') || '').toLowerCase();
      return w > 1.5 && h > 1.5 && !(w <= 12 && h <= 12) && f && (f !== 'none' || r.getAttribute('stroke-dasharray')) && f !== 'transparent' && !/^#?fff/.test(f) && !(w > W * .9 && h > H * .7) && !inTick(r) && r.getAttribute('opacity') !== '0'; });
    let barEnd = delay;
    if (bars.length) {
      const ws = bars.map(r => Math.round(+r.getAttribute('width'))), hs = bars.map(r => Math.round(+r.getAttribute('height')));
      const sameW = mode(ws) / bars.length, sameH = mode(hs) / bars.length;
      if (sameW > .8 && sameH > .8 && bars.length > 12) {          // heat map / calendar grid: diagonal wave
        const xs = [...new Set(bars.map(r => +r.getAttribute('x')))].sort((a, b) => a - b), ys = [...new Set(bars.map(r => +r.getAttribute('y')))].sort((a, b) => a - b), n = xs.length + ys.length;
        bars.forEach(r => anim(r, [{ opacity: 0 }, { opacity: r.getAttribute('opacity') || 1 }], { duration: 420, delay: delay + 900 * (xs.indexOf(+r.getAttribute('x')) + ys.indexOf(+r.getAttribute('y'))) / Math.max(1, n) }));
        barEnd = delay + 1000; }
      else {
        const horiz = sameH > sameW && sameH > .5;               // equal heights, varying widths: horizontal bars
        const key = r => Math.round(+r.getAttribute(horiz ? 'y' : 'x')), slots = [...new Set(bars.map(key))].sort((a, b) => a - b), step = Math.min(110, 900 / Math.max(1, slots.length));
        bars.forEach(r => { r.style.transformBox = 'fill-box'; r.style.transformOrigin = horiz ? '0% 50%' : '50% 100%';
          anim(r, [{ transform: horiz ? 'scaleX(0)' : 'scaleY(0)' }, { transform: 'none' }], { duration: horiz ? 620 : 680, delay: delay + slots.indexOf(key(r)) * step, easing: horiz ? EASE : SPRING }); });
        barEnd = delay + slots.length * step + 500; } }
    /* lines draw themselves (dashed reference lines and axes are left alone) */
    const lines = qa('path', svg).filter(p => !inTick(p) && !p.classList.contains('domain') && p.getAttribute('stroke') && p.getAttribute('stroke') !== 'none' &&
      ((p.getAttribute('fill') || '') === 'none' || getComputedStyle(p).fill === 'none') && !p.getAttribute('stroke-dasharray') && !p.style.strokeDasharray);
    lines.forEach((p, i) => { let len = 0; try { len = p.getTotalLength(); } catch (e) {} if (!len || len < 20) return;
      p.style.strokeDasharray = len; const a = anim(p, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 1200, delay: delay + 150 + i * 120, easing: 'cubic-bezier(.45,.05,.25,1)' });
      const clear = () => { p.style.strokeDasharray = ''; }; if (a) a.onfinish = a.oncancel = clear; else clear(); });
    /* area fills under lines fade up */
    qa('path', svg).filter(p => !inTick(p) && !lines.includes(p) && !(p.__data__ && p.__data__.startAngle != null) && (p.getAttribute('fill') || 'none') !== 'none' && !p.classList.contains('domain'))
      .forEach(p => anim(p, [{ opacity: 0 }, { opacity: p.getAttribute('opacity') || 1 }], { duration: 700, delay: delay + 300 }));
    /* markers pop */
    const dots = qa('circle', svg).filter(c => !inTick(c)), last = lines.length ? delay + 1100 : barEnd;
    dots.forEach((c, i) => { c.style.transformBox = 'fill-box'; c.style.transformOrigin = '50% 50%'; anim(c, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, delay: (lines.length ? delay + 300 : delay) + Math.min(i, 40) * 25, easing: SPRING }); });
    /* value labels appear once their marks have landed; axis labels stay put */
    /* category and axis labels (left of or below the marks) come in with the card; value labels appear once their marks have landed */
    if (bars.length || lines.length || dots.length) { const bx = bars.length ? d3.min(bars, r => +r.getAttribute('x')) : 0, by = bars.length ? d3.max(bars, r => +r.getAttribute('y') + +r.getAttribute('height')) : H;
      qa('text', svg).filter(t => !inTick(t)).forEach((t, i) => { const x = +t.getAttribute('x') || 0, y = +t.getAttribute('y') || 0, early = bars.length ? (x < bx - 2 || y > by + 2) : t.getAttribute('text-anchor') === 'end';
        anim(t, [{ opacity: 0 }, { opacity: 1 }], early ? { duration: 380, delay: delay + 60 } : { duration: 420, delay: Math.max(barEnd, last) - 250 + Math.min(i, 30) * 12 }); }); }
  };

  const tables = (sec, base) => qa('tbody', sec).forEach((tb, k) => qa(':scope > tr', tb).slice(0, 14).forEach((tr, i) => anim(tr, [{ opacity: 0, transform: 'translateX(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: base + Math.min(k, 6) * 60 + i * 38 })));
  const charts = (root, base) => { donutN = 0; const svgs = qa('svg', root).filter(s => !done.has(s) && !s.closest('#tip') && s.isConnected && s.getClientRects().length);
    svgs.forEach((s, i) => { const card = s.closest('.card, .ccbox, .ktile'); const ci = card ? qa('.card', root).indexOf(card.closest('.card')) : i; chart(s, base + Math.max(0, Math.min(ci, 12)) * 70); }); };

  /* generic entrance for a tab */
  const generic = sec => {
    qa('.card', sec).filter(c => !c.hidden).forEach((c, i) => anim(c, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: Math.min(i, 14) * 55 }));
    qa(':scope > :not(.grid):not(i)', sec).forEach((c, i) => anim(c, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: i * 50 }));
    qa('.ktile, .kmini, .ivk > div', sec).forEach((t, i) => anim(t, [{ opacity: 0, transform: 'translateY(10px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 100 + Math.min(i, 10) * 90 }));
    qa('.ktile .tv, .kmini .kv, .ivk b, .kv', sec).forEach((v, i) => countUp(v, 1150, 150 + Math.min(i, 10) * 90));
    charts(sec, 180); tables(sec, 260); };

  /* VA/CR Activities: its own choreography */
  const savings = sec => {
    qa('.card, .crbar, .crcrumbs', sec).filter(c => !c.hidden).forEach((c, i) => anim(c, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: Math.min(i, 12) * 55 }));
    qa('#cr-kpi .ktile').forEach((t, i) => { anim(t, [{ opacity: 0, transform: 'translateY(10px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 120 + i * 110 }); const v = t.querySelector('.tv'); if (v) countUp(v, 1200, 160 + i * 110); });
    [['#cr-d-cat', 'sweep', 250], ['#cr-d-shop', 'bloom', 380], ['#cr-d-mod', 'petal', 480]].forEach(([s, st, d]) => { const svg = q(s + ' svg'); if (!svg) return; done.add(svg); donut(svg, st, d);
      const leg = q(s).parentElement && q(s).parentElement.querySelector('.crleg'); if (leg) qa(':scope > div', leg).forEach((row, i) => anim(row, [{ opacity: 0, transform: 'translateX(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: d + 250 + i * 55 })); });
    { const svg = q('#cr-q svg'); if (svg) { done.add(svg); const bars = qa('rect', svg).filter(r => +r.getAttribute('width') > 12 && r.getAttribute('height') > 0), xs = [...new Set(bars.map(r => r.getAttribute('x')))];
      bars.forEach(r => { r.style.transformBox = 'fill-box'; r.style.transformOrigin = '50% 100%'; anim(r, [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 780, easing: SPRING, delay: 350 + xs.indexOf(r.getAttribute('x')) * 140 }); });
      qa('text', svg).filter(t => t.style.fontWeight === '600').forEach((t, i) => anim(t, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 1000 + i * 140 })); } }
    qa('#cr-mx td').forEach(td => anim(td, [{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: 300 + ((td.parentElement.rowIndex || 0) + (td.cellIndex || 0)) * 35 }));
    tables(sec, 250);
    qa('#cc-grid .ccbox').forEach((b, bi) => { anim(b, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 200 + bi * 70 });
      const svg = b.querySelector('svg'); if (!svg) return; done.add(svg); const rects = qa('rect', svg), xs = [...new Set(rects.map(r => r.getAttribute('x')))].sort((a, c) => a - c), layer = new Map();
      rects.forEach(r => { const x = r.getAttribute('x'), n = layer.get(x) || 0; layer.set(x, n + 1); r.style.transformBox = 'fill-box'; r.style.transformOrigin = '50% 100%';
        anim(r, [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 420, delay: 320 + bi * 70 + xs.indexOf(x) * 260 + n * 120 }); });
      qa('text', svg).forEach(t => anim(t, [{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: 900 + bi * 70 })); });
    charts(sec, 300); };

  /* tab tracking: a draw for a different page than last time means a tab was just opened */
  let lastPage = null, entry = { page: null, t: 0 };
  const after = page => { const sec = document.getElementById(page); if (!sec || still()) return;
    const holders = () => qa('svg', sec).filter(s => s.getClientRects().length).map(s => s.parentElement);
    if (page !== lastPage) { entry = { page, t: performance.now() }; qa('svg', sec).forEach(s => done.delete(s)); requestAnimationFrame(() => page === 'savings' ? savings(sec) : generic(sec)); }
    else if (entry.page === page && performance.now() - entry.t < 8000) {
      /* data that arrived after the tab opened: animate charts drawing into an empty holder for the first time, not ones a filter redrew */
      const late = qa('svg', sec).filter(s => !done.has(s) && s.getClientRects().length && s.parentElement && !s.parentElement._drawn);
      if (late.length) requestAnimationFrame(() => { donutN = 0; late.forEach(s => chart(s, 0)); }); }
    holders().forEach(h => { h._drawn = 1; }); };
  const hookDraw = () => { const d = window.__draw; if (typeof d !== 'function') return false; if (d._a) return true;
    const w = (...a) => { let r; try { r = d(...a); } finally { const p = window.__page; try { after(p); } catch (e) {} lastPage = p; } return r; }; w._a = 1; window.__draw = w; return true; };
  if (!hookDraw()) document.addEventListener('DOMContentLoaded', hookDraw);
})();
