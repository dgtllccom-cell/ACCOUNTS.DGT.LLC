"use strict";(()=>{var a={};a.id=17302,a.ids=[17302],a.modules={261:a=>{a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},19121:a=>{a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},21820:a=>{a.exports=require("os")},27910:a=>{a.exports=require("stream")},29021:a=>{a.exports=require("fs")},29294:a=>{a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},32560:(a,b,c)=>{c.r(b),c.d(b,{handler:()=>G,patchFetch:()=>F,routeModule:()=>B,serverHooks:()=>E,workAsyncStorage:()=>C,workUnitAsyncStorage:()=>D});var d={};c.r(d),c.d(d,{GET:()=>z,POST:()=>A});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(39588),v=c(70151),w=c(99467),x=c(58799),y=c(9208);async function z(a){try{let b=await (0,u.DE)();(0,v.yM)(b,{resource:"inventory",action:"read"});let c=a.nextUrl.searchParams,d=c.get("q")?.trim(),e=c.get("movementType")?.trim(),f=c.get("warehouseId")?.trim(),g=c.get("goodsId")?.trim(),h=Number(c.get("limit")||"100"),i=Number(c.get("offset")||"0"),j=(c.get("lang")||a.headers.get("accept-language")||"en").toLowerCase(),k=["en","ur","ar","fa","ps"].includes(j)?j:"en",l=await (0,x.x)(async a=>{let c=a`
        SELECT 
          sm.id,
          sm.movement_type,
          sm.goods_id,
          sm.goods_variation_id,
          sm.warehouse_id,
          sm.country_id,
          sm.country_branch_id,
          sm.city_branch_id,
          sm.quantity,
          sm.unit_cost,
          sm.total_amount,
          sm.reference_no,
          sm.notes,
          sm.movement_date,
          sm.created_at,
          sm.super_admin_serial,
          sm.country_serial,
          sm.branch_serial,
          sm.entry_serial,
          g.goods_name,
          g.chs_code,
          gv.size AS variation_size,
          gv.brand AS variation_brand,
          w.warehouse_name,
          w.warehouse_code,
          c.name AS country_name
        FROM public.stock_movements sm
        LEFT JOIN public.goods g ON g.id = sm.goods_id
        LEFT JOIN public.goods_variations gv ON gv.id = sm.goods_variation_id
        LEFT JOIN public.warehouses w ON w.id = sm.warehouse_id
        LEFT JOIN public.countries c ON c.id = sm.country_id
        WHERE sm.deleted_at IS NULL
      `;if(!b.isSuperAdmin&&b.countryIds&&b.countryIds.length>0&&(c=a`${c} AND (sm.country_id IS NULL OR sm.country_id = ANY(${b.countryIds}::uuid[]))`),e&&(c=a`${c} AND sm.movement_type = ${e}`),f&&(c=a`${c} AND sm.warehouse_id = ${f}::uuid`),g&&(c=a`${c} AND sm.goods_id = ${g}::uuid`),d){let b=`%${d}%`;c=a`${c} AND (
          g.goods_name ILIKE ${b} OR 
          g.chs_code ILIKE ${b} OR 
          w.warehouse_name ILIKE ${b} OR 
          sm.reference_no ILIKE ${b} OR 
          sm.notes ILIKE ${b}
        )`}let j=await a`
        ${c}
        ORDER BY sm.movement_date DESC, sm.created_at DESC
        LIMIT ${h} OFFSET ${i}
      `;if(j.length>0){let a=j.map(a=>({id:a.goods_id,goods_name:a.goods_name})).filter(a=>a.id),b=await (0,y.tM)(a,"goods","goods_name",k),c=new Map(b.map(a=>[a.id,a.goods_name])),d=j.map(a=>({id:a.warehouse_id,warehouse_name:a.warehouse_name})).filter(a=>a.id),e=await (0,y.tM)(d,"warehouses","warehouse_name",k),f=new Map(e.map(a=>[a.id,a.warehouse_name])),g=j.map(a=>({id:a.country_id,name:a.country_name})).filter(a=>a.id),h=await (0,y.tM)(g,"countries","name",k),i=new Map(h.map(a=>[a.id,a.name]));j=j.map(a=>({...a,goods_name:a.goods_id&&c.get(a.goods_id)||a.goods_name,warehouse_name:a.warehouse_id&&f.get(a.warehouse_id)||a.warehouse_name,country_name:a.country_id&&i.get(a.country_id)||a.country_name}))}let l=await a`
        SELECT COUNT(*) as total FROM public.stock_movements sm
        LEFT JOIN public.goods g ON g.id = sm.goods_id
        LEFT JOIN public.warehouses w ON w.id = sm.warehouse_id
        WHERE sm.deleted_at IS NULL
        ${!b.isSuperAdmin&&b.countryIds&&b.countryIds.length>0?a`AND (sm.country_id IS NULL OR sm.country_id = ANY(${b.countryIds}::uuid[]))`:a``}
        ${e?a`AND sm.movement_type = ${e}`:a``}
        ${f?a`AND sm.warehouse_id = ${f}::uuid`:a``}
        ${g?a`AND sm.goods_id = ${g}::uuid`:a``}
      `;return{movements:j,total:Number(l[0]?.total||0)}});return(0,w.pc)(l||{movements:[],total:0})}catch(a){return(0,w.hS)(a)}}async function A(a){try{let b=await (0,u.DE)();(0,v.yM)(b,{resource:"inventory",action:"create"});let c=await a.json(),d=c.movementType,e=c.goodsId,f=c.goodsVariationId||null,g=c.warehouseId,h=Number(c.quantity||0),i=Number(c.unitCost||0),j=c.referenceNo?String(c.referenceNo).trim():null,k=c.notes?String(c.notes).trim():null;if(!d||!["STOCK_IN","STOCK_OUT","ADJUSTMENT","TRANSFER"].includes(d))return new Response(JSON.stringify({error:"Valid movementType is required (STOCK_IN, STOCK_OUT, ADJUSTMENT, TRANSFER)"}),{status:400,headers:{"Content-Type":"application/json"}});if(!e||!g||h<=0)return new Response(JSON.stringify({error:"goodsId, warehouseId, and positive quantity are required"}),{status:400,headers:{"Content-Type":"application/json"}});let l=h*i,m=new Date().toISOString(),n=await (0,x.x)(async a=>{let n=await a`SELECT goods_name, chs_code FROM public.goods WHERE id = ${e}::uuid`,o=n[0]?.goods_name||"Goods Item",p=n[0]?.chs_code||"PRD-"+e.slice(0,8),q=await a`SELECT country_id FROM public.warehouses WHERE id = ${g}::uuid`,r=q[0]?.country_id||null,s=c.countryId||b.countryIds?.[0]||r;if(!s){let b=await a`SELECT id FROM public.countries ORDER BY created_at ASC LIMIT 1`;s=b[0]?.id||null}if(!b.isSuperAdmin&&s&&!b.countryIds.includes(s))throw Error("403: Not authorized for this country scope");let t=c.countryBranchId||b.countryBranchIds?.[0]||null,u=c.cityBranchId||b.cityBranchIds?.[0]||null;await a`
        INSERT INTO public.products (id, product_code, product_name, hs_code, country_id, is_active, created_at, updated_at)
        VALUES (${e}::uuid, ${p}, ${o}, ${p}, ${s}::uuid, true, ${m}, ${m})
        ON CONFLICT (id) DO NOTHING
      `;let v=(await a`
        INSERT INTO public.stock_movements (
          movement_type,
          goods_id,
          goods_variation_id,
          warehouse_id,
          country_id,
          country_branch_id,
          city_branch_id,
          quantity,
          unit_cost,
          total_amount,
          reference_no,
          notes,
          movement_date,
          created_by,
          created_at,
          updated_at
        ) VALUES (
          ${d},
          ${e}::uuid,
          ${f?a`${f}::uuid`:null},
          ${g}::uuid,
          ${s?a`${s}::uuid`:null},
          ${t?a`${t}::uuid`:null},
          ${u?a`${u}::uuid`:null},
          ${h},
          ${i},
          ${l},
          ${j},
          ${k},
          ${c.movementDate?new Date(c.movementDate).toISOString():m},
          ${b.userId?a`${b.userId}::uuid`:null},
          ${m},
          ${m}
        )
        RETURNING *
      `)[0],w="STOCK_IN"===d||"ADJUSTMENT"===d&&h>0?h:-h;return await a`
        INSERT INTO public.product_inventory_balances (
          product_id,
          country_id,
          country_branch_id,
          city_branch_id,
          warehouse_id,
          quantity_on_hand,
          quantity_reserved,
          updated_at
        ) VALUES (
          ${e}::uuid,
          ${s}::uuid,
          ${t?a`${t}::uuid`:null},
          ${u?a`${u}::uuid`:null},
          ${g}::uuid,
          ${Math.max(0,w)},
          0,
          ${m}
        )
        ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
          quantity_on_hand = GREATEST(0, public.product_inventory_balances.quantity_on_hand + ${w}),
          updated_at = ${m}
      `,v});return(0,w.pc)({movement:n},{status:201})}catch(a){return(0,w.hS)(a)}}let B=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/erp/inventory/stock-movements/route",pathname:"/api/erp/inventory/stock-movements",filename:"route",bundlePath:"app/api/erp/inventory/stock-movements/route"},distDir:".next-verify2",relativeProjectDir:"",resolvedPagePath:"B:\\accounts.dgt.llc.code_project\\ACCOUNTS.DGT.LLC\\app\\api\\erp\\inventory\\stock-movements\\route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:C,workUnitAsyncStorage:D,serverHooks:E}=B;function F(){return(0,g.patchFetch)({workAsyncStorage:C,workUnitAsyncStorage:D})}async function G(a,b,c){var d;let e="/api/erp/inventory/stock-movements/route";"/index"===e&&(e="/");let g=await B.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:A,revalidateOnlyGenerated:C,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(y.dynamicRoutes[E]||y.routes[D]);if(F&&!x){let a=!!y.routes[D],b=y.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||B.isDev||x||(G="/index"===(G=D)?"/":G);let H=!0===B.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>B.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>B.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&A&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await B.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:A})},z),b}},l=await B.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:C,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",A?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await B.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:A})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},33873:a=>{a.exports=require("path")},34631:a=>{a.exports=require("tls")},35559:(a,b,c)=>{c.d(b,{G:()=>f,eq:()=>e});var d=c(98196);let e=d.ZS.arrayToEnum(["invalid_type","invalid_literal","custom","invalid_union","invalid_union_discriminator","invalid_enum_value","unrecognized_keys","invalid_arguments","invalid_return_type","invalid_date","invalid_string","too_small","too_big","invalid_intersection_types","not_multiple_of","not_finite"]);class f extends Error{get errors(){return this.issues}constructor(a){super(),this.issues=[],this.addIssue=a=>{this.issues=[...this.issues,a]},this.addIssues=(a=[])=>{this.issues=[...this.issues,...a]};let b=new.target.prototype;Object.setPrototypeOf?Object.setPrototypeOf(this,b):this.__proto__=b,this.name="ZodError",this.issues=a}format(a){let b=a||function(a){return a.message},c={_errors:[]},d=a=>{for(let e of a.issues)if("invalid_union"===e.code)e.unionErrors.map(d);else if("invalid_return_type"===e.code)d(e.returnTypeError);else if("invalid_arguments"===e.code)d(e.argumentsError);else if(0===e.path.length)c._errors.push(b(e));else{let a=c,d=0;for(;d<e.path.length;){let c=e.path[d];d===e.path.length-1?(a[c]=a[c]||{_errors:[]},a[c]._errors.push(b(e))):a[c]=a[c]||{_errors:[]},a=a[c],d++}}};return d(this),c}static assert(a){if(!(a instanceof f))throw Error(`Not a ZodError: ${a}`)}toString(){return this.message}get message(){return JSON.stringify(this.issues,d.ZS.jsonStringifyReplacer,2)}get isEmpty(){return 0===this.issues.length}flatten(a=a=>a.message){let b={},c=[];for(let d of this.issues)if(d.path.length>0){let c=d.path[0];b[c]=b[c]||[],b[c].push(a(d))}else c.push(a(d));return{formErrors:c,fieldErrors:b}}get formErrors(){return this.flatten()}}f.create=a=>new f(a)},44870:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:a=>{a.exports=require("crypto")},63033:a=>{a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},70151:(a,b,c)=>{c.d(b,{Di:()=>e,bF:()=>i,f$:()=>g,ge:()=>h,yM:()=>f}),c(39588);var d=c(42464);function e(a){return{countryId:a.nextUrl.searchParams.get("countryId"),countryBranchId:a.nextUrl.searchParams.get("countryBranchId"),cityBranchId:a.nextUrl.searchParams.get("cityBranchId")}}function f(a,b){(0,d.Gq)(a,{resource:b.resource,action:b.action,countryId:b.countryId,countryBranchId:b.countryBranchId,cityBranchId:b.cityBranchId})}function g(a,b){if(!(0,d.eE)(a,b.resource,b.action))throw new d.fL(`Missing permission: ${b.resource}:${b.action}`);if(a.isSuperAdmin)return;let c=b=>b.cityBranchId?(0,d.is)(a,b.cityBranchId):b.countryBranchId?(0,d.Nh)(a,b.countryBranchId):!!b.countryId&&(0,d.Fx)(a,b.countryId),e=c(b.source),f=!!b.destination&&c(b.destination);if(!e&&!f)throw new d.fL("Neither the source nor destination scope of this record is allowed for this user.")}function h(a,b){return!!a.isSuperAdmin||!!b&&(!!b.cityBranchId||!!b.countryBranchId||!!b.countryId)&&(b.cityBranchId?(0,d.is)(a,b.cityBranchId):b.countryBranchId?(0,d.Nh)(a,b.countryBranchId):!!b.countryId&&(0,d.Fx)(a,b.countryId))}function i(a,b,c){let d=a;return c?.cityBranchId?d=d.eq("city_branch_id",c.cityBranchId):c?.countryBranchId?d=d.eq("country_branch_id",c.countryBranchId):c?.countryId&&(d=d.eq("country_id",c.countryId)),!b.isSuperAdmin&&(b.cityBranchIds.length>0?(d=d.or(`city_branch_id.in.(${b.cityBranchIds.join(",")}),city_branch_id.is.null`),b.countryIds.length>0&&(d=d.in("country_id",b.countryIds))):d=b.countryBranchIds.length>0?d.in("country_branch_id",b.countryBranchIds):b.countryIds.length>0?d.in("country_id",b.countryIds):d.eq("id","00000000-0000-0000-0000-000000000000")),d}},74998:a=>{a.exports=require("perf_hooks")},77598:a=>{a.exports=require("node:crypto")},86439:a=>{a.exports=require("next/dist/shared/lib/no-fallback-error.external")},91645:a=>{a.exports=require("net")},98196:(a,b,c)=>{var d,e;c.d(b,{CR:()=>g,ZS:()=>d,Zp:()=>f}),function(a){a.assertEqual=a=>{},a.assertIs=function(a){},a.assertNever=function(a){throw Error()},a.arrayToEnum=a=>{let b={};for(let c of a)b[c]=c;return b},a.getValidEnumValues=b=>{let c=a.objectKeys(b).filter(a=>"number"!=typeof b[b[a]]),d={};for(let a of c)d[a]=b[a];return a.objectValues(d)},a.objectValues=b=>a.objectKeys(b).map(function(a){return b[a]}),a.objectKeys="function"==typeof Object.keys?a=>Object.keys(a):a=>{let b=[];for(let c in a)Object.prototype.hasOwnProperty.call(a,c)&&b.push(c);return b},a.find=(a,b)=>{for(let c of a)if(b(c))return c},a.isInteger="function"==typeof Number.isInteger?a=>Number.isInteger(a):a=>"number"==typeof a&&Number.isFinite(a)&&Math.floor(a)===a,a.joinValues=function(a,b=" | "){return a.map(a=>"string"==typeof a?`'${a}'`:a).join(b)},a.jsonStringifyReplacer=(a,b)=>"bigint"==typeof b?b.toString():b}(d||(d={})),(e||(e={})).mergeShapes=(a,b)=>({...a,...b});let f=d.arrayToEnum(["string","nan","number","integer","float","boolean","date","bigint","symbol","function","undefined","null","array","object","unknown","promise","void","never","map","set"]),g=a=>{switch(typeof a){case"undefined":return f.undefined;case"string":return f.string;case"number":return Number.isNaN(a)?f.nan:f.number;case"boolean":return f.boolean;case"function":return f.function;case"bigint":return f.bigint;case"symbol":return f.symbol;case"object":if(Array.isArray(a))return f.array;if(null===a)return f.null;if(a.then&&"function"==typeof a.then&&a.catch&&"function"==typeof a.catch)return f.promise;if("undefined"!=typeof Map&&a instanceof Map)return f.map;if("undefined"!=typeof Set&&a instanceof Set)return f.set;if("undefined"!=typeof Date&&a instanceof Date)return f.date;return f.object;default:return f.unknown}}}};var b=require("../../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[95873,17210,86802,4410,82161,91692,49122,31535,67218,99467],()=>b(b.s=32560));module.exports=c})();