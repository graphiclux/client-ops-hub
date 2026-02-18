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

export async function getTrelloBoardsAndLists(token: string) {
  const key = env.TRELLO_API_KEY;
  if (!key) {
    throw new Error("TRELLO_API_KEY is required");
  }

  return withRetry(
    async () => {
      const url = new URL("https://api.trello.com/1/members/me/boards");
      url.searchParams.set("key", key);
      url.searchParams.set("token", token);
      url.searchParams.set("fields", "id,name,url,closed");
      url.searchParams.set("lists", "open");
      url.searchParams.set("list_fields", "id,name,closed");

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" }
      });

      if (!res.ok) {
        throw new Error(`Trello list fetch failed: ${res.status}`);
      }

      const boards = (await res.json()) as Array<{
        id: string;
        name: string;
        url?: string;
        closed?: boolean;
        lists?: Array<{ id: string; name: string; closed?: boolean }>;
      }>;

      return boards
        .filter((board) => !board.closed)
        .map((board) => ({
          id: board.id,
          name: board.name,
          url: board.url || null,
          lists: (board.lists || []).filter((list) => !list.closed).map((list) => ({ id: list.id, name: list.name }))
        }))
        .filter((board) => board.lists.length > 0);
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
    logError("trello.get_boards_lists.failed", error);
    throw error;
  });
}
