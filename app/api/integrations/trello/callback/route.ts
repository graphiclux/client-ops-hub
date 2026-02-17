import { IntegrationProvider } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { apiError, enforceCsrf } from "@/lib/http";
import { upsertIntegrationToken } from "@/lib/integrations/tokens";
import { validateOauthState } from "@/lib/security/oauth-state";
import { createAuditLog } from "@/lib/security/audit";
import { logError } from "@/lib/telemetry";

async function saveToken(req: NextRequest, token: string, state: string) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await validateOauthState(state))) {
    return NextResponse.json({ error: "Invalid state" }, { status: 403 });
  }

  await upsertIntegrationToken({
    userId: session.user.id,
    provider: IntegrationProvider.TRELLO,
    accessToken: token,
    scope: "read,write"
  });

  await createAuditLog({
    userId: session.user.id,
    action: "INTEGRATION_CONNECT",
    entityType: "IntegrationToken",
    entityId: IntegrationProvider.TRELLO,
    request: req,
    metadata: { provider: "TRELLO" }
  });

  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state");
  const token = req.nextUrl.searchParams.get("token") || req.nextUrl.searchParams.get("code");

  if (!state || !token) {
    return NextResponse.json({ error: "Missing token/state" }, { status: 422 });
  }

  try {
    await saveToken(req, token, state);
    return NextResponse.redirect(new URL("/settings/integrations?trello=connected", req.url));
  } catch (error) {
    logError("trello.callback.get.failed", error);
    return NextResponse.redirect(new URL("/settings/integrations?trello=error", req.url));
  }
}

export async function POST(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);

  const body = await req.json();
  const token = body.token as string | undefined;
  const state = body.state as string | undefined;

  if (!token || !state) {
    return apiError("Missing token/state", 422);
  }

  try {
    return await saveToken(req, token, state);
  } catch (error) {
    logError("trello.callback.post.failed", error);
    return apiError("Failed to connect Trello", 500);
  }
}
