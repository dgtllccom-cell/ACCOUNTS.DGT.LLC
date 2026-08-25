(()=>{var a={};a.id=73485,a.ids=[39409,61790,73485],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},19894:(a,b,c)=>{"use strict";c.d(b,{Th:()=>g});var d=c(21124),e=c(94083),f=c(48873);function g({children:a,...b}){let c=(0,f.c)(),g="string"==typeof a?(0,e.Oe)(c,a):a;return(0,d.jsx)("th",{...b,children:g})}},26713:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/is-bot")},27547:(a,b,c)=>{"use strict";c.r(b),c.d(b,{GlobalError:()=>D.default,__next_app__:()=>J,handler:()=>L,pages:()=>I,routeModule:()=>K,tree:()=>H});var d=c(49754),e=c(9117),f=c(46595),g=c(32324),h=c(39326),i=c(38928),j=c(20175),k=c(12),l=c(54290),m=c(12696),n=c(52574),o=c(82802),p=c(77533),q=c(45229),r=c(32822),s=c(261),t=c(26453),u=c(52474),v=c(26713),w=c(51356),x=c(62685),y=c(36225),z=c(63446),A=c(2762),B=c(45742),C=c(86439),D=c(50539),E=c(62506),F=c(91203),G={};for(let a in E)0>["default","tree","pages","GlobalError","__next_app__","routeModule","handler"].indexOf(a)&&(G[a]=()=>E[a]);c.d(b,G);let H={children:["",{children:["dashboard",{children:["accounts",{children:["setup-report",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(c.bind(c,33997)),"B:\\accounts.dgt.llc.code_project\\ACCOUNTS.DGT.LLC\\app\\dashboard\\accounts\\setup-report\\page.tsx"]}]},{}]},{}]},{layout:[()=>Promise.resolve().then(c.bind(c,50033)),"B:\\accounts.dgt.llc.code_project\\ACCOUNTS.DGT.LLC\\app\\dashboard\\layout.tsx"],error:[()=>Promise.resolve().then(c.bind(c,98400)),"B:\\accounts.dgt.llc.code_project\\ACCOUNTS.DGT.LLC\\app\\dashboard\\error.tsx"],metadata:{icon:[],apple:[],openGraph:[],twitter:[],manifest:"/manifest.webmanifest"}}]},{layout:[()=>Promise.resolve().then(c.bind(c,94644)),"B:\\accounts.dgt.llc.code_project\\ACCOUNTS.DGT.LLC\\app\\layout.tsx"],error:[()=>Promise.resolve().then(c.bind(c,41697)),"B:\\accounts.dgt.llc.code_project\\ACCOUNTS.DGT.LLC\\app\\error.tsx"],"global-error":[()=>Promise.resolve().then(c.bind(c,50539)),"B:\\accounts.dgt.llc.code_project\\ACCOUNTS.DGT.LLC\\app\\global-error.tsx"],"not-found":[()=>Promise.resolve().then(c.t.bind(c,87028,23)),"next/dist/client/components/builtin/not-found.js"],forbidden:[()=>Promise.resolve().then(c.t.bind(c,90461,23)),"next/dist/client/components/builtin/forbidden.js"],unauthorized:[()=>Promise.resolve().then(c.t.bind(c,32768,23)),"next/dist/client/components/builtin/unauthorized.js"],metadata:{icon:[],apple:[],openGraph:[],twitter:[],manifest:"/manifest.webmanifest"}}]}.children,I=["B:\\accounts.dgt.llc.code_project\\ACCOUNTS.DGT.LLC\\app\\dashboard\\accounts\\setup-report\\page.tsx"],J={require:c,loadChunk:()=>Promise.resolve()},K=new d.AppPageRouteModule({definition:{kind:e.RouteKind.APP_PAGE,page:"/dashboard/accounts/setup-report/page",pathname:"/dashboard/accounts/setup-report",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:H},distDir:".next-verify2",relativeProjectDir:""});async function L(a,b,d){var G;let M="/dashboard/accounts/setup-report/page";"/index"===M&&(M="/");let N=(0,h.getRequestMeta)(a,"postponed"),O=(0,h.getRequestMeta)(a,"minimalMode"),P=await K.prepare(a,b,{srcPage:M,multiZoneDraftMode:!1});if(!P)return b.statusCode=400,b.end("Bad Request"),null==d.waitUntil||d.waitUntil.call(d,Promise.resolve()),null;let{buildId:Q,query:R,params:S,parsedUrl:T,pageIsDynamic:U,buildManifest:V,nextFontManifest:W,reactLoadableManifest:X,serverActionsManifest:Y,clientReferenceManifest:Z,subresourceIntegrityManifest:$,prerenderManifest:_,isDraftMode:aa,resolvedPathname:ab,revalidateOnlyGenerated:ac,routerServerContext:ad,nextConfig:ae,interceptionRoutePatterns:af}=P,ag=T.pathname||"/",ah=(0,s.normalizeAppPath)(M),{isOnDemandRevalidate:ai}=P,aj=K.match(ag,_),ak=!!_.routes[ab],al=!!(aj||ak||_.routes[ah]),am=a.headers["user-agent"]||"",an=(0,v.getBotType)(am),ao=(0,q.isHtmlBotRequest)(a),ap=(0,h.getRequestMeta)(a,"isPrefetchRSCRequest")??"1"===a.headers[u.NEXT_ROUTER_PREFETCH_HEADER],aq=(0,h.getRequestMeta)(a,"isRSCRequest")??(0,n.f)(a.headers[u.RSC_HEADER]),ar=(0,t.getIsPossibleServerAction)(a),as=(0,m.checkIsAppPPREnabled)(ae.experimental.ppr)&&(null==(G=_.routes[ah]??_.dynamicRoutes[ah])?void 0:G.renderingMode)==="PARTIALLY_STATIC",at=!1,au=!1,av=as?N:void 0,aw=as&&aq&&!ap,ax=(0,h.getRequestMeta)(a,"segmentPrefetchRSCRequest"),ay=!am||(0,q.shouldServeStreamingMetadata)(am,ae.htmlLimitedBots);ao&&as&&(al=!1,ay=!1);let az=!0===K.isDev||!al||"string"==typeof N||aw,aA=ao&&as,aB=null;aa||!al||az||ar||av||aw||(aB=ab);let aC=aB;!aC&&K.isDev&&(aC=ab),K.isDev||aa||!al||!aq||aw||(0,k.d)(a.headers);let aD={...E,tree:H,pages:I,GlobalError:D.default,handler:L,routeModule:K,__next_app__:J};Y&&Z&&(0,p.setReferenceManifestsSingleton)({page:M,clientReferenceManifest:Z,serverActionsManifest:Y,serverModuleMap:(0,r.createServerModuleMap)({serverActionsManifest:Y})});let aE=a.method||"GET",aF=(0,g.getTracer)(),aG=aF.getActiveScopeSpan();try{let f=K.getVaryHeader(ab,af);b.setHeader("Vary",f);let k=async(c,d)=>{let e=new l.NodeNextRequest(a),f=new l.NodeNextResponse(b);return K.render(e,f,d).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=aF.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==i.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${aE} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${aE} ${a.url}`)})},m=async({span:e,postponed:f,fallbackRouteParams:g})=>{let i={query:R,params:S,page:ah,sharedContext:{buildId:Q},serverComponentsHmrCache:(0,h.getRequestMeta)(a,"serverComponentsHmrCache"),fallbackRouteParams:g,renderOpts:{App:()=>null,Document:()=>null,pageConfig:{},ComponentMod:aD,Component:(0,j.T)(aD),params:S,routeModule:K,page:M,postponed:f,shouldWaitOnAllReady:aA,serveStreamingMetadata:ay,supportsDynamicResponse:"string"==typeof f||az,buildManifest:V,nextFontManifest:W,reactLoadableManifest:X,subresourceIntegrityManifest:$,serverActionsManifest:Y,clientReferenceManifest:Z,setIsrStatus:null==ad?void 0:ad.setIsrStatus,dir:c(33873).join(process.cwd(),K.relativeProjectDir),isDraftMode:aa,isRevalidate:al&&!f&&!aw,botType:an,isOnDemandRevalidate:ai,isPossibleServerAction:ar,assetPrefix:ae.assetPrefix,nextConfigOutput:ae.output,crossOrigin:ae.crossOrigin,trailingSlash:ae.trailingSlash,previewProps:_.preview,deploymentId:ae.deploymentId,enableTainting:ae.experimental.taint,htmlLimitedBots:ae.htmlLimitedBots,devtoolSegmentExplorer:ae.experimental.devtoolSegmentExplorer,reactMaxHeadersLength:ae.reactMaxHeadersLength,multiZoneDraftMode:!1,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:ae.experimental.cacheLife,basePath:ae.basePath,serverActions:ae.experimental.serverActions,...at?{nextExport:!0,supportsDynamicResponse:!1,isStaticGeneration:!0,isRevalidate:!0,isDebugDynamicAccesses:at}:{},experimental:{isRoutePPREnabled:as,expireTime:ae.expireTime,staleTimes:ae.experimental.staleTimes,cacheComponents:!!ae.experimental.cacheComponents,clientSegmentCache:!!ae.experimental.clientSegmentCache,clientParamParsing:!!ae.experimental.clientParamParsing,dynamicOnHover:!!ae.experimental.dynamicOnHover,inlineCss:!!ae.experimental.inlineCss,authInterrupts:!!ae.experimental.authInterrupts,clientTraceMetadata:ae.experimental.clientTraceMetadata||[]},waitUntil:d.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:()=>{},onInstrumentationRequestError:(b,c,d)=>K.onRequestError(a,b,d,ad),err:(0,h.getRequestMeta)(a,"invokeError"),dev:K.isDev}},l=await k(e,i),{metadata:m}=l,{cacheControl:n,headers:o={},fetchTags:p}=m;if(p&&(o[z.NEXT_CACHE_TAGS_HEADER]=p),a.fetchMetrics=m.fetchMetrics,al&&(null==n?void 0:n.revalidate)===0&&!K.isDev&&!as){let a=m.staticBailoutInfo,b=Object.defineProperty(Error(`Page changed from static to dynamic at runtime ${ab}${(null==a?void 0:a.description)?`, reason: ${a.description}`:""}
see more here https://nextjs.org/docs/messages/app-static-to-dynamic-error`),"__NEXT_ERROR_CODE",{value:"E132",enumerable:!1,configurable:!0});if(null==a?void 0:a.stack){let c=a.stack;b.stack=b.message+c.substring(c.indexOf("\n"))}throw b}return{value:{kind:w.CachedRouteKind.APP_PAGE,html:l,headers:o,rscData:m.flightData,postponed:m.postponed,status:m.statusCode,segmentData:m.segmentData},cacheControl:n}},n=async({hasResolved:c,previousCacheEntry:f,isRevalidating:g,span:i})=>{let j,k=!1===K.isDev,l=c||b.writableEnded;if(ai&&ac&&!f&&!O)return(null==ad?void 0:ad.render404)?await ad.render404(a,b):(b.statusCode=404,b.end("This page could not be found")),null;if(aj&&(j=(0,x.parseFallbackField)(aj.fallback)),j===x.FallbackMode.PRERENDER&&(0,v.isBot)(am)&&(!as||ao)&&(j=x.FallbackMode.BLOCKING_STATIC_RENDER),(null==f?void 0:f.isStale)===-1&&(ai=!0),ai&&(j!==x.FallbackMode.NOT_FOUND||f)&&(j=x.FallbackMode.BLOCKING_STATIC_RENDER),!O&&j!==x.FallbackMode.BLOCKING_STATIC_RENDER&&aC&&!l&&!aa&&U&&(k||!ak)){let b;if((k||aj)&&j===x.FallbackMode.NOT_FOUND)throw new C.NoFallbackError;if(as&&!aq){let c="string"==typeof(null==aj?void 0:aj.fallback)?aj.fallback:k?ah:null;if(b=await K.handleResponse({cacheKey:c,req:a,nextConfig:ae,routeKind:e.RouteKind.APP_PAGE,isFallback:!0,prerenderManifest:_,isRoutePPREnabled:as,responseGenerator:async()=>m({span:i,postponed:void 0,fallbackRouteParams:k||au?(0,o.u)(ah):null}),waitUntil:d.waitUntil}),null===b)return null;if(b)return delete b.cacheControl,b}}let n=ai||g||!av?void 0:av;if(at&&void 0!==n)return{cacheControl:{revalidate:1,expire:void 0},value:{kind:w.CachedRouteKind.PAGES,html:y.default.EMPTY,pageData:{},headers:void 0,status:void 0}};let p=U&&as&&((0,h.getRequestMeta)(a,"renderFallbackShell")||au)?(0,o.u)(ag):null;return m({span:i,postponed:n,fallbackRouteParams:p})},p=async c=>{var f,g,i,j,k;let l,o=await K.handleResponse({cacheKey:aB,responseGenerator:a=>n({span:c,...a}),routeKind:e.RouteKind.APP_PAGE,isOnDemandRevalidate:ai,isRoutePPREnabled:as,req:a,nextConfig:ae,prerenderManifest:_,waitUntil:d.waitUntil});if(aa&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate"),K.isDev&&b.setHeader("Cache-Control","no-store, must-revalidate"),!o){if(aB)throw Object.defineProperty(Error("invariant: cache entry required but not generated"),"__NEXT_ERROR_CODE",{value:"E62",enumerable:!1,configurable:!0});return null}if((null==(f=o.value)?void 0:f.kind)!==w.CachedRouteKind.APP_PAGE)throw Object.defineProperty(Error(`Invariant app-page handler received invalid cache entry ${null==(i=o.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E707",enumerable:!1,configurable:!0});let p="string"==typeof o.value.postponed;al&&!aw&&(!p||ap)&&(O||b.setHeader("x-nextjs-cache",ai?"REVALIDATED":o.isMiss?"MISS":o.isStale?"STALE":"HIT"),b.setHeader(u.NEXT_IS_PRERENDER_HEADER,"1"));let{value:q}=o;if(av)l={revalidate:0,expire:void 0};else if(O&&aq&&!ap&&as)l={revalidate:0,expire:void 0};else if(!K.isDev)if(aa)l={revalidate:0,expire:void 0};else if(al){if(o.cacheControl)if("number"==typeof o.cacheControl.revalidate){if(o.cacheControl.revalidate<1)throw Object.defineProperty(Error(`Invalid revalidate configuration provided: ${o.cacheControl.revalidate} < 1`),"__NEXT_ERROR_CODE",{value:"E22",enumerable:!1,configurable:!0});l={revalidate:o.cacheControl.revalidate,expire:(null==(j=o.cacheControl)?void 0:j.expire)??ae.expireTime}}else l={revalidate:z.CACHE_ONE_YEAR,expire:void 0}}else b.getHeader("Cache-Control")||(l={revalidate:0,expire:void 0});if(o.cacheControl=l,"string"==typeof ax&&(null==q?void 0:q.kind)===w.CachedRouteKind.APP_PAGE&&q.segmentData){b.setHeader(u.NEXT_DID_POSTPONE_HEADER,"2");let c=null==(k=q.headers)?void 0:k[z.NEXT_CACHE_TAGS_HEADER];O&&al&&c&&"string"==typeof c&&b.setHeader(z.NEXT_CACHE_TAGS_HEADER,c);let d=q.segmentData.get(ax);return void 0!==d?(0,B.sendRenderResult)({req:a,res:b,generateEtags:ae.generateEtags,poweredByHeader:ae.poweredByHeader,result:y.default.fromStatic(d,u.RSC_CONTENT_TYPE_HEADER),cacheControl:o.cacheControl}):(b.statusCode=204,(0,B.sendRenderResult)({req:a,res:b,generateEtags:ae.generateEtags,poweredByHeader:ae.poweredByHeader,result:y.default.EMPTY,cacheControl:o.cacheControl}))}let r=(0,h.getRequestMeta)(a,"onCacheEntry");if(r&&await r({...o,value:{...o.value,kind:"PAGE"}},{url:(0,h.getRequestMeta)(a,"initURL")}))return null;if(p&&av)throw Object.defineProperty(Error("Invariant: postponed state should not be present on a resume request"),"__NEXT_ERROR_CODE",{value:"E396",enumerable:!1,configurable:!0});if(q.headers){let a={...q.headers};for(let[c,d]of(O&&al||delete a[z.NEXT_CACHE_TAGS_HEADER],Object.entries(a)))if(void 0!==d)if(Array.isArray(d))for(let a of d)b.appendHeader(c,a);else"number"==typeof d&&(d=d.toString()),b.appendHeader(c,d)}let s=null==(g=q.headers)?void 0:g[z.NEXT_CACHE_TAGS_HEADER];if(O&&al&&s&&"string"==typeof s&&b.setHeader(z.NEXT_CACHE_TAGS_HEADER,s),!q.status||aq&&as||(b.statusCode=q.status),!O&&q.status&&F.RedirectStatusCode[q.status]&&aq&&(b.statusCode=200),p&&b.setHeader(u.NEXT_DID_POSTPONE_HEADER,"1"),aq&&!aa){if(void 0===q.rscData){if(q.postponed)throw Object.defineProperty(Error("Invariant: Expected postponed to be undefined"),"__NEXT_ERROR_CODE",{value:"E372",enumerable:!1,configurable:!0});return(0,B.sendRenderResult)({req:a,res:b,generateEtags:ae.generateEtags,poweredByHeader:ae.poweredByHeader,result:q.html,cacheControl:aw?{revalidate:0,expire:void 0}:o.cacheControl})}return(0,B.sendRenderResult)({req:a,res:b,generateEtags:ae.generateEtags,poweredByHeader:ae.poweredByHeader,result:y.default.fromStatic(q.rscData,u.RSC_CONTENT_TYPE_HEADER),cacheControl:o.cacheControl})}let t=q.html;if(!p||O||aq)return(0,B.sendRenderResult)({req:a,res:b,generateEtags:ae.generateEtags,poweredByHeader:ae.poweredByHeader,result:t,cacheControl:o.cacheControl});if(at)return t.push(new ReadableStream({start(a){a.enqueue(A.ENCODED_TAGS.CLOSED.BODY_AND_HTML),a.close()}})),(0,B.sendRenderResult)({req:a,res:b,generateEtags:ae.generateEtags,poweredByHeader:ae.poweredByHeader,result:t,cacheControl:{revalidate:0,expire:void 0}});let v=new TransformStream;return t.push(v.readable),m({span:c,postponed:q.postponed,fallbackRouteParams:null}).then(async a=>{var b,c;if(!a)throw Object.defineProperty(Error("Invariant: expected a result to be returned"),"__NEXT_ERROR_CODE",{value:"E463",enumerable:!1,configurable:!0});if((null==(b=a.value)?void 0:b.kind)!==w.CachedRouteKind.APP_PAGE)throw Object.defineProperty(Error(`Invariant: expected a page response, got ${null==(c=a.value)?void 0:c.kind}`),"__NEXT_ERROR_CODE",{value:"E305",enumerable:!1,configurable:!0});await a.value.html.pipeTo(v.writable)}).catch(a=>{v.writable.abort(a).catch(a=>{console.error("couldn't abort transformer",a)})}),(0,B.sendRenderResult)({req:a,res:b,generateEtags:ae.generateEtags,poweredByHeader:ae.poweredByHeader,result:t,cacheControl:{revalidate:0,expire:void 0}})};if(!aG)return await aF.withPropagatedContext(a.headers,()=>aF.trace(i.BaseServerSpan.handleRequest,{spanName:`${aE} ${a.url}`,kind:g.SpanKind.SERVER,attributes:{"http.method":aE,"http.target":a.url}},p));await p(aG)}catch(b){throw b instanceof C.NoFallbackError||await K.onRequestError(a,b,{routerKind:"App Router",routePath:M,routeType:"render",revalidateReason:(0,f.c)({isRevalidate:al,isOnDemandRevalidate:ai})},ad),b}}},28354:a=>{"use strict";a.exports=require("util")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},29709:(a,b,c)=>{"use strict";c.d(b,{AccountSetupReport:()=>d});let d=(0,c(97954).registerClientReference)(function(){throw Error("Attempted to call AccountSetupReport() from the server but AccountSetupReport is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.")},"B:\\accounts.dgt.llc.code_project\\ACCOUNTS.DGT.LLC\\features\\accounts\\components\\account-setup-report.tsx","AccountSetupReport")},33490:(a,b,c)=>{"use strict";c.d(b,{l:()=>l});var d=c(21124),e=c(38301),f=c(14263),g=c(14257),h=c(19217),i=c(48873),j=c(29052),k=c(61790);function l({title:a,subtitle:b,columns:c,rows:l,fetchFullData:m,summary:n,totalsRow:o,filters:p,companyInfo:q,orientation:r,className:s="",variant:t="outline",size:u="sm"}){let v=(0,i.c)(),[w,x]=(0,e.useState)(!1),y=async()=>{try{x(!0);let d=l||[];m&&(d=await m()),(0,k.openGenericErpReport)({title:a,subtitle:b,lang:v,columns:c,rows:d,summary:n,totalsRow:o,filters:p,companyInfo:{name:"DAMAAN GENERAL TRADING LLC",tagline:"Wholesale & Commission Trading",address:"Dubai, United Arab Emirates",printedBy:"ERP User",...q},orientation:r})}catch(a){console.error("Journal Print Error:",a)}finally{x(!1)}};return(0,d.jsxs)(h.$,{variant:t,size:u,onClick:y,disabled:w,className:`gap-1.5 font-bold shadow-xs ${s}`,children:[w?(0,d.jsx)(f.A,{className:"h-4 w-4 animate-spin text-blue-600"}):(0,d.jsx)(g.A,{className:"h-4 w-4 text-blue-600"}),(0,d.jsx)("span",{children:w?"Preparing Report...":(0,j.t)("print",v)||"Journal Print"})]})}},33873:a=>{"use strict";a.exports=require("path")},33997:(a,b,c)=>{"use strict";c.r(b),c.d(b,{default:()=>h,metadata:()=>g});var d=c(75338),e=c(29709),f=c(58091);let g={title:"Account Setup Report"};async function h(){let a=await (0,f.Y)();return(0,d.jsx)(e.AccountSetupReport,{lang:a})}},41025:a=>{"use strict";a.exports=require("next/dist/server/app-render/dynamic-access-async-storage.external.js")},58091:(a,b,c)=>{"use strict";c.d(b,{Y:()=>f});var d=c(86802),e=c(44341);async function f(a){if(a&&e.Uv.some(b=>b.code===a))return a;let b=await (0,d.UL)(),c=b.get("erp_lang")?.value;return c&&e.Uv.some(a=>a.code===c)?c:"en"}},61790:(a,b,c)=>{"use strict";c.r(b),c.d(b,{formatCellValue:()=>g,getRowValue:()=>f,openGenericErpReport:()=>h});var d=c(94083),e=c(46758);function f(a,b){return"function"==typeof b?b(a):a[b]}function g(a,b,c){if(null==a||""===a)return"—";if(b.render)return b.render(a,{});if("date"===b.format)return(0,e.Yq)(String(a));if("currency"===b.format)return(0,e.up)(a,b.currency);if("number"===b.format)return(0,e.ZV)(a);let f=String(a);return(0,d.Oe)(c,f)}function h(a){}},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},64424:(a,b,c)=>{Promise.resolve().then(c.bind(c,89831))},71179:(a,b,c)=>{"use strict";c.d(b,{A:()=>d});let d=(0,c(23339).A)("MessageCircle",[["path",{d:"M7.9 20A9 9 0 1 0 4 16.1L2 22Z",key:"vv11sd"}]])},71213:(a,b,c)=>{"use strict";c.d(b,{A:()=>d});let d=(0,c(23339).A)("Phone",[["path",{d:"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",key:"foiqr5"}]])},77598:a=>{"use strict";a.exports=require("node:crypto")},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},89023:(a,b,c)=>{"use strict";c.d(b,{A:()=>d});let d=(0,c(23339).A)("Filter",[["polygon",{points:"22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3",key:"1yg77f"}]])},89831:(a,b,c)=>{"use strict";c.d(b,{AccountSetupReport:()=>M});var d=c(21124),e=c(38301),f=c(23312),g=c(1978),h=c(25345),i=c(89023),j=c(85351),k=c(34941),l=c(18084),m=c(3663),n=c(71563),o=c(71179),p=c(14257),q=c(88285),r=c(47089),s=c(14263),t=c(59268),u=c(91292),v=c(71213),w=c(15982),x=c(3368),y=c(37533),z=c(42378),A=c(82595),B=c(15514),C=c(19894),D=c(48873),E=c(94083),F=c(44479),G=c(29052),H=c(33490),I=c(61790);function J(a){return a?new Date(a).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"-"}function K(a){return a?new Date(a).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}):"-"}function L(a){let b=a.map((a,b)=>[b+1,a.accountCode,"SAD-"+String(a.accountSerialNumber).padStart(3,"0"),a.countrySerialNumber??"-",a.branchSerialNumber??"-",a.manualReferenceNumber??"",a.accountName,a.customerName&&"-"!==a.customerName?a.customerName:"-",a.subType,a.accountCategory,a.branchName,a.branchCode,a.countryName,a.currency,a.companyName&&"-"!==a.companyName?"Yes":"No",a.accountCategory.toLowerCase().includes("asset")||a.accountCategory.toLowerCase().includes("bank")?"Yes":"No"].map(a=>`"${String(a).replace(/"/g,'""')}"`).join(",")),c=new Blob([new Uint8Array([239,187,191]),"#,Account Number,Super Admin Account Number,Country Serial,Branch Serial,Manual Ref No,Customer Name / Account,Owner,Account Type,Category,Branch Name,Branch Code,Country,Currency,Company Status,Bank Status\n"+b.join("\n")],{type:"text/csv;charset=utf-8"}),d=URL.createObjectURL(c),e=document.createElement("a");e.href=d,e.download=`account-setup-report_${new Date().toISOString().slice(0,10)}.csv`,e.click(),URL.revokeObjectURL(d)}function M({lang:a}){let b=(0,z.useRouter)(),c=(0,D.c)()||a,M=a=>(0,E.Oe)(c,a),O=a=>(0,F.UO)(c,a),P=(0,e.useMemo)(()=>A.aG.includes(c),[c]),[Q,R]=(0,e.useState)([]),[S,T]=(0,e.useState)({companyName:"-",companyOwner:"-"}),[U,V]=(0,e.useState)(""),[W,X]=(0,e.useState)(null),[Y,Z]=(0,e.useState)(!1),[$,_]=(0,e.useState)(""),[aa,ab]=(0,e.useState)(""),[ac,ad]=(0,e.useState)("all"),[ae,af]=(0,e.useState)("all"),[ag,ah]=(0,e.useState)("all"),[ai,aj]=(0,e.useState)("all"),[ak,al]=(0,e.useState)(!1),[am,an]=(0,e.useState)(""),[ao,ap]=(0,e.useState)("all"),[aq,ar]=(0,e.useState)(""),[as,at]=(0,e.useState)("all"),[au,av]=(0,e.useState)("all"),[aw,ax]=(0,e.useState)("all"),[ay,az]=(0,e.useState)("all"),[aA,aB]=(0,e.useState)(!1),aC=(0,e.useRef)(null),[aD,aE]=(0,e.useState)("");async function aF(){Z(!0),aE("");try{let a=new URLSearchParams({limit:"2000",language:c}),b=await fetch(`/api/erp/accounting/reports/accounts/general?${a.toString()}`,{cache:"no-store",credentials:"same-origin"}),d=await b.json();d?.ok&&d?.data?(R(d.data.rows??[]),T({companyName:d.data.workspace?.companyName??"-",companyOwner:d.data.workspace?.companyOwner??"-"}),V(d.data.generatedAt??new Date().toISOString())):aE(d?.error?.message||"Failed to fetch accounts data.")}catch(a){console.error("Account report fetch error:",a),aE(a.message||"Unknown error occurred.")}finally{Z(!1)}}let[aG,aH]=(0,e.useState)(null),[aI,aJ]=(0,e.useState)(null),aK=(0,e.useMemo)(()=>[...new Set(Q.map(a=>a.countryName).filter(Boolean))].sort(),[Q]),aL=(0,e.useMemo)(()=>[...new Set(("all"!==ac?Q.filter(a=>a.countryName===ac):Q).map(a=>a.branchName||a.cityBranchName||a.branchCode).filter(Boolean))].sort(),[Q,ac]),aM=(0,e.useMemo)(()=>[...new Set(Q.map(a=>a.accountCategory).filter(Boolean))].sort(),[Q]),aN=(0,e.useMemo)(()=>[...new Set(Q.map(a=>a.subType).filter(Boolean))].sort(),[Q]),aO=(0,e.useMemo)(()=>Q.filter(a=>{if(am){let b=am.toLowerCase();if("all"===ao){let c=a.accountCode.toLowerCase().includes(b)||(a.manualReferenceNumber??"").toLowerCase().includes(b),d=a.accountName.toLowerCase().includes(b),e=a.countryName.toLowerCase().includes(b),f=[a.branchName,a.mainBranchName,a.cityBranchName,a.branchCode].some(a=>a.toLowerCase().includes(b));if(!c&&!d&&!e&&!f)return!1}else if("code"===ao){if(!a.accountCode.toLowerCase().includes(b)&&!(a.manualReferenceNumber??"").toLowerCase().includes(b))return!1}else if("name"===ao){if(!a.accountName.toLowerCase().includes(b))return!1}else if("country"===ao){if(!a.countryName.toLowerCase().includes(b))return!1}else if("branch"===ao&&![a.branchName,a.mainBranchName,a.cityBranchName,a.branchCode].some(a=>a.toLowerCase().includes(b)))return!1}return(!aq||!!a.accountName.toLowerCase().includes(aq.toLowerCase()))&&("all"===as||a.countryName===as)&&("all"===au||!!((a,b)=>{let c=b.toLowerCase();return[a.branchName,a.mainBranchName,a.cityBranchName,a.branchCode].filter(Boolean).some(a=>a.toLowerCase()===c)})(a,au))&&("all"===aw||a.accountCategory===aw)&&("all"===ay||a.subType===ay)}),[Q,am,ao,aq,as,au,aw,ay]),aP=(0,e.useMemo)(()=>aO.filter(a=>a.accountCategory.toLowerCase().includes("customer")||a.customerNumber?.startsWith("CUST")).length,[aO]),aQ=(0,e.useMemo)(()=>aO.filter(a=>a.companyName&&"-"!==a.companyName).length,[aO]),aR=(0,e.useMemo)(()=>aO.filter(a=>a.accountCategory.toLowerCase().includes("bank")||a.accountCategory.toLowerCase().includes("asset")).length,[aO]),aS=(0,e.useMemo)(()=>aO.filter(a=>a.accountCategory.toLowerCase().includes("expense")||a.subType.toLowerCase().includes("expense")).length,[aO]),aT=(0,e.useMemo)(()=>{let a=new Map;for(let b of aO){let c=b.countryName||"Unknown Country";a.has(c)||a.set(c,{total:0,customers:0,companies:0,banks:0,expenses:0,personal:0,currency:b.currency||"-"});let d=a.get(c);d.total+=1;let e=(b.accountCategory||"").toLowerCase(),f=(b.subType||"").toLowerCase();e.includes("expense")||f.includes("expense")?d.expenses+=1:e.includes("bank")||e.includes("asset")?d.banks+=1:b.companyName&&"-"!==b.companyName?d.companies+=1:e.includes("customer")||(b.customerNumber||"").startsWith("CUST")?d.customers+=1:d.personal+=1}return Array.from(a.entries()).map(([a,b])=>({name:a,...b})).sort((a,b)=>b.total-a.total)},[aO]);function aU(){_(""),ab(""),ad("all"),af("all"),ah("all"),aj("all"),an(""),ar(""),at("all"),av("all"),ax("all"),az("all")}let aV=am||aq||"all"!==as||"all"!==au||"all"!==aw||"all"!==ay,aW=Object.values({accNo:am,accName:aq,country:as,branch:au,accType:aw,subType:ay}).filter(a=>a&&"all"!==a).length,aX=aO[0]??Q[0]??null,aY=[{key:"accountCode",label:"Account Number"},{key:"sadCode",label:"Super Admin Account Number"},{key:"countrySerialNumber",label:"Country Serial"},{key:"branchSerialNumber",label:"Branch Serial"},{key:"manualReferenceNumber",label:"Manual Ref No"},{key:"accountName",label:"Customer Name / Account"},{key:"customerName",label:"Owner"},{key:"subType",label:"Account Type"},{key:"accountCategory",label:"Category",format:"status"},{key:"branchName",label:"Branch Name"},{key:"branchCode",label:"Branch Code"},{key:"countryName",label:"Country"},{key:"currency",label:"Currency"}],aZ={TotalAccounts:aO.length,TotalCustomers:aT.reduce((a,b)=>a+b.customers,0),TotalCompanies:aT.reduce((a,b)=>a+b.companies,0),TotalBanks:aT.reduce((a,b)=>a+b.banks,0),TotalExpenses:aT.reduce((a,b)=>a+(b.expenses||0),0)},a$=(0,e.useMemo)(()=>aO.map(a=>({...a,sadCode:"SAD-"+String(a.accountSerialNumber).padStart(3,"0")})),[aO]),a_={countryName:"all"!==as?as:aX?.countryName??"All Countries",countryCode:aX?.countryCode||"-",branchName:"all"!==au?au:aX?.branchName??"All Branches",branchCode:aX?.branchCode||"-",userName:W?.user.fullName??S.companyOwner??"Current User",userId:W?.user.id?W.user.id.slice(0,12).toUpperCase():"-",userRole:W?.roles?.[0]?.replace(/_/g," ")??"-",userPassword:"Protected",branchPassword:"Protected",date:J(U),time:K(U)};return(0,d.jsxs)("div",{className:"asr-shell",dir:P?"rtl":"ltr",children:[(0,d.jsx)(N,{}),aI&&(0,f.createPortal)((0,d.jsxs)("div",{className:"flex items-center gap-2 flex-wrap",children:[(0,d.jsx)("h1",{className:"text-xs font-black text-slate-900 dark:text-slate-100 whitespace-nowrap",children:M("Account Setup Report")}),(0,d.jsxs)("span",{className:"asr-badge text-[9px] px-1.5 py-0.5",children:[Y?"...":aO.length," ",M("accounts")]}),aV&&(0,d.jsxs)("span",{className:"asr-badge asr-badge-orange text-[9px] px-1.5 py-0.5",children:[aW," ",M("active")]}),(0,d.jsxs)("div",{className:"hidden lg:flex items-center gap-1.5 text-[9px] text-slate-400 font-medium",children:[(0,d.jsx)("span",{className:"h-3 w-px bg-slate-200 dark:bg-slate-800"}),(0,d.jsxs)("span",{className:"text-slate-500 font-extrabold uppercase",children:[M("Country"),":"]}),(0,d.jsx)("span",{className:"text-slate-800 dark:text-slate-200 font-bold",children:a_.countryName}),(0,d.jsx)("span",{className:"text-slate-300 dark:text-slate-700",children:"|"}),(0,d.jsxs)("span",{className:"text-slate-500 font-extrabold uppercase",children:[M("Branch"),":"]}),(0,d.jsx)("span",{className:"text-slate-800 dark:text-slate-200 font-bold truncate max-w-[80px]",children:a_.branchName}),(0,d.jsx)("span",{className:"text-slate-300 dark:text-slate-700",children:"|"}),(0,d.jsxs)("span",{className:"text-slate-500 font-extrabold uppercase",children:[M("User"),":"]}),(0,d.jsx)("span",{className:"text-slate-800 dark:text-slate-200 font-bold",children:a_.userName}),(0,d.jsx)("span",{className:"text-slate-300 dark:text-slate-700",children:"|"}),(0,d.jsxs)("span",{className:"text-slate-500 font-extrabold uppercase",children:[M("Role"),":"]}),(0,d.jsx)("span",{className:"text-slate-800 dark:text-slate-200 font-bold whitespace-nowrap",children:a_.userRole})]})]}),aI),aG&&(0,f.createPortal)((0,d.jsxs)("div",{className:"flex items-center gap-1.5 shrink-0",children:[(0,d.jsxs)("div",{className:"flex items-center border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 h-7 shadow-sm",children:[(0,d.jsxs)("select",{className:"h-full bg-slate-50 dark:bg-slate-800 text-[10px] font-bold px-1.5 border-r border-slate-200 dark:border-slate-800 outline-none text-slate-500 cursor-pointer hover:bg-slate-100",value:ao,onChange:a=>ap(a.target.value),children:[(0,d.jsx)("option",{value:"all",children:M("All")}),(0,d.jsx)("option",{value:"code",children:M("Account Number")}),(0,d.jsx)("option",{value:"name",children:M("Name")}),(0,d.jsx)("option",{value:"country",children:M("Country")}),(0,d.jsx)("option",{value:"branch",children:M("Branch")})]}),(0,d.jsx)("input",{type:"text",placeholder:M("Search"),className:"h-full px-2 text-[10px] font-semibold outline-none bg-transparent w-[90px] focus:w-[130px] transition-all text-slate-900 dark:text-slate-100",value:am,onChange:a=>{an(a.target.value),_(a.target.value)}})]}),(0,d.jsx)("button",{type:"button",className:"asr-icon-btn",onClick:aF,title:(0,G.t)(c,"common.refresh","Refresh"),disabled:Y,children:(0,d.jsx)(h.A,{className:(0,B.cn)("h-3 w-3",Y&&"animate-spin")})}),(0,d.jsxs)("button",{type:"button",className:(0,B.cn)("asr-toolbar-btn",ak&&"asr-toolbar-btn-active"),onClick:()=>al(a=>!a),children:[(0,d.jsx)(i.A,{className:"h-3 w-3"}),(0,d.jsx)("span",{children:M("Filters")}),aW>0&&(0,d.jsx)("span",{className:"asr-filter-count",children:aW}),(0,d.jsx)(j.A,{className:(0,B.cn)("h-3 w-3 transition-transform",ak&&"rotate-180")})]}),(0,d.jsx)(H.l,{title:(0,G.t)(c,"nav.account_setup_report","Account Setup Report"),subtitle:`${(0,G.t)(c,"common.total","Total")} ${aO.length} ${(0,G.t)(c,"acct.asr_accounts_word_lc","accounts")} • ${a_.countryName} / ${a_.branchName}`,columns:aY,rows:a$,summary:aZ,orientation:"landscape"}),(0,d.jsxs)("div",{className:"relative",ref:aC,children:[(0,d.jsx)("button",{type:"button",className:"asr-icon-btn",onClick:()=>aB(a=>!a),title:(0,G.t)(c,"acct.asr_export_share","Export & Share"),children:(0,d.jsx)(k.A,{className:"h-4 w-4"})}),aA&&(0,d.jsxs)("div",{className:"asr-action-menu",children:[(0,d.jsx)("div",{className:"asr-action-section-label",children:M("Export")}),[{icon:l.A,label:"Export Excel",color:"text-emerald-600",action:()=>L(aO)},{icon:m.A,label:"Export CSV",color:"text-blue-600",action:()=>L(aO)},{icon:m.A,label:"Export PDF",color:"text-red-600",action:()=>void(0,I.openGenericErpReport)({title:"Account Setup Report",subtitle:`Total ${aO.length} accounts • ${a_.countryName} / ${a_.branchName}`,lang:c,columns:aY,rows:a$,summary:aZ,filters:[{label:"Country",value:a_.countryName},{label:"Branch",value:a_.branchName},{label:"User",value:a_.userName},{label:"Role",value:a_.userRole},{label:"Category",value:aw},{label:"Search",value:am.trim()||"All"}],companyInfo:{country:a_.countryName,branch:a_.branchName,printedBy:a_.userName,reportPeriod:`Generated on ${a_.date} ${a_.time}`},orientation:"landscape"})}].map(({icon:a,label:b,color:c,action:e})=>(0,d.jsxs)("button",{type:"button",className:"asr-action-item",onClick:()=>{e(),aB(!1)},children:[(0,d.jsx)(a,{className:(0,B.cn)("h-3.5 w-3.5 shrink-0",c)}),(0,d.jsx)("span",{children:M(b)})]},b)),(0,d.jsx)("div",{className:"asr-action-divider"}),(0,d.jsx)("div",{className:"asr-action-section-label",children:M("Share")}),[{icon:n.A,label:"Email Report",color:"text-indigo-600",action:()=>{let a=encodeURIComponent("Account Setup Report"),b=encodeURIComponent(`Account Setup Report
Accounts: ${aO.length}
Generated on: ${new Date(U).toLocaleString()}`);window.location.href=`mailto:?subject=${a}&body=${b}`}},{icon:o.A,label:"WhatsApp Share",color:"text-emerald-600",action:()=>{let a=encodeURIComponent(`Account Setup Report: ${aO.length} accounts found.`);window.open(`https://wa.me/?text=${a}`,"_blank","noopener,noreferrer")}}].map(({icon:a,label:b,color:c,action:e})=>(0,d.jsxs)("button",{type:"button",className:"asr-action-item",onClick:()=>{e(),aB(!1)},children:[(0,d.jsx)(a,{className:(0,B.cn)("h-3.5 w-3.5 shrink-0",c)}),(0,d.jsx)("span",{children:M(b)})]},b)),(0,d.jsx)("div",{className:"asr-action-divider"}),(0,d.jsx)("div",{className:"asr-action-section-label",children:M("Print")}),[{icon:p.A,label:"Print Report",action:()=>window.print()},{icon:g.m,label:"Download Report",action:()=>L(aO)}].map(({icon:a,label:b,action:c})=>(0,d.jsxs)("button",{type:"button",className:"asr-action-item",onClick:()=>{c(),aB(!1)},children:[(0,d.jsx)(a,{className:"h-3.5 w-3.5 shrink-0 text-slate-500"}),(0,d.jsx)("span",{children:M(b)})]},b))]})]})]}),aG),ak&&(0,d.jsxs)("div",{className:"asr-filter-panel",children:[(0,d.jsxs)("div",{className:"asr-filter-grid",children:[(0,d.jsxs)("div",{className:"asr-filter-field",children:[(0,d.jsx)("label",{className:"asr-filter-label",children:M("Account Number")}),(0,d.jsxs)("div",{className:"relative",children:[(0,d.jsx)(q.A,{className:"asr-filter-icon"}),(0,d.jsx)("input",{className:"asr-filter-input",placeholder:M("Search"),value:$,onChange:a=>_(a.target.value)})]})]}),(0,d.jsxs)("div",{className:"asr-filter-field",children:[(0,d.jsx)("label",{className:"asr-filter-label",children:M("Account Name")}),(0,d.jsxs)("div",{className:"relative",children:[(0,d.jsx)(q.A,{className:"asr-filter-icon"}),(0,d.jsx)("input",{className:"asr-filter-input",placeholder:M("Search"),value:aa,onChange:a=>ab(a.target.value)})]})]}),(0,d.jsxs)("div",{className:"asr-filter-field",children:[(0,d.jsx)("label",{className:"asr-filter-label",children:M("Country")}),(0,d.jsxs)("select",{className:"asr-filter-select",value:ac,onChange:a=>ad(a.target.value),children:[(0,d.jsx)("option",{value:"all",children:M("All Countries")}),aK.map(a=>(0,d.jsx)("option",{value:a,children:a},a))]})]}),(0,d.jsxs)("div",{className:"asr-filter-field",children:[(0,d.jsx)("label",{className:"asr-filter-label",children:M("Branch")}),(0,d.jsxs)("select",{className:"asr-filter-select",value:ae,onChange:a=>af(a.target.value),children:[(0,d.jsx)("option",{value:"all",children:M("All Branches")}),aL.map(a=>(0,d.jsx)("option",{value:a,children:a},a))]})]}),(0,d.jsxs)("div",{className:"asr-filter-field",children:[(0,d.jsx)("label",{className:"asr-filter-label",children:M("Account Type")}),(0,d.jsxs)("select",{className:"asr-filter-select",value:ag,onChange:a=>ah(a.target.value),children:[(0,d.jsx)("option",{value:"all",children:M("All Types")}),aM.map(a=>(0,d.jsx)("option",{value:a,children:O(a)},a))]})]}),(0,d.jsxs)("div",{className:"asr-filter-field",children:[(0,d.jsx)("label",{className:"asr-filter-label",children:M("Sub Type")}),(0,d.jsxs)("select",{className:"asr-filter-select",value:ai,onChange:a=>aj(a.target.value),children:[(0,d.jsx)("option",{value:"all",children:M("All Sub Types")}),aN.map(a=>(0,d.jsx)("option",{value:a,children:O(a)},a))]})]})]}),(0,d.jsxs)("div",{className:"flex items-center gap-2 mt-3",children:[(0,d.jsx)("button",{type:"button",className:"asr-btn-primary",onClick:function(){an($),ar(aa),at(ac),av(ae),ax(ag),az(ai),al(!1)},children:M("Apply Filters")}),(0,d.jsxs)("button",{type:"button",className:"asr-btn-secondary",onClick:aU,children:[(0,d.jsx)(r.A,{className:"h-3.5 w-3.5"})," ",M("Reset")]})]})]}),(0,d.jsx)("div",{className:"asr-executive-panel",children:(0,d.jsxs)("div",{className:"flex flex-col gap-3 p-3.5",children:[(0,d.jsxs)("div",{className:"flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5",children:[(0,d.jsxs)("div",{className:"flex items-center gap-2",children:[(0,d.jsx)("span",{className:"grid h-5 w-5 place-items-center rounded-md bg-blue-600 text-white font-black text-[10px] shadow-sm",children:(0,G.t)(c,"report.scope_global","Global")}),(0,d.jsxs)("h2",{className:"text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100",children:[M("Country-Wise Accounts Summary Report")," (",aT.length," ",1===aT.length?M("Country"):M("Countries"),")"]}),(0,d.jsxs)("span",{className:"inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-extrabold text-slate-600 dark:text-slate-300 flex-wrap",children:[(0,d.jsxs)("span",{children:[M("Total Accounts"),": ",(0,d.jsx)("strong",{className:"text-blue-600 dark:text-blue-400",children:aO.length})]})," |",(0,d.jsxs)("span",{children:[M("Customers"),": ",(0,d.jsx)("strong",{className:"text-emerald-600 dark:text-emerald-400",children:aP})]})," |",(0,d.jsxs)("span",{children:[M("Companies"),": ",(0,d.jsx)("strong",{className:"text-purple-600 dark:text-purple-400",children:aQ})]})," |",(0,d.jsxs)("span",{children:[M("Banks"),": ",(0,d.jsx)("strong",{className:"text-amber-600 dark:text-amber-400",children:aR})]})," |",(0,d.jsxs)("span",{children:[M("Expenses"),": ",(0,d.jsx)("strong",{className:"text-rose-600 dark:text-rose-400",children:aS})]})]})]}),aV&&(0,d.jsxs)("button",{type:"button",onClick:aU,className:"asr-clear-chip-compact",children:[(0,d.jsx)(r.A,{className:"h-3 w-3"})," ",(0,G.t)(c,"acct.asr_clear_filters","Clear filters")]})]}),(0,d.jsx)("div",{className:"grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3",children:Y?Array.from({length:3}).map((a,b)=>(0,d.jsx)("div",{className:"rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 h-24 animate-pulse"},b)):0===aT.length?(0,d.jsx)("div",{className:"col-span-full text-center py-5 text-xs text-slate-400 font-bold",children:(0,G.t)(c,"acct.asr_no_country_accounts_found","No country accounts found matching the criteria.")}):aT.map(a=>{let b=as===a.name;return(0,d.jsxs)("div",{onClick:()=>at(b?"all":a.name),className:(0,B.cn)("group relative overflow-hidden rounded-xl border p-3 transition-all duration-200 cursor-pointer shadow-xs",b?"bg-blue-50/95 dark:bg-blue-950/60 border-blue-600 shadow-md ring-2 ring-blue-500/20":"bg-white dark:bg-slate-900/90 border-slate-200/90 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-700 hover:shadow-md"),children:[(0,d.jsxs)("div",{className:"flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-2 mb-2",children:[(0,d.jsxs)("div",{className:"flex items-center gap-1.5 min-w-0",children:[(0,d.jsx)("span",{className:"grid h-5 w-5 place-items-center rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-black text-[9px] shrink-0",children:a.name.slice(0,2).toUpperCase()}),(0,d.jsx)("span",{className:"font-black text-[11px] text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 transition-colors",children:a.name})]}),(0,d.jsxs)("span",{className:"inline-flex items-center rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-black text-white shadow-xs shrink-0",children:[a.total," ",1===a.total?(0,G.t)(c,"acct.asr_acc_singular","Acc"):(0,G.t)(c,"acct.asr_acc_plural","Accs")]})]}),(0,d.jsxs)("div",{className:"grid grid-cols-5 gap-1 text-center",children:[(0,d.jsxs)("div",{className:"rounded bg-emerald-50 dark:bg-emerald-950/40 p-1 border border-emerald-100 dark:border-emerald-900/40",children:[(0,d.jsx)("div",{className:"text-[7px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider",children:(0,G.t)(c,"acct.asr_cust_abbr","Cust")}),(0,d.jsx)("div",{className:"text-[11px] font-black text-emerald-700 dark:text-emerald-300 font-mono leading-none mt-0.5",children:a.customers})]}),(0,d.jsxs)("div",{className:"rounded bg-purple-50 dark:bg-purple-950/40 p-1 border border-purple-100 dark:border-purple-900/40",children:[(0,d.jsx)("div",{className:"text-[7px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider",children:(0,G.t)(c,"acct.asr_comp_abbr","Comp")}),(0,d.jsx)("div",{className:"text-[11px] font-black text-purple-700 dark:text-purple-300 font-mono leading-none mt-0.5",children:a.companies})]}),(0,d.jsxs)("div",{className:"rounded bg-amber-50 dark:bg-amber-950/40 p-1 border border-amber-100 dark:border-amber-900/40",children:[(0,d.jsx)("div",{className:"text-[7px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider",children:(0,G.t)(c,"bdash.bank","Bank")}),(0,d.jsx)("div",{className:"text-[11px] font-black text-amber-700 dark:text-amber-300 font-mono leading-none mt-0.5",children:a.banks})]}),(0,d.jsxs)("div",{className:"rounded bg-rose-50 dark:bg-rose-950/40 p-1 border border-rose-100 dark:border-rose-900/40",children:[(0,d.jsx)("div",{className:"text-[7px] font-black uppercase text-rose-600 dark:text-rose-400 tracking-wider",children:(0,G.t)(c,"acct.asr_exp_abbr","Exp")}),(0,d.jsx)("div",{className:"text-[11px] font-black text-rose-700 dark:text-rose-300 font-mono leading-none mt-0.5",children:a.expenses})]}),(0,d.jsxs)("div",{className:"rounded bg-slate-50 dark:bg-slate-800/60 p-1 border border-slate-150 dark:border-slate-700/50",children:[(0,d.jsx)("div",{className:"text-[7px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider",children:(0,G.t)(c,"acct.asr_pers_abbr","Pers")}),(0,d.jsx)("div",{className:"text-[11px] font-black text-slate-700 dark:text-slate-200 font-mono leading-none mt-0.5",children:a.personal})]})]})]},a.name)})})]})}),(0,d.jsxs)("div",{className:"asr-table-wrap",children:[(0,d.jsx)("div",{className:"overflow-x-auto",children:(0,d.jsxs)("table",{className:"asr-table",children:[(0,d.jsx)("thead",{children:(0,d.jsx)("tr",{children:["#","Account Number","Super Admin Account Number","Country Serial","Branch Serial","Manual Ref No","Customer Name / Account","Owner","Account Type","Category","Branch Name","Branch Code","Country","Currency","Company","Bank","Contact","Actions"].map(a=>(0,d.jsx)(C.Th,{className:"asr-th",children:a},a))})}),(0,d.jsx)("tbody",{children:Y?(0,d.jsx)("tr",{children:(0,d.jsx)("td",{colSpan:18,className:"asr-empty-cell",children:(0,d.jsxs)("div",{className:"flex items-center justify-center gap-2",children:[(0,d.jsx)(s.A,{className:"h-4 w-4 animate-spin text-[#1f5eff]"}),(0,d.jsx)("span",{children:M("Loading accounts report...")})]})})}):aD?(0,d.jsx)("tr",{children:(0,d.jsxs)("td",{colSpan:18,className:"asr-empty-cell text-red-500 font-bold",children:["Error: ",aD]})}):aO.length>0?aO.map((a,e)=>{let f=!!(a.companyName&&"-"!==a.companyName),g=a.accountCategory.toLowerCase().includes("asset")||a.accountCategory.toLowerCase().includes("bank");return(0,d.jsxs)("tr",{className:"asr-row",children:[(0,d.jsx)("td",{className:"asr-td asr-td-num",children:e+1}),(0,d.jsxs)("td",{className:"asr-td",children:[(0,d.jsx)("div",{className:"font-mono font-bold text-[#1455ff] text-[11px] leading-tight whitespace-nowrap",children:a.accountCode}),a.journalCode&&a.journalCode!==a.accountCode&&(0,d.jsx)("div",{className:"text-[9px] text-[var(--asr-muted)] font-mono mt-0.5",children:a.journalCode})]}),(0,d.jsx)("td",{className:"asr-td text-center",children:(0,d.jsx)("span",{className:"font-mono text-[10px] font-bold text-slate-700",children:"SAD-"+String(a.accountSerialNumber).padStart(3,"0")})}),(0,d.jsx)("td",{className:"asr-td text-center",children:(0,d.jsx)("span",{className:"font-mono text-[10px] font-bold text-slate-600",children:a.countrySerialNumber})}),(0,d.jsx)("td",{className:"asr-td text-center",children:(0,d.jsx)("span",{className:"font-mono text-[10px] font-bold text-slate-600",children:a.branchSerialNumber})}),(0,d.jsx)("td",{className:"asr-td",children:(0,d.jsx)("span",{className:"font-mono text-[10px] font-semibold text-slate-500",children:a.manualReferenceNumber||"-"})}),(0,d.jsx)("td",{className:"asr-td",children:(0,d.jsxs)("div",{className:"flex items-center gap-2",children:[(0,d.jsx)("div",{className:"asr-avatar",children:a.accountName.charAt(0).toUpperCase()}),(0,d.jsxs)("div",{children:[(0,d.jsx)("div",{className:"font-black text-[var(--asr-title)] text-[11px] leading-tight",children:a.accountName}),(0,d.jsx)("div",{className:"text-[9px] text-[var(--asr-muted)] font-mono mt-0.5",children:a.customerNumber})]})]})}),(0,d.jsx)("td",{className:"asr-td",children:(0,d.jsx)("span",{className:"font-bold text-[#10b981] text-[11px]",children:a.customerName&&"-"!==a.customerName?a.customerName:"-"})}),(0,d.jsx)("td",{className:"asr-td",children:(0,d.jsx)("span",{className:"asr-type-badge",children:O(a.subType)})}),(0,d.jsx)("td",{className:"asr-td",children:(0,d.jsx)("span",{className:(0,B.cn)("asr-cat-badge",{"asr-cat-asset":"asset"===a.accountCategory.toLowerCase(),"asr-cat-expense":"expense"===a.accountCategory.toLowerCase(),"asr-cat-income":"income"===a.accountCategory.toLowerCase(),"asr-cat-liability":"liability"===a.accountCategory.toLowerCase(),"asr-cat-equity":"equity"===a.accountCategory.toLowerCase()}),children:O(a.accountCategory)})}),(0,d.jsxs)("td",{className:"asr-td",children:[(0,d.jsx)("div",{className:"font-semibold text-[11px] leading-tight",children:a.branchName}),(0,d.jsx)("div",{className:"text-[9px] text-[var(--asr-muted)] mt-0.5",children:O(a.branchType)})]}),(0,d.jsx)("td",{className:"asr-td",children:(0,d.jsx)("span",{className:"font-mono font-black text-[10px] text-[#1455ff]",children:a.branchCode||"-"})}),(0,d.jsx)("td",{className:"asr-td font-semibold text-[11px]",children:a.countryName}),(0,d.jsx)("td",{className:"asr-td",children:(0,d.jsx)("span",{className:"font-mono font-bold text-[11px]",children:a.currency})}),(0,d.jsx)("td",{className:"asr-td text-center",children:a.companyId?(0,d.jsx)("button",{type:"button",onClick:()=>b.push(`/dashboard/settings/company-setup?companyId=${a.companyId}`),className:"cursor-pointer hover:scale-110 transition-transform focus:outline-none block mx-auto",title:(0,G.t)(c,"acct.asr_click_view_company_profile","Click to view company profile file"),children:(0,d.jsx)(t.A,{className:"h-4 w-4 text-emerald-500 mx-auto"})}):f?(0,d.jsx)(t.A,{className:"h-4 w-4 text-emerald-500 mx-auto opacity-60"}):(0,d.jsx)(u.A,{className:"h-4 w-4 text-red-400 mx-auto"})}),(0,d.jsx)("td",{className:"asr-td text-center",children:a.bankId?(0,d.jsx)("button",{type:"button",onClick:()=>b.push(`/dashboard/settings/company-setup?companyId=${a.bankId}`),className:"cursor-pointer hover:scale-110 transition-transform focus:outline-none block mx-auto",title:(0,G.t)(c,"acct.asr_click_view_bank_profile","Click to view bank profile file"),children:(0,d.jsx)(t.A,{className:"h-4 w-4 text-emerald-500 mx-auto"})}):g?(0,d.jsx)(t.A,{className:"h-4 w-4 text-emerald-500 mx-auto opacity-60"}):(0,d.jsx)(u.A,{className:"h-4 w-4 text-red-400 mx-auto"})}),(0,d.jsx)("td",{className:"asr-td",children:(0,d.jsx)("div",{className:"flex items-center justify-center gap-1.5",children:(()=>{let b=a.contacts;if("string"==typeof b)try{b=JSON.parse(b)}catch(a){b=[]}let e=Array.isArray(b)?b:[],f=e.filter(a=>a?.type?.toLowerCase().includes("mobile")||a?.type?.toLowerCase().includes("whatsapp")||a?.type?.toLowerCase().includes("phone")||a?.type?.toLowerCase().includes("landline")||a?.type?.toLowerCase().includes("office")),g=e.filter(a=>a?.type?.toLowerCase().includes("email"));return(0,d.jsxs)(d.Fragment,{children:[(0,d.jsx)("span",{className:(0,B.cn)("asr-contact-dot",f?.length?"bg-rose-50 text-rose-500 border-rose-100":"bg-slate-50 text-slate-300 border-slate-100"),title:f?.length?f.map(a=>`${a.type}: ${a.value}`).join("\\n"):(0,G.t)(c,"acct.asr_no_phone","No Phone"),children:(0,d.jsx)(v.A,{className:"h-2.5 w-2.5"})}),(0,d.jsx)("span",{className:(0,B.cn)("asr-contact-dot",g?.length?"bg-purple-50 text-purple-500 border-purple-100":"bg-slate-50 text-slate-300 border-slate-100"),title:g?.length?g.map(a=>`${a.type}: ${a.value}`).join("\\n"):(0,G.t)(c,"acct.asr_no_email","No Email"),children:(0,d.jsx)(w.A,{className:"h-2.5 w-2.5"})})]})})()})}),(0,d.jsx)("td",{className:"asr-td",children:(0,d.jsxs)("div",{className:"flex items-center gap-1.5",children:[(0,d.jsxs)("button",{type:"button",className:"asr-action-btn asr-action-view",title:(0,G.t)(c,"acct.asr_view_account_profile","View Account Profile"),onClick:()=>b.push(`/dashboard/accounts/view?accountId=${a.accountId}`),children:[(0,d.jsx)(x.A,{className:"h-3.5 w-3.5"}),(0,d.jsx)("span",{children:M("View")})]}),(0,d.jsxs)("button",{type:"button",className:"asr-action-btn asr-action-edit",title:(0,G.t)(c,"acct.asr_edit_account","Edit Account"),onClick:()=>b.push(`/dashboard/accounts/setup?accountId=${a.accountId}&mode=edit`),children:[(0,d.jsx)(y.A,{className:"h-3.5 w-3.5"}),(0,d.jsx)("span",{children:M("Edit")})]})]})})]},a.accountId)}):(0,d.jsx)("tr",{children:(0,d.jsx)("td",{colSpan:18,className:"asr-empty-cell",children:M("No accounts found matching the selected filters.")})})})]})}),(0,d.jsxs)("div",{className:"asr-table-footer",children:[(0,d.jsxs)("span",{children:[M("Showing")," ",(0,d.jsx)("strong",{children:aO.length})," ",M("of")," ",(0,d.jsx)("strong",{children:Q.length})," ",M("accounts")]}),(0,d.jsxs)("span",{className:"text-[var(--asr-muted)]",children:[M("Generated")," ",J(U)," ",M("at")," ",K(U)]})]})]})]})}function N(){return(0,d.jsx)("style",{children:`
      .asr-shell {
        --asr-bg: #f0f5ff;
        --asr-card: rgba(255,255,255,.97);
        --asr-line: #d9e4f5;
        --asr-title: #0a1028;
        --asr-muted: #64728b;
        --asr-head: #f3f7ff;
        --asr-hover: #f7faff;
        display: flex;
        flex-direction: column;
        gap: 10px;
        background: var(--asr-bg);
        padding: 12px 16px;
        min-height: 100%;
        font-family: "Inter", "Segoe UI", ui-sans-serif, system-ui, sans-serif;
        font-size: 12px;
        font-feature-settings: "cv02", "cv03", "cv04", "cv11";
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
      }
      .dark .asr-shell {
        --asr-bg: #071120;
        --asr-card: #101b2f;
        --asr-line: #24344c;
        --asr-title: #f8fafc;
        --asr-muted: #90a4c2;
        --asr-head: #152238;
        --asr-hover: #182842;
      }

      /* Header */
      .asr-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        background: var(--asr-card);
        border: 1.5px solid var(--asr-line);
        border-radius: 12px;
        padding: 12px 16px;
        box-shadow: 0 4px 16px rgba(15,23,42,0.04);
      }
      .asr-header-icon {
        width: 30px; height: 30px;
        border-radius: 10px;
        background: rgba(31,94,255,.1);
        display: grid; place-items: center;
        flex-shrink: 0;
        border: 1px solid rgba(31,94,255,.2);
      }
      .asr-title {
        font-size: 14px; font-weight: 900;
        color: var(--asr-title); line-height: 1.2;
        letter-spacing: -.02em;
      }
      .asr-subtitle {
        font-size: 9px; font-weight: 600;
        color: var(--asr-muted); margin-top: 2px;
      }
      .asr-badge {
        display: inline-flex; align-items: center;
        border-radius: 9999px;
        background: rgba(31,94,255,.1);
        color: #1f5eff;
        font-size: 9px; font-weight: 800;
        padding: 2px 8px;
        border: 1px solid rgba(31,94,255,.2);
      }
      .asr-badge-orange {
        background: rgba(249,115,22,.1);
        color: #ea580c;
        border-color: rgba(249,115,22,.2);
      }

      /* Toolbar buttons */
      .asr-icon-btn {
        width: 28px; height: 28px;
        display: grid; place-items: center;
        border-radius: 6px;
        border: 1.5px solid var(--asr-line);
        background: var(--asr-card);
        color: var(--asr-muted);
        transition: all .15s;
      }
      .asr-icon-btn:hover { border-color: #1f5eff; color: #1f5eff; }
      .asr-icon-btn:disabled { opacity: .5; }
      .asr-toolbar-btn {
        display: inline-flex; align-items: center; gap: 4px;
        height: 28px; padding: 0 10px;
        border-radius: 6px;
        border: 1.5px solid var(--asr-line);
        background: var(--asr-card);
        color: var(--asr-muted);
        font-size: 10px; font-weight: 800;
        transition: all .15s;
      }
      .asr-toolbar-btn:hover, .asr-toolbar-btn-active {
        border-color: #1f5eff; color: #1f5eff;
        background: rgba(31,94,255,.06);
      }
      .asr-filter-count {
        background: #1f5eff; color: white;
        font-size: 9px; font-weight: 900;
        border-radius: 9999px; padding: 0 5px;
        min-width: 16px; text-align: center;
      }

      /* Action menu */
      .asr-action-menu {
        position: absolute; right: 0; top: calc(100% + 6px); z-index: 100;
        width: 200px;
        background: var(--asr-card);
        border: 1px solid var(--asr-line);
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(15,23,42,.16);
        padding: 6px;
        animation: asr-fadein .12s ease-out;
      }
      @keyframes asr-fadein { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
      .asr-action-section-label {
        font-size: 9px; font-weight: 900; text-transform: uppercase;
        letter-spacing: .08em; color: var(--asr-muted);
        padding: 4px 10px 2px;
      }
      .asr-action-item {
        display: flex; align-items: center; gap: 8px;
        width: 100%; text-align: left;
        padding: 7px 10px; border-radius: 8px;
        font-size: 11px; font-weight: 700;
        color: var(--asr-title);
        transition: background .1s;
      }
      .asr-action-item:hover { background: var(--asr-hover); }
      .asr-action-divider { height: 1px; background: var(--asr-line); margin: 4px 6px; }

      /* Filter panel */
      .asr-filter-panel {
        background: var(--asr-card);
        border: 1px solid var(--asr-line);
        border-radius: 12px;
        padding: 16px 18px;
        box-shadow: 0 4px 16px rgba(15,23,42,.05);
        animation: asr-fadein .12s ease-out;
      }
      .asr-filter-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 12px;
      }
      .asr-filter-field { display: flex; flex-direction: column; gap: 4px; }
      .asr-filter-label { font-size: 10px; font-weight: 800; color: var(--asr-title); }
      .asr-filter-icon {
        position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
        width: 13px; height: 13px; color: var(--asr-muted); pointer-events: none;
      }
      .asr-filter-input {
        height: 32px; width: 100%; border-radius: 8px;
        border: 1.5px solid var(--asr-line); background: var(--asr-card);
        padding: 0 10px 0 28px; color: var(--asr-title);
        font-size: 11px; font-weight: 600; outline: none;
        transition: border-color .15s, box-shadow .15s;
      }
      .asr-filter-input:focus { border-color: #1f5eff; box-shadow: 0 0 0 3px rgba(31,94,255,.1); }
      .asr-filter-select {
        height: 32px; width: 100%; border-radius: 8px;
        border: 1.5px solid var(--asr-line); background: var(--asr-card);
        padding: 0 10px; color: var(--asr-title);
        font-size: 11px; font-weight: 600; outline: none;
        transition: border-color .15s;
      }
      .asr-filter-select:focus { border-color: #1f5eff; }

      /* Buttons */
      .asr-btn-primary {
        display: inline-flex; align-items: center; gap: 6px;
        height: 32px; padding: 0 16px; border-radius: 8px;
        background: #1f5eff; color: white;
        font-size: 11px; font-weight: 900;
        box-shadow: 0 6px 16px rgba(31,94,255,.28);
        transition: all .15s;
      }
      .asr-btn-primary:hover { background: #1a50e0; transform: translateY(-1px); }
      .asr-btn-secondary {
        display: inline-flex; align-items: center; gap: 5px;
        height: 32px; padding: 0 14px; border-radius: 8px;
        border: 1.5px solid var(--asr-line); background: var(--asr-card);
        color: var(--asr-muted); font-size: 11px; font-weight: 800;
        transition: all .15s;
      }
      .asr-btn-secondary:hover { border-color: #ef4444; color: #ef4444; }

      /* Executive summary panel */
      .asr-executive-panel {
        background: var(--asr-card);
        border: 1.5px solid var(--asr-line);
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(15,23,42,0.03);
        overflow: hidden;
      }
      .asr-panel-flex-row {
        display: flex;
        align-items: stretch;
        width: 100%;
      }
      @media (max-width: 1024px) {
        .asr-panel-flex-row {
          flex-direction: column;
        }
        .asr-panel-divider {
          display: none;
        }
      }
      .asr-metrics-section {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 6px 10px;
        align-items: center;
        flex-shrink: 0;
        background: rgba(247, 250, 255, 0.25);
      }
      .dark .asr-metrics-section {
        background: rgba(24, 40, 66, 0.15);
      }
      .asr-metric-mini-card {
        background: var(--asr-card);
        border: 1px solid var(--asr-line);
        border-radius: 6px;
        padding: 4px 10px;
        display: flex;
        align-items: center;
        min-width: 105px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        transition: background-color 0.15s;
      }
      .asr-metric-mini-card:hover { background-color: var(--asr-hover); }
      .asr-metric-mini-content {
        display: flex;
        flex-direction: column;
        gap: 0.5px;
      }
      .asr-metric-mini-label {
        font-size: 7.5px; font-weight: 800;
        text-transform: uppercase; letter-spacing: 0.05em;
        color: var(--asr-muted);
      }
      .asr-metric-mini-value {
        font-size: 13px; font-weight: 900;
        color: var(--asr-title); line-height: 1.1;
      }
      .asr-skeleton {
        display: inline-block; width: 32px; height: 16px;
        border-radius: 4px;
        background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
        background-size: 200% 100%;
        animation: asr-shimmer 1.2s infinite;
      }
      @keyframes asr-shimmer { to { background-position: -200% 0; } }

      .asr-panel-divider {
        width: 1px;
        background: var(--asr-line);
        margin: 6px 0;
        align-self: stretch;
        flex-shrink: 0;
      }

      /* Sleek Metadata Grid */
      .asr-metadata-section {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 0;
        padding: 6px 10px;
        flex-grow: 1;
      }
      .asr-metadata-mini-cell {
        padding: 4px 10px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 1px;
        border-right: 1px dashed var(--asr-line);
        min-width: 90px;
      }
      .asr-metadata-mini-cell:last-of-type { border-right: none; }
      .asr-metadata-mini-label {
        font-size: 7.5px; font-weight: 850;
        text-transform: uppercase; letter-spacing: 0.08em;
        color: var(--asr-muted);
      }
      .asr-metadata-mini-value {
        font-size: 9.5px; font-weight: 700;
        color: var(--asr-title);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 130px;
      }
      .asr-clear-chip-compact {
        margin: auto 8px;
        height: 22px;
        padding: 0 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        border-radius: 5px;
        border: 1px solid rgba(249,115,22,.25);
        background: rgba(249,115,22,.08);
        color: #ea580c;
        font-size: 9px;
        font-weight: 900;
        cursor: pointer;
        transition: background-color 0.15s;
      }
      .asr-clear-chip-compact:hover {
        background: rgba(249,115,22,.15);
      }
      /* Table */
      .asr-table-wrap {
        background: var(--asr-card);
        border: 1px solid var(--asr-line);
        border-radius: 14px;
        overflow: hidden;
        box-shadow: 0 14px 34px rgba(15,23,42,.08);
      }
      .asr-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-size: 11px;
        text-align: left;
        min-width: 1480px;
        font-family: inherit;
      }
      .asr-th {
        position: sticky;
        top: 0;
        z-index: 5;
        background: linear-gradient(180deg, #f8fbff, #eef4ff);
        padding: 10px 10px;
        font-size: 9px;
        font-weight: 950;
        text-transform: uppercase;
        letter-spacing: .08em;
        color: #53627a;
        border-bottom: 1px solid #cbd8ec;
        border-right: 1px solid #dbe5f4;
        white-space: nowrap;
        box-shadow: inset 0 -1px 0 rgba(15,23,42,.04);
      }
      .dark .asr-th { background: linear-gradient(180deg, #17243a, #101b2f); color: #9eb2d0; border-color: #253852; }
      .asr-th:last-child { border-right: none; }
      .asr-row { background: var(--asr-card); transition: background .14s ease, box-shadow .14s ease; }
      .asr-row:nth-child(even) { background: rgba(247,250,255,.72); }
      .dark .asr-row:nth-child(even) { background: rgba(15,23,42,.36); }
      .asr-row:hover { background: #eef6ff; box-shadow: inset 3px 0 0 #2563eb; }
      .dark .asr-row:hover { background: rgba(30,64,175,.18); }
      .asr-td {
        padding: 9px 10px;
        border-bottom: 1px solid #dbe5f4;
        border-right: 1px solid #e2eaf7;
        color: var(--asr-title);
        vertical-align: middle;
        white-space: nowrap;
        font-size: 11px;
        line-height: 1.35;
      }
      .dark .asr-td { border-color: #24344c; }
      .asr-td:last-child { border-right: none; }
      .asr-td-num { font-weight: 800; color: var(--asr-muted); text-align: center; width: 34px; font-size: 10px; }
      .asr-empty-cell { padding: 48px; text-align: center; color: var(--asr-muted); font-weight: 600; }

      /* Avatar */
      .asr-avatar {
        width: 28px; height: 28px;
        border-radius: 10px;
        background: linear-gradient(135deg, #1f5eff, #7c3aed);
        color: white; font-size: 10px; font-weight: 950;
        display: grid; place-items: center; flex-shrink: 0;
        box-shadow: 0 8px 18px rgba(37,99,235,.22);
      }

      /* Badges */
      .asr-type-badge {
        display: inline-flex; align-items: center;
        border-radius: 6px; padding: 2px 7px;
        background: #f0f5ff; color: #1f5eff;
        border: 1px solid #c7d8ff;
        font-size: 9px; font-weight: 800;
        white-space: nowrap;
      }
      .asr-cat-badge {
        display: inline-flex; align-items: center;
        border-radius: 6px; padding: 2px 7px;
        font-size: 9px; font-weight: 800; white-space: nowrap;
        background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0;
      }
      .asr-cat-asset    { background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe; }
      .asr-cat-expense  { background:#fff7ed; color:#c2410c; border-color:#fed7aa; }
      .asr-cat-income   { background:#f0fdf4; color:#166534; border-color:#bbf7d0; }
      .asr-cat-liability{ background:#fef2f2; color:#991b1b; border-color:#fecaca; }
      .asr-cat-equity   { background:#f5f3ff; color:#6d28d9; border-color:#ddd6fe; }

      /* Contact dots */
      .asr-contact-dot {
        display: inline-flex; align-items: center; justify-content: center;
        width: 20px; height: 20px; border-radius: 50%; border: 1px solid;
      }

      /* Action buttons */
      .asr-action-btn {
        display: inline-flex; align-items: center; gap: 5px;
        height: 28px; padding: 0 10px; border-radius: 8px;
        font-size: 10px; font-weight: 900;
        border: 1px solid; transition: all .15s;
        white-space: nowrap;
        box-shadow: 0 2px 6px rgba(15,23,42,.04);
      }
      .asr-action-btn:hover { transform: translateY(-1px); }
      .asr-action-view {
        background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe;
      }
      .asr-action-view:hover { background: #dbeafe; border-color: #1d4ed8; }
      .asr-action-edit {
        background: #fff7ed; color: #c2410c; border-color: #fed7aa;
      }
      .asr-action-edit:hover { background: #ffedd5; border-color: #c2410c; }

      /* Table footer */
      .asr-table-footer {
        display: flex; align-items: center; justify-content: space-between;
        padding: 8px 16px;
        border-top: 1px solid var(--asr-line);
        font-size: 10px; font-weight: 700;
        color: var(--asr-muted);
        background: var(--asr-head);
        flex-wrap: wrap; gap: 8px;
      }

      @media print {
        .asr-header button, .asr-action-menu,
        .asr-filter-panel, .asr-action-btn { display: none !important; }
        .asr-shell { background: white; padding: 0; }
        .asr-table-wrap { box-shadow: none; border: 1px solid #ddd; }
      }
    `})}},91292:(a,b,c)=>{"use strict";c.d(b,{A:()=>d});let d=(0,c(23339).A)("CircleX",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m15 9-6 6",key:"1uzhvr"}],["path",{d:"m9 9 6 6",key:"z0biqf"}]])},93928:(a,b,c)=>{Promise.resolve().then(c.bind(c,29709))}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[95873,17210,86802,4410,82161,2856,3991,81912,59224,31535,98602,91174,71020,94211,94083,16615,46758,44479],()=>b(b.s=27547));module.exports=c})();