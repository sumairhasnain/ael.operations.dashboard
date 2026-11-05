// Run in a tab on aipatlas-my.sharepoint.com (any page of that site). Downloads the attendance workbook and returns an '@@ATT' text dump
// aggregated by area/section/day, then (after ##P) per-person monthly totals for the Manpower tab's hover list.
const u = 'https://aipatlas-my.sharepoint.com/:x:/g/personal/umair_mazhar_ael_aiponline_atlas_pk/IQCCR9WWxhwsQZ2sblEVP6OJAX9Urmsf_sDdY9KQxPhxtIk?download=1';
const ab = await (await fetch(u, { credentials: 'include' })).arrayBuffer(); const buf = new Uint8Array(ab); const dv = new DataView(ab);
let eocd = buf.length - 22; while (eocd > 0 && dv.getUint32(eocd, true) !== 0x06054b50) eocd--;
const n = dv.getUint16(eocd + 10, true); let off = dv.getUint32(eocd + 16, true); const files = {};
for (let i = 0; i < n; i++) { const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), lo = dv.getUint32(off + 42, true); files[new TextDecoder().decode(buf.slice(off + 46, off + 46 + nl))] = { method, csize, lo }; off += 46 + nl + el + cl; }
const unz = async name => { const f = files[name]; const lnl = dv.getUint16(f.lo + 26, true), lel = dv.getUint16(f.lo + 28, true); const data = buf.slice(f.lo + 30 + lnl + lel, f.lo + 30 + lnl + lel + f.csize); if (f.method === 0) return new TextDecoder().decode(data); return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text(); };
const wb = await unz('xl/workbook.xml'), rels = await unz('xl/_rels/workbook.xml.rels');
const target = nm => { const id = (wb.match(new RegExp('<sheet [^>]*name="' + nm + '"[^>]*r:id="([^"]+)"')) || [])[1]; const t = (rels.match(new RegExp('Id="' + id + '"[^>]*Target="([^"]+)"')) || rels.match(new RegExp('Target="([^"]+)"[^>]*Id="' + id + '"')) || [])[1]; return 'xl/' + t.replace(/^\/?xl\//, ''); };
const ssx = files['xl/sharedStrings.xml'] ? await unz('xl/sharedStrings.xml') : ''; const ss = [...ssx.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''));
const grid = async path => { const x = await unz(path); const rows = {}; for (const m of x.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) { const [, col, r, attrs, inner] = m; if (!inner) continue; const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1]; const t = /t="inlineStr"/.test(attrs) ? (inner.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] : (/t="s"/.test(attrs) ? ss[+v] : v); if (t !== undefined) (rows[r] = rows[r] || {})[col] = t; } return rows; };
const R = await grid(target('Record')), O = await grid(target('Overtime'));
const ci = c => c.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
const norm = s => (s || '?').toUpperCase().replace(/\s+/g, ' ').trim().replace(/^PISTON SHOP$/, 'PISTON');
const ser = v => { const n = +v; return n > 40000 ? new Date(Date.UTC(1899, 11, 30) + n * 864e5).toISOString().slice(0, 10) : null; };
const agg = {}; const K = (a, s, d) => agg[a + '|' + s + '|' + d] = agg[a + '|' + s + '|' + d] || { hc: 0, p: 0, a: 0, l: 0, off: 0, oth: 0, ot: 0, otn: 0 };
const hdr = g => Object.entries(g['2'] || {}).filter(([c, v]) => ci(c) >= 8 && ser(v)).map(([c, v]) => [c, ser(v)]);
hdr(R).forEach(([col, d]) => Object.entries(R).forEach(([r, c]) => { if (+r < 4 || !c.D) return; const o = K(norm(c.E), norm(c.F), d); o.hc++; const v = String(c[col] || '').trim().toUpperCase();
  if (v === 'P') o.p++; else if (v === 'P/2' || v === 'HD') { o.p += .5; o.a += .5; } else if (v === 'A') o.a++; else if (v === 'L') o.l++; else if (v === 'OFF') o.off++; else if (v && v !== '-') o.oth++; }));
