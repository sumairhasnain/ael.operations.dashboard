/* Atlas feeds still updating while /ppc-daily is down (Umair, 9 Nov 2026). Run in the Atlas tab (read-only GET).
   Leaves '@@AFEED' text in window.__AFEED for tools/atlas_feed_merge.py: ##M asof, ##P code|MTD production,
   ##S code|MTD sales, ##R date|code|vendor|receipt|schedule. */
await (async () => { const m = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 7);
  const j = await (await fetch('/ppc-feeds?month=' + m, { headers: { Accept: 'application/json' }, cache: 'no-store' })).json(), F = j.feeds || {}, st = c => String(c).replace(/^0+/, '');
  const a = String(((F.prod || {}).info || {}).asOf || ''), asof = a.length === 8 ? a.slice(0, 4) + '-' + a.slice(4, 6) + '-' + a.slice(6) : '';
  window.__AFEED = ['@@AFEED', '##M', 'asof=' + asof, 'prod_updated=' + ((F.prod || {}).updated_at || ''), 'rcv_updated=' + ((F.rcv || {}).updated_at || ''),
    '##P', ...((F.prod || {}).items || []).map(x => st(x.Material) + '|' + (+x.Qty || 0)), '##S', ...((F.sales || {}).items || []).map(x => st(x.Material) + '|' + (+x.Qty || 0)),
    '##R', ...((F.rcv || {}).items || []).map(x => [String(x.Date).slice(0, 10), st(x.Material), st(x.VendorCode), +x.Receipt || 0, +x.Schedule || 0].join('|'))].join('\n'); })();
'AFEED ready ' + window.__AFEED.length
