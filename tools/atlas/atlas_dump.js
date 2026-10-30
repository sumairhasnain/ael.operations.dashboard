// Run in the Atlas tab (https://atlas.aipportals.com/critical-part-planning) after confirming it is logged in.
// Re-arms the 30-minute keep-alive and returns a text dump starting with @@REFRESH.
if (window.__keepAlive) clearInterval(window.__keepAlive);
window.__keepAlive = setInterval(() => { fetch('/critical-part-planning', { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' }).catch(() => {}); }, 30 * 60 * 1000);
const strip = c => String(c).replace(/^0+/, '');
const now = new Date(Date.now() + 5 * 3600e3); const m = now.toISOString().slice(0, 7);
const nd = new Date(+m.slice(0, 4), +m.slice(5), 0).getDate();
const j = await (await fetch('/ppc-daily?month=' + m, { headers: { Accept: 'application/json' } })).json(); const pl = S.plans[m] || {};
const act = arr => { const res = {}; let prev = {}; (arr || []).forEach(sn => { const d = +sn.date.slice(8); Object.entries(sn.cum).forEach(([c, v]) => { c = strip(c); res[c] = res[c] || new Array(nd).fill(0); res[c][d - 1] = Math.max(0, (+v || 0) - (prev[c] || 0)); prev[c] = +v || 0; }); }); return res; };
/* /ppc-daily only holds snapshots up to the last cache; SAP's live BAPI has today's posted quantities. Add (or replace) today's snapshot with the live figures. */
const today = now.toISOString().slice(0, 10); const bItems = async u => { const x = await bapiFetch(u); return (x && x.Items) ? x.Items : (Array.isArray(x) ? x : []); };
const cfgP = S.ppcCfg || {}; let liveNote = 'none';
for (const [k, u] of [['prod', cfgP.prodUrl], ['sales', cfgP.salesUrl]]) { try { const arr = j.daily[k] = j.daily[k] || []; const lastD = (arr.slice(-1)[0] || {}).date || ''; if (u && lastD <= today && today.startsWith(m)) { const it = await bItems(u + '?Date=' + today.split('-').join('')); if (it.length) { const cum = {}; it.forEach(x => { cum[strip(x.Material)] = (cum[strip(x.Material)] || 0) + (+x.Qty || 0); }); if (lastD === today) arr[arr.length - 1] = { date: today, cum }; else arr.push({ date: today, cum }); liveNote = today; } } } catch (e) { liveNote = 'err ' + e; } }
/* Self-heal (22 Oct): if Atlas's cached snapshot for a day has a lower month-to-date total than the day before (SAP returned bad figures on 21 Oct), re-read that day from SAP. */
/* 29 Oct: Atlas caches each day's snapshot early in the day, so late postings (and postings back-dated to the day before) are missed. Re-read the last 3 cached days from SAP live and use them when they hold more. */
for (const [k, u] of [['prod', cfgP.prodUrl], ['sales', cfgP.salesUrl]]) { const arr = j.daily[k] || []; const sum = o => Object.values(o.cum || {}).reduce((a, b) => a + (+b || 0), 0); for (const s of arr.slice(-4)) { if (!u || s.date === today) continue; try { const it = await bItems(u + '?Date=' + s.date.split('-').join('')); if (it.length) { const cum = {}; it.forEach(x => { cum[strip(x.Material)] = (cum[strip(x.Material)] || 0) + (+x.Qty || 0); }); if (sum({ cum }) > sum(s)) { s.cum = cum; liveNote += ' ' + k + s.date.slice(8); } } } catch (e) {} } }
let healed = [];
for (const [k, u] of [['prod', cfgP.prodUrl], ['sales', cfgP.salesUrl]]) { const arr = j.daily[k] || []; for (let i = 1; i < arr.length; i++) { const sum = o => Object.values(o.cum || {}).reduce((a, b) => a + (+b || 0), 0); if (u && sum(arr[i]) < 0.97 * sum(arr[i - 1])) { try { const it = await bItems(u + '?Date=' + arr[i].date.split('-').join('')); if (it.length) { const cum = {}; it.forEach(x => { cum[strip(x.Material)] = (cum[strip(x.Material)] || 0) + (+x.Qty || 0); }); if (Object.values(cum).reduce((a, b) => a + b, 0) >= 0.97 * sum(arr[i - 1])) { arr[i] = { date: arr[i].date, cum }; healed.push(k + ' ' + arr[i].date); } } } catch (e) {} } } }
const AP = act(j.daily.prod), AS = act(j.daily.sales);
const P = {}; Object.entries(pl.fg || {}).forEach(([c, o]) => P[strip(c)] = o.days); Object.entries(pl.ih || {}).forEach(([c, o]) => { c = strip(c); if (!P[c]) P[c] = o.days; });
const SP = {}; Object.entries(pl.salesPlan || {}).forEach(([c, o]) => SP[strip(c)] = o.days);
const merge = { '9010118004': '9010118003', '9010118005': '9010118003', '9010118006': '9010118003', '9020118002': '9020118003', '9030118001': '9030118000' };
const pt = new Set(['9010118003', '9020118003', '9090218002', '9090218001', '9070331000']);
const by = {}; new Set([...Object.keys(P), ...Object.keys(AP), ...Object.keys(SP), ...Object.keys(AS)]).forEach(c0 => { const c = merge[c0] || c0; const o = by[c] = by[c] || [0, 1, 2, 3].map(() => Array(nd).fill(0)); [P[c0], AP[c0], SP[c0], AS[c0]].forEach((a, k) => (a || []).forEach((x, i) => { if (i < nd) o[k][i] += (+x || 0); })); });
const enc = a => { let b = a.map(x => Math.round(x)); while (b.length && !b[b.length - 1]) b.pop(); return b.join(','); };
const lines = []; Object.entries(by).forEach(([c, v]) => { if (pt.has(c)) v[1] = v[3].slice(); const s = v.map(enc); if (s.every(x => !x)) return; lines.push([c, ...s].join('|')); });
/* 27 Oct: on page load Atlas fills its receipts from a saved copy that can lag days behind. Re-read SAP live (as Atlas's own BAPI refresh does, Company=AEL) and use it when it holds at least as much as the saved copy, so receipts never go backwards. */
let rcvNote = 'saved';
try { const ru = ((S.rcvCfg || {}).url || '').trim(); if (ru && typeof setRcv === 'function') { const x = await bapiFetch(ru + '?FDate=' + m.split('-').join('') + '01&TDate=' + today.split('-').join('') + '&Company=AEL'); const li = (x && x.Items) ? x.Items : (Array.isArray(x) ? x : []);
  const sum = a => a.reduce((t, b) => t + (+b.Receipt || 0), 0); const codes = typeof partCodeSet === 'function' ? partCodeSet() : null; const mine = codes ? li.filter(b => codes.has(String(b.Material || '').replace(/^0+/, ''))) : li;
  if (li.length && sum(mine) >= sum(rcvData || [])) { setRcv(li); rcvNote = 'live'; } else rcvNote = 'saved (live lower or empty)'; } } catch (e) { rcvNote = 'saved (live err)'; }
const M = aggRcvMap(); const rl = []; Object.entries(M).forEach(([code, byV]) => { const a = Array(nd).fill(0); Object.values(byV).forEach(bd => Object.entries(bd).forEach(([dt, q]) => { if (dt.startsWith(m)) a[+dt.slice(8) - 1] += q; })); const e = enc(a); if (e) rl.push(code + '|' + e); });
const sch = {}; ((S.schedule[m] || {}).rows || []).forEach(r => { sch[r.part] = (sch[r.part] || 0) + (+r.qty || 0); });
const iss = S.problems.map((p, i) => [i + 1, p.item, p.shop || '', p.priority || '', p.status || '', p.meeting || '', (p.problem || '').replace(/\s+/g, ' ').slice(0, 260), (p.note || '').slice(0, 120)].map(x => String(x).replace(/[|\n]/g, '/')).join('|'));
const last = ((j.daily.prod || []).slice(-1)[0] || { date: m + '-01' }).date;
['@@REFRESH', 'asof=' + last, 'live=' + liveNote + ' rcv=' + rcvNote + (healed.length ? ' healed=' + healed.join(',') : ''), 'lastRcvDay=' + ((S.schedule[m] || {}).lastRcvDay || 26), '##PD', ...lines, '##RCV', ...rl, '##SCH', ...Object.entries(sch).map(([k, v]) => k + '|' + Math.round(v)), '##ISS', ...iss].join('\n')
