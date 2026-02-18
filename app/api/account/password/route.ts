import { hash, compare } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { apiError, enforceCsrf } from "@/lib/http";
import { createAuditLog } from "@/lib/security/audit";

export async function POST(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);

  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const currentPassword = (body?.currentPassword as string | undefined) ?? "";
  const newPassword = (body?.newPassword as string | undefined) ?? "";

  if (!currentPassword || !newPassword || newPassword.length < 12) {
    return apiError("Invalid payload", 422);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true }
  });

  if (!user?.passwordHash) {
    return apiError("Password not set for this account", 422);
  }

  const currentMatches = await compare(currentPassword, user.passwordHash);
  if (!currentMatches) {
    return apiError("Current password is incorrect", 422);
  }

  const passwordHash = await hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash }
  });

  await createAuditLog({
    userId: session.user.id,
    action: "USER_PASSWORD_RESET_SELF",
    entityType: "User",
    entityId: session.user.id,
    request: req
  });

  return NextResponse.json({ ok: true });
}
