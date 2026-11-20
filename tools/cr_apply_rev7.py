import json, base64, copy, sys
R='/home/claude/ael.operations.dashboard/data/cr_ideas.json'; SL='/home/claude/ael.operations.dashboard/data/cr_slides.json'
ideas=json.load(open(R)); slides=json.load(open(SL)); before=copy.deepcopy(ideas)
B={5:'78a0ef777d4d867fa31973a79fab2c4e',6:'3d9c6c23edc1cca3ebee9de63d711388',7:'aa5021b3d50449dea2ee01d8f192f652',11:'0e9ff1e9af3354ce5fef33dd8c9ed520',12:'b74d3be427169552886e9586cf199b76',15:'d59967de209357c6336f49d47d1ef26f',16:'6d44555052da7ad8d95230a45d683209',19:'51e5569e6397d55493d2f9f29bb45314',20:'63f56269cdda1daea219f0494a398a73',22:'c24e7327c5f680bceb89fa2d84154ce6',23:'f1cec93fc5c2541bb6291bb31ec0cc02',26:'aa4a0500355ae8cd504bc2fbb5d81f24',27:'d1b55fcb7497fd0cc0725ddd3cbb915f',28:'419ae97ccf2c91ee60b1be9ec9905536',32:'6cf6b7f2a1a5fa6307c86a21a128e9ed',33:'70d870eb31b11c372cbb53c0da73a7fe',34:'e5f23fe8d58a5d686df3d66a73d061df',35:'66efcf3912fc914781b492ddd16f4a7b'}
CAP={5:'Conversion cost',6:'Summary',7:'Idea pictures',11:'Summary',12:'Idea pictures',15:'Summary',16:'Idea pictures',19:'Summary',20:'Idea pictures',22:'Summary',23:'Idea pictures',26:'Conversion cost',27:'Summary',28:'Idea pictures',32:'Conversion cost',33:'Summary',34:'Idea pictures',35:'All shops summary'}
SHOP_SL={'Piston':[6,7,5],'CIF Machining':[11,12],'HPDC / Die Cast':[15,16],'Polymer':[19,20],'SKP':[22,23],'Carburetor':[27,28,26],'Clutch':[33,34,32]}
SRC='CC deck rev7 (17 Nov 2026)'
for n in B:
    nm=f'r7-{n}'; src='data:image/jpeg;base64,'+base64.b64encode(open(f'/home/claude/cr20/sl/{nm}.jpg','rb').read()).decode()
    slides[:]=[x for x in slides if x['name']!=nm]+[{'name':nm,'src':src}]
