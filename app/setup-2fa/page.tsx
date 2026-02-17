"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCsrfTokenFromCookie } from "@/lib/security/csrf-client";

export default function Setup2FAPage() {
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const csrf = getCsrfTokenFromCookie();

    fetch("/api/setup-2fa/init", {
      method: "POST",
      headers: {
        "x-csrf-token": csrf
      }
    })
      .then((res) => res.json())
      .then((data) => {
        setQr(data.qrCodeDataUrl);
        setSecret(data.secret);
      })
      .catch(() => setError("Failed to initialize 2FA"));
  }, []);

  async function onVerify() {
    setError("");
    const csrf = getCsrfTokenFromCookie();
    const normalizedCode = code.trim();

    const res = await fetch("/api/setup-2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ code: normalizedCode, secret })
    });

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error || "Failed to enable 2FA. Try again.");
      return;
    }

    window.location.href = "/clients";
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Mandatory 2FA Setup</CardTitle>
          <p className="text-sm text-muted-foreground">Scan QR with your authenticator app, then verify one code.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {qr && <Image src={qr} alt="2FA QR" width={224} height={224} className="mx-auto h-56 w-56 rounded-xl border border-border p-2" />}
          {secret && <p className="rounded-xl bg-muted p-3 text-xs">Manual code: {secret}</p>}
          <Input placeholder="123456" value={code} onChange={(event) => setCode(event.target.value)} maxLength={6} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={onVerify} className="w-full">
            Verify and Enable 2FA
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
