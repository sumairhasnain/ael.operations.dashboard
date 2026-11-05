await (async()=>{
// CHECK ATLAS LIVE (5 Nov 2026). Run in the Atlas tab. Read-only probe of the two feeds that failed on 4-5 Nov:
// /ppc-daily (Atlas's daily production/dispatch snapshots) and the SAP bridge (bapiFetch -> /bapi-proxy) for today's
// production and this month's vendor receipts. Never presses "Update server data". Keeps the result in window.__PROBE.
const now = new Date(Date.now() + 5 * 3600e3); const m = now.toISOString().slice(0, 7); const td = now.toISOString().slice(0, 10).split('-').join('');
const res = {};
const t0 = Date.now();
try { const r = await fetch('/ppc-daily?month=' + m, { headers: { Accept: 'application/json' }, cache: 'no-store' }); res.ppc_daily = r.status;
  if (r.ok) { const j = await r.json(); const p = (j.daily || {}).prod || []; res.ppc_daily_last = (p.slice(-1)[0] || {}).date || ''; } } catch (e) { res.ppc_daily = 'err ' + e; }
const items = x => (x && x.Items) ? x.Items : (Array.isArray(x) ? x : []);
const cfgP = S.ppcCfg || {};
try { const it = items(await bapiFetch(cfgP.prodUrl + '?Date=' + td)); res.bapi_prod = 'ok ' + it.length + ' rows'; } catch (e) { res.bapi_prod = 'err ' + e; }
try { const u = ((S.rcvCfg || {}).url || 'https://api.aipportals.com/PowerBI_API/BI_API_Vendor_Sch_Rec').trim();
  const it = items(await bapiFetch(u + '?FDate=' + m.split('-').join('') + '01&TDate=' + td + '&Company=AEL')); res.bapi_rcv = 'ok ' + it.length + ' rows'; } catch (e) { res.bapi_rcv = 'err ' + e; }
try { const F = await (await fetch('/ppc-feeds?month=' + m, { headers: { Accept: 'application/json' }, cache: 'no-store' })).json(); res.feeds_stock_asof = String(((F.feeds || {}).stock || {}).info?.asOf || ''); } catch (e) { res.feeds = 'err ' + e; }
res.ms = Date.now() - t0;
res.live_ok = res.ppc_daily === 200 && /^ok [1-9]/.test(res.bapi_prod) && /^ok [1-9]/.test(res.bapi_rcv);
window.__PROBE = res;
})(); JSON.stringify(window.__PROBE)
