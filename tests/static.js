// 靜態檢查：外部載入、儲存、lookbehind、寫死色碼、重複 id、doctype／viewport、出處鍵存在且都列在來源頁
const {load,mk}=require('./harness');
const file=process.argv.find(a=>a.endsWith('.html'));
const {A,html}=load(file); const set=mk(A);
const bad=[];
const css=(html.match(/<style>([\s\S]*?)<\/style>/g)||[]).join("\n").replace(/\/\*[\s\S]*?\*\//g,"");
const js=html.match(/<script>([\s\S]*)<\/script>/)[1];
if(/<link[^>]+href=["']?https?:|<script[^>]+src=|<img[^>]+src=["']?https?:|fonts\.googleapis|fonts\.gstatic|@import|\bfetch\(|XMLHttpRequest/.test(html)) bad.push("外部載入或網路請求");
if(/localStorage|sessionStorage|document\.cookie|indexedDB/.test(js)) bad.push("使用瀏覽器儲存");
if(/\(\?<[=!]/.test(js)) bad.push("正規式使用 lookbehind");
if(!/^<!doctype html>/i.test(html)) bad.push("缺 doctype");
if(!/<html lang="zh-Hant">/.test(html)) bad.push("缺 lang");
if(!/viewport-fit=cover/.test(html)) bad.push("viewport 缺 viewport-fit=cover");
if(/<meta name="claude:/.test(html)) bad.push("含 claude: meta");
if(!/const APP_VERSION = "[\d.]+";/.test(js)||!/const CHECKED = "\d{4}-\d{2}-\d{2}";/.test(js)) bad.push("缺 APP_VERSION／CHECKED 常數");
css.split(/[;{}]/).forEach(d=>{ if(/#[0-9a-fA-F]{3,8}\b|rgba?\((?!0,0,0,)/.test(d)&&!/^\s*--[\w-]+\s*:/.test(d)) bad.push("寫死色碼："+d.trim().slice(0,60)); });
if(/(?:color|background)\s*:\s*#[0-9a-fA-F]{3,8}/.test(js)) bad.push("JS 內寫死色碼");
const ids={}; (html.replace(/<script>[\s\S]*<\/script>/,"").match(/\sid="[^"$]+"/g)||[]).forEach(m=>{ids[m]=(ids[m]||0)+1;});
Object.entries(ids).filter(([,n])=>n>1).forEach(([k])=>bad.push("重複 id "+k));
for(const [k,r] of Object.entries(A.REF)) if(!r.s||!r.f) bad.push("REF 缺欄位 "+k);
// 藥物、劑量的出處鍵
for(const [k,d] of Object.entries(A.D)) (d.src||[]).forEach(s=>{ if(!A.REF[s]) bad.push(`D.${k} 出處不存在 ${s}`); });
for(const [k,g] of Object.entries(A.REG)){ if(!A.D[g.d]) bad.push("REG 藥物不存在 "+k); (g.src||[]).forEach(s=>{ if(!A.REF[s]) bad.push(`REG.${k} 出處不存在 ${s}`); }); }
for(const k of Object.keys(A.D)) if(!A.DGRP.some(g=>g[1]===A.D[k].g)) bad.push("藥物未分組 "+k);
// 所有情境的輸出出處鍵存在
const used=new Set(), missing=new Set();
const scan=h=>{ for(const m of h.matchAll(/data-ref="([^"]*)"/g)){ used.add(m[1]); if(!A.REF[m[1]]) missing.add(m[1]); } for(const m of h.matchAll(/data-upd="([^"]*)"/g)) if(!m[1]) missing.add("空的更新說明"); };
const PTS=[{},{pt:{age:72,sex:"M",wt:60,ht:165,scr:1.6,method:"cg"}},{pt:{method:"hd"}}];
for(const pt of PTS) for(const preg of [false,true]){
  for(const x of A.DX) for(const o of A.allOpts(x)){ set(Object.assign({tab:"tx",dx:x.id,o:{[x.id]:o},preg},JSON.parse(JSON.stringify(pt)))); scan(A.render("tx")); }
  for(const x of A.PX) for(const o of A.allOpts(x)){ set(Object.assign({tab:"px",px:x.id,po:{[x.id]:o},preg},JSON.parse(JSON.stringify(pt)))); scan(A.render("px")); }
  for(const k of Object.keys(A.D)){ set(Object.assign({tab:"drug",drug:k,preg},JSON.parse(JSON.stringify(pt)))); scan(A.render("drug")); }
  for(const r of A.RES){ set(Object.assign({tab:"res",res:r.id,preg},JSON.parse(JSON.stringify(pt)))); scan(A.render("res")); }
}
// 更新標籤鍵存在
const jsU=js.match(/upd:"([A-Z0-9]+)"/g)||[]; jsU.forEach(m=>{ const k=m.slice(5,-1); if(!A.UPDN[k]) bad.push("UPDN 缺 "+k); });
set({tab:"ref"}); const refHtml=A.render("ref");
Object.keys(A.REF).forEach(k=>{ if(!refHtml.includes(A.REF[k].s)) bad.push("REF 未列在來源頁 "+k); });
const unused=Object.keys(A.REF).filter(k=>!used.has(k)); if(unused.length) console.log("（提示）未被任何情境引用的 REF："+unused.join(", "));
missing.forEach(k=>bad.push("出處鍵不存在 "+k));
if(bad.length){ console.log("STATIC FAIL",bad.length); bad.slice(0,40).forEach(b=>console.log("  "+b)); process.exit(1); }
console.log("STATIC OK（出處鍵 "+used.size+"／REF "+Object.keys(A.REF).length+"）");
