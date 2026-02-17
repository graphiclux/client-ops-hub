import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { apiError, enforceCsrf } from "@/lib/http";
import { canAccessClient } from "@/lib/auth/client-access";
import { readAttachment } from "@/lib/storage/adapter";
import { createAuditLog } from "@/lib/security/audit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) return apiError("Not found", 404);
  if (!attachment.clientId) return apiError("Attachment has no client", 422);

  const canRead = await canAccessClient(session.user, attachment.clientId);
  if (!canRead) return apiError("Forbidden", 403);

  const bytes = await readAttachment(attachment.storagePath);

  await createAuditLog({
    userId: session.user.id,
    action: "ATTACHMENT_DOWNLOAD",
    entityType: "Attachment",
    entityId: attachment.id,
    request: req
  });

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `inline; filename=\"${attachment.filename}\"`
    }
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);

  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) return apiError("Not found", 404);
  if (!attachment.clientId) return apiError("Attachment has no client", 422);

  const canWrite = await canAccessClient(session.user, attachment.clientId, true);
  if (!canWrite) return apiError("Forbidden", 403);

  await prisma.attachment.delete({ where: { id } });

  await createAuditLog({
    userId: session.user.id,
    action: "ATTACHMENT_DELETE",
    entityType: "Attachment",
    entityId: attachment.id,
    request: req
  });

  return NextResponse.json({ ok: true });
}
