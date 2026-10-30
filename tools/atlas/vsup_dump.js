// Run in the Atlas tab (critical-part-planning). Builds a text dump starting with @@VSUP and keeps it in window.__VS:
// vendor names, child-part master with current stock, monthly vendor schedules, Atlas working days, OSP receipts and daily vendor receipts (SAP feed).
const strip = c => String(c).replace(/^0+/, '');
const clean = s => String(s || '').replace(/[|\n]/g, '/').trim();
const months = Object.keys(S.schedule || {}).sort().slice(-5);
const cur = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 7);
if (!months.includes(cur)) months.push(cur);
const vn = {}; (S.vendors || []).forEach(v => { vn[strip(v.code)] = clean(v.sapName); });
const R = [], SC = []; let stockItems = [], stockAsOf = '';
for (const m of months) {
  const F = await (await fetch('/ppc-feeds?month=' + m, { headers: { Accept: 'application/json' }, cache: 'no-store' })).json();
  /* 26 Oct: Atlas's saved receiving feed can lag a few days; for the current month read SAP live the way the Atlas page does (Company=AEL), and fall back to the saved feed if that fails. */
  let rItems = F.feeds.rcv.items || [];
  if (m === cur) { try { const u = ((S.rcvCfg || {}).url || 'https://api.aipportals.com/PowerBI_API/BI_API_Vendor_Sch_Rec').trim(); const td = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10).split('-').join('');
    const x = await bapiFetch(u + '?FDate=' + m.split('-').join('') + '01&TDate=' + td + '&Company=AEL'); const li = (x && x.Items) ? x.Items : (Array.isArray(x) ? x : []); if (li.length >= rItems.length * 0.9) { rItems = li; window.__VS_LIVE = li.length; } } catch (e) { window.__VS_LIVE = 'err ' + e; } }
  rItems.forEach(x => { const v = strip(x.VendorCode); if (x.VendorName) vn[v] = vn[v] || clean(x.VendorName);
    const r = Math.round(+x.Receipt || 0), s = Math.round(+x.Schedule || 0); if (r || s) R.push([x.Date, v, strip(x.Material), r, s].join('|')); });
  if (m === cur) { stockItems = F.feeds.stock.items || []; stockAsOf = String((F.feeds.stock.info || {}).asOf || '');
    /* 30 Oct: prefer the stock from Atlas's BAPI refresh (bapi_refresh.js). */ if (window.__BAPI_STOCK && window.__BAPI_STOCK.length) { stockItems = window.__BAPI_STOCK; stockAsOf = cur === new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 7) ? new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10).split('-').join('') : stockAsOf; } }
  ((S.schedule[m] || {}).rows || []).forEach(r => { const q = Math.round(+r.qty || 0); if (q) SC.push([m, strip(r.vendor), strip(r.part), q].join('|')); });
}
const st = {}; stockItems.forEach(x => { st[strip(x.Material)] = x; });
const P = S.parts.map(p => { const x = st[p.code] || {}; return [p.code, p.shop || '', p.cls || '', Math.round(+x.SafetyStock || +p.safety || 0), Math.round(+x.Qty || 0), Math.round(+x.VendorStock || 0), clean(p.desc)].join('|'); });
/* Outsourced (OSP) receipts: Atlas counts blank-vendor rows of its rejection feed as received (current month, totals only). */
/* 30 Oct: always reload, the page keeps the copy it loaded when opened and misses the day's later OSP postings. */
if (typeof loadRejection === 'function') { try { await loadRejection(); } catch (e) {} }
/* Day-by-day cumulative where Atlas has it (rejDailyCum), else the month total on its own; vendor from Setup (S.ospVendors). */
const O = (typeof rejData !== 'undefined' && rejData ? rejData : []).filter(r => !String(r.v || '') && +r.r > 0).map(r => { const c = strip(r.m);
  const cum = (typeof rejDailyCum !== 'undefined' && rejDailyCum && rejDailyCum[c]) || [];
  return [c, strip((S.ospVendors || {})[c] || (S.ospVendors || {})[r.m] || ''), Math.round(+r.r), cum.map(x => Math.round(+x || 0)).join(',')].join('|'); });
/* Atlas spreads each monthly schedule evenly over its working days up to the last receiving day (calcPart). */
const W = months.map(m => { const [y, mo] = m.split('-').map(Number); const rec = S.schedule[m] || {}; const dim = new Date(y, mo, 0).getDate(); const lrd = Math.min(rec.lastRcvDay || dim, dim);
  const d = []; for (let i = 1; i <= lrd; i++) if (typeof isWorking !== 'function' || isWorking(y, mo, i, m)) d.push(i); return m + '|' + d.join(','); });
window.__VS = ['@@VSUP', 'months=' + months.join(','), 'stock_asof=' + stockAsOf, 'lastRcvDay=' + ((S.schedule[cur] || {}).lastRcvDay || 26), '##V', ...Object.entries(vn).map(([k, v]) => k + '|' + v), '##P', ...P, '##S', ...SC, '##W', ...W, '##O', ...O, '##R', ...R].join('\n');
'VSUP ready: ' + window.__VS.length + ' chars in ' + Math.ceil(window.__VS.length / 200000) + ' chunks'
