import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { apiError, enforceCsrf, parseJson } from "@/lib/http";
import { buildClientAccessWhere, canAccessClient } from "@/lib/auth/client-access";
import { createAuditLog } from "@/lib/security/audit";

const schema = z.object({
  clientId: z.string(),
  type: z.enum(["RETAINER", "PROJECT", "EMERGENCY", "AUDIT"]),
  title: z.string().min(1),
  stage: z.enum(["INTAKE", "PROPOSAL", "ACTIVE", "WAITING", "DONE"]).default("INTAKE"),
  trelloCardId: z.string().optional().nullable(),
  trelloCardUrl: z.string().url().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable()
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const clientId = req.nextUrl.searchParams.get("clientId");
  const before = req.nextUrl.searchParams.get("before");
  const beforeId = req.nextUrl.searchParams.get("beforeId");
  const takeParam = Number(req.nextUrl.searchParams.get("take") || 20);
  const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 50) : 20;
  const beforeDate = before ? new Date(before) : null;
  if (before && (!beforeDate || Number.isNaN(beforeDate.getTime()))) {
    return apiError("Invalid before cursor", 422);
  }
  if (beforeId && !beforeDate) {
    return apiError("beforeId requires before", 422);
  }

  if (clientId) {
    const canRead = await canAccessClient(session.user, clientId);
    if (!canRead) return apiError("Forbidden", 403);
  }

  const clientScope = buildClientAccessWhere(session.user);
  const where = {
    ...(clientId ? { clientId } : {}),
    ...(beforeDate
      ? beforeId
        ? {
            OR: [{ updatedAt: { lt: beforeDate } }, { updatedAt: beforeDate, id: { lt: beforeId } }]
          }
        : { updatedAt: { lt: beforeDate } }
      : {}),
    ...(clientScope ? { client: clientScope } : {})
  };

  const engagements = await prisma.engagement.findMany({
    where,
    include: { client: { select: { name: true } } },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: take + 1
  });

  const hasMore = engagements.length > take;
  const items = hasMore ? engagements.slice(0, take) : engagements;

  return NextResponse.json({ engagements: items, hasMore });
}

export async function POST(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);
  if (session.user.role === "READONLY") return apiError("Forbidden", 403);

  const body = await parseJson<unknown>(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("Invalid payload", 422);

  const canWrite = await canAccessClient(session.user, parsed.data.clientId, true);
  if (!canWrite) return apiError("Forbidden", 403);

  const engagement = await prisma.engagement.create({
    data: {
      ...parsed.data,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null
    }
  });

  await createAuditLog({ userId: session.user.id, action: "ENGAGEMENT_CREATE", entityType: "Engagement", entityId: engagement.id, request: req });

  return NextResponse.json({ engagement }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const body = await parseJson<{ id: string } & z.infer<typeof schema>>(req);
  if (!body?.id) return apiError("id required", 422);

  const existing = await prisma.engagement.findUnique({ where: { id: body.id } });
  if (!existing) return apiError("Not found", 404);

  const canWrite = await canAccessClient(session.user, existing.clientId, true);
  if (!canWrite) return apiError("Forbidden", 403);

  const parsed = schema.partial().safeParse(body);
  if (!parsed.success) return apiError("Invalid payload", 422);

  const engagement = await prisma.engagement.update({
    where: { id: body.id },
    data: {
      ...parsed.data,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined
    }
  });

  await createAuditLog({ userId: session.user.id, action: "ENGAGEMENT_UPDATE", entityType: "Engagement", entityId: engagement.id, request: req });

  return NextResponse.json({ engagement });
}

export async function DELETE(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return apiError("id required", 422);

  const existing = await prisma.engagement.findUnique({ where: { id } });
  if (!existing) return apiError("Not found", 404);

  const canWrite = await canAccessClient(session.user, existing.clientId, true);
  if (!canWrite) return apiError("Forbidden", 403);

  await prisma.engagement.delete({ where: { id } });
  await createAuditLog({ userId: session.user.id, action: "ENGAGEMENT_DELETE", entityType: "Engagement", entityId: id, request: req });

  return NextResponse.json({ ok: true });
}
