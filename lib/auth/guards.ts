import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { hasMinimumRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";

type GuardOptions = {
  minRole?: Role;
  clientId?: string;
  write?: boolean;
};

export async function requireAuth(options: GuardOptions = {}) {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!session.user.totpEnabled) {
    return {
      error: NextResponse.json({ error: "2FA required" }, { status: 403 }),
      redirect: NextResponse.redirect(new URL("/setup-2fa", process.env.NEXTAUTH_URL))
    };
  }

  const minRole = options.minRole ?? "READONLY";
  if (!hasMinimumRole(session.user.role, minRole)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  if (options.clientId && session.user.role === "CONTRACTOR") {
    const membership = await prisma.clientUser.findFirst({
      where: {
        clientId: options.clientId,
        userId: session.user.id,
        ...(options.write ? { permission: "EDIT" } : {})
      }
    });

    if (!membership) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
  }

  if (options.write && session.user.role === "READONLY") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session };
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function getClientIdFromRequest(req: NextRequest) {
  return req.nextUrl.searchParams.get("clientId") || null;
}
