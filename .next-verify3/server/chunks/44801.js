exports.id=44801,exports.ids=[44801],exports.modules={7978:(a,b,c)=>{"use strict";c.d(b,{EK:()=>h,Ut:()=>g,tu:()=>e,xX:()=>f});var d=c(58799);async function e(a){return(0,d.x)(async b=>{let c=await b`
      SELECT COALESCE(MAX(version_number), 0) AS max_ver
      FROM enterprise_audit_events
      WHERE entity_type = ${a.entityType} AND entity_id = ${a.entityId}
    `,d=Number(c[0]?.max_ver||0)+1,e=function(a,b){if(!a&&!b)return[];if(!a&&b)return Object.keys(b).map(a=>({field:a,oldValue:null,newValue:b[a]}));if(a&&!b)return Object.keys(a).map(b=>({field:b,oldValue:a[b],newValue:null}));let c=[],d=new Set([...Object.keys(a||{}),...Object.keys(b||{})]),e=new Set(["updated_at","created_at","version_number"]);for(let f of d){if(e.has(f))continue;let d=a?.[f],g=b?.[f];("object"==typeof d||"object"==typeof g?JSON.stringify(d)!==JSON.stringify(g):d!==g)&&c.push({field:f,oldValue:d??null,newValue:g??null})}return c}(a.previousSnapshot,a.currentSnapshot),f="SOFT_DELETE"===a.actionType||"PERMANENT_DELETE"===a.actionType,g=a.session?.userId||"system",h=a.session?.fullName||"System User",i=a.session?.roles?.[0]||(a.session?.isSuperAdmin?"super_admin":"user"),j=a.countryId||a.session?.countryIds?.[0]||null,k=a.cityBranchId||a.session?.cityBranchIds?.[0]||null;return(await b`
      INSERT INTO enterprise_audit_events (
        entity_type,
        entity_id,
        reference_no,
        action_type,
        version_number,
        diff_changes,
        previous_snapshot,
        current_snapshot,
        user_id,
        user_name,
        user_role,
        country_id,
        country_name,
        city_branch_id,
        branch_name,
        ip_address,
        device_session,
        reason,
        metadata,
        is_deleted,
        deleted_at,
        deleted_by,
        created_at
      ) VALUES (
        ${a.entityType},
        ${a.entityId},
        ${a.referenceNo||null},
        ${a.actionType},
        ${d},
        ${JSON.stringify(e)},
        ${a.previousSnapshot?JSON.stringify(a.previousSnapshot):null},
        ${a.currentSnapshot?JSON.stringify(a.currentSnapshot):null},
        ${g},
        ${h},
        ${i},
        ${j},
        ${a.countryName||null},
        ${k},
        ${a.branchName||null},
        ${a.ipAddress||null},
        ${a.deviceSession||null},
        ${a.reason||null},
        ${JSON.stringify(a.metadata||{})},
        ${f},
        ${f?new Date().toISOString():null},
        ${f?g:null},
        NOW()
      )
      RETURNING id, version_number, action_type, created_at;
    `)[0]})}async function f(a,b){return(0,d.x)(async c=>await c`
      SELECT 
        id,
        entity_type,
        entity_id,
        reference_no,
        action_type,
        version_number,
        diff_changes,
        previous_snapshot,
        current_snapshot,
        user_id,
        user_name,
        user_role,
        country_id,
        country_name,
        city_branch_id,
        branch_name,
        ip_address,
        device_session,
        reason,
        is_deleted,
        deleted_at,
        deleted_by,
        created_at
      FROM enterprise_audit_events
      WHERE entity_type = ${a} AND entity_id = ${b}
      ORDER BY version_number ASC, created_at ASC;
    `)}async function g(a){return(0,d.x)(async b=>{let c=a.year||new Date().getFullYear(),d=a.month||new Date().getMonth()+1,e=await b`
      SELECT 
        COUNT(*) FILTER (WHERE action_type = 'CREATE') AS total_created,
        COUNT(*) FILTER (WHERE action_type = 'EDIT') AS total_edits,
        COUNT(DISTINCT entity_id) FILTER (WHERE action_type = 'EDIT') AS unique_entities_edited,
        COUNT(*) FILTER (WHERE action_type = 'SOFT_DELETE') AS total_deleted,
        COUNT(*) FILTER (WHERE action_type = 'RESTORE') AS total_restored
      FROM enterprise_audit_events
      WHERE EXTRACT(YEAR FROM created_at) = ${c}
        AND EXTRACT(MONTH FROM created_at) = ${d}
        ${a.countryId?b`AND country_id = ${a.countryId}`:b``}
        ${a.cityBranchId?b`AND city_branch_id = ${a.cityBranchId}`:b``}
    `,f=await b`
      SELECT 
        entity_type,
        COUNT(*) AS edit_count,
        COUNT(DISTINCT entity_id) AS unique_records_edited
      FROM enterprise_audit_events
      WHERE action_type = 'EDIT'
        AND EXTRACT(YEAR FROM created_at) = ${c}
        AND EXTRACT(MONTH FROM created_at) = ${d}
        ${a.countryId?b`AND country_id = ${a.countryId}`:b``}
        ${a.cityBranchId?b`AND city_branch_id = ${a.cityBranchId}`:b``}
      GROUP BY entity_type
      ORDER BY edit_count DESC;
    `,g=await b`
      SELECT 
        COALESCE(country_name, country_id, 'Global / Unassigned') AS country_label,
        country_id,
        COUNT(*) AS edit_count
      FROM enterprise_audit_events
      WHERE action_type = 'EDIT'
        AND EXTRACT(YEAR FROM created_at) = ${c}
        AND EXTRACT(MONTH FROM created_at) = ${d}
      GROUP BY country_name, country_id
      ORDER BY edit_count DESC;
    `,h=await b`
      SELECT 
        entity_type,
        entity_id,
        reference_no,
        country_name,
        branch_name,
        COUNT(*) AS edit_count,
        MAX(created_at) AS last_edited_at
      FROM enterprise_audit_events
      WHERE action_type = 'EDIT'
        AND EXTRACT(YEAR FROM created_at) = ${c}
        AND EXTRACT(MONTH FROM created_at) = ${d}
        ${a.countryId?b`AND country_id = ${a.countryId}`:b``}
        ${a.cityBranchId?b`AND city_branch_id = ${a.cityBranchId}`:b``}
      GROUP BY entity_type, entity_id, reference_no, country_name, branch_name
      ORDER BY edit_count DESC
      LIMIT 100;
    `;return{year:c,month:d,stats:e[0]||{},moduleBreakdown:f,countryBreakdown:g,topEditedRecords:h}})}async function h(a){return(0,d.x)(async b=>{let c=a.limit||50,d=a.offset||0,e=await b`
      SELECT 
        e.id,
        e.entity_type,
        e.entity_id,
        e.reference_no,
        e.version_number,
        e.current_snapshot,
        e.user_id,
        e.user_name,
        e.user_role,
        e.country_id,
        e.country_name,
        e.city_branch_id,
        e.branch_name,
        e.reason,
        e.deleted_at,
        e.deleted_by,
        e.created_at
      FROM enterprise_audit_events e
      WHERE e.action_type = 'SOFT_DELETE'
        ${a.countryId?b`AND e.country_id = ${a.countryId}`:b``}
        ${a.cityBranchId?b`AND e.city_branch_id = ${a.cityBranchId}`:b``}
        ${a.entityType?b`AND e.entity_type = ${a.entityType}`:b``}
        ${a.search?b`AND (e.reference_no ILIKE ${`%${a.search}%`} OR e.entity_id ILIKE ${`%${a.search}%`} OR e.user_name ILIKE ${`%${a.search}%`})`:b``}
      ORDER BY e.deleted_at DESC
      LIMIT ${c} OFFSET ${d};
    `,f=await b`
      SELECT COUNT(*) AS total
      FROM enterprise_audit_events
      WHERE action_type = 'SOFT_DELETE'
        ${a.countryId?b`AND country_id = ${a.countryId}`:b``}
        ${a.cityBranchId?b`AND city_branch_id = ${a.cityBranchId}`:b``}
        ${a.entityType?b`AND entity_type = ${a.entityType}`:b``};
    `;return{records:e,total:Number(f[0]?.total||0),limit:c,offset:d}})}},39588:(a,b,c)=>{"use strict";c.d(b,{DE:()=>o,J$:()=>n,aV:()=>j});var d=c(82161),e=c(64445),f=c(70303),g=c(53028),h=c(58429);function i(a,b){let c=[...new Set(a.map(a=>a.clearingAgentId).filter(a=>!!a))],d=a.some(a=>"full"===a.ledgerVisibility),e=a.some(a=>a.clearingAgentId&&"shipping_only"===a.ledgerVisibility),f=!b&&!d&&e&&c.length>0;return{clearingAgentIds:c,ledgerVisibility:d?"full":e?"shipping_only":"scoped",isShippingScoped:f}}class j extends Error{constructor(a="Authentication is required"){super(a),this.status=401}}function k(a){return[...new Set(a.filter(a=>!!a))]}function l(a){let b=[],c=[],d=[];for(let e of a)e.cityBranchId?d.push(e.cityBranchId):e.countryBranchId?c.push(e.countryBranchId):e.countryId&&b.push(e.countryId);return{initialCountryIds:k(b),initialCountryBranchIds:k(c),initialCityBranchIds:k(d)}}async function m(a,b,c,d,e){if(e||!a)return{countryIds:b,countryBranchIds:c,cityBranchIds:d};let f=new Set(b),g=new Set(c),h=new Set(d);if(b.length>0)try{let[c,d]=await Promise.all([a.from("country_branches").select("id").in("country_id",b).is("deleted_at",null),a.from("city_branches").select("id").in("country_id",b).is("deleted_at",null)]);c?.data?.forEach(a=>{a.id&&g.add(a.id)}),d?.data?.forEach(a=>{a.id&&h.add(a.id)})}catch(a){console.error("Error resolving downward from country IDs:",a)}if(c.length>0)try{let{data:b}=await a.from("city_branches").select("id").in("country_branch_id",c).is("deleted_at",null);b?.forEach(a=>{a.id&&h.add(a.id)})}catch(a){console.error("Error resolving downward from country branch IDs:",a)}let i=Array.from(h);if(i.length>0)try{let{data:b}=await a.from("city_branches").select("country_id, country_branch_id").in("id",i).is("deleted_at",null);b?.forEach(a=>{a.country_id&&f.add(a.country_id),a.country_branch_id&&g.add(a.country_branch_id)})}catch(a){console.error("Error resolving upward from city branches:",a)}let j=Array.from(g);if(j.length>0)try{let{data:b}=await a.from("country_branches").select("country_id").in("id",j).is("deleted_at",null);b?.forEach(a=>{a.country_id&&f.add(a.country_id)})}catch(a){console.error("Error resolving upward from country branches:",a)}return{countryIds:Array.from(f),countryBranchIds:Array.from(g),cityBranchIds:Array.from(h)}}async function n(){try{let a=await (0,h.P$)();if(a){let b=a.userId,c=[...new Set(a.roles.flatMap(a=>f.Ig[a]??[]))],d=(a.assignments??[]).map(a=>({role:a.role,countryId:a.countryId,countryBranchId:a.countryBranchId,cityBranchId:a.cityBranchId,clearingAgentId:null,ledgerVisibility:"scoped"})),{initialCountryIds:e,initialCountryBranchIds:g,initialCityBranchIds:h}=l(d),j=a.roles.includes("super_admin"),k=await m(null,e,g,h,j);return{userId:b,email:a.email,fullName:a.fullName??null,preferredLanguage:a.preferredLanguage,roles:a.roles,permissions:c,assignments:d,countryIds:k.countryIds,countryBranchIds:k.countryBranchIds,cityBranchIds:k.cityBranchIds,isSuperAdmin:j,...i(d,j)}}if(!(0,g.$G)())return null;let b=await (0,e.z)(),{data:{user:c},error:d}=await b.auth.getUser();if(d||!c)return null;let j=b.from("profiles").select("full_name, preferred_language_code").eq("id",c.id),k=await j.maybeSingle(),n=await b.from("user_role_assignments").select("role, country_id, country_branch_id, city_branch_id, clearing_agent_id, ledger_visibility").eq("user_id",c.id).eq("is_active",!0).is("deleted_at",null);if(n.error&&(n=await b.from("user_role_assignments").select("role, country_id, country_branch_id, city_branch_id").eq("user_id",c.id).eq("is_active",!0).is("deleted_at",null)),n.error)return console.error("Role assignments query error:",n.error.message),null;let o=(n.data??[]).map(a=>{var b;let c=(b=a.role,"branch_admin"===b?"city_branch_admin":"staff"===b?"staff_user":f.j.includes(b)?b:null);return c?{role:c,countryId:a.country_id,countryBranchId:a.country_branch_id,cityBranchId:a.city_branch_id,clearingAgentId:a.clearing_agent_id??null,ledgerVisibility:a.ledger_visibility??"scoped"}:null}).filter(a=>!!a),p=[...new Set(o.map(a=>a.role))],q=c.email&&("superadmin@damaan.com"===c.email.toLowerCase()||"asmatdgtllc@users.damaan.local"===c.email.toLowerCase()||c.email.toLowerCase().startsWith("superadmin"));p.length&&p.includes("super_admin")||!q||(p=Array.from(new Set(["super_admin",...p])));let r=[];try{let a=b.from("user_permission_sets").select("permissions").eq("user_id",c.id),d=await a.maybeSingle(),e=d?.data?.permissions??null;r=e&&Array.isArray(e)?e.filter(a=>"string"==typeof a&&a.length>0):[]}catch{r=[]}r.length||(r=[...new Set(p.flatMap(a=>f.Ig[a]??[]))]),p.includes("super_admin")&&!r.includes("*:*")&&(r=["*:*",...r]);let{initialCountryIds:s,initialCountryBranchIds:t,initialCityBranchIds:u}=l(o),v=p.includes("super_admin")||!!q,w=await m(b,s,t,u,v);return{userId:c.id,email:c.email??null,fullName:k.data?.full_name??null,preferredLanguage:k.data?.preferred_language_code??"en",roles:p,permissions:r,assignments:o,countryIds:w.countryIds,countryBranchIds:w.countryBranchIds,cityBranchIds:w.cityBranchIds,isSuperAdmin:v,...i(o,v)}}catch(a){if(a?.digest==="DYNAMIC_SERVER_USAGE"||a?.message&&String(a.message).includes("Dynamic server usage"))throw a;return console.error("getCurrentErpSession Error:",a),null}}async function o(){let a=await n();return a||(0,d.redirect)("/auth/login"),a}},58799:(a,b,c)=>{"use strict";c.d(b,{M:()=>i,x:()=>j});var d=c(29021),e=c.n(d),f=c(33873),g=c.n(f),h=c(49122);function i(){if(process.env.DATABASE_URL)return process.env.DATABASE_URL;try{let a=g().resolve(process.cwd());for(let b of[a,g().join(a,"ACCOUNTS.DGT.LLC"),g().resolve(a,"..")])for(let a of[".env.local",".env"]){let c=g().join(b,a);if(e().existsSync(c)){let a=e().readFileSync(c,"utf8").match(/^DATABASE_URL\s*=\s*(.+)$/m);if(a)return a[1].trim().replace(/^['"]|['"]$/g,"")}}}catch{}return""}async function j(a){let b=i();if(!b)return null;let c=(0,h.A)(b,{max:1,prepare:!1});try{return await a(c)}finally{await c.end({timeout:5})}}},78335:()=>{},96487:()=>{}};