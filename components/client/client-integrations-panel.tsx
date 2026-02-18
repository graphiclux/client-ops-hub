"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCsrfTokenFromCookie } from "@/lib/security/csrf-client";

type InvoiceSummary = {
  outstandingCount: number;
  outstandingTotal: number;
  lastInvoiceDate: string | null;
};

type TrelloBoard = {
  id: string;
  name: string;
  url: string | null;
  lists: Array<{ id: string; name: string }>;
};

type Props = {
  clientId: string;
  xeroContactId?: string | null;
  hasTrelloList: boolean;
  trelloBoardId?: string | null;
  trelloListId?: string | null;
  canEdit: boolean;
};

export function ClientIntegrationsPanel({
  clientId,
  xeroContactId,
  hasTrelloList,
  trelloBoardId,
  trelloListId,
  canEdit
}: Props) {
  const [shortRequest, setShortRequest] = useState("");
  const [noteExcerpt, setNoteExcerpt] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [trelloError, setTrelloError] = useState<string | null>(null);
  const [trelloInfo, setTrelloInfo] = useState<string | null>(null);
  const [creatingCard, setCreatingCard] = useState(false);

  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState(trelloBoardId || "");
  const [selectedListId, setSelectedListId] = useState(trelloListId || "");
  const [savingListTarget, setSavingListTarget] = useState(false);

  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [xeroUrl, setXeroUrl] = useState<string>("https://go.xero.com");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const canLoadXeroSummary = useMemo(() => Boolean(xeroContactId), [xeroContactId]);

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) || null,
    [boards, selectedBoardId]
  );

  const selectedBoardLists = selectedBoard?.lists || [];
  const hasConfiguredTrelloList = Boolean(selectedListId || hasTrelloList);

  useEffect(() => {
    if (!canEdit) return;

    setLoadingBoards(true);
    setTrelloError(null);

    fetch("/api/integrations/trello/lists")
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { error?: string; boards?: TrelloBoard[] } | null;
        if (!res.ok) {
          throw new Error(body?.error || "Failed to load Trello boards/lists");
        }
        return body?.boards || [];
      })
      .then((loadedBoards) => {
        setBoards(loadedBoards);

        if (!selectedBoardId && loadedBoards.length > 0) {
          const firstBoard = loadedBoards[0];
          setSelectedBoardId(firstBoard.id);
          if (!selectedListId && firstBoard.lists.length > 0) {
            setSelectedListId(firstBoard.lists[0].id);
          }
        }
      })
      .catch((error) => {
        setTrelloError(error instanceof Error ? error.message : "Failed to load Trello boards/lists");
      })
      .finally(() => {
        setLoadingBoards(false);
      });
    // Intentionally run once for initial mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

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

  async function saveTrelloTarget() {
    if (!canEdit) return;
    if (!selectedBoardId || !selectedListId) {
      setTrelloError("Select both a board and list.");
      return;
    }

    setSavingListTarget(true);
    setTrelloError(null);
    setTrelloInfo(null);

    try {
      const csrf = getCsrfTokenFromCookie();
      const res = await fetch("/api/clients", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(csrf ? { "x-csrf-token": csrf } : {})
        },
        body: JSON.stringify({
          id: clientId,
          trelloBoardId: selectedBoardId,
          trelloListId: selectedListId
        })
      });

      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setTrelloError(body?.error || "Failed to save Trello target");
        return;
      }

      setTrelloInfo("Trello board/list saved for this client.");
    } catch {
      setTrelloError("Failed to save Trello target");
    } finally {
      setSavingListTarget(false);
    }
  }

  async function handleCreateCard() {
    if (!shortRequest.trim()) {
      setTrelloError("Short request is required.");
      return;
    }

    setCreatingCard(true);
    setTrelloError(null);
    setTrelloInfo(null);
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
          {canEdit && (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <p className="text-xs text-muted-foreground">Default board/list for this client</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  className="rounded-2xl border border-border px-3 py-2 text-sm"
                  value={selectedBoardId}
                  disabled={loadingBoards || savingListTarget}
                  onChange={(event) => {
                    const nextBoardId = event.target.value;
                    setSelectedBoardId(nextBoardId);
                    const board = boards.find((item) => item.id === nextBoardId);
                    setSelectedListId(board?.lists[0]?.id || "");
                  }}
                >
                  <option value="">Select Trello board</option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.name}
                    </option>
                  ))}
                </select>

                <select
                  className="rounded-2xl border border-border px-3 py-2 text-sm"
                  value={selectedListId}
                  disabled={loadingBoards || savingListTarget || !selectedBoardId}
                  onChange={(event) => setSelectedListId(event.target.value)}
                >
                  <option value="">Select Trello list</option>
                  {selectedBoardLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="button" variant="secondary" disabled={loadingBoards || savingListTarget || !selectedBoardId || !selectedListId} onClick={saveTrelloTarget}>
                {savingListTarget ? "Saving..." : "Save Trello Target"}
              </Button>
            </div>
          )}

          {!hasConfiguredTrelloList ? (
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
                  Job queued: <a className="text-primary hover:underline" href={`/api/jobs/${jobId}`} target="_blank" rel="noreferrer">{jobId}</a>
                </p>
              )}
            </>
          )}
          {trelloInfo && <p className="text-xs text-emerald-600">{trelloInfo}</p>}
          {trelloError && <p className="text-xs text-destructive">{trelloError}</p>}
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
                  <a className="text-primary hover:underline" href={xeroUrl} target="_blank" rel="noreferrer">
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
