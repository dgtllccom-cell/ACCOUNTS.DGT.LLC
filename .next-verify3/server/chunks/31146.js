"use strict";exports.id=31146,exports.ids=[18859,31146],exports.modules={5104:(a,b,c)=>{function d(){return"production"===(process.env.APP_ENV||"production").trim().toLowerCase()?"production":"development"}c.d(b,{FK:()=>f,rA:()=>d});let e=!1;function f(){e||(!function(){let a=d(),b=(process.env.PROD_SUPABASE_REF||"inmayhrxucimxqhgseqi").trim(),c=(process.env.DEV_SUPABASE_REF||"csesvyxxjivnkkozgopt").trim(),e=function(a){if(!a)return null;let b=a.match(/https?:\/\/([a-z0-9]+)\.supabase\.(co|in|net)/i);return b?b[1].toLowerCase():null}("https://csesvyxxjivnkkozgopt.supabase.co"),f=function(a){if(!a)return null;let b=a.match(/@db\.([a-z0-9]+)\.supabase\./i);if(b)return b[1].toLowerCase();let c=a.match(/\/\/postgres\.([a-z0-9]+):/i);return c?c[1].toLowerCase():null}(process.env.DATABASE_URL),g=e??f;if(e&&f&&e!==f)throw Error(`[ENV GUARD] Configuration split-brain: NEXT_PUBLIC_SUPABASE_URL points at "${e}" but DATABASE_URL points at "${f}". Both must reference the same Supabase project. Refusing to start.`);if("production"===a){if(!g)throw Error("[ENV GUARD] Running in production but no Supabase project is configured (NEXT_PUBLIC_SUPABASE_URL / DATABASE_URL are empty). Refusing to start.");if(g!==b)throw Error(`[ENV GUARD] Production is pointed at Supabase project "${g}", but the production project is "${b}". A production deploy must only use the production database. Refusing to start.`)}if("production"!==a&&g&&g===b)throw Error(`[ENV GUARD] Development is pointed at the PRODUCTION Supabase project "${b}". Local/dev work must never write to production. Point DATABASE_URL / NEXT_PUBLIC_SUPABASE_URL at the dev project ("${c}"). Refusing to start.`)}(),e=!0)}},9343:(a,b,c)=>{c.d(b,{Ix:()=>i,SY:()=>k,W5:()=>l,xg:()=>j});var d=c(58799),e=c(18859);function f(a){if("string"!=typeof a)return null;let b=a.trim();return b.length>0?b:null}async function g(a){let b=await (0,d.x)(async b=>a(b));if(null===b)throw Error("Local development DATABASE_URL is required for Shipping/Clearing customer-order persistence.");return b}async function h(a,b,c){for(let d of(await (0,e.syncRecordTranslations)({table:"clearing_customer_orders",recordId:a.id,record:a,originalLanguage:c}),b))await (0,e.syncRecordTranslations)({table:"clearing_customer_order_parties",recordId:d.id,record:d,originalLanguage:c})}async function i(a){return await g(async b=>{let c=a&&"all"!==a?await b`
          select *
          from public.clearing_customer_orders
          where deleted_at is null and status = ${a}
          order by created_at desc
        `:await b`
          select *
          from public.clearing_customer_orders
          where deleted_at is null
          order by created_at desc
        `,d=(c??[]).map(a=>a.id).filter(Boolean),e=function(a){let b=new Map;for(let c of a)b.has(c.order_id)||b.set(c.order_id,[]),b.get(c.order_id).push(c);return b}(d.length?await b`
          select *
          from public.clearing_customer_order_parties
          where deleted_at is null
            and order_id = ANY(${d}::uuid[])
          order by created_at asc
        `:[]);return(c??[]).map(a=>({...a,party_links:e.get(a.id)??[]}))})}async function j(a){return await g(async b=>{let[c]=await b`
      select *
      from public.clearing_customer_orders
      where id = ${a}::uuid and deleted_at is null
      limit 1
    `;if(!c)return null;let d=await b`
      select *
      from public.clearing_customer_order_parties
      where deleted_at is null and order_id = ${a}::uuid
      order by created_at asc
    `;return{...c,party_links:d}})}async function k(a){return await g(async b=>await b.begin(async b=>{let c,d=new Date().toISOString(),e=a.id??null,g=void 0!==a.partyLinks,h=f(a.orderNo);if(!e&&!h){let[a]=await b`select count(*)::int as count from public.clearing_customer_orders where deleted_at is null`,c=new Date().getFullYear();h=`CL-ORD-${c}-${String(Number(a?.count||0)+1).padStart(4,"0")}`}let i={order_no:h,customer_id:f(a.customerId),customer_name:f(a.customerName)??"Shipping Party",goods_id:f(a.goodsId),goods_variation_id:f(a.goodsVariationId),goods_name:f(a.goodsName),goods_chs_code:f(a.goodsChsCode),goods_variation_label:f(a.goodsVariationLabel),goods_brand:f(a.goodsBrand),goods_size:f(a.goodsSize),goods_origin_country_name:f(a.goodsOriginCountryName),route_name:f(a.routeName),shipment_type:f(a.shipmentType)??"FCL",transport_mode:f(a.transportMode)??"by_sea",movement_type:f(a.movementType)??"import",exporter_name:f(a.exporterName),importer_name:f(a.importerName),notify_party_required:!!a.notifyPartyRequired,notify_party_name:f(a.notifyPartyName),buyer_name:f(a.buyerName),loading_source:f(a.loadingSource),loading_source_name:f(a.loadingSourceName),loading_country_id:f(a.loadingCountryId),loading_country_name:f(a.loadingCountryName),receiving_country_id:f(a.receivingCountryId),receiving_country_name:f(a.receivingCountryName),loading_port_id:f(a.loadingPortId),loading_port_name:f(a.loadingPortName),destination_port_id:f(a.destinationPortId),destination_port_name:f(a.destinationPortName),cargo_details:f(a.cargoDetails),expected_loading_date:a.expectedLoadingDate||new Date().toISOString(),remarks:f(a.remarks),status:f(a.status)??"pending",updated_at:d};if(e){let[a]=await b`
          update public.clearing_customer_orders
          set customer_id = ${i.customer_id},
              customer_name = ${i.customer_name},
              goods_id = ${i.goods_id},
              goods_variation_id = ${i.goods_variation_id},
              goods_name = ${i.goods_name},
              goods_chs_code = ${i.goods_chs_code},
              goods_variation_label = ${i.goods_variation_label},
              goods_brand = ${i.goods_brand},
              goods_size = ${i.goods_size},
              goods_origin_country_name = ${i.goods_origin_country_name},
              route_name = ${i.route_name},
              shipment_type = ${i.shipment_type},
              transport_mode = ${i.transport_mode},
              movement_type = ${i.movement_type},
              exporter_name = ${i.exporter_name},
              importer_name = ${i.importer_name},
              notify_party_required = ${i.notify_party_required},
              notify_party_name = ${i.notify_party_name},
              buyer_name = ${i.buyer_name},
              loading_source = ${i.loading_source},
              loading_source_name = ${i.loading_source_name},
              loading_country_id = ${i.loading_country_id},
              loading_country_name = ${i.loading_country_name},
              receiving_country_id = ${i.receiving_country_id},
              receiving_country_name = ${i.receiving_country_name},
              loading_port_id = ${i.loading_port_id},
              loading_port_name = ${i.loading_port_name},
              destination_port_id = ${i.destination_port_id},
              destination_port_name = ${i.destination_port_name},
              cargo_details = ${i.cargo_details},
              expected_loading_date = ${i.expected_loading_date},
              remarks = ${i.remarks},
              status = ${i.status},
              updated_at = ${d}
          where id = ${e}::uuid and deleted_at is null
          returning *
        `;if(!a)throw Error("Customer order not found.");c=a,await b`
          delete from public.clearing_customer_order_parties
          where order_id = ${e}::uuid
        `}else{let[a]=await b`
          insert into public.clearing_customer_orders (
            order_no, customer_id, customer_name, goods_id, goods_variation_id, goods_name, goods_chs_code,
            goods_variation_label, goods_brand, goods_size, goods_origin_country_name,
            route_name, shipment_type, transport_mode, movement_type,
            exporter_name, importer_name, notify_party_required, notify_party_name, buyer_name,
            loading_source, loading_source_name, loading_country_id, loading_country_name,
            receiving_country_id, receiving_country_name, loading_port_id, loading_port_name,
            destination_port_id, destination_port_name, cargo_details, expected_loading_date, remarks,
            status, created_at, updated_at
          ) values (
            ${i.order_no}, ${i.customer_id}, ${i.customer_name}, ${i.goods_id},
            ${i.goods_variation_id}, ${i.goods_name}, ${i.goods_chs_code},
            ${i.goods_variation_label}, ${i.goods_brand}, ${i.goods_size},
            ${i.goods_origin_country_name}, ${i.route_name},
            ${i.shipment_type}, ${i.transport_mode}, ${i.movement_type},
            ${i.exporter_name}, ${i.importer_name}, ${i.notify_party_required},
            ${i.notify_party_name}, ${i.buyer_name}, ${i.loading_source},
            ${i.loading_source_name}, ${i.loading_country_id}, ${i.loading_country_name},
            ${i.receiving_country_id}, ${i.receiving_country_name}, ${i.loading_port_id},
            ${i.loading_port_name}, ${i.destination_port_id}, ${i.destination_port_name},
            ${i.cargo_details}, ${i.expected_loading_date}, ${i.remarks},
            ${i.status}, ${d}, ${d}
          )
          returning *
        `;if(!a)throw Error("Failed to create customer order.");c=a}let j=[];if(g){let g=(function(a,b){let c=new Map;for(let e of a??[]){var d;let a="supplier"===(d=String(e?.roleKey||""))||"importer"===d||"exporter"===d||"notify_party"===d||"buyer"===d?d:null;if(!a)continue;let g=f(e.partyCustomerName)??("supplier"===a?b:null);g&&c.set(a,{roleKey:a,partyCustomerId:f(e.partyCustomerId),partyCustomerName:g,partyCompanyId:f(e.partyCompanyId),partyCompanyName:f(e.partyCompanyName),selectedAddressText:f(e.selectedAddressText),selectedAddressSource:f(e.selectedAddressSource)})}return Array.from(c.values())})(a.partyLinks,i.customer_name).map(b=>({order_id:c.id,role_key:b.roleKey,party_customer_id:b.partyCustomerId,party_customer_name:b.partyCustomerName?.trim()||i.customer_name,party_company_id:b.partyCompanyId,party_company_name:f(b.partyCompanyName),selected_address_text:f(b.selectedAddressText),selected_address_source:f(b.selectedAddressSource),country_id:a.countryId??null,country_branch_id:a.countryBranchId??null,city_branch_id:a.cityBranchId??null,created_at:d,updated_at:d}));e&&await b`
            delete from public.clearing_customer_order_parties
            where order_id = ${e}::uuid
          `,g.length&&(j=await b`
            insert into public.clearing_customer_order_parties ${b(g)}
            returning *
          `)}else j=await b`
          select *
          from public.clearing_customer_order_parties
          where deleted_at is null and order_id = ${c.id}::uuid
          order by created_at asc
        `;return{order:c,partyLinks:j}})).then(async b=>{try{await h(b.order,b.partyLinks,a.originalLanguage??"en")}catch(a){console.warn("Customer-order translation sync failed after save; preserving saved shipping order.",a)}return b})}async function l(a){return await g(async b=>await b.begin(async b=>{let c=new Date().toISOString(),[d]=await b`
        update public.clearing_customer_orders
        set deleted_at = ${c},
            updated_at = ${c}
        where id = ${a}::uuid and deleted_at is null
        returning *
      `;if(!d)throw Error("Customer order not found.");return await b`
        update public.clearing_customer_order_parties
        set deleted_at = ${c},
            updated_at = ${c}
        where order_id = ${a}::uuid and deleted_at is null
      `,d}))}},18859:(a,b,c)=>{c.d(b,{syncRecordTranslations:()=>f});var d=c(44717),e=c(93390);async function f(a){let{table:b,recordId:c,record:f}=a;if(!c||!f)return 0;let g=(0,d.bP)(b);if(0===g.length)return 0;let h={},i=0;for(let{field:a}of g){let b=f[a];"string"==typeof b&&b.trim().length>0&&(h[a]=b.trim(),i+=1)}return 0===i?0:(await (0,e.qX)(b,c,h,a.originalLanguage??"en",a.actorId??null),i)}},44341:(a,b,c)=>{c.d(b,{SM:()=>f,Uv:()=>d,iJ:()=>e});let d=[{code:"en",englishName:"English",nativeName:"English",htmlLang:"en",direction:"ltr",isDefault:!0},{code:"ar",englishName:"Arabic",nativeName:"العربية",htmlLang:"ar",direction:"rtl",isDefault:!1},{code:"ur",englishName:"Urdu",nativeName:"اردو",htmlLang:"ur-PK",direction:"rtl",isDefault:!1},{code:"fa",englishName:"Persian / Farsi",nativeName:"فارسی",htmlLang:"fa",direction:"rtl",isDefault:!1},{code:"ps",englishName:"Pashto",nativeName:"پښتو",htmlLang:"ps",direction:"rtl",isDefault:!1}];function e(a){return d.find(b=>b.code===a)?.direction??"ltr"}function f(a,b="en"){return d.some(b=>b.code===a)?a:b}d.filter(a=>"rtl"===a.direction).map(a=>a.code)},53028:(a,b,c)=>{c.d(b,{$G:()=>h,JU:()=>i,Oq:()=>g,nq:()=>f,xE:()=>j,yt:()=>e});var d=c(5104);function e(){return"https://csesvyxxjivnkkozgopt.supabase.co".trim()}function f(){return(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||"sb_publishable_22nhsWCggOvyEf-hYmAcfA_vFo7zk4w").trim()}function g(){let a=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;return a&&""!==a.trim()?a.trim():f()}function h(){return!!(e()&&f())}function i(){return"false"!==process.env.ALLOW_DEMO_AUTH}function j(){if(!h())throw Error("Supabase environment variables are not configured. Please define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment or .env.local.");(0,d.FK)()}}};