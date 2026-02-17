import { auth } from "@/lib/auth/options";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XeroTenantSelector } from "@/components/client/xero-tenant-selector";

export default async function IntegrationsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const tokens = await prisma.integrationToken.findMany({
    where: { userId: session.user.id },
    select: { provider: true, updatedAt: true, tenantId: true }
  });

  const byProvider = Object.fromEntries(tokens.map((token) => [token.provider, token]));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Integrations</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Trello</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {byProvider.TRELLO ? `Connected on ${new Date(byProvider.TRELLO.updatedAt).toLocaleDateString()}` : "Not connected"}
            </p>
            <a href="/api/integrations/trello/connect">
              <Button>Connect Trello</Button>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Xero</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {byProvider.XERO
                ? `Connected${byProvider.XERO.tenantId ? ` (tenant: ${byProvider.XERO.tenantId})` : ""}`
                : "Not connected"}
            </p>
            <a href="/api/integrations/xero/connect">
              <Button>Connect Xero</Button>
            </a>
            {byProvider.XERO && <XeroTenantSelector initialTenantId={byProvider.XERO.tenantId} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
