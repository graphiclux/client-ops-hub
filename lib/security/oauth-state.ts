import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "oauth_state";

export async function issueOauthState(provider: string) {
  const state = `${provider}:${randomUUID()}`;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600
  });
  return state;
}

export async function validateOauthState(state: string) {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME)?.value;
  if (!cookie || cookie !== state) return false;
  cookieStore.delete(COOKIE_NAME);
  return true;
}
