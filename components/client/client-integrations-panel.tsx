"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCsrfTokenFromCookie } from "@/lib/security/csrf-client";

type InvoiceSummary = {
  outstandingCount: number;
  outstandingTotal: number;
  lastInvoiceDate: string | null;
};

type Props = {
  clientId: string;
  xeroContactId?: string | null;
  hasTrelloList: boolean;
};

export function ClientIntegrationsPanel({ clientId, xeroContactId, hasTrelloList }: Props) {
  const [shortRequest, setShortRequest] = useState("");
  const [noteExcerpt, setNoteExcerpt] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [trelloError, setTrelloError] = useState<string | null>(null);
  const [creatingCard, setCreatingCard] = useState(false);

  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [xeroUrl, setXeroUrl] = useState<string>("https://go.xero.com");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const canLoadXeroSummary = useMemo(() => Boolean(xeroContactId), [xeroContactId]);

  async function handleLoadInvoiceSummary() {
    if (!canLoadXeroSummary) return;
    setLoadingSummary(true);
    setSummaryError(null);

    try {
      const res = await fetch(`/api/integrations/xero/invoice-summary?clientId=${encodeURIComponent(clientId)}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setSummaryError(body?.error || "Failed to load invoice summary");
        return;
      }

      const data = (await res.json()) as { summary: InvoiceSummary; xeroUrl: string };
      setSummary(data.summary);
      setXeroUrl(data.xeroUrl || "https://go.xero.com");
    } catch {
      setSummaryError("Failed to load invoice summary");
    } finally {
      setLoadingSummary(false);
    }
  }

  async function handleCreateCard() {
    if (!shortRequest.trim()) {
      setTrelloError("Short request is required.");
      return;
    }

    setCreatingCard(true);
    setTrelloError(null);
    setJobId(null);

    try {
      const csrf = getCsrfTokenFromCookie();
      const res = await fetch("/api/integrations/trello/create-card", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(csrf ? { "x-csrf-token": csrf } : {})
        },
        body: JSON.stringify({
          clientId,
          shortRequest: shortRequest.trim(),
          noteExcerpt: noteExcerpt.trim()
        })
      });

      const body = (await res.json().catch(() => null)) as { error?: string; jobId?: string } | null;
      if (!res.ok) {
        setTrelloError(body?.error || "Failed to queue Trello card");
        return;
      }

      setJobId(body?.jobId || null);
      setShortRequest("");
      setNoteExcerpt("");
    } catch {
      setTrelloError("Failed to queue Trello card");
    } finally {
      setCreatingCard(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Trello</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasTrelloList ? (
            <p className="text-sm text-muted-foreground">Set a default Trello list on this client to enable card creation.</p>
          ) : (
            <>
              <Input value={shortRequest} onChange={(e) => setShortRequest(e.target.value)} placeholder="Short request" />
              <textarea
                value={noteExcerpt}
                onChange={(e) => setNoteExcerpt(e.target.value)}
                placeholder="Optional note excerpt"
                className="min-h-20 w-full rounded-2xl border border-border p-3 text-sm"
              />
              <Button type="button" disabled={creatingCard} onClick={handleCreateCard}>
                {creatingCard ? "Creating..." : "Create Trello Card"}
              </Button>
              {jobId && (
                <p className="text-xs text-muted-foreground">
                  Job queued: <a className="text-primary hover:underline" href={`/api/jobs/${jobId}`} target="_blank">{jobId}</a>
                </p>
              )}
              {trelloError && <p className="text-xs text-destructive">{trelloError}</p>}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Xero Invoice Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!canLoadXeroSummary ? (
            <p className="text-muted-foreground">Link `xero_contact_id` on this client to view invoice summary.</p>
          ) : (
            <>
              <Button type="button" variant="secondary" disabled={loadingSummary} onClick={handleLoadInvoiceSummary}>
                {loadingSummary ? "Loading..." : "Load Invoice Summary"}
              </Button>

              {summary && (
                <div className="space-y-1">
                  <p>Outstanding invoices: {summary.outstandingCount}</p>
                  <p>Outstanding total: {summary.outstandingTotal.toFixed(2)}</p>
                  <p>Last invoice date: {summary.lastInvoiceDate ? new Date(summary.lastInvoiceDate).toLocaleDateString() : "-"}</p>
                  <a className="text-primary hover:underline" href={xeroUrl} target="_blank">
                    Open in Xero
                  </a>
                </div>
              )}

              {summaryError && <p className="text-xs text-destructive">{summaryError}</p>}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
