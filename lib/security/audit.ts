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

  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      metadataJson: (params.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      ip,
      userAgent
    }
  });
}
