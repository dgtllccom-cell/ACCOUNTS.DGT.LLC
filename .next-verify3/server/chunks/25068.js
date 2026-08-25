"use strict";exports.id=25068,exports.ids=[25068],exports.modules={35559:(a,b,c)=>{c.d(b,{G:()=>f,eq:()=>e});var d=c(98196);let e=d.ZS.arrayToEnum(["invalid_type","invalid_literal","custom","invalid_union","invalid_union_discriminator","invalid_enum_value","unrecognized_keys","invalid_arguments","invalid_return_type","invalid_date","invalid_string","too_small","too_big","invalid_intersection_types","not_multiple_of","not_finite"]);class f extends Error{get errors(){return this.issues}constructor(a){super(),this.issues=[],this.addIssue=a=>{this.issues=[...this.issues,a]},this.addIssues=(a=[])=>{this.issues=[...this.issues,...a]};let b=new.target.prototype;Object.setPrototypeOf?Object.setPrototypeOf(this,b):this.__proto__=b,this.name="ZodError",this.issues=a}format(a){let b=a||function(a){return a.message},c={_errors:[]},d=a=>{for(let e of a.issues)if("invalid_union"===e.code)e.unionErrors.map(d);else if("invalid_return_type"===e.code)d(e.returnTypeError);else if("invalid_arguments"===e.code)d(e.argumentsError);else if(0===e.path.length)c._errors.push(b(e));else{let a=c,d=0;for(;d<e.path.length;){let c=e.path[d];d===e.path.length-1?(a[c]=a[c]||{_errors:[]},a[c]._errors.push(b(e))):a[c]=a[c]||{_errors:[]},a=a[c],d++}}};return d(this),c}static assert(a){if(!(a instanceof f))throw Error(`Not a ZodError: ${a}`)}toString(){return this.message}get message(){return JSON.stringify(this.issues,d.ZS.jsonStringifyReplacer,2)}get isEmpty(){return 0===this.issues.length}flatten(a=a=>a.message){let b={},c=[];for(let d of this.issues)if(d.path.length>0){let c=d.path[0];b[c]=b[c]||[],b[c].push(a(d))}else c.push(a(d));return{formErrors:c,fieldErrors:b}}get formErrors(){return this.flatten()}}f.create=a=>new f(a)},56108:(a,b,c)=>{c.d(b,{$:()=>j});var d=c(58799),e=c(98422),f=c(9208);function g(a){return a?a.toLowerCase().trim().replace(/[^a-z0-9]/g,"").replace(/(ullah|ollah|ulla|olla|khan|abdullah|jan|sahib)/g,""):""}function h(a,b){if(!a||!b)return!1;let c=a.toLowerCase().trim().replace(/[^a-z0-9]/g,""),d=b.toLowerCase().trim().replace(/[^a-z0-9]/g,"");if(!c||!d)return!1;if(c===d||c.includes(d)||d.includes(c))return!0;let e=g(a),f=g(b);return!!(e&&f&&(e===f||e.includes(f)||f.includes(e)))}class i{async getParty360Summary(a){let{customerId:b,name:c,employeeId:g}=a,i=(0,e.normalizeLanguage)(a.lang,"en");return await (0,d.x)(async a=>{let d=null;b&&(d=(await a`
          SELECT c.*, co.name AS country_name, st.name AS state_name, ci.name AS city_name
          FROM public.customers c
          LEFT JOIN public.countries co ON co.id = c.country_id
          LEFT JOIN public.states_provinces st ON st.id = c.state_province_id
          LEFT JOIN public.cities ci ON ci.id = c.city_id
          WHERE c.id = ${b}::uuid
          LIMIT 1
        `)[0]||null),!d&&c&&(d=(await a`
          SELECT c.*, co.name AS country_name, st.name AS state_name, ci.name AS city_name
          FROM public.customers c
          LEFT JOIN public.countries co ON co.id = c.country_id
          LEFT JOIN public.states_provinces st ON st.id = c.state_province_id
          LEFT JOIN public.cities ci ON ci.id = c.city_id
          WHERE LOWER(c.customer_name) = LOWER(${c}) OR LOWER(c.first_name || ' ' || COALESCE(c.last_name, '')) = LOWER(${c})
          LIMIT 1
        `)[0]||null),d||b||!g||(d=(await a`
          SELECT c.*, co.name AS country_name, st.name AS state_name, ci.name AS city_name
          FROM public.employees e
          JOIN public.customers c ON c.id = e.person_master_id
          LEFT JOIN public.countries co ON co.id = c.country_id
          LEFT JOIN public.states_provinces st ON st.id = c.state_province_id
          LEFT JOIN public.cities ci ON ci.id = c.city_id
          WHERE e.id = ${g}::uuid
          LIMIT 1
        `)[0]||null);let e=b||d?.id||null,j=d?.customer_name||c||"",k=await a`
        SELECT c.id, c.name, c.legal_name, c.business_type, c.city_name, c.country_name, c.owner_name, c.owner_person_id
        FROM public.companies c
        ORDER BY c.name ASC
      `,l=(await (0,f.tM)(k,"companies","name",i,{phraseFallback:!0})).filter(a=>!!e&&a.owner_person_id===e).map(a=>({id:a.id,name:a.name||a.legal_name||"Company",legalName:a.legal_name,businessType:a.business_type,cityName:a.city_name,countryName:a.country_name,ownerName:a.owner_name})),m=await a`
        SELECT e.id, e.employee_code, e.person_master_id, e.designation, e.department, e.status, b.name AS branch_name,
               c.customer_name, c.first_name, c.last_name, c.father_name
        FROM public.employees e
        JOIN public.customers c ON c.id = e.person_master_id
        LEFT JOIN public.country_branches b ON b.id = e.country_branch_id
        WHERE e.deleted_at IS NULL
        ORDER BY e.employee_code ASC
      `,n=(await (0,f.tM)(m,"employees","customer_name",i,{phraseFallback:!0})).filter(a=>!!g&&a.id===g||!!e&&a.person_master_id===e).map(a=>({id:a.id,employeeCode:a.employee_code||"EMP",fullName:a.customer_name||[a.first_name,a.last_name].filter(Boolean).join(" "),fatherName:a.father_name,jobTitle:a.designation,department:a.department,branchName:a.branch_name,status:a.status})),o=await a`
        SELECT b.id, b.bank_name, b.account_title, b.account_number, b.branch_code, b.currency, b.account_status, b.owner_person_id
        FROM public.banks b
        WHERE b.deleted_at IS NULL
        ORDER BY b.bank_name ASC
      `,p=(await (0,f.tM)(o,"banks","bank_name",i,{phraseFallback:!0})).filter(a=>!!(e&&a.owner_person_id===e||!a.owner_person_id&&j&&(h(a.account_title,j)||h(a.bank_name,j)))).map(a=>({id:a.id,bankName:a.bank_name,accountTitle:a.account_title,accountNumber:a.account_number,branchCode:a.branch_code,currency:a.currency,accountStatus:a.account_status})),q=await a`
        SELECT id, warehouse_name, warehouse_code, warehouse_type, owner_person_id, responsible_person_id
        FROM public.warehouses
        WHERE deleted_at IS NULL
      `,r=(e?q.filter(a=>a.owner_person_id===e||a.responsible_person_id===e):[]).map(a=>{let b=a.owner_person_id===e,c=a.responsible_person_id===e;return{id:a.id,warehouseName:a.warehouse_name,warehouseCode:a.warehouse_code,warehouseType:a.warehouse_type,role:b&&c?"Owner & Responsible Person":b?"Owner":"Responsible Person"}}),s=await a`
        SELECT id, truck_number, truck_serial, owner_person_id, driver_person_id
        FROM public.trucks
        WHERE deleted_at IS NULL
      `,t=(e?s.filter(a=>a.owner_person_id===e||a.driver_person_id===e):[]).map(a=>{let b=a.owner_person_id===e,c=a.driver_person_id===e;return{id:a.id,truckNumber:a.truck_number,truckSerial:a.truck_serial,role:b&&c?"Owner & Driver":b?"Owner":"Driver"}}),u=await a`
        SELECT id, name, clearing_agent_code, person_id
        FROM public.clearing_agents
        WHERE deleted_at IS NULL
      `,v=(e?u.filter(a=>a.person_id===e):[]).map(a=>({id:a.id,name:a.name,clearingAgentCode:a.clearing_agent_code})),w=0,x=null;if(d?.id)try{let b=await a`
            SELECT COUNT(*)::int AS count, MAX(created_at) AS max_date
            FROM public.daily_entries
            WHERE customer_id = ${d.id}::uuid
          `;w=b[0]?.count||0,x=b[0]?.max_date?new Date(b[0].max_date).toISOString():null}catch{}return{customerId:d?.id,customerCode:d?.customer_code||(d?.id?`CUST-${d.id.slice(0,6).toUpperCase()}`:void 0),customerName:d?.customer_name||j||"Unknown Party",fatherName:d?.father_name||n[0]?.fatherName||null,firstName:d?.first_name||null,lastName:d?.last_name||null,gender:d?.gender||null,mobile:d?.mobile||null,phone:d?.phone||null,whatsapp:d?.whatsapp||null,email:d?.email||null,address:d?.address||null,countryName:d?.country_name||null,stateName:d?.state_name||null,cityName:d?.city_name||null,partyType:d?.party_type||(l.length>0?"Owner":n.length>0?"Employee":"Customer"),companies:l,employees:n,banks:p,warehouses:r,trucks:t,clearingAgents:v,transactionsSummary:{totalEntries:w,latestEntryDate:x}}})}async getUniversalPartiesDirectory(a){let{query:b="",limit:c=100,offset:g=0}=a,i=(0,e.normalizeLanguage)(a.lang,"en");return await (0,d.x)(async a=>{let d=await a`
        SELECT c.*, co.name AS country_name, st.name AS state_name, ci.name AS city_name
        FROM public.customers c
        LEFT JOIN public.countries co ON co.id = c.country_id
        LEFT JOIN public.states_provinces st ON st.id = c.state_province_id
        LEFT JOIN public.cities ci ON ci.id = c.city_id
        ORDER BY c.created_at DESC
        LIMIT 500
      `,e=await a`
        SELECT c.id, c.name, c.legal_name, c.business_type, c.city_name, c.country_name, c.owner_name, c.owner_person_id
        FROM public.companies c
      `,j=await a`
        SELECT e.id, e.employee_code, e.person_master_id, e.designation, e.department, e.status, b.name AS branch_name,
               c.customer_name, c.first_name, c.last_name, c.father_name
        FROM public.employees e
        JOIN public.customers c ON c.id = e.person_master_id
        LEFT JOIN public.country_branches b ON b.id = e.country_branch_id
        WHERE e.deleted_at IS NULL
      `,k=await a`
        SELECT b.id, b.bank_name, b.account_title, b.account_number, b.branch_code, b.currency, b.account_status
        FROM public.banks b
        WHERE b.deleted_at IS NULL
      `,l=await (0,f.tM)(d,"customers","customer_name",i,{phraseFallback:!0}),m=await (0,f.tM)(e,"companies","name",i,{phraseFallback:!0}),n=await (0,f.tM)(j,"employees","customer_name",i,{phraseFallback:!0}),o=await (0,f.tM)(k,"banks","bank_name",i,{phraseFallback:!0}),p=[];for(let a of l){let b=a.customer_name||[a.first_name,a.last_name].filter(Boolean).join(" "),c=m.filter(b=>!!b.owner_person_id&&b.owner_person_id===a.id).map(a=>({id:a.id,name:a.name||a.legal_name||"Company",legalName:a.legal_name,businessType:a.business_type,cityName:a.city_name,countryName:a.country_name,ownerName:a.owner_name})),d=n.filter(b=>!!b.person_master_id&&b.person_master_id===a.id).map(a=>({id:a.id,employeeCode:a.employee_code||"EMP",fullName:a.customer_name||[a.first_name,a.last_name].filter(Boolean).join(" "),fatherName:a.father_name,jobTitle:a.designation,department:a.department,branchName:a.branch_name,status:a.status})),e=o.filter(a=>!!(b&&(h(a.account_title,b)||h(a.bank_name,b)))).map(a=>({id:a.id,bankName:a.bank_name,accountTitle:a.account_title,accountNumber:a.account_number,branchCode:a.branch_code,currency:a.currency,accountStatus:a.account_status}));p.push({customerId:a.id,customerCode:a.customer_code||`CUST-${a.id.slice(0,6).toUpperCase()}`,customerName:b,fatherName:a.father_name||d[0]?.fatherName||null,firstName:a.first_name||null,lastName:a.last_name||null,gender:a.gender||null,mobile:a.mobile||null,phone:a.phone||null,whatsapp:a.whatsapp||null,email:a.email||null,address:a.address||null,countryName:a.country_name||null,stateName:a.state_name||null,cityName:a.city_name||null,partyType:a.party_type||(c.length>0?"Owner":d.length>0?"Employee":"Customer"),companies:c,employees:d,banks:e,warehouses:[],trucks:[],clearingAgents:[],transactionsSummary:{totalEntries:0}})}let q=p;if(b.trim()){let a=b.toLowerCase().trim();q=p.filter(b=>[b.customerName,b.customerCode||"",b.fatherName||"",b.mobile||"",b.email||"",b.cityName||"",b.countryName||"",...b.companies.map(a=>a.name),...b.employees.map(a=>a.employeeCode)].join(" ").toLowerCase().includes(a))}return{parties:q.slice(g,g+c),total:q.length}})}}let j=new i},70151:(a,b,c)=>{c.d(b,{Di:()=>e,bF:()=>i,f$:()=>g,ge:()=>h,yM:()=>f}),c(39588);var d=c(42464);function e(a){return{countryId:a.nextUrl.searchParams.get("countryId"),countryBranchId:a.nextUrl.searchParams.get("countryBranchId"),cityBranchId:a.nextUrl.searchParams.get("cityBranchId")}}function f(a,b){(0,d.Gq)(a,{resource:b.resource,action:b.action,countryId:b.countryId,countryBranchId:b.countryBranchId,cityBranchId:b.cityBranchId})}function g(a,b){if(!(0,d.eE)(a,b.resource,b.action))throw new d.fL(`Missing permission: ${b.resource}:${b.action}`);if(a.isSuperAdmin)return;let c=b=>b.cityBranchId?(0,d.is)(a,b.cityBranchId):b.countryBranchId?(0,d.Nh)(a,b.countryBranchId):!!b.countryId&&(0,d.Fx)(a,b.countryId),e=c(b.source),f=!!b.destination&&c(b.destination);if(!e&&!f)throw new d.fL("Neither the source nor destination scope of this record is allowed for this user.")}function h(a,b){return!!a.isSuperAdmin||!!b&&(!!b.cityBranchId||!!b.countryBranchId||!!b.countryId)&&(b.cityBranchId?(0,d.is)(a,b.cityBranchId):b.countryBranchId?(0,d.Nh)(a,b.countryBranchId):!!b.countryId&&(0,d.Fx)(a,b.countryId))}function i(a,b,c){let d=a;return c?.cityBranchId?d=d.eq("city_branch_id",c.cityBranchId):c?.countryBranchId?d=d.eq("country_branch_id",c.countryBranchId):c?.countryId&&(d=d.eq("country_id",c.countryId)),!b.isSuperAdmin&&(b.cityBranchIds.length>0?(d=d.or(`city_branch_id.in.(${b.cityBranchIds.join(",")}),city_branch_id.is.null`),b.countryIds.length>0&&(d=d.in("country_id",b.countryIds))):d=b.countryBranchIds.length>0?d.in("country_branch_id",b.countryBranchIds):b.countryIds.length>0?d.in("country_id",b.countryIds):d.eq("id","00000000-0000-0000-0000-000000000000")),d}},98196:(a,b,c)=>{var d,e;c.d(b,{CR:()=>g,ZS:()=>d,Zp:()=>f}),function(a){a.assertEqual=a=>{},a.assertIs=function(a){},a.assertNever=function(a){throw Error()},a.arrayToEnum=a=>{let b={};for(let c of a)b[c]=c;return b},a.getValidEnumValues=b=>{let c=a.objectKeys(b).filter(a=>"number"!=typeof b[b[a]]),d={};for(let a of c)d[a]=b[a];return a.objectValues(d)},a.objectValues=b=>a.objectKeys(b).map(function(a){return b[a]}),a.objectKeys="function"==typeof Object.keys?a=>Object.keys(a):a=>{let b=[];for(let c in a)Object.prototype.hasOwnProperty.call(a,c)&&b.push(c);return b},a.find=(a,b)=>{for(let c of a)if(b(c))return c},a.isInteger="function"==typeof Number.isInteger?a=>Number.isInteger(a):a=>"number"==typeof a&&Number.isFinite(a)&&Math.floor(a)===a,a.joinValues=function(a,b=" | "){return a.map(a=>"string"==typeof a?`'${a}'`:a).join(b)},a.jsonStringifyReplacer=(a,b)=>"bigint"==typeof b?b.toString():b}(d||(d={})),(e||(e={})).mergeShapes=(a,b)=>({...a,...b});let f=d.arrayToEnum(["string","nan","number","integer","float","boolean","date","bigint","symbol","function","undefined","null","array","object","unknown","promise","void","never","map","set"]),g=a=>{switch(typeof a){case"undefined":return f.undefined;case"string":return f.string;case"number":return Number.isNaN(a)?f.nan:f.number;case"boolean":return f.boolean;case"function":return f.function;case"bigint":return f.bigint;case"symbol":return f.symbol;case"object":if(Array.isArray(a))return f.array;if(null===a)return f.null;if(a.then&&"function"==typeof a.then&&a.catch&&"function"==typeof a.catch)return f.promise;if("undefined"!=typeof Map&&a instanceof Map)return f.map;if("undefined"!=typeof Set&&a instanceof Set)return f.set;if("undefined"!=typeof Date&&a instanceof Date)return f.date;return f.object;default:return f.unknown}}}};