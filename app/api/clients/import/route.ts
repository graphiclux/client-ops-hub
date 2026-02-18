import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { apiError, enforceCsrf } from "@/lib/http";
import { createAuditLog } from "@/lib/security/audit";

const STATUSES = new Set(["LEAD", "ACTIVE", "ON_HOLD", "PAST"] as const);

type CsvRow = Record<string, string>;

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const input = `${text}\n`;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(field.trim());
      field = "";

      if (row.some((item) => item.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += char;
  }

  return rows;
}

function toRowObject(headers: string[], values: string[]): CsvRow {
  const row: CsvRow = {};
  for (let i = 0; i < headers.length; i += 1) {
    row[headers[i]] = (values[i] || "").trim();
  }
  return row;
}

function parseTags(value: string) {
  if (!value) return [];
  return value
    .split(/[|;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);

  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);
  if (session.user.role === "READONLY" || session.user.role === "CONTRACTOR") return apiError("Forbidden", 403);

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return apiError("CSV file is required", 422);
  }

  const rawText = await file.text();
  const parsedRows = parseCsv(rawText);
  if (parsedRows.length < 2) return apiError("CSV must include header and at least one data row", 422);

  const headers = parsedRows[0].map(normalizeHeader);
  const nameIndex = headers.indexOf("name");
  const domainIndex = headers.indexOf("primarydomain");
  if (nameIndex === -1 || domainIndex === -1) {
    return apiError("CSV must include name and primaryDomain columns", 422);
  }

  const createdIds: string[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  for (let rowIndex = 1; rowIndex < parsedRows.length; rowIndex += 1) {
    const rowValues = parsedRows[rowIndex];
    const row = toRowObject(headers, rowValues);

    const name = row.name?.trim();
    const primaryDomain = row.primarydomain?.trim();
    const statusRaw = (row.status || "LEAD").toUpperCase();
    const timezone = row.timezone?.trim() || "UTC";

    if (!name || !primaryDomain) {
      errors.push({ row: rowIndex + 1, error: "name and primaryDomain are required" });
      continue;
    }

    if (!STATUSES.has(statusRaw as "LEAD" | "ACTIVE" | "ON_HOLD" | "PAST")) {
      errors.push({ row: rowIndex + 1, error: `invalid status: ${row.status}` });
      continue;
    }

    let ownerUserId = session.user.id;
    const ownerUserIdRaw = row.owneruserid?.trim();
    const ownerEmailRaw = row.owneremail?.trim().toLowerCase();

    if (ownerUserIdRaw || ownerEmailRaw) {
      if (session.user.role !== "ADMIN") {
        errors.push({ row: rowIndex + 1, error: "ownerUserId/ownerEmail is admin-only" });
        continue;
      }

      const owner = ownerUserIdRaw
        ? await prisma.user.findUnique({ where: { id: ownerUserIdRaw }, select: { id: true } })
        : await prisma.user.findUnique({ where: { email: ownerEmailRaw }, select: { id: true } });

      if (!owner) {
        errors.push({ row: rowIndex + 1, error: "owner user not found" });
        continue;
      }

      ownerUserId = owner.id;
    }

    try {
      const client = await prisma.client.create({
        data: {
          name,
          legalName: row.legalname || null,
          primaryDomain,
          status: statusRaw as "LEAD" | "ACTIVE" | "ON_HOLD" | "PAST",
          tags: parseTags(row.tags || ""),
          timezone,
          ownerUserId,
          xeroContactId: row.xerocontactid || null,
          trelloBoardId: row.trelloboardid || null,
          trelloListId: row.trellolistid || null
        }
      });
      createdIds.push(client.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed to create client";
      errors.push({ row: rowIndex + 1, error: message });
    }
  }

  await createAuditLog({
    userId: session.user.id,
    action: "CLIENT_IMPORT",
    entityType: "Client",
    entityId: null,
    request: req,
    metadata: {
      totalRows: parsedRows.length - 1,
      createdCount: createdIds.length,
      errorCount: errors.length
    }
  });

  return NextResponse.json({
    ok: true,
    totalRows: parsedRows.length - 1,
    createdCount: createdIds.length,
    errorCount: errors.length,
    errors: errors.slice(0, 50)
  });
}
