import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type MasterParameterCategory =
  | "seaport"
  | "dry_port"
  | "airport"
  | "border_crossing"
  | "free_zone"
  | "industrial_zone"
  | "location"
  | "city"
  | "state"
  | "country";

export type MasterParameterRow = {
  id: string;
  official_name: string;
  country_name: string;
  country_iso2: string;
  country_id?: string | null;
  category: MasterParameterCategory;
  code?: string | null;
  description?: string | null;
  is_active: boolean;
};

/**
 * Standardized Master Parameters Dataset with official full names.
 * Single source of truth for all locations, ports, borders, airports, free zones in the ERP.
 */
export const GLOBAL_OFFICIAL_MASTER_PARAMETERS: Array<{
  category: MasterParameterCategory;
  countryIso2: string;
  countryName: string;
  officialName: string;
  code: string;
}> = [
  // 🇦🇪 UNITED ARAB EMIRATES (UAE)
  { category: "seaport", countryIso2: "AE", countryName: "United Arab Emirates", officialName: "Jebel Ali Port", code: "AEJAF" },
  { category: "seaport", countryIso2: "AE", countryName: "United Arab Emirates", officialName: "Port Rashid", code: "AEPRA" },
  { category: "seaport", countryIso2: "AE", countryName: "United Arab Emirates", officialName: "Khalifa Port", code: "AEKHL" },
  { category: "seaport", countryIso2: "AE", countryName: "United Arab Emirates", officialName: "Hamriyah Port", countryName: "United Arab Emirates", code: "AEHAM" },
  { category: "seaport", countryIso2: "AE", countryName: "United Arab Emirates", officialName: "Fujairah Port", code: "AEFUJ" },
  { category: "seaport", countryIso2: "AE", countryName: "United Arab Emirates", officialName: "Khor Fakkan Port", code: "AEKFK" },
  { category: "seaport", countryIso2: "AE", countryName: "United Arab Emirates", officialName: "Mina Zayed Port", code: "AEMZY" },
  { category: "free_zone", countryIso2: "AE", countryName: "United Arab Emirates", officialName: "Jebel Ali Free Zone (JAFZA)", code: "JAFZA" },
  { category: "free_zone", countryIso2: "AE", countryName: "United Arab Emirates", officialName: "Hamriyah Free Zone Authority (HFZA)", code: "HFZA" },
  { category: "free_zone", countryIso2: "AE", countryName: "United Arab Emirates", officialName: "Dubai Airport Freezone (DAFZA)", code: "DAFZA" },
  { category: "free_zone", countryIso2: "AE", countryName: "United Arab Emirates", officialName: "Dubai Multi Commodities Centre (DMCC)", code: "DMCC" },
  { category: "free_zone", countryIso2: "AE", countryName: "United Arab Emirates", officialName: "Sharjah Airport International Free Zone (SAIF Zone)", code: "SAIF" },
  { category: "airport", countryIso2: "AE", countryName: "United Arab Emirates", officialName: "Dubai International Airport", code: "DXB" },
  { category: "airport", countryIso2: "AE", countryName: "United Arab Emirates", officialName: "Al Maktoum International Airport (Dubai World Central)", code: "DWC" },
  { category: "airport", countryIso2: "AE", countryName: "United Arab Emirates", officialName: "Zayed International Airport (Abu Dhabi)", code: "AUH" },
  { category: "airport", countryIso2: "AE", countryName: "United Arab Emirates", officialName: "Sharjah International Airport", code: "SHJ" },
  { category: "industrial_zone", countryIso2: "AE", countryName: "United Arab Emirates", officialName: "Khalifa Industrial Zone Abu Dhabi (KIZAD)", code: "KIZAD" },
  { category: "industrial_zone", countryIso2: "AE", countryName: "United Arab Emirates", officialName: "Dubai Industrial City (DIC)", code: "DIC" },

  // 🇵🇰 PAKISTAN
  { category: "seaport", countryIso2: "PK", countryName: "Pakistan", officialName: "Karachi Port", code: "PKKHI" },
  { category: "seaport", countryIso2: "PK", countryName: "Pakistan", officialName: "Port Muhammad Bin Qasim", code: "PQPKS" },
  { category: "seaport", countryIso2: "PK", countryName: "Pakistan", officialName: "Gwadar Deep Water Port", code: "PKGWD" },
  { category: "border_crossing", countryIso2: "PK", countryName: "Pakistan", officialName: "Torkham Border Crossing", code: "PKTRK" },
  { category: "border_crossing", countryIso2: "PK", countryName: "Pakistan", officialName: "Chaman Border Crossing", code: "PKCHM" },
  { category: "border_crossing", countryIso2: "PK", countryName: "Pakistan", officialName: "Taftan Border Crossing", code: "PKSZT" },
  { category: "border_crossing", countryIso2: "PK", countryName: "Pakistan", officialName: "Gabd-Rimdan Border Crossing", code: "PKGBD" },
  { category: "border_crossing", countryIso2: "PK", countryName: "Pakistan", officialName: "Khunjerab Pass Border Crossing", code: "PKKHN" },
  { category: "dry_port", countryIso2: "PK", countryName: "Pakistan", officialName: "Lahore Dry Port", code: "PKLHR" },
  { category: "dry_port", countryIso2: "PK", countryName: "Pakistan", officialName: "Multan Dry Port", code: "PKMUX" },
  { category: "dry_port", countryIso2: "PK", countryName: "Pakistan", officialName: "Faisalabad Dry Port", code: "PKLYP" },
  { category: "dry_port", countryIso2: "PK", countryName: "Pakistan", officialName: "Peshawar Dry Port", code: "PEWDP" },
  { category: "dry_port", countryIso2: "PK", countryName: "Pakistan", officialName: "Sialkot Dry Port", code: "SKTDP" },
  { category: "airport", countryIso2: "PK", countryName: "Pakistan", officialName: "Jinnah International Airport (Karachi)", code: "KHI" },
  { category: "airport", countryIso2: "PK", countryName: "Pakistan", officialName: "Allama Iqbal International Airport (Lahore)", code: "LHR" },
  { category: "airport", countryIso2: "PK", countryName: "Pakistan", officialName: "Islamabad International Airport", code: "ISB" },

  // 🇦🇫 AFGHANISTAN
  { category: "border_crossing", countryIso2: "AF", countryName: "Afghanistan", officialName: "Torkham Border Crossing", code: "AFTRK" },
  { category: "border_crossing", countryIso2: "AF", countryName: "Afghanistan", officialName: "Spin Boldak Border Crossing", code: "AFSPD" },
  { category: "border_crossing", countryIso2: "AF", countryName: "Afghanistan", officialName: "Hairatan Border Port", code: "AFHRT" },
  { category: "border_crossing", countryIso2: "AF", countryName: "Afghanistan", officialName: "Islam Qala Border Crossing", code: "AFIQL" },
  { category: "border_crossing", countryIso2: "AF", countryName: "Afghanistan", officialName: "Torghundi Border Crossing", code: "AFTGD" },
  { category: "border_crossing", countryIso2: "AF", countryName: "Afghanistan", officialName: "Aqina Port Border Crossing", code: "AFAQN" },
  { category: "border_crossing", countryIso2: "AF", countryName: "Afghanistan", officialName: "Sher Khan Bandar Border Crossing", code: "AFSKB" },
  { category: "dry_port", countryIso2: "AF", countryName: "Afghanistan", officialName: "Kabul Dry Port Customs Terminal", code: "AFKBL" },
  { category: "airport", countryIso2: "AF", countryName: "Afghanistan", officialName: "Kabul International Airport", code: "KBL" },
  { category: "airport", countryIso2: "AF", countryName: "Afghanistan", officialName: "Ahmad Shah Baba International Airport (Kandahar)", code: "KDH" },

  // 🇮🇳 INDIA
  { category: "seaport", countryIso2: "IN", countryName: "India", officialName: "Jawaharlal Nehru Port (Nhava Sheva / JNPT)", code: "INNSA" },
  { category: "seaport", countryIso2: "IN", countryName: "India", officialName: "Mundra Port", code: "INMUN" },
  { category: "seaport", countryIso2: "IN", countryName: "India", officialName: "Chennai Port", code: "MAAIN" },
  { category: "seaport", countryIso2: "IN", countryName: "India", officialName: "Mumbai Port Trust", code: "BOMIN" },
  { category: "seaport", countryIso2: "IN", countryName: "India", officialName: "Deendayal Port (Kandla Port)", code: "IXYIN" },
  { category: "border_crossing", countryIso2: "IN", countryName: "India", officialName: "Attari Integrated Check Post (Wagah-Attari Border)", code: "INATR" },
  { category: "airport", countryIso2: "IN", countryName: "India", officialName: "Chhatrapati Shivaji Maharaj International Airport (Mumbai)", code: "BOM" },
  { category: "airport", countryIso2: "IN", countryName: "India", officialName: "Indira Gandhi International Airport (New Delhi)", code: "DEL" },

  // 🇮🇷 IRAN
  { category: "seaport", countryIso2: "IR", countryName: "Iran", officialName: "Shahid Rajaee Port (Bandar Abbas)", code: "IRBND" },
  { category: "seaport", countryIso2: "IR", countryName: "Iran", officialName: "Bandar Imam Khomeini Port", code: "IRBIK" },
  { category: "seaport", countryIso2: "IR", countryName: "Iran", officialName: "Shahid Beheshti Port (Chabahar)", code: "IRCHB" },
  { category: "border_crossing", countryIso2: "IR", countryName: "Iran", officialName: "Bazargan Border Crossing", code: "IRBZG" },
  { category: "border_crossing", countryIso2: "IR", countryName: "Iran", officialName: "Mirjaveh Border Crossing", code: "IRMRJ" },
  { category: "border_crossing", countryIso2: "IR", countryName: "Iran", officialName: "Dogharoon / Islam Qala Border Crossing", code: "IRDGH" },
  { category: "airport", countryIso2: "IR", countryName: "Iran", officialName: "Tehran Imam Khomeini International Airport", code: "IKA" },

  // 🇨🇳 CHINA
  { category: "seaport", countryIso2: "CN", countryName: "China", officialName: "Port of Shanghai", code: "CNSHA" },
  { category: "seaport", countryIso2: "CN", countryName: "China", officialName: "Port of Shenzhen", code: "CNSZX" },
  { category: "seaport", countryIso2: "CN", countryName: "China", officialName: "Port of Ningbo-Zhoushan", code: "CNNGB" },
  { category: "seaport", countryIso2: "CN", countryName: "China", officialName: "Port of Qingdao", code: "CNTAO" },
  { category: "border_crossing", countryIso2: "CN", countryName: "China", officialName: "Khunjerab Pass Border Crossing", code: "CNKHN" },
  { category: "airport", countryIso2: "CN", countryName: "China", officialName: "Shanghai Pudong International Airport", code: "PVG" },
  { category: "airport", countryIso2: "CN", countryName: "China", officialName: "Guangzhou Baiyun International Airport", code: "CAN" },

  // 🇺🇸 USA
  { category: "seaport", countryIso2: "US", countryName: "USA", officialName: "Port of Los Angeles", code: "USLAX" },
  { category: "seaport", countryIso2: "US", countryName: "USA", officialName: "Port of Long Beach", code: "USLGB" },
  { category: "seaport", countryIso2: "US", countryName: "USA", officialName: "Port of New York and New Jersey", code: "USNYC" },
  { category: "seaport", countryIso2: "US", countryName: "USA", officialName: "Port of Miami", code: "USMIA" },
  { category: "airport", countryIso2: "US", countryName: "USA", officialName: "John F. Kennedy International Airport (New York)", code: "JFK" },
  { category: "airport", countryIso2: "US", countryName: "USA", officialName: "Los Angeles International Airport", code: "LAX" }
];

