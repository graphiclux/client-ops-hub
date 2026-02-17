import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { apiError, enforceCsrf, parseJson } from "@/lib/http";
import { canAccessClient } from "@/lib/auth/client-access";
import { createAuditLog } from "@/lib/security/audit";

const schema = z.object({
  clientId: z.string(),
  name: z.string().min(1),
  roleTitle: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  preferredContactMethod: z.string().optional().nullable(),
  notesShort: z.string().optional().nullable()
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

  const contacts = await prisma.contact.findMany({
    where: {
      clientId,
      ...(beforeDate
        ? beforeId
          ? {
              OR: [{ createdAt: { lt: beforeDate } }, { createdAt: beforeDate, id: { lt: beforeId } }]
            }
          : { createdAt: { lt: beforeDate } }
        : {})
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1
  });

  const hasMore = contacts.length > take;
  const items = hasMore ? contacts.slice(0, take) : contacts;

  return NextResponse.json({ contacts: items, hasMore });
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

  const contact = await prisma.contact.create({ data: parsed.data });
  await createAuditLog({ userId: session.user.id, action: "CONTACT_CREATE", entityType: "Contact", entityId: contact.id, request: req });

  return NextResponse.json({ contact }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const body = await parseJson<{ id: string } & z.infer<typeof schema>>(req);
  if (!body?.id) return apiError("id required", 422);

  const existing = await prisma.contact.findUnique({ where: { id: body.id } });
  if (!existing) return apiError("Not found", 404);

  const canWrite = await canAccessClient(session.user, existing.clientId, true);
  if (!canWrite) return apiError("Forbidden", 403);

  const parsed = schema.partial().safeParse(body);
  if (!parsed.success) return apiError("Invalid payload", 422);

  const contact = await prisma.contact.update({ where: { id: body.id }, data: parsed.data });
  await createAuditLog({ userId: session.user.id, action: "CONTACT_UPDATE", entityType: "Contact", entityId: contact.id, request: req });

  return NextResponse.json({ contact });
}

export async function DELETE(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return apiError("id required", 422);

  const existing = await prisma.contact.findUnique({ where: { id } });
  if (!existing) return apiError("Not found", 404);

  const canWrite = await canAccessClient(session.user, existing.clientId, true);
  if (!canWrite) return apiError("Forbidden", 403);

  await prisma.contact.delete({ where: { id } });
  await createAuditLog({ userId: session.user.id, action: "CONTACT_DELETE", entityType: "Contact", entityId: id, request: req });

  return NextResponse.json({ ok: true });
}
