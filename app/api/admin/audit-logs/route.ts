import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/http";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return apiError("Forbidden", 403);

  const take = Number(req.nextUrl.searchParams.get("take") || 100);

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(take, 500),
    include: { user: { select: { email: true } } }
  });

  return NextResponse.json({ logs });
}
