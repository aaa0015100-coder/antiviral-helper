// 快照：固定情境下各分頁的文字片段（排序後比對）。node tests/snap.js [--update]
const fs=require('fs'),path=require('path');
const {load,mk}=require('./harness');
const {A}=load(process.argv.find(a=>a.endsWith('.html'))); const set=mk(A);
const frags=h=>h.split(/<[^>]+>/).map(s=>s.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/\s+/g," ").trim()).filter(Boolean);
const PT={none:{},c35:{pt:{age:72,sex:"M",wt:60,ht:165,scr:1.6,method:"cg"}},hd:{pt:{age:60,sex:"F",wt:55,method:"hd"}}};
const out=[];
function snap(label,o,tab){ set(o); let h; try{ h=A.render(tab); }catch(e){ out.push("## "+label+"\nEXC "+e.message); return; } out.push("## "+label+"\n"+[...frags(h)].sort().join("\n")); }
const cp=o=>JSON.parse(JSON.stringify(o));
for(const x of A.DX) for(const o of A.allOpts(x)) for(const pk of Object.keys(PT)) snap(`tx ${x.id} ${JSON.stringify(o)} ${pk}`,Object.assign({tab:"tx",dx:x.id,o:{[x.id]:o}},cp(PT[pk])),"tx");
for(const x of A.PX) for(const o of A.allOpts(x)) for(const pk of Object.keys(PT)) snap(`px ${x.id} ${JSON.stringify(o)} ${pk}`,Object.assign({tab:"px",px:x.id,po:{[x.id]:o}},cp(PT[pk])),"px");
for(const k of Object.keys(A.D)) for(const pk of Object.keys(PT)) snap(`drug ${k} ${pk}`,Object.assign({tab:"drug",drug:k},cp(PT[pk])),"drug");
for(const r of [""].concat(A.RES.map(x=>x.id))) snap(`res ${r}`,Object.assign({tab:"res",res:r},cp(PT.c35)),"res");
snap("tx covid preg",{tab:"tx",dx:"covid",preg:true},"tx"); snap("tx flu preg",{tab:"tx",dx:"flu",preg:true},"tx");
snap("ref",{tab:"ref"},"ref");
const s=out.join("\n")+"\n", f=path.join(__dirname,'snap.txt');
if(process.argv.includes('--update')||!fs.existsSync(f)){ fs.writeFileSync(f,s); console.log("snap written",out.length,"scenarios"); process.exit(0); }
const old=fs.readFileSync(f,'utf8');
if(old===s){ console.log("SNAP OK",out.length); process.exit(0); }
const split=t=>Object.fromEntries(t.split(/^## /m).filter(Boolean).map(b=>{const i=b.indexOf("\n");return [b.slice(0,i),b.slice(i+1)];}));
const a=split(old), b=split(s); let n=0;
for(const k of new Set([...Object.keys(a),...Object.keys(b)])) if(a[k]!==b[k]){ n++; if(n<=12){ const A1=new Set((a[k]||"").split("\n")), B1=new Set((b[k]||"").split("\n")); console.log("≠ "+k); [...A1].filter(x=>!B1.has(x)).slice(0,3).forEach(x=>console.log("  − "+x.slice(0,120))); [...B1].filter(x=>!A1.has(x)).slice(0,3).forEach(x=>console.log("  + "+x.slice(0,120))); } }
console.log("SNAP DIFF",n,"scenarios（確認後用 --update 覆寫）"); process.exit(1);
