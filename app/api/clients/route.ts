import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { apiError, enforceCsrf, parseJson } from "@/lib/http";
import { buildClientAccessWhere, canAccessClient } from "@/lib/auth/client-access";
import { createAuditLog } from "@/lib/security/audit";

const createSchema = z.object({
  name: z.string().min(2),
  legalName: z.string().optional(),
  primaryDomain: z.string().min(3),
  status: z.enum(["LEAD", "ACTIVE", "ON_HOLD", "PAST"]).default("LEAD"),
  tags: z.array(z.string()).default([]),
  timezone: z.string().default("UTC"),
  ownerUserId: z.string(),
  xeroContactId: z.string().optional().nullable(),
  trelloBoardId: z.string().optional().nullable(),
  trelloListId: z.string().optional().nullable()
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const q = req.nextUrl.searchParams.get("q") || undefined;
  const clients = await prisma.client.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { primaryDomain: { contains: q, mode: "insensitive" } }
            ]
          }
        : {}),
      ...(buildClientAccessWhere(session.user) || {})
    },
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json({ clients });
}

export async function POST(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);

  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);
  if (session.user.role === "READONLY") return apiError("Forbidden", 403);

  const body = await parseJson<unknown>(req);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid payload", 422);

  if (session.user.role === "CONTRACTOR") return apiError("Forbidden", 403);

  const client = await prisma.client.create({
    data: parsed.data
  });

  await createAuditLog({
    userId: session.user.id,
    action: "CLIENT_CREATE",
    entityType: "Client",
    entityId: client.id,
    request: req
  });

  return NextResponse.json({ client }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);

  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);
  if (session.user.role === "READONLY") return apiError("Forbidden", 403);

  const body = await parseJson<{ id: string } & z.infer<typeof createSchema>>(req);
  if (!body?.id) return apiError("Missing id", 422);

  const canWrite = await canAccessClient(session.user, body.id, true);
  if (!canWrite) return apiError("Forbidden", 403);

  const payload = createSchema.partial().safeParse(body);
  if (!payload.success) return apiError("Invalid payload", 422);

  const client = await prisma.client.update({
    where: { id: body.id },
    data: payload.data
  });

  await createAuditLog({
    userId: session.user.id,
    action: "CLIENT_UPDATE",
    entityType: "Client",
    entityId: client.id,
    request: req
  });

  return NextResponse.json({ client });
}

export async function DELETE(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);

  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);
  if (!(session.user.role === "ADMIN" || session.user.role === "MANAGER")) return apiError("Forbidden", 403);

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return apiError("Missing id", 422);

  if (session.user.role === "MANAGER") {
    const canWrite = await canAccessClient(session.user, id, true);
    if (!canWrite) return apiError("Forbidden", 403);
  }

  await prisma.client.delete({ where: { id } });

  await createAuditLog({
    userId: session.user.id,
    action: "CLIENT_DELETE",
    entityType: "Client",
    entityId: id,
    request: req
  });

  return NextResponse.json({ ok: true });
}
