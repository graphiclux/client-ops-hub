import { Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { apiError, enforceCsrf, redirectForRequest } from "@/lib/http";
import { createAuditLog } from "@/lib/security/audit";

type Action = "create" | "update-role" | "set-password";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return apiError("Forbidden", 403);

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isServiceAccount: true,
      totpEnabled: true,
      createdAt: true,
      updatedAt: true
    }
  });
  return NextResponse.json({ users });
}

function parseAction(value: string | null | undefined): Action {
  if (value === "create" || value === "set-password") return value;
  return "update-role";
}

export async function POST(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);

  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return apiError("Forbidden", 403);

  const contentType = req.headers.get("content-type") || "";
  let action: Action = "update-role";
  let userId: string | null = null;
  let role: Role | null = null;
  let email: string | null = null;
  let name: string | null = null;
  let password: string | null = null;
  let isServiceAccount = false;

  if (contentType.includes("application/json")) {
    const body = await req.json();
    action = parseAction(body.action as string | undefined);
    userId = (body.userId as string | undefined) ?? null;
    role = (body.role as Role | undefined) ?? null;
    email = (body.email as string | undefined)?.toLowerCase().trim() ?? null;
    name = (body.name as string | undefined)?.trim() ?? null;
    password = (body.password as string | undefined) ?? null;
    isServiceAccount = Boolean(body.isServiceAccount);
  } else {
    const form = await req.formData();
    action = parseAction(form.get("action")?.toString());
    userId = form.get("userId")?.toString() ?? null;
    role = (form.get("role")?.toString() as Role) ?? null;
    email = form.get("email")?.toString().toLowerCase().trim() ?? null;
    name = form.get("name")?.toString().trim() ?? null;
    password = form.get("password")?.toString() ?? null;
    isServiceAccount = (form.get("isServiceAccount")?.toString() || "").toLowerCase() === "true";
  }

  if (action === "create") {
    if (!email || !role || !Object.values(Role).includes(role)) {
      return apiError("Invalid payload", 422);
    }

    if (!password || password.length < 12) {
      return apiError("Password must be at least 12 characters", 422);
    }

    const passwordHash = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        name: name || email,
        role,
        passwordHash,
        isServiceAccount
      }
    });

    await createAuditLog({
      userId: session.user.id,
      action: "USER_CREATE",
      entityType: "User",
      entityId: user.id,
      request: req,
      metadata: { role, isServiceAccount }
    });

    if (!contentType.includes("application/json")) {
      return redirectForRequest(req, "/admin/users");
    }

    return NextResponse.json({ user }, { status: 201 });
  }

  if (action === "set-password") {
    if (!userId) {
      return apiError("Invalid payload", 422);
    }

    if (!password || password.length < 12) {
      return apiError("Password must be at least 12 characters", 422);
    }

    const passwordHash = await hash(password, 12);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    await createAuditLog({
      userId: session.user.id,
      action: "USER_PASSWORD_SET",
      entityType: "User",
      entityId: user.id,
      request: req
    });

    if (!contentType.includes("application/json")) {
      return redirectForRequest(req, "/admin/users");
    }

    return NextResponse.json({ ok: true });
  }

  if (!userId || !role || !Object.values(Role).includes(role)) {
    return apiError("Invalid payload", 422);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role, isServiceAccount }
  });

  await createAuditLog({
    userId: session.user.id,
    action: "USER_ROLE_UPDATE",
    entityType: "User",
    entityId: user.id,
    request: req,
    metadata: { role, isServiceAccount }
  });

  if (!contentType.includes("application/json")) {
    return redirectForRequest(req, "/admin/users");
  }

  return NextResponse.json({ user });
}
