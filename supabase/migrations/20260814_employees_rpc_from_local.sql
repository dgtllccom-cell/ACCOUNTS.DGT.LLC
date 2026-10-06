CREATE OR REPLACE FUNCTION public.list_employees_with_relations(p_country_id uuid DEFAULT NULL::uuid, p_branch_id uuid DEFAULT NULL::uuid, p_category text DEFAULT NULL::text, p_status text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(row_data order by row_data->>'created_at' desc), '[]'::jsonb)
  from (
    select to_jsonb(e) || jsonb_build_object(
      'person', case when p.id is null then null else to_jsonb(p) end,
      'country', case when c.id is null then null else to_jsonb(c) end,
      'country_branch', case when cb.id is null then null else to_jsonb(cb) end,
      'city_branch', case when cib.id is null then null else to_jsonb(cib) end
    ) as row_data
    from employees e
    left join customers p on p.id = e.person_master_id
    left join countries c on c.id = e.country_id
    left join country_branches cb on cb.id = e.country_branch_id
    left join city_branches cib on cib.id = e.city_branch_id
    where e.deleted_at is null
      and (p_country_id is null or e.country_id = p_country_id)
      and (p_branch_id is null or e.country_branch_id = p_branch_id)
      and (p_category is null or e.category = p_category)
      and (p_status is null or e.status = p_status)
  ) sub;
$function$
;