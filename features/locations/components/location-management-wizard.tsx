"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import {
  Globe2,
  Map,
  MapPin,
  Plus,
  Save,
  Search,
  Workflow,
  Download,
  Upload,
  Trash2,
  Edit3,
  Loader2,
  Info,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  X,
  Printer,
  FolderTree,
  Layers,
  ArrowLeft,
  Eye,
  Building2,
  Maximize2,
  Minimize2,
  FileSpreadsheet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";

type CountryRow = {
  id: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  currency_code: string;
  default_language_code: string | null;
  is_active: boolean;
};

type CountrySummaryRow = CountryRow & {
  total_states: number;
  total_cities: number;
  total_districts: number;
};

type StateRow = {
  id: string;
  country_id: string;
  name: string;
  code: string | null;
  is_active: boolean;
};

type StateSummaryRow = StateRow & {
  total_cities: number;
  total_districts: number;
};

type DistrictRow = {
  id: string;
  country_id: string;
  state_province_id: string;
  name: string;
  code: string | null;
  is_active: boolean;
};

type CitySummaryRow = DistrictRow & {
  total_districts: number;
};

type CityRow = {
  id: string;
  country_id: string;
  state_province_id: string | null;
  district_id: string | null;
  name: string;
  code: string | null;
  zip_code: string | null;
  is_active: boolean;
};

type LocationSummaryStats = {
  totalCountries: number;
  totalStates: number;
  totalCities: number;
  totalDistricts: number;
};

type LocationTreeNode = {
  id: string;
  name: string;
  code: string;
  type: "country" | "state" | "city" | "district";
  isActive: boolean;
  item: any;
  children?: LocationTreeNode[];
};

type TabType = "country" | "state" | "city" | "tehsil";

type DrillPath = {
  countryId?: string;
  countryName?: string;
  stateId?: string;
  stateName?: string;
  cityId?: string;
  cityName?: string;
};

type ImportRow = {
  countryCode: string;
  countryName: string;
  stateCode: string;
  stateName: string;
  cityCode: string;
  cityName: string;
  tehsilCode: string;
  tehsilName: string;
};

interface LocationManagementWizardProps {
  activeTab?: string;
}

