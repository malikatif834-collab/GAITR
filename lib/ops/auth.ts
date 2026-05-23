/**
 * Auth helpers for the Phase-3 ops surface (ADR 0005 D6). v1 is a
 * shared env-var bearer token; Phase 5 / ADR 0006 swaps the token for a
 * real session and per-user audit.
 *
 * Contract:
 *   - `OPS_ADMIN_TOKEN` unset → middleware 404s the entire /ops surface.
 *     The route handlers below treat unset env as "no one is authorized."
 *   - Bearer header parsing accepts either "Authorization: Bearer X" or
 *     a raw "X-Ops-Token: X" header (Vercel cron uses the former; the
 *     ops page uses the cookie set by /api/ops/login).
 *   - Cron endpoint also accepts the Vercel-injected CRON_SECRET, so a
 *     deploy without OPS_ADMIN_TOKEN still lets the scheduled cron run.
 */

export const OPS_COOKIE = "ops_token";
export const OPS_COOKIE_TTL_SECONDS = 12 * 60 * 60;

export function opsAdminToken(): string | undefined {
  return process.env.OPS_ADMIN_TOKEN;
}

export function cronSecret(): string | undefined {
  return process.env.CRON_SECRET;
}

export function bearerFromRequest(request: Request): string | undefined {
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const xToken = request.headers.get("x-ops-token");
  if (xToken) return xToken.trim();
  return undefined;
}

export function authorizeOps(request: Request): boolean {
  const token = opsAdminToken();
  if (!token) return false;
  const provided = bearerFromRequest(request);
  return provided === token;
}

export function authorizeCron(request: Request): boolean {
  const provided = bearerFromRequest(request);
  if (!provided) return false;
  const cron = cronSecret();
  if (cron && provided === cron) return true;
  const ops = opsAdminToken();
  if (ops && provided === ops) return true;
  return false;
}
