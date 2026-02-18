import { ClientPermission } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { apiError, enforceCsrf, redirectForRequest } from "@/lib/http";
import { createAuditLog } from "@/lib/security/audit";

type AccessAction = "grant" | "revoke";

function parseAction(value: string | null | undefined): AccessAction {
  return value === "revoke" ? "revoke" : "grant";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return apiError("Forbidden", 403);

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return apiError("userId required", 422);

  const memberships = await prisma.clientUser.findMany({
    where: { userId },
    include: { client: { select: { id: true, name: true, primaryDomain: true } } },
    orderBy: { client: { name: "asc" } }
  });

  return NextResponse.json({ memberships });
}

export async function POST(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);

  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return apiError("Forbidden", 403);

  const contentType = req.headers.get("content-type") || "";
  let userId: string | null = null;
  let clientId: string | null = null;
  let permission: ClientPermission = "VIEW";
  let action: AccessAction = "grant";

  if (contentType.includes("application/json")) {
    const body = await req.json();
    userId = body.userId ?? null;
    clientId = body.clientId ?? null;
    permission = (body.permission as ClientPermission | undefined) ?? "VIEW";
    action = parseAction(body.action);
  } else {
    const form = await req.formData();
    userId = form.get("userId")?.toString() ?? null;
    clientId = form.get("clientId")?.toString() ?? null;
    permission = (form.get("permission")?.toString() as ClientPermission | undefined) ?? "VIEW";
    action = parseAction(form.get("action")?.toString());
  }

  if (!userId || !clientId) {
    return apiError("userId and clientId are required", 422);
  }

  if (!Object.values(ClientPermission).includes(permission)) {
    return apiError("Invalid permission", 422);
  }

  if (action === "revoke") {
    await prisma.clientUser.deleteMany({
      where: { userId, clientId }
    });

    await createAuditLog({
      userId: session.user.id,
      action: "CLIENT_ACCESS_REVOKE",
      entityType: "ClientUser",
      entityId: `${clientId}:${userId}`,
      request: req,
      metadata: { userId, clientId }
    });

    if (!contentType.includes("application/json")) {
      return redirectForRequest(req, "/admin/users");
    }

    return NextResponse.json({ ok: true });
  }

  const membership = await prisma.clientUser.upsert({
    where: { clientId_userId: { clientId, userId } },
    update: { permission },
    create: { clientId, userId, permission }
  });

  await createAuditLog({
    userId: session.user.id,
    action: "CLIENT_ACCESS_GRANT",
    entityType: "ClientUser",
    entityId: membership.id,
    request: req,
    metadata: { userId, clientId, permission }
  });

  if (!contentType.includes("application/json")) {
    return redirectForRequest(req, "/admin/users");
  }

  return NextResponse.json({ membership });
}
