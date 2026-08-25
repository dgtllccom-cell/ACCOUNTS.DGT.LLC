"use strict";(()=>{var a={};a.id=23633,a.ids=[23633],a.modules={261:a=>{a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},19121:a=>{a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},21820:a=>{a.exports=require("os")},25948:(a,b,c)=>{c.r(b),c.d(b,{handler:()=>G,patchFetch:()=>F,routeModule:()=>B,serverHooks:()=>E,workAsyncStorage:()=>C,workUnitAsyncStorage:()=>D});var d={};c.r(d),c.d(d,{GET:()=>A,dynamic:()=>x,revalidate:()=>y});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(99467),v=c(39588),w=c(58799);let x="force-dynamic",y=0,z=`
with rl as (
  select roznamcha_entry_id eid,
         coalesce(sum(debit),0) debit, coalesce(sum(credit),0) credit,
         max(currency) currency, max(account_number) account_no
  from roznamcha_lines group by roznamcha_entry_id
),
feed as (
  -- Financial postings (Journal / Cash / Bank / Purchase / Sale / Transfer)
  select
    e.id::text record_id, 'Roznamcha' source_module,
    (case
      when lower(coalesce(e.source_module,'')) like '%cash%' then 'Payment'
      when e.entry_category='bank' or lower(coalesce(e.source_module,'')) like '%bank%' then 'Bank'
      when lower(coalesce(e.source_module,'')) like '%purchase%' or lower(coalesce(e.source_transaction_type,'')) like '%purchase%' then 'Purchase'
      when lower(coalesce(e.source_module,'')) like '%sale%' or lower(coalesce(e.source_transaction_type,'')) like '%sale%' then 'Sale'
      when lower(coalesce(e.source_transaction_type,'')) like '%transfer%' then 'Transfer'
      when e.entry_category='invoice' then 'Purchase'
      else 'Journal' end) module,
    coalesce(e.source_transaction_type, e.type::text) txn_type,
    coalesce(e.voucher_no, e.journal_no, e.reference_no) entry_no,
    coalesce(e.reference_no, e.source_reference_no) reference,
    e.created_at ts, e.country_id, coalesce(e.city_branch_id, e.country_branch_id) branch_id,
    coalesce(e.narration, e.source_transaction_type, 'Roznamcha Entry') entry_name,
    rl.account_no party, rl.currency, rl.debit, rl.credit, e.status::text,
    cp.full_name created_by, ap.full_name approved_by, '/dashboard/all-release-entries/' || e.id::text || '?module=Roznamcha&src=Roznamcha' href
  from roznamcha_entries e
  left join rl on rl.eid = e.id
  left join profiles cp on cp.id = e.created_by
  left join profiles ap on ap.id = e.approved_by
  where e.deleted_at is null
  union all
  -- Purchase orders
  select po.id::text, 'Purchase', 'Purchase', 'Purchase Order', po.purchase_order_no, po.purchase_order_no,
    po.created_at, po.country_id, coalesce(po.city_branch_id, po.country_branch_id), 'Purchase Order',
    comp.name, po.currency_code, coalesce(po.order_total,0), 0, coalesce(po.payment_status::text,'-'),
    null, null, '/dashboard/all-release-entries/' || po.id::text || '?module=Purchase&src=Purchase'
  from purchase_orders po left join companies comp on comp.id = po.supplier_company_id where po.deleted_at is null
  union all
  -- Sales orders
  select so.id::text, 'Sales', 'Sale', 'Sales Order', so.sales_order_no, so.sales_order_no,
    so.created_at, so.country_id, coalesce(so.city_branch_id, so.country_branch_id), 'Sales Order',
    so.customer_name, null, 0, 0, '-', null, null, '/dashboard/all-release-entries/' || so.id::text || '?module=Sale&src=Sales'
  from sales_orders so where so.deleted_at is null
  union all
  select c.id::text, 'Master', 'Customer', 'Customer', null, null, c.created_at, c.country_id, null,
    'Customer Added', coalesce(c.customer_name, c.company_name), null, 0, 0, 'Active', null, null,
    '/dashboard/all-release-entries/' || c.id::text || '?module=Customer&src=Master'
  from customers c where c.deleted_at is null
  union all
  select co.id::text, 'Master', 'Company', 'Company', null, null, co.created_at, co.country_id, null,
    'Company Added', co.name, null, 0, 0, 'Active', null, null, '/dashboard/all-release-entries/' || co.id::text || '?module=Company&src=Master'
  from companies co where co.deleted_at is null
  union all
  select b.id::text, 'Master', 'Bank', 'Bank Account', b.account_number, b.account_number, b.created_at,
    b.country_id, null, 'Bank / Account Added', b.bank_name, null, 0, 0, coalesce(b.account_status::text,'Active'),
    null, null, '/dashboard/all-release-entries/' || b.id::text || '?module=Bank&src=Master'
  from banks b where b.deleted_at is null
  union all
  select em.id::text, 'Master', 'Employee', 'Employee', em.employee_code, em.employee_code, em.created_at,
    em.country_id, coalesce(em.city_branch_id, em.country_branch_id), coalesce(em.designation,'Employee'),
    (select full_name from profiles pr where pr.id = em.person_master_id limit 1),
    null, 0, 0, 'Active', null, null, '/dashboard/all-release-entries/' || em.id::text || '?module=Employee&src=Master'
  from employees em where em.deleted_at is null
  union all
  select w.id::text, 'Master', 'Warehouse', 'Warehouse', w.warehouse_code, w.warehouse_code, w.created_at,
    w.country_id, null, 'Warehouse', w.warehouse_name, null, 0, 0, coalesce(w.status::text,'Active'), null, null,
    '/dashboard/all-release-entries/' || w.id::text || '?module=Warehouse&src=Master'
  from warehouses w where w.deleted_at is null
  union all
  select g.id::text, 'Master', 'Goods', 'Goods', g.chs_code, g.chs_code, g.created_at, g.origin_country_id, null,
    'Goods / Stock Item', g.goods_name, null, 0, 0, case when g.is_active then 'Active' else 'Inactive' end,
    null, null, '/dashboard/all-release-entries/' || g.id::text || '?module=Goods&src=Master'
  from goods g where g.deleted_at is null
  union all
  select u.id::text, 'Master', 'User', 'User', u.user_code, u.user_code, u.created_at, null, null,
    'User / Login', u.full_name, null, 0, 0, 'Active', null, null, '/dashboard/all-release-entries/' || u.id::text || '?module=User&src=Master'
  from profiles u where u.deleted_at is null
)`;async function A(a){try{if(!(await (0,v.DE)()).isSuperAdmin)throw new v.aV("Super Admin access is required for the ERP activity monitor.");let b=a.nextUrl.searchParams,c=b.get("module")?.trim()||"all",d=b.get("countryId")?.trim()||"",e=b.get("branchId")?.trim()||"",f=b.get("status")?.trim()||"",g=b.get("currency")?.trim()||"",h=b.get("dateFrom")?.trim()||"",i=b.get("dateTo")?.trim()||"",j=b.get("search")?.trim()||"",k=Math.max(1,Number(b.get("page"))||1),l=Math.min(100,Math.max(10,Number(b.get("pageSize"))||25)),m=(k-1)*l,n=await (0,w.x)(async a=>{let[b]=await a`select count(*)::int c from countries`,[k]=await a`select (select count(*) from country_branches where deleted_at is null)::int + (select count(*) from city_branches where deleted_at is null)::int c`,[n]=await a`select count(*)::int c from roznamcha_entries where deleted_at is null and (entry_date = current_date or created_at::date = current_date)`,[o]=await a`select coalesce(sum(l.debit),0)::numeric d, coalesce(sum(l.credit),0)::numeric c from roznamcha_lines l join roznamcha_entries e on e.id=l.roznamcha_entry_id where e.deleted_at is null`,p=a=>a.replace(/[%,]/g,""),q=a`
        where true
        and (${"all"!==c?a`f.module = ${c}`:a`true`})
        and (${d?a`f.country_id = ${d}`:a`true`})
        and (${e?a`f.branch_id = ${e}`:a`true`})
        and (${f?a`lower(f.status) = lower(${f})`:a`true`})
        and (${g?a`f.currency = ${g}`:a`true`})
        and (${h?a`f.ts >= ${h}`:a`true`})
        and (${i?a`f.ts <= ${i+" 23:59:59"}`:a`true`})
        and (${j?a`(
              f.entry_name ilike ${"%"+p(j)+"%"} or f.party ilike ${"%"+p(j)+"%"}
              or f.reference ilike ${"%"+p(j)+"%"} or f.entry_no ilike ${"%"+p(j)+"%"}
              or f.module ilike ${"%"+p(j)+"%"})`:a`true`})`,[r]=await a`${a.unsafe(z)} select count(*)::int total from feed f ${q}`,s=await a`
        ${a.unsafe(z)}
        select f.*, c2.name country_name, coalesce(cib.name, cb.name) branch_name
        from feed f
        left join countries c2 on c2.id = f.country_id
        left join city_branches cib on cib.id = f.branch_id
        left join country_branches cb on cb.id = f.branch_id
        ${q}
        order by f.ts desc nulls last
        limit ${l} offset ${m}`,t=await a`select id::text id, name from countries order by name`,u=await a`select distinct currency from roznamcha_lines where currency is not null and currency <> '' order by currency`;return{c:b,b:k,today:n,tot:o,total:r.total,rows:s,countryOpts:t,currencyOpts:u}});if(!n)return(0,u.pc)({summary:null,entries:[],total:0,page:k,pageSize:l,connected:!1,filters:{countries:[],currencies:[]}});let o=a=>Number(a||0),p=n.rows.map((a,b)=>({sr:m+b+1,recordId:a.record_id,sourceModule:a.source_module,module:a.module,txnType:a.txn_type,entryNo:a.entry_no||"",reference:a.reference||"",date:a.ts,country:a.country_name||"",branch:a.branch_name||"",entryName:a.entry_name||"",party:a.party||"",currency:a.currency||"",debit:o(a.debit),credit:o(a.credit),status:a.status||"",createdBy:a.created_by||"",approvedBy:a.approved_by||"",href:a.href||"#"})),q={countries:n.c.c,branches:n.b.c,todayEntries:n.today.c,totalDebit:o(n.tot.d),totalCredit:o(n.tot.c),netMovement:o(n.tot.d)-o(n.tot.c)};return(0,u.pc)({summary:q,entries:p,total:n.total,page:k,pageSize:l,connected:!0,filters:{countries:n.countryOpts.map(a=>({id:a.id,name:a.name||a.id})),currencies:n.currencyOpts.map(a=>a.currency)},connectedModules:["Journal","Payment","Bank","Purchase","Sale","Transfer","Sales","Customer","Company","Employee","Warehouse","Goods","User"]})}catch(a){return(0,u.hS)(a)}}let B=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/erp/super-admin/activity/route",pathname:"/api/erp/super-admin/activity",filename:"route",bundlePath:"app/api/erp/super-admin/activity/route"},distDir:".next-verify3",relativeProjectDir:"",resolvedPagePath:"B:\\accounts.dgt.llc.code_project\\ACCOUNTS.DGT.LLC\\app\\api\\erp\\super-admin\\activity\\route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:C,workUnitAsyncStorage:D,serverHooks:E}=B;function F(){return(0,g.patchFetch)({workAsyncStorage:C,workUnitAsyncStorage:D})}async function G(a,b,c){var d;let e="/api/erp/super-admin/activity/route";"/index"===e&&(e="/");let g=await B.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:A,revalidateOnlyGenerated:C,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(y.dynamicRoutes[E]||y.routes[D]);if(F&&!x){let a=!!y.routes[D],b=y.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||B.isDev||x||(G="/index"===(G=D)?"/":G);let H=!0===B.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>B.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>B.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&A&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await B.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:A})},z),b}},l=await B.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:C,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",A?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await B.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:A})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},27910:a=>{a.exports=require("stream")},29021:a=>{a.exports=require("fs")},29294:a=>{a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:a=>{a.exports=require("path")},34631:a=>{a.exports=require("tls")},35559:(a,b,c)=>{c.d(b,{G:()=>f,eq:()=>e});var d=c(98196);let e=d.ZS.arrayToEnum(["invalid_type","invalid_literal","custom","invalid_union","invalid_union_discriminator","invalid_enum_value","unrecognized_keys","invalid_arguments","invalid_return_type","invalid_date","invalid_string","too_small","too_big","invalid_intersection_types","not_multiple_of","not_finite"]);class f extends Error{get errors(){return this.issues}constructor(a){super(),this.issues=[],this.addIssue=a=>{this.issues=[...this.issues,a]},this.addIssues=(a=[])=>{this.issues=[...this.issues,...a]};let b=new.target.prototype;Object.setPrototypeOf?Object.setPrototypeOf(this,b):this.__proto__=b,this.name="ZodError",this.issues=a}format(a){let b=a||function(a){return a.message},c={_errors:[]},d=a=>{for(let e of a.issues)if("invalid_union"===e.code)e.unionErrors.map(d);else if("invalid_return_type"===e.code)d(e.returnTypeError);else if("invalid_arguments"===e.code)d(e.argumentsError);else if(0===e.path.length)c._errors.push(b(e));else{let a=c,d=0;for(;d<e.path.length;){let c=e.path[d];d===e.path.length-1?(a[c]=a[c]||{_errors:[]},a[c]._errors.push(b(e))):a[c]=a[c]||{_errors:[]},a=a[c],d++}}};return d(this),c}static assert(a){if(!(a instanceof f))throw Error(`Not a ZodError: ${a}`)}toString(){return this.message}get message(){return JSON.stringify(this.issues,d.ZS.jsonStringifyReplacer,2)}get isEmpty(){return 0===this.issues.length}flatten(a=a=>a.message){let b={},c=[];for(let d of this.issues)if(d.path.length>0){let c=d.path[0];b[c]=b[c]||[],b[c].push(a(d))}else c.push(a(d));return{formErrors:c,fieldErrors:b}}get formErrors(){return this.flatten()}}f.create=a=>new f(a)},44870:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:a=>{a.exports=require("crypto")},63033:a=>{a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},74998:a=>{a.exports=require("perf_hooks")},77598:a=>{a.exports=require("node:crypto")},86439:a=>{a.exports=require("next/dist/shared/lib/no-fallback-error.external")},91645:a=>{a.exports=require("net")},98196:(a,b,c)=>{var d,e;c.d(b,{CR:()=>g,ZS:()=>d,Zp:()=>f}),function(a){a.assertEqual=a=>{},a.assertIs=function(a){},a.assertNever=function(a){throw Error()},a.arrayToEnum=a=>{let b={};for(let c of a)b[c]=c;return b},a.getValidEnumValues=b=>{let c=a.objectKeys(b).filter(a=>"number"!=typeof b[b[a]]),d={};for(let a of c)d[a]=b[a];return a.objectValues(d)},a.objectValues=b=>a.objectKeys(b).map(function(a){return b[a]}),a.objectKeys="function"==typeof Object.keys?a=>Object.keys(a):a=>{let b=[];for(let c in a)Object.prototype.hasOwnProperty.call(a,c)&&b.push(c);return b},a.find=(a,b)=>{for(let c of a)if(b(c))return c},a.isInteger="function"==typeof Number.isInteger?a=>Number.isInteger(a):a=>"number"==typeof a&&Number.isFinite(a)&&Math.floor(a)===a,a.joinValues=function(a,b=" | "){return a.map(a=>"string"==typeof a?`'${a}'`:a).join(b)},a.jsonStringifyReplacer=(a,b)=>"bigint"==typeof b?b.toString():b}(d||(d={})),(e||(e={})).mergeShapes=(a,b)=>({...a,...b});let f=d.arrayToEnum(["string","nan","number","integer","float","boolean","date","bigint","symbol","function","undefined","null","array","object","unknown","promise","void","never","map","set"]),g=a=>{switch(typeof a){case"undefined":return f.undefined;case"string":return f.string;case"number":return Number.isNaN(a)?f.nan:f.number;case"boolean":return f.boolean;case"function":return f.function;case"bigint":return f.bigint;case"symbol":return f.symbol;case"object":if(Array.isArray(a))return f.array;if(null===a)return f.null;if(a.then&&"function"==typeof a.then&&a.catch&&"function"==typeof a.catch)return f.promise;if("undefined"!=typeof Map&&a instanceof Map)return f.map;if("undefined"!=typeof Set&&a instanceof Set)return f.set;if("undefined"!=typeof Date&&a instanceof Date)return f.date;return f.object;default:return f.unknown}}}};var b=require("../../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[95873,17210,86802,4410,82161,91692,49122,31535,67218,99467],()=>b(b.s=25948));module.exports=c})();