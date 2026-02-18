import { notFound } from "next/navigation";
import nextDynamic from "next/dynamic";

export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth/options";
import { canAccessClient } from "@/lib/auth/client-access";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientIntegrationsPanel } from "@/components/client/client-integrations-panel";
import { NoteComposer } from "@/components/client/note-composer";

const ClientRecordsManager = nextDynamic(
  () => import("@/components/client/client-records-manager").then((mod) => mod.ClientRecordsManager),
  {
    loading: () => <p className="text-sm text-muted-foreground">Loading records...</p>
  }
);

const NoteTimelineManager = nextDynamic(
  () => import("@/components/client/note-timeline-manager").then((mod) => mod.NoteTimelineManager),
  {
    loading: () => <p className="text-sm text-muted-foreground">Loading timeline...</p>
  }
);

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const canRead = await canAccessClient(session.user, id);
  if (!canRead) notFound();
  const canWrite = await canAccessClient(session.user, id, true);

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      owner: true,
      systems: { orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 11 },
      notes: {
        where: session.user.role === "CONTRACTOR" || session.user.role === "READONLY" ? { visibility: "TEAM" } : undefined,
        include: {
          createdBy: { select: { name: true, email: true } },
          attachments: true
        },
        orderBy: { createdAt: "desc" },
        take: 11
      },
      contacts: { take: 11, orderBy: [{ createdAt: "desc" }, { id: "desc" }] },
      engagements: { orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 11 }
    }
  });

  if (!client) {
    notFound();
  }
  const hasMoreNotes = client.notes.length > 10;
  const initialNotes = hasMoreNotes ? client.notes.slice(0, 10) : client.notes;
  const hasMoreSystems = client.systems.length > 10;
  const initialSystems = hasMoreSystems ? client.systems.slice(0, 10) : client.systems;
  const hasMoreContacts = client.contacts.length > 10;
  const initialContacts = hasMoreContacts ? client.contacts.slice(0, 10) : client.contacts;
  const hasMoreEngagements = client.engagements.length > 10;
  const initialEngagements = hasMoreEngagements ? client.engagements.slice(0, 10) : client.engagements;

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_420px]">
      <Card>
        <CardHeader>
          <CardTitle>{client.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{client.primaryDomain}</p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge>{client.status}</Badge>
            {client.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
          <p>
            <span className="font-medium">Timezone:</span> {client.timezone}
          </p>
          <p>
            <span className="font-medium">Owner:</span> {client.owner.name || client.owner.email}
          </p>
          <div className="space-y-2 pt-4">
            <a className="block rounded-xl border border-border px-3 py-2 hover:bg-muted" href={`https://${client.primaryDomain}`} target="_blank">
              Open Domain
            </a>
            {client.trelloBoardId && (
              <a className="block rounded-xl border border-border px-3 py-2 hover:bg-muted" href={`https://trello.com/b/${client.trelloBoardId}`} target="_blank">
                Open Trello Board
              </a>
            )}
            {client.xeroContactId && (
              <a className="block rounded-xl border border-border px-3 py-2 hover:bg-muted" href="https://go.xero.com" target="_blank">
                Open Xero
              </a>
            )}
          </div>
          <ClientIntegrationsPanel
            clientId={client.id}
            xeroContactId={client.xeroContactId}
            hasTrelloList={Boolean(client.trelloListId)}
            trelloBoardId={client.trelloBoardId}
            trelloListId={client.trelloListId}
            canEdit={canWrite}
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Systems</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>MFA</TableHead>
                  <TableHead>Verified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialSystems.map((system) => (
                  <TableRow key={system.id}>
                    <TableCell>{system.type}</TableCell>
                    <TableCell>
                      <p className="font-medium">{system.label}</p>
                      {system.adminUrl && (
                        <a className="text-xs text-primary hover:underline" href={system.adminUrl} target="_blank">
                          Admin URL
                        </a>
                      )}
                      {system.vaultItemRef && (
                        <a className="ml-2 text-xs text-primary hover:underline" href={system.vaultItemRef} target="_blank">
                          Open Vault
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge>{system.mfaStatus}</Badge>
                    </TableCell>
                    <TableCell>{system.lastVerifiedAt ? new Date(system.lastVerifiedAt).toLocaleDateString() : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Card className="border-dashed">
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Never store passwords here. Link credentials via Vault item reference only.
                {hasMoreSystems ? " Showing latest 10 systems; load more below." : ""}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
        <ClientRecordsManager
          clientId={client.id}
          canEdit={canWrite}
          initialContacts={initialContacts}
          hasMoreContactsInitial={hasMoreContacts}
          initialSystems={initialSystems}
          hasMoreSystemsInitial={hasMoreSystems}
          initialEngagements={initialEngagements}
          hasMoreEngagementsInitial={hasMoreEngagements}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <NoteComposer clientId={client.id} canEdit={canWrite} />
          <NoteTimelineManager clientId={client.id} initialNotes={initialNotes} hasMoreInitial={hasMoreNotes} canEdit={canWrite} />
        </CardContent>
      </Card>
    </div>
  );
}
