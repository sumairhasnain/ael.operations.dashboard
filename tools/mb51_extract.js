window.__MB51=null;window.__MBST='start';(async()=>{try{
const share='https://aipatlas-my.sharepoint.com/:f:/g/personal/umair_mazhar_ael_aiponline_atlas_pk/IgCA3o_g1Ij7ToiQZDU63LNvAbVW11k1t2-sxwbAXLUnbTg';
const enc='u!'+btoa(share).replace(/=+$/,'').replace(/\//g,'_').replace(/\+/g,'-');const base='https://aipatlas-my.sharepoint.com/_api/v2.0/shares/'+enc;
let r=await fetch(base+'/driveItem/children',{headers:{Accept:'application/json'},credentials:'include'});if(r.status!==200){window.__MBST='LIST_'+r.status;return;}
let j=await r.json();let xl=(j.value||[]).filter(f=>/\.xlsx$/i.test(f.name)).sort((a,b)=>new Date(b.lastModifiedDateTime)-new Date(a.lastModifiedDateTime));
if(window.__MBPICK){xl=xl.filter(f=>f.name===window.__MBPICK);}
if(!xl.length){window.__MBST='NO_XLSX';return;}window.__MBFILE=xl[0].name;window.__MBMT=xl[0].lastModifiedDateTime;
const dl=xl[0]['@content.downloadUrl']||xl[0]['@microsoft.graph.downloadUrl'];const ab=await (await fetch(dl,{credentials:'include'})).arrayBuffer();
const buf=new Uint8Array(ab),dv=new DataView(ab);let e=buf.length-22;while(e>0&&dv.getUint32(e,true)!==0x06054b50)e--;const n=dv.getUint16(e+10,true);let off=dv.getUint32(e+16,true);const files={};
for(let i=0;i<n;i++){const me=dv.getUint16(off+10,true),cs=dv.getUint32(off+20,true),nl=dv.getUint16(off+28,true),el=dv.getUint16(off+30,true),cl=dv.getUint16(off+32,true),lo=dv.getUint32(off+42,true);files[new TextDecoder().decode(buf.slice(off+46,off+46+nl))]={me,cs,lo};off+=46+nl+el+cl;}
const unz=async nm=>{const f=files[nm];const lnl=dv.getUint16(f.lo+26,true),lel=dv.getUint16(f.lo+28,true);const d=buf.slice(f.lo+30+lnl+lel,f.lo+30+lnl+lel+f.cs);return f.me===0?new TextDecoder().decode(d):await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();};
const ssx=await unz('xl/sharedStrings.xml');const ss=[...ssx.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join(''));
const sx=await unz('xl/worksheets/sheet1.xml');const cl2=s=>String(s==null?'':s).replace(/[|\n\r]/g,' ').trim();
const dt=x=>{const v=+x;if(v>20000&&v<90000)return new Date(Date.UTC(1899,11,30)+Math.round(v)*864e5).toISOString().slice(0,10);const s=String(x||'');const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[0]:'';};
/* 4 Nov: the daily file's column order changed between October and November, so columns are found by their header names, not letters. 601/602 (sales) are kept for the F.O.M, 261/262 (issues to production orders) for consumption-based cover. */
const want=new Set(['101','102','201','202','601','602','261','262']);const out=[];let H=null,mon='';const rowRe=/<row[^>]*>([\s\S]*?)<\/row>/g;let m;
while((m=rowRe.exec(sx))){const c={};for(const cm of m[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){const col=cm[1],at=cm[2],inr=cm[3]||'';const v=(inr.match(/<v>([\s\S]*?)<\/v>/)||[])[1];const t=/t="s"/.test(at)?ss[+v]:(/t="inlineStr"/.test(at)?(inr.match(/<t[^>]*>([\s\S]*?)<\/t>/)||[])[1]:v);c[col]=t;}
if(!H){H={};for(const k in c)H[cl2(c[k])]=k;const need=['Material','Material Description','Qty in unit of entry','Amt.in Loc.Cur.','Movement Type'];const lack=need.filter(x=>!H[x]);if(lack.length){window.__MBST='HDR_MISSING '+lack.join(',');return;}continue;}
const g=nm=>c[H[nm]];const mt=cl2(g('Movement Type'));if(!want.has(mt))continue;const pd=dt(g('Posting Date')||g('Document Date'));if(pd&&!mon)mon=pd.slice(0,7);
out.push([cl2(g('Material')),cl2(g('Material Description')),cl2(g('Qty in unit of entry')),pd,cl2(g('Amt.in Loc.Cur.')),cl2(g('Cost Center')),cl2(g('Supplier')),mt,cl2(g('Base Unit of Measure')||g('Unit of Entry')),cl2(g('Storage Location')),cl2(g('Plant'))].join('|'));}
window.__MB51='@@MB51\nfile='+xl[0].name+'\nmonth='+mon+'\ncols=Material|Desc|Qty|PostDate|Amt|CC|Supplier|MT|UoM|Sloc|Plant\n'+out.join('\n');
window.__MBST='DONE file='+xl[0].name+' mtime='+xl[0].lastModifiedDateTime+' rows='+out.length+' len='+window.__MB51.length;}catch(err){window.__MBST='ERR '+err;}})();'started'
