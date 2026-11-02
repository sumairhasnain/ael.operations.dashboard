import json, copy
F=json.load(open('../crb_data.json'))['lines']
I=[r for r in json.load(open('/home/claude/ael.operations.dashboard/data/cr_ideas.json')) if not r.get('fin_only')]
OLD={}
for r in json.load(open('/home/claude/ael.operations.dashboard/data/cr_ideas.json')):
    if r.get('fin_only'): OLD.setdefault((r['item'],r['model'],r['fin_target'],r['fin_unit']),[]).append(r['key'])
MN=['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun']
ym=lambda i:('2026-' if i<6 else '2027-')+['07','08','09','10','11','12','01','02','03','04','05','06'][i]
M={('CL-01','CD70'):[52],('CL-02','CD70'):[56],('CL-03','CD70'):[57],('CL-04','CD70'):[60],('CL-05','CD70'):[53],
 ('PR-01','All models'):[15,20],  # PR-03 is a new idea, not in the Finance budget (Umair, 2 Nov); lines 16/19 stay Finance-only
 ('IC-01','All models'):[69,75,81],('IC-02','All models'):[71,77,82],('IC-03','All models'):[72,78],('IC-04','CG125'):[76],
 ('IC-06','CD70'):[70],('IC-06','Pridor'):[84],('IC-07','CD70'):[73],('IC-07','Pridor'):[83],
 ('PI-01','CD70'):[35],('PI-01','CG125'):[43],('PI-01','Pridor'):[50],('PI-02','CD70'):[32],('PI-02','CG125'):[39],('PI-02','Pridor'):[47],
 ('PI-03','CD70'):[31],('PI-03','CG125'):[38],('PI-03','Pridor'):[45],('PI-04','CD70'):[37],('PI-06','CD70'):[34],('PI-06','CG125'):[42],('PI-06','Pridor'):[49],
 ('PI-07','CG125'):[41],('PI-09','Pridor'):[46],
 ('CB-01','CD70'):[0],('CB-02','CD70'):[1],('CB-03','CD70'):[2],('CB-06','CG125'):[3],('CB-07','CG125'):[6],('CB-08','CG125'):[7],('CB-09','CG125'):[8],
 ('CI-01','All models'):[104,106,109],('CI-02','Pridor'):[110],('CI-03','Pridor'):[111],('CI-04','CG125'):[105],('CI-05','Pridor'):[107],('CI-06','Pridor'):[108],
 ('HP-01','All models'):[24,29],('HP-02','CG125'):[(27,'Nov')],('HP-03','CG125'):[(26,'Dec')],('HP-05','CG125'):[(27,'May')],('HP-07','CG125'):[(26,'Jun')],
 ('HP-04','All models'):[23,28],('HP-06','All models'):[25,30]}
used=set()
def parts(spec):
    out=[]
    for s in spec:
        j,mon=(s if isinstance(s,tuple) else (s,None)); f=F[j]
        nz=[i for i,v in enumerate(f['months']) if v]
        if mon: i=MN.index(mon); used.add((j,i)); out.append((f['model'],f['months'][i],i))
        else:
            for i in nz: used.add((j,i))
            out.append((f['model'],f['months'][nz[0]],nz[0]) if len(nz)==1 else (f['model'],f['months'][nz[0]],nz[0],len(nz)))
    return out
fmt=lambda v:('%g'%v)
for r in I:
    sp=M.get((r['key'],r['model']))
    if not sp: r['fin_target']=None;r['fin_unit']=None;r['fin_detail']='Not in the Finance CR budget';continue
    p=parts(sp)
    r['fin_unit']=round(p[0][1],2) if len({x[1] for x in p})==1 else round(sum(x[1] for x in p)/len(p),2)
    r['fin_target']=ym(min(x[2] for x in p))
    r['fin_detail']='Finance: '+'; '.join(f"{x[0]} Rs {fmt(x[1])} from {MN[x[2]]}"+(f" (booked {x[3]}×)" if len(x)>3 else '') for x in p)
    if r['model']!='All models' and any(x[0]!=r['model'] for x in p): r['fin_detail']+=' (Finance books it on another model)'
SH={'Carburetor':'Carburetor','Plate Clutch':'Press Shop','HPDC':'HPDC / Die Cast','Piston':'Piston','Clutch':'Clutch','Ignition Coil Shop':'Ignition Coil','Cast Iron Products':'CIF Machining','Hub':'Hubs','Drum Gear Shift  Shop':'Drum Gear','Cushion':'Cushion','Case Bottom Machining':'Case Bottom Machining','GDC':'GDC','Oil Pump':'Oil Pump'}
CT={'Resourcing':'Resource','Localization':'Localize','Commonization':'Commonize','Automation':'Automation','Re-Use':'ReUse','Re-use':'ReUse','Reduce':'Reduce'}
extra=[];n=0
for j,f in enumerate(F):
    nz=[i for i,v in enumerate(f['months']) if v]
    left=[i for i in nz if (j,i) not in used]
    if not left: continue
    n+=1; i=left[0]
    q=['Q1','Q1','Q1','Q2','Q2','Q2','Q3','Q3','Q3','Q4','Q4','Q4'][i]
    extra.append({'key':f'FIN-{n:02d}','shop':SH.get(f['shop'],f['shop'].strip()),'dash_shop':SH.get(f['shop'],f['shop'].strip()),'model':f['model'],'model_label':f['model'],'part':'','item':f['desc'].replace('  ',' ').strip(),
      'item_type':'','category':CT.get(f['type'],f['type']),'how':f"{f['type']} · from the Finance CR budget 2026-27",'target':None,'status':'Finance only','cr_unit':None,'cr_unit_plan':None,
      'monthly_pkr':0,'fy_pkr':0,'investment_pkr':None,'payback':None,'before':'','after':'','source':'Finance CR budget 2026-27','slide':None,'note':'Not on the dashboard idea list','annual_pkr':0,'quarter':q,'fy':'FY 2026-27',
      'fin_only':1,'fin_unit':round(f['months'][i],2),'fin_target':ym(i),'fin_detail':'Finance: '+'; '.join(f"{f['model']} Rs {fmt(f['months'][k])} in {MN[k]}" for k in left)})
print(len(extra), sum(1 for r in I if r.get('fin_unit') is not None),'of',len(I),'matched')
for e in extra: print(e['key'],e['shop'],e['model'],e['item'][:40],e['fin_unit'],e['fin_target'])
ALL=[k for v in OLD.values() for k in v]; nx=max(int(k[4:]) for k in ALL); newk=[]
for e in extra:
    v=OLD.get((e['item'],e['model'],e['fin_target'],e['fin_unit']))
    if v: e['key']=v.pop(0)
    else: nx+=1; e['key']=f'FIN-{nx:02d}'; newk.append(e['key'])
print('new keys',newk)
json.dump(I+extra,open('cr_ideas_fin.json','w'),ensure_ascii=False,separators=(',',':'))
