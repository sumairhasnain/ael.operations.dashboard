/* SAP BOM (CS03) - multi-level, BOM tab (Umair, 13 Nov 2026).
   Dataset sap_bom: the clutch finished goods' BOMs read from SAP CS03 (plant KHI, usage 1) screen by screen, every level
   down to raw material; sap_bom_cost: rates from SAP MB51 only. 13 Nov 14:37 (Umair): cost uses the moving-average price
   SAP issues at (261 less 262 amount / quantity, last 60 days); the receipt rate is shown as the latest supplier price.
   Cost columns show only to people who may see the Cost tab. Material / unit = level-1 components x moving-average rate. */
(() => {
  const AK = window.AK; if (!AK) return;
  const { C, tip, empty } = AK;
  const nf = d3.format(','), r2 = d3.format(',.2f'), r0 = d3.format(',.0f');
  const qf = v => v == null ? '—' : (Math.abs(v - Math.round(v)) < 1e-9 ? nf(v) : d3.format(',.4~f')(v));
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const obj = v => { if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return null; } } return v; };
  const css = document.createElement('style'); css.textContent = `
.ael #c-b-sap .sbsub{font-size:12px;color:var(--mut);margin:-4px 0 10px;line-height:1.45}
.ael #c-b-sap .sbsub b{color:var(--navy);font-weight:600}
.ael #c-b-sap .sbsum{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:14px}
.ael #c-b-sap .sbsum th,.ael #c-b-sap .sbtree th{text-align:left;font-weight:600;color:#5A6670;font-size:11.5px;padding:6px 8px;border-bottom:1px solid #DDE3EA;background:#F7F9FB;position:sticky;top:0}
.ael #c-b-sap .sbsum td,.ael #c-b-sap .sbtree td{padding:5px 8px;border-bottom:1px solid #EEF1F4}
.ael #c-b-sap .n{text-align:right;font-variant-numeric:tabular-nums}
.ael #c-b-sap .sbsum tr{cursor:pointer}.ael #c-b-sap .sbsum tr.on td{background:#EEF4FF;font-weight:600}
.ael #c-b-sap .sbbox{max-height:620px;overflow:auto}
.ael #c-b-sap .sbtree{width:100%;border-collapse:collapse;font-size:12.5px}
.ael #c-b-sap .lv{display:inline-block;min-width:24px;text-align:center;border-radius:9px;font-size:11px;font-weight:600;padding:1px 6px;color:#fff}
.ael #c-b-sap .st-p{color:#B45309;font-weight:600}.ael #c-b-sap .st-r{color:#5A6670}
.ael #c-b-sap tr.l1 td{background:#F3F6FC}
.ael #c-b-sap .in{color:#8A94A0;font-style:italic}
.ael #c-b-sap .rm{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}
.ael #c-b-sap .rm span{background:#F3F6FC;border:1px solid #DDE3EA;border-radius:6px;padding:4px 8px;font-size:12px}
.ael #c-b-sap .rm b{color:var(--navy)}`;
  document.head.appendChild(css);
  const LVC = ['#0B2E8A', '#1D3FD6', '#4F6FE8', '#7F95F0', '#A9B8F5', '#C9D3F8'];
  let sel = null;
  function ensure() {
    const grid = document.querySelector('#bom .grid'); if (!grid || document.getElementById('c-b-sap')) return;
    const card = document.createElement('div'); card.className = 'card wide'; card.id = 'c-b-sap';
    card.innerHTML = `<h3>SAP BOM (CS03) - Multi-level <span class="chip snap" id="sb-asof"></span></h3><div class="sbsub" id="sb-sub"></div>
<div class="tbox"><table class="sbsum" id="sb-sum"><thead></thead><tbody></tbody></table></div><div class="rm" id="sb-rm"></div>
<div class="sbbox"><table class="sbtree" id="sb-tree"><thead></thead><tbody></tbody></table></div>`;
    grid.prepend(card);
  }
  function render(P) {
    ensure(); const card = document.getElementById('c-b-sap'); if (!card) return;
    if (P && P.shop && P.shop !== 'All' && P.shop !== 'Clutch') { card.hidden = true; return; } card.hidden = false;
    const d = window.dash && dash.data('sap_bom'), sub = document.getElementById('sb-sub'), box = card.querySelector('.sbbox');
    if (!d || d.status !== 'ok') { sub.textContent = d && d.status === 'error' ? '● Failed to load' : 'Loading…'; return; }
    const B = obj((Array.isArray(d.data) ? d.data[0] : d.data) || {}) || {}; const fgs = obj(B.fgs) || [], tree = obj(B.tree) || [];
    const dc = dash.data('sap_bom_cost'), K = dc && dc.status === 'ok' ? obj((Array.isArray(dc.data) ? dc.data[0] : dc.data) || {}) : null;
    const R = K ? obj(K.rates) || {} : null, FC = K ? new Map((obj(K.fg_cost) || []).map(x => [x.fg + '|' + x.alt, x])) : null;
    document.getElementById('sb-asof').textContent = 'SAP ' + (B.asof || '');
    const pend = new Set(); fgs.forEach(f => (f.pending || []).forEach(c => pend.add(c)));
    sub.innerHTML = `<b>Clutch</b> · ${new Set(fgs.map(f => f.fg)).size} finished goods (${fgs.length} BOMs incl. alternatives) from ${esc(B.source || 'SAP CS03')}, every level read from SAP · ` +
      (pend.size ? `<b style="color:#B45309">${pend.size} sub-assemblies</b> still to be opened in CS03 (shown in amber; their own rate is used meanwhile)` : 'all levels complete') +
      (R ? ' · rates: SAP MB51 moving average (261 issues)' : '');
    if (!sel || !fgs.some(f => f.fg + '|' + f.alt === sel)) sel = fgs.length ? fgs[0].fg + '|' + fgs[0].alt : null;
    // summary
    const sh = card.querySelector('#sb-sum thead'), sb = card.querySelector('#sb-sum tbody');
    sh.innerHTML = `<tr><th>Finished good</th><th>Code</th><th>Alt</th><th class="n">Levels</th><th class="n">Level-1 items</th><th class="n">Pending</th>` +
      (R ? `<th class="n">Material / unit (moving avg)</th><th class="n">At latest receipt prices</th><th class="n">FG MB51 receipt rate</th><th class="n">FG rate less material</th>` : '') + `</tr>`;
    sb.replaceChildren(...fgs.map(f => { const k = f.fg + '|' + f.alt, tr = document.createElement('tr'), fc = FC && FC.get(k), fr = R && R[f.fg];
      if (k === sel) tr.className = 'on';
      tr.innerHTML = `<td>${esc(f.part)}${f.alt_note ? ` <span style="color:#5A6670">· ${esc(f.alt_note)}</span>` : ''}</td><td>${f.fg}</td><td>${f.alt}</td><td class="n">${f.levels}</td><td class="n">${f.l1}</td><td class="n" style="${(f.pending || []).length ? 'color:#B45309;font-weight:600' : ''}">${(f.pending || []).length}</td>` +
        (R ? `<td class="n">${fc ? r2(fc.mat_unit) : '—'}</td><td class="n">${fc ? r2(fc.mat_unit_rcv) : '—'}</td><td class="n">${fr ? r2(fr.rate) : '—'}</td><td class="n">${fc && fr ? r2(fr.rate - fc.mat_unit) : '—'}</td>` : '');
      tr.addEventListener('click', () => { sel = k; render(window.__P ? window.__P() : P); });
      if (R && fr) tr.addEventListener('mousemove', ev => tip.show(ev, [f.part + ' · alt ' + f.alt, `Material from the BOM at moving-average (MB51 261) rates: Rs ${fc ? r2(fc.mat_unit) : '—'}`, `Same BOM at latest receipt prices: Rs ${fc ? r2(fc.mat_unit_rcv) : '—'}`, `The FG's own MB51 receipt rate (SAP valuation): Rs ${r2(fr.rate)}`, 'FG rate less material is roughly the conversion SAP adds at assembly']));
      tr.addEventListener('mouseleave', tip.hide); return tr; }));
    // raw material content for the selected FG
    const [sf, sa] = (sel || '|').split('|'), rows = tree.filter(t => t.fg === sf && t.alt === sa);
    const raw = new Map(); rows.filter(t => t.status !== 'Exploded' && /^1/.test(t.code)).forEach(t => { const o = raw.get(t.code) || { part: t.part, uom: t.uom, q: 0 }; o.q += t.qty_fg; raw.set(t.code, o); });
    document.getElementById('sb-rm').innerHTML = raw.size ? '<span style="background:none;border:0;padding-left:0;color:#5A6670">Raw material per unit (levels read so far):</span>' + [...raw.entries()].map(([c, o]) => `<span title="${c}"><b>${qf(+o.q.toFixed(4))} ${esc(o.uom)}</b> ${esc(o.part)}</span>`).join('') : '';
    // tree
    const th = card.querySelector('#sb-tree thead'), tb = card.querySelector('#sb-tree tbody');
    th.innerHTML = `<tr><th>Level</th><th>Component</th><th>Description</th><th>Parent</th><th class="n">Qty / parent</th><th>UoM</th><th class="n">Qty / 1 FG</th>` +
      (R ? `<th class="n">Moving avg rate</th><th class="n">Value / 1 FG</th>` : '') + `<th>Status</th></tr>`;
    tb.replaceChildren(...rows.map(t => { const tr = document.createElement('tr'), rr = R && R[t.code]; if (t.lvl === 1) tr.className = 'l1';
      const val = rr ? t.qty_fg * rr.rate : null, stc = t.status === 'Sub-levels pending' ? 'st-p' : t.status === 'Exploded' ? '' : 'st-r';
      tr.innerHTML = `<td><span class="lv" style="background:${LVC[Math.min(t.lvl - 1, LVC.length - 1)]}">L${t.lvl}</span></td><td style="padding-left:${8 + (t.lvl - 1) * 14}px">${t.code}</td><td>${esc(t.part)}</td><td>${t.parent}</td><td class="n">${qf(t.qty)}</td><td>${esc(t.uom)}</td><td class="n">${qf(t.qty_fg)}</td>` +
        (R ? `<td class="n">${rr ? r2(rr.rate) : '—'}</td><td class="n ${t.lvl > 1 ? 'in' : ''}">${val == null ? '—' : r2(val)}</td>` : '') +
        `<td class="${stc}">${esc(t.status)}</td>`;
      if (rr) { tr.addEventListener('mousemove', ev => tip.show(ev, [t.part, `${t.code} · level ${t.lvl} · in ${t.parent}`, `Moving average Rs ${r2(rr.rate)} per ${t.uom} (${rr.basis}, last ${rr.last})`, ...(rr.rate_rcv != null ? [`Latest receipt price Rs ${r2(rr.rate_rcv)} (${rr.rcv_last})`] : []), t.lvl > 1 ? 'Already inside its level-1 parent\'s rate - not added again' : 'Counted in material / unit'])); tr.addEventListener('mouseleave', tip.hide); }
      return tr; }));
    if (!rows.length) empty(box, 'No BOM rows');
  }
  window.__sbRender = render;
  const d0 = window.__draw; if (d0) window.__draw = (...a) => { const r = d0(...a); if (window.__page === 'bom') { try { render(window.__P ? window.__P() : {}); } catch (e) { console.error(e); } } return r; };
  try { if (window.__page === 'bom') render(window.__P ? window.__P() : {}); } catch (e) {}
})();
