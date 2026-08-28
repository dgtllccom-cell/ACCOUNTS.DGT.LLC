import { chromium } from "playwright"; import fs from "node:fs";
const html = fs.readFileSync(process.argv[2],"utf8");
const b = await chromium.launch({ executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe", headless:true });
const p = await b.newPage({ deviceScaleFactor: 2 });
await p.setContent(html,{waitUntil:"networkidle"}); await p.emulateMedia({media:"print"});
await p.addStyleTag({content:".wrap{padding:0!important}.page{box-shadow:none!important;border:none!important;width:210mm!important;padding:10mm!important}"});
// use CSS Paint / getBoxQuads not available; approximate: naive boundary check
const r = await p.evaluate(()=>{
  const d=document.createElement('div'); d.style.cssText='width:100mm;position:absolute;left:-9999px'; document.body.appendChild(d);
  const pmm=d.getBoundingClientRect().width/100; d.remove();
  const pageC=document.querySelector('.page'); const printH=(297-20)*pmm;
  const org=pageC.getBoundingClientRect().top+scrollY;
  const units=[...document.querySelectorAll('.section-card:not(.perm-section), .grid-2, .overview-banner, .footer-signatures, .perm-group, .approval-box, .info-table tr')];
  let splits=[], maxUnitH=0;
  for(const el of units){
    const bb=el.getBoundingClientRect(); const t=bb.top+scrollY-org, bot=bb.bottom+scrollY-org, h=bot-t;
    if(h<6) continue; maxUnitH=Math.max(maxUnitH,h);
    if(h<printH && Math.floor(t/printH)!==Math.floor((bot-2)/printH)) splits.push({c:el.className.split(' ')[0], h:Math.round(h), t:Math.round(t)});
  }
  return { totalH:Math.round(pageC.scrollHeight), printableH:Math.round(printH), pages:Math.ceil(pageC.scrollHeight/printH),
           potentialSplitUnits: splits.length, splits: splits.slice(0,8), tallestUnitPx: Math.round(maxUnitH) };
});
console.log(JSON.stringify(r,null,1));
await b.close();
