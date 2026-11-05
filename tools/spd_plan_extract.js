/* SPD supply plan (Umair, 5 Nov 2026). Run in a signed-in SharePoint tab (aipatlas-my.sharepoint.com) after opening the share
   link once in any tab (that redeems it). Read-only: downloads 'SPD STATUS ...xlsx' (Asif Iqbal's workbook) and returns
   '@@SPD|<length>|<sheet names>' followed by every non-empty cell of every sheet as 'row<TAB>COL=value<TAB>...', one line per row,
   each sheet introduced by '##SHEET <name>'. tools/spd_plan.py reads the 'SPD (<Mon> <yy>)' sheet from it. */
window.__SPD = null; await (async () => {
  const share = 'https://aipatlas-my.sharepoint.com/:x:/g/personal/asif_iqbal_aiponline_atlas_pk/Ea3_lah7UxZIg1d7wD_lmLEB-PfKXSfjCKJ4fbcHdDXBCA';
  const enc = 'u!' + btoa(share).replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
  const r = await fetch('https://aipatlas-my.sharepoint.com/_api/v2.0/shares/' + enc + '/driveItem', { headers: { Accept: 'application/json' }, credentials: 'include' });
  if (r.status !== 200) { window.__SPD = 'META_' + r.status; return; }
  const it = await r.json(); window.__SPDMETA = { name: it.name, mod: it.lastModifiedDateTime };
  const ab = await (await fetch(it['@content.downloadUrl'] || it['@microsoft.graph.downloadUrl'], { credentials: 'include' })).arrayBuffer();
  const buf = new Uint8Array(ab), dv = new DataView(ab); let e = buf.length - 22; while (e > 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  const n = dv.getUint16(e + 10, true); let off = dv.getUint32(e + 16, true); const files = {};
  for (let i = 0; i < n; i++) { const me = dv.getUint16(off + 10, true), cs = dv.getUint32(off + 20, true), nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), lo = dv.getUint32(off + 42, true); files[new TextDecoder().decode(buf.slice(off + 46, off + 46 + nl))] = { me, cs, lo }; off += 46 + nl + el + cl; }
  const unz = async nm => { const f = files[nm]; if (!f) return ''; const lnl = dv.getUint16(f.lo + 26, true), lel = dv.getUint16(f.lo + 28, true); const d = buf.slice(f.lo + 30 + lnl + lel, f.lo + 30 + lnl + lel + f.cs); return f.me === 0 ? new TextDecoder().decode(d) : await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text(); };
  const wb = await unz('xl/workbook.xml'), rels = await unz('xl/_rels/workbook.xml.rels'); const ssx = await unz('xl/sharedStrings.xml');
  const ss = [...ssx.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''));
  const sheets = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map(m => [m[1], m[2]]); const out = [];
  for (const [nm, id] of sheets) { const t = (rels.match(new RegExp('Id="' + id + '"[^>]*Target="([^"]+)"')) || rels.match(new RegExp('Target="([^"]+)"[^>]*Id="' + id + '"')) || [])[1];
    const x = await unz('xl/' + t.replace(/^\/?xl\//, '')); out.push('##SHEET ' + nm);
    for (const rm of x.matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) { const cells = [];
      for (const cm of rm[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) { const inr = cm[3] || ''; const v = (inr.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        const tv = /t="s"/.test(cm[2]) ? ss[+v] : (/t="inlineStr"/.test(cm[2]) ? (inr.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] : v);
        if (tv !== undefined && tv !== '') cells.push(cm[1] + '=' + String(tv).replace(/[\t\n\r]/g, ' ').slice(0, 60)); }
      if (cells.length) out.push(rm[1] + '\t' + cells.join('\t')); } }
  window.__SPDTXT = out.join('\n'); window.__SPD = 'OK';
})(); '@@SPD|' + (window.__SPDTXT || '').length + '|' + JSON.stringify(window.__SPDMETA || {}) + '\n' + (window.__SPDTXT || window.__SPD) + '#'.repeat(200000)
