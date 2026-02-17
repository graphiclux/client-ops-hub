import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { apiError, enforceCsrf } from "@/lib/http";
import { encryptValue } from "@/lib/security/encryption";
import { verifyTotpCode } from "@/lib/security/totp";
import { createAuditLog } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { attachTwoFactorSessionCookie, buildTwoFactorSessionMarker } from "@/lib/security/two-factor-session";

export async function POST(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);

  const session = await auth();
  if (!session?.user) {
    return apiError("Unauthorized", 401);
  }

  const key = `2fa:verify:${session.user.id}:${req.headers.get("x-forwarded-for") || "unknown"}`;
  const limit = await enforceRateLimit(key, 10, 300);
  if (!limit.success) {
    return apiError("Too many attempts", 429);
  }

  const body = await req.json();
  const secret = (body.secret as string | undefined)?.trim();
  const code = (body.code as string | undefined)?.trim();

  if (!secret || !code || !/^\d{6}$/.test(code)) {
    return apiError("Invalid payload", 422);
  }

  const valid = verifyTotpCode(secret, code);
  if (!valid) {
    return apiError("Invalid code", 422);
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      totpEnabled: true,
      totpSecretEncrypted: encryptValue(secret)
    }
  });

  await createAuditLog({
    userId: session.user.id,
    action: "TWO_FACTOR_ENABLED",
    entityType: "User",
    entityId: session.user.id,
    request: req
  });

  const jwt = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const sessionMarker = buildTwoFactorSessionMarker({ jti: jwt?.jti as string | undefined, iat: jwt?.iat as number | undefined });

  const response = NextResponse.json({ ok: true });
  await attachTwoFactorSessionCookie(response, session.user.id, sessionMarker);
  return response;
}
