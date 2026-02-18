import { NextRequest, NextResponse } from "next/server";

const CSRF_COOKIE_NAME = "csrf_token";

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function redirectForRequest(req: NextRequest, path: string, status = 303) {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const host = forwardedHost || req.headers.get("host");

  if (host) {
    const protocol = forwardedProto || (process.env.NODE_ENV === "development" ? "http" : "https");
    return NextResponse.redirect(`${protocol}://${host}${path}`, status);
  }

  return NextResponse.redirect(new URL(path, req.url), status);
}

function hasSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

export function enforceCsrf(req: NextRequest) {
  if (!hasSameOrigin(req)) {
    return false;
  }

  const csrfCookie = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!csrfCookie) {
    return false;
  }

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const csrfHeader = req.headers.get("x-csrf-token");
    return Boolean(csrfHeader && csrfHeader === csrfCookie);
  }

  return true;
}

export async function parseJson<T>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
