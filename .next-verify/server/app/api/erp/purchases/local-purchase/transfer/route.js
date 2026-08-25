"use strict";(()=>{var a={};a.id=63142,a.ids=[63142],a.modules={261:a=>{a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},19121:a=>{a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},21820:a=>{a.exports=require("os")},27910:a=>{a.exports=require("stream")},29021:a=>{a.exports=require("fs")},29294:a=>{a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:a=>{a.exports=require("path")},34631:a=>{a.exports=require("tls")},42143:(a,b,c)=>{c.d(b,{SQ:()=>i,aS:()=>j,rc:()=>h,yp:()=>k});var d=c(10641),e=c(55511),f=c.n(e),g=c(99875);async function h(a){let b=function(a){let b=a.headers.get("x-idempotency-key")||a.headers.get("idempotency-key");return b&&b.trim().length>0?b.trim():null}(a.req);if(!b)return{acquired:!0,isReplayed:!1,idempotencyKey:"",tenantHash:""};let c=function(a){let b=[a.userId||"anon",a.countryId||"no_country",a.cityBranchId||"no_branch",a.scopeModule.toUpperCase(),a.businessReference||"no_ref"].join("::");return f().createHash("sha256").update(b).digest("hex")}({userId:a.userId,countryId:a.countryId,cityBranchId:a.cityBranchId,scopeModule:a.scopeModule,businessReference:a.businessReference}),d=function(a){if(!a)return"EMPTY_PAYLOAD";try{let b="string"==typeof a?a:JSON.stringify(a);return f().createHash("sha256").update(b).digest("hex")}catch{return"INVALID_PAYLOAD_HASH"}}(a.payload),e=(0,g.createSupabaseAdminClient)();try{let{data:f,error:g}=await e.rpc("acquire_idempotency_lock",{p_idempotency_key:b,p_tenant_hash:c,p_scope_module:a.scopeModule,p_user_id:a.userId||null,p_country_id:a.countryId||null,p_city_branch_id:a.cityBranchId||null,p_business_reference:a.businessReference||null,p_request_hash:d,p_lock_seconds:90});if(!g&&Array.isArray(f)&&f.length>0){let a=f[0];if(a.is_replayed)return{acquired:!1,isReplayed:!0,idempotencyKey:b,tenantHash:c,responseCode:a.response_code||200,responseBody:a.response_body||{ok:!0,isReplayed:!0}};if(a.acquired)return{acquired:!0,isReplayed:!1,idempotencyKey:b,tenantHash:c};return{acquired:!1,isReplayed:!1,idempotencyKey:b,tenantHash:c}}let h=new Date(Date.now()+9e4).toISOString(),{error:i}=await e.from("idempotency_keys").insert({idempotency_key:b,tenant_hash:c,scope_module:a.scopeModule,user_id:a.userId||null,country_id:a.countryId||null,city_branch_id:a.cityBranchId||null,business_reference:a.businessReference||null,request_hash:d,status:"PROCESSING",locked_at:new Date().toISOString(),expires_at:h});if(!i)return{acquired:!0,isReplayed:!1,idempotencyKey:b,tenantHash:c};if("23505"!==i.code)return console.error("[Idempotency] Unexpected insert error:",i),{acquired:!0,isReplayed:!1,idempotencyKey:b,tenantHash:c};let{data:j}=await e.from("idempotency_keys").select("*").eq("tenant_hash",c).eq("idempotency_key",b).maybeSingle();if(j?.status==="COMPLETED")return{acquired:!1,isReplayed:!0,idempotencyKey:b,tenantHash:c,responseCode:j.response_code||200,responseBody:j.response_body||{ok:!0,isReplayed:!0}};if(!(j&&new Date(j.expires_at).getTime()<Date.now()))return{acquired:!1,isReplayed:!1,idempotencyKey:b,tenantHash:c};let{data:k}=await e.from("idempotency_keys").update({status:"PROCESSING",request_hash:d,locked_at:new Date().toISOString(),expires_at:h}).eq("tenant_hash",c).eq("idempotency_key",b).eq("status","PROCESSING").lt("expires_at",new Date().toISOString()).select("id").maybeSingle();if(k)return{acquired:!0,isReplayed:!1,idempotencyKey:b,tenantHash:c};return{acquired:!1,isReplayed:!1,idempotencyKey:b,tenantHash:c}}catch(a){return console.error("[Idempotency] Failed to acquire lock:",a),{acquired:!0,isReplayed:!1,idempotencyKey:b,tenantHash:c}}}async function i(a,b,c,d){if(a&&b)try{let e=(0,g.createSupabaseAdminClient)(),f=d&&"object"==typeof d?{...d,isReplayed:!0}:{ok:!0,data:d,isReplayed:!0};await e.from("idempotency_keys").update({status:"COMPLETED",response_code:c,response_body:f,updated_at:new Date().toISOString()}).eq("tenant_hash",b).eq("idempotency_key",a)}catch(a){console.error("[Idempotency] Failed to commit success:",a)}}async function j(a,b){if(a&&b)try{let c=(0,g.createSupabaseAdminClient)();await c.from("idempotency_keys").delete().eq("tenant_hash",b).eq("idempotency_key",a)}catch(a){console.error("[Idempotency] Failed to release lock:",a)}}function k(a,b){let c=d.NextResponse.json(b,{status:a});return c.headers.set("X-Idempotent-Replayed","true"),c}c(99467)},44870:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:a=>{a.exports=require("crypto")},63033:a=>{a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},70151:(a,b,c)=>{c.d(b,{Di:()=>e,bF:()=>i,f$:()=>g,ge:()=>h,yM:()=>f}),c(39588);var d=c(42464);function e(a){return{countryId:a.nextUrl.searchParams.get("countryId"),countryBranchId:a.nextUrl.searchParams.get("countryBranchId"),cityBranchId:a.nextUrl.searchParams.get("cityBranchId")}}function f(a,b){(0,d.Gq)(a,{resource:b.resource,action:b.action,countryId:b.countryId,countryBranchId:b.countryBranchId,cityBranchId:b.cityBranchId})}function g(a,b){if(!(0,d.eE)(a,b.resource,b.action))throw new d.fL(`Missing permission: ${b.resource}:${b.action}`);if(a.isSuperAdmin)return;let c=b=>b.cityBranchId?(0,d.is)(a,b.cityBranchId):b.countryBranchId?(0,d.Nh)(a,b.countryBranchId):!!b.countryId&&(0,d.Fx)(a,b.countryId),e=c(b.source),f=!!b.destination&&c(b.destination);if(!e&&!f)throw new d.fL("Neither the source nor destination scope of this record is allowed for this user.")}function h(a,b){return!!a.isSuperAdmin||!!b&&(!!b.cityBranchId||!!b.countryBranchId||!!b.countryId)&&(b.cityBranchId?(0,d.is)(a,b.cityBranchId):b.countryBranchId?(0,d.Nh)(a,b.countryBranchId):!!b.countryId&&(0,d.Fx)(a,b.countryId))}function i(a,b,c){let d=a;return c?.cityBranchId?d=d.eq("city_branch_id",c.cityBranchId):c?.countryBranchId?d=d.eq("country_branch_id",c.countryBranchId):c?.countryId&&(d=d.eq("country_id",c.countryId)),!b.isSuperAdmin&&(b.cityBranchIds.length>0?(d=d.or(`city_branch_id.in.(${b.cityBranchIds.join(",")}),city_branch_id.is.null`),b.countryIds.length>0&&(d=d.in("country_id",b.countryIds))):d=b.countryBranchIds.length>0?d.in("country_branch_id",b.countryBranchIds):b.countryIds.length>0?d.in("country_id",b.countryIds):d.eq("id","00000000-0000-0000-0000-000000000000")),d}},74998:a=>{a.exports=require("perf_hooks")},77598:a=>{a.exports=require("node:crypto")},86439:a=>{a.exports=require("next/dist/shared/lib/no-fallback-error.external")},91645:a=>{a.exports=require("net")},93137:(a,b,c)=>{c.r(b),c.d(b,{handler:()=>O,patchFetch:()=>N,routeModule:()=>J,serverHooks:()=>M,workAsyncStorage:()=>K,workUnitAsyncStorage:()=>L});var d={};c.r(d),c.d(d,{POST:()=>I,dynamic:()=>C});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(10641),v=c(99467),w=c(2995),x=c(39588),y=c(70151),z=c(58799),A=c(42143),B=c(97038);let C="force-dynamic",D=w.Ik({purchaseId:w.Yj().uuid()});function E(a){let b=Number(a??0);return Number.isFinite(b)?Math.round(1e4*b)/1e4:0}function F(a){return String(a??"").trim().toLowerCase().split("(")[0].trim()}async function G(a,b){let c=String(b??"").trim();if(!c)return null;if(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(c)){let b=await a`
      select id, code, name, account_id, country_id, country_branch_id, city_branch_id
      from ledgers
      where id = ${c}::uuid
        and deleted_at is null
      limit 1;
    `;if(b[0])return b[0];let d=await a`
      select id, code, name, account_id, country_id, country_branch_id, city_branch_id
      from ledgers
      where account_id = ${c}::uuid
        and deleted_at is null
      limit 1;
    `;if(d[0])return d[0]}let d=await a`
    select id, code, name, account_id, country_id, country_branch_id, city_branch_id
    from ledgers
    where code = ${c}
      and deleted_at is null
    limit 1;
  `;if(d[0])return d[0];let e=await a`
    select id from accounts
    where code = ${c}
      and deleted_at is null
    limit 1;
  `;if(e[0]?.id){let b=await a`
      select id, code, name, account_id, country_id, country_branch_id, city_branch_id
      from ledgers
      where account_id = ${e[0].id}::uuid
        and deleted_at is null
      limit 1;
    `;if(b[0])return b[0]}return null}function H(a,b,c){if(!Array.isArray(a)||2!==a.length)throw Error(`${b} must contain exactly two lines.`);let d=a.reduce((a,b)=>a+E(b.debit),0);if(d!==a.reduce((a,b)=>a+E(b.credit),0)||d!==E(c))throw Error(`${b} must be balanced to the posting amount.`)}async function I(a){let b="",c="";try{let d=await (0,x.DE)(),e=await a.json(),{purchaseId:f}=D.parse(e),g=await (0,A.rc)({req:a,scopeModule:"LOCAL_PURCHASE_TRANSFER",userId:d.userId,countryId:d.countryIds?.[0]??null,cityBranchId:d.cityBranchIds?.[0]??null,businessReference:f,payload:e});if(g.isReplayed)return(0,A.yp)(g.responseCode||200,g.responseBody);if(!g.acquired)return u.NextResponse.json({ok:!1,error:{message:"A request with this idempotency key is currently being processed or duplicate submission detected. Please wait."}},{status:409});b=g.idempotencyKey,c=g.tenantHash;let h=await (0,z.x)(async a=>await a.begin(async a=>{await a`
          select set_config(
            'request.jwt.claims',
            ${JSON.stringify({sub:d.userId,role:"authenticated"})},
            true
          );
        `;let b=(await a`
          select *
          from local_purchases
          where id = ${f}::uuid
            and deleted_at is null
          limit 1
          for update;
        `)[0];if(!b)throw Error("Purchase record not found.");(0,y.yM)(d,{resource:"purchases",action:"update",countryId:b.country_id,countryBranchId:b.country_branch_id,cityBranchId:b.city_branch_id??null});let c=E(b.final_cost);if(c<=0)throw Error("Cannot post a local purchase with zero or negative amount.");let e=await G(a,b.purchase_account_no),g=await G(a,b.sales_account_no||b.broker_account_no);if(!e||!g)throw Error("The selected Purchase (DR) and Sales/Payable (CR) ledgers must both exist before transfer.");if(!e.account_id||!g.account_id)throw Error("The selected Purchase (DR) and Sales/Payable (CR) ledgers must each have a linked account.");if(e.id===g.id)throw Error("Purchase (DR) and Sales/Payable (CR) must be different ledgers.");let h=String(b.local_currency||b.purchase_currency||"PKR").toUpperCase();F(b.payment_mode);let i=function(a){let b=F(a);return"cash"===b?"local_purchase_cash":"credit"===b?"local_purchase_credit":"advance"===b?"local_purchase_advance":"local_purchase_transfer"}(b.payment_mode),j=String(b.journal_serial_no||b.debit_journal_serial||b.credit_journal_serial||`LP-JRN-${b.id.slice(0,8).toUpperCase()}`),k=b.country_serial||b.country_serial_no||null;b.branch_serial||b.branch_serial_no;let l=b.entry_serial||null,m=new Date().toISOString(),n=m.slice(0,10),o=b.journal_entry_id??null,p=j;if(o){let b=(await a`
            select id, entry_no, status, posted_at
            from journal_entries
            where id = ${o}::uuid
              and deleted_at is null
            limit 1
            for update;
          `)[0];if(!b)throw Error("Linked journal entry was not found.");let d=await a`
            select id, account_id, debit, credit
            from journal_lines
            where journal_entry_id = ${o}::uuid
            order by id;
          `;H(d.map(a=>({debit:Number(a.debit||0),credit:Number(a.credit||0)})),"Journal entry",c),"posted"!==String(b.status)&&await a`select post_journal_entry(${o}::uuid);`,p=b.entry_no||p}else{let d=await a`
            insert into journal_entries (
              company_id,
              branch_id,
              entry_no,
              entry_date,
              status,
              memo,
              source_type,
              source_id,
              posted_at,
              posted_by,
              created_at,
              updated_at
            )
            values (
              ${b.company_id},
              ${null},
              ${`JV-${j}`},
              ${n},
              'draft',
              ${`Local Purchase - ${b.supplier_name||"Local Vendor"} (${b.goods_name}) [${b.payment_mode||"Cash"}]`},
              'local_purchase',
              ${b.id}::uuid,
              null,
              null,
              now(),
              now()
            )
            returning id, entry_no;
          `;if(o=d[0]?.id??null,p=d[0]?.entry_no??`JV-${j}`,!o)throw Error("Journal entry creation failed.");let f=await a`
            insert into journal_lines (
              journal_entry_id,
              account_id,
              description,
              debit,
              credit
            )
            values (
              ${o}::uuid,
              ${e.account_id}::uuid,
              ${`DR: Local Purchase - ${b.goods_name}`},
              ${c},
              0
            )
            returning id;
          `,h=await a`
            insert into journal_lines (
              journal_entry_id,
              account_id,
              description,
              debit,
              credit
            )
            values (
              ${o}::uuid,
              ${g.account_id}::uuid,
              ${`CR: Payable - ${b.supplier_name||"Local Vendor"} [${b.payment_mode||"Cash"}]`},
              0,
              ${c}
            )
            returning id;
          `;if(!f[0]?.id||!h[0]?.id)throw Error("Journal lines could not be created.");await a`select post_journal_entry(${o}::uuid);`}let q=b.roznamcha_entry_id??null,r={};if(q){let b=(await a`
            select id, status, posted_at, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number, main_branch_transaction_serial, city_branch_transaction_serial, entry_serial_number
            from roznamcha_entries
            where id = ${q}::uuid
              and deleted_at is null
            limit 1
            for update;
          `)[0];if(!b)throw Error("Linked Roznamcha entry was not found.");let d=await a`
            select ledger_id, debit, credit
            from roznamcha_lines
            where roznamcha_entry_id = ${q}::uuid
            order by id;
          `;if(H(d.map(a=>({debit:Number(a.debit||0),credit:Number(a.credit||0)})),"Roznamcha entry",c),"posted"!==String(b.status)||!b.posted_at)throw Error("Linked Roznamcha entry is not fully posted.");r=b}else{let d=[{ledgerId:e.id,paymentEntryType:"debit",description:`DR: Local Purchase - ${b.goods_name}`,debit:c,credit:0,currency:h,exchangeRate:1},{ledgerId:g.id,paymentEntryType:"credit",description:`CR: Payable - ${b.supplier_name||"Local Vendor"}`,debit:0,credit:c,currency:h,exchangeRate:1}],f=await a`
            select post_roznamcha_entry(
              ${b.city_branch_id||b.country_branch_id?"branch":b.country_id?"country":"super_admin"}::roznamcha_type,
              ${b.country_id}::uuid,
              ${b.country_branch_id}::uuid,
              ${b.city_branch_id}::uuid,
              ${`JV-${j}`},
              ${`LP-ROZ-${j}`},
              ${n}::date,
              ${null},
              ${j},
              ${`Local Purchase: ${b.goods_name} - ${b.supplier_name||"Local Vendor"} | ${h} ${c.toLocaleString(void 0,{minimumFractionDigits:2})} [${b.payment_mode||"Cash"}]`},
              ${a.json(d)}
            ) as id;
          `;if(!(q=String(f[0]?.id??""))){let c=await a`
              select id, super_admin_serial_number, country_transaction_serial_number, branch_transaction_serial_number, main_branch_transaction_serial, city_branch_transaction_serial, entry_serial_number
              from roznamcha_entries
              where source_module = 'local_purchase'
                and source_transaction_id = ${b.id}::uuid
              order by created_at desc
              limit 1;
            `;if(!c[0]?.id)throw Error("Roznamcha posting did not return an entry id.");q=c[0].id,r=c[0]}}if(!o||!q)throw Error("Local Purchase posting did not produce both journal and Roznamcha links.");let s=(await a`
          update local_purchases
          set status = 'posted',
              transferred_at = ${m},
              journal_entry_id = ${o}::uuid,
              roznamcha_entry_id = ${q}::uuid,
              journal_serial_no = coalesce(journal_serial_no, ${p}),
              debit_journal_serial = coalesce(debit_journal_serial, ${`${p}-DR`} ),
              credit_journal_serial = coalesce(credit_journal_serial, ${`${p}-CR`} ),
              super_admin_serial = coalesce(super_admin_serial, ${r.super_admin_serial_number||null}),
              country_serial = coalesce(country_serial, ${r.country_transaction_serial_number||k||null}),
              country_serial_no = coalesce(country_serial_no, ${r.country_transaction_serial_number||k||null}),
              branch_serial = coalesce(branch_serial, ${r.branch_transaction_serial_number||null}),
              branch_serial_no = coalesce(branch_serial_no, ${r.branch_transaction_serial_number||null}),
              entry_serial = coalesce(entry_serial, ${r.entry_serial_number||l||null}),
              updated_at = ${m}
          where id = ${b.id}::uuid
          returning *;
        `)[0];if(!s)throw Error("Failed to update the local purchase after posting.");let t=(0,B.d)(s);return{purchase:s,journalEntryId:o,journalEntryNo:p,roznamchaEntryId:q,proofState:t,transferKind:i,paymentMode:b.payment_mode||null,journalLines:2,roznamchaLines:2}}));if(!h)throw Error("Local purchase posting could not be completed.");let i={ok:!0,data:{purchase:h.purchase,posting:{journalEntryId:h.journalEntryId,roznamchaEntryId:h.roznamchaEntryId,journalSerialNo:h.journalEntryNo,paymentRoute:h.transferKind,accountingStatus:h.proofState.visualStatus,accountingStatusLabel:h.proofState.label,accountingStatusReason:h.proofState.reason,journalLines:h.journalLines,roznamchaLines:h.roznamchaLines}}};return b&&c&&await (0,A.SQ)(b,c,200,i),u.NextResponse.json(i)}catch(a){return b&&c&&await (0,A.aS)(b,c),(0,v.hS)(a)}}let J=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/erp/purchases/local-purchase/transfer/route",pathname:"/api/erp/purchases/local-purchase/transfer",filename:"route",bundlePath:"app/api/erp/purchases/local-purchase/transfer/route"},distDir:".next-verify",relativeProjectDir:"",resolvedPagePath:"B:\\accounts.dgt.llc.code_project\\ACCOUNTS.DGT.LLC\\app\\api\\erp\\purchases\\local-purchase\\transfer\\route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:K,workUnitAsyncStorage:L,serverHooks:M}=J;function N(){return(0,g.patchFetch)({workAsyncStorage:K,workUnitAsyncStorage:L})}async function O(a,b,c){var d;let e="/api/erp/purchases/local-purchase/transfer/route";"/index"===e&&(e="/");let g=await J.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:A,revalidateOnlyGenerated:B,resolvedPathname:C}=g,D=(0,j.normalizeAppPath)(e),E=!!(y.dynamicRoutes[D]||y.routes[C]);if(E&&!x){let a=!!y.routes[C],b=y.dynamicRoutes[D];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let F=null;!E||J.isDev||x||(F="/index"===(F=C)?"/":F);let G=!0===J.isDev||!E,H=E&&!G,I=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:G,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:H,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>J.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>J.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${I} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${I} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&A&&B&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!E)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await J.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:H,isOnDemandRevalidate:A})},z),b}},l=await J.handleResponse({req:a,nextConfig:w,cacheKey:F,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:B,responseGenerator:k,waitUntil:c.waitUntil});if(!E)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",A?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&E||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${I} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":I,"http.target":a.url}},g))}catch(b){if(b instanceof s.NoFallbackError||await J.onRequestError(a,b,{routerKind:"App Router",routePath:D,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:H,isOnDemandRevalidate:A})}),E)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},97038:(a,b,c)=>{c.d(b,{d:()=>d});function d(a){let b=String((a.status||a.bill_status)??"").trim().toLowerCase(),c=!!a.journal_entry_id,d=!!a.roznamcha_entry_id,e="posted"===b||"transferred"===b||"paid"===b;return c&&d&&e?{isComplete:!0,visualStatus:"black",label:"BLACK",reason:"Canonical journal and Roznamcha proof is complete."}:{isComplete:!1,visualStatus:"red",label:"RED",reason:d?c?e?"Accounting proof is incomplete.":`Bill status is still '${b||"draft"}'.`:"Journal posting is missing.":"Roznamcha posting is missing."}}}};var b=require("../../../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[95873,17210,86802,4410,82161,91692,49122,2995,31535,67218,99467],()=>b(b.s=93137));module.exports=c})();