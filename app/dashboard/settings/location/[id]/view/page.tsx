"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Loader2, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export default function ViewLocationPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<any>(null);

  useEffect(() => {
    async function loadLocation() {
      try {
        const res = await apiGet<{ location: any }>(`/api/erp/locations/${id}`);
        setLocation(res.location);
      } catch (err) {
        alert("Failed to load location");
        router.push("/dashboard/settings/location");
      } finally {
        setLoading(false);
      }
    }
    loadLocation();
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!location) {
    return <div className="p-4 text-red-600">Location not found</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/settings/location")}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold">Location Details</h1>
        </div>
        <Button onClick={() => router.push(`/dashboard/settings/location/${id}/edit`)}>
          <PencilLine className="w-4 h-4 mr-2" />
          Edit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{location.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Location Name</label>
              <p className="text-lg font-semibold text-slate-900 mt-1">{location.name}</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Code</label>
              <p className="text-lg font-mono text-slate-900 mt-1">{location.code || "-"}</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Country</label>
              <p className="text-lg font-semibold text-slate-900 mt-1">
                {location.country?.name || "-"}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">State/Province</label>
              <p className="text-lg font-semibold text-slate-900 mt-1">
                {location.state?.name || "-"}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">District</label>
              <p className="text-lg font-semibold text-slate-900 mt-1">
                {location.district?.name || "-"}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Postal Code</label>
              <p className="text-lg font-semibold text-slate-900 mt-1">
                {location.postal_code || "-"}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
              <p className="mt-1">
                <span
                  className={cn(
                    "px-3 py-1 rounded-full text-sm font-semibold",
                    location.is_active
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  )}
                >
                  {location.is_active ? "Active" : "Inactive"}
                </span>
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase">Created Date</label>
              <p className="text-lg font-semibold text-slate-900 mt-1">
                {new Date(location.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <Button
              onClick={() => router.push("/dashboard/settings/location")}
              variant="outline"
            >
              Back to Locations
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
