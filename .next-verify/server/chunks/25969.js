"use strict";exports.id=25969,exports.ids=[25969],exports.modules={25969:(a,b,c)=>{c.d(b,{J:()=>s});var d=c(99875),e=c(49122),f=c(9208);function g(){if(process.env.DATABASE_URL)return process.env.DATABASE_URL;try{let a=c(29021),b=c(33873),d=b.resolve(process.cwd());for(let c of[d,b.join(d,"ACCOUNTS.DGT.LLC"),b.resolve(d,"..")])for(let d of[".env.local",".env"]){let e=b.join(c,d);if(a.existsSync(e)){let b=a.readFileSync(e,"utf8").match(/^DATABASE_URL=(.+)$/m);if(b)return b[1].trim().replace(/^['"]|['"]$/g,"")}}}catch{}return""}let h="id,company_code,name,legal_name,base_currency,owner_name,owner_person_id,manager_person_id,business_type,country_id,state_province_id,district_id,city_id,area_location_id,country_name,state_name,district_name,city_name,area_name,zip_code,address,contacts,registrations,owner_ids,is_active,created_at,updated_at";function i(a){return a?.trim()||null}function j(a){return Array.isArray(a)?a:[]}function k(a){if(!a)return[];if("string"==typeof a)try{return JSON.parse(a)}catch{return[]}return Array.isArray(a)?a:[]}function l(a){return{id:a.id,company_code:a.company_code??null,name:a.name,legal_name:a.legal_name??null,base_currency:a.base_currency??"USD",owner_name:a.owner_name??null,owner_person_id:a.owner_person_id??null,manager_person_id:a.manager_person_id??null,business_type:a.business_type??null,country_id:a.country_id??null,state_province_id:a.state_province_id??null,district_id:a.district_id??null,city_id:a.city_id??null,area_location_id:a.area_location_id??null,country_name:a.country_name??null,state_name:a.state_name??null,district_name:a.district_name??null,city_name:a.city_name??null,area_name:a.area_name??null,zip_code:a.zip_code??null,address:a.address??null,contacts:k(a.contacts),registrations:k(a.registrations),owner_ids:k(a.owner_ids),is_active:a.is_active??!0,created_at:String(a.created_at||new Date().toISOString()),updated_at:String(a.updated_at||new Date().toISOString())}}function m(a){let b={};return"name"in a&&(b.name=i(a.name)??""),"legalName"in a&&(b.legal_name=i(a.legalName)),"baseCurrency"in a&&(b.base_currency=i(a.baseCurrency)?.toUpperCase()??"USD"),"ownerName"in a&&(b.owner_name=i(a.ownerName)),"ownerPersonId"in a&&(b.owner_person_id=a.ownerPersonId||null),"managerPersonId"in a&&(b.manager_person_id=a.managerPersonId||null),"businessType"in a&&(b.business_type=i(a.businessType)),"countryId"in a&&(b.country_id=a.countryId||null),"stateProvinceId"in a&&(b.state_province_id=a.stateProvinceId||null),"districtId"in a&&(b.district_id=a.districtId||null),"cityId"in a&&(b.city_id=a.cityId||null),"areaLocationId"in a&&(b.area_location_id=a.areaLocationId||null),"countryName"in a&&(b.country_name=i(a.countryName)),"stateName"in a&&(b.state_name=i(a.stateName)),"districtName"in a&&(b.district_name=i(a.districtName)),"cityName"in a&&(b.city_name=i(a.cityName)),"areaName"in a&&(b.area_name=i(a.areaName)),"zipCode"in a&&(b.zip_code=i(a.zipCode)),"address"in a&&(b.address=i(a.address)),"contacts"in a&&(b.contacts=j(a.contacts)),"registrations"in a&&(b.registrations=j(a.registrations)),"ownerIds"in a&&(b.owner_ids=j(a.ownerIds)),"isActive"in a&&(b.is_active=!!a.isActive),b}class n{async search(a){let b=Math.min(Math.max(a.limit??500,1),500),c=(a.query??"").trim().replace(/\s+/g," "),i=g(),j=c?await (0,f.g0)("companies",["name","legal_name","owner_name"],c):[];if(i){let a=(0,e.A)(i,{max:1,prepare:!1});try{let d=c?await a`
              SELECT * FROM public.companies
              WHERE deleted_at IS NULL
                AND (name ILIKE ${"%"+c+"%"} OR legal_name ILIKE ${"%"+c+"%"} OR owner_name ILIKE ${"%"+c+"%"} OR country_name ILIKE ${"%"+c+"%"} OR city_name ILIKE ${"%"+c+"%"} OR id = ANY(${j}::uuid[]))
              ORDER BY name ASC
              LIMIT ${b}
            `:await a`
              SELECT * FROM public.companies 
              WHERE deleted_at IS NULL 
              ORDER BY name ASC 
              LIMIT ${b}
            `;if(d&&d.length>0)return{companies:d.map(l),limit:b}}catch(a){console.error("Direct postgres search error:",a)}finally{await a.end({timeout:5})}}let k=(0,d.createSupabaseAdminClient)().from("companies").select(h).is("deleted_at",null).order("name",{ascending:!0});if(c){let a=`%${c}%`;k=k.or(`name.ilike.${a},legal_name.ilike.${a},owner_name.ilike.${a},country_name.ilike.${a},city_name.ilike.${a}`)}let{data:m}=await k.limit(b);return{companies:(m??[]).map(l),limit:b}}async getById(a){let b=g();if(b){let c=(0,e.A)(b,{max:1,prepare:!1});try{let b=await c`
          SELECT * FROM public.companies WHERE id = ${a}::uuid AND deleted_at IS NULL LIMIT 1
        `;if(b&&b.length>0)return l(b[0])}catch(a){console.error("Direct postgres getById error:",a)}finally{await c.end({timeout:5})}}let c=(0,d.createSupabaseAdminClient)(),{data:f,error:i}=await c.from("companies").select(h).eq("id",a).is("deleted_at",null).single();if(i)throw Error(i.message);return l(f)}async create(a){let b=new Date().toISOString(),c=m(a),f=g();if(f){let a=(0,e.A)(f,{max:1,prepare:!1});try{let d=await a`
          INSERT INTO public.companies (
            name, legal_name, base_currency, owner_name, owner_person_id, manager_person_id, business_type,
            country_id, state_province_id, district_id, city_id, area_location_id,
            country_name, state_name, district_name, city_name, area_name, zip_code, address,
            contacts, registrations, owner_ids, is_active, created_at, updated_at
          ) VALUES (
            ${c.name||""},
            ${c.legal_name||null},
            ${c.base_currency||"USD"},
            ${c.owner_name||null},
            ${c.owner_person_id?String(c.owner_person_id):null}::uuid,
            ${c.manager_person_id?String(c.manager_person_id):null}::uuid,
            ${c.business_type||null},
            ${c.country_id?String(c.country_id):null}::uuid,
            ${c.state_province_id?String(c.state_province_id):null}::uuid,
            ${c.district_id?String(c.district_id):null}::uuid,
            ${c.city_id?String(c.city_id):null}::uuid,
            ${c.area_location_id?String(c.area_location_id):null}::uuid,
            ${c.country_name||null},
            ${c.state_name||null},
            ${c.district_name||null},
            ${c.city_name||null},
            ${c.area_name||null},
            ${c.zip_code||null},
            ${c.address||null},
            ${a.json(c.contacts||[])},
            ${a.json(c.registrations||[])},
            ${a.json(c.owner_ids||[])},
            true, ${b}, ${b}
          )
          RETURNING id
        `;if(d&&d[0]?.id){let b=d[0].id;try{let[c]=await a`SELECT next_entity_serial('global', 'GLOBAL', 'company', 'COMP') AS code`;c?.code&&await a`UPDATE public.companies SET company_code = ${c.code} WHERE id = ${b}::uuid AND company_code IS NULL`}catch{}return b}}catch(a){console.error("Direct postgres create error:",a)}finally{await a.end({timeout:5})}}let h=(0,d.createSupabaseAdminClient)(),{data:i,error:j}=await h.from("companies").insert({...c,is_active:!0,created_at:b,updated_at:b}).select("id").single();if(j)throw Error(j.message);return i.id}async update(a,b){let c=new Date().toISOString(),f=m(b),h=g();if(h){let b=(0,e.A)(h,{max:1,prepare:!1});try{let d=await b`
          UPDATE public.companies SET
            name = COALESCE(${void 0!==f.name?f.name:null}, name),
            legal_name = COALESCE(${void 0!==f.legal_name?f.legal_name:null}, legal_name),
            base_currency = COALESCE(${void 0!==f.base_currency?f.base_currency:null}, base_currency),
            owner_name = COALESCE(${void 0!==f.owner_name?f.owner_name:null}, owner_name),
            owner_person_id = COALESCE(${void 0!==f.owner_person_id&&f.owner_person_id?String(f.owner_person_id):null}::uuid, owner_person_id),
            manager_person_id = COALESCE(${void 0!==f.manager_person_id&&f.manager_person_id?String(f.manager_person_id):null}::uuid, manager_person_id),
            business_type = COALESCE(${void 0!==f.business_type?f.business_type:null}, business_type),
            country_id = COALESCE(${void 0!==f.country_id&&f.country_id?String(f.country_id):null}::uuid, country_id),
            state_province_id = COALESCE(${void 0!==f.state_province_id&&f.state_province_id?String(f.state_province_id):null}::uuid, state_province_id),
            district_id = COALESCE(${void 0!==f.district_id&&f.district_id?String(f.district_id):null}::uuid, district_id),
            city_id = COALESCE(${void 0!==f.city_id&&f.city_id?String(f.city_id):null}::uuid, city_id),
            area_location_id = COALESCE(${void 0!==f.area_location_id&&f.area_location_id?String(f.area_location_id):null}::uuid, area_location_id),
            country_name = COALESCE(${void 0!==f.country_name?f.country_name:null}, country_name),
            state_name = COALESCE(${void 0!==f.state_name?f.state_name:null}, state_name),
            district_name = COALESCE(${void 0!==f.district_name?f.district_name:null}, district_name),
            city_name = COALESCE(${void 0!==f.city_name?f.city_name:null}, city_name),
            area_name = COALESCE(${void 0!==f.area_name?f.area_name:null}, area_name),
            zip_code = COALESCE(${void 0!==f.zip_code?f.zip_code:null}, zip_code),
            address = COALESCE(${void 0!==f.address?f.address:null}, address),
            contacts = COALESCE(${void 0!==f.contacts?b.json(f.contacts):null}, contacts),
            registrations = COALESCE(${void 0!==f.registrations?b.json(f.registrations):null}, registrations),
            owner_ids = COALESCE(${void 0!==f.owner_ids?b.json(f.owner_ids):null}, owner_ids),
            is_active = COALESCE(${void 0!==f.is_active?!!f.is_active:null}, is_active),
            updated_at = ${c}
          WHERE id = ${a}::uuid AND deleted_at IS NULL
          RETURNING id
        `;if(d&&d.length>0)return}catch(a){console.error("Direct postgres update error:",a)}finally{await b.end({timeout:5})}}let i=(0,d.createSupabaseAdminClient)(),j={...f,updated_at:c},{error:k}=await i.from("companies").update(j).eq("id",a).is("deleted_at",null);if(k)throw Error(k.message)}async softDelete(a){let b=new Date().toISOString(),c=g();if(c){let d=(0,e.A)(c,{max:1,prepare:!1});try{await d`
          UPDATE public.companies SET deleted_at = ${b}, updated_at = ${b}, is_active = false
          WHERE id = ${a}::uuid AND deleted_at IS NULL
        `;return}catch(a){console.error("Direct postgres softDelete error:",a)}finally{await d.end({timeout:5})}}let f=(0,d.createSupabaseAdminClient)(),{error:h}=await f.from("companies").update({deleted_at:b,updated_at:b,is_active:!1}).eq("id",a).is("deleted_at",null);if(h)throw Error(h.message)}}let o=new n;var p=c(93390),q=c(61395);class r{async search(a){return await o.search(a)}async getById(a){return await o.getById(a)}async create(a,b){let c=await o.create({name:a.name,legalName:a.legalName??null,baseCurrency:a.baseCurrency,ownerName:a.ownerName??null,ownerPersonId:a.ownerPersonId??null,managerPersonId:a.managerPersonId??null,businessType:a.businessType??null,countryId:a.countryId??null,stateProvinceId:a.stateProvinceId??null,districtId:a.districtId??null,cityId:a.cityId??null,areaLocationId:a.areaLocationId??null,countryName:a.countryName??null,stateName:a.stateName??null,districtName:a.districtName??null,cityName:a.cityName??null,areaName:a.areaName??null,zipCode:a.zipCode??null,address:a.address??null,contacts:a.contacts??[],registrations:a.registrations??[],ownerIds:a.ownerIds??[]});await (0,p.qX)("companies",c,{name:a.name,legal_name:a.legalName??null,owner_name:a.ownerName??null,country_name:a.countryName??null,state_name:a.stateName??null,district_name:a.districtName??null,city_name:a.cityName??null,area_name:a.areaName??null},a.originalLanguage,b??null);let d=await o.getById(c);return await (0,q.V)({recordTable:"companies",recordId:c,action:"create",actorId:b??null,countryId:d?.country_id??a.countryId??null,beforeData:null,afterData:d??null}),c}async update(a,b,c){let d=await o.getById(a);await o.update(a,b);let e=await o.getById(a);if(await (0,q.V)({recordTable:"companies",recordId:a,action:"update",actorId:c??null,countryId:e?.country_id??d?.country_id??null,beforeData:d??null,afterData:e??null}),b.name||b.legalName||b.ownerName||b.businessType||b.address||b.originalLanguage){let d=await o.getById(a),e=b.originalLanguage??d.original_language_code??"en";await (0,p.qX)("companies",a,{name:b.name??d.name,legal_name:"legalName"in b?b.legalName??null:d.legal_name,owner_name:"ownerName"in b?b.ownerName??null:d.owner_name,country_name:"countryName"in b?b.countryName??null:d.country_name,state_name:"stateName"in b?b.stateName??null:d.state_name,district_name:"districtName"in b?b.districtName??null:d.district_name,city_name:"cityName"in b?b.cityName??null:d.city_name,area_name:"areaName"in b?b.areaName??null:d.area_name},e,c??null)}}async softDelete(a){let b=await o.getById(a);await o.softDelete(a),await (0,q.V)({recordTable:"companies",recordId:a,action:"delete",countryId:b?.country_id??null,beforeData:b??null,afterData:{deleted_at:new Date().toISOString()}})}}let s=new r},61395:(a,b,c)=>{c.d(b,{V:()=>f});var d=c(58799);function e(a){return!a||"object"!=typeof a||Array.isArray(a)?null:a}async function f(a){let b=e(a.beforeData)??a.beforeData??null,c=e(a.afterData)??a.afterData??null,f={record_table:a.recordTable,record_id:a.recordId,action:a.action,country_id:a.countryId??null,city_branch_id:a.cityBranchId??null,actor_id:a.actorId??null,approval_request_id:a.approvalRequestId??null,before_data:b,after_data:c};try{if(await (0,d.x)(async a=>{let d=null;if(f.actor_id){let b=await a`SELECT id FROM public.users WHERE id = ${f.actor_id}::uuid LIMIT 1`;b.length>0&&(d=b[0].id)}let e=null;if(f.country_id){let b=await a`SELECT id FROM public.countries WHERE id = ${f.country_id}::uuid LIMIT 1`;b.length>0&&(e=b[0].id)}let g=null;if(f.city_branch_id){let b=await a`SELECT id FROM public.city_branches WHERE id = ${f.city_branch_id}::uuid LIMIT 1`;b.length>0&&(g=b[0].id)}return await a`
        INSERT INTO public.record_change_history (record_table, record_id, action, country_id, city_branch_id, actor_id, approval_request_id, before_data, after_data)
        VALUES (${f.record_table}, ${f.record_id}::uuid, ${f.action}, ${e}::uuid, ${g}::uuid, ${d}::uuid, ${f.approval_request_id}::uuid, ${null===b?null:a.json(b)}, ${null===c?null:a.json(c)})
      `,!0}))return}catch(a){console.warn("[RECORD-CHANGE-HISTORY] Safe-warning writing audit log:",a)}}}};