// Run first in the Atlas tab (critical-part-planning). Presses Atlas's own "↻ Refresh" (fresh data from all BAPI feeds,
// bypassing the server cache) and waits until every feed has finished: Production, Sales, Receiving, Stock, daily actuals and OSP/rejection.
// Keeps the fresh stock items in window.__BAPI_STOCK so the dumps use them. Result in window.__BR.
window.__BR = null;
await (async () => { const t0 = Date.now(); window.__BAPI_STOCK = null; const o = { st: _showFetchStatus, ap: applyStockItems, lr: loadRejection, ld: loadDailyActuals }; let msg = null; const ps = [];
  _showFetchStatus = (m, ok) => { msg = m; return o.st(m, ok); };
  applyStockItems = (items, parts) => { window.__BAPI_STOCK = items; return o.ap(items, parts); };
  loadRejection = (...a) => { const p = o.lr(...a); ps.push(p); return p; };
  loadDailyActuals = (...a) => { const p = o.ld(...a); ps.push(p); return p; };
  try { autoFetch(false, null, null, true); while (!(msg && /BAPI refreshed|errors/i.test(msg)) && Date.now() - t0 < 180000) await new Promise(r => setTimeout(r, 500)); await Promise.allSettled(ps); }
  finally { _showFetchStatus = o.st; applyStockItems = o.ap; loadRejection = o.lr; loadDailyActuals = o.ld; }
  /* 30 Oct: the Receiving BAPI sometimes answers empty and Atlas then shows no receipts at all. Re-ask up to 3 times. */
  for (let t = 0; t < 3 && !(rcvData || []).length; t++) { try { const x = await bapiFetch((S.rcvCfg.url || '').trim() + '?FDate=' + S.rcvCfg.from.split('-').join('') + '&TDate=' + S.rcvCfg.to.split('-').join('') + '&Company=AEL'); const li = (x && x.Items) ? x.Items : (Array.isArray(x) ? x : []); if (li.length) { setRcv(li); try { renderAll(); } catch (e) {} } } catch (e) {} if (!(rcvData || []).length) await new Promise(r => setTimeout(r, 5000)); }
  if (!(rcvData || []).length) msg = 'RCV EMPTY ' + msg;
  window.__BR = (msg || 'TIMEOUT') + ' in ' + Math.round((Date.now() - t0) / 1000) + 's'; })();
window.__BR
