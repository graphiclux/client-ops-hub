import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { buildClientAccessWhere } from "@/lib/auth/client-access";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/http";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ clients: [], notes: [], systems: [] });

  const clients = await prisma.client.findMany({
    where: {
      OR: [{ name: { contains: q, mode: "insensitive" } }, { primaryDomain: { contains: q, mode: "insensitive" } }],
      ...(buildClientAccessWhere(session.user) || {})
    },
    take: 10
  });

  const scopedClientWhere = buildClientAccessWhere(session.user);
  const notes = await prisma.note.findMany({
    where: {
      bodyMarkdown: { contains: q, mode: "insensitive" },
      ...(session.user.role === "CONTRACTOR" || session.user.role === "READONLY" ? { visibility: "TEAM" } : {}),
      ...(scopedClientWhere ? { client: scopedClientWhere } : {})
    },
    take: 10,
    select: { id: true, bodyMarkdown: true, clientId: true, createdAt: true }
  });

  const systems = await prisma.system.findMany({
    where: {
      OR: [{ label: { contains: q, mode: "insensitive" } }, { adminUrl: { contains: q, mode: "insensitive" } }],
      ...(scopedClientWhere ? { client: scopedClientWhere } : {})
    },
    take: 10
  });

  return NextResponse.json({ clients, notes, systems });
}
