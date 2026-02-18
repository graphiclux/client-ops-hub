"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCsrfTokenFromCookie } from "@/lib/security/csrf-client";

type Props = {
  currentUserId: string;
  canManageClients: boolean;
};

export function ClientIntakePanel({ currentUserId, canManageClients }: Props) {
  const [name, setName] = useState("");
  const [primaryDomain, setPrimaryDomain] = useState("");
  const [legalName, setLegalName] = useState("");
  const [status, setStatus] = useState("LEAD");
  const [tags, setTags] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canManageClients) {
    return null;
  }

  async function createClient() {
    if (!name.trim() || !primaryDomain.trim()) return;
    setCreating(true);
    setError(null);
    setResult(null);

    try {
      const csrf = getCsrfTokenFromCookie();
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(csrf ? { "x-csrf-token": csrf } : {})
        },
        body: JSON.stringify({
          name: name.trim(),
          legalName: legalName.trim() || undefined,
          primaryDomain: primaryDomain.trim(),
          status,
          tags: tags
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          timezone: timezone.trim() || "UTC",
          ownerUserId: currentUserId
        })
      });

      const body = (await res.json().catch(() => null)) as { error?: string; client?: { id: string } } | null;
      if (!res.ok || !body?.client?.id) {
        throw new Error(body?.error || "Failed to create client");
      }

      window.location.href = `/clients/${body.client.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create client");
    } finally {
      setCreating(false);
    }
  }

  async function importCsv(file: File) {
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const csrf = getCsrfTokenFromCookie();
      const form = new FormData();
      form.set("file", file);

      const res = await fetch("/api/clients/import", {
        method: "POST",
        headers: {
          ...(csrf ? { "x-csrf-token": csrf } : {})
        },
        body: form
      });

      const body = (await res.json().catch(() => null)) as
        | { error?: string; totalRows?: number; createdCount?: number; errorCount?: number; errors?: Array<{ row: number; error: string }> }
        | null;

      if (!res.ok) {
        throw new Error(body?.error || "CSV import failed");
      }

      setResult(`Imported ${body?.createdCount || 0}/${body?.totalRows || 0} rows.`);
      if ((body?.errorCount || 0) > 0 && body?.errors?.length) {
        setError(`Some rows failed. First error: row ${body.errors[0].row} - ${body.errors[0].error}`);
      } else {
        window.location.reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSV import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Clients</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-2 md:grid-cols-3">
          <Input placeholder="Client name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Primary domain" value={primaryDomain} onChange={(e) => setPrimaryDomain(e.target.value)} />
          <Input placeholder="Legal name (optional)" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          <select className="rounded-xl border border-border px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="LEAD">LEAD</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="ON_HOLD">ON_HOLD</option>
            <option value="PAST">PAST</option>
          </select>
          <Input placeholder="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
          <Input placeholder="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </div>
        <Button type="button" disabled={creating || !name.trim() || !primaryDomain.trim()} onClick={createClient}>
          {creating ? "Creating..." : "Create Client"}
        </Button>

        <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
          <p className="text-xs text-muted-foreground">
            CSV import headers: <code>name,primaryDomain,legalName,status,tags,timezone,xeroContactId,trelloBoardId,trelloListId,ownerUserId,ownerEmail</code>
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={importing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importCsv(file);
            }}
          />
          <p className="text-xs text-muted-foreground">Use <code>|</code> or <code>;</code> between tags inside the tags field.</p>
        </div>

        {result && <p className="text-xs text-emerald-600">{result}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
