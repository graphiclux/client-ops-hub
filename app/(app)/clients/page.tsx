import { auth } from "@/lib/auth/options";
import { buildClientAccessWhere } from "@/lib/auth/client-access";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function ClientsPage() {
  const session = await auth();

  const clients = await prisma.client.findMany({
    where: session?.user ? buildClientAccessWhere(session.user) : undefined,
    include: {
      owner: { select: { name: true, email: true } },
      notes: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 }
    },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Clients</h2>
        <p className="text-sm text-muted-foreground">Relationship + systems inventory</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Last Activity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id}>
              <TableCell>
                <a href={`/clients/${client.id}`} className="font-medium hover:underline">
                  {client.name}
                </a>
                <p className="text-xs text-muted-foreground">{client.primaryDomain}</p>
              </TableCell>
              <TableCell>
                <Badge>{client.status}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {client.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>{client.owner.name || client.owner.email}</TableCell>
              <TableCell>{client.notes[0]?.createdAt.toLocaleDateString() || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {clients.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No clients yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Create your first client from Quick Create.</CardContent>
        </Card>
      )}
    </div>
  );
}
