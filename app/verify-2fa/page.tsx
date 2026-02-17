"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCsrfTokenFromCookie } from "@/lib/security/csrf-client";

export default function Verify2FAPage() {
  const [code, setCode] = useState("");
  const [rememberBrowser, setRememberBrowser] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onVerify() {
    setLoading(true);
    setError("");

    const csrf = getCsrfTokenFromCookie();
    const res = await fetch("/api/verify-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ code, rememberBrowser })
    });

    setLoading(false);

    if (!res.ok) {
      setError("Invalid code. Please try again.");
      return;
    }

    window.location.href = "/clients";
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Two-factor verification</CardTitle>
          <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="123456" value={code} onChange={(event) => setCode(event.target.value)} maxLength={6} />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border border-border"
              checked={rememberBrowser}
              onChange={(event) => setRememberBrowser(event.target.checked)}
            />
            Remember this browser
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={onVerify} className="w-full" disabled={loading || code.length !== 6}>
            {loading ? "Verifying..." : "Verify 2FA"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
