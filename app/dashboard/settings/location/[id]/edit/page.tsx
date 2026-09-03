"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPut } from "@/lib/api/client";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

export default function EditLocationPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const lang = useActiveLanguage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    countryId: "",
    stateId: "",
    districtId: "",
    postalCode: "",
    isActive: true,
  });

  useEffect(() => {
    async function loadLocation() {
      try {
        const res = await apiGet<{ location: any }>(`/api/erp/locations/${id}`);
        const loc = res.location;
        setFormData({
          name: loc.name || "",
          code: loc.code || "",
          countryId: loc.country_id || "",
          stateId: loc.state_province_id || "",
          districtId: loc.district_id || "",
          postalCode: loc.postal_code || "",
          isActive: loc.is_active ?? true,
        });
      } catch (err) {
        alert(t(lang, "locedit.err_load", "Failed to load location"));
        router.push("/dashboard/settings/location");
      } finally {
        setLoading(false);
      }
    }
    loadLocation();
  }, [id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPut(`/api/erp/locations/${id}`, {
        name: formData.name,
        code: formData.code || null,
        stateId: formData.stateId || null,
        districtId: formData.districtId || null,
        postalCode: formData.postalCode || null,
        isActive: formData.isActive,
      });

      alert(t(lang, "locedit.updated_ok", "Location updated successfully!"));
      router.push("/dashboard/settings/location");
    } catch (err: any) {
      alert(`${t(lang, "locedit.err_update", "Failed to update location")}: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/settings/location")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-bold">{t(lang, "locedit.title", "Edit Location")}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t(lang, "locedit.details", "Location Details")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="font-semibold">
                {t(lang, "locedit.name", "Location Name")}
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="code" className="font-semibold">
                {t(lang, "locedit.code", "Location Code")}
              </Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="countryId" className="font-semibold">
                {t(lang, "locedit.country_id", "Country ID")}
              </Label>
              <Input id="countryId" value={formData.countryId} disabled className="bg-slate-100" />
            </div>

            <div>
              <Label htmlFor="stateId" className="font-semibold">
                {t(lang, "locedit.state_id", "State/Province ID")}
              </Label>
              <Input
                id="stateId"
                value={formData.stateId}
                onChange={(e) => setFormData({ ...formData, stateId: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="districtId" className="font-semibold">
                {t(lang, "locedit.district_id", "District ID")}
              </Label>
              <Input
                id="districtId"
                value={formData.districtId}
                onChange={(e) => setFormData({ ...formData, districtId: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="postalCode" className="font-semibold">
                {t(lang, "locedit.postal_code", "Postal Code")}
              </Label>
              <Input
                id="postalCode"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300"
              />
              <Label htmlFor="isActive" className="font-semibold">
                {t(lang, "common.active", "Active")}
              </Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t(lang, "common.saving", "Saving...")}
                  </>
                ) : (
                  t(lang, "locedit.save_changes", "Save Changes")
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/settings/location")}
                disabled={saving}
              >
                {t(lang, "common.cancel", "Cancel")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
