window.__MB52=null;window.__MB52ST='start';(async()=>{try{
// SAP mode (5 Nov 2026). Run in a SharePoint tab (aipatlas-my.sharepoint.com) that is signed in. Reads the newest .xlsx in the MB52
// folder (read-only) and keeps '@@MB52' pipe text in window.__MB52 for tools/mb52_build.py: one line per storage-location line
// holding any stock, both plants. Columns are found by header name. If the share API answers 401, open
// https://aipatlas-my.sharepoint.com/personal/umair_mazhar_ael_aiponline_atlas_pk/_layouts/15/guestaccess.aspx?share=IgBedqvRtkJMR45EMxsWSSTwAb678cM_H3fFRvJLlbnEdYM once and rerun.
const share='https://aipatlas-my.sharepoint.com/:f:/g/personal/umair_mazhar_ael_aiponline_atlas_pk/IgBedqvRtkJMR45EMxsWSSTwAb678cM_H3fFRvJLlbnEdYM';
const enc='u!'+btoa(share).replace(/=+$/,'').replace(/\//g,'_').replace(/\+/g,'-');const base='https://aipatlas-my.sharepoint.com/_api/v2.0/shares/'+enc;
let r=await fetch(base+'/driveItem/children',{headers:{Accept:'application/json'},credentials:'include'});if(r.status!==200){window.__MB52ST='LIST_'+r.status;return;}
let j=await r.json();let xl=(j.value||[]).filter(f=>/\.xlsx$/i.test(f.name)).sort((a,b)=>new Date(b.lastModifiedDateTime)-new Date(a.lastModifiedDateTime));
if(window.__MB52PICK){xl=xl.filter(f=>f.name===window.__MB52PICK);}
if(!xl.length){window.__MB52ST='NO_XLSX';return;}const F=xl[0];
const dl=F['@content.downloadUrl']||F['@microsoft.graph.downloadUrl'];const ac=new AbortController();const to=setTimeout(()=>ac.abort(),120000);
const ab=await (await fetch(dl,{credentials:'include',signal:ac.signal})).arrayBuffer();clearTimeout(to);
const buf=new Uint8Array(ab),dv=new DataView(ab);let e=buf.length-22;while(e>0&&dv.getUint32(e,true)!==0x06054b50)e--;const n=dv.getUint16(e+10,true);let off=dv.getUint32(e+16,true);const files={};
for(let i=0;i<n;i++){const me=dv.getUint16(off+10,true),cs=dv.getUint32(off+20,true),nl=dv.getUint16(off+28,true),el=dv.getUint16(off+30,true),cl=dv.getUint16(off+32,true),lo=dv.getUint32(off+42,true);files[new TextDecoder().decode(buf.slice(off+46,off+46+nl))]={me,cs,lo};off+=46+nl+el+cl;}
const unz=async nm=>{const f=files[nm];if(!f)return '';const lnl=dv.getUint16(f.lo+26,true),lel=dv.getUint16(f.lo+28,true);const d=buf.slice(f.lo+30+lnl+lel,f.lo+30+lnl+lel+f.cs);return f.me===0?new TextDecoder().decode(d):await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();};
const ssx=await unz('xl/sharedStrings.xml');const ss=[...ssx.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join(''));
const sx=await unz('xl/worksheets/sheet1.xml');const cl2=s=>String(s==null?'':s).replace(/[|\n\r]/g,' ').trim();
// header names as SAP exports them; the first one found wins
const C={Plant:['Plant'],Sloc:['Storage Location','Storage location','SLoc'],Group:['Material Group','Material group'],Material:['Material'],Desc:['Material Description','Material description'],
 UoM:['Base Unit of Measure','Base unit of measure','BUn'],Unr:['Unrestricted','Unrestricted Stock'],QI:['Quality Inspection','In Quality Insp.'],Transit:['Transit and Transfer','Stock in transit'],
 Blocked:['Blocked','Blocked Stock'],MatType:['Material Type','Material type','MTyp'],SlocName:['Descr. of Storage Loc.','Storage Location Description','Description of Storage Location']};
const out=[];let H=null;const rowRe=/<row[^>]*>([\s\S]*?)<\/row>/g;let m;const num=x=>{const v=parseFloat(String(x||'').replace(/,/g,''));return isFinite(v)?v:0;};
while((m=rowRe.exec(sx))){const c={};for(const cm of m[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){const col=cm[1],at=cm[2],inr=cm[3]||'';const v=(inr.match(/<v>([\s\S]*?)<\/v>/)||[])[1];const t=/t="s"/.test(at)?ss[+v]:(/t="inlineStr"/.test(at)?(inr.match(/<t[^>]*>([\s\S]*?)<\/t>/)||[])[1]:v);c[col]=t;}
 if(!H){const byName={};for(const k in c)byName[cl2(c[k])]=k;H={};for(const [key,names] of Object.entries(C)){const nm=names.find(x=>byName[x]);if(nm)H[key]=byName[nm];}
  const lack=['Plant','Sloc','Material','Unr'].filter(x=>!H[x]);if(lack.length){window.__MB52ST='HDR_MISSING '+lack.join(',');return;}continue;}
 const g=k=>H[k]?c[H[k]]:'';const u=num(g('Unr')),q=num(g('QI')),t=num(g('Transit')),b=num(g('Blocked'));if(!(u||q||t||b))continue;
 out.push([cl2(g('Plant')),cl2(g('Sloc')),cl2(g('Group')),cl2(g('Material')),cl2(g('Desc')),cl2(g('UoM')),u,q,t,b,cl2(g('MatType')),cl2(g('SlocName'))].join('|'));}
window.__MB52='@@MB52\nfile='+F.name+'\nmtime='+F.lastModifiedDateTime+'\ncols=Plant|Sloc|Group|Material|Desc|UoM|Unr|QI|Transit|Blocked|MatType|SlocName\n'+out.join('\n');
window.__MB52ST='DONE file='+F.name+' mtime='+F.lastModifiedDateTime+' rows='+out.length+' len='+window.__MB52.length;}catch(err){window.__MB52ST='ERR '+err;}})();'started'
