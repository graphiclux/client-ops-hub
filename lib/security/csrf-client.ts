"use client";

const CSRF_COOKIE_NAME = "csrf_token";

export function getCsrfTokenFromCookie() {
  if (typeof document === "undefined") return "";

  const cookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${CSRF_COOKIE_NAME}=`));

  if (!cookie) return "";
  return decodeURIComponent(cookie.split("=").slice(1).join("="));
}
