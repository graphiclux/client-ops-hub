import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function createAuditLog(params: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  request?: NextRequest;
}) {
  const ip = params.request?.headers.get("x-forwarded-for") || null;
  const userAgent = params.request?.headers.get("user-agent") || null;
  const baseData = {
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    metadataJson: (params.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
    ip,
    userAgent
  };

  try {
    await prisma.auditLog.create({
      data: {
        ...baseData,
        userId: params.userId ?? null
      }
    });
  } catch (error) {
    // If the provided userId isn't present (common with stale tokens or provider IDs),
    // keep the audit trail by retrying without FK-bound userId.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      await prisma.auditLog.create({
        data: {
          ...baseData,
          userId: null,
          metadataJson: ({
            ...(params.metadata ?? {}),
            unresolvedUserId: params.userId ?? null
          } as Prisma.InputJsonValue)
        }
      });
      return;
    }

    throw error;
  }
}
