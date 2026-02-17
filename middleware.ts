import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { buildTwoFactorSessionMarker, getTwoFactorSessionFromRequest, isValidTwoFactorSessionToken } from "@/lib/security/two-factor-session";

const PUBLIC_PATHS = ["/login", "/api/auth", "/_next", "/favicon.ico"];
const CSRF_COOKIE_NAME = "csrf_token";

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

function ensureCsrfCookie(req: NextRequest, response: NextResponse) {
  const existing = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (existing) return;

  const token = crypto.randomUUID();
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    const response = NextResponse.next();
    ensureCsrfCookie(req, response);
    return response;
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token || !token.userId) {
    const response = NextResponse.redirect(new URL("/login", req.url));
    ensureCsrfCookie(req, response);
    return response;
  }

  if (!token.totpEnabled && !pathname.startsWith("/setup-2fa") && !pathname.startsWith("/api/setup-2fa")) {
    const response = NextResponse.redirect(new URL("/setup-2fa", req.url));
    ensureCsrfCookie(req, response);
    return response;
  }

  const twoFactorSession = getTwoFactorSessionFromRequest(req);
  const sessionMarker = buildTwoFactorSessionMarker({ jti: token.jti as string | undefined, iat: token.iat as number | undefined });
  const hasValidTwoFactorSession = await isValidTwoFactorSessionToken(twoFactorSession, token.userId as string, sessionMarker);

  const needsChallenge =
    Boolean(token.totpEnabled) &&
    !hasValidTwoFactorSession &&
    !pathname.startsWith("/verify-2fa") &&
    !pathname.startsWith("/api/verify-2fa") &&
    !pathname.startsWith("/setup-2fa") &&
    !pathname.startsWith("/api/setup-2fa");

  if (needsChallenge) {
    const response = NextResponse.redirect(new URL("/verify-2fa", req.url));
    ensureCsrfCookie(req, response);
    return response;
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  ensureCsrfCookie(req, response);
  return response;
}

export const config = {
  matcher: ["/((?!.*\\..*|_next/static|_next/image).*)"]
};
