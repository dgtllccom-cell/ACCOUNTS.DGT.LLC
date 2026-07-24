import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PortRow = {
  id: string;
  port_name: string;
  country_id: string | null;
  port_code: string | null;
  transport_type: 'sea' | 'road' | 'air';
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  country?: {
    id: string;
    name: string;
  } | null;
};

export type PortInput = {
  portName: string;
  countryId?: string | null;
  portCode?: string | null;
  transportType?: 'sea' | 'road' | 'air';
  isActive?: boolean;
};

function cleanQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export class LoadingPortsRepository {
  async search(input: {
    query?: string | null;
    countryId?: string | null;
    transportType?: string | null;
    limit?: number;
    all?: boolean;
  }) {
    const supabase = createSupabaseAdminClient() as any;
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 250);

    let query = supabase
      .from("ports")
      .select(`
        id,
        port_name,
        country_id,
        port_code,
        transport_type,
        is_active,
        created_by,
        created_at,
        updated_at,
        country:country_id(id, name)
      `)
      .is("deleted_at", null);

    if (!input.all) {
      query = query.eq("is_active", true);
    }

    if (input.countryId) {
      query = query.eq("country_id", input.countryId);
    }

    if (input.transportType) {
      query = query.eq("transport_type", input.transportType);
    }

    const q = cleanQuery(input.query ?? "");
    if (q) {
      const like = `%${q}%`;
      query = query.or(`port_name.ilike.${like},port_code.ilike.${like}`);
    }

    query = query.order("port_name", { ascending: true });

    const { data, error } = await query.limit(limit);
    if (error) throw new Error(error.message);
    return { ports: (data ?? []) as PortRow[], limit };
  }

  async getById(id: string) {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("ports")
      .select(`
        id,
        port_name,
        country_id,
        port_code,
        transport_type,
        is_active,
        created_by,
        created_at,
        updated_at,
        country:country_id(id, name)
      `)
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) throw new Error(error.message);
    return data as PortRow;
  }

  async create(input: PortInput, actorId?: string | null) {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("ports")
      .insert({
        port_name: input.portName,
        country_id: input.countryId ?? null,
        port_code: input.portCode ?? null,
        transport_type: input.transportType ?? "sea",
        is_active: input.isActive ?? true,
        created_by: actorId ?? null
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return (data as { id: string }).id;
  }

  async update(id: string, input: Partial<PortInput>, _actorId?: string | null) {
    const supabase = createSupabaseAdminClient() as any;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("portName" in input) patch.port_name = input.portName;
    if ("countryId" in input) patch.country_id = input.countryId;
    if ("portCode" in input) patch.port_code = input.portCode;
    if ("transportType" in input) patch.transport_type = input.transportType;
    if ("isActive" in input) patch.is_active = input.isActive;

    const { error } = await supabase
      .from("ports")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
  }

  async softDelete(id: string) {
    const supabase = createSupabaseAdminClient() as any;
    const { error } = await supabase
      .from("ports")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: false
      })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
  }
}

export class ReceivedPortsRepository {
  async search(input: {
    query?: string | null;
    countryId?: string | null;
    transportType?: string | null;
    limit?: number;
    all?: boolean;
  }) {
    const supabase = createSupabaseAdminClient() as any;
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 250);

    let query = supabase
      .from("ports")
      .select(`
        id,
        port_name,
        country_id,
        port_code,
        transport_type,
        is_active,
        created_by,
        created_at,
        updated_at,
        country:country_id(id, name)
      `)
      .is("deleted_at", null);

    if (!input.all) {
      query = query.eq("is_active", true);
    }

    if (input.countryId) {
      query = query.eq("country_id", input.countryId);
    }

    if (input.transportType) {
      query = query.eq("transport_type", input.transportType);
    }

    const q = cleanQuery(input.query ?? "");
    if (q) {
      const like = `%${q}%`;
      query = query.or(`port_name.ilike.${like},port_code.ilike.${like}`);
    }

    query = query.order("port_name", { ascending: true });

    const { data, error } = await query.limit(limit);
    if (error) throw new Error(error.message);
    return { ports: (data ?? []) as PortRow[], limit };
  }

  async getById(id: string) {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("ports")
      .select(`
        id,
        port_name,
        country_id,
        port_code,
        transport_type,
        is_active,
        created_by,
        created_at,
        updated_at,
        country:country_id(id, name)
      `)
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) throw new Error(error.message);
    return data as PortRow;
  }

  async create(input: PortInput, actorId?: string | null) {
    const supabase = createSupabaseAdminClient() as any;
    const { data, error } = await supabase
      .from("ports")
      .insert({
        port_name: input.portName,
        country_id: input.countryId ?? null,
        port_code: input.portCode ?? null,
        transport_type: input.transportType ?? "sea",
        is_active: input.isActive ?? true,
        created_by: actorId ?? null
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return (data as { id: string }).id;
  }

  async update(id: string, input: Partial<PortInput>, _actorId?: string | null) {
    const supabase = createSupabaseAdminClient() as any;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ("portName" in input) patch.port_name = input.portName;
    if ("countryId" in input) patch.country_id = input.countryId;
    if ("portCode" in input) patch.port_code = input.portCode;
    if ("transportType" in input) patch.transport_type = input.transportType;
    if ("isActive" in input) patch.is_active = input.isActive;

    const { error } = await supabase
      .from("ports")
      .update(patch)
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
  }

  async softDelete(id: string) {
    const supabase = createSupabaseAdminClient() as any;
    const { error } = await supabase
      .from("ports")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: false
      })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
  }
}

export const loadingPortsRepository = new LoadingPortsRepository();
export const receivedPortsRepository = new ReceivedPortsRepository();
