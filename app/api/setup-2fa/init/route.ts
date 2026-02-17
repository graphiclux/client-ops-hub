import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { apiError, enforceCsrf } from "@/lib/http";
import { createTotpSecret, createQrDataUrl } from "@/lib/security/totp";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);

  const session = await auth();
  if (!session?.user?.email) {
    return apiError("Unauthorized", 401);
  }

  const key = `2fa:init:${session.user.id}:${req.headers.get("x-forwarded-for") || "unknown"}`;
  const limit = await enforceRateLimit(key, 8, 60);
  if (!limit.success) {
    return apiError("Too many requests", 429);
  }

  const { base32, otpauthUrl } = createTotpSecret(session.user.email);
  const qrCodeDataUrl = await createQrDataUrl(otpauthUrl);

  return NextResponse.json({
    secret: base32,
    qrCodeDataUrl
  });
}