export function LocationManagementWizard({ activeTab: initialTab }: LocationManagementWizardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("country");
  const [banner, setBanner] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Drill-down Breadcrumb & Scope State
  const [drillPath, setDrillPath] = useState<DrillPath>({});

  // Summary Statistics
  const [stats, setStats] = useState<LocationSummaryStats>({
    totalCountries: 0,
    totalStates: 0,
    totalCities: 0,
    totalDistricts: 0
  });

  // Raw list states & summaries
  const [countries, setCountries] = useState<CountrySummaryRow[]>([]);
  const [states, setStates] = useState<StateSummaryRow[]>([]);
  const [districts, setDistricts] = useState<CitySummaryRow[]>([]);
  const [cities, setCities] = useState<CityRow[]>([]);

  // Search queries & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Cascading selections
  const [selectedCountryId, setSelectedCountryId] = useState("");
  const [selectedStateId, setSelectedStateId] = useState("");
  const [selectedDistrictId, setSelectedDistrictId] = useState("");

  // Loading indicators
  const [loading, setLoading] = useState({
    stats: false,
    countries: false,
    states: false,
    districts: false,
    cities: false,
    saving: false,
    deleting: false,
    tree: false
  });

  // Create & Edit modal states
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editRecordId, setEditRecordId] = useState<string | null>(null);

  // Cascading dropdowns inside Form Modals
  const [modalCountryId, setModalCountryId] = useState("");
  const [modalStateId, setModalStateId] = useState("");
  const [modalDistrictId, setModalDistrictId] = useState("");
  const [modalStates, setModalStates] = useState<StateRow[]>([]);
  const [modalDistricts, setModalDistricts] = useState<DistrictRow[]>([]);

  // Full Hierarchy Tree View Modal
  const [isFullTreeModalOpen, setIsFullTreeModalOpen] = useState(false);
  const [fullTreeData, setFullTreeData] = useState<LocationTreeNode[]>([]);
  const [treeSearchQuery, setTreeSearchQuery] = useState("");
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  // Bulk Import
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importProgress, setImportProgress] = useState<{ total: number; current: number } | null>(null);
  const [importLogs, setImportLogs] = useState<string[]>([]);

  // Deletion confirm
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    id: string;
    name: string;
    type: TabType;
  } | null>(null);

  // Form states
  const [formCountry, setFormCountry] = useState({ name: "", iso2: "", isActive: true });
  const [formState, setFormState] = useState({ name: "", codeSuffix: "", isActive: true });
  const [formCity, setFormCity] = useState({ name: "", codeSuffix: "", isActive: true });
  const [formTehsil, setFormTehsil] = useState({ name: "", codeSuffix: "", zipCode: "", isActive: true });

  // Initial tab sync
  useEffect(() => {
    if (initialTab && ["country", "state", "city", "tehsil"].includes(initialTab)) {
      setActiveTab(initialTab as TabType);
      setSearchQuery("");
      setBanner(null);
    }
  }, [initialTab]);

  // Load summary statistics and countries list on mount
  useEffect(() => {
    refreshAllData();
  }, []);

  // Set default selected country
  useEffect(() => {
    if (countries.length > 0 && !selectedCountryId) {
      const pk = countries.find((c) => c.iso2 === "PK");
      const defaultId = pk ? pk.id : countries[0].id;
      setSelectedCountryId(defaultId);
      setDrillPath((prev) => ({
        ...prev,
        countryId: defaultId,
        countryName: pk ? pk.name : countries[0].name
      }));
    }
  }, [countries]);

  // Load cascade listings on selection change
  useEffect(() => {
    if (selectedCountryId) {
      loadStates(selectedCountryId);
    }
  }, [selectedCountryId]);

  useEffect(() => {
    if (selectedStateId) {
      loadDistricts(selectedStateId);
    }
  }, [selectedStateId]);

  useEffect(() => {
    if (selectedCountryId && selectedStateId && selectedDistrictId) {
      loadCities(selectedCountryId, selectedStateId, selectedDistrictId);
    } else {
      setCities([]);
    }
  }, [selectedCountryId, selectedStateId, selectedDistrictId]);

  // Modal cascade dropdown updates
  useEffect(() => {
    if (modalCountryId) {
      loadModalStates(modalCountryId);
      if (modalMode === "add") {
        setModalStateId("");
        setModalDistrictId("");
      }
    }
  }, [modalCountryId]);

  useEffect(() => {
    if (modalStateId) {
      loadModalDistricts(modalStateId);
      if (modalMode === "add") {
        setModalDistrictId("");
      }
    }
  }, [modalStateId]);

  // Data Refreshers
  async function refreshAllData() {
    loadSummaryStats();
    loadCountries();
  }

  async function loadSummaryStats() {
    setLoading((prev) => ({ ...prev, stats: true }));
    try {
      const res = await apiGet<{ stats: LocationSummaryStats }>("/api/erp/locations/summary");
      if (res.stats) setStats(res.stats);
    } catch (e: any) {
      console.error("Failed to load summary stats:", e);
    } finally {
      setLoading((prev) => ({ ...prev, stats: false }));
    }
  }

  async function loadCountries() {
    setLoading((prev) => ({ ...prev, countries: true }));
    try {
      const res = await apiGet<{ countrySummaries?: CountrySummaryRow[]; countries?: CountryRow[] }>("/api/erp/locations/summary");
      if (res.countrySummaries) {
        setCountries(res.countrySummaries);
      } else {
        const raw = await apiGet<{ countries: CountryRow[] }>("/api/erp/locations/countries");
        setCountries(
          (raw.countries || []).map((c) => ({
            ...c,
            total_states: 0,
            total_cities: 0,
            total_districts: 0
          }))
        );
      }
    } catch (e: any) {
      showBanner("error", e.message || "Failed to load country summaries");
    } finally {
      setLoading((prev) => ({ ...prev, countries: false }));
    }
  }

  async function loadStates(countryId: string) {
    setLoading((prev) => ({ ...prev, states: true }));
    try {
      const res = await apiGet<{ stateSummaries?: StateSummaryRow[] }>(`/api/erp/locations/summary?countryId=${countryId}`);
      if (res.stateSummaries) {
        setStates(res.stateSummaries);
      } else {
        const raw = await apiGet<{ states: StateRow[] }>(`/api/erp/locations/states?countryId=${countryId}`);
        setStates((raw.states || []).map((s) => ({ ...s, total_cities: 0, total_districts: 0 })));
      }
    } catch (e: any) {
      showBanner("error", e.message || "Failed to load states");
    } finally {
      setLoading((prev) => ({ ...prev, states: false }));
    }
  }

  async function loadDistricts(stateId: string) {
    setLoading((prev) => ({ ...prev, districts: true }));
    try {
      const res = await apiGet<{ citySummaries?: CitySummaryRow[] }>(`/api/erp/locations/summary?stateId=${stateId}`);
      if (res.citySummaries) {
        setDistricts(res.citySummaries);
      } else {
        const raw = await apiGet<{ districts: DistrictRow[] }>(`/api/erp/locations/districts?stateProvinceId=${stateId}`);
        setDistricts((raw.districts || []).map((d) => ({ ...d, total_districts: 0 })));
      }
    } catch (e: any) {
      showBanner("error", e.message || "Failed to load cities");
    } finally {
      setLoading((prev) => ({ ...prev, districts: false }));
    }
  }

  async function loadCities(countryId: string, stateId: string, districtId: string) {
    setLoading((prev) => ({ ...prev, cities: true }));
    try {
      const res = await apiGet<{ cities: CityRow[] }>(
        `/api/erp/locations/cities?countryId=${countryId}&stateProvinceId=${stateId}&districtId=${districtId}`
      );
      setCities(res.cities || []);
    } catch (e: any) {
      showBanner("error", e.message || "Failed to load tehsils/districts");
    } finally {
      setLoading((prev) => ({ ...prev, cities: false }));
    }
  }

  async function loadFullTree() {
    setLoading((prev) => ({ ...prev, tree: true }));
    try {
      const res = await apiGet<{ fullTree: LocationTreeNode[] }>("/api/erp/locations/summary?tree=true");
      setFullTreeData(res.fullTree || []);
      // Expand top level by default
      const defaultExpanded = new Set<string>();
      (res.fullTree || []).forEach((c) => defaultExpanded.add(c.id));
      setExpandedNodeIds(defaultExpanded);
    } catch (e: any) {
      showBanner("error", e.message || "Failed to load location tree");
    } finally {
      setLoading((prev) => ({ ...prev, tree: false }));
    }
  }

  // Modal cascade loaders
  async function loadModalStates(countryId: string) {
    try {
      const res = await apiGet<{ states: StateRow[] }>(`/api/erp/locations/states?countryId=${countryId}`);
      setModalStates(res.states || []);
    } catch (e) {
      console.error("Failed to load modal states", e);
    }
  }

  async function loadModalDistricts(stateId: string) {
    try {
      const res = await apiGet<{ districts: DistrictRow[] }>(`/api/erp/locations/districts?stateProvinceId=${stateId}`);
      setModalDistricts(res.districts || []);
    } catch (e) {
      console.error("Failed to load modal districts", e);
    }
  }

  function showBanner(type: "success" | "error" | "info", message: string) {
    setBanner({ type, message });
    setTimeout(() => setBanner(null), 8000);
  }

  // Options converters
  const countryOptions = useMemo(() => {
    return countries.map((c) => ({
      value: c.id,
      label: `${c.name} (${c.iso2 || "XX"})`,
      keywords: `${c.name} ${c.iso2}`
    }));
  }, [countries]);

  const stateOptions = useMemo(() => {
    return states.map((s) => ({
      value: s.id,
      label: s.code ? `${s.name} (${s.code})` : s.name,
      keywords: `${s.name} ${s.code}`
    }));
  }, [states]);

  const districtOptions = useMemo(() => {
    return districts.map((d) => ({
      value: d.id,
      label: d.code ? `${d.name} (${d.code})` : d.name,
      keywords: `${d.name} ${d.code}`
    }));
  }, [districts]);

  // Filtered Lists
  const filteredCountries = useMemo(() => {
    return countries.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.iso2 || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" ? true : statusFilter === "active" ? c.is_active : !c.is_active;
      return matchesSearch && matchesStatus;
    });
  }, [countries, searchQuery, statusFilter]);

  const filteredStates = useMemo(() => {
    return states.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.code || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" ? true : statusFilter === "active" ? s.is_active : !s.is_active;
      return matchesSearch && matchesStatus;
    });
  }, [states, searchQuery, statusFilter]);

  const filteredDistricts = useMemo(() => {
    return districts.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) || (d.code || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" ? true : statusFilter === "active" ? d.is_active : !d.is_active;
      return matchesSearch && matchesStatus;
    });
  }, [districts, searchQuery, statusFilter]);

  const filteredCities = useMemo(() => {
    return cities.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.zip_code || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" ? true : statusFilter === "active" ? c.is_active : !c.is_active;
      return matchesSearch && matchesStatus;
    });
  }, [cities, searchQuery, statusFilter]);

  // Code Prefix Rules for Modals
  const modalStateCodePrefix = useMemo(() => {
    const parent = countries.find((c) => c.id === modalCountryId);
    return parent ? `${parent.iso2 || "XX"}-` : "";
  }, [countries, modalCountryId]);

  const modalDistrictCodePrefix = useMemo(() => {
    const parentCountry = countries.find((c) => c.id === modalCountryId);
    const parentState = modalStates.find((s) => s.id === modalStateId);
    const cCode = parentCountry ? parentCountry.iso2 || "XX" : "XX";
    let sCode = parentState ? parentState.code || "XX" : "XX";
    if (sCode.startsWith(`${cCode}-`)) sCode = sCode.substring(cCode.length + 1);
    return `${cCode}-${sCode}-`;
  }, [countries, modalStates, modalCountryId, modalStateId]);

  const modalTehsilCodePrefix = useMemo(() => {
    const parentCountry = countries.find((c) => c.id === modalCountryId);
    const parentState = modalStates.find((s) => s.id === modalStateId);
    const parentDistrict = modalDistricts.find((d) => d.id === modalDistrictId);

    const cCode = parentCountry ? parentCountry.iso2 || "XX" : "XX";
    let sCode = parentState ? parentState.code || "XX" : "XX";
    if (sCode.startsWith(`${cCode}-`)) sCode = sCode.substring(cCode.length + 1);
    let dCode = parentDistrict ? parentDistrict.code || "XX" : "XX";
    const prefix2 = `${cCode}-${sCode}-`;
    if (dCode.startsWith(prefix2)) dCode = dCode.substring(prefix2.length);

    return `${cCode}-${sCode}-${dCode}-`;
  }, [countries, modalStates, modalDistricts, modalCountryId, modalStateId, modalDistrictId]);

  // Drill-Down Handlers
  function handleDrillToState(country: CountryRow) {
    setSelectedCountryId(country.id);
    setDrillPath({ countryId: country.id, countryName: country.name });
    setActiveTab("state");
    setSearchQuery("");
    loadStates(country.id);
  }

  function handleDrillToCity(state: StateRow) {
    setSelectedStateId(state.id);
    setDrillPath((prev) => ({ ...prev, stateId: state.id, stateName: state.name }));
    setActiveTab("city");
    setSearchQuery("");
    loadDistricts(state.id);
  }

  function handleDrillToTehsil(district: DistrictRow) {
    setSelectedDistrictId(district.id);
    setDrillPath((prev) => ({ ...prev, cityId: district.id, cityName: district.name }));
    setActiveTab("tehsil");
    setSearchQuery("");
    if (selectedCountryId && selectedStateId) {
      loadCities(selectedCountryId, selectedStateId, district.id);
    }
  }

  function resetDrillToCountry() {
    setDrillPath({});
    setActiveTab("country");
    setSearchQuery("");
  }

  // Form open methods
  function handleOpenAddModal() {
    setModalMode("add");
    setEditRecordId(null);
    setBanner(null);

    setModalCountryId(selectedCountryId || (countries[0]?.id ?? ""));
    setModalStateId(selectedStateId);
    setModalDistrictId(selectedDistrictId);

    if (activeTab === "country") {
      setFormCountry({ name: "", iso2: "", isActive: true });
    } else if (activeTab === "state") {
      setFormState({ name: "", codeSuffix: "", isActive: true });
    } else if (activeTab === "city") {
      setFormCity({ name: "", codeSuffix: "", isActive: true });
    } else if (activeTab === "tehsil") {
      setFormTehsil({ name: "", codeSuffix: "", zipCode: "", isActive: true });
    }

    setIsAddEditModalOpen(true);
  }

  async function handleOpenEditModal(record: any, levelType?: TabType) {
    const targetType = levelType || activeTab;
    setModalMode("edit");
    setEditRecordId(record.id);
    setBanner(null);

    setModalCountryId(record.country_id || "");
    setModalStateId(record.state_province_id || "");
    setModalDistrictId(record.district_id || "");

    if (record.country_id) await loadModalStates(record.country_id);
    if (record.state_province_id) await loadModalDistricts(record.state_province_id);

    if (targetType === "country") {
      setFormCountry({
        name: record.name,
        iso2: record.iso2 || "",
        isActive: record.is_active
      });
    } else if (targetType === "state") {
      const c = countries.find((x) => x.id === record.country_id);
      const prefix = c ? `${c.iso2 || "XX"}-` : "";
      let codeSuff = record.code || "";
      if (prefix && codeSuff.startsWith(prefix)) codeSuff = codeSuff.substring(prefix.length);

      setFormState({
        name: record.name,
        codeSuffix: codeSuff,
        isActive: record.is_active
      });
    } else if (targetType === "city") {
      const c = countries.find((x) => x.id === record.country_id);
      const s = states.find((x) => x.id === record.state_province_id) || modalStates.find((x) => x.id === record.state_province_id);

      const cCode = c ? c.iso2 || "XX" : "XX";
      let sCode = s ? s.code || "XX" : "XX";
      if (sCode.startsWith(`${cCode}-`)) sCode = sCode.substring(cCode.length + 1);
      const prefix = `${cCode}-${sCode}-`;
      let codeSuff = record.code || "";
      if (codeSuff.startsWith(prefix)) codeSuff = codeSuff.substring(prefix.length);

      setFormCity({
        name: record.name,
        codeSuffix: codeSuff,
        isActive: record.is_active
      });
    } else if (targetType === "tehsil") {
      const c = countries.find((x) => x.id === record.country_id);
      const s = states.find((x) => x.id === record.state_province_id) || modalStates.find((x) => x.id === record.state_province_id);
      const d = districts.find((x) => x.id === record.district_id) || modalDistricts.find((x) => x.id === record.district_id);

      const cCode = c ? c.iso2 || "XX" : "XX";
      let sCode = s ? s.code || "XX" : "XX";
      if (sCode.startsWith(`${cCode}-`)) sCode = sCode.substring(cCode.length + 1);
      let dCode = d ? d.code || "XX" : "XX";
      const prefix2 = `${cCode}-${sCode}-`;
      if (dCode.startsWith(prefix2)) dCode = dCode.substring(prefix2.length);
      const prefix = `${cCode}-${sCode}-${dCode}-`;

      let codeSuff = record.code || "";
      if (codeSuff.startsWith(prefix)) codeSuff = codeSuff.substring(prefix.length);

      setFormTehsil({
        name: record.name,
        codeSuffix: codeSuff,
        zipCode: record.zip_code || "",
        isActive: record.is_active
      });
    }

    setIsAddEditModalOpen(true);
  }

  // Create / Edit submits
  async function handleSubmitForm() {
    setLoading((prev) => ({ ...prev, saving: true }));
    try {
      if (activeTab === "country") {
        if (!formCountry.name.trim() || !formCountry.iso2.trim()) {
          throw new Error("Country Name and Code are required");
        }
        const payload = {
          name: formCountry.name.trim(),
          iso2: formCountry.iso2.trim().toUpperCase()
        };

        if (modalMode === "add") {
          const res = await apiPost<{ country: CountryRow }>("/api/erp/locations/countries", payload);
          showBanner("success", `Country ${res.country.name} created successfully.`);
        } else {
          const res = await apiPatch<{ country: CountryRow }>(`/api/erp/locations/countries/${editRecordId}`, {
            ...payload,
            isActive: formCountry.isActive
          });
          showBanner("success", `Country ${res.country.name} updated successfully.`);
        }
      } else if (activeTab === "state") {
        if (!modalCountryId) throw new Error("Please select a Country first");
        if (!formState.name.trim() || !formState.codeSuffix.trim()) {
          throw new Error("State Name and Code Suffix are required");
        }
        const fullCode = `${modalStateCodePrefix}${formState.codeSuffix.trim().toUpperCase()}`;
        const payload = {
          countryId: modalCountryId,
          name: formState.name.trim(),
          code: fullCode
        };

        if (modalMode === "add") {
          const res = await apiPost<{ state: StateRow }>("/api/erp/locations/states", payload);
          showBanner("success", `State ${res.state.name} created successfully.`);
        } else {
          const res = await apiPatch<{ state: StateRow }>(`/api/erp/locations/states/${editRecordId}`, {
            name: formState.name.trim(),
            code: fullCode,
            isActive: formState.isActive
          });
          showBanner("success", `State ${res.state.name} updated successfully.`);
        }
      } else if (activeTab === "city") {
        if (!modalCountryId || !modalStateId) throw new Error("Country and State selections are required");
        if (!formCity.name.trim() || !formCity.codeSuffix.trim()) {
          throw new Error("City Name and Code Suffix are required");
        }
        const fullCode = `${modalDistrictCodePrefix}${formCity.codeSuffix.trim().toUpperCase()}`;
        const payload = {
          countryId: modalCountryId,
          stateProvinceId: modalStateId,
          name: formCity.name.trim(),
          code: fullCode
        };

        if (modalMode === "add") {
          const res = await apiPost<{ district: DistrictRow }>("/api/erp/locations/districts", payload);
          showBanner("success", `City ${res.district.name} created successfully.`);
        } else {
          const res = await apiPatch<{ district: DistrictRow }>(`/api/erp/locations/districts/${editRecordId}`, {
            name: formCity.name.trim(),
            code: fullCode,
            isActive: formCity.isActive
          });
          showBanner("success", `City ${res.district.name} updated successfully.`);
        }
      } else if (activeTab === "tehsil") {
        if (!modalCountryId || !modalStateId || !modalDistrictId) {
          throw new Error("Country, State, and City selections are required");
        }
        if (!formTehsil.name.trim() || !formTehsil.codeSuffix.trim()) {
          throw new Error("District/Tehsil Name and Code Suffix are required");
        }
        const fullCode = `${modalTehsilCodePrefix}${formTehsil.codeSuffix.trim().toUpperCase()}`;
        const payload = {
          countryId: modalCountryId,
          stateProvinceId: modalStateId,
          districtId: modalDistrictId,
          name: formTehsil.name.trim(),
          code: fullCode,
          zipCode: formTehsil.zipCode.trim() || null
        };

        if (modalMode === "add") {
          const res = await apiPost<{ city: CityRow }>("/api/erp/locations/cities", payload);
          showBanner("success", `District/Tehsil ${res.city.name} created successfully.`);
        } else {
          const res = await apiPatch<{ city: CityRow }>(`/api/erp/locations/cities/${editRecordId}`, {
            name: formTehsil.name.trim(),
            code: fullCode,
            zipCode: formTehsil.zipCode.trim() || null,
            isActive: formTehsil.isActive,
            districtId: modalDistrictId
          });
          showBanner("success", `District/Tehsil ${res.city.name} updated successfully.`);
        }
      }

      setIsAddEditModalOpen(false);

      // Auto-refresh summaries & parent counts after add/edit
      refreshAllData();
      if (selectedCountryId) loadStates(selectedCountryId);
      if (selectedStateId) loadDistricts(selectedStateId);
      if (selectedCountryId && selectedStateId && selectedDistrictId) {
        loadCities(selectedCountryId, selectedStateId, selectedDistrictId);
      }
    } catch (e: any) {
      showBanner("error", e.message || "Failed to save location record.");
    } finally {
      setLoading((prev) => ({ ...prev, saving: false }));
    }
  }

  // ── Bulk CSV Import (Country/State/City/Tehsil hierarchy) ──────────────────
  // Minimal RFC4180-ish CSV parser: handles quoted fields containing commas/quotes.
  function parseCsvText(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        field = "";
        if (row.some((c) => c.trim() !== "")) rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
    if (field !== "" || row.length > 0) {
      row.push(field);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
    }
    return rows;
  }

  function parseCsvToImportRows(text: string): ImportRow[] {
    const rows = parseCsvText(text);
    if (rows.length === 0) return [];
    const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ""));
    const colIndex = (...aliases: string[]) => aliases.map((a) => header.indexOf(a)).find((i) => i >= 0) ?? -1;
    const idx = {
      countryCode: colIndex("countrycode"),
      countryName: colIndex("countryname"),
      stateCode: colIndex("statecode"),
      stateName: colIndex("statename"),
      cityCode: colIndex("citycode"),
      cityName: colIndex("cityname"),
      tehsilCode: colIndex("tehsilcode", "districtcode"),
      tehsilName: colIndex("tehsilname", "districtname")
    };
    const dataRows = rows.slice(1);
    return dataRows
      .map((cols) => ({
        countryCode: (cols[idx.countryCode] || "").trim().toUpperCase(),
        countryName: (cols[idx.countryName] || "").trim(),
        stateCode: (cols[idx.stateCode] || "").trim().toUpperCase(),
        stateName: (cols[idx.stateName] || "").trim(),
        cityCode: (cols[idx.cityCode] || "").trim().toUpperCase(),
        cityName: (cols[idx.cityName] || "").trim(),
        tehsilCode: (cols[idx.tehsilCode] || "").trim().toUpperCase(),
        tehsilName: (cols[idx.tehsilName] || "").trim()
      }))
      .filter((r) => r.countryCode || r.countryName);
  }

  function handleCsvFile(file: File) {
    setImportLogs([]);
    file
      .text()
      .then((text) => {
        const rows = parseCsvToImportRows(text);
        setImportRows(rows);
        setImportLogs([`Parsed ${rows.length} row(s) from ${file.name}. Click "Execute Import" to continue.`]);
      })
      .catch((e: any) => {
        setImportRows([]);
        setImportLogs([`Failed to read file: ${e?.message || String(e)}`]);
      });
  }

  function handleCsvDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleCsvFile(file);
  }

  function handleCsvSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleCsvFile(file);
  }

  async function executeBulkImport() {
    if (importRows.length === 0) return;
    setImportProgress({ total: importRows.length, current: 0 });
    const logs: string[] = [];

    // Caches keyed by code so repeated codes across rows only hit the API once.
    // Plain objects (not the built-in Map) — `Map` is shadowed in this file by the
    // lucide-react `Map` icon imported above.
    const countryCache: Record<string, string> = {}; // iso2 -> id
    const stateCache: Record<string, string> = {}; // `${countryId}:${code}` -> id
    const districtCache: Record<string, string> = {}; // `${stateId}:${code}` -> id
    const cityCache: Record<string, string> = {}; // `${districtId}:${code}` -> id

    async function findOrCreateCountry(code: string, name: string): Promise<string | null> {
      if (!code) return null;
      const cached = countryCache[code];
      if (cached) return cached;
      const existing = await apiGet<{ countries: CountryRow[] }>("/api/erp/locations/countries");
      const match = existing.countries.find((c) => (c.iso2 || "").toUpperCase() === code);
      if (match) { countryCache[code] = match.id; return match.id; }
      const res = await apiPost<{ country: CountryRow }>("/api/erp/locations/countries", { name: name || code, iso2: code });
      countryCache[code] = res.country.id;
      return res.country.id;
    }

    async function findOrCreateState(countryId: string, code: string, name: string): Promise<string | null> {
      if (!code) return null;
      const key = `${countryId}:${code}`;
      const cached = stateCache[key];
      if (cached) return cached;
      const existing = await apiGet<{ states: StateRow[] }>(`/api/erp/locations/states?countryId=${countryId}`);
      const match = existing.states.find((s) => (s.code || "").toUpperCase() === code);
      if (match) { stateCache[key] = match.id; return match.id; }
      const res = await apiPost<{ state: StateRow }>("/api/erp/locations/states", { countryId, name: name || code, code });
      stateCache[key] = res.state.id;
      return res.state.id;
    }

    async function findOrCreateDistrict(countryId: string, stateId: string, code: string, name: string): Promise<string | null> {
      if (!code) return null;
      const key = `${stateId}:${code}`;
      const cached = districtCache[key];
      if (cached) return cached;
      const existing = await apiGet<{ districts: DistrictRow[] }>(`/api/erp/locations/districts?stateProvinceId=${stateId}`);
      const match = existing.districts.find((d) => (d.code || "").toUpperCase() === code);
      if (match) { districtCache[key] = match.id; return match.id; }
      const res = await apiPost<{ district: DistrictRow }>("/api/erp/locations/districts", { countryId, stateProvinceId: stateId, name: name || code, code });
      districtCache[key] = res.district.id;
      return res.district.id;
    }

    async function findOrCreateCity(countryId: string, stateId: string, districtId: string, code: string, name: string): Promise<string | null> {
      if (!code) return null;
      const key = `${districtId}:${code}`;
      const cached = cityCache[key];
      if (cached) return cached;
      const existing = await apiGet<{ cities: CityRow[] }>(
        `/api/erp/locations/cities?countryId=${countryId}&stateProvinceId=${stateId}&districtId=${districtId}`
      );
      const match = existing.cities.find((c) => (c.code || "").toUpperCase() === code);
      if (match) { cityCache[key] = match.id; return match.id; }
      const res = await apiPost<{ city: CityRow }>("/api/erp/locations/cities", { countryId, stateProvinceId: stateId, districtId, name: name || code, code });
      cityCache[key] = res.city.id;
      return res.city.id;
    }

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < importRows.length; i++) {
      const row = importRows[i];
      try {
        const countryId = await findOrCreateCountry(row.countryCode, row.countryName);
        if (!countryId) throw new Error("Country Code is required");
        const stateId = row.stateCode ? await findOrCreateState(countryId, row.stateCode, row.stateName) : null;
        const districtId = stateId && row.cityCode ? await findOrCreateDistrict(countryId, stateId, row.cityCode, row.cityName) : null;
        if (districtId && stateId && row.tehsilCode) {
          await findOrCreateCity(countryId, stateId, districtId, row.tehsilCode, row.tehsilName);
        }
        successCount++;
        logs.push(`Row ${i + 1}: OK — ${row.countryCode}${row.stateCode ? "/" + row.stateCode : ""}${row.cityCode ? "/" + row.cityCode : ""}${row.tehsilCode ? "/" + row.tehsilCode : ""}`);
      } catch (e: any) {
        errorCount++;
        logs.push(`Row ${i + 1}: FAILED — ${e?.message || String(e)}`);
      }
      setImportProgress({ total: importRows.length, current: i + 1 });
      setImportLogs([...logs]);
    }

    logs.push(`Import complete: ${successCount} succeeded, ${errorCount} failed.`);
    setImportLogs([...logs]);
    setImportProgress(null);
    setImportRows([]);
    showBanner(errorCount === 0 ? "success" : "info", `Bulk import finished: ${successCount} succeeded, ${errorCount} failed.`);
    refreshAllData();
  }

  // Deletions
  function triggerDelete(id: string, name: string, type: TabType) {
    setDeleteConfirmTarget({ id, name, type });
  }

  async function confirmDelete() {
    if (!deleteConfirmTarget) return;
    setLoading((prev) => ({ ...prev, deleting: true }));
    const { id, name, type } = deleteConfirmTarget;

    try {
      if (type === "country") {
        await apiDelete(`/api/erp/locations/countries/${id}`);
      } else if (type === "state") {
        await apiDelete(`/api/erp/locations/states/${id}`);
      } else if (type === "city") {
        await apiDelete(`/api/erp/locations/districts/${id}`);
      } else if (type === "tehsil") {
        await apiDelete(`/api/erp/locations/cities/${id}`);
      }
      showBanner("success", `${name} deleted successfully.`);
      setDeleteConfirmTarget(null);

      // Auto-refresh summary counts and lists
      refreshAllData();
      if (selectedCountryId) loadStates(selectedCountryId);
      if (selectedStateId) loadDistricts(selectedStateId);
      if (selectedCountryId && selectedStateId && selectedDistrictId) {
        loadCities(selectedCountryId, selectedStateId, selectedDistrictId);
      }
    } catch (e: any) {
      showBanner("error", e.message || `Failed to delete ${name}`);
    } finally {
      setLoading((prev) => ({ ...prev, deleting: false }));
    }
  }

  // CSV Export & Full Tree Export
  function handleExportCsv() {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = "";

    if (activeTab === "country") {
      filename = "Country_Summary_Export.csv";
      headers = ["Country Code", "Country Name", "Total States", "Total Cities", "Total Districts/Tehsils", "Status"];
      rows = filteredCountries.map((c) => [
        c.iso2 || "",
        c.name,
        String(c.total_states || 0),
        String(c.total_cities || 0),
        String(c.total_districts || 0),
        c.is_active ? "Active" : "Inactive"
      ]);
    } else if (activeTab === "state") {
      filename = "State_Summary_Export.csv";
      const c = countries.find((x) => x.id === selectedCountryId);
      headers = ["Country Name", "State Code", "State Name", "Total Cities", "Total Districts/Tehsils", "Status"];
      rows = filteredStates.map((s) => [
        c?.name || "",
        s.code || "",
        s.name,
        String(s.total_cities || 0),
        String(s.total_districts || 0),
        s.is_active ? "Active" : "Inactive"
      ]);
    } else if (activeTab === "city") {
      filename = "City_Summary_Export.csv";
      const c = countries.find((x) => x.id === selectedCountryId);
      const s = states.find((x) => x.id === selectedStateId);
      headers = ["Country Name", "State Name", "City Code", "City Name", "Total Districts/Tehsils", "Status"];
      rows = filteredDistricts.map((d) => [
        c?.name || "",
        s?.name || "",
        d.code || "",
        d.name,
        String(d.total_districts || 0),
        d.is_active ? "Active" : "Inactive"
      ]);
    } else if (activeTab === "tehsil") {
      filename = "Tehsil_Master_Export.csv";
      const c = countries.find((x) => x.id === selectedCountryId);
      const s = states.find((x) => x.id === selectedStateId);
      const d = districts.find((x) => x.id === selectedDistrictId);
      headers = ["Country Name", "State Name", "City Name", "District/Tehsil Code", "District/Tehsil Name", "Zip Code", "Status"];
      rows = filteredCities.map((ct) => [
        c?.name || "",
        s?.name || "",
        d?.name || "",
        ct.code || "",
        ct.name,
        ct.zip_code || "",
        ct.is_active ? "Active" : "Inactive"
      ]);
    }

    downloadCSV(filename, headers, rows);
  }

  function downloadCSV(filename: string, headers: string[], rows: string[][]) {
    const content = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
      ...rows.map((row) => row.map((cell) => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function openFullTreeModal() {
    setIsFullTreeModalOpen(true);
    loadFullTree();
  }

  function expandAllNodes() {
    const allIds = new Set<string>();
    function collect(nodes: LocationTreeNode[]) {
      nodes.forEach((n) => {
        allIds.add(n.id);
        if (n.children && n.children.length > 0) collect(n.children);
      });
    }
    collect(fullTreeData);
    setExpandedNodeIds(allIds);
  }

  function collapseAllNodes() {
    setExpandedNodeIds(new Set());
  }

  function toggleNodeExpand(id: string) {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportFullTreeCsv() {
    const headers = ["Level Type", "Country", "State", "City", "District/Tehsil", "Code", "Status"];
    const rows: string[][] = [];

    fullTreeData.forEach((c) => {
      rows.push(["Country", c.name, "", "", "", c.code, c.isActive ? "Active" : "Inactive"]);
      (c.children || []).forEach((s) => {
        rows.push(["State", c.name, s.name, "", "", s.code, s.isActive ? "Active" : "Inactive"]);
        (s.children || []).forEach((d) => {
          rows.push(["City", c.name, s.name, d.name, "", d.code, d.isActive ? "Active" : "Inactive"]);
          (d.children || []).forEach((ct) => {
            rows.push(["District/Tehsil", c.name, s.name, d.name, ct.name, ct.code, ct.isActive ? "Active" : "Inactive"]);
          });
        });
      });
    });

    downloadCSV("Complete_Location_Hierarchy_Tree.csv", headers, rows);
  }

  function handlePrintTree() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">ERP Location Settings</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Location Management Workspace</h1>
          <p className="text-sm text-muted-foreground">
            Multi-level location hierarchy &amp; summary drill-down: Country &rarr; State &rarr; City &rarr; District/Tehsil.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={openFullTreeModal}
            className="bg-[#0F172A] hover:bg-slate-800 text-white dark:bg-sky-600 dark:hover:bg-sky-700 gap-2 font-semibold shadow-sm"
          >
            <FolderTree className="h-4 w-4" />
            View Complete Location List
          </Button>

          <div className="hidden sm:flex items-center gap-2 rounded-full border bg-muted/40 px-4 py-2 text-xs font-semibold text-muted-foreground shadow-sm">
            <Workflow className="h-4 w-4 text-primary" />
            <span>Hierarchy Summary Active</span>
          </div>
        </div>
      </div>

      {banner ? (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium shadow-sm transition-all animate-in fade-in slide-in-from-top-2",
            banner.type === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
            banner.type === "error" && "border-rose-200 bg-rose-50 text-rose-800",
            banner.type === "info" && "border-sky-200 bg-sky-50 text-sky-800"
          )}
        >
          {banner.type === "error" ? <AlertTriangle className="h-4 w-4 text-rose-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          <span>{banner.message}</span>
        </div>
      ) : null}

      {/* Statistics Cards Summary - Interactive Clickable Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card 
          onClick={() => { setActiveTab("country"); setSearchQuery(""); setBanner(null); }}
          className={cn(
            "border-l-4 border-l-sky-500 shadow-sm bg-gradient-to-br from-white to-sky-50/30 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]",
            activeTab === "country" && "ring-2 ring-sky-500/40"
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Countries</p>
              <p className="text-2xl font-bold text-sky-950 mt-1">{Number(stats.totalCountries || 0).toLocaleString()}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
              <Globe2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => { setActiveTab("state"); setSearchQuery(""); setBanner(null); }}
          className={cn(
            "border-l-4 border-l-indigo-500 shadow-sm bg-gradient-to-br from-white to-indigo-50/30 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]",
            activeTab === "state" && "ring-2 ring-indigo-500/40"
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">States / Provinces</p>
              <p className="text-2xl font-bold text-indigo-950 mt-1">{Number(stats.totalStates || 0).toLocaleString()}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <Map className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => { setActiveTab("city"); setSearchQuery(""); setBanner(null); }}
          className={cn(
            "border-l-4 border-l-teal-500 shadow-sm bg-gradient-to-br from-white to-teal-50/30 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]",
            activeTab === "city" && "ring-2 ring-teal-500/40"
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cities / Districts</p>
              <p className="text-2xl font-bold text-teal-950 mt-1">{Number(stats.totalCities || 0).toLocaleString()}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => { setActiveTab("tehsil"); setSearchQuery(""); setBanner(null); }}
          className={cn(
            "border-l-4 border-l-amber-500 shadow-sm bg-gradient-to-br from-white to-amber-50/30 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]",
            activeTab === "tehsil" && "ring-2 ring-amber-500/40"
          )}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Districts / Tehsils</p>
              <p className="text-2xl font-bold text-amber-950 mt-1">{Number(stats.totalDistricts || 0).toLocaleString()}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <MapPin className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drill-down Breadcrumbs Trail */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-3 text-xs font-medium text-muted-foreground shadow-sm">
        <span className="font-semibold text-foreground flex items-center gap-1">
          <Layers className="h-3.5 w-3.5 text-primary" />
          Location Drill-Down:
        </span>
        <button
          onClick={resetDrillToCountry}
          className={cn("hover:text-primary transition-colors", activeTab === "country" && "font-bold text-primary underline")}
        >
          Country List
        </button>

        {drillPath.countryName && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <button
              onClick={() => {
                setActiveTab("state");
                setSearchQuery("");
                if (drillPath.countryId) loadStates(drillPath.countryId);
              }}
              className={cn("hover:text-primary transition-colors", activeTab === "state" && "font-bold text-primary underline")}
            >
              {drillPath.countryName}
            </button>
          </>
        )}

        {drillPath.stateName && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <button
              onClick={() => {
                setActiveTab("city");
                setSearchQuery("");
                if (drillPath.stateId) loadDistricts(drillPath.stateId);
              }}
              className={cn("hover:text-primary transition-colors", activeTab === "city" && "font-bold text-primary underline")}
            >
              {drillPath.stateName}
            </button>
          </>
        )}

        {drillPath.cityName && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span className={cn(activeTab === "tehsil" && "font-bold text-primary underline")}>
              {drillPath.cityName} (Tehsils)
            </span>
          </>
        )}
      </div>

      {/* Tabs navigation & Controls */}
      <div className="flex flex-col gap-5">
        <div className="flex border-b overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab("country");
              setSearchQuery("");
              setBanner(null);
            }}
            className={cn(
              "px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
              activeTab === "country" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            1. Country Summary
          </button>
          <button
            onClick={() => {
              setActiveTab("state");
              setSearchQuery("");
              setBanner(null);
            }}
            className={cn(
              "px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
              activeTab === "state" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            2. State Summary
          </button>
          <button
            onClick={() => {
              setActiveTab("city");
              setSearchQuery("");
              setBanner(null);
            }}
            className={cn(
              "px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
              activeTab === "city" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            3. City Summary
          </button>
          <button
            onClick={() => {
              setActiveTab("tehsil");
              setSearchQuery("");
              setBanner(null);
            }}
            className={cn(
              "px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
              activeTab === "tehsil" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            4. Tehsil / District List
          </button>
        </div>

        {/* Filter scopes card */}
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {activeTab !== "country" && (
                  <div className="w-56">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Country Scope</Label>
                    <SearchSelect
                      label=""
                      value={selectedCountryId}
                      options={countryOptions}
                      placeholder="Select Country"
                      onValueChange={(val) => {
                        setSelectedCountryId(val);
                        const found = countries.find((c) => c.id === val);
                        setDrillPath({ countryId: val, countryName: found?.name });
                      }}
                      className="mt-1"
                    />
                  </div>
                )}

                {(activeTab === "city" || activeTab === "tehsil") && (
                  <div className="w-56">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">State Scope</Label>
                    <SearchSelect
                      label=""
                      value={selectedStateId}
                      options={stateOptions}
                      placeholder={selectedCountryId ? "Select State" : "Select Country First"}
                      disabled={!selectedCountryId}
                      onValueChange={(val) => {
                        setSelectedStateId(val);
                        const found = states.find((s) => s.id === val);
                        setDrillPath((prev) => ({ ...prev, stateId: val, stateName: found?.name }));
                      }}
                      className="mt-1"
                    />
                  </div>
                )}

                {activeTab === "tehsil" && (
                  <div className="w-56">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">City Scope</Label>
                    <SearchSelect
                      label=""
                      value={selectedDistrictId}
                      options={districtOptions}
                      placeholder={selectedStateId ? "Select City" : "Select State First"}
                      disabled={!selectedStateId}
                      onValueChange={(val) => {
                        setSelectedDistrictId(val);
                        const found = districts.find((d) => d.id === val);
                        setDrillPath((prev) => ({ ...prev, cityId: val, cityName: found?.name }));
                      }}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsImportModalOpen(true)}
                  className="gap-1.5 font-semibold text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs"
                >
                  <Upload className="h-4 w-4" /> Import Excel/CSV
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleExportCsv}
                  className="gap-1.5 font-semibold text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs"
                >
                  <Download className="h-4 w-4" /> Export CSV
                </Button>
                <Button 
                  type="button" 
                  size="sm" 
                  onClick={handleOpenAddModal}
                  className="bg-[#0F172A] hover:bg-slate-800 text-white dark:bg-sky-600 dark:hover:bg-sky-700 gap-1.5 font-bold shadow-sm"
                >
                  <Plus className="h-4 w-4" /> + Add New Location
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder={`Search listings by code or name...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">Status: All Records</option>
                  <option value="active">Status: Active Only</option>
                  <option value="inactive">Status: Inactive Only</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab Content Tables */}
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            {/* 1. Country Summary Table */}
            {activeTab === "country" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                      <Th className="px-4 py-3">Country Code</Th>
                      <Th className="px-4 py-3">Country Name</Th>
                      <Th className="px-4 py-3 text-center">Total States</Th>
                      <Th className="px-4 py-3 text-center">Total Cities</Th>
                      <Th className="px-4 py-3 text-center">Total Districts / Tehsils</Th>
                      <Th className="px-4 py-3">Status</Th>
                      <Th className="px-4 py-3 text-center">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCountries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-muted-foreground">
                          {loading.countries ? (
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading Country Summaries...
                            </div>
                          ) : (
                            "No Country records found."
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredCountries.map((c) => (
                        <tr key={c.id} className="border-b hover:bg-muted/10">
                          <td className="px-4 py-3 font-mono font-bold text-sky-700">{c.iso2 || "-"}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{c.name}</td>
                          <td className="px-4 py-3 text-center font-semibold text-indigo-700">
                            <span className="rounded-md bg-indigo-50 px-2 py-1 border border-indigo-100">{c.total_states}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-teal-700">
                            <span className="rounded-md bg-teal-50 px-2 py-1 border border-teal-100">{c.total_cities}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-amber-700">
                            <span className="rounded-md bg-amber-50 px-2 py-1 border border-amber-100">{c.total_districts}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                c.is_active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                              )}
                            >
                              {c.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleDrillToState(c)}
                                className="bg-sky-600 hover:bg-sky-700 text-white h-8 text-xs font-medium gap-1"
                              >
                                <Eye className="h-3.5 w-3.5" /> View Details / Hierarchy
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(c, "country")} className="h-8">
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. State Summary Table */}
            {activeTab === "state" && (
              <div className="overflow-x-auto">
                <div className="mb-4 flex items-center justify-between rounded-lg bg-indigo-50/50 p-3 border border-indigo-100">
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-900">
                    <Globe2 className="h-4 w-4 text-indigo-600" />
                    <span>
                      Active Country:{" "}
                      <span className="font-bold text-indigo-700">{drillPath.countryName || "Selected Country"}</span>
                    </span>
                  </div>
                  <span className="text-xs text-indigo-600 font-medium">Total States: {filteredStates.length}</span>
                </div>

                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                      <Th className="px-4 py-3">State Code</Th>
                      <Th className="px-4 py-3">State Name</Th>
                      <Th className="px-4 py-3 text-center">Total Cities</Th>
                      <Th className="px-4 py-3 text-center">Total Districts / Tehsils</Th>
                      <Th className="px-4 py-3">Status</Th>
                      <Th className="px-4 py-3 text-center">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedCountryId ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          Please select a Country from the scope dropdown above to view states.
                        </td>
                      </tr>
                    ) : filteredStates.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          {loading.states ? (
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading State Summaries...
                            </div>
                          ) : (
                            "No State records found for the selected country."
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredStates.map((s) => (
                        <tr key={s.id} className="border-b hover:bg-muted/10">
                          <td className="px-4 py-3 font-mono font-bold text-indigo-700">{s.code || "-"}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{s.name}</td>
                          <td className="px-4 py-3 text-center font-semibold text-teal-700">
                            <span className="rounded-md bg-teal-50 px-2.5 py-1 border border-teal-100">{s.total_cities}</span>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-amber-700">
                            <span className="rounded-md bg-amber-50 px-2.5 py-1 border border-amber-100">{s.total_districts}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                s.is_active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                              )}
                            >
                              {s.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleDrillToCity(s)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white h-8 text-xs font-medium gap-1"
                              >
                                <Eye className="h-3.5 w-3.5" /> View Cities
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(s, "state")} className="h-8">
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. City Summary Table */}
            {activeTab === "city" && (
              <div className="overflow-x-auto">
                <div className="mb-4 flex items-center justify-between rounded-lg bg-teal-50/50 p-3 border border-teal-100">
                  <div className="flex items-center gap-2 text-xs font-semibold text-teal-900">
                    <Map className="h-4 w-4 text-teal-600" />
                    <span>
                      Active State: <span className="font-bold text-teal-700">{drillPath.stateName || "Selected State"}</span>
                    </span>
                  </div>
                  <span className="text-xs text-teal-600 font-medium">Total Cities: {filteredDistricts.length}</span>
                </div>

                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                      <Th className="px-4 py-3">City Code</Th>
                      <Th className="px-4 py-3">City Name</Th>
                      <Th className="px-4 py-3 text-center">Total Districts / Tehsils</Th>
                      <Th className="px-4 py-3">Status</Th>
                      <Th className="px-4 py-3 text-center">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedStateId ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          Please select a State from the scope dropdown above to view cities.
                        </td>
                      </tr>
                    ) : filteredDistricts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          {loading.districts ? (
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading City Summaries...
                            </div>
                          ) : (
                            "No City records found for the selected state."
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredDistricts.map((d) => (
                        <tr key={d.id} className="border-b hover:bg-muted/10">
                          <td className="px-4 py-3 font-mono font-bold text-teal-700">{d.code || "-"}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{d.name}</td>
                          <td className="px-4 py-3 text-center font-semibold text-amber-700">
                            <span className="rounded-md bg-amber-50 px-2.5 py-1 border border-amber-100">{d.total_districts}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                d.is_active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                              )}
                            >
                              {d.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleDrillToTehsil(d)}
                                className="bg-teal-600 hover:bg-teal-700 text-white h-8 text-xs font-medium gap-1"
                              >
                                <Eye className="h-3.5 w-3.5" /> View Districts
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(d, "city")} className="h-8">
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 4. District / Tehsil List Table */}
            {activeTab === "tehsil" && (
              <div className="overflow-x-auto">
                <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-50/50 p-3 border border-amber-100">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                    <Building2 className="h-4 w-4 text-amber-600" />
                    <span>
                      Active City: <span className="font-bold text-amber-700">{drillPath.cityName || "Selected City"}</span>
                    </span>
                  </div>
                  <span className="text-xs text-amber-600 font-medium">Total Tehsils: {filteredCities.length}</span>
                </div>

                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                      <Th className="px-4 py-3">District / Tehsil Code</Th>
                      <Th className="px-4 py-3">District / Tehsil Name</Th>
                      <Th className="px-4 py-3">ZIP Code</Th>
                      <Th className="px-4 py-3">Status</Th>
                      <Th className="px-4 py-3 text-center">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedDistrictId ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          Please select a City from the scope dropdown above to view districts/tehsils.
                        </td>
                      </tr>
                    ) : filteredCities.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          {loading.cities ? (
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading Tehsils...
                            </div>
                          ) : (
                            "No District/Tehsil records found for the selected city."
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredCities.map((ct) => (
                        <tr key={ct.id} className="border-b hover:bg-muted/10">
                          <td className="px-4 py-3 font-mono font-bold text-amber-700">{ct.code || "-"}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{ct.name}</td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">{ct.zip_code || "-"}</td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                                ct.is_active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                              )}
                            >
                              {ct.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(ct, "tehsil")}>
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-rose-600 hover:bg-rose-50"
                                onClick={() => triggerDelete(ct.id, ct.name, "tehsil")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Modal */}
      {isAddEditModalOpen && (
        <SimpleModal
          title={`${modalMode === "add" ? "Add New" : "Edit"} ${
            activeTab === "country"
              ? "Country"
              : activeTab === "state"
              ? "State / Province"
              : activeTab === "city"
              ? "City"
              : "District / Tehsil"
          }`}
          onClose={() => setIsAddEditModalOpen(false)}
          className="max-w-lg"
        >
          <div className="space-y-4 pt-2">
            {/* Country Form */}
            {activeTab === "country" && (
              <>
                <div className="space-y-1.5">
                  <Label>Country Name *</Label>
                  <Input
                    placeholder="e.g. Pakistan"
                    value={formCountry.name}
                    onChange={(e) => setFormCountry((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Country Code (ISO2) *</Label>
                  <Input
                    placeholder="e.g. PK"
                    maxLength={2}
                    value={formCountry.iso2}
                    onChange={(e) => setFormCountry((prev) => ({ ...prev, iso2: e.target.value.toUpperCase() }))}
                  />
                </div>
                {modalMode === "edit" && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="countryActive"
                      checked={formCountry.isActive}
                      onChange={(e) => setFormCountry((prev) => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded border-slate-300"
                    />
                    <Label htmlFor="countryActive" className="text-xs font-semibold cursor-pointer">
                      Active Status
                    </Label>
                  </div>
                )}
              </>
            )}

            {/* State Form */}
            {activeTab === "state" && (
              <>
                <div className="space-y-1.5">
                  <Label>Parent Country *</Label>
                  <SearchSelect
                    label=""
                    value={modalCountryId}
                    options={countryOptions}
                    placeholder="Select Country"
                    onValueChange={setModalCountryId}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>State / Province Name *</Label>
                  <Input
                    placeholder="e.g. Balochistan"
                    value={formState.name}
                    onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>State Code Suffix *</Label>
                  <div className="flex items-center gap-1">
                    <span className="rounded-md border bg-muted px-3 py-2 font-mono text-xs font-bold">{modalStateCodePrefix || "XX-"}</span>
                    <Input
                      placeholder="e.g. BA"
                      value={formState.codeSuffix}
                      onChange={(e) => setFormState((prev) => ({ ...prev, codeSuffix: e.target.value.toUpperCase() }))}
                    />
                  </div>
                </div>
                {modalMode === "edit" && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="stateActive"
                      checked={formState.isActive}
                      onChange={(e) => setFormState((prev) => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded border-slate-300"
                    />
                    <Label htmlFor="stateActive" className="text-xs font-semibold cursor-pointer">
                      Active Status
                    </Label>
                  </div>
                )}
              </>
            )}

            {/* City Form */}
            {activeTab === "city" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Parent Country *</Label>
                    <SearchSelect
                      label=""
                      value={modalCountryId}
                      options={countryOptions}
                      placeholder="Select Country"
                      onValueChange={setModalCountryId}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Parent State *</Label>
                    <SearchSelect
                      label=""
                      value={modalStateId}
                      options={modalStates.map((s) => ({ value: s.id, label: s.name, keywords: s.name }))}
                      placeholder="Select State"
                      disabled={!modalCountryId}
                      onValueChange={setModalStateId}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>City Name *</Label>
                  <Input
                    placeholder="e.g. Quetta"
                    value={formCity.name}
                    onChange={(e) => setFormCity((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>City Code Suffix *</Label>
                  <div className="flex items-center gap-1">
                    <span className="rounded-md border bg-muted px-3 py-2 font-mono text-xs font-bold">{modalDistrictCodePrefix || "XX-XX-"}</span>
                    <Input
                      placeholder="e.g. QUE"
                      value={formCity.codeSuffix}
                      onChange={(e) => setFormCity((prev) => ({ ...prev, codeSuffix: e.target.value.toUpperCase() }))}
                    />
                  </div>
                </div>
                {modalMode === "edit" && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="cityActive"
                      checked={formCity.isActive}
                      onChange={(e) => setFormCity((prev) => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded border-slate-300"
                    />
                    <Label htmlFor="cityActive" className="text-xs font-semibold cursor-pointer">
                      Active Status
                    </Label>
                  </div>
                )}
              </>
            )}

            {/* Tehsil / District Form */}
            {activeTab === "tehsil" && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Country *</Label>
                    <SearchSelect
                      label=""
                      value={modalCountryId}
                      options={countryOptions}
                      placeholder="Select Country"
                      onValueChange={setModalCountryId}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>State *</Label>
                    <SearchSelect
                      label=""
                      value={modalStateId}
                      options={modalStates.map((s) => ({ value: s.id, label: s.name, keywords: s.name }))}
                      placeholder="Select State"
                      disabled={!modalCountryId}
                      onValueChange={setModalStateId}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>City *</Label>
                    <SearchSelect
                      label=""
                      value={modalDistrictId}
                      options={modalDistricts.map((d) => ({ value: d.id, label: d.name, keywords: d.name }))}
                      placeholder="Select City"
                      disabled={!modalStateId}
                      onValueChange={setModalDistrictId}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>District / Tehsil Name *</Label>
                  <Input
                    placeholder="e.g. Quetta District"
                    value={formTehsil.name}
                    onChange={(e) => setFormTehsil((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Code Suffix *</Label>
                    <div className="flex items-center gap-1">
                      <span className="rounded-md border bg-muted px-2 py-2 font-mono text-[11px] font-bold">{modalTehsilCodePrefix || "XX-XX-XX-"}</span>
                      <Input
                        placeholder="e.g. QD"
                        value={formTehsil.codeSuffix}
                        onChange={(e) => setFormTehsil((prev) => ({ ...prev, codeSuffix: e.target.value.toUpperCase() }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>ZIP / Postal Code</Label>
                    <Input
                      placeholder="e.g. 87300"
                      value={formTehsil.zipCode}
                      onChange={(e) => setFormTehsil((prev) => ({ ...prev, zipCode: e.target.value }))}
                    />
                  </div>
                </div>
                {modalMode === "edit" && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="tehsilActive"
                      checked={formTehsil.isActive}
                      onChange={(e) => setFormTehsil((prev) => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded border-slate-300"
                    />
                    <Label htmlFor="tehsilActive" className="text-xs font-semibold cursor-pointer">
                      Active Status
                    </Label>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsAddEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSubmitForm} disabled={loading.saving}>
                {loading.saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                {modalMode === "add" ? "Save Record" : "Update Record"}
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <SimpleModal title="Confirm Delete" onClose={() => setDeleteConfirmTarget(null)} className="max-w-md">
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-xs font-medium">
                Are you sure you want to delete <span className="font-bold">{deleteConfirmTarget.name}</span>? Child location records will also be soft-deleted.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setDeleteConfirmTarget(null)} disabled={loading.deleting}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={confirmDelete} disabled={loading.deleting}>
                {loading.deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
                Delete Record
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}

      {/* Requirement 7: View Complete Location List (Full Tree Modal) */}
      {isFullTreeModalOpen && (
        <SimpleModal
          title="Complete Location Hierarchy Directory"
          onClose={() => setIsFullTreeModalOpen(false)}
          className="max-w-5xl"
        >
          <div className="space-y-4 pt-1">
            {/* Tree Controls Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-slate-50 p-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9 bg-white text-xs h-9"
                  placeholder="Filter tree by country, state, city, or tehsil..."
                  value={treeSearchQuery}
                  onChange={(e) => setTreeSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={expandAllNodes} className="h-8 text-xs gap-1">
                  <Maximize2 className="h-3.5 w-3.5" /> Expand All
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={collapseAllNodes} className="h-8 text-xs gap-1">
                  <Minimize2 className="h-3.5 w-3.5" /> Collapse All
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={exportFullTreeCsv} className="h-8 text-xs gap-1">
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handlePrintTree} className="h-8 text-xs gap-1">
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
              </div>
            </div>

            {/* Tree Container */}
            <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-white p-4">
              {loading.tree ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading Location Hierarchy Tree...
                </div>
              ) : fullTreeData.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No location hierarchy records found in database.
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  {fullTreeData.map((country) => (
                    <LocationTreeNodeView
                      key={country.id}
                      node={country}
                      searchQuery={treeSearchQuery}
                      expandedIds={expandedNodeIds}
                      onToggle={toggleNodeExpand}
                      onEdit={handleOpenEditModal}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setIsFullTreeModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </SimpleModal>
      )}

      {/* Bulk Import Modal */}
      {isImportModalOpen && (
        <SimpleModal title="Bulk Import Locations (CSV)" onClose={() => setIsImportModalOpen(false)} className="max-w-lg">
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Upload a CSV file with: Country, State, City, Tehsil codes &amp; names.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const sampleHeaders = ["Country Code", "Country Name", "State Code", "State Name", "City Code", "City Name", "Tehsil Code", "Tehsil Name"];
                  const sampleRow = ["PK", "Pakistan", "SD", "Sindh", "KHI", "Karachi", "KSD", "Karachi South"];
                  downloadCSV("sample_location_import_template.csv", sampleHeaders, [sampleRow]);
                }}
                className="text-xs text-sky-700 hover:text-sky-800 font-semibold p-0 h-auto underline"
              >
                Download Sample Template
              </Button>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleCsvDrop}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 dark:bg-slate-900/50 p-6 text-center transition-all hover:bg-slate-100/80"
            >
              <Upload className="h-9 w-9 text-slate-400 mb-2" />
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Drag &amp; Drop your CSV file here</p>
              <p className="text-[11px] text-slate-500 mt-0.5">or click to browse your computer</p>
              <label 
                htmlFor="bulk-csv-upload-input" 
                className="mt-3 cursor-pointer inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Choose CSV File
              </label>
              <input id="bulk-csv-upload-input" type="file" accept=".csv" onChange={handleCsvSelect} className="hidden" />
            </div>

            {importLogs.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-md bg-slate-900 p-3 font-mono text-xs text-emerald-400 space-y-1">
                {importLogs.map((log, index) => (
                  <div key={index}>&gt; {log}</div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-muted-foreground font-medium">
                {importRows.length > 0 ? `${importRows.length} row(s) ready to import` : "No file loaded"}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsImportModalOpen(false)}>
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={executeBulkImport}
                  disabled={importRows.length === 0 || importProgress !== null}
                  className="bg-[#0F172A] hover:bg-slate-800 text-white dark:bg-sky-600 dark:hover:bg-sky-700 font-bold shadow-sm disabled:opacity-50"
                >
                  {importProgress ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
                  {importProgress ? "Importing Locations..." : `Import Locations (${importRows.length} Rows)`}
                </Button>
              </div>
            </div>
          </div>
        </SimpleModal>
      )}
    </div>
  );
}

// Tree Node Recursive Component for Requirement 7
function LocationTreeNodeView({
  node,
  searchQuery,
  expandedIds,
  onToggle,
  onEdit
}: {
  node: LocationTreeNode;
  searchQuery: string;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (record: any, type: TabType) => void;
}) {
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children && node.children.length > 0;

  const matchesSelf =
    !searchQuery ||
    node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.code.toLowerCase().includes(searchQuery.toLowerCase());

  const matchesChild = useMemo(() => {
    if (!searchQuery || !node.children) return false;
    function check(children: LocationTreeNode[]): boolean {
      return children.some(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (c.children && check(c.children))
      );
    }
    return check(node.children);
  }, [searchQuery, node.children]);

  if (!matchesSelf && !matchesChild) return null;

  const typeBg =
    node.type === "country"
      ? "bg-sky-50 text-sky-800 border-sky-200"
      : node.type === "state"
      ? "bg-indigo-50 text-indigo-800 border-indigo-200"
      : node.type === "city"
      ? "bg-teal-50 text-teal-800 border-teal-200"
      : "bg-amber-50 text-amber-800 border-amber-200";

  const typeIcon =
    node.type === "country" ? (
      <Globe2 className="h-4 w-4 text-sky-600" />
    ) : node.type === "state" ? (
      <Map className="h-4 w-4 text-indigo-600" />
    ) : node.type === "city" ? (
      <Building2 className="h-4 w-4 text-teal-600" />
    ) : (
      <MapPin className="h-4 w-4 text-amber-600" />
    );

  const tabTypeMap: Record<string, TabType> = {
    country: "country",
    state: "state",
    city: "city",
    district: "tehsil"
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between rounded-md border p-2 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <button onClick={() => onToggle(node.id)} className="p-0.5 text-slate-500 hover:text-slate-900">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-5" />
          )}

          <div className="flex items-center gap-2">
            {typeIcon}
            <span className="font-semibold text-slate-800">{node.name}</span>
            {node.code && <span className="font-mono text-xs text-slate-500 font-semibold">({node.code})</span>}
            <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider", typeBg)}>
              {node.type}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={cn("text-[10px] font-semibold rounded-full px-2 py-0.5", node.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
            {node.isActive ? "Active" : "Inactive"}
          </span>
          <Button variant="ghost" size="sm" onClick={() => onEdit(node.item, tabTypeMap[node.type])} className="h-7 w-7 p-0">
            <Edit3 className="h-3.5 w-3.5 text-slate-600" />
          </Button>
        </div>
      </div>

      {(isExpanded || searchQuery) && hasChildren && (
        <div className="pl-6 space-y-1 border-l-2 border-slate-100 ml-2">
          {node.children!.map((child) => (
            <LocationTreeNodeView
              key={child.id}
              node={child}
              searchQuery={searchQuery}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}
