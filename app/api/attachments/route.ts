import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { apiError, enforceCsrf } from "@/lib/http";
import { canAccessClient } from "@/lib/auth/client-access";
import { saveAttachment } from "@/lib/storage/adapter";
import { createAuditLog } from "@/lib/security/audit";

export async function POST(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);

  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);
  if (session.user.role === "READONLY") return apiError("Forbidden", 403);

  const form = await req.formData();
  const file = form.get("file");
  const clientId = form.get("clientId")?.toString();
  const noteId = form.get("noteId")?.toString() || null;

  if (!file || !(file instanceof File)) return apiError("file required", 422);
  if (!clientId) return apiError("clientId required", 422);

  const canWrite = await canAccessClient(session.user, clientId, true);
  if (!canWrite) return apiError("Forbidden", 403);

  const saved = await saveAttachment(file);

  const attachment = await prisma.attachment.create({
    data: {
      clientId,
      noteId,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      size: saved.size,
      storagePath: saved.path
    }
  });

  await createAuditLog({
    userId: session.user.id,
    action: "ATTACHMENT_UPLOAD",
    entityType: "Attachment",
    entityId: attachment.id,
    request: req
  });

  return NextResponse.json({ attachment }, { status: 201 });
}
