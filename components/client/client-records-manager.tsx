"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCsrfTokenFromCookie } from "@/lib/security/csrf-client";

type ContactItem = {
  id: string;
  name: string;
  roleTitle: string;
  email?: string | null;
  createdAt: string | Date;
};

type SystemItem = {
  id: string;
  type: string;
  label: string;
  adminUrl?: string | null;
  usernameHint?: string | null;
  vaultItemRef?: string | null;
  mfaStatus: string;
  updatedAt: string | Date;
};

type EngagementItem = {
  id: string;
  title: string;
  type: string;
  stage: string;
  trelloCardUrl?: string | null;
  updatedAt: string | Date;
};

type Props = {
  clientId: string;
  canEdit: boolean;
  initialContacts: ContactItem[];
  hasMoreContactsInitial: boolean;
  initialSystems: SystemItem[];
  hasMoreSystemsInitial: boolean;
  initialEngagements: EngagementItem[];
  hasMoreEngagementsInitial: boolean;
};

async function jsonRequest(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<Record<string, unknown>> {
  const csrf = getCsrfTokenFromCookie();
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  if (csrf) {
    headers["x-csrf-token"] = csrf;
  }

  const res = await fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    throw new Error((data?.error as string | undefined) || "Request failed");
  }
  return data || {};
}

