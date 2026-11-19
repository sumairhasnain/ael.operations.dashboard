/* 19 Nov 2026 (Umair): quality movements for the Quality tab. Run in a signed-in SharePoint tab with window.__QPICK = exact MB51 file name.
   Keeps 101/102 (lots), 122/123 (return to vendor), 321/322 (QI release), 349/350 (QI to blocked), 343/344 (blocked <-> unrestricted),
   551-556 (scrap), 311/312 (transfers, incl. into the rejection stores) and 701/702, with every quality-relevant column the file has.
   Leaves gzip+base64 '@@MB51Q' text in window.__GZQ (status in window.__QST). Read-only. */
window.__GZQ=null;window.__QST='start';(async()=>{try{
const share='https://aipatlas-my.sharepoint.com/:f:/g/personal/umair_mazhar_ael_aiponline_atlas_pk/IgCA3o_g1Ij7ToiQZDU63LNvAbVW11k1t2-sxwbAXLUnbTg';
const enc='u!'+btoa(share).replace(/=+$/,'').replace(/\//g,'_').replace(/\+/g,'-');const base='https://aipatlas-my.sharepoint.com/_api/v2.0/shares/'+enc;
const j=await (await fetch(base+'/driveItem/children',{headers:{Accept:'application/json'},credentials:'include'})).json();const F=(j.value||[]).find(x=>x.name===window.__QPICK);if(!F){window.__QST='NO_FILE';return;}
const ab=await (await fetch(F['@content.downloadUrl'],{credentials:'include'})).arrayBuffer();
const buf=new Uint8Array(ab),dv=new DataView(ab);let e=buf.length-22;while(e>0&&dv.getUint32(e,true)!==0x06054b50)e--;const n=dv.getUint16(e+10,true);let off=dv.getUint32(e+16,true);const files={};
for(let i=0;i<n;i++){const me=dv.getUint16(off+10,true),cs=dv.getUint32(off+20,true),nl=dv.getUint16(off+28,true),el=dv.getUint16(off+30,true),cl=dv.getUint16(off+32,true),lo=dv.getUint32(off+42,true);files[new TextDecoder().decode(buf.slice(off+46,off+46+nl))]={me,cs,lo};off+=46+nl+el+cl;}
const unz=async nm=>{const f=files[nm];const lnl=dv.getUint16(f.lo+26,true),lel=dv.getUint16(f.lo+28,true);const d=buf.slice(f.lo+30+lnl+lel,f.lo+30+lnl+lel+f.cs);return f.me===0?new TextDecoder().decode(d):await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();};
const ssx=await unz('xl/sharedStrings.xml');const ss=[...ssx.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join(''));
const sx=await unz('xl/worksheets/sheet1.xml');const cl=s=>String(s==null?'':s).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/[|\n\r]/g,' ').trim();
const dt=x=>{const v=+x;if(v>20000&&v<90000)return new Date(Date.UTC(1899,11,30)+Math.round(v)*864e5).toISOString().slice(0,10);const m=String(x||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[0]:'';};
const tm=x=>{const v=+x;if(isFinite(v)&&v>=0&&v<1){const s=Math.round(v*86400);return String(Math.floor(s/3600)).padStart(2,'0')+':'+String(Math.floor(s%3600/60)).padStart(2,'0');}return cl(x).slice(0,5);};
const COLS=['Material','Material Description','Qty in unit of entry','Base Unit of Measure','Movement Type','Plant','Storage Location','Receiving stor. loc.','Posting Date','Entry Date','Time of Entry','Supplier','Name 1','Amt.in Loc.Cur.','Reference','Text','Batch','Material Document','Material Doc.Item','Reason for Movement','Purchase order','Cost Center','Order','User Name','Document Header Text'];
const want=new Set(['101','102','122','123','321','322','349','350','343','344','551','552','553','554','555','556','311','312','701','702']);
const out=[];let H=null;const rowRe=/<row[^>]*>([\s\S]*?)<\/row>/g;let m;
while((m=rowRe.exec(sx))){const c={};for(const cm of m[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){const at=cm[2],inr=cm[3]||'';const v=(inr.match(/<v>([\s\S]*?)<\/v>/)||[])[1];c[cm[1]]=/t="s"/.test(at)?ss[+v]:(/t="inlineStr"/.test(at)?(inr.match(/<t[^>]*>([\s\S]*?)<\/t>/)||[])[1]:v);}
 if(!H){H={};for(const k in c)H[cl(c[k])]=k;continue;}const g=x=>H[x]?c[H[x]]:'';const mt=cl(g('Movement Type'));if(!want.has(mt))continue;
 out.push(COLS.map(x=>/Date/.test(x)&&x!=='Document Header Text'?dt(g(x)):(x==='Time of Entry'?tm(g(x)):cl(g(x)))).join('|'));}
const txt='@@MB51Q\nfile='+F.name+'\nmtime='+F.lastModifiedDateTime+'\nhave='+COLS.filter(x=>H[x]).join(',')+'\ncols='+COLS.join('|')+'\n'+out.join('\n');
const gz=new Uint8Array(await new Response(new Blob([txt]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());let b='';for(let i=0;i<gz.length;i+=32768)b+=String.fromCharCode.apply(null,gz.subarray(i,i+32768));window.__GZQ=btoa(b);
window.__QST='DONE '+F.name+' rows='+out.length+' gz='+window.__GZQ.length;}catch(err){window.__QST='ERR '+err;}})();'started'
