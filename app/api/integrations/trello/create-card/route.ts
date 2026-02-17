import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { apiError, enforceCsrf } from "@/lib/http";
import { canAccessClient } from "@/lib/auth/client-access";
import { enqueueIntegrationJob } from "@/lib/jobs/queue";
import { getIntegrationToken } from "@/lib/integrations/tokens";
import { IntegrationProvider } from "@prisma/client";
import { logError } from "@/lib/telemetry";

export async function POST(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);

  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);
  if (session.user.role === "READONLY") return apiError("Forbidden", 403);

  try {
    const body = await req.json();
    const clientId = body.clientId as string | undefined;
    const shortRequest = body.shortRequest as string | undefined;
    const noteExcerpt = body.noteExcerpt as string | undefined;

    if (!clientId || !shortRequest) {
      return apiError("clientId and shortRequest are required", 422);
    }

    const canWrite = await canAccessClient(session.user, clientId, true);
    if (!canWrite) return apiError("Forbidden", 403);

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, trelloListId: true }
    });

    if (!client) return apiError("Client not found", 404);
    if (!client.trelloListId) return apiError("Client trello_list_id missing", 422);

    const token = await getIntegrationToken(session.user.id, IntegrationProvider.TRELLO);
    if (!token) return apiError("Trello not connected", 422);

    const job = await enqueueIntegrationJob("trello.createCard", {
      userId: session.user.id,
      clientId,
      shortRequest,
      noteExcerpt: noteExcerpt || ""
    });

    return NextResponse.json(
      {
        jobId: job.id,
        statusUrl: `/api/jobs/${job.id}`
      },
      { status: 202 }
    );
  } catch (error) {
    logError("trello.create_card.enqueue.failed", error, { userId: session.user.id });
    return apiError("Failed to enqueue Trello card creation", 500);
  }
}
