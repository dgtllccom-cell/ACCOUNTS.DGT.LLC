"use client";

import { useEffect, useMemo, useState } from "react";
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
  AlertTriangle,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { SimpleModal } from "@/components/ui/simple-modal";
import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type CountryRow = {
  id: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  currency_code: string;
  default_language_code: string | null;
  is_active: boolean;
};

type StateRow = {
  id: string;
  country_id: string;
  name: string;
  code: string | null;
  is_active: boolean;
};

type DistrictRow = {
  id: string;
  country_id: string;
  state_province_id: string;
  name: string;
  code: string | null;
  is_active: boolean;
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

type TabType = "country" | "state" | "city" | "tehsil";

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

  // Raw list states
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [states, setStates] = useState<StateRow[]>([]);
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [cities, setCities] = useState<CityRow[]>([]);

  // Search queries & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Cascading filters in lists
  const [selectedCountryId, setSelectedCountryId] = useState("");
  const [selectedStateId, setSelectedStateId] = useState("");
  const [selectedDistrictId, setSelectedDistrictId] = useState("");

  // Loading indicators
  const [loading, setLoading] = useState({
    countries: false,
    states: false,
    districts: false,
    cities: false,
    saving: false,
    deleting: false
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

  // Simplified Form states
  const [formCountry, setFormCountry] = useState({
    name: "",
    iso2: "",
    isActive: true
  });

  const [formState, setFormState] = useState({
    name: "",
    codeSuffix: "",
    isActive: true
  });

  const [formCity, setFormCity] = useState({
    name: "",
    codeSuffix: "",
    isActive: true
  });

  const [formTehsil, setFormTehsil] = useState({
    name: "",
    codeSuffix: "",
    zipCode: "",
    isActive: true
  });

  // Sync url param tabs
  useEffect(() => {
    if (initialTab && ["country", "state", "city", "tehsil"].includes(initialTab)) {
      setActiveTab(initialTab as TabType);
      setSearchQuery("");
      setBanner(null);
    }
  }, [initialTab]);

  // Load countries
  useEffect(() => {
    loadCountries();
  }, []);

  // Set default scoped country filter
  useEffect(() => {
    if (countries.length > 0 && !selectedCountryId) {
      const pk = countries.find(c => c.iso2 === "PK");
      setSelectedCountryId(pk ? pk.id : countries[0].id);
    }
  }, [countries]);

  // Load cascade listings on selection change
  useEffect(() => {
    if (selectedCountryId) {
      loadStates(selectedCountryId);
      setSelectedStateId("");
      setSelectedDistrictId("");
      setStates([]);
      setDistricts([]);
      setCities([]);
    }
  }, [selectedCountryId]);

  useEffect(() => {
    if (selectedStateId) {
      loadDistricts(selectedStateId);
      setSelectedDistrictId("");
      setDistricts([]);
      setCities([]);
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
      // Only reset selections if we are in create mode or changing selection
      if (modalMode === "add") {
        setModalStateId("");
        setModalDistrictId("");
      }
      setModalStates([]);
      setModalDistricts([]);
    }
  }, [modalCountryId]);

  useEffect(() => {
    if (modalStateId) {
      loadModalDistricts(modalStateId);
      if (modalMode === "add") {
        setModalDistrictId("");
      }
      setModalDistricts([]);
    }
  }, [modalStateId]);

  // API loaders
  async function loadCountries() {
    setLoading(prev => ({ ...prev, countries: true }));
    try {
      const res = await apiGet<{ countries: CountryRow[] }>("/api/erp/locations/countries");
      setCountries(res.countries || []);
    } catch (e: any) {
      showBanner("error", e.message || "Failed to load countries");
    } finally {
      setLoading(prev => ({ ...prev, countries: false }));
    }
  }

  async function loadStates(countryId: string) {
    setLoading(prev => ({ ...prev, states: true }));
    try {
      const res = await apiGet<{ states: StateRow[] }>(`/api/erp/locations/states?countryId=${countryId}`);
      setStates(res.states || []);
    } catch (e: any) {
      showBanner("error", e.message || "Failed to load states");
    } finally {
      setLoading(prev => ({ ...prev, states: false }));
    }
  }

  async function loadDistricts(stateId: string) {
    setLoading(prev => ({ ...prev, districts: true }));
    try {
      const res = await apiGet<{ districts: DistrictRow[] }>(`/api/erp/locations/districts?stateProvinceId=${stateId}`);
      setDistricts(res.districts || []);
    } catch (e: any) {
      showBanner("error", e.message || "Failed to load districts/cities");
    } finally {
      setLoading(prev => ({ ...prev, districts: false }));
    }
  }

  async function loadCities(countryId: string, stateId: string, districtId: string) {
    setLoading(prev => ({ ...prev, cities: true }));
    try {
      const res = await apiGet<{ cities: CityRow[] }>(
        `/api/erp/locations/cities?countryId=${countryId}&stateProvinceId=${stateId}&districtId=${districtId}`
      );
      setCities(res.cities || []);
    } catch (e: any) {
      showBanner("error", e.message || "Failed to load tehsils");
    } finally {
      setLoading(prev => ({ ...prev, cities: false }));
    }
  }

  // Modal cascade dropdown data fetching
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
    return countries.map(c => ({
      value: c.id,
      label: `${c.name} (${c.iso2})`,
      keywords: `${c.name} ${c.iso2}`
    }));
  }, [countries]);

  const stateOptions = useMemo(() => {
    return states.map(s => ({
      value: s.id,
      label: s.code ? `${s.name} (${s.code})` : s.name,
      keywords: `${s.name} ${s.code}`
    }));
  }, [states]);

  const districtOptions = useMemo(() => {
    return districts.map(d => ({
      value: d.id,
      label: d.code ? `${d.name} (${d.code})` : d.name,
      keywords: `${d.name} ${d.code}`
    }));
  }, [districts]);

  // Client side listing filters
  const filteredCountries = useMemo(() => {
    return countries.filter(c => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.iso2 || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ? true : statusFilter === "active" ? c.is_active : !c.is_active;
      return matchesSearch && matchesStatus;
    });
  }, [countries, searchQuery, statusFilter]);

  const filteredStates = useMemo(() => {
    return states.filter(s => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.code || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ? true : statusFilter === "active" ? s.is_active : !s.is_active;
      return matchesSearch && matchesStatus;
    });
  }, [states, searchQuery, statusFilter]);

  const filteredDistricts = useMemo(() => {
    return districts.filter(d => {
      const matchesSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.code || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ? true : statusFilter === "active" ? d.is_active : !d.is_active;
      return matchesSearch && matchesStatus;
    });
  }, [districts, searchQuery, statusFilter]);

  const filteredCities = useMemo(() => {
    return cities.filter(c => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.zip_code || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ? true : statusFilter === "active" ? c.is_active : !c.is_active;
      return matchesSearch && matchesStatus;
    });
  }, [cities, searchQuery, statusFilter]);

  // Code formats suffix rules
  const modalStateCodePrefix = useMemo(() => {
    const parent = countries.find(c => c.id === modalCountryId);
    return parent ? `${parent.iso2 || "XX"}-` : "";
  }, [countries, modalCountryId]);

  const modalDistrictCodePrefix = useMemo(() => {
    const parentCountry = countries.find(c => c.id === modalCountryId);
    const parentState = modalStates.find(s => s.id === modalStateId);
    const cCode = parentCountry ? parentCountry.iso2 || "XX" : "XX";
    let sCode = parentState ? parentState.code || "XX" : "XX";
    if (sCode.startsWith(`${cCode}-`)) sCode = sCode.substring(cCode.length + 1);
    return `${cCode}-${sCode}-`;
  }, [countries, modalStates, modalCountryId, modalStateId]);

  const modalTehsilCodePrefix = useMemo(() => {
    const parentCountry = countries.find(c => c.id === modalCountryId);
    const parentState = modalStates.find(s => s.id === modalStateId);
    const parentDistrict = modalDistricts.find(d => d.id === modalDistrictId);

    const cCode = parentCountry ? parentCountry.iso2 || "XX" : "XX";
    let sCode = parentState ? parentState.code || "XX" : "XX";
    if (sCode.startsWith(`${cCode}-`)) sCode = sCode.substring(cCode.length + 1);
    let dCode = parentDistrict ? parentDistrict.code || "XX" : "XX";
    const prefix2 = `${cCode}-${sCode}-`;
    if (dCode.startsWith(prefix2)) dCode = dCode.substring(prefix2.length);

    return `${cCode}-${sCode}-${dCode}-`;
  }, [countries, modalStates, modalDistricts, modalCountryId, modalStateId, modalDistrictId]);

  // Form open methods
  function handleOpenAddModal() {
    setModalMode("add");
    setEditRecordId(null);
    setBanner(null);

    setModalCountryId(selectedCountryId);
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

  async function handleOpenEditModal(record: any) {
    setModalMode("edit");
    setEditRecordId(record.id);
    setBanner(null);

    // Explicitly set the hierarchy scope
    setModalCountryId(record.country_id || "");
    setModalStateId(record.state_province_id || "");
    setModalDistrictId(record.district_id || "");

    // Pre-load cascading lists inside modal
    if (record.country_id) {
      await loadModalStates(record.country_id);
    }
    if (record.state_province_id) {
      await loadModalDistricts(record.state_province_id);
    }

    if (activeTab === "country") {
      setFormCountry({
        name: record.name,
        iso2: record.iso2 || "",
        isActive: record.is_active
      });
    } else if (activeTab === "state") {
      const c = countries.find(x => x.id === record.country_id);
      const prefix = c ? `${c.iso2}-` : "";
      let codeSuff = record.code || "";
      if (prefix && codeSuff.startsWith(prefix)) codeSuff = codeSuff.substring(prefix.length);

      setFormState({
        name: record.name,
        codeSuffix: codeSuff,
        isActive: record.is_active
      });
    } else if (activeTab === "city") {
      const c = countries.find(x => x.id === record.country_id);
      const s = states.find(x => x.id === record.state_province_id) || modalStates.find(x => x.id === record.state_province_id);
      
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
    } else if (activeTab === "tehsil") {
      const c = countries.find(x => x.id === record.country_id);
      const s = states.find(x => x.id === record.state_province_id) || modalStates.find(x => x.id === record.state_province_id);
      const d = districts.find(x => x.id === record.district_id) || modalDistricts.find(x => x.id === record.district_id);

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
    setLoading(prev => ({ ...prev, saving: true }));
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
          setCountries(prev => [res.country, ...prev]);
          showBanner("success", `Country ${res.country.name} created successfully.`);
        } else {
          const res = await apiPatch<{ country: CountryRow }>(`/api/erp/locations/countries/${editRecordId}`, {
            ...payload,
            isActive: formCountry.isActive
          });
          setCountries(prev => prev.map(c => (c.id === editRecordId ? res.country : c)));
          showBanner("success", `Country ${res.country.name} updated successfully.`);
        }
      } else if (activeTab === "state") {
        if (!modalCountryId) {
          throw new Error("Please select a Country first");
        }
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
          if (modalCountryId === selectedCountryId) {
            setStates(prev => [res.state, ...prev]);
          }
          showBanner("success", `State ${res.state.name} created successfully.`);
        } else {
          const res = await apiPatch<{ state: StateRow }>(`/api/erp/locations/states/${editRecordId}`, {
            name: formState.name.trim(),
            code: fullCode,
            isActive: formState.isActive
          });
          if (modalCountryId === selectedCountryId) {
            setStates(prev => prev.map(s => (s.id === editRecordId ? res.state : s)));
          }
          showBanner("success", `State ${res.state.name} updated successfully.`);
        }
      } else if (activeTab === "city") {
        if (!modalCountryId || !modalStateId) {
          throw new Error("Country and State selections are required");
        }
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
          if (modalStateId === selectedStateId) {
            setDistricts(prev => [res.district, ...prev]);
          }
          showBanner("success", `City ${res.district.name} created successfully.`);
        } else {
          const res = await apiPatch<{ district: DistrictRow }>(`/api/erp/locations/districts/${editRecordId}`, {
            name: formCity.name.trim(),
            code: fullCode,
            isActive: formCity.isActive
          });
          if (modalStateId === selectedStateId) {
            setDistricts(prev => prev.map(d => (d.id === editRecordId ? res.district : d)));
          }
          showBanner("success", `City ${res.district.name} updated successfully.`);
        }
      } else if (activeTab === "tehsil") {
        if (!modalCountryId || !modalStateId || !modalDistrictId) {
          throw new Error("Country, State, and City selections are required");
        }
        if (!formTehsil.name.trim() || !formTehsil.codeSuffix.trim()) {
          throw new Error("Tehsil Name and Code Suffix are required");
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
          if (modalDistrictId === selectedDistrictId) {
            setCities(prev => [res.city, ...prev]);
          }
          showBanner("success", `Tehsil ${res.city.name} created successfully.`);
        } else {
          const res = await apiPatch<{ city: CityRow }>(`/api/erp/locations/cities/${editRecordId}`, {
            name: formTehsil.name.trim(),
            code: fullCode,
            zipCode: formTehsil.zipCode.trim() || null,
            isActive: formTehsil.isActive,
            districtId: modalDistrictId
          });
          if (modalDistrictId === selectedDistrictId) {
            setCities(prev => prev.map(c => (c.id === editRecordId ? res.city : c)));
          }
          showBanner("success", `Tehsil ${res.city.name} updated successfully.`);
        }
      }
      setIsAddEditModalOpen(false);
    } catch (e: any) {
      showBanner("error", e.message || "Failed to save location data.");
    } finally {
      setLoading(prev => ({ ...prev, saving: false }));
    }
  }

  // Deletions
  function triggerDelete(id: string, name: string, type: TabType) {
    setDeleteConfirmTarget({ id, name, type });
  }

  async function confirmDelete() {
    if (!deleteConfirmTarget) return;
    setLoading(prev => ({ ...prev, deleting: true }));
    const { id, name, type } = deleteConfirmTarget;

    try {
      if (type === "country") {
        await apiDelete(`/api/erp/locations/countries/${id}`);
        setCountries(prev => prev.filter(c => c.id !== id));
        if (selectedCountryId === id) setSelectedCountryId("");
      } else if (type === "state") {
        await apiDelete(`/api/erp/locations/states/${id}`);
        setStates(prev => prev.filter(s => s.id !== id));
        if (selectedStateId === id) setSelectedStateId("");
      } else if (type === "city") {
        await apiDelete(`/api/erp/locations/districts/${id}`);
        setDistricts(prev => prev.filter(d => d.id !== id));
        if (selectedDistrictId === id) setSelectedDistrictId("");
      } else if (type === "tehsil") {
        await apiDelete(`/api/erp/locations/cities/${id}`);
        setCities(prev => prev.filter(c => c.id !== id));
      }
      showBanner("success", `${name} deleted successfully.`);
      setDeleteConfirmTarget(null);
    } catch (e: any) {
      showBanner("error", e.message || `Failed to delete ${name}`);
    } finally {
      setLoading(prev => ({ ...prev, deleting: false }));
    }
  }

  // Import parsing
  function handleCsvDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      parseImportFile(file);
    } else {
      setImportLogs(["Please select a valid CSV file."]);
    }
  }

  function handleCsvSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      parseImportFile(file);
    }
  }

  function parseImportFile(file: File) {
    setImportFile(file);
    setImportLogs([]);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      try {
        const rows = parseCSV(text);
        if (rows.length < 2) {
          throw new Error("CSV file does not contain enough data rows.");
        }

        const headers = rows[0].map(h => h.trim().toLowerCase());
        const expectedHeaders = [
          "country code",
          "country name",
          "state code",
          "state name",
          "city code",
          "city name",
          "tehsil code",
          "tehsil name"
        ];

        const missing = expectedHeaders.filter(h => !headers.includes(h));
        if (missing.length > 0) {
          throw new Error(`CSV is missing required headers: ${missing.join(", ")}`);
        }

        const mapped: ImportRow[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length < headers.length) continue;
          
          const item: Record<string, string> = {};
          headers.forEach((header, index) => {
            item[header] = row[index] || "";
          });

          mapped.push({
            countryCode: item["country code"],
            countryName: item["country name"],
            stateCode: item["state code"],
            stateName: item["state name"],
            cityCode: item["city code"],
            cityName: item["city name"],
            tehsilCode: item["tehsil code"],
            tehsilName: item["tehsil name"]
          });
        }

        setImportRows(mapped);
        setImportLogs([`Successfully parsed ${mapped.length} rows for import.`]);
      } catch (err: any) {
        setImportLogs([`Parsing Error: ${err.message}`]);
        setImportRows([]);
      }
    };
    reader.readAsText(file);
  }

  function parseCSV(text: string): string[][] {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentVal = "";

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentVal += '"';
          i++; 
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentVal.trim());
        currentVal = "";
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(currentVal.trim());
        if (row.length > 1 || row[0] !== "") {
          lines.push(row);
        }
        row = [];
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
    if (row.length > 0 || currentVal !== "") {
      row.push(currentVal.trim());
      lines.push(row);
    }
    return lines;
  }

  async function executeBulkImport() {
    if (importRows.length === 0) return;
    setImportProgress({ total: importRows.length, current: 0 });
    setImportLogs(prev => [...prev, "Uploading data to server for transactional processing..."]);

    try {
      const res = await apiPost<{
        success: boolean;
        countriesCreated: number;
        statesCreated: number;
        districtsCreated: number;
        citiesCreated: number;
      }>("/api/erp/locations/bulk-import", { rows: importRows });

      if (res.success) {
        setImportLogs(prev => [
          ...prev,
          "Import Completed Successfully!",
          `Countries validated: ${res.countriesCreated}`,
          `States created: ${res.statesCreated}`,
          `Cities created: ${res.districtsCreated}`,
          `Tehsils created: ${res.citiesCreated}`
        ]);
        loadCountries();
        if (selectedCountryId) loadStates(selectedCountryId);
      }
    } catch (e: any) {
      setImportLogs(prev => [...prev, `Import Failed: ${e.message}`]);
    } finally {
      setImportProgress(null);
    }
  }

  // Export CSV
  function handleExportCsv() {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = "";

    if (activeTab === "country") {
      filename = "Country_Master_Export.csv";
      headers = ["Country Code", "Country Name", "Status"];
      rows = filteredCountries.map(c => [
        c.iso2 || "",
        c.name,
        c.is_active ? "Active" : "Inactive"
      ]);
    } else if (activeTab === "state") {
      filename = "State_Master_Export.csv";
      const c = countries.find(x => x.id === selectedCountryId);
      headers = ["Country Code", "Country Name", "State Code", "State Name", "Status"];
      rows = filteredStates.map(s => [
        c?.iso2 || "",
        c?.name || "",
        s.code || "",
        s.name,
        s.is_active ? "Active" : "Inactive"
      ]);
    } else if (activeTab === "city") {
      filename = "City_Master_Export.csv";
      const c = countries.find(x => x.id === selectedCountryId);
      const s = states.find(x => x.id === selectedStateId);
      headers = ["Country Code", "Country Name", "State Code", "State Name", "City Code", "City Name", "Status"];
      rows = filteredDistricts.map(d => [
        c?.iso2 || "",
        c?.name || "",
        s?.code || "",
        s?.name || "",
        d.code || "",
        d.name,
        d.is_active ? "Active" : "Inactive"
      ]);
    } else if (activeTab === "tehsil") {
      filename = "Tehsil_Master_Export.csv";
      const c = countries.find(x => x.id === selectedCountryId);
      const s = states.find(x => x.id === selectedStateId);
      const d = districts.find(x => x.id === selectedDistrictId);
      headers = [
        "Country Code",
        "Country Name",
        "State Code",
        "State Name",
        "City Code",
        "City Name",
        "Tehsil Code",
        "Tehsil Name",
        "Zip Code",
        "Status"
      ];
      rows = filteredCities.map(ct => [
        c?.iso2 || "",
        c?.name || "",
        s?.code || "",
        s?.name || "",
        d?.code || "",
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
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(","),
      ...rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
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

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">ERP Settings</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Location Management Workspace</h1>
          <p className="text-sm text-muted-foreground">
            Configure the global 4-level location hierarchy: Country &rarr; State &rarr; City &rarr; Tehsil.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border bg-muted/30 px-4 py-2 text-xs font-semibold text-muted-foreground shadow-sm">
          <Workflow className="h-4 w-4 text-primary" />
          <span>Hierarchy: Country &rarr; State &rarr; City &rarr; Tehsil</span>
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

      {/* Tabs navigation */}
      <div className="flex flex-col gap-5">
        <div className="flex border-b">
          <button
            onClick={() => { setActiveTab("country"); setSearchQuery(""); setBanner(null); }}
            className={cn(
              "px-5 py-3 text-sm font-semibold border-b-2 transition-colors",
              activeTab === "country"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            1. Country Master
          </button>
          <button
            onClick={() => { setActiveTab("state"); setSearchQuery(""); setBanner(null); }}
            className={cn(
              "px-5 py-3 text-sm font-semibold border-b-2 transition-colors",
              activeTab === "state"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            2. State Master
          </button>
          <button
            onClick={() => { setActiveTab("city"); setSearchQuery(""); setBanner(null); }}
            className={cn(
              "px-5 py-3 text-sm font-semibold border-b-2 transition-colors",
              activeTab === "city"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            3. City Master
          </button>
          <button
            onClick={() => { setActiveTab("tehsil"); setSearchQuery(""); setBanner(null); }}
            className={cn(
              "px-5 py-3 text-sm font-semibold border-b-2 transition-colors",
              activeTab === "tehsil"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            4. Tehsil Master
          </button>
        </div>

        {/* Filter scopes card */}
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {activeTab !== "country" && (
                  <div className="w-56">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Country</Label>
                    <SearchSelect
                      label=""
                      value={selectedCountryId}
                      options={countryOptions}
                      placeholder="Select Country"
                      onValueChange={setSelectedCountryId}
                      className="mt-1"
                    />
                  </div>
                )}

                {(activeTab === "city" || activeTab === "tehsil") && (
                  <div className="w-56">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select State</Label>
                    <SearchSelect
                      label=""
                      value={selectedStateId}
                      options={stateOptions}
                      placeholder={selectedCountryId ? "Select State" : "Select Country First"}
                      disabled={!selectedCountryId}
                      onValueChange={setSelectedStateId}
                      className="mt-1"
                    />
                  </div>
                )}

                {activeTab === "tehsil" && (
                  <div className="w-56">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select City</Label>
                    <SearchSelect
                      label=""
                      value={selectedDistrictId}
                      options={districtOptions}
                      placeholder={selectedStateId ? "Select City" : "Select State First"}
                      disabled={!selectedStateId}
                      onValueChange={setSelectedDistrictId}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsImportModalOpen(true)}>
                  <Upload className="mr-1.5 h-4 w-4" /> Import Excel/CSV
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleExportCsv}>
                  <Download className="mr-1.5 h-4 w-4" /> Export CSV
                </Button>
                <Button type="button" variant="default" size="sm" onClick={handleOpenAddModal}>
                  <Plus className="mr-1.5 h-4 w-4" /> Add Record
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

        {/* Tab content listings */}
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            {activeTab === "country" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                      <th className="px-4 py-3">Country Code</th>
                      <th className="px-4 py-3">Country Name</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCountries.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">
                          {loading.countries ? "Loading Countries..." : "No Country records found."}
                        </td>
                      </tr>
                    ) : (
                      filteredCountries.map(c => (
                        <tr key={c.id} className="border-b hover:bg-muted/10">
                          <td className="px-4 py-3 font-mono font-semibold">{c.iso2 || "-"}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{c.name}</td>
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
                              <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(c)}>
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-rose-600 hover:bg-rose-50"
                                onClick={() => triggerDelete(c.id, c.name, "country")}
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

            {activeTab === "state" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                      <th className="px-4 py-3">State Code</th>
                      <th className="px-4 py-3">State Name</th>
                      <th className="px-4 py-3">Parent Country</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedCountryId ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          Please select a Country from the dropdown above to load states.
                        </td>
                      </tr>
                    ) : filteredStates.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          {loading.states ? "Loading States..." : "No State records found for the selected country."}
                        </td>
                      </tr>
                    ) : (
                      filteredStates.map(s => (
                        <tr key={s.id} className="border-b hover:bg-muted/10">
                          <td className="px-4 py-3 font-mono font-semibold">{s.code || "-"}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{s.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {countries.find(c => c.id === s.country_id)?.name || "-"}
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
                              <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(s)}>
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-rose-600 hover:bg-rose-50"
                                onClick={() => triggerDelete(s.id, s.name, "state")}
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

            {activeTab === "city" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                      <th className="px-4 py-3">City Code</th>
                      <th className="px-4 py-3">City Name</th>
                      <th className="px-4 py-3">Parent State</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedStateId ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          Please select Country and State from the dropdowns above to load cities.
                        </td>
                      </tr>
                    ) : filteredDistricts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          {loading.districts ? "Loading Cities..." : "No City records found for the selected state."}
                        </td>
                      </tr>
                    ) : (
                      filteredDistricts.map(d => (
                        <tr key={d.id} className="border-b hover:bg-muted/10">
                          <td className="px-4 py-3 font-mono font-semibold">{d.code || "-"}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{d.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {states.find(s => s.id === d.state_province_id)?.name || "-"}
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
                              <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(d)}>
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-rose-600 hover:bg-rose-50"
                                onClick={() => triggerDelete(d.id, d.name, "city")}
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

            {activeTab === "tehsil" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 font-semibold text-muted-foreground">
                      <th className="px-4 py-3">Tehsil Code</th>
                      <th className="px-4 py-3">Tehsil Name</th>
                      <th className="px-4 py-3">Zip Code</th>
                      <th className="px-4 py-3">Parent City</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedDistrictId ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          Please select Country, State, and City from the dropdowns above to load tehsils.
                        </td>
                      </tr>
                    ) : filteredCities.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          {loading.cities ? "Loading Tehsils..." : "No Tehsil records found for the selected city."}
                        </td>
                      </tr>
                    ) : (
                      filteredCities.map(ct => (
                        <tr key={ct.id} className="border-b hover:bg-muted/10">
                          <td className="px-4 py-3 font-mono font-semibold">{ct.code || "-"}</td>
                          <td className="px-4 py-3 font-semibold text-foreground">{ct.name}</td>
                          <td className="px-4 py-3 font-mono text-xs">{ct.zip_code || "-"}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {districts.find(d => d.id === ct.district_id)?.name || "-"}
                          </td>
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
                              <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(ct)}>
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

      {/* CREATE & EDIT FORM MODAL WITH CASCADING DROPDOWNS */}
      {isAddEditModalOpen && (
        <SimpleModal
          title={modalMode === "add" ? `Add New ${activeTab.toUpperCase()}` : `Edit ${activeTab.toUpperCase()}`}
          onClose={() => setIsAddEditModalOpen(false)}
          className="max-w-xl"
        >
          <div className="space-y-4">
            {activeTab === "country" && (
              <div className="space-y-4">
                <div>
                  <Label>Country Name</Label>
                  <Input
                    value={formCountry.name}
                    onChange={e => setFormCountry({ ...formCountry, name: e.target.value })}
                    placeholder="e.g. Pakistan"
                  />
                </div>
                <div>
                  <Label>Country Code (ISO2)</Label>
                  <Input
                    value={formCountry.iso2}
                    onChange={e => setFormCountry({ ...formCountry, iso2: e.target.value.toUpperCase().slice(0, 2) })}
                    placeholder="e.g. PK"
                    maxLength={2}
                  />
                </div>
              </div>
            )}

            {activeTab === "state" && (
              <div className="space-y-4">
                <div>
                  <Label>Select Country</Label>
                  <select
                    value={modalCountryId}
                    onChange={e => setModalCountryId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">-- Choose Country --</option>
                    {countries.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.iso2})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>State / Province Name</Label>
                  <Input
                    value={formState.name}
                    onChange={e => setFormState({ ...formState, name: e.target.value })}
                    placeholder="e.g. Punjab"
                  />
                </div>
                <div>
                  <Label>State Code (Enforced Suffix)</Label>
                  <div className="flex items-center rounded-md border bg-muted/30">
                    <span className="bg-muted px-3 py-2 text-sm font-mono text-muted-foreground select-none">
                      {modalStateCodePrefix}
                    </span>
                    <Input
                      className="border-0 bg-transparent ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 font-mono"
                      value={formState.codeSuffix}
                      onChange={e => setFormState({ ...formState, codeSuffix: e.target.value.toUpperCase() })}
                      placeholder="e.g. PB"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground font-mono">
                    Output: {modalStateCodePrefix}{formState.codeSuffix || "..."}
                  </p>
                </div>
              </div>
            )}

            {activeTab === "city" && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Select Country</Label>
                    <select
                      value={modalCountryId}
                      onChange={e => setModalCountryId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">-- Choose Country --</option>
                      {countries.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.iso2})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Select State</Label>
                    <select
                      value={modalStateId}
                      onChange={e => setModalStateId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      disabled={!modalCountryId}
                    >
                      <option value="">-- Choose State --</option>
                      {modalStates.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>City / District Name</Label>
                  <Input
                    value={formCity.name}
                    onChange={e => setFormCity({ ...formCity, name: e.target.value })}
                    placeholder="e.g. Lahore"
                  />
                </div>
                <div>
                  <Label>City Code (Enforced Suffix)</Label>
                  <div className="flex items-center rounded-md border bg-muted/30">
                    <span className="bg-muted px-3 py-2 text-sm font-mono text-muted-foreground select-none">
                      {modalDistrictCodePrefix}
                    </span>
                    <Input
                      className="border-0 bg-transparent ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 font-mono"
                      value={formCity.codeSuffix}
                      onChange={e => setFormCity({ ...formCity, codeSuffix: e.target.value.toUpperCase() })}
                      placeholder="e.g. LHR"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground font-mono">
                    Output: {modalDistrictCodePrefix}{formCity.codeSuffix || "..."}
                  </p>
                </div>
              </div>
            )}

            {activeTab === "tehsil" && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <Label>Select Country</Label>
                    <select
                      value={modalCountryId}
                      onChange={e => setModalCountryId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                    >
                      <option value="">-- Choose --</option>
                      {countries.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Select State</Label>
                    <select
                      value={modalStateId}
                      onChange={e => setModalStateId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                      disabled={!modalCountryId}
                    >
                      <option value="">-- Choose --</option>
                      {modalStates.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Select City</Label>
                    <select
                      value={modalDistrictId}
                      onChange={e => setModalDistrictId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                      disabled={!modalStateId}
                    >
                      <option value="">-- Choose --</option>
                      {modalDistricts.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Tehsil Name</Label>
                  <Input
                    value={formTehsil.name}
                    onChange={e => setFormTehsil({ ...formTehsil, name: e.target.value })}
                    placeholder="e.g. Model Town"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Tehsil Code (Suffix)</Label>
                    <div className="flex items-center rounded-md border bg-muted/30">
                      <span className="bg-muted px-2 py-2 text-[10px] font-mono text-muted-foreground select-none">
                        {modalTehsilCodePrefix}
                      </span>
                      <Input
                        className="border-0 bg-transparent ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 font-mono text-sm"
                        value={formTehsil.codeSuffix}
                        onChange={e => setFormTehsil({ ...formTehsil, codeSuffix: e.target.value.toUpperCase() })}
                        placeholder="e.g. MDL"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground font-mono">
                      Output: {modalTehsilCodePrefix}{formTehsil.codeSuffix || "..."}
                    </p>
                  </div>
                  <div>
                    <Label>Tehsil Zip Code</Label>
                    <Input
                      value={formTehsil.zipCode}
                      onChange={e => setFormTehsil({ ...formTehsil, zipCode: e.target.value })}
                      placeholder="e.g. 54700"
                    />
                  </div>
                </div>
              </div>
            )}

            {modalMode === "edit" && (
              <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    activeTab === "country"
                      ? formCountry.isActive
                      : activeTab === "state"
                      ? formState.isActive
                      : activeTab === "city"
                      ? formCity.isActive
                      : formTehsil.isActive
                  }
                  onChange={e => {
                    const checked = e.target.checked;
                    if (activeTab === "country") setFormCountry({ ...formCountry, isActive: checked });
                    else if (activeTab === "state") setFormState({ ...formState, isActive: checked });
                    else if (activeTab === "city") setFormCity({ ...formCity, isActive: checked });
                    else if (activeTab === "tehsil") setFormTehsil({ ...formTehsil, isActive: checked });
                  }}
                />
                Is Active Master Record
              </label>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setIsAddEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmitForm} disabled={loading.saving}>
              {loading.saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Save Record
            </Button>
          </div>
        </SimpleModal>
      )}

      {/* CASCADE DELETE CONFIRMATION MODAL */}
      {deleteConfirmTarget && (
        <SimpleModal title="Confirm Cascade Delete Action" onClose={() => setDeleteConfirmTarget(null)} className="max-w-md">
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 animate-bounce" />
              <div>
                <h4 className="font-bold text-sm">Critical Warning: Cascade Soft-Delete</h4>
                <p className="mt-1 text-xs text-rose-700">
                  You are about to delete **{deleteConfirmTarget.name}** ({deleteConfirmTarget.type.toUpperCase()}).
                </p>
                <p className="mt-2 text-xs text-rose-700">
                  Since location records follow a hierarchy, deleting this record will **cascade** and soft-delete all states, cities/districts, and tehsils depending on it!
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This action updates `deleted_at = now()` on the target record and its children, preventing them from appearing in transaction forms.
            </p>
          </div>
          <div className="mt-6 flex items-center justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setDeleteConfirmTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={loading.deleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {loading.deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
              Yes, Delete with Cascade
            </Button>
          </div>
        </SimpleModal>
      )}

      {/* EXCEL/CSV BULK IMPORT MODAL */}
      {isImportModalOpen && (
        <SimpleModal title="Bulk Location Import Setup" onClose={() => setIsImportModalOpen(false)} className="max-w-2xl">
          <div className="space-y-4">
            <div className="rounded-lg border border-sky-100 bg-sky-50/50 p-4 text-sky-800 text-xs">
              <div className="flex gap-2 font-bold text-sky-900 mb-1">
                <Info className="h-4 w-4 text-sky-600" />
                <span>Import File Guidelines</span>
              </div>
              <p>Please upload a CSV file matching this header structure exactly. Missing column fields will break validation checks.</p>
              <pre className="mt-2 rounded bg-background p-2 text-[10px] font-mono text-muted-foreground border">
                Country Code,Country Name,State Code,State Name,City Code,City Name,Tehsil Code,Tehsil Name{"\n"}
                PK,Pakistan,PK-PB,Punjab,PK-PB-LHR,Lahore,PK-PB-LHR-MDL,Model Town
              </pre>
            </div>

            <div
              className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 bg-muted/10 cursor-pointer hover:bg-muted/20 hover:border-primary/50 transition-colors relative"
              onDragOver={e => e.preventDefault()}
              onDrop={handleCsvDrop}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-semibold">
                {importFile ? importFile.name : "Drag & Drop CSV File here or Click to Select"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Accepts CSV files up to 10MB</p>
            </div>

            {importLogs.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Import status logs</Label>
                <div className="max-h-40 overflow-y-auto rounded-lg border bg-muted/20 p-3 text-xs font-mono space-y-1">
                  {importLogs.map((log, index) => (
                    <div key={index} className="text-muted-foreground">
                      &rarr; {log}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importRows.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase">Preview (First 3 rows)</Label>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-muted/40 text-muted-foreground border-b">
                      <tr>
                        <th className="px-3 py-2">Country</th>
                        <th className="px-3 py-2">State</th>
                        <th className="px-3 py-2">City</th>
                        <th className="px-3 py-2">Tehsil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.slice(0, 3).map((row, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="px-3 py-2">{row.countryName} ({row.countryCode})</td>
                          <td className="px-3 py-2">{row.stateName} ({row.stateCode})</td>
                          <td className="px-3 py-2">{row.cityName} ({row.cityCode})</td>
                          <td className="px-3 py-2">{row.tehsilName} ({row.tehsilCode})</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsImportModalOpen(false);
                setImportFile(null);
                setImportRows([]);
                setImportLogs([]);
              }}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={executeBulkImport}
              disabled={importRows.length === 0 || importProgress !== null}
            >
              {importProgress ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-1.5 h-4 w-4" />
                  Process Bulk Import
                </>
              )}
            </Button>
          </div>
        </SimpleModal>
      )}
    </div>
  );
}
