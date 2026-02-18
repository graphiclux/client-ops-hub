"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Command, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SearchResults = {
  clients: Array<{ id: string; name: string; primaryDomain: string }>;
  notes: Array<{ id: string; bodyMarkdown: string; clientId: string }>;
  systems: Array<{ id: string; label: string; adminUrl: string | null; clientId: string }>;
};

const emptyResults: SearchResults = { clients: [], notes: [], systems: [] };

const baseQuickActions = [
  { label: "Open Clients", href: "/clients" },
  { label: "Open Engagements", href: "/engagements" },
  { label: "Open Search", href: "/search" },
  { label: "Open Integrations", href: "/settings/integrations" }
];

const adminQuickActions = [
  { label: "Open Admin Users", href: "/admin/users" }
];

export function CommandBar({ canAdmin }: { canAdmin: boolean }) {
  const quickActions = useMemo(
    () => (canAdmin ? [...baseQuickActions, ...adminQuickActions] : baseQuickActions),
    [canAdmin]
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(emptyResults);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isCommandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isCommandK) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setResults(emptyResults);
      return;
    }

    const controller = new AbortController();

    fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
      signal: controller.signal
    })
      .then((res) => (res.ok ? res.json() : emptyResults))
      .then((data) => setResults(data))
      .catch(() => setResults(emptyResults));

    return () => controller.abort();
  }, [open, query]);

  const filteredActions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return quickActions;
    return quickActions.filter((action) => action.label.toLowerCase().includes(trimmed));
  }, [query, quickActions]);

  function navigate(href: string) {
    window.location.href = href;
  }

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-border bg-card/80 px-4 py-3 backdrop-blur md:flex-row md:items-center md:justify-between">
        <button
          onClick={() => setOpen(true)}
          className="relative w-full rounded-2xl border border-border bg-background py-2 pl-9 pr-20 text-left text-sm text-muted-foreground md:max-w-lg"
        >
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          Search clients, systems, notes...
          <span className="absolute right-3 top-2 rounded-md border border-border px-2 py-0.5 text-xs">⌘K</span>
        </button>
        <Button className="gap-2" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Quick Create
        </Button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/30 p-4 pt-20" onClick={() => setOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-soft" onClick={(event) => event.stopPropagation()}>
            <div className="border-b border-border p-3">
              <div className="relative">
                <Command className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Type a command or search..."
                  className="pl-9"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>

            <div className="max-h-[60vh] space-y-4 overflow-auto p-3">
              <section>
                <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick Actions</p>
                <div className="space-y-1">
                  {filteredActions.map((action) => (
                    <button
                      key={action.href}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => navigate(action.href)}
                    >
                      <span>{action.label}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </section>

              {query.trim() && (
                <section>
                  <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Search Results</p>
                  <div className="space-y-1">
                    {results.clients.map((client) => (
                      <button
                        key={`client-${client.id}`}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        <span>
                          {client.name}
                          <span className="ml-2 text-xs text-muted-foreground">{client.primaryDomain}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">Client</span>
                      </button>
                    ))}

                    {results.notes.map((note) => (
                      <button
                        key={`note-${note.id}`}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => navigate(`/clients/${note.clientId}`)}
                      >
                        <span className="truncate">{note.bodyMarkdown.slice(0, 80)}</span>
                        <span className="text-xs text-muted-foreground">Note</span>
                      </button>
                    ))}

                    {results.systems.map((system) => (
                      <button
                        key={`system-${system.id}`}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => navigate(`/clients/${system.clientId}`)}
                      >
                        <span>{system.label}</span>
                        <span className="text-xs text-muted-foreground">System</span>
                      </button>
                    ))}

                    {results.clients.length === 0 && results.notes.length === 0 && results.systems.length === 0 && (
                      <p className="rounded-xl px-3 py-2 text-sm text-muted-foreground">No matches found.</p>
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
