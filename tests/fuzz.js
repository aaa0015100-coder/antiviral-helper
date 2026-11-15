// 組合模擬：node tests/fuzz.js [模組…]（tx px drug res dose search）只印失敗摘要
const {load,mk,txt}=require('./harness');
const file=process.argv.find(a=>a.endsWith('.html'));
const {A}=load(file); const set=mk(A);
const MODS=process.argv.slice(2).filter(a=>!a.endsWith('.html')); const on=m=>!MODS.length||MODS.includes(m);
const BAD=/undefined|NaN|\[object|Infinity|null(?![\w-])|\{(?:KG|AC|BX)/;
let n=0; const fails=[];
const F=(lab,o,m)=>fails.push([lab,o,m]);
const PTS={none:{},norm:{pt:{age:40,sex:"M",wt:70,ht:175,scr:0.9}},c35:{pt:{age:72,sex:"M",wt:60,ht:165,scr:1.6}},c8:{pt:{age:80,sex:"F",wt:45,ht:150,scr:4.5}},obese:{pt:{age:45,sex:"F",wt:110,ht:158,scr:0.7}},
  m25:{pt:{method:"crcl",crcl:25}},e45:{pt:{method:"egfr",egfr:45}},hd:{pt:{method:"hd"}},pd:{pt:{method:"pd"}},crrt:{pt:{method:"crrt"}},noWt:{pt:{method:"crcl",crcl:40}}};
const cards=h=>h.split(/<div class="opt(?: primary)?">/).slice(1);
const drugsIn=h=>[...h.matchAll(/data-act="go-drug" data-v="(\w+)"/g)].map(m=>m[1]);
function run(lab,o,tab,inv){
  set(o); let h; try{ h=A.render(tab); }catch(e){ F(lab,o,"EXC "+e.message); return; }
  n++; const t=txt(h);
  const m=t.match(BAD); if(m) F(lab,o,"BAD "+t.slice(Math.max(0,m.index-40),m.index+40));
  if(/<\d/.test(h.replace(/<\/?\w[^>]*>/g,""))) F(lab,o,"未轉義的 <數字");
  // 懷孕：列出禁忌藥時一定有懷孕提醒與標示；未勾懷孕時不出現懷孕標示
  const ds=drugsIn(h), x=ds.filter(k=>A.D[k].preg&&A.D[k].preg.l==="x");
  if(o.preg&&x.length&&!/class="note danger"><b>懷孕：/.test(h)) F(lab,o,"懷孕禁忌藥沒有提醒 "+x.join(","));
  if(o.preg&&x.length&&(h.match(/孕：不建議/g)||[]).length<x.length) F(lab,o,"懷孕禁忌藥沒有逐藥標示");
  if(!o.preg&&/孕：不建議|孕：注意/.test(h)) F(lab,o,"未勾懷孕卻有懷孕標示");
  // 每張方案卡都要看得到療程（劑量內含天數／單次，或另有療程列）
  if(tab!=="drug") cards(h).forEach((c,i)=>{ if(!/class="dur|天|週|單次|個月|單日/.test(c.replace(/<button[^>]*data-act="go-drug"[^>]*>.*?<\/button>/g,""))) F(lab,o,"方案卡缺療程 #"+i+" "+txt(c).slice(0,40)); });
  const e=inv&&inv(t,h,ds); if(e) F(lab,o,e);
}
// 臨床不變式
const INV={
  flu(o,t,h,ds){ const c=cards(h);
    if((o.set==="inp"||o.set==="icu"||o.set==="ic")&&!/oseltamivir/.test(c[0]||"")) return "住院／重症／免疫低下第一張不是 oseltamivir";
    if((o.set==="inp"||o.set==="icu"||o.set==="ic")&&ds.includes("bx")) return "住院或嚴重免疫低下列出 baloxavir";
    if(o.set==="lr"&&o.t==="gt48"&&c.length) return "非高風險 >48 小時仍列藥";
    if(o.set==="hr"&&!/首選/.test(c[0]||"")) return "高風險第一張不是首選"; },
  covid(o,t,h,ds){ const c=cards(h);
    if(o.sev==="amb"&&(o.risk==="low"||o.day==="gt7")&&c.length) return "低風險或 >7 天仍列藥";
    if(o.sev==="amb"&&o.day==="d7"&&o.risk!=="low"&&(ds.includes("pax")||ds.includes("mol")||ds.includes("ens"))) return "6–7 天仍列 5 天內才能用的口服藥";
    if(o.sev==="amb"&&o.day==="d5"&&o.risk!=="low"&&!/nirmatrelvir/.test(c[0]||"")) return "≤5 天第一張不是 nirmatrelvir";
    if(o.sev==="mv"&&ds.includes("rdv")) return "插管仍列 remdesivir 卡";
    if((o.sev==="o2"||o.sev==="hf")&&!ds.includes("rdv")) return "用氧未列 remdesivir"; },
  hse(o,t){ if(o.k==="conf"&&!/14–21 天/.test(t)) return "確診 HSE 缺 14–21 天"; if(o.k==="ic"&&!/21 天/.test(t)) return "免疫低下缺 21 天"; },
  cmvdis(o,t,h){ const c=cards(h); if(o.sev==="sev"&&!/ganciclovir IV/.test(txt(c[0]||""))) return "重度第一張不是 IV ganciclovir"; if(o.sev==="mild"&&!/valganciclovir/.test(txt(c[0]||""))) return "輕中度第一張不是 valganciclovir"; },
  hz(o,t){ if(!/72 小時|盡早/.test(t)) return "缺給藥時機"; },
  hbvtx(o,t,h,ds){ const c=cards(h); if(o.c==="dec"&&!/ent_1|1 mg/.test(h+t)) return "失代償缺 entecavir 1 mg"; if(o.c==="dec"&&!/peginterferon/.test(t)) return "失代償缺 peginterferon 禁用"; if(o.c==="no"&&o.p==="lo"&&c.length) return "低病毒量正常 ALT 仍列藥"; if((o.c!=="no"||o.p!=="lo")&&!c.length) return "應治療卻無方案"; if(o.c==="no"&&o.p==="gz"&&!/7 kPa/.test(t)||o.c==="no"&&o.p==="gz"&&!/8 kPa/.test(t)) return "灰色地帶缺 VCTE 7／8 kPa 衝突"; },
  hbvstop(o,t,h,ds){ if(ds.length) return "停藥情境列藥"; if(o.c==="cir"&&!/不停藥/.test(t)) return "肝硬化缺不停藥"; },
  hcvtx(o,t,h,ds){ if(o.st==="dc"&&(ds.includes("mav")||ds.includes("vox"))) return "失代償列蛋白酶抑制劑方案"; if(o.st==="dc"&&!(ds.includes("svl")&&ds.includes("rib"))) return "失代償缺 sofosbuvir/velpatasvir＋ribavirin"; if(o.st!=="dc"&&ds.includes("rib")) return "非失代償列 ribavirin"; if(o.st==="exp"&&!ds.includes("vox")) return "再治療缺 voxilaprevir"; if(!/HBsAg/.test(t)) return "缺 HBV 篩檢提醒"; },
  rsv(o,t,h,ds){ if(o.host==="gen"&&ds.length) return "一般成人 RSV 列藥"; }
};
const PINV={
  hbvpx(o,t,h,ds){ const c=cards(h); if(o.s==="sag"&&!c.length) return "HBsAg 陽性未列預防"; if(o.s==="core"&&o.t==="o"&&c.length) return "低風險 anti-HBc 陽性仍列預防"; if(o.s==="core"&&o.t==="b"&&!c.length) return "anti-HBc 陽性＋anti-CD20 未列預防"; if(ds.includes("rib")) return "HBV 預防列 ribavirin"; },
  cmvsot(o,t,h,ds){ if(o.sero==="nn"&&ds.includes("vgc")) return "D−/R− 列 valganciclovir"; if(o.sero!=="nn"&&!ds.includes("vgc")) return "缺 valganciclovir 預防"; if(ds.includes("let")&&!(o.org==="kid"&&o.sero==="dr")) return "letermovir 出現在非腎 D+/R−"; },
  flupep(o,t,h,ds){ if(ds.includes("per")) return "peramivir 用於預防"; },
  cmvhsct(o,t,h,ds){ if(!/HSV／VZV 活性/.test(t)) return "缺 letermovir 無 HSV 活性提醒"; }
};
if(on("tx")) for(const x of A.DX) for(const o of A.allOpts(x)) for(const [pk,pt] of Object.entries(PTS)) for(const preg of [false,true])
  run(`tx ${x.id} ${JSON.stringify(o)} ${pk}`,Object.assign({tab:"tx",dx:x.id,o:{[x.id]:o},preg},JSON.parse(JSON.stringify(pt))),"tx",(t,h,ds)=>INV[x.id]&&INV[x.id](o,t,h,ds));
if(on("px")) for(const x of A.PX) for(const o of A.allOpts(x)) for(const [pk,pt] of Object.entries(PTS)) for(const preg of [false,true])
  run(`px ${x.id} ${JSON.stringify(o)} ${pk}`,Object.assign({tab:"px",px:x.id,po:{[x.id]:o},preg},JSON.parse(JSON.stringify(pt))),"px",(t,h,ds)=>PINV[x.id]&&PINV[x.id](o,t,h,ds));
if(on("drug")) for(const k of Object.keys(A.D)) for(const [pk,pt] of Object.entries(PTS)) for(const preg of [false,true])
  run(`drug ${k} ${pk}`,Object.assign({tab:"drug",drug:k,preg},JSON.parse(JSON.stringify(pt))),"drug",(t,h)=>{ if(!/各腎功能劑量/.test(h)) return "缺腎功能表"; if(pk==="hd"&&!/<tr class="cur"><td>HD/.test(h)&&Object.keys(A.REG).some(r=>A.REG[r].d===k&&A.REG[r].hd)) return "HD 未標示目前列"; });
if(on("res")) for(const r of [{id:""}].concat(A.RES)) for(const [pk,pt] of Object.entries(PTS)) for(const preg of [false,true])
  run(`res ${r.id} ${pk}`,Object.assign({tab:"res",res:r.id,preg},JSON.parse(JSON.stringify(pt))),"res",(t,h)=>{ if((h.match(/data-act="res-k"/g)||[]).length!==A.RES.length) return "抗藥清單數量不對"; if(r.id&&!/改用/.test(t)) return "展開缺改用"; });
if(on("dose")){
  for(const [id,g] of Object.entries(A.REG)){
    for(let i=1;i<g.b.length;i++) if(!(g.b[i][0]<g.b[i-1][0])) F("dose "+id,{},"分段門檻未遞減");
    if(g.b[g.b.length-1][0]!==0) F("dose "+id,{},"最後一段不是 0");
    const vals=g.unit==="kg"?[0,0.3,0.4,0.45,0.5,0.55,0.6,0.7,0.8,0.9,1,1.2,1.4,1.5,2]:[0,5,9.99,10,10.01,15,20,24,25,25.01,29,30,30.01,39,40,49,50,50.01,55,55.01,59,60,60.01,69,70,90,130];
    for(const v of vals){ const o=g.unit==="kg"?{pt:{age:20,sex:"M",wt:72,scr:+(120/(72*v||1)).toFixed(3),method:v?"cg":"crcl",crcl:v?null:0}}:{pt:{method:"crcl",crcl:v,wt:70}};
      set(o); n++; let d; try{ d=A.doseOf(id); }catch(e){ F("dose "+id+" "+v,o,"EXC "+e.message); continue; }
      if(BAD.test(d.plain)||BAD.test(d.band)) F("dose "+id+" "+v,o,"BAD "+d.plain+" | "+d.band);
      const exp=g.b.find(x=>(g.unit==="kg"?120/(72*(+(120/(72*v||1)).toFixed(3))):v)>=x[0]);
      if(v>0&&exp&&!A.fillW(exp[1]).startsWith(d.plain.slice(0,8))) F("dose "+id+" "+v,o,"分段錯誤 "+d.plain); }
    for(const m of ["hd","pd","crrt"]){ set({pt:{method:m,wt:70}}); n++; const d=A.doseOf(id); if(BAD.test(d.plain)) F("dose "+id+" "+m,{},"BAD "+d.plain); }
  }
  // 臨床抽查
  const chk=(id,o,re,why)=>{ set(o); n++; const d=A.doseOf(id); if(!re.test(d.plain)) F("spot "+id,o,why+"："+d.plain); };
  chk("cdv",{pt:{method:"crcl",crcl:50}},/禁止/,"CrCl 50 cidofovir 應禁止");
  chk("cdv",{pt:{method:"crcl",crcl:60,wt:70}},/5 mg\/kg/,"CrCl 60 cidofovir 可用");
  chk("ose_tx",{pt:{method:"crcl",crcl:60}},/30 mg BID/,"CrCl 60 oseltamivir 應 30 mg BID");
  chk("ose_tx",{pt:{method:"crcl",crcl:61}},/75 mg BID/,"CrCl 61 oseltamivir 75 mg BID");
  chk("ose_tx",{pt:{method:"hd"}},/每次 HD 後 30 mg/,"HD oseltamivir");
  chk("val_hz",{pt:{method:"crcl",crcl:49}},/1 g q12h/,"CrCl 49 valacyclovir 1 g q12h");
  chk("gcv_ind",{pt:{method:"crcl",crcl:69,wt:60}},/2\.5 mg\/kg q12h ≈ 150 mg/,"CrCl 69 ganciclovir");
  chk("vgc_ind",{pt:{method:"crcl",crcl:24}},/450 mg QOD/,"CrCl 24 valganciclovir 誘導");
  chk("acv_iv10",{pt:{method:"crcl",crcl:50,wt:70}},/q12h ≈ 700 mg/,"CrCl 50 acyclovir q12h");
  chk("acv_iv10",{pt:{age:45,sex:"F",wt:110,ht:158,scr:0.7}},/IBW.*AdjBW/,"肥胖 acyclovir 並列 IBW 與 AdjBW");
  chk("bx_tx",{pt:{wt:85}},/80 mg/,"≥80 kg baloxavir 80 mg");
  chk("bx_tx",{pt:{wt:60}},/40 mg/,"60 kg baloxavir 40 mg");
  chk("fos_cmv",{pt:{age:60,sex:"M",wt:70,scr:1.0}},/70 mg\/kg q12h/,"foscarnet 1.11 mL/min/kg");
  chk("pax",{pt:{method:"crcl",crcl:59}},/150 mg/,"CrCl 59 Paxlovid 減量");
  chk("pax",{pt:{method:"hd"}},/HD 後/,"HD Paxlovid");
  chk("rdv5",{pt:{method:"hd"}},/200 mg/,"HD remdesivir 不調整");
}
if(on("search")){
  const q=(s,re)=>{ n++; const h=A.searchHits(s).map(x=>x.n).join("|"); if(!re.test(h)) F("search "+s,{},"找不到："+h); };
  q("paxlovid",/nirmatrelvir/); q("entecavir",/entecavir/); q("B 型",/B 型肝炎/); q("hcv",/HCV/); q("hbv",/HBV/); q("紓伏效",/baloxavir/); q("帶狀",/帶狀疱疹/); q("cmv",/CMV/); q("letermovir",/letermovir/); q("水痘",/水痘/); q("克巨染",/maribavir/);
}
const by={}; for(const f of fails){ const k=f[0].split(" ").slice(0,2).join(" ")+" | "+String(f[2]).slice(0,100); (by[k]=by[k]||[]).push(f); }
console.log("FUZZ TOTAL",n,"FAILS",fails.length);
for(const [k,v] of Object.entries(by).slice(0,40)) console.log(v.length+"× "+k+"\n  e.g. "+v[0][0].slice(0,140));
if(fails.length) process.exit(1);
