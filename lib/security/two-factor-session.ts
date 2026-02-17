import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { env, requireEnv } from "@/lib/env";

const COOKIE_NAME = "two_factor_session";
const DEFAULT_TTL_SECONDS = 60 * 60 * 12;
const REMEMBER_TTL_SECONDS = env.TWO_FACTOR_REMEMBER_DAYS * 24 * 60 * 60;

type SessionMarkerInput = {
  jti?: string | null;
  iat?: number | null;
};

function secretKey() {
  return new TextEncoder().encode(requireEnv("NEXTAUTH_SECRET"));
}

export function buildTwoFactorSessionMarker(token: SessionMarkerInput) {
  return token.jti || String(token.iat || "default");
}

export async function createTwoFactorSessionToken(userId: string, sessionMarker: string, ttlSeconds = DEFAULT_TTL_SECONDS) {
  return new SignJWT({ sub: userId, typ: "two_factor_session", sid: sessionMarker })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(secretKey());
}

export async function isValidTwoFactorSessionToken(rawToken: string | undefined, expectedUserId: string, expectedSessionMarker: string) {
  if (!rawToken) return false;

  try {
    const { payload } = await jwtVerify(rawToken, secretKey(), {
      algorithms: ["HS256"]
    });

    return (
      payload.sub === expectedUserId &&
      payload.typ === "two_factor_session" &&
      payload.sid === expectedSessionMarker
    );
  } catch {
    return false;
  }
}

export function getTwoFactorSessionFromRequest(req: NextRequest) {
  return req.cookies.get(COOKIE_NAME)?.value;
}

export async function attachTwoFactorSessionCookie(response: NextResponse, userId: string, sessionMarker: string) {
  const token = await createTwoFactorSessionToken(userId, sessionMarker, DEFAULT_TTL_SECONDS);

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: DEFAULT_TTL_SECONDS
  });
}

export async function attachRememberedTwoFactorSessionCookie(response: NextResponse, userId: string, sessionMarker: string) {
  const token = await createTwoFactorSessionToken(userId, sessionMarker, REMEMBER_TTL_SECONDS);

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: REMEMBER_TTL_SECONDS
  });
}

export function clearTwoFactorSessionCookie(response: NextResponse) {
  response.cookies.delete(COOKIE_NAME);
}
