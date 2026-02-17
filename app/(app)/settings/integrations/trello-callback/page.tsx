"use client";

import { useEffect, useState } from "react";
import { getCsrfTokenFromCookie } from "@/lib/security/csrf-client";

export default function TrelloCallbackPage() {
  const [status, setStatus] = useState("Completing Trello connection...");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get("token");
    const url = new URL(window.location.href);
    const state = url.searchParams.get("state");

    if (!token || !state) {
      setStatus("Missing Trello token/state. Please retry from Integrations.");
      return;
    }

    const csrf = getCsrfTokenFromCookie();

    fetch("/api/integrations/trello/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ token, state })
    })
      .then((res) => {
        if (!res.ok) throw new Error("Trello connect failed");
        window.location.href = "/settings/integrations?trello=connected";
      })
      .catch(() => setStatus("Trello connect failed. Please retry."));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 text-center">
      <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-soft">
        <p className="text-sm text-muted-foreground">{status}</p>
      </div>
    </main>
  );
}
