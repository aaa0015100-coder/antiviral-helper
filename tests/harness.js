// 用 node vm 載入 index.html 的 script（不需 DOM），提供 A（API）、set（設定狀態）、txt（HTML 轉純文字）
const fs=require('fs'),vm=require('vm'),path=require('path');
function load(file){
  const html=fs.readFileSync(file||path.join(__dirname,'..','index.html'),'utf8');
  const js=html.match(/<script>([\s\S]*)<\/script>/)[1];
  const ctx={console,setTimeout,clearTimeout}; vm.createContext(ctx);
  vm.runInContext(js+`
;this.__api={S,UI,REF,GLOSS,REG,D,DGRP,DX,PX,RES,UPDN,TABS,getRenal,weights,doseOf,bandRange,fillW,optsOf,allOpts,regsIn,searchHits,goHit,DX_OF,PX_OF,RES_OF,
  setR(){R=getRenal();},
  render(tab){R=getRenal(); return RENDER[tab]();}
};`,ctx);
  return {A:ctx.__api,html};
}
function mk(A){
  const base=JSON.parse(JSON.stringify(A.S));
  return function set(o={}){
    const b=JSON.parse(JSON.stringify(base));
    for(const k of Object.keys(b)) A.S[k]=b[k];
    for(const [k,v] of Object.entries(o)){
      if(v&&typeof v==="object"&&!Array.isArray(v)&&A.S[k]&&typeof A.S[k]==="object") Object.assign(A.S[k],v);
      else A.S[k]=v;
    }
    A.UI.dxpick=false; A.UI.pxpick=false; A.UI.dpick=false;
    A.setR();
  };
}
const txt=h=>h.replace(/<(script|style)[\s\S]*?<\/\1>/g," ").replace(/<[^>]+>/g," ").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();
module.exports={load,mk,txt};
