import { IntegrationProvider } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { exchangeXeroCode } from "@/lib/integrations/xero";
import { upsertIntegrationToken } from "@/lib/integrations/tokens";
import { validateOauthState } from "@/lib/security/oauth-state";
import { createAuditLog } from "@/lib/security/audit";
import { logError } from "@/lib/telemetry";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");

  if (!state || !(await validateOauthState(state))) {
    return NextResponse.json({ error: "Invalid state" }, { status: 403 });
  }

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 422 });
  }

  try {
    const tokenSet = await exchangeXeroCode(code);

    await upsertIntegrationToken({
      userId: session.user.id,
      provider: IntegrationProvider.XERO,
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token,
      expiresAt: new Date(Date.now() + tokenSet.expires_in * 1000),
      scope: tokenSet.scope
    });

    await createAuditLog({
      userId: session.user.id,
      action: "INTEGRATION_CONNECT",
      entityType: "IntegrationToken",
      entityId: IntegrationProvider.XERO,
      request: req,
      metadata: { provider: "XERO" }
    });

    return NextResponse.redirect(new URL("/settings/integrations?xero=connected", req.url));
  } catch (error) {
    logError("xero.callback.failed", error, { userId: session.user.id });
    return NextResponse.redirect(new URL("/settings/integrations?xero=error", req.url));
  }
}
