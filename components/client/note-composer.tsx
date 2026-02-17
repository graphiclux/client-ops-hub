"use client";

import { useRef, useState } from "react";
import { getCsrfTokenFromCookie } from "@/lib/security/csrf-client";
import { Button } from "@/components/ui/button";

type Props = {
  clientId: string;
  canEdit: boolean;
};

export function NoteComposer({ clientId, canEdit }: Props) {
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [type, setType] = useState("TASK");
  const [visibility, setVisibility] = useState("TEAM");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function onSubmit() {
    if (!canEdit || !bodyMarkdown.trim()) return;

    setSubmitting(true);
    setError(null);
    setStatus(null);
    try {
      const csrf = getCsrfTokenFromCookie();
      const noteRes = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(csrf ? { "x-csrf-token": csrf } : {})
        },
        body: JSON.stringify({
          clientId,
          type,
          visibility,
          bodyMarkdown: bodyMarkdown.trim()
        })
      });

      const noteBody = (await noteRes.json().catch(() => null)) as { error?: string; note?: { id: string } } | null;
      if (!noteRes.ok || !noteBody?.note?.id) {
        setError(noteBody?.error || "Failed to create note");
        return;
      }

      const files = Array.from(fileInputRef.current?.files || []);
      for (const file of files) {
        const form = new FormData();
        form.set("clientId", clientId);
        form.set("noteId", noteBody.note.id);
        form.set("file", file);

        const uploadRes = await fetch("/api/attachments", {
          method: "POST",
          body: form
        });

        if (!uploadRes.ok) {
          const uploadBody = (await uploadRes.json().catch(() => null)) as { error?: string } | null;
          setError(uploadBody?.error || "Note created but attachment upload failed");
          return;
        }
      }

      setStatus("Note saved. Refreshing timeline...");
      window.location.reload();
    } catch {
      setError("Failed to create note");
    } finally {
      setSubmitting(false);
    }
  }

  if (!canEdit) {
    return <p className="text-sm text-muted-foreground">Read-only access. You can view notes but cannot create new ones.</p>;
  }

  return (
    <div className="space-y-2 rounded-2xl border border-border/70 bg-background/70 p-3">
      <textarea
        name="bodyMarkdown"
        value={bodyMarkdown}
        onChange={(e) => setBodyMarkdown(e.target.value)}
        required
        className="min-h-24 w-full rounded-2xl border border-border p-3"
        placeholder="Add note (Markdown supported)"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <select className="rounded-2xl border border-border px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="CALL">CALL</option>
          <option value="EMAIL">EMAIL</option>
          <option value="DECISION">DECISION</option>
          <option value="ISSUE">ISSUE</option>
          <option value="CHANGE">CHANGE</option>
          <option value="TASK">TASK</option>
        </select>
        <select className="rounded-2xl border border-border px-3 py-2 text-sm" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          <option value="TEAM">TEAM</option>
          <option value="PRIVATE">PRIVATE</option>
        </select>
      </div>
      <div className="space-y-1">
        <input ref={fileInputRef} type="file" multiple className="block w-full text-sm" />
        <p className="text-xs text-muted-foreground">Optional: attach screenshots/files for operational context.</p>
      </div>
      <Button
        type="button"
        onClick={onSubmit}
        disabled={submitting || !bodyMarkdown.trim()}
      >
        {submitting ? "Saving..." : "Add Note"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {status && <p className="text-xs text-emerald-600">{status}</p>}
    </div>
  );
}
