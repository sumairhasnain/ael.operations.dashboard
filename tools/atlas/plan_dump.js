await (async()=>{
// SAP mode (5 Nov 2026). Run in the Atlas tab (critical-part-planning). Needs only the page's own data (S), not the SAP bridge.
// Builds the '@@PLAN' text atlas_from_sap.py reads and keeps it in window.__PLAN: plan days per code (fg / ih / sales),
// vendor schedules, Atlas working days, part master, vendor names, OSP vendors and the Problems list.
const strip = c => String(c).replace(/^0+/, '');
const clean = s => String(s == null ? '' : s).replace(/[|\n\r]/g, '/').trim();
const now = new Date(Date.now() + 5 * 3600e3); const m = now.toISOString().slice(0, 7);
const months = Object.keys(S.schedule || {}).sort().slice(-5); if (!months.includes(m)) months.push(m);
const pl = (S.plans || {})[m] || {};
const L = [];
Object.entries(pl.fg || {}).forEach(([c, o]) => L.push('fg|' + strip(c) + '|' + (o.days || []).map(x => Math.round(+x || 0)).join(',')));
Object.entries(pl.ih || {}).forEach(([c, o]) => L.push('ih|' + strip(c) + '|' + (o.days || []).map(x => Math.round(+x || 0)).join(',')));
Object.entries(pl.salesPlan || {}).forEach(([c, o]) => L.push('sp|' + strip(c) + '|' + (o.days || []).map(x => Math.round(+x || 0)).join(',')));
const SC = []; months.forEach(mm => ((S.schedule[mm] || {}).rows || []).forEach(r => { const q = Math.round(+r.qty || 0); if (q) SC.push([mm, strip(r.vendor), strip(r.part), q].join('|')); }));
const W = months.map(mm => { const [y, mo] = mm.split('-').map(Number); const rec = S.schedule[mm] || {}; const dim = new Date(y, mo, 0).getDate(); const lrd = Math.min(rec.lastRcvDay || dim, dim);
  const d = []; for (let i = 1; i <= lrd; i++) if (typeof isWorking !== 'function' || isWorking(y, mo, i, mm)) d.push(i); return mm + '|' + d.join(','); });
const P = (S.parts || []).map(p => [strip(p.code), p.shop || '', p.cls || '', Math.round(+p.safety || 0), clean(p.desc), clean(p.cat)].join('|'));
const V = (S.vendors || []).map(v => strip(v.code) + '|' + clean(v.sapName || v.name));
const O = Object.entries(S.ospVendors || {}).map(([c, v]) => strip(c) + '|' + strip(v));
const ISS = (S.problems || []).map((p, i) => [i + 1, p.item, p.shop || '', p.priority || '', p.status || '', p.meeting || '', (p.problem || '').replace(/\s+/g, ' ').slice(0, 260), (p.note || '').slice(0, 120)].map(x => String(x).replace(/[|\n]/g, '/')).join('|'));
window.__PLAN = ['@@PLAN', 'month=' + m, 'lastRcvDay=' + ((S.schedule[m] || {}).lastRcvDay || 26), 'months=' + months.join(','), 'uploadedAt=' + (pl.uploadedAt || ''),
  '##PLAN', ...L, '##SCH', ...SC, '##W', ...W, '##PARTS', ...P, '##V', ...V, '##OSP', ...O, '##ISS', ...ISS].join('\n');
})(); 'PLAN ready: ' + window.__PLAN.length + ' chars'
