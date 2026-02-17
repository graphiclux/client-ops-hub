import { env, requireEnv } from "@/lib/env";
import { withRetry, shouldRetryHttpStatus } from "@/lib/retry";
import { logError } from "@/lib/telemetry";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";

function basicAuthHeader() {
  const encoded = Buffer.from(`${requireEnv("XERO_CLIENT_ID")}:${requireEnv("XERO_CLIENT_SECRET")}`).toString("base64");
  return `Basic ${encoded}`;
}

function shouldRetryXero(error: unknown) {
  if (!(error instanceof Error)) return false;
  const status = Number(error.message.split(":").pop()?.trim());
  return Number.isFinite(status) && shouldRetryHttpStatus(status);
}

export function xeroAuthUrl(state: string) {
  const url = new URL(XERO_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", requireEnv("XERO_CLIENT_ID"));
  url.searchParams.set("redirect_uri", requireEnv("XERO_REDIRECT_URI"));
  url.searchParams.set("scope", "openid profile email accounting.transactions accounting.contacts offline_access");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeXeroCode(code: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: requireEnv("XERO_REDIRECT_URI")
  });

  return withRetry(
    async () => {
      const res = await fetch(XERO_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: basicAuthHeader(),
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      });

      if (!res.ok) {
        throw new Error(`Xero token exchange failed: ${res.status}`);
      }

      return (await res.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        scope: string;
      };
    },
    { retries: 3, shouldRetry: shouldRetryXero }
  ).catch((error) => {
    logError("xero.exchange_code.failed", error);
    throw error;
  });
}

export async function refreshXeroToken(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });

  return withRetry(
    async () => {
      const res = await fetch(XERO_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: basicAuthHeader(),
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      });

      if (!res.ok) {
        throw new Error(`Xero refresh failed: ${res.status}`);
      }

      return res.json();
    },
    { retries: 3, shouldRetry: shouldRetryXero }
  ).catch((error) => {
    logError("xero.refresh_token.failed", error);
    throw error;
  });
}

export async function getXeroTenants(accessToken: string) {
  return withRetry(
    async () => {
      const res = await fetch("https://api.xero.com/connections", {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch Xero tenants: ${res.status}`);
      }

      return (await res.json()) as Array<{ tenantId: string; tenantName: string }>;
    },
    { retries: 3, shouldRetry: shouldRetryXero }
  ).catch((error) => {
    logError("xero.get_tenants.failed", error);
    throw error;
  });
}

export async function getInvoiceSummary(params: {
  accessToken: string;
  tenantId: string;
  xeroContactId: string;
}) {
  const url = new URL("https://api.xero.com/api.xro/2.0/Invoices");
  url.searchParams.set("where", `Contact.ContactID==Guid(\"${params.xeroContactId}\")`);

  return withRetry(
    async () => {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          "Xero-tenant-id": params.tenantId,
          Accept: "application/json"
        }
      });

      if (!res.ok) {
        throw new Error(`Invoice summary failed: ${res.status}`);
      }

      const data = await res.json();
      const invoices = data.Invoices || [];
      const outstanding = invoices.filter((invoice: { AmountDue?: number }) => Number(invoice.AmountDue || 0) > 0);

      return {
        outstandingCount: outstanding.length,
        outstandingTotal: outstanding.reduce((sum: number, invoice: { AmountDue?: number }) => sum + Number(invoice.AmountDue || 0), 0),
        lastInvoiceDate: invoices[0]?.DateString || null
      };
    },
    { retries: 3, shouldRetry: shouldRetryXero }
  ).catch((error) => {
    logError("xero.invoice_summary.failed", error, { tenantId: params.tenantId });
    throw error;
  });
}
