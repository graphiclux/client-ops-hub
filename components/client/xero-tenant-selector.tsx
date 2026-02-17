"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getCsrfTokenFromCookie } from "@/lib/security/csrf-client";

type Tenant = {
  id?: string;
  tenantId?: string;
  tenantName?: string;
  name?: string;
};

type Props = {
  initialTenantId?: string | null;
};

export function XeroTenantSelector({ initialTenantId }: Props) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selected, setSelected] = useState(initialTenantId || "");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/integrations/xero/tenant");
        const body = (await res.json().catch(() => null)) as { error?: string; tenants?: Tenant[]; selectedTenantId?: string | null } | null;
        if (!res.ok) {
          if (mounted) setError(body?.error || "Failed to load tenants");
          return;
        }

        if (!mounted) return;
        const list = body?.tenants || [];
        setTenants(list);

        const preferred = body?.selectedTenantId || initialTenantId || list[0]?.tenantId || list[0]?.id || "";
        setSelected(preferred);
      } catch {
        if (mounted) setError("Failed to load tenants");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [initialTenantId]);

  async function saveTenant() {
    if (!selected) {
      setError("Please select a tenant");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const csrf = getCsrfTokenFromCookie();
      const res = await fetch("/api/integrations/xero/tenant", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(csrf ? { "x-csrf-token": csrf } : {})
        },
        body: JSON.stringify({ tenantId: selected })
      });

      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(body?.error || "Failed to save tenant");
        return;
      }

      setMessage("Tenant selected.");
    } catch {
      setError("Failed to save tenant");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Select tenant</p>
      <select
        className="w-full rounded-xl border border-border px-3 py-2 text-sm"
        disabled={loading || tenants.length === 0}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        {tenants.length === 0 && <option value="">{loading ? "Loading..." : "No tenants found"}</option>}
        {tenants.map((tenant) => {
          const value = tenant.tenantId || tenant.id || "";
          const label = tenant.tenantName || tenant.name || value;
          return (
            <option key={value} value={value}>
              {label}
            </option>
          );
        })}
      </select>
      <Button type="button" onClick={saveTenant} disabled={saving || loading || tenants.length === 0}>
        {saving ? "Saving..." : "Save Tenant"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {message && <p className="text-xs text-emerald-600">{message}</p>}
    </div>
  );
}
