1:"$Sreact.fragment"
7:I[28731,["34219","static/chunks/app/global-error-257a14d850f147d9.js"],"default"]
:HL["/_next/static/css/7c3ef54f32373456.css","style"]
2:T1a5c,(() => {
  try {
    const allowedColors = new Set(['purple','blue','green','gold','cyan']);
    const storedColor = localStorage.getItem('erp_color');
    const color = (storedColor && allowedColors.has(storedColor)) ? storedColor : 'purple';
    document.documentElement.classList.remove('theme-purple','theme-blue','theme-green','theme-gold','theme-cyan');
    document.documentElement.classList.add('theme-' + color);
  } catch {}
  try {
    const legacyTheme = localStorage.getItem('erp_theme');
    const storedThemeMode = localStorage.getItem('erp_theme_mode');
    const allowedModes = new Set(["night","day","soft","green"]);
    const legacyValue = "day";
    const mode = (storedThemeMode && allowedModes.has(storedThemeMode))
      ? storedThemeMode
      : (legacyTheme === 'dark' || legacyTheme === 'light')
        ? (legacyTheme === 'dark' ? 'night' : 'day')
        : legacyValue;
    document.documentElement.classList.remove('theme-night','theme-day','theme-soft','theme-green-business');
    document.documentElement.classList.add('theme-' + (mode === 'green' ? 'green-business' : mode));
    document.documentElement.classList.toggle('dark', mode === 'night');
    document.documentElement.dataset.erpThemeMode = mode;
    document.documentElement.style.colorScheme = mode === 'night' ? 'dark' : 'light';
    if (storedThemeMode !== mode) localStorage.setItem('erp_theme_mode', mode);
    document.cookie = 'erp_theme_mode=' + encodeURIComponent(mode) + '; Path=/; Max-Age=' + (60 * 60 * 24 * 365) + '; SameSite=Lax';
  } catch {}
  try {
    const rtl = new Set(['ar','ur','fa','ps']);
    const allowedLangs = new Set(['en','ar','ur','fa','ps']);
    // The cookie (erp_lang) is what server components read via getRequestLanguage() to
    // decide what language to fetch/render page data in — it is the only language source
    // visible to SSR. localStorage is a client-only cache. If the two ever drift apart
    // (localStorage cleared, a new browser profile/tab, manual edits) the page would
    // render with server-fetched data in one language and client-rendered chrome in
    // another. Treat the cookie as authoritative and self-heal localStorage to match it
    // on every load, so there is exactly one active-language source in practice.
    var cookieMatch = document.cookie.match(/(?:^|; )erp_lang=([^;]*)/);
    var cookieLang = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
    const storedLang = localStorage.getItem('erp_lang');
    const lang = (cookieLang && allowedLangs.has(cookieLang)) ? cookieLang
      : (storedLang && allowedLangs.has(storedLang)) ? storedLang
      : 'en';
    if (storedLang !== lang) localStorage.setItem('erp_lang', lang);
    if (cookieLang !== lang) document.cookie = 'erp_lang=' + encodeURIComponent(lang) + '; Path=/; Max-Age=' + (60 * 60 * 24 * 365) + '; SameSite=Lax';
    document.documentElement.lang = lang;
    document.documentElement.dir = rtl.has(lang) ? 'rtl' : 'ltr';
    if (rtl.has(lang)) {
      var overrides = { ar: "'Cairo', sans-serif", fa: "'Vazirmatn', sans-serif", ur: "'Noto Naskh Arabic', 'Cairo', 'Segoe UI', Tahoma, sans-serif", ps: "'Noto Naskh Arabic', 'Cairo', 'Segoe UI', Tahoma, sans-serif" };
      document.documentElement.style.setProperty('--font-family-override', overrides[lang] || "'Noto Naskh Arabic', sans-serif");
    }
  } catch {}
  try {
    var isLocalDev = ['localhost', '127.0.0.1', '0.0.0.0'].indexOf(location.hostname) !== -1;
    if (isLocalDev && 'serviceWorker' in navigator) {
      // Actively unregister in local dev instead of just skipping registration --
      // an already-registered SW from a previous session keeps controlling the page
      // (SW registration is origin-scoped, not tab-scoped, and re-registers itself
      // on every load via this same script) and its cache can silently serve stale
      // HTML/RSC payloads for a route even after the dev server has rebuilt with
      // new code, in a way that survives hard reloads and brand new tabs alike.
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        regs.forEach(function(r) { r.unregister().catch(function() {}); });
      }).catch(function() {});
      if (window.caches && caches.keys) {
        caches.keys().then(function(keys) {
          keys.forEach(function(k) { caches.delete(k).catch(function() {}); });
        }).catch(function() {});
      }
    } else if (window.isSecureContext && 'serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        try {
          navigator.serviceWorker.register('/sw.js').catch(function() {});
        } catch(swErr) {}
      });
    }
  } catch {}
  try {
    var handleChunkErr = function(err) {
      try {
        var str = '';
        if (typeof err === 'string') str = err;
        else if (err && typeof err === 'object') str = err.message || err.name || String(err);
        if (str && (str.indexOf('Loading chunk') !== -1 || str.indexOf('ChunkLoadError') !== -1 || str.indexOf('failed to fetch') !== -1 || str.indexOf('Failed to fetch dynamically imported module') !== -1)) {
          if ('caches' in window) {
            caches.keys().then(function(keys) { keys.forEach(function(k) { caches.delete(k); }); }).catch(function() {});
          }
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function(regs) { regs.forEach(function(r) { r.unregister(); }); }).catch(function() {});
          }
          var countKey = 'erp_auto_chunk_cnt';
          var tsKey = 'erp_auto_chunk_ts';
          var now = Date.now();
          var lastTs = parseInt(sessionStorage.getItem(tsKey) || '0', 10);
          var count = parseInt(sessionStorage.getItem(countKey) || '0', 10);
          if (now - lastTs > 15000) count = 0;
          if (count < 3) {
            sessionStorage.setItem(countKey, String(count + 1));
            sessionStorage.setItem(tsKey, String(now));
            var currentPath = window.location.pathname;
            var currentSearch = window.location.search || '';
            var cleanSearch = currentSearch.replace(/[?&]_v=d+/, '').replace(/^&/, '');
            var sep = cleanSearch.indexOf('?') !== -1 || cleanSearch.length > 0 ? '&' : '?';
            var finalUrl = currentPath + (cleanSearch ? (cleanSearch.charAt(0) === '?' ? cleanSearch : '?' + cleanSearch) + '&' : '?') + '_v=' + now;
            window.location.replace(finalUrl);
          }
        }
      } catch (inner) {}
    };
    window.addEventListener('error', function(e) { handleChunkErr(e ? (e.message || e.error) : null); }, true);
    window.addEventListener('unhandledrejection', function(e) { handleChunkErr(e ? e.reason : null); }, true);
  } catch {}
})();0:{"P":null,"b":"4MuEzj7K13wT7FGisiC_o","p":"","c":["","onboarding"],"i":false,"f":[[["",{"children":["onboarding",{"children":["__PAGE__",{}]}]},"$undefined","$undefined",true],["",["$","$1","c",{"children":[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/css/7c3ef54f32373456.css","precedence":"next","crossOrigin":"$undefined","nonce":"$undefined"}]],["$","html",null,{"lang":"en","suppressHydrationWarning":true,"children":[["$","head",null,{"children":["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$2"}}]}],"$L3"]}]]}],{"children":["onboarding","$L4",{"children":["__PAGE__","$L5",{},null,false]},null,false]},null,false],"$L6",false]],"m":"$undefined","G":["$7",[]],"s":false,"S":true}
8:I[62113,["69779","static/chunks/69779-75782f6577b28794.js","7177","static/chunks/app/layout-4cfd4786c67c6b7b.js"],"GoogleTranslateScript"]
9:I[9766,[],""]
a:I[49567,["69779","static/chunks/69779-75782f6577b28794.js","18039","static/chunks/app/error-209c8ffb480e9bcc.js"],"default"]
b:I[98924,[],""]
c:I[55508,["69779","static/chunks/69779-75782f6577b28794.js","7177","static/chunks/app/layout-4cfd4786c67c6b7b.js"],"PdfPreviewModal"]
e:I[10489,["69566","static/chunks/app/onboarding/page-33f3b50036a2abd3.js"],"Root"]
13:I[24431,[],"ViewportBoundary"]
15:I[24431,[],"MetadataBoundary"]
16:"$Sreact.suspense"
3:["$","body",null,{"suppressHydrationWarning":true,"children":[["$","$L8",null,{}],["$","$L9",null,{"parallelRouterKey":"children","error":"$a","errorStyles":[],"errorScripts":[],"template":["$","$Lb",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":[[["$","title",null,{"children":"404: This page could not be found."}],["$","div",null,{"style":{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"},"children":["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}}],["$","h1",null,{"className":"next-error-h1","style":{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"},"children":404}],["$","div",null,{"style":{"display":"inline-block"},"children":["$","h2",null,{"style":{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0},"children":"This page could not be found."}]}]]}]}]],[]],"forbidden":"$undefined","unauthorized":"$undefined"}],["$","$Lc",null,{}]]}]
4:["$","$1","c",{"children":[null,["$","$L9",null,{"parallelRouterKey":"children","error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$Lb",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","forbidden":"$undefined","unauthorized":"$undefined"}]]}]
d:{"id":"40d6bc1a38a4421c5d650d3f54e6fcf676419c7f9d","bound":null}
5:["$","$1","c",{"children":[["$","main",null,{"className":"grid min-h-screen place-items-center bg-muted px-4 py-10","children":["$","form",null,{"action":"$hd","className":"w-full max-w-2xl rounded-lg border bg-card p-6 shadow-sm","children":[["$","div",null,{"className":"mb-6 flex items-start gap-3","children":[["$","div",null,{"className":"flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary","children":["$","svg",null,{"ref":"$undefined","xmlns":"http://www.w3.org/2000/svg","width":24,"height":24,"viewBox":"0 0 24 24","fill":"none","stroke":"currentColor","strokeWidth":2,"strokeLinecap":"round","strokeLinejoin":"round","className":"lucide lucide-building2 h-5 w-5","aria-hidden":true,"children":[["$","path","1b4qmf",{"d":"M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"}],["$","path","i71pzd",{"d":"M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"}],["$","path","10jefs",{"d":"M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"}],["$","path","1itunk",{"d":"M10 6h4"}],["$","path","tcdvrf",{"d":"M10 10h4"}],["$","path","kelpxr",{"d":"M10 14h4"}],["$","path","1ulq68",{"d":"M10 18h4"}],"$undefined"]}]}],["$","div",null,{"children":[["$","h1",null,{"className":"text-xl font-semibold","children":"Create your workspace"}],["$","p",null,{"className":"text-sm text-muted-foreground","children":"This creates the company, first branch, owner role, membership, and starter chart of accounts."}]]}]]}],["$","div",null,{"className":"grid gap-4 md:grid-cols-2","children":[["$","div",null,{"className":"space-y-2","children":[["$","$Le",null,{"ref":"$undefined","className":"text-sm font-medium leading-none","htmlFor":"companyName","children":"Company name"}],["$","input",null,{"suppressHydrationWarning":true,"type":"$undefined","className":"flex h-10 w-full rounded-lg border border-input bg-background/50 backdrop-blur-sm px-3 py-2 text-sm shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:bg-background disabled:cursor-not-allowed disabled:opacity-50","ref":"$undefined","id":"companyName","name":"companyName","required":true}]]}],["$","div",null,{"className":"space-y-2","children":[["$","$Le",null,{"ref":"$undefined","className":"text-sm font-medium leading-none","htmlFor":"legalName","children":"Legal name"}],["$","input",null,{"suppressHydrationWarning":true,"type":"$undefined","className":"flex h-10 w-full rounded-lg border border-input bg-background/50 backdrop-blur-sm px-3 py-2 text-sm shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:bg-background disabled:cursor-not-allowed disabled:opacity-50","ref":"$undefined","id":"legalName","name":"legalName"}]]}],["$","div",null,{"className":"space-y-2","children":[["$","$Le",null,{"ref":"$undefined","className":"text-sm font-medium leading-none","htmlFor":"baseCurrency","children":"Base currency"}],["$","input",null,{"suppressHydrationWarning":true,"type":"$undefined","className":"flex h-10 w-full rounded-lg border border-input bg-background/50 backdrop-blur-sm px-3 py-2 text-sm shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:bg-background disabled:cursor-not-allowed disabled:opacity-50","ref":"$undefined","id":"baseCurrency","name":"baseCurrency","maxLength":3,"defaultValue":"USD","required":true}]]}],["$","div",null,{"className":"space-y-2","children":[["$","$Le",null,{"ref":"$undefined","className":"text-sm font-medium leading-none","htmlFor":"ownerFullName","children":"Your name"}],["$","input",null,{"suppressHydrationWarning":true,"type":"$undefined","className":"flex h-10 w-full rounded-lg border border-input bg-background/50 backdrop-blur-sm px-3 py-2 text-sm shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:bg-background disabled:cursor-not-allowed disabled:opacity-50","ref":"$undefined","id":"ownerFullName","name":"ownerFullName","autoComplete":"name","required":true}]]}],"$Lf","$L10"]}],"$L11"]}]}],null,"$L12"]}]
6:["$","$1","h",{"children":[null,[["$","$L13",null,{"children":"$L14"}],null],["$","$L15",null,{"children":["$","div",null,{"hidden":true,"children":["$","$16",null,{"fallback":null,"children":"$L17"}]}]}]]}]
18:I[24431,[],"OutletBoundary"]
1a:I[15278,[],"AsyncMetadataOutlet"]
f:["$","div",null,{"className":"space-y-2","children":[["$","$Le",null,{"ref":"$undefined","className":"text-sm font-medium leading-none","htmlFor":"branchName","children":"First branch"}],["$","input",null,{"suppressHydrationWarning":true,"type":"$undefined","className":"flex h-10 w-full rounded-lg border border-input bg-background/50 backdrop-blur-sm px-3 py-2 text-sm shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:bg-background disabled:cursor-not-allowed disabled:opacity-50","ref":"$undefined","id":"branchName","name":"branchName","defaultValue":"Main Branch","required":true}]]}]
10:["$","div",null,{"className":"space-y-2","children":[["$","$Le",null,{"ref":"$undefined","className":"text-sm font-medium leading-none","htmlFor":"branchCode","children":"Branch code"}],["$","input",null,{"suppressHydrationWarning":true,"type":"$undefined","className":"flex h-10 w-full rounded-lg border border-input bg-background/50 backdrop-blur-sm px-3 py-2 text-sm shadow-sm transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:bg-background disabled:cursor-not-allowed disabled:opacity-50","ref":"$undefined","id":"branchCode","name":"branchCode","defaultValue":"MAIN","required":true}]]}]
11:["$","div",null,{"className":"mt-6 flex justify-end","children":["$","button",null,{"suppressHydrationWarning":true,"className":"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg py-2 text-sm font-semibold transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg h-9 px-4","ref":"$undefined","type":"submit","children":"Create workspace"}]}]
12:["$","$L18",null,{"children":["$L19",["$","$L1a",null,{"promise":"$@1b"}]]}]
14:[["$","meta","0",{"charSet":"utf-8"}],["$","meta","1",{"name":"viewport","content":"width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"}],["$","meta","2",{"name":"theme-color","content":"#0f3ea8"}]]
19:null
1c:I[80622,[],"IconMark"]
1b:{"metadata":[["$","title","0",{"children":"Digital Dock ERP"}],["$","meta","1",{"name":"description","content":"Multi-country ERP for accounts, ledgers, purchases, sales, roznamcha, stock, and reports."}],["$","meta","2",{"name":"application-name","content":"Digital Dock ERP"}],["$","link","3",{"rel":"manifest","href":"/manifest.webmanifest","crossOrigin":"$undefined"}],["$","meta","4",{"name":"format-detection","content":"telephone=no"}],["$","meta","5",{"name":"mobile-web-app-capable","content":"yes"}],["$","meta","6",{"name":"apple-mobile-web-app-title","content":"Digital Dock ERP"}],["$","meta","7",{"name":"apple-mobile-web-app-status-bar-style","content":"default"}],["$","link","8",{"rel":"icon","href":"/icons/digital-dock-icon.svg"}],["$","link","9",{"rel":"apple-touch-icon","href":"/icons/digital-dock-icon.svg"}],["$","$L1c","10",{}]],"error":null,"digest":"$undefined"}
17:"$1b:metadata"
