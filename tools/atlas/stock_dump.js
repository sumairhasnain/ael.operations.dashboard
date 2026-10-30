// Run in the Atlas tab after atlas_dump.js. Returns a text dump starting with @@STOCK:
// child-part stock vs safety (Stock feed + part master) and vendor schedule vs receipts (Receiving feed).
const strip = c => String(c).replace(/^0+/, '');
const now = new Date(Date.now() + 5 * 3600e3); const m = now.toISOString().slice(0, 7);
const F = await (await fetch('/ppc-feeds?month=' + m, { headers: { Accept: 'application/json' }, cache: 'no-store' })).json();
/* 30 Oct: use the stock Atlas's BAPI refresh just pulled (bapi_refresh.js), not the server cache. */
if (window.__BAPI_STOCK && window.__BAPI_STOCK.length) { F.feeds.stock.items = window.__BAPI_STOCK; F.feeds.stock.info = { asOf: new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10).split('-').join('') }; }
const st = {}; (F.feeds.stock.items || []).forEach(x => { st[strip(x.Material)] = x; });
const clean = s => String(s || '').replace(/[|\n]/g, '/');
const P = S.parts.map(p => { const x = st[p.code] || {}; return [p.code, p.shop || '', p.cls || '', Math.round(+x.SafetyStock || +p.safety || 0), Math.round(+x.Qty || 0), Math.round(+x.VendorStock || 0), clean(p.desc)].join('|'); });
const vn = {}; (F.feeds.rcv.items || []).forEach(x => { vn[strip(x.VendorCode)] = clean(x.VendorName); });
const g = {}; const add = (vc, mc) => { vc = strip(vc); const k = vc + '|' + mc; return g[k] = g[k] || { n: vn[vc] || vc, s: 0, r: 0 }; };
((S.schedule[m] || {}).rows || []).forEach(r => { add(r.vendor, strip(r.part)).s += +r.qty || 0; });
const RM = aggRcvMap(); Object.entries(RM).forEach(([code, byV]) => Object.entries(byV).forEach(([vc, bd]) => { let t = 0; Object.entries(bd).forEach(([d, q]) => { if (d.startsWith(m)) t += +q || 0; }); if (t) add(vc, strip(code)).r += t; }));
const V = Object.entries(g).map(([k, o]) => [k, o.n, Math.round(o.s), Math.round(o.r)].join('|'));
const rdates = (F.feeds.rcv.items || []).map(x => x.Date).sort();
const sAsOf = String((F.feeds.stock.info || {}).asOf || ''); const stockAsOf = sAsOf.length === 8 ? sAsOf.slice(0, 4) + '-' + sAsOf.slice(4, 6) + '-' + sAsOf.slice(6) : (rdates.slice(-1)[0] || '');
['@@STOCK', 'month=' + m, 'stock_asof=' + stockAsOf, 'rcv_to=' + (rdates.slice(-1)[0] || ''), 'lastRcvDay=' + ((S.schedule[m] || {}).lastRcvDay || 26), '##PARTS', ...P, '##VEND', ...V, '##PSTK', ...(F.feeds.stock.items || []).map(x => strip(x.Material) + '|' + Math.round(+x.Qty || 0) + '|' + Math.round(+x.SafetyStock || 0))].join('\n')
