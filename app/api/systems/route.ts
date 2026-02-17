import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { apiError, enforceCsrf, parseJson } from "@/lib/http";
import { canAccessClient } from "@/lib/auth/client-access";
import { createAuditLog } from "@/lib/security/audit";

const schema = z.object({
  clientId: z.string(),
  type: z.enum(["WORDPRESS", "WOOCOMMERCE", "SHOPIFY", "CLOUDFLARE", "DNS", "HOSTING", "EMAIL", "AWS", "GRIDPANE", "OTHER"]),
  label: z.string().min(1),
  url: z.string().url().optional().nullable(),
  adminUrl: z.string().url().optional().nullable(),
  usernameHint: z.string().optional().nullable(),
  vaultItemRef: z.string().optional().nullable(),
  mfaStatus: z.enum(["ENABLED", "DISABLED", "UNKNOWN"]).default("UNKNOWN"),
  notes: z.string().optional().nullable()
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) return apiError("clientId required", 422);
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

  const canRead = await canAccessClient(session.user, clientId);
  if (!canRead) return apiError("Forbidden", 403);

  const systems = await prisma.system.findMany({
    where: {
      clientId,
      ...(beforeDate
        ? beforeId
          ? {
              OR: [{ updatedAt: { lt: beforeDate } }, { updatedAt: beforeDate, id: { lt: beforeId } }]
            }
          : { updatedAt: { lt: beforeDate } }
        : {})
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: take + 1
  });

  const hasMore = systems.length > take;
  const items = hasMore ? systems.slice(0, take) : systems;

  return NextResponse.json({ systems: items, hasMore });
}

export async function POST(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const body = await parseJson<unknown>(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("Invalid payload", 422);

  const canWrite = await canAccessClient(session.user, parsed.data.clientId, true);
  if (!canWrite) return apiError("Forbidden", 403);

  const system = await prisma.system.create({ data: parsed.data });
  await createAuditLog({ userId: session.user.id, action: "SYSTEM_CREATE", entityType: "System", entityId: system.id, request: req });

  return NextResponse.json({ system }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const body = await parseJson<{ id: string } & z.infer<typeof schema>>(req);
  if (!body?.id) return apiError("id required", 422);

  const existing = await prisma.system.findUnique({ where: { id: body.id } });
  if (!existing) return apiError("Not found", 404);

  const canWrite = await canAccessClient(session.user, existing.clientId, true);
  if (!canWrite) return apiError("Forbidden", 403);

  const parsed = schema.partial().safeParse(body);
  if (!parsed.success) return apiError("Invalid payload", 422);

  const system = await prisma.system.update({ where: { id: body.id }, data: parsed.data });
  await createAuditLog({ userId: session.user.id, action: "SYSTEM_UPDATE", entityType: "System", entityId: system.id, request: req });

  return NextResponse.json({ system });
}

export async function DELETE(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return apiError("id required", 422);

  const existing = await prisma.system.findUnique({ where: { id } });
  if (!existing) return apiError("Not found", 404);

  const canWrite = await canAccessClient(session.user, existing.clientId, true);
  if (!canWrite) return apiError("Forbidden", 403);

  await prisma.system.delete({ where: { id } });
  await createAuditLog({ userId: session.user.id, action: "SYSTEM_DELETE", entityType: "System", entityId: id, request: req });

  return NextResponse.json({ ok: true });
}
