import math
XPT=[0,0];t=0
for l in range(1,120):
    t+=math.floor(l+300*2**(l/7)); XPT.append(math.floor(t/4)*12)
def lvl(x):
    L=1
    while L<99 and x>=XPT[L+1]: L+=1
    return L
print("XP needed: L10 %d, L15 %d, L20 %d, L30 %d, L50 %d, L65 %d, L75 %d, L85 %d, L99 %d"%tuple(XPT[i] for i in [10,15,20,30,50,65,75,85,99]))
ORES={'cu':(1,1.0,5,2),'sn':(5,.95,7,3),'fe':(12,.85,10,5),'ni':(20,.8,13,7),'co':(28,.7,17,9),'si':(33,.65,19,4),'fc':(40,.55,24,15),'ti':(50,.4,30,20),'gr':(58,.35,36,30),'cr':(65,.3,40,12),'pd':(75,.22,50,45),'nu':(85,.1,75,1)}
# pure-mining hours to level, best XP ore available
x=0;h=0;out={}
while lvl(x)<99:
    L=lvl(x); best=max(o[2] for o in ORES.values() if o[0]<=L)
    x+=best*1200/60; h+=1/60
    for tgt in [12,20,30,50,75,85,99]:
        if lvl(x)>=tgt and tgt not in out: out[tgt]=h
print("Pure mining hours to level:",{k:round(v) for k,v in out.items()})
# Home-colony loop sim: mine copper+tin 50/50 (or iron/nickel later), refine, craft fittings/plating, donate at home
def fee(rep,f0=.6):
    r=0
    while r<10 and rep>=25000*(r+1)**2: r+=1
    return f0-(f0-.1)*r/10, r
xp={'m':0,'r':0,'c':0}; rep=0; T=0; marks={}
kitm=1.0
while T<2000 and fee(rep)[1]<10:
    f,r=fee(rep); mL=lvl(xp['m']); rL=lvl(xp['r']); cL=lvl(xp['c'])
    if mL>=12 and kitm<1.1: kitm=1.1
    if mL>=28 and kitm<1.2: kitm=1.2
    if mL>=50: kitm=1.3
    mom=1.25 if mL>=10 else 1.0
    yl=(1+.02*(mL-1))*kitm*mom*(1-f)*(1-.075)  # avg depletion
    # pick product chain by level: bronze->fittings ; steel->plating; costeel->hull
    if rL>=30 and mL>=28 and cL>=30: # hull: 2 steel + 2 costeel ; costeel=1 steel+2 co ; steel=2fe+1ni
        ores={'fe':8,'ni':4,'co':4}; bars=[(4,25),(2,45)]; craft=(1,95,360)  # per hull: 4 steel(2 direct+2 in costeel)
    elif rL>=15 and mL>=20 and cL>=10:
        ores={'fe':4,'ni':2}; bars=[(2,25)]; craft=(1,35,90)
    else:
        ores={'cu':2,'sn':2}; bars=[(2,10)]; craft=(1,15,30)
    # time to mine one unit of product
    mt=sum(n/(ORES[o][1]*yl)*3 for o,n in ores.items()); mx=sum(n/(ORES[o][1]*yl)*ORES[o][2] for o,n in ores.items())
    rt=sum(n*2/(1+.02*(rL-1)) for n,_ in bars); rx=sum(n*x for n,x in bars)
    ct=3/(1+.02*(cL-1)); cx=craft[1]
    dt=mt+rt+ct
    units=3600/dt  # per hour
    xp['m']+=mx*units; xp['r']+=rx*units; xp['c']+=cx*units
    rep+=0.8*craft[2]*units; T+=1
    for k in range(1,11):
        if fee(rep)[1]>=k and ('rank%d'%k) not in marks: marks['rank%d'%k]=(T,lvl(xp['m']),lvl(xp['r']),lvl(xp['c']))
    for s,nm in [('r',15),('c',10)]:
        key=s+str(nm)
        if lvl(xp[s])>=nm and key not in marks: marks[key]=T
print("Donate-everything home loop (hours, M/R/C levels at rank):")
for k,v in marks.items(): print(" ",k,v)
print("after",T,"h levels M/R/C:",lvl(xp['m']),lvl(xp['r']),lvl(xp['c']),"rep",round(rep))
# Oil chain step-by-step estimate
f=.6; y=1*(1-f)
print("Step1: 600cu+600sn at 60%% fee ~ %.1f h"%((600/(1*y)+600/(.95*y))*3/3600))
