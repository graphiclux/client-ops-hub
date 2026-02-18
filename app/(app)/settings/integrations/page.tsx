import { auth } from "@/lib/auth/options";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XeroTenantSelector } from "@/components/client/xero-tenant-selector";

const trelloMessages: Record<string, string> = {
  connected: "Trello connected successfully.",
  error_missing_api_key: "Trello API key is missing in server env (TRELLO_API_KEY).",
  error_missing_nextauth_url: "NEXTAUTH_URL is missing in server env.",
  error_missing_token_state: "Trello callback missing token/state. Check callback URL setup.",
  error_callback: "Trello callback failed. Check app logs for details.",
  error: "Trello connection failed. Check server logs."
};

export default async function IntegrationsPage({
  searchParams
}: {
  searchParams: Promise<{ trello?: string; xero?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const resolvedSearchParams = await searchParams;
  const trelloState = resolvedSearchParams.trello;
  const trelloMessage = trelloState ? trelloMessages[trelloState] || trelloMessages.error : null;

  const tokens = await prisma.integrationToken.findMany({
    where: { userId: session.user.id },
    select: { provider: true, updatedAt: true, tenantId: true }
  });

  const byProvider = Object.fromEntries(tokens.map((token) => [token.provider, token]));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Integrations</h2>
      <p className="text-sm text-muted-foreground">
        Need to change your login password? Go to <a className="text-primary hover:underline" href="/settings/password">Settings / Password</a>.
      </p>
      {trelloMessage && (
        <p className={`text-sm ${trelloState === "connected" ? "text-emerald-600" : "text-destructive"}`}>
          {trelloMessage}
        </p>
      )}
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
