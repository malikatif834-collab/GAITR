"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* Token-only login form (ADR 0005 D6). On success, the API sets the
   ops_token cookie and the proxy.ts lets the operator reach /ops. */

export default function OpsLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/ops";

  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ops/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, next }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.message ?? `login failed: ${res.status}`);
        return;
      }
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          GAITR · Agent Operations
        </p>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Lock className="h-5 w-5" />
          Operator login
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter the OPS_ADMIN_TOKEN configured in the deployment
          environment. Token-only is the Phase 3 shape; real auth lands
          in Phase 5 (ADR 0005 D6).
        </p>
      </header>

      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="ops-login-token" className="text-xs">
            Token
          </Label>
          <Input
            id="ops-login-token"
            type="password"
            autoComplete="off"
            autoFocus
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy || !token} className="w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        {error && (
          <p className="font-mono text-[11px] text-okabe-vermillion">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
