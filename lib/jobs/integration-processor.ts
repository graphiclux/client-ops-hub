import type { Job } from "bullmq";
import { IntegrationProvider } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createTrelloCard } from "@/lib/integrations/trello";
import { getIntegrationToken } from "@/lib/integrations/tokens";
import { createAuditLog } from "@/lib/security/audit";
import { logError, logInfo } from "@/lib/telemetry";

type TrelloCreateCardJobData = {
  userId: string;
  clientId: string;
  shortRequest: string;
  noteExcerpt?: string;
};

async function processTrelloCreateCard(job: Job<TrelloCreateCardJobData>) {
  const { userId, clientId, shortRequest, noteExcerpt } = job.data;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      contacts: { take: 3, orderBy: { createdAt: "asc" } },
      systems: { take: 6, orderBy: { updatedAt: "desc" } }
    }
  });

  if (!client) {
    throw new Error("Client not found");
  }

  if (!client.trelloListId) {
    throw new Error("Client trello_list_id missing");
  }

  const token = await getIntegrationToken(userId, IntegrationProvider.TRELLO);
  if (!token) {
    throw new Error("Trello not connected");
  }

  const description = [
    `Client Domain: ${client.primaryDomain}`,
    "",
    "Key Contacts:",
    ...client.contacts.map((contact) => `- ${contact.name} (${contact.roleTitle}) ${contact.email || ""}`),
    "",
    "System Admin URLs:",
    ...client.systems.map((system) => `- ${system.label}: ${system.adminUrl || "n/a"}`),
    "",
    `Internal note excerpt: ${noteExcerpt || "n/a"}`
  ].join("\n");

  const card = await createTrelloCard({
    token: token.accessToken,
    listId: client.trelloListId,
    name: `[${client.name}] - ${shortRequest}`,
    desc: description
  });

  const engagement = await prisma.engagement.create({
    data: {
      clientId: client.id,
      type: "PROJECT",
      title: shortRequest,
      stage: "ACTIVE",
      trelloCardId: card.id,
      trelloCardUrl: card.url
    }
  });

  await createAuditLog({
    userId,
    action: "TRELLO_CARD_CREATE",
    entityType: "Engagement",
    entityId: engagement.id,
    metadata: { trelloCardId: card.id, clientId: client.id, viaJob: true }
  });

  logInfo("jobs.integration.trello.create_card.success", { jobId: job.id, userId, clientId, cardId: card.id });

  return {
    card,
    engagementId: engagement.id
  };
}

export async function processIntegrationJob(job: Job) {
  try {
    switch (job.name) {
      case "trello.createCard":
        return processTrelloCreateCard(job as Job<TrelloCreateCardJobData>);
      default:
        throw new Error(`Unsupported integration job: ${job.name}`);
    }
  } catch (error) {
    logError("jobs.integration.processor.failed", error, { jobId: job.id, name: job.name });
    throw error;
  }
}
