"use client";

import { FormEvent, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getCsrfTokenFromCookie } from "@/lib/security/csrf-client";

export default function SettingsPasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password must match.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const csrf = getCsrfTokenFromCookie();
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(csrf ? { "x-csrf-token": csrf } : {})
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const body = (await res.json().catch(() => null)) as { error?: string } | null;

    setLoading(false);

    if (!res.ok) {
      setError(body?.error || "Unable to change password");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess("Password updated.");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-semibold">Password</h2>
      <Card>
        <CardHeader>
          <CardTitle>Reset Your Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit}>
            <Input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="New password (12+ chars)"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={12}
              required
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={12}
              required
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            {success && <p className="text-xs text-emerald-600">{success}</p>}
            <Button disabled={loading || !currentPassword || !newPassword || !confirmPassword}>
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