hdr(O).forEach(([col, d]) => Object.entries(O).forEach(([r, c]) => { if (+r < 4 || !c.D) return; const h = parseFloat(c[col]); if (!(h > 0)) return; const o = K(norm(c.E), norm(c.F), d); o.ot += h; o.otn++; }));
const lines = Object.entries(agg).filter(([k, o]) => o.p || o.a || o.l || o.ot).map(([k, o]) => [k, o.hc, o.p, o.a, o.l, o.off, o.oth, Math.round(o.ot * 10) / 10, o.otn].join('|'));
/* 28 Oct (Umair): per-person monthly totals for the Manpower tab's hover list (names are fine to show). P / A / L on working days only (Sundays skipped), overtime on all days. */
const sun = d => new Date(d + 'T00:00:00Z').getUTCDay() === 0, cl = s => String(s || '').replace(/[|\n\r]/g, '/').replace(/\s+/g, ' ').trim();
const pp = {}; const PK = (c, m) => { const k = cl(c.C) + '|' + cl(c.D).toUpperCase().replace(/[^A-Z]/g, '') + '|' + norm(c.E) + '|' + m; /* EMP IDs repeat across areas, so ID + name + area */ return pp[k] = pp[k] || { m, id: cl(c.C), n: cl(c.D), a: norm(c.E), s: norm(c.F), g: cl(c.G), p: 0, ab: 0, l: 0, ot: 0, otd: 0, dy: {} }; };
const rms = [...new Set(hdr(R).map(([, d]) => d.slice(0, 7)))]; Object.entries(R).forEach(([r, c]) => { if (+r >= 4 && c.D) rms.forEach(m => PK(c, m)); });
hdr(R).forEach(([col, d]) => { if (sun(d)) return; Object.entries(R).forEach(([r, c]) => { if (+r < 4 || !c.D) return; const v = String(c[col] || '').trim().toUpperCase(); if (!v || v === '-') return; const o = PK(c, d.slice(0, 7));
  if (v === 'P') o.p++; else if (v === 'P/2' || v === 'HD') { o.p += .5; o.ab += .5; (o.dy[d] = o.dy[d] || [0, 0])[0] += .5; } else if (v === 'A') { o.ab++; (o.dy[d] = o.dy[d] || [0, 0])[0] += 1; } else if (v === 'L') o.l++; }); });
hdr(O).forEach(([col, d]) => Object.entries(O).forEach(([r, c]) => { if (+r < 4 || !c.D) return; const h = parseFloat(c[col]); if (!(h > 0)) return; const o = PK(c, d.slice(0, 7)); o.ot += h; o.otd++; (o.dy[d] = o.dy[d] || [0, 0])[1] += h; }));
/* 28 Oct (Umair): overtime while absent. Per person and month: overtime hours in weeks (Mon-Sun) with an absence, absent days in weeks with overtime, and days marked absent that also carry overtime */
const wk = d => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - (t.getUTCDay() + 6) % 7); return t.toISOString().slice(0, 10); };
Object.values(pp).forEach(o => { const W = {}; o.sd = 0; Object.entries(o.dy).forEach(([d, [a, h]]) => { const w = W[wk(d)] = W[wk(d)] || [0, 0]; w[0] += a; w[1] += h; if (a > 0 && h > 0) o.sd++; });
  o.otw = 0; o.abw = 0; Object.values(W).forEach(([a, h]) => { if (a > 0 && h > 0) { o.otw += h; o.abw += a; } }); });
const people = Object.values(pp).map(o => [o.m, o.id, o.n, o.a, o.s, o.g, o.p, o.ab, o.l, Math.round(o.ot * 10) / 10, o.otd, Math.round(o.otw * 10) / 10, o.abw, o.sd].join('|'));
'@@ATT\nn=' + lines.length + '\n' + lines.join('\n') + '\n##P\n' + people.join('\n')
