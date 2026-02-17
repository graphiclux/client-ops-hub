import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { apiError, enforceCsrf } from "@/lib/http";
import { canAccessClient } from "@/lib/auth/client-access";
import { createAuditLog } from "@/lib/security/audit";

const schema = z.object({
  clientId: z.string(),
  contactId: z.string().optional().nullable(),
  systemId: z.string().optional().nullable(),
  type: z.enum(["CALL", "EMAIL", "DECISION", "ISSUE", "CHANGE", "TASK"]).default("TASK"),
  bodyMarkdown: z.string().min(1),
  visibility: z.enum(["PRIVATE", "TEAM"]).default("TEAM")
});

const updateSchema = z.object({
  contactId: z.string().optional().nullable(),
  systemId: z.string().optional().nullable(),
  type: z.enum(["CALL", "EMAIL", "DECISION", "ISSUE", "CHANGE", "TASK"]).optional(),
  bodyMarkdown: z.string().min(1).optional(),
  visibility: z.enum(["PRIVATE", "TEAM"]).optional()
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

  const notes = await prisma.note.findMany({
    where: {
      clientId,
      ...(session.user.role === "CONTRACTOR" || session.user.role === "READONLY" ? { visibility: "TEAM" } : {}),
      ...(beforeDate
        ? beforeId
          ? {
              OR: [{ createdAt: { lt: beforeDate } }, { createdAt: beforeDate, id: { lt: beforeId } }]
            }
          : { createdAt: { lt: beforeDate } }
        : {})
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      attachments: true,
      createdBy: { select: { name: true, email: true } }
    },
    take: take + 1
  });

  const hasMore = notes.length > take;
  const items = hasMore ? notes.slice(0, take) : notes;

  return NextResponse.json({ notes: items, hasMore });
}

export async function POST(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);
  if (session.user.role === "READONLY") return apiError("Forbidden", 403);

  const contentType = req.headers.get("content-type") || "";
  let payload: Record<string, unknown>;

  if (contentType.includes("application/json")) {
    payload = await req.json();
  } else {
    const form = await req.formData();
    payload = {
      clientId: form.get("clientId")?.toString(),
      contactId: form.get("contactId")?.toString() || null,
      systemId: form.get("systemId")?.toString() || null,
      type: form.get("type")?.toString() || "TASK",
      bodyMarkdown: form.get("bodyMarkdown")?.toString(),
      visibility: form.get("visibility")?.toString() || "TEAM"
    };
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) return apiError("Invalid payload", 422);

  const canWrite = await canAccessClient(session.user, parsed.data.clientId, true);
  if (!canWrite) return apiError("Forbidden", 403);

  const note = await prisma.note.create({
    data: {
      ...parsed.data,
      createdByUserId: session.user.id
    }
  });

  await createAuditLog({ userId: session.user.id, action: "NOTE_CREATE", entityType: "Note", entityId: note.id, request: req });

  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL(`/clients/${note.clientId}`, req.url));
  }

  return NextResponse.json({ note }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return apiError("id required", 422);

  const existing = await prisma.note.findUnique({ where: { id } });
  if (!existing) return apiError("Not found", 404);

  const canWrite = await canAccessClient(session.user, existing.clientId, true);
  if (!canWrite) return apiError("Forbidden", 403);

  await prisma.note.delete({ where: { id } });
  await createAuditLog({ userId: session.user.id, action: "NOTE_DELETE", entityType: "Note", entityId: id, request: req });

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);
  if (session.user.role === "READONLY") return apiError("Forbidden", 403);

  const body = await req.json();
  const id = body.id as string | undefined;
  if (!id) return apiError("id required", 422);

  const existing = await prisma.note.findUnique({ where: { id } });
  if (!existing) return apiError("Not found", 404);

  const canWrite = await canAccessClient(session.user, existing.clientId, true);
  if (!canWrite) return apiError("Forbidden", 403);

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid payload", 422);

  const note = await prisma.note.update({
    where: { id },
    data: parsed.data
  });

  await createAuditLog({ userId: session.user.id, action: "NOTE_UPDATE", entityType: "Note", entityId: note.id, request: req });

  return NextResponse.json({ note });
}
