"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to Client Ops Hub</CardTitle>
          <p className="text-sm text-muted-foreground">Use your Graphiclux Google Workspace account</p>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => signIn("google", { callbackUrl: "/clients" })}>
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