export class MasterParametersService {
  /**
   * Fetch Master Parameters by Category and Country ID / Country Name.
   * If database query returns rows, use them; otherwise, fall back to official static dataset.
   */
  async getParameters(params: {
    category?: MasterParameterCategory | null;
    countryId?: string | null;
    countryName?: string | null;
    countryIso2?: string | null;
    searchQuery?: string | null;
  }): Promise<MasterParameterRow[]> {
    try {
      const supabase = createSupabaseAdminClient() as any;
      let query = supabase.from("ports").select("id, port_name, country_id, port_code, transport_type, is_active, country:country_id(id, name, iso2)").is("deleted_at", null).eq("is_active", true);

      if (params.countryId) {
        query = query.eq("country_id", params.countryId);
      }

      if (params.category) {
        // Map category to transport_type or query
        if (params.category === "seaport") query = query.eq("transport_type", "sea");
        else if (params.category === "road" as any || params.category === "border_crossing") query = query.eq("transport_type", "road");
        else if (params.category === "air" as any || params.category === "airport") query = query.eq("transport_type", "air");
      }

      if (params.searchQuery?.trim()) {
        query = query.ilike("port_name", `%${params.searchQuery.trim()}%`);
      }

      const { data, error } = await query.limit(100);

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((r: any) => ({
          id: r.id,
          official_name: r.port_name,
          country_name: r.country?.name || "Global",
          country_iso2: r.country?.iso2 || "",
          country_id: r.country_id,
          category: (r.transport_type === "sea" ? "seaport" : r.transport_type === "air" ? "airport" : "border_crossing") as MasterParameterCategory,
          code: r.port_code,
          is_active: r.is_active ?? true
        }));
      }
    } catch {
      // Database read error fallback to seed
    }

    // Fall back to complete official static dataset
    let filtered = [...GLOBAL_OFFICIAL_MASTER_PARAMETERS];

    if (params.category) {
      filtered = filtered.filter((item) => item.category === params.category);
    }

    if (params.countryIso2) {
      const iso = params.countryIso2.toUpperCase().trim();
      filtered = filtered.filter((item) => item.countryIso2 === iso);
    } else if (params.countryName) {
      const name = params.countryName.toLowerCase().trim();
      filtered = filtered.filter((item) => item.countryName.toLowerCase().includes(name));
    }

    if (params.searchQuery?.trim()) {
      const q = params.searchQuery.toLowerCase().trim();
      filtered = filtered.filter((item) => item.officialName.toLowerCase().includes(q) || item.code.toLowerCase().includes(q));
    }

    return filtered.map((item, index) => ({
      id: `master-${item.category}-${item.countryIso2}-${index}`,
      official_name: item.officialName,
      country_name: item.countryName,
      country_iso2: item.countryIso2,
      category: item.category,
      code: item.code,
      is_active: true
    }));
  }
}

export const masterParametersService = new MasterParametersService();
