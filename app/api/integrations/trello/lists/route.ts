import { IntegrationProvider } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { apiError } from "@/lib/http";
import { getTrelloBoardsAndLists } from "@/lib/integrations/trello";
import { getIntegrationToken } from "@/lib/integrations/tokens";
import { logError } from "@/lib/telemetry";

export async function GET() {
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  try {
    const token = await getIntegrationToken(session.user.id, IntegrationProvider.TRELLO);
    if (!token) return apiError("Trello not connected", 422);

    const boards = await getTrelloBoardsAndLists(token.accessToken);
    return NextResponse.json({ boards });
  } catch (error) {
    logError("trello.lists.route.failed", error, { userId: session.user.id });
    return apiError("Failed to load Trello boards/lists", 500);
  }
}
