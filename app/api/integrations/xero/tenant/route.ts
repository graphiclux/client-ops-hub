import { IntegrationProvider } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { getValidXeroToken, upsertIntegrationToken } from "@/lib/integrations/tokens";
import { getXeroTenants } from "@/lib/integrations/xero";
import { apiError, enforceCsrf } from "@/lib/http";
import { createAuditLog } from "@/lib/security/audit";
import { logError } from "@/lib/telemetry";

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  try {
    const token = await getValidXeroToken(session.user.id);
    if (!token) return apiError("Xero not connected", 422);

    const tenants = await getXeroTenants(token.accessToken);
    return NextResponse.json({ tenants, selectedTenantId: token.tenantId || null });
  } catch (error) {
    logError("xero.tenant.list.failed", error, { userId: session.user.id });
    return apiError("Failed to fetch Xero tenants", 500);
  }
}

export async function POST(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);

  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const body = await req.json();
  const tenantId = body.tenantId as string | undefined;
  if (!tenantId) return apiError("tenantId required", 422);

  try {
    const token = await getValidXeroToken(session.user.id);
    if (!token) return apiError("Xero not connected", 422);

    await upsertIntegrationToken({
      userId: session.user.id,
      provider: IntegrationProvider.XERO,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken || undefined,
      expiresAt: token.expiresAt || undefined,
      scope: token.scope || undefined,
      tenantId
    });

    await createAuditLog({
      userId: session.user.id,
      action: "XERO_TENANT_SELECT",
      entityType: "IntegrationToken",
      entityId: session.user.id,
      request: req,
      metadata: { tenantId }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("xero.tenant.select.failed", error, { userId: session.user.id, tenantId });
    return apiError("Failed to select Xero tenant", 500);
  }
}