export function ClientRecordsManager({
  clientId,
  canEdit,
  initialContacts,
  hasMoreContactsInitial,
  initialSystems,
  hasMoreSystemsInitial,
  initialEngagements,
  hasMoreEngagementsInitial
}: Props) {
  const [contacts, setContacts] = useState(initialContacts);
  const [hasMoreContacts, setHasMoreContacts] = useState(hasMoreContactsInitial);
  const [loadingMoreContacts, setLoadingMoreContacts] = useState(false);
  const [systems, setSystems] = useState(initialSystems);
  const [hasMoreSystems, setHasMoreSystems] = useState(hasMoreSystemsInitial);
  const [loadingMoreSystems, setLoadingMoreSystems] = useState(false);
  const [engagements, setEngagements] = useState(initialEngagements);
  const [hasMoreEngagements, setHasMoreEngagements] = useState(hasMoreEngagementsInitial);
  const [loadingMoreEngagements, setLoadingMoreEngagements] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editingSystemId, setEditingSystemId] = useState<string | null>(null);
  const [editingEngagementId, setEditingEngagementId] = useState<string | null>(null);
  const [contactEdit, setContactEdit] = useState<{ name: string; roleTitle: string; email: string }>({ name: "", roleTitle: "", email: "" });
  const [systemEdit, setSystemEdit] = useState<{ type: string; label: string; adminUrl: string; usernameHint: string; vaultItemRef: string; mfaStatus: string }>({
    type: "WORDPRESS",
    label: "",
    adminUrl: "",
    usernameHint: "",
    vaultItemRef: "",
    mfaStatus: "UNKNOWN"
  });
  const [engagementEdit, setEngagementEdit] = useState<{ title: string; type: string; stage: string }>({
    title: "",
    type: "PROJECT",
    stage: "INTAKE"
  });

  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const [systemType, setSystemType] = useState("WORDPRESS");
  const [systemLabel, setSystemLabel] = useState("");
  const [systemAdminUrl, setSystemAdminUrl] = useState("");
  const [systemUsernameHint, setSystemUsernameHint] = useState("");
  const [systemVaultRef, setSystemVaultRef] = useState("");
  const [systemMfa, setSystemMfa] = useState("UNKNOWN");

  const [engagementTitle, setEngagementTitle] = useState("");
  const [engagementType, setEngagementType] = useState("PROJECT");
  const [engagementStage, setEngagementStage] = useState("INTAKE");

  const sortedEngagements = useMemo(
    () =>
      [...engagements].sort((a, b) => {
        const rank = { INTAKE: 0, PROPOSAL: 1, ACTIVE: 2, WAITING: 3, DONE: 4 } as Record<string, number>;
        return (rank[a.stage] ?? 99) - (rank[b.stage] ?? 99);
      }),
    [engagements]
  );

  async function addContact() {
    if (!contactName.trim() || !contactRole.trim()) return;
    setError(null);
    setSuccess(null);
    setBusyAction("contact:create");
    try {
      const result = await jsonRequest("/api/contacts", "POST", {
        clientId,
        name: contactName.trim(),
        roleTitle: contactRole.trim(),
        email: contactEmail.trim() || null
      });
      const contact = result.contact as ContactItem;
      setContacts((prev) => [contact, ...prev]);
      setContactName("");
      setContactRole("");
      setContactEmail("");
      setSuccess("Contact added.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add contact");
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteContact(id: string) {
    setError(null);
    setSuccess(null);
    setBusyAction(`contact:delete:${id}`);
    try {
      await jsonRequest(`/api/contacts?id=${encodeURIComponent(id)}`, "DELETE");
      setContacts((prev) => prev.filter((item) => item.id !== id));
      setSuccess("Contact removed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete contact");
    } finally {
      setBusyAction(null);
    }
  }

  async function loadMoreContacts() {
    if (!hasMoreContacts || loadingMoreContacts || contacts.length === 0) return;
    const last = contacts[contacts.length - 1];
    const before = new Date(last.createdAt).toISOString();

    setLoadingMoreContacts(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/contacts?clientId=${encodeURIComponent(clientId)}&take=10&before=${encodeURIComponent(before)}&beforeId=${encodeURIComponent(last.id)}`
      );
      const body = (await res.json().catch(() => null)) as { error?: string; contacts?: ContactItem[]; hasMore?: boolean } | null;
      if (!res.ok) throw new Error(body?.error || "Failed to load contacts");

      setContacts((prev) => [...prev, ...(body?.contacts || [])]);
      setHasMoreContacts(Boolean(body?.hasMore));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load contacts");
    } finally {
      setLoadingMoreContacts(false);
    }
  }

  function startEditContact(contact: ContactItem) {
    setEditingContactId(contact.id);
    setContactEdit({
      name: contact.name || "",
      roleTitle: contact.roleTitle || "",
      email: contact.email || ""
    });
    setError(null);
    setSuccess(null);
  }

  async function saveContact(id: string) {
    if (!contactEdit.name.trim() || !contactEdit.roleTitle.trim()) return;
    setBusyAction(`contact:save:${id}`);
    setError(null);
    setSuccess(null);

    try {
      const result = await jsonRequest("/api/contacts", "PATCH", {
        id,
        name: contactEdit.name.trim(),
        roleTitle: contactEdit.roleTitle.trim(),
        email: contactEdit.email.trim() || null
      });
      const updated = result.contact as ContactItem;
      setContacts((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)));
      setEditingContactId(null);
      setSuccess("Contact updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update contact");
    } finally {
      setBusyAction(null);
    }
  }

  async function addSystem() {
    if (!systemLabel.trim()) return;
    setError(null);
    setSuccess(null);
    setBusyAction("system:create");
    try {
      const result = await jsonRequest("/api/systems", "POST", {
        clientId,
        type: systemType,
        label: systemLabel.trim(),
        adminUrl: systemAdminUrl.trim() || null,
        usernameHint: systemUsernameHint.trim() || null,
        vaultItemRef: systemVaultRef.trim() || null,
        mfaStatus: systemMfa
      });
      const system = result.system as SystemItem;
      setSystems((prev) => [system, ...prev]);
      setSystemLabel("");
      setSystemAdminUrl("");
      setSystemUsernameHint("");
      setSystemVaultRef("");
      setSystemMfa("UNKNOWN");
      setSuccess("System added.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add system");
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteSystem(id: string) {
    setError(null);
    setSuccess(null);
    setBusyAction(`system:delete:${id}`);
    try {
      await jsonRequest(`/api/systems?id=${encodeURIComponent(id)}`, "DELETE");
      setSystems((prev) => prev.filter((item) => item.id !== id));
      setSuccess("System removed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete system");
    } finally {
      setBusyAction(null);
    }
  }

  async function loadMoreSystems() {
    if (!hasMoreSystems || loadingMoreSystems || systems.length === 0) return;
    const last = systems[systems.length - 1];
    const before = new Date(last.updatedAt).toISOString();

    setLoadingMoreSystems(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/systems?clientId=${encodeURIComponent(clientId)}&take=10&before=${encodeURIComponent(before)}&beforeId=${encodeURIComponent(last.id)}`
      );
      const body = (await res.json().catch(() => null)) as { error?: string; systems?: SystemItem[]; hasMore?: boolean } | null;
      if (!res.ok) throw new Error(body?.error || "Failed to load systems");

      setSystems((prev) => [...prev, ...(body?.systems || [])]);
      setHasMoreSystems(Boolean(body?.hasMore));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load systems");
    } finally {
      setLoadingMoreSystems(false);
    }
  }

  function startEditSystem(system: SystemItem) {
    setEditingSystemId(system.id);
    setSystemEdit({
      type: system.type || "WORDPRESS",
      label: system.label || "",
      adminUrl: system.adminUrl || "",
      usernameHint: system.usernameHint || "",
      vaultItemRef: system.vaultItemRef || "",
      mfaStatus: system.mfaStatus || "UNKNOWN"
    });
    setError(null);
    setSuccess(null);
  }

  async function saveSystem(id: string) {
    if (!systemEdit.label.trim()) return;
    setBusyAction(`system:save:${id}`);
    setError(null);
    setSuccess(null);

    try {
      const result = await jsonRequest("/api/systems", "PATCH", {
        id,
        type: systemEdit.type,
        label: systemEdit.label.trim(),
        adminUrl: systemEdit.adminUrl.trim() || null,
        usernameHint: systemEdit.usernameHint.trim() || null,
        vaultItemRef: systemEdit.vaultItemRef.trim() || null,
        mfaStatus: systemEdit.mfaStatus
      });
      const updated = result.system as SystemItem;
      setSystems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)));
      setEditingSystemId(null);
      setSuccess("System updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update system");
    } finally {
      setBusyAction(null);
    }
  }

  async function updateSystemMfa(id: string, mfaStatus: string) {
    setError(null);
    setSuccess(null);
    setBusyAction(`system:mfa:${id}`);
    try {
      await jsonRequest("/api/systems", "PATCH", { id, mfaStatus });
      setSystems((prev) => prev.map((item) => (item.id === id ? { ...item, mfaStatus } : item)));
      setSuccess("System MFA status updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update system");
    } finally {
      setBusyAction(null);
    }
  }

  async function addEngagement() {
    if (!engagementTitle.trim()) return;
    setError(null);
    setSuccess(null);
    setBusyAction("engagement:create");
    try {
      const result = await jsonRequest("/api/engagements", "POST", {
        clientId,
        title: engagementTitle.trim(),
        type: engagementType,
        stage: engagementStage
      });
      const engagement = result.engagement as EngagementItem;
      setEngagements((prev) => [engagement, ...prev]);
      setEngagementTitle("");
      setEngagementType("PROJECT");
      setEngagementStage("INTAKE");
      setSuccess("Engagement added.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add engagement");
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteEngagement(id: string) {
    setError(null);
    setSuccess(null);
    setBusyAction(`engagement:delete:${id}`);
    try {
      await jsonRequest(`/api/engagements?id=${encodeURIComponent(id)}`, "DELETE");
      setEngagements((prev) => prev.filter((item) => item.id !== id));
      setSuccess("Engagement removed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete engagement");
    } finally {
      setBusyAction(null);
    }
  }

  async function loadMoreEngagements() {
    if (!hasMoreEngagements || loadingMoreEngagements || engagements.length === 0) return;
    const last = engagements[engagements.length - 1];
    const before = new Date(last.updatedAt).toISOString();

    setLoadingMoreEngagements(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/engagements?clientId=${encodeURIComponent(clientId)}&take=10&before=${encodeURIComponent(before)}&beforeId=${encodeURIComponent(last.id)}`
      );
      const body = (await res.json().catch(() => null)) as { error?: string; engagements?: EngagementItem[]; hasMore?: boolean } | null;
      if (!res.ok) throw new Error(body?.error || "Failed to load engagements");

      setEngagements((prev) => [...prev, ...(body?.engagements || [])]);
      setHasMoreEngagements(Boolean(body?.hasMore));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load engagements");
    } finally {
      setLoadingMoreEngagements(false);
    }
  }

  async function updateEngagementStage(id: string, stage: string) {
    setError(null);
    setSuccess(null);
    setBusyAction(`engagement:stage:${id}`);
    try {
      await jsonRequest("/api/engagements", "PATCH", { id, stage });
      setEngagements((prev) => prev.map((item) => (item.id === id ? { ...item, stage } : item)));
      setSuccess("Engagement stage updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update engagement");
    } finally {
      setBusyAction(null);
    }
  }

  function startEditEngagement(engagement: EngagementItem) {
    setEditingEngagementId(engagement.id);
    setEngagementEdit({
      title: engagement.title || "",
      type: engagement.type || "PROJECT",
      stage: engagement.stage || "INTAKE"
    });
    setError(null);
    setSuccess(null);
  }

  async function saveEngagement(id: string) {
    if (!engagementEdit.title.trim()) return;
    setBusyAction(`engagement:save:${id}`);
    setError(null);
    setSuccess(null);

    try {
      const result = await jsonRequest("/api/engagements", "PATCH", {
        id,
        title: engagementEdit.title.trim(),
        type: engagementEdit.type,
        stage: engagementEdit.stage
      });
      const updated = result.engagement as EngagementItem;
      setEngagements((prev) => prev.map((item) => (item.id === id ? { ...item, ...updated } : item)));
      setEditingEngagementId(null);
      setSuccess("Engagement updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update engagement");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">Primary people and communication owners.</p>
          {contacts.length === 0 && <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">No contacts yet.</p>}
          {contacts.map((contact) => (
            <div key={contact.id} className="flex items-center justify-between rounded-xl border border-border p-3">
              {editingContactId === contact.id ? (
                <div className="grid w-full gap-2 sm:grid-cols-3">
                  <Input value={contactEdit.name} onChange={(e) => setContactEdit((prev) => ({ ...prev, name: e.target.value }))} placeholder="Name" />
                  <Input value={contactEdit.roleTitle} onChange={(e) => setContactEdit((prev) => ({ ...prev, roleTitle: e.target.value }))} placeholder="Role title" />
                  <Input value={contactEdit.email} onChange={(e) => setContactEdit((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" />
                </div>
              ) : (
                <div>
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-muted-foreground">{contact.roleTitle}</p>
                  {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                </div>
              )}
              {canEdit && (
                <div className="ml-3 flex items-center gap-2">
                  {editingContactId === contact.id ? (
                    <>
                      <Button type="button" size="sm" disabled={busyAction !== null || !contactEdit.name.trim() || !contactEdit.roleTitle.trim()} onClick={() => saveContact(contact.id)}>
                        {busyAction === `contact:save:${contact.id}` ? "Saving..." : "Save"}
                      </Button>
                      <Button type="button" size="sm" variant="secondary" disabled={busyAction !== null} onClick={() => setEditingContactId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button type="button" size="sm" variant="secondary" disabled={busyAction !== null} onClick={() => startEditContact(contact)}>
                        Edit
                      </Button>
                      <Button type="button" size="sm" variant="destructive" disabled={busyAction !== null} onClick={() => deleteContact(contact.id)}>
                        {busyAction === `contact:delete:${contact.id}` ? "Removing..." : "Delete"}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {canEdit && (
            <div className="grid gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-2">
              <Input placeholder="Name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
              <Input placeholder="Role title" value={contactRole} onChange={(e) => setContactRole(e.target.value)} />
              <Input placeholder="Email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              <Button type="button" disabled={busyAction !== null || !contactName.trim() || !contactRole.trim()} onClick={addContact}>
                {busyAction === "contact:create" ? "Adding..." : "Add Contact"}
              </Button>
            </div>
          )}
          {hasMoreContacts && (
            <Button type="button" variant="secondary" disabled={loadingMoreContacts} onClick={loadMoreContacts}>
              {loadingMoreContacts ? "Loading..." : "Load More Contacts"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Systems</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">Infrastructure, platforms, admin links, and MFA posture.</p>
          {systems.length === 0 && <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">No systems yet.</p>}
          {systems.map((system) => (
            <div key={system.id} className="space-y-2 rounded-xl border border-border p-3">
              {editingSystemId === system.id ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <select className="rounded-xl border border-border px-3 py-2 text-sm" value={systemEdit.type} onChange={(e) => setSystemEdit((prev) => ({ ...prev, type: e.target.value }))}>
                    <option value="WORDPRESS">WORDPRESS</option>
                    <option value="WOOCOMMERCE">WOOCOMMERCE</option>
                    <option value="SHOPIFY">SHOPIFY</option>
                    <option value="CLOUDFLARE">CLOUDFLARE</option>
                    <option value="DNS">DNS</option>
                    <option value="HOSTING">HOSTING</option>
                    <option value="EMAIL">EMAIL</option>
                    <option value="AWS">AWS</option>
                    <option value="GRIDPANE">GRIDPANE</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                  <Input value={systemEdit.label} onChange={(e) => setSystemEdit((prev) => ({ ...prev, label: e.target.value }))} placeholder="Label" />
                  <Input value={systemEdit.adminUrl} onChange={(e) => setSystemEdit((prev) => ({ ...prev, adminUrl: e.target.value }))} placeholder="Admin URL" />
                  <Input value={systemEdit.usernameHint} onChange={(e) => setSystemEdit((prev) => ({ ...prev, usernameHint: e.target.value }))} placeholder="Username hint" />
                  <Input value={systemEdit.vaultItemRef} onChange={(e) => setSystemEdit((prev) => ({ ...prev, vaultItemRef: e.target.value }))} placeholder="Vault reference URL" />
                  <select className="rounded-xl border border-border px-3 py-2 text-sm" value={systemEdit.mfaStatus} onChange={(e) => setSystemEdit((prev) => ({ ...prev, mfaStatus: e.target.value }))}>
                    <option value="ENABLED">ENABLED</option>
                    <option value="DISABLED">DISABLED</option>
                    <option value="UNKNOWN">UNKNOWN</option>
                  </select>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{system.label}</p>
                      <p className="text-xs text-muted-foreground">{system.type}</p>
                    </div>
                    <Badge>{system.mfaStatus}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {system.adminUrl && (
                      <a href={system.adminUrl} target="_blank" className="text-xs text-primary hover:underline">
                        Admin URL
                      </a>
                    )}
                    {system.vaultItemRef && (
                      <a href={system.vaultItemRef} target="_blank" className="text-xs text-primary hover:underline">
                        Open Vault
                      </a>
                    )}
                  </div>
                </>
              )}
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  {editingSystemId === system.id ? (
                    <>
                      <Button type="button" size="sm" disabled={busyAction !== null || !systemEdit.label.trim()} onClick={() => saveSystem(system.id)}>
                        {busyAction === `system:save:${system.id}` ? "Saving..." : "Save"}
                      </Button>
                      <Button type="button" size="sm" variant="secondary" disabled={busyAction !== null} onClick={() => setEditingSystemId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button type="button" size="sm" variant="secondary" disabled={busyAction !== null} onClick={() => startEditSystem(system)}>
                        Edit
                      </Button>
                      <select className="rounded-xl border border-border px-2 py-1 text-xs" value={system.mfaStatus} disabled={busyAction !== null} onChange={(e) => updateSystemMfa(system.id, e.target.value)}>
                        <option value="ENABLED">ENABLED</option>
                        <option value="DISABLED">DISABLED</option>
                        <option value="UNKNOWN">UNKNOWN</option>
                      </select>
                      <Button type="button" size="sm" variant="destructive" disabled={busyAction !== null} onClick={() => deleteSystem(system.id)}>
                        {busyAction === `system:delete:${system.id}` ? "Removing..." : "Delete"}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {canEdit && (
            <div className="grid gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-2">
              <select className="rounded-xl border border-border px-3 py-2 text-sm" disabled={busyAction !== null} value={systemType} onChange={(e) => setSystemType(e.target.value)}>
                <option value="WORDPRESS">WORDPRESS</option>
                <option value="WOOCOMMERCE">WOOCOMMERCE</option>
                <option value="SHOPIFY">SHOPIFY</option>
                <option value="CLOUDFLARE">CLOUDFLARE</option>
                <option value="DNS">DNS</option>
                <option value="HOSTING">HOSTING</option>
                <option value="EMAIL">EMAIL</option>
                <option value="AWS">AWS</option>
                <option value="GRIDPANE">GRIDPANE</option>
                <option value="OTHER">OTHER</option>
              </select>
              <Input placeholder="Label" value={systemLabel} onChange={(e) => setSystemLabel(e.target.value)} />
              <Input placeholder="Admin URL (https://...)" value={systemAdminUrl} onChange={(e) => setSystemAdminUrl(e.target.value)} />
              <Input placeholder="Username hint" value={systemUsernameHint} onChange={(e) => setSystemUsernameHint(e.target.value)} />
              <Input placeholder="Vault item reference URL" value={systemVaultRef} onChange={(e) => setSystemVaultRef(e.target.value)} />
              <select className="rounded-xl border border-border px-3 py-2 text-sm" disabled={busyAction !== null} value={systemMfa} onChange={(e) => setSystemMfa(e.target.value)}>
                <option value="ENABLED">ENABLED</option>
                <option value="DISABLED">DISABLED</option>
                <option value="UNKNOWN">UNKNOWN</option>
              </select>
              <Button type="button" disabled={busyAction !== null || !systemLabel.trim()} onClick={addSystem}>
                {busyAction === "system:create" ? "Adding..." : "Add System"}
              </Button>
            </div>
          )}
          {hasMoreSystems && (
            <Button type="button" variant="secondary" disabled={loadingMoreSystems} onClick={loadMoreSystems}>
              {loadingMoreSystems ? "Loading..." : "Load More Systems"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Engagements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">Current work streams and lifecycle stage.</p>
          {engagements.length === 0 && <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">No engagements yet.</p>}
          {sortedEngagements.map((engagement) => (
            <div key={engagement.id} className="space-y-2 rounded-xl border border-border p-3">
              {editingEngagementId === engagement.id ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input value={engagementEdit.title} onChange={(e) => setEngagementEdit((prev) => ({ ...prev, title: e.target.value }))} placeholder="Engagement title" />
                  <select className="rounded-xl border border-border px-3 py-2 text-sm" value={engagementEdit.type} onChange={(e) => setEngagementEdit((prev) => ({ ...prev, type: e.target.value }))}>
                    <option value="RETAINER">RETAINER</option>
                    <option value="PROJECT">PROJECT</option>
                    <option value="EMERGENCY">EMERGENCY</option>
                    <option value="AUDIT">AUDIT</option>
                  </select>
                  <select className="rounded-xl border border-border px-3 py-2 text-sm" value={engagementEdit.stage} onChange={(e) => setEngagementEdit((prev) => ({ ...prev, stage: e.target.value }))}>
                    <option value="INTAKE">INTAKE</option>
                    <option value="PROPOSAL">PROPOSAL</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="WAITING">WAITING</option>
                    <option value="DONE">DONE</option>
                  </select>
                </div>
              ) : (
                <>
                  <p className="font-medium">{engagement.title}</p>
                  <div className="flex items-center gap-2">
                    <Badge>{engagement.type}</Badge>
                    <Badge>{engagement.stage}</Badge>
                    {engagement.trelloCardUrl && (
                      <a href={engagement.trelloCardUrl} target="_blank" className="text-xs text-primary hover:underline">
                        Trello Card
                      </a>
                    )}
                  </div>
                </>
              )}
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  {editingEngagementId === engagement.id ? (
                    <>
                      <Button type="button" size="sm" disabled={busyAction !== null || !engagementEdit.title.trim()} onClick={() => saveEngagement(engagement.id)}>
                        {busyAction === `engagement:save:${engagement.id}` ? "Saving..." : "Save"}
                      </Button>
                      <Button type="button" size="sm" variant="secondary" disabled={busyAction !== null} onClick={() => setEditingEngagementId(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button type="button" size="sm" variant="secondary" disabled={busyAction !== null} onClick={() => startEditEngagement(engagement)}>
                        Edit
                      </Button>
                      <select className="rounded-xl border border-border px-2 py-1 text-xs" disabled={busyAction !== null} value={engagement.stage} onChange={(e) => updateEngagementStage(engagement.id, e.target.value)}>
                        <option value="INTAKE">INTAKE</option>
                        <option value="PROPOSAL">PROPOSAL</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="WAITING">WAITING</option>
                        <option value="DONE">DONE</option>
                      </select>
                      <Button type="button" size="sm" variant="destructive" disabled={busyAction !== null} onClick={() => deleteEngagement(engagement.id)}>
                        {busyAction === `engagement:delete:${engagement.id}` ? "Removing..." : "Delete"}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {canEdit && (
            <div className="grid gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-2">
              <Input placeholder="Engagement title" value={engagementTitle} onChange={(e) => setEngagementTitle(e.target.value)} />
              <select className="rounded-xl border border-border px-3 py-2 text-sm" disabled={busyAction !== null} value={engagementType} onChange={(e) => setEngagementType(e.target.value)}>
                <option value="RETAINER">RETAINER</option>
                <option value="PROJECT">PROJECT</option>
                <option value="EMERGENCY">EMERGENCY</option>
                <option value="AUDIT">AUDIT</option>
              </select>
              <select className="rounded-xl border border-border px-3 py-2 text-sm" disabled={busyAction !== null} value={engagementStage} onChange={(e) => setEngagementStage(e.target.value)}>
                <option value="INTAKE">INTAKE</option>
                <option value="PROPOSAL">PROPOSAL</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="WAITING">WAITING</option>
                <option value="DONE">DONE</option>
              </select>
              <Button type="button" disabled={busyAction !== null || !engagementTitle.trim()} onClick={addEngagement}>
                {busyAction === "engagement:create" ? "Adding..." : "Add Engagement"}
              </Button>
            </div>
          )}
          {hasMoreEngagements && (
            <Button type="button" variant="secondary" disabled={loadingMoreEngagements} onClick={loadMoreEngagements}>
              {loadingMoreEngagements ? "Loading..." : "Load More Engagements"}
            </Button>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {success && <p className="text-xs text-emerald-600">{success}</p>}
    </div>
  );
}
