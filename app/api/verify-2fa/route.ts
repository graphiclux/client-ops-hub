import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { apiError, enforceCsrf } from "@/lib/http";
import { decryptValue } from "@/lib/security/encryption";
import { verifyTotpCode } from "@/lib/security/totp";
import { createAuditLog } from "@/lib/security/audit";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  attachRememberedTwoFactorSessionCookie,
  attachTwoFactorSessionCookie,
  buildTwoFactorSessionMarker
} from "@/lib/security/two-factor-session";

export async function POST(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);

  const session = await auth();
  if (!session?.user) {
    return apiError("Unauthorized", 401);
  }

  const key = `2fa:challenge:${session.user.id}:${req.headers.get("x-forwarded-for") || "unknown"}`;
  const limit = await enforceRateLimit(key, 10, 300);
  if (!limit.success) {
    return apiError("Too many attempts", 429);
  }

  const body = await req.json();
  const code = body.code as string | undefined;
  const rememberBrowser = Boolean(body.rememberBrowser);
  if (!code || code.length !== 6) {
    return apiError("Invalid payload", 422);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabled: true, totpSecretEncrypted: true }
  });

  if (!user?.totpEnabled || !user.totpSecretEncrypted) {
    return apiError("2FA not setup", 422);
  }

  const secret = decryptValue(user.totpSecretEncrypted);
  const valid = verifyTotpCode(secret, code);

  if (!valid) {
    await createAuditLog({
      userId: session.user.id,
      action: "TWO_FACTOR_CHALLENGE_FAILED",
      entityType: "User",
      entityId: session.user.id,
      request: req
    });

    return apiError("Invalid code", 422);
  }

  await createAuditLog({
    userId: session.user.id,
    action: "TWO_FACTOR_CHALLENGE_PASSED",
    entityType: "User",
    entityId: session.user.id,
    request: req,
    metadata: { rememberBrowser }
  });

  const jwt = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const sessionMarker = buildTwoFactorSessionMarker({ jti: jwt?.jti as string | undefined, iat: jwt?.iat as number | undefined });

  const response = NextResponse.json({ ok: true });
  if (rememberBrowser) {
    await attachRememberedTwoFactorSessionCookie(response, session.user.id, sessionMarker);
  } else {
    await attachTwoFactorSessionCookie(response, session.user.id, sessionMarker);
  }
  return response;
}
