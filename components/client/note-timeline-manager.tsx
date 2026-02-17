"use client";

import { useState } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCsrfTokenFromCookie } from "@/lib/security/csrf-client";

type AttachmentItem = {
  id: string;
  filename: string;
  mimeType: string;
};

type NoteItem = {
  id: string;
  type: string;
  visibility: string;
  bodyMarkdown: string;
  createdAt: string | Date;
  createdBy: { name: string | null; email: string };
  attachments: AttachmentItem[];
};

type Props = {
  clientId: string;
  initialNotes: NoteItem[];
  hasMoreInitial: boolean;
  canEdit: boolean;
};

function extractMentions(bodyMarkdown: string) {
  const matches = bodyMarkdown.match(/@[a-zA-Z0-9_.-]+/g) || [];
  return Array.from(new Set(matches.map((item) => item.toLowerCase()))).slice(0, 8);
}

async function jsonRequest(url: string, method: "PATCH" | "DELETE", body?: unknown) {
  const csrf = getCsrfTokenFromCookie();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (csrf) headers["x-csrf-token"] = csrf;

  const res = await fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });

  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(data?.error || "Request failed");
}

export function NoteTimelineManager({ clientId, initialNotes, hasMoreInitial, canEdit }: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [hasMore, setHasMore] = useState(hasMoreInitial);
  const [loadingMore, setLoadingMore] = useState(false);
  const [renderLimit, setRenderLimit] = useState(20);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editType, setEditType] = useState("TASK");
  const [editVisibility, setEditVisibility] = useState("TEAM");
  const [editBody, setEditBody] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadMore() {
    if (!hasMore || loadingMore || notes.length === 0) return;
    const last = notes[notes.length - 1];
    const before = new Date(last.createdAt).toISOString();

    setLoadingMore(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/notes?clientId=${encodeURIComponent(clientId)}&take=10&before=${encodeURIComponent(before)}&beforeId=${encodeURIComponent(last.id)}`
      );
      const body = (await res.json().catch(() => null)) as { error?: string; notes?: NoteItem[]; hasMore?: boolean } | null;
      if (!res.ok) throw new Error(body?.error || "Failed to load notes");

      const incoming = body?.notes || [];
      setNotes((prev) => [...prev, ...incoming]);
      setHasMore(Boolean(body?.hasMore));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notes");
    } finally {
      setLoadingMore(false);
    }
  }

  function startEdit(note: NoteItem) {
    setEditingNoteId(note.id);
    setEditType(note.type);
    setEditVisibility(note.visibility);
    setEditBody(note.bodyMarkdown);
    setError(null);
    setSuccess(null);
  }

  async function saveNote(noteId: string) {
    if (!editBody.trim()) return;
    setBusy(`note:save:${noteId}`);
    setError(null);
    setSuccess(null);
    try {
      await jsonRequest("/api/notes", "PATCH", {
        id: noteId,
        type: editType,
        visibility: editVisibility,
        bodyMarkdown: editBody.trim()
      });

      setNotes((prev) =>
        prev.map((note) =>
          note.id === noteId
            ? {
                ...note,
                type: editType,
                visibility: editVisibility,
                bodyMarkdown: editBody.trim()
              }
            : note
        )
      );
      setEditingNoteId(null);
      setSuccess("Note updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update note");
    } finally {
      setBusy(null);
    }
  }

  async function deleteNote(noteId: string) {
    setBusy(`note:delete:${noteId}`);
    setError(null);
    setSuccess(null);
    try {
      await jsonRequest(`/api/notes?id=${encodeURIComponent(noteId)}`, "DELETE");
      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      setSuccess("Note deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete note");
    } finally {
      setBusy(null);
    }
  }

  async function deleteAttachment(noteId: string, attachmentId: string) {
    setBusy(`attachment:delete:${attachmentId}`);
    setError(null);
    setSuccess(null);
    try {
      await jsonRequest(`/api/attachments/${encodeURIComponent(attachmentId)}`, "DELETE");
      setNotes((prev) =>
        prev.map((note) =>
          note.id === noteId
            ? {
                ...note,
                attachments: note.attachments.filter((attachment) => attachment.id !== attachmentId)
              }
            : note
        )
      );
      setSuccess("Attachment removed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete attachment");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {notes.slice(0, renderLimit).map((note) => {
        const mentions = extractMentions(note.bodyMarkdown);

        return (
          <article key={note.id} className="rounded-2xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{note.type}</span>
              <span>{new Date(note.createdAt).toLocaleString()}</span>
            </div>

            <p className="mb-2 text-xs text-muted-foreground">by {note.createdBy.name || note.createdBy.email}</p>

            {editingNoteId === note.id ? (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <select className="rounded-xl border border-border px-3 py-2 text-sm" value={editType} onChange={(e) => setEditType(e.target.value)}>
                    <option value="CALL">CALL</option>
                    <option value="EMAIL">EMAIL</option>
                    <option value="DECISION">DECISION</option>
                    <option value="ISSUE">ISSUE</option>
                    <option value="CHANGE">CHANGE</option>
                    <option value="TASK">TASK</option>
                  </select>
                  <select className="rounded-xl border border-border px-3 py-2 text-sm" value={editVisibility} onChange={(e) => setEditVisibility(e.target.value)}>
                    <option value="TEAM">TEAM</option>
                    <option value="PRIVATE">PRIVATE</option>
                  </select>
                </div>
                <textarea className="min-h-24 w-full rounded-xl border border-border p-3 text-sm" value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" disabled={busy !== null || !editBody.trim()} onClick={() => saveNote(note.id)}>
                    {busy === `note:save:${note.id}` ? "Saving..." : "Save"}
                  </Button>
                  <Button type="button" size="sm" variant="secondary" disabled={busy !== null} onClick={() => setEditingNoteId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {mentions.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {mentions.map((mention) => (
                      <Badge key={`${note.id}-${mention}`}>{mention}</Badge>
                    ))}
                  </div>
                )}
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{note.bodyMarkdown}</ReactMarkdown>
                </div>
              </>
            )}

            {note.attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Attachments</p>
                <div className="grid grid-cols-2 gap-2">
                  {note.attachments.map((attachment) => {
                    const href = `/api/attachments/${attachment.id}`;
                    const isImage = attachment.mimeType.startsWith("image/");

                    return (
                      <div key={attachment.id} className="space-y-1">
                        {isImage ? (
                          <a href={href} target="_blank" className="block overflow-hidden rounded-xl border border-border">
                            <Image src={href} alt={attachment.filename} width={240} height={140} loading="lazy" className="h-28 w-full object-cover" />
                          </a>
                        ) : (
                          <a href={href} target="_blank" className="block rounded-xl border border-border px-3 py-2 text-xs hover:bg-muted">
                            {attachment.filename}
                          </a>
                        )}
                        {canEdit && (
                          <Button type="button" size="sm" variant="destructive" disabled={busy !== null} onClick={() => deleteAttachment(note.id, attachment.id)}>
                            {busy === `attachment:delete:${attachment.id}` ? "Removing..." : "Remove"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {canEdit && editingNoteId !== note.id && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" disabled={busy !== null} onClick={() => startEdit(note)}>
                  Edit
                </Button>
                <Button type="button" size="sm" variant="destructive" disabled={busy !== null} onClick={() => deleteNote(note.id)}>
                  {busy === `note:delete:${note.id}` ? "Deleting..." : "Delete"}
                </Button>
              </div>
            )}
          </article>
        );
      })}

      {notes.length === 0 && <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">No timeline notes yet.</p>}
      {notes.length > renderLimit && (
        <Button type="button" variant="secondary" onClick={() => setRenderLimit((prev) => prev + 20)}>
          Show Older Loaded Notes
        </Button>
      )}
      {hasMore && (
        <Button type="button" variant="secondary" disabled={loadingMore} onClick={loadMore}>
          {loadingMore ? "Loading..." : "Load More"}
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {success && <p className="text-xs text-emerald-600">{success}</p>}
    </div>
  );
}