def sl(group): return [[f'r7-{n}',f'{CAP[n]}: CC deck rev7, slide {n}',B[n]] for n in SHOP_SL[group]+[35]]
def q(t): m=int(t[5:7]); return 'Q'+str(((m-7)%12)//3+1)
# key, model, target, status, planCR, actualCR, monthly Rs, FY Rs
M=[('Piston',[('PI-01','CD70','2026-07','Completed',.89,.89,.07e6,.85e6),('PI-02','CD70','2026-09','Completed',.6,.6,.05e6,.58e6),('PI-04','CD70','2026-10','Completed',21.5,21.5,1.72e6,15.48e6),
  ('PI-03','CD70','2026-12','In Progress',.3,None,.02e6,.17e6),('PI-06','CD70','2027-06','Pending',.1,None,.01e6,.01e6),('PI-05','CD70','2027-04','Pending',24,None,1.92e6,5.76e6),
  ('PI-01','CG125','2026-07','Completed',.89,.89,.05e6,.56e6),('PI-02','CG125','2026-09','Completed',.6,.6,.03e6,.37e6),('PI-03','CG125','2026-12','In Progress',.3,None,.02e6,.11e6),
  ('PI-07','CG125','2027-03','Pending',1.9,None,.10e6,.40e6),('PI-06','CG125','2027-06','Pending',.1,None,.01e6,.01e6),
  ('PI-01','Pridor','2026-07','Completed',.89,.89,.01e6,.09e6),('PI-02','Pridor','2026-09','Completed',.6,.6,.005e6,.06e6),('PI-08','Pridor','2026-08','Completed',3,3,.02e6,.26e6),
  ('PI-09','Pridor','2026-12','In Progress',1.6,None,.01e6,.09e6),('PI-03','Pridor','2026-12','In Progress',.3,None,.002e6,.02e6),('PI-06','Pridor','2027-06','Pending',.1,None,.001e6,.001e6)]),
 ('CIF Machining',[('CI-01',None,'2026-10','In Progress',.65,None,84e3,756e3),('CI-02',None,'2026-08','Completed',3.6,3.6,30e3,355e3),('CI-05',None,'2027-01','Pending',.4,None,3e3,43e3),('CI-06',None,'2026-07','Completed',.6,.6,5e3,65e3)]),
 ('HPDC / Die Cast',[('HP-01',None,'2026-08','Completed',.15,.15,32e3,380e3),('HP-02',None,'2026-11','In Progress',1.8,None,36e3,430e3),('HP-03',None,'2026-12','In Progress',2.8,None,70e3,840e3),('HP-04',None,'2027-01','Pending',.14,None,30e3,350e3),
  ('HP-05',None,'2027-05','Pending',2,None,110e3,1.32e6),('HP-06',None,'2027-05','Pending',.2,None,44e3,530e3),('HP-07',None,'2027-06','Pending',3,None,75e3,900e3)]),
 ('Polymer',[('PO-01',None,'2027-01','In Progress',.05,None,30e3,180e3),('PO-02',None,'2026-07','Completed',1.5,1.5,60e3,750e3),('PO-03',None,'2027-02','In Progress',7.69,None,17e3,120e3),('PO-04',None,'2026-07','Completed',31,31,5e3,60e3),
  ('PO-05',None,'2026-12','In Progress',.3,None,190e3,1.52e6),('PO-06',None,'2026-12','In Progress',.04,None,25e3,200e3),('PO-07',None,'2026-12','In Progress',27,None,135e3,810e3)]),
 ('Carburetor',[('CB-01',None,'2026-09','Completed',7.49,7.49,.59e6,5.39e6),('CB-02',None,'2026-08','Completed',.5,.5,.04e6,.40e6),('CB-03',None,'2026-09','Completed',.7,.7,.05e6,.50e6),('CB-04',None,'2026-12','In Progress',.65,None,.05e6,.32e6),
  ('CB-05',None,'2027-01','Pending',1.0,None,.08e6,.40e6),('CB-06',None,'2026-09','Completed',10.53,10.53,.52e6,4.73e6),('CB-07',None,'2026-09','Completed',.8,.8,.04e6,.36e6),('CB-08',None,'2026-09','Completed',1.2,1.2,.06e6,.54e6),('CB-09',None,'2027-04','Pending',1.0,None,.05e6,.10e6)]),
 ('Clutch',[('CL-02',None,'2026-08','Completed',1.58,1.58,.14e6,1.4e6),('CL-13',None,'2026-10','Completed',4.25,4.25,.14e6,1.19e6),('CL-05',None,'2027-06','Pending',.81,None,.077e6,.077e6),('CL-14',None,'2027-02','Pending',.91,None,.065e6,.26e6),('CL-12',None,'2026-08','Completed',2.67,2.67,.16e6,1.6e6)])]
log=[]
def close(a,b): # deck figure is rounded; keep the precise existing figure when it rounds to the deck one
    if not a or not b: return False
    for dp in (3,2,1,0):
        if round(b,-int(len(str(int(b)))-1-dp+1) if False else 0)==0: pass
    return abs(a-b)/b < 0.06
def fset(r,k,v,ch):
    if r.get(k)!=v: ch.append(f"{k} {r.get(k)} → {v}"); r[k]=v
for shop,rows in M:
    for key,mod,t,st,pl,ac,mo,fy in rows:
        m=[r for r in ideas if r['key']==key and (mod is None or r['model']==mod)]; assert len(m)==1,(key,mod,len(m)); r=m[0]; ch=[]
        fset(r,'target',t,ch); fset(r,'quarter',q(t),ch); fset(r,'status',st,ch)
        fset(r,'cr_unit',pl,ch); fset(r,'cr_unit_plan',None,ch); fset(r,'cr_unit_act',ac,ch)
        mo=r['monthly_pkr'] if close(r['monthly_pkr'],mo) else round(mo)
        fset(r,'monthly_pkr',mo,ch); fset(r,'fy_pkr',round(fy),ch); fset(r,'annual_pkr',round(mo*12),ch)
        r['source']=SRC; r['slide']=SHOP_SL[shop][0]; r['slides']=sl(shop); r['upd']={'file':'AEL_Production_CC_17.11.2026_rev7.pptx'}
        log.append((key,r['model'],ch))
pi7=[r for r in ideas if r['key']=='PI-07'][0]
if pi7.get('investment_pkr')!=5e6: log.append(('PI-07','CG125',[f"investment {pi7.get('investment_pkr')} → 5000000, payback 3.2 years"])); pi7['investment_pkr']=5000000; pi7['payback']='3.2 years'
# new ideas
fin={r['key']:r for r in ideas if r.get('fin_only')}
def fmerge(keys): rs=[fin[k] for k in keys]; return dict(fin_unit=rs[0]['fin_unit'],fin_target=rs[0]['fin_target'],fin_detail='; '.join(x['fin_detail'] for x in rs))
def new(key,shop,model,label,part,item,itype,cat,how,t,st,pl,ac,mo,fy,grp,fk=()):
    r={'key':key,'shop':shop,'dash_shop':shop,'model':model,'model_label':label,'part':part,'item':item,'item_type':itype,'category':cat,'how':how,'target':t,'status':st,
       'cr_unit':pl,'cr_unit_plan':None,'cr_unit_act':ac,'monthly_pkr':round(mo),'fy_pkr':round(fy),'annual_pkr':round(mo*12),'investment_pkr':None,'payback':None,'before':'','after':'',
       'source':SRC,'slide':SHOP_SL[grp][0],'slides':sl(grp),'note':'','quarter':q(t),'fy':'FY 2026-27','fin_unit':None,'fin_target':None,'fin_detail':'Not in the Finance CR budget',
       'upd':{'file':'AEL_Production_CC_17.11.2026_rev7.pptx'}}
    if fk: r.update(fmerge(fk))
    ideas.append(r); log.append((key,model,['NEW']+(['Finance lines '+', '.join(fk)+' folded in'] if fk else [])))
new('SK-01','Oil Pump','CG125','CG125','Oil Pump','Part sitting pad','Spare','ReUse','Reuse of part sitting pad (machine spare)','2026-09','Pending',.25,None,15e3,190e3,'SKP')
new('SK-02','GDC','All models','All models','Case Bottom (GDC)','Melting furnace Lummi partition board','Spare','Localize','Local manufacturing of furnace partition board','2026-07','Completed',.11,.11,44e3,530e3,'SKP',('FIN-42','FIN-47'))
new('SK-03','Case Bottom Machining','All models','CD70 / CG125','Case Bottom (Machining)','BTA bar machining tool','Tool','Localize','Local manufacturing of BTA bar','2026-09','Completed',.11,.11,34e3,400e3,'SKP',('FIN-41','FIN-46','FIN-51'))
new('SK-04','Oil Pump','CG125','CG125','Oil Pump','Kira machining jig','Spare','Localize','Localization of Kira machine jig','2027-03','In Progress',.4,None,27e3,330e3,'SKP',('FIN-52',))
new('SK-05','Cushion','All models','All models','Cushion Assy','Multi-spindle washing machine','Machine','Automation','Multi-spindle washing machine','2026-12','In Progress',1.0,None,150e3,1.8e6,'SKP')
new('CL-16','Clutch','All models','All models','Broaching','Broaching machine robot','Machine','Automation','Manpower optimization on broaching (robot)','2027-01','In Progress',1.68,None,253e3,1.5e6,'Clutch')
ideas[:]=[r for r in ideas if r['key'] not in ('FIN-41','FIN-42','FIN-46','FIN-47','FIN-51','FIN-52')]
json.dump(ideas,open(R,'w'),ensure_ascii=False,separators=(',',':')); json.dump(slides,open(SL,'w'),ensure_ascii=False,separators=(',',':'))
json.dump(log,open('/home/claude/cr20/r7_log.json','w'),indent=0)
for k,m,c in log: print(k,m,'|','; '.join(c) or 'no change')
print(len(ideas), sum(len(x['src']) for x in slides))
