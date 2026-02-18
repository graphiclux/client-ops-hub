import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { redirectForRequest } from "@/lib/http";
import { xeroAuthUrl } from "@/lib/integrations/xero";
import { issueOauthState } from "@/lib/security/oauth-state";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { logError } from "@/lib/telemetry";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await enforceRateLimit(`xero:connect:${session.user.id}`, 10, 300);
  if (!limit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const state = await issueOauthState("xero");
    const url = xeroAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (error) {
    logError("xero.connect.failed", error, { userId: session.user.id });
    return redirectForRequest(req, "/settings/integrations?xero=error");
  }
}
