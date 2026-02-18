import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { redirectForRequest } from "@/lib/http";
import { trelloAuthUrl } from "@/lib/integrations/trello";
import { issueOauthState } from "@/lib/security/oauth-state";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { logError } from "@/lib/telemetry";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await enforceRateLimit(`trello:connect:${session.user.id}`, 10, 300);
  if (!limit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const state = await issueOauthState("trello");
    const url = trelloAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (error) {
    logError("trello.connect.failed", error, { userId: session.user.id });
    const message = error instanceof Error ? error.message : String(error);
    const code = message.includes("TRELLO_API_KEY")
      ? "error_missing_api_key"
      : message.includes("NEXTAUTH_URL")
        ? "error_missing_nextauth_url"
        : "error";
    return redirectForRequest(req, `/settings/integrations?trello=${code}`);
  }
}
