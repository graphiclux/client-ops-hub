import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { getValidXeroToken } from "@/lib/integrations/tokens";
import { getInvoiceSummary } from "@/lib/integrations/xero";
import { apiError } from "@/lib/http";
import { canAccessClient } from "@/lib/auth/client-access";
import { logError } from "@/lib/telemetry";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return apiError("clientId required", 422);

  const canRead = await canAccessClient(session.user, clientId);
  if (!canRead) return apiError("Forbidden", 403);

  try {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client?.xeroContactId) return apiError("Client missing xero_contact_id", 422);

    const token = await getValidXeroToken(session.user.id);
    if (!token || !token.tenantId) return apiError("Xero not fully configured", 422);

    const summary = await getInvoiceSummary({
      accessToken: token.accessToken,
      tenantId: token.tenantId,
      xeroContactId: client.xeroContactId
    });

    return NextResponse.json({ summary, xeroUrl: "https://go.xero.com" });
  } catch (error) {
    logError("xero.invoice_summary.route.failed", error, { userId: session.user.id, clientId });
    return apiError("Failed to fetch invoice summary", 500);
  }
}
