import { IntegrationProvider } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { removeIntegrationToken } from "@/lib/integrations/tokens";
import { apiError, enforceCsrf } from "@/lib/http";
import { createAuditLog } from "@/lib/security/audit";

export async function DELETE(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);

  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  await removeIntegrationToken(session.user.id, IntegrationProvider.XERO);

  await createAuditLog({
    userId: session.user.id,
    action: "INTEGRATION_DISCONNECT",
    entityType: "IntegrationToken",
    entityId: IntegrationProvider.XERO,
    request: req
  });

  return NextResponse.json({ ok: true });
}
