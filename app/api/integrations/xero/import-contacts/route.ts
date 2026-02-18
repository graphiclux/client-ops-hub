import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { apiError, enforceCsrf } from "@/lib/http";
import { createAuditLog } from "@/lib/security/audit";

type CsvRow = Record<string, string>;

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
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
    row[normalizeHeader(headers[i])] = (values[i] || "").trim();
  }
  return row;
}

function tryExtractDomain(rawWebsite: string) {
  const value = rawWebsite.trim();
  if (!value) return null;

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const hostname = new URL(withProtocol).hostname.toLowerCase();
    return hostname || null;
  } catch {
    return null;
  }
}

function fallbackDomainFromName(name: string, index: number) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "xero-contact"}-${index}.import.local`;
}

export async function POST(req: NextRequest) {
  if (!enforceCsrf(req)) return apiError("CSRF validation failed", 403);

  const session = await auth();
  if (!session?.user) return apiError("Unauthorized", 401);
  if (session.user.role === "READONLY" || session.user.role === "CONTRACTOR") return apiError("Forbidden", 403);

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return apiError("Xero contacts CSV is required", 422);
  }

  const rawText = await file.text();
  const parsedRows = parseCsv(rawText);
  if (parsedRows.length < 2) return apiError("CSV must include header and at least one data row", 422);

  const headers = parsedRows[0];
  const normalizedHeaders = headers.map(normalizeHeader);
  if (!normalizedHeaders.includes("contactname")) {
    return apiError("This does not look like a Xero Contacts export (missing *ContactName)", 422);
  }

  const createdIds: string[] = [];
  const skipped: Array<{ row: number; reason: string }> = [];
  const errors: Array<{ row: number; error: string }> = [];

  for (let rowIndex = 1; rowIndex < parsedRows.length; rowIndex += 1) {
    const row = toRowObject(headers, parsedRows[rowIndex]);

    const contactName = (row.contactname || "").trim();
    const legalName = (row.legalname || "").trim() || null;
    const website = (row.website || "").trim();

    const fallbackName = [row.firstname, row.lastname].map((item) => (item || "").trim()).filter(Boolean).join(" ").trim();
    const finalName = contactName || legalName || fallbackName;

    if (!finalName) {
      skipped.push({ row: rowIndex + 1, reason: "Missing contact name" });
      continue;
    }

    const primaryDomain = tryExtractDomain(website) || fallbackDomainFromName(finalName, rowIndex + 1);

    try {
      const existing = await prisma.client.findFirst({
        where: {
          OR: [{ name: finalName }, { primaryDomain }]
        },
        select: { id: true }
      });

      if (existing) {
        skipped.push({ row: rowIndex + 1, reason: "Already exists" });
        continue;
      }

      const client = await prisma.client.create({
        data: {
          name: finalName,
          legalName,
          primaryDomain,
          status: "ACTIVE",
          tags: ["xero-import"],
          timezone: "UTC",
          ownerUserId: session.user.id
        }
      });

      createdIds.push(client.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create client";
      errors.push({ row: rowIndex + 1, error: message });
    }
  }

  await createAuditLog({
    userId: session.user.id,
    action: "XERO_CONTACTS_IMPORT",
    entityType: "Client",
    entityId: null,
    request: req,
    metadata: {
      totalRows: parsedRows.length - 1,
      createdCount: createdIds.length,
      skippedCount: skipped.length,
      errorCount: errors.length
    }
  });

  return NextResponse.json({
    ok: true,
    totalRows: parsedRows.length - 1,
    createdCount: createdIds.length,
    skippedCount: skipped.length,
    errorCount: errors.length,
    skipped: skipped.slice(0, 50),
    errors: errors.slice(0, 50)
  });
}
