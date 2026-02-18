import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { apiError, enforceCsrf } from "@/lib/http";
import { createAuditLog } from "@/lib/security/audit";

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
      totpEnabled: true,
      createdAt: true,
      updatedAt: true
    }
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);

  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return apiError("Forbidden", 403);

  const contentType = req.headers.get("content-type") || "";
  let userId: string | null = null;
  let role: Role | null = null;

  if (contentType.includes("application/json")) {
    const body = await req.json();
    userId = body.userId;
    role = body.role;
  } else {
    const form = await req.formData();
    userId = form.get("userId")?.toString() ?? null;
    role = (form.get("role")?.toString() as Role) ?? null;
  }

  if (!userId || !role || !Object.values(Role).includes(role)) {
    return apiError("Invalid payload", 422);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role }
  });

  await createAuditLog({ userId: session.user.id, action: "USER_ROLE_UPDATE", entityType: "User", entityId: user.id, request: req, metadata: { role } });

  if (!contentType.includes("application/json")) {
    return NextResponse.redirect(new URL("/admin/users", req.url));
  }

  return NextResponse.json({ user });
}
