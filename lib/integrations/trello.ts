import { env, requireEnv } from "@/lib/env";
import { withRetry, shouldRetryHttpStatus } from "@/lib/retry";
import { logError } from "@/lib/telemetry";

export function trelloAuthUrl(state: string) {
  const key = env.TRELLO_API_KEY;
  if (!key) {
    throw new Error("TRELLO_API_KEY is required for Trello authorization");
  }

  const returnUrl = env.TRELLO_REDIRECT_URI || `${requireEnv("NEXTAUTH_URL")}/settings/integrations/trello-callback`;

  const url = new URL("https://trello.com/1/authorize");
  url.searchParams.set("key", key);
  url.searchParams.set("name", "Client Ops Hub");
  url.searchParams.set("scope", "read,write");
  url.searchParams.set("expiration", "never");
  url.searchParams.set("response_type", "token");
  url.searchParams.set("return_url", `${returnUrl}?state=${encodeURIComponent(state)}`);

  return url.toString();
}

export async function createTrelloCard(params: {
  token: string;
  listId: string;
  name: string;
  desc: string;
}) {
  const key = env.TRELLO_API_KEY;
  if (!key) {
    throw new Error("TRELLO_API_KEY is required");
  }

  return withRetry(
    async () => {
      const res = await fetch("https://api.trello.com/1/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          token: params.token,
          idList: params.listId,
          name: params.name,
          desc: params.desc
        })
      });

      if (!res.ok) {
        throw new Error(`Trello create card failed: ${res.status}`);
      }

      return (await res.json()) as { id: string; url: string };
    },
    {
      retries: 3,
      shouldRetry: (error) => {
        if (!(error instanceof Error)) return false;
        const status = Number(error.message.split(":").pop()?.trim());
        return Number.isFinite(status) && shouldRetryHttpStatus(status);
      }
    }
  ).catch((error) => {
    logError("trello.create_card.failed", error, { listId: params.listId });
    throw error;
  });
}
