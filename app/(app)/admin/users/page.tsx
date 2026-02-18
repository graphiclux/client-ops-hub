import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/clients");
  }

  const [users, clients] = await Promise.all([
    prisma.user.findMany({
      include: {
        clientMemberships: {
          include: {
            client: { select: { id: true, name: true } }
          },
          orderBy: { client: { name: "asc" } }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.client.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    })
  ]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">User Management</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create User</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <form action="/api/admin/users" method="post" className="grid gap-2 md:grid-cols-5">
            <input type="hidden" name="action" value="create" />
            <input name="name" placeholder="Name" className="rounded-xl border border-border px-3 py-2" />
            <input type="email" name="email" placeholder="Email" className="rounded-xl border border-border px-3 py-2" required />
            <input type="password" name="password" placeholder="Temporary password (12+ chars)" className="rounded-xl border border-border px-3 py-2" minLength={12} required />
            <select name="role" defaultValue="READONLY" className="rounded-xl border border-border px-3 py-2" required>
              <option>ADMIN</option>
              <option>MANAGER</option>
              <option>CONTRACTOR</option>
              <option>READONLY</option>
            </select>
            <button type="submit" className="rounded-xl bg-primary px-3 py-2 text-primary-foreground">
              Create User
            </button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">Only admins can create users. Users sign in with email/password and can change their own password in Settings.</p>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {users.map((user) => (
          <Card key={user.id}>
            <CardHeader>
              <CardTitle className="text-base">{user.name || user.email}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{user.email}</span>
                <form action="/api/admin/users" method="post" className="flex items-center gap-2">
                  <input type="hidden" name="action" value="update-role" />
                  <input type="hidden" name="userId" value={user.id} />
                  <select name="role" defaultValue={user.role} className="rounded-xl border border-border px-3 py-2">
                    <option>ADMIN</option>
                    <option>MANAGER</option>
                    <option>CONTRACTOR</option>
                    <option>READONLY</option>
                  </select>
                  <button type="submit" className="rounded-xl bg-primary px-3 py-2 text-primary-foreground">
                    Save Role
                  </button>
                </form>
              </div>

              <form action="/api/admin/users" method="post" className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3">
                <input type="hidden" name="action" value="set-password" />
                <input type="hidden" name="userId" value={user.id} />
                <input type="password" name="password" placeholder="Set new password (12+ chars)" className="rounded-xl border border-border px-3 py-2" minLength={12} required />
                <button type="submit" className="rounded-xl bg-secondary px-3 py-2 text-secondary-foreground">
                  Set Password
                </button>
              </form>

              {user.role === "CONTRACTOR" && (
                <div className="space-y-2 rounded-xl border border-border p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Client Access</p>

                  <form action="/api/admin/client-access" method="post" className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="action" value="grant" />
                    <select name="clientId" className="rounded-xl border border-border px-3 py-2" required>
                      <option value="">Select client</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                    <select name="permission" defaultValue="VIEW" className="rounded-xl border border-border px-3 py-2" required>
                      <option value="VIEW">VIEW</option>
                      <option value="EDIT">EDIT</option>
                    </select>
                    <button type="submit" className="rounded-xl bg-primary px-3 py-2 text-primary-foreground">
                      Grant
                    </button>
                  </form>

                  <div className="space-y-2">
                    {user.clientMemberships.length === 0 && <p className="text-xs text-muted-foreground">No client access assigned.</p>}
                    {user.clientMemberships.map((membership) => (
                      <div key={membership.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                        <span>
                          {membership.client.name} - <strong>{membership.permission}</strong>
                        </span>
                        <form action="/api/admin/client-access" method="post">
                          <input type="hidden" name="action" value="revoke" />
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="clientId" value={membership.clientId} />
                          <button type="submit" className="rounded-xl bg-destructive px-3 py-1.5 text-xs text-white">
                            Remove
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
