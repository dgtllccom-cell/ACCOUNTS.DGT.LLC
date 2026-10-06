"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api/client";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";

export default function NewLocationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const _lang = useActiveLanguage();
  const th = (x: string) => translateHeader(_lang, x);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    countryId: "",
    stateId: "",
    districtId: "",
    postalCode: "",
    isActive: true,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name || !formData.countryId) {
      alert("Name and Country are required");
      return;
    }

    setLoading(true);
    try {
      await apiPost("/api/erp/locations", {
        name: formData.name,
        code: formData.code || null,
        countryId: formData.countryId,
        stateId: formData.stateId || null,
        districtId: formData.districtId || null,
        postalCode: formData.postalCode || null,
        isActive: formData.isActive,
      });

      alert("Location created successfully!");
      router.push("/dashboard/settings/location");
    } catch (err: any) {
      alert(`Failed to create location: ${err.message}`);
    } finally {
      setLoading(false);
    }
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
        <h1 className="text-2xl font-bold">{th("Create New Location")}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{th("Location Details")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Location Name */}
            <div>
              <Label htmlFor="name" className="font-semibold">
                {th("Location Name")} *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={th("e.g., Karachi Main Office")}
                required
              />
            </div>

            {/* Code */}
            <div>
              <Label htmlFor="code" className="font-semibold">
                {th("Location Code")}
              </Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder={th("e.g., KHI-001")}
              />
            </div>

            {/* Country ID */}
            <div>
              <Label htmlFor="countryId" className="font-semibold">
                Country * (Use country ID from countries table)
              </Label>
              <Input
                id="countryId"
                value={formData.countryId}
                onChange={(e) => setFormData({ ...formData, countryId: e.target.value })}
                placeholder={th("e.g., pk-001")}
                required
              />
            </div>

            {/* State */}
            <div>
              <Label htmlFor="stateId" className="font-semibold">
                State/Province ID (optional)
              </Label>
              <Input
                id="stateId"
                value={formData.stateId}
                onChange={(e) => setFormData({ ...formData, stateId: e.target.value })}
                placeholder={th("e.g., state-id")}
              />
            </div>

            {/* District */}
            <div>
              <Label htmlFor="districtId" className="font-semibold">
                District ID (optional)
              </Label>
              <Input
                id="districtId"
                value={formData.districtId}
                onChange={(e) => setFormData({ ...formData, districtId: e.target.value })}
                placeholder={th("e.g., district-id")}
              />
            </div>

            {/* Postal Code */}
            <div>
              <Label htmlFor="postalCode" className="font-semibold">
                Postal Code (optional)
              </Label>
              <Input
                id="postalCode"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                placeholder={th("e.g., 75000")}
              />
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300"
              />
              <Label htmlFor="isActive" className="font-semibold">
                {th("Active")}
              </Label>
            </div>

            {/* Submit */}
            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Location"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/settings/location")}
                disabled={loading}
              >
                {th("Cancel")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
