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
  const tagPresets = ["agency", "internal", "priority-high", "wordpress", "shopify", "maintenance"];
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

  async function importXeroContactsCsv(file: File) {
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const csrf = getCsrfTokenFromCookie();
      const form = new FormData();
      form.set("file", file);

      const res = await fetch("/api/integrations/xero/import-contacts", {
        method: "POST",
        headers: {
          ...(csrf ? { "x-csrf-token": csrf } : {})
        },
        body: form
      });

      const body = (await res.json().catch(() => null)) as
        | {
            error?: string;
            totalRows?: number;
            createdCount?: number;
            skippedCount?: number;
            errorCount?: number;
            skipped?: Array<{ row: number; reason: string }>;
            errors?: Array<{ row: number; error: string }>;
          }
        | null;

      if (!res.ok) {
        throw new Error(body?.error || "Xero import failed");
      }

      setResult(
        `Xero import complete: created ${body?.createdCount || 0}/${body?.totalRows || 0}, skipped ${body?.skippedCount || 0}, errors ${body?.errorCount || 0}.`
      );

      if ((body?.errorCount || 0) > 0 && body?.errors?.length) {
        setError(`Some rows failed. First error: row ${body.errors[0].row} - ${body.errors[0].error}`);
      } else {
        window.location.reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xero import failed");
    } finally {
      setImporting(false);
    }
  }

  function applyTagPreset(tag: string) {
    const current = tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (current.includes(tag)) return;
    setTags([...current, tag].join(", "));
  }

  function downloadTemplate() {
    const headers = [
      "name",
      "primaryDomain",
      "legalName",
      "status",
      "tags",
      "timezone",
      "xeroContactId",
      "trelloBoardId",
      "trelloListId",
      "ownerUserId",
      "ownerEmail"
    ];
    const sampleRow = [
      "Acme Marketing",
      "acme.com",
      "Acme Marketing LLC",
      "ACTIVE",
      "agency|wordpress|priority-high",
      "America/New_York",
      "",
      "",
      "",
      "",
      ""
    ];

    const csv = `${headers.join(",")}\n${sampleRow.join(",")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "client-import-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
        <div className="flex flex-wrap gap-2">
          {tagPresets.map((preset) => (
            <Button key={preset} type="button" variant="secondary" onClick={() => applyTagPreset(preset)}>
              + {preset}
            </Button>
          ))}
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
          <Button type="button" variant="secondary" onClick={downloadTemplate}>
            Download CSV Template
          </Button>
        </div>
        <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
          <p className="text-xs text-muted-foreground">
            Xero Contacts CSV import: upload the raw export with the <code>*ContactName</code> header.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={importing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importXeroContactsCsv(file);
            }}
          />
          <p className="text-xs text-muted-foreground">Creates clients as ACTIVE with <code>xero-import</code> tag.</p>
        </div>

        {result && <p className="text-xs text-emerald-600">{result}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
