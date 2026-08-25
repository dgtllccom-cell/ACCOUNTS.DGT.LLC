"use strict";(()=>{var a={};a.id=10577,a.ids=[10577],a.modules={261:a=>{a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},19121:a=>{a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},21820:a=>{a.exports=require("os")},27910:a=>{a.exports=require("stream")},29021:a=>{a.exports=require("fs")},29294:a=>{a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:a=>{a.exports=require("path")},34631:a=>{a.exports=require("tls")},44870:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:a=>{a.exports=require("crypto")},63033:a=>{a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},67177:(a,b,c)=>{c.r(b),c.d(b,{handler:()=>H,patchFetch:()=>G,routeModule:()=>C,serverHooks:()=>F,workAsyncStorage:()=>D,workUnitAsyncStorage:()=>E});var d={};c.r(d),c.d(d,{GET:()=>B});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(2995),v=c(99467),w=c(73019),x=c(39588),y=c(70151),z=c(78501);let A=u.Ik({accountId:w.lI,format:u.k5(["json","html","csv","excel"]).default("json"),fromDate:u.Yj().trim().min(8).optional(),toDate:u.Yj().trim().min(8).optional()});async function B(a){try{let b=await (0,x.DE)(),c=A.parse({accountId:a.nextUrl.searchParams.get("accountId")??void 0,format:a.nextUrl.searchParams.get("format")??void 0,fromDate:a.nextUrl.searchParams.get("fromDate")??void 0,toDate:a.nextUrl.searchParams.get("toDate")??void 0});(0,y.yM)(b,{resource:"accounts",action:"read"});let d=c.fromDate??function(){let a=new Date;return a.setDate(1),a.toISOString().slice(0,10)}(),e=c.toDate??new Date().toISOString().slice(0,10),f="PKR-AC-001",g="Petty Cash - Karachi",h=[{date:d,description:"Opening Balance",reference:"OPEN",debit:5e4,credit:0,balance:5e4},{date:new Date(new Date(d).getTime()+864e5).toISOString().slice(0,10),description:"Office Expense Reimbursement",reference:"EXP-001",debit:0,credit:2500,balance:47500},{date:new Date(new Date(d).getTime()+1728e5).toISOString().slice(0,10),description:"Cash Deposit - Customer Payment",reference:"DEP-001",debit:15e3,credit:0,balance:62500}],i=h.reduce((a,b)=>(a.transactions+=1,a.totalDebit+=b.debit,a.totalCredit+=b.credit,a),{transactions:0,totalDebit:0,totalCredit:0}),j=5e4+i.totalDebit-i.totalCredit,k=(0,z.Ss)("Account Statement",{headers:["Date","Description","Reference","Debit","Credit","Balance"],rows:h.map(a=>[a.date,a.description,a.reference,a.debit.toFixed(2),a.credit.toFixed(2),a.balance.toFixed(2)]),summary:{"Account Code":f,"Account Name":g,"Opening Balance":"50000.00","Total Transactions":i.transactions,"Total Debit":i.totalDebit.toFixed(2),"Total Credit":i.totalCredit.toFixed(2),"Closing Balance":j.toFixed(2)}},b,{dateRange:{from:d,to:e},company:"DAMAAN Business Group",subtitle:`${f} - ${g}`});if("html"===c.format)return new Response((0,z.fV)(k),{headers:{"Content-Type":"text/html; charset=utf-8"}});if("csv"===c.format)return new Response((0,z.IH)(k),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="account-statement.csv"'}});if("excel"===c.format)return new Response((0,z._T)(k),{headers:{"Content-Type":"application/vnd.ms-excel; charset=utf-8","Content-Disposition":'attachment; filename="account-statement.xls"'}});else return(0,v.pc)({report:k})}catch(a){return(0,v.hS)(a)}}let C=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/erp/accounting/accounts/statement/export/route",pathname:"/api/erp/accounting/accounts/statement/export",filename:"route",bundlePath:"app/api/erp/accounting/accounts/statement/export/route"},distDir:".next-verify2",relativeProjectDir:"",resolvedPagePath:"B:\\accounts.dgt.llc.code_project\\ACCOUNTS.DGT.LLC\\app\\api\\erp\\accounting\\accounts\\statement\\export\\route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:D,workUnitAsyncStorage:E,serverHooks:F}=C;function G(){return(0,g.patchFetch)({workAsyncStorage:D,workUnitAsyncStorage:E})}async function H(a,b,c){var d;let e="/api/erp/accounting/accounts/statement/export/route";"/index"===e&&(e="/");let g=await C.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:A,revalidateOnlyGenerated:B,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(y.dynamicRoutes[E]||y.routes[D]);if(F&&!x){let a=!!y.routes[D],b=y.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||C.isDev||x||(G="/index"===(G=D)?"/":G);let H=!0===C.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>C.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>C.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&A&&B&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await C.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:A})},z),b}},l=await C.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:B,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",A?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await C.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:A})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},70151:(a,b,c)=>{c.d(b,{Di:()=>e,bF:()=>i,f$:()=>g,ge:()=>h,yM:()=>f}),c(39588);var d=c(42464);function e(a){return{countryId:a.nextUrl.searchParams.get("countryId"),countryBranchId:a.nextUrl.searchParams.get("countryBranchId"),cityBranchId:a.nextUrl.searchParams.get("cityBranchId")}}function f(a,b){(0,d.Gq)(a,{resource:b.resource,action:b.action,countryId:b.countryId,countryBranchId:b.countryBranchId,cityBranchId:b.cityBranchId})}function g(a,b){if(!(0,d.eE)(a,b.resource,b.action))throw new d.fL(`Missing permission: ${b.resource}:${b.action}`);if(a.isSuperAdmin)return;let c=b=>b.cityBranchId?(0,d.is)(a,b.cityBranchId):b.countryBranchId?(0,d.Nh)(a,b.countryBranchId):!!b.countryId&&(0,d.Fx)(a,b.countryId),e=c(b.source),f=!!b.destination&&c(b.destination);if(!e&&!f)throw new d.fL("Neither the source nor destination scope of this record is allowed for this user.")}function h(a,b){return!!a.isSuperAdmin||!!b&&(!!b.cityBranchId||!!b.countryBranchId||!!b.countryId)&&(b.cityBranchId?(0,d.is)(a,b.cityBranchId):b.countryBranchId?(0,d.Nh)(a,b.countryBranchId):!!b.countryId&&(0,d.Fx)(a,b.countryId))}function i(a,b,c){let d=a;return c?.cityBranchId?d=d.eq("city_branch_id",c.cityBranchId):c?.countryBranchId?d=d.eq("country_branch_id",c.countryBranchId):c?.countryId&&(d=d.eq("country_id",c.countryId)),!b.isSuperAdmin&&(b.cityBranchIds.length>0?(d=d.or(`city_branch_id.in.(${b.cityBranchIds.join(",")}),city_branch_id.is.null`),b.countryIds.length>0&&(d=d.in("country_id",b.countryIds))):d=b.countryBranchIds.length>0?d.in("country_branch_id",b.countryBranchIds):b.countryIds.length>0?d.in("country_id",b.countryIds):d.eq("id","00000000-0000-0000-0000-000000000000")),d}},74998:a=>{a.exports=require("perf_hooks")},77598:a=>{a.exports=require("node:crypto")},78501:(a,b,c)=>{function d(a,b,c,d){let e=new Date().toLocaleString("en-US",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}),f="Global";return!c.isSuperAdmin&&(c.cityBranchIds.length>0?f="Branch":c.countryBranchIds.length>0?f="Country":c.countryIds.length>0&&(f="Country")),{title:a,subtitle:d.subtitle,company:{name:d.company||"DAMAAN Business Group",branchCode:d.branchCode},scope:{country:c.countryIds?.[0],branch:c.cityBranchIds?.[0],user:c.fullName||c.email||void 0,level:f||"Global"},dateRange:d.dateRange,generatedAt:e,generatedBy:c.fullName||c.email||void 0,data:b,pageInfo:{currentPage:d.currentPage,totalPages:d.totalPages,rowsPerPage:b.rows.length,totalRows:b.rows.length}}}function e(a){let b=a.dateRange?`<tr><td colspan="2"><strong>Period:</strong> ${a.dateRange.from} to ${a.dateRange.to}</td></tr>`:"",c=a.data.summary?Object.entries(a.data.summary).map(([a,b])=>`<tr style="border-top: 2px solid #333; font-weight: bold;">
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
  `}c.d(b,{IH:()=>f,Ss:()=>d,_T:()=>g,fV:()=>e})},86439:a=>{a.exports=require("next/dist/shared/lib/no-fallback-error.external")},91645:a=>{a.exports=require("net")}};var b=require("../../../../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[95873,17210,86802,4410,82161,91692,49122,2995,31535,67218,99467,73019],()=>b(b.s=67177));module.exports=c})();