"use strict";(()=>{var a={};a.id=62858,a.ids=[62858],a.modules={261:a=>{a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},19121:a=>{a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},21820:a=>{a.exports=require("os")},27910:a=>{a.exports=require("stream")},29021:a=>{a.exports=require("fs")},29294:a=>{a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:a=>{a.exports=require("path")},34631:a=>{a.exports=require("tls")},44870:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:a=>{a.exports=require("crypto")},63033:a=>{a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},67743:(a,b,c)=>{c.r(b),c.d(b,{handler:()=>I,patchFetch:()=>H,routeModule:()=>D,serverHooks:()=>G,workAsyncStorage:()=>E,workUnitAsyncStorage:()=>F});var d={};c.r(d),c.d(d,{GET:()=>C});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(2995),v=c(99467),w=c(73019),x=c(39588),y=c(70151),z=c(48446),A=c(78501);let B=u.Ik({format:u.k5(["json","html","csv","excel"]).default("json"),countryId:w.lI.optional(),countryBranchId:w.lI.optional(),cityBranchId:w.lI.optional(),fromDate:u.Yj().trim().min(8).optional(),toDate:u.Yj().trim().min(8).optional()});async function C(a){try{let b=await (0,x.DE)(),c=B.parse({format:a.nextUrl.searchParams.get("format")??void 0,countryId:a.nextUrl.searchParams.get("countryId")??void 0,countryBranchId:a.nextUrl.searchParams.get("countryBranchId")??void 0,cityBranchId:a.nextUrl.searchParams.get("cityBranchId")??void 0,fromDate:a.nextUrl.searchParams.get("fromDate")??void 0,toDate:a.nextUrl.searchParams.get("toDate")??void 0});(0,y.yM)(b,{resource:"reports",action:"read",countryId:c.countryId??null,countryBranchId:c.countryBranchId??null,cityBranchId:c.cityBranchId??null});let d=c.fromDate??function(){let a=new Date;return a.setDate(1),a.toISOString().slice(0,10)}(),e=c.toDate??new Date().toISOString().slice(0,10),f=await z.l.listLedgers({session:b,q:null,countryId:c.countryId??null,countryBranchId:c.countryBranchId??null,cityBranchId:c.cityBranchId??null,limit:500}),g=(f?.rows??[]).reduce((a,b)=>(a.totalLedgers+=1,"active"===b.status?a.activeLedgers+=1:a.inactiveLedgers+=1,a.debit+=parseFloat(b.debit??0),a.credit+=parseFloat(b.credit??0),a.balance+=parseFloat(b.balance??0),a),{totalLedgers:0,activeLedgers:0,inactiveLedgers:0,debit:0,credit:0,balance:0}),h=(0,A.Ss)("General Ledger Report",{headers:["Ledger Code","Ledger Name","Status","Debit","Credit","Balance"],rows:(f?.rows??[]).map(a=>[a.code||"",a.name||"",a.status||"",parseFloat(a.debit??0).toFixed(2),parseFloat(a.credit??0).toFixed(2),parseFloat(a.balance??0).toFixed(2)]),summary:{"Total Ledgers":g.totalLedgers,"Active Ledgers":g.activeLedgers,"Total Debit":g.debit.toFixed(2),"Total Credit":g.credit.toFixed(2),"Net Balance":g.balance.toFixed(2)}},b,{dateRange:{from:d,to:e},company:"DAMAAN Business Group"});if("html"===c.format)return new Response((0,A.fV)(h),{headers:{"Content-Type":"text/html; charset=utf-8"}});if("csv"===c.format)return new Response((0,A.IH)(h),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="general-ledger-report.csv"'}});if("excel"===c.format)return new Response((0,A._T)(h),{headers:{"Content-Type":"application/vnd.ms-excel; charset=utf-8","Content-Disposition":'attachment; filename="general-ledger-report.xls"'}});else return(0,v.pc)({report:h})}catch(a){return(0,v.hS)(a)}}let D=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/erp/accounting/reports/ledger/export/route",pathname:"/api/erp/accounting/reports/ledger/export",filename:"route",bundlePath:"app/api/erp/accounting/reports/ledger/export/route"},distDir:".next-verify",relativeProjectDir:"",resolvedPagePath:"B:\\accounts.dgt.llc.code_project\\ACCOUNTS.DGT.LLC\\app\\api\\erp\\accounting\\reports\\ledger\\export\\route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:E,workUnitAsyncStorage:F,serverHooks:G}=D;function H(){return(0,g.patchFetch)({workAsyncStorage:E,workUnitAsyncStorage:F})}async function I(a,b,c){var d;let e="/api/erp/accounting/reports/ledger/export/route";"/index"===e&&(e="/");let g=await D.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:A,revalidateOnlyGenerated:B,resolvedPathname:C}=g,E=(0,j.normalizeAppPath)(e),F=!!(y.dynamicRoutes[E]||y.routes[C]);if(F&&!x){let a=!!y.routes[C],b=y.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||D.isDev||x||(G="/index"===(G=C)?"/":G);let H=!0===D.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>D.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>D.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&A&&B&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await D.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:A})},z),b}},l=await D.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:B,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",A?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await D.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:A})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},74998:a=>{a.exports=require("perf_hooks")},77598:a=>{a.exports=require("node:crypto")},78501:(a,b,c)=>{function d(a,b,c,d){let e=new Date().toLocaleString("en-US",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}),f="Global";return!c.isSuperAdmin&&(c.cityBranchIds.length>0?f="Branch":c.countryBranchIds.length>0?f="Country":c.countryIds.length>0&&(f="Country")),{title:a,subtitle:d.subtitle,company:{name:d.company||"DAMAAN Business Group",branchCode:d.branchCode},scope:{country:c.countryIds?.[0],branch:c.cityBranchIds?.[0],user:c.fullName||c.email||void 0,level:f||"Global"},dateRange:d.dateRange,generatedAt:e,generatedBy:c.fullName||c.email||void 0,data:b,pageInfo:{currentPage:d.currentPage,totalPages:d.totalPages,rowsPerPage:b.rows.length,totalRows:b.rows.length}}}function e(a){let b=a.dateRange?`<tr><td colspan="2"><strong>Period:</strong> ${a.dateRange.from} to ${a.dateRange.to}</td></tr>`:"",c=a.data.summary?Object.entries(a.data.summary).map(([a,b])=>`<tr style="border-top: 2px solid #333; font-weight: bold;">
            <td>${a}</td>
            <td style="text-align: right;">${"number"==typeof b?b.toFixed(2):b}</td>
          </tr>`).join(""):"",d=a.data.rows.map(a=>`<tr>
        ${a.map((a,b)=>`<td${0===b?"":' style="text-align: right;"'}>${"number"==typeof a?a.toFixed(2):a}</td>`).join("")}
      </tr>`).join("");return`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 3px solid #333;
          padding-bottom: 10px;
        }
        .header h1 {
          margin: 5px 0;
          font-size: 20px;
        }
        .header p {
          margin: 2px 0;
          font-size: 12px;
          color: #666;
        }
        .info-table {
          width: 100%;
          margin-bottom: 20px;
          font-size: 12px;
        }
        .info-table td {
          padding: 4px 8px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        .data-table th {
          background-color: #f0f0f0;
          border: 1px solid #ccc;
          padding: 8px;
          text-align: left;
          font-weight: bold;
          font-size: 12px;
        }
        .data-table td {
          border: 1px solid #ccc;
          padding: 6px 8px;
          font-size: 12px;
        }
        .footer {
          margin-top: 20px;
          font-size: 11px;
          color: #666;
          text-align: right;
        }
        @media print {
          body { margin: 0; }
          .header { border-bottom: 1px solid #000; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${a.title}</h1>
        ${a.subtitle?`<p><strong>${a.subtitle}</strong></p>`:""}
        <p>${a.company.name}${a.company.branchCode?` - ${a.company.branchCode}`:""}</p>
      </div>

      <table class="info-table">
        <tr>
          <td><strong>Scope:</strong> ${a.scope.level}</td>
          <td><strong>Generated:</strong> ${a.generatedAt}</td>
        </tr>
        ${a.scope.user?`<tr><td colspan="2"><strong>User:</strong> ${a.scope.user}</td></tr>`:""}
        ${b}
      </table>

      <table class="data-table">
        <thead>
          <tr>
            ${a.data.headers.map(a=>`<th>${a}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${d}
          ${c}
        </tbody>
      </table>

      <div class="footer">
        <p>Report Page ${a.pageInfo?.currentPage||1}${a.pageInfo?.totalPages?` of ${a.pageInfo.totalPages}`:""}</p>
        <p>\xa9 2026 DAMAAN Business Group - Confidential</p>
      </div>
    </body>
    </html>
  `}function f(a){let b=[];for(let c of(b.push(`"${a.title}"`),a.subtitle&&b.push(`"${a.subtitle}"`),b.push(`"${a.company.name}"`),b.push(""),b.push(`"Scope","${a.scope.level}"`),b.push(`"Generated","${a.generatedAt}"`),a.scope.user&&b.push(`"User","${a.scope.user}"`),a.dateRange&&b.push(`"Period","${a.dateRange.from} to ${a.dateRange.to}"`),b.push(""),b.push(a.data.headers.map(a=>`"${a}"`).join(",")),a.data.rows))b.push(c.map(a=>`"${a}"`).join(","));if(a.data.summary)for(let[c,d]of(b.push(""),Object.entries(a.data.summary)))b.push(`"${c}","${d}"`);return b.push(""),b.push(`"Generated: ${a.generatedAt}"`),b.join("\n")}function g(a){return new Date().toISOString().slice(0,10).replace(/-/g,""),`
    <html xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head>
      <meta charset="UTF-8">
      <style>
        table { border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 4px; }
        th { background-color: #f0f0f0; }
        .header { font-weight: bold; font-size: 14px; margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="header">${a.title}</div>
      <table>
        <tr>
          <td colspan="2"><strong>Company:</strong> ${a.company.name}</td>
        </tr>
        <tr>
          <td><strong>Scope:</strong> ${a.scope.level}</td>
          <td><strong>Generated:</strong> ${a.generatedAt}</td>
        </tr>
        ${a.dateRange?`<tr><td colspan="2"><strong>Period:</strong> ${a.dateRange.from} to ${a.dateRange.to}</td></tr>`:""}
      </table>
      <br/>
      <table>
        <thead>
          <tr>
            ${a.data.headers.map(a=>`<th>${a}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${a.data.rows.map(a=>`<tr>${a.map(a=>`<td>${a}</td>`).join("")}</tr>`).join("")}
          ${a.data.summary?`<tr>
              ${Object.entries(a.data.summary).map(([a,b])=>`<td><strong>${a}</strong></td><td><strong>${b}</strong></td>`).join("")}
            </tr>`:""}
        </tbody>
      </table>
    </body>
    </html>
  `}c.d(b,{IH:()=>f,Ss:()=>d,_T:()=>g,fV:()=>e})},86439:a=>{a.exports=require("next/dist/shared/lib/no-fallback-error.external")},91645:a=>{a.exports=require("net")}};var b=require("../../../../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[95873,17210,86802,4410,82161,91692,49122,2995,36153,31535,67218,99467,73019,33380],()=>b(b.s=67743));module.exports=c})();