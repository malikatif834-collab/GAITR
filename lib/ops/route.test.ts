import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as cronTick } from "@/app/api/cron/orchestrator/tick/route";
import { POST as opsTick } from "@/app/api/ops/tick/route";

/* Smoke tests for the cron + ops tick route handlers. Auth-gating
   assertions (401 vs OK) don't need a DB — they short-circuit before
   any DB call. The 200 cases that actually run a tick are gated on
   DATABASE_URL so CI without Postgres still gets meaningful coverage. */

const origOps = process.env.OPS_ADMIN_TOKEN;
const origCron = process.env.CRON_SECRET;

beforeEach(() => {
  delete process.env.OPS_ADMIN_TOKEN;
  delete process.env.CRON_SECRET;
});

afterEach(() => {
  if (origOps !== undefined) process.env.OPS_ADMIN_TOKEN = origOps;
  else delete process.env.OPS_ADMIN_TOKEN;
  if (origCron !== undefined) process.env.CRON_SECRET = origCron;
  else delete process.env.CRON_SECRET;
});

const HAS_DB = !!process.env.DATABASE_URL;

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://test/", { method: "POST", headers });
}

describe("/api/cron/orchestrator/tick — auth", () => {
  it("401s without a token", async () => {
    const res = await cronTick(req());
    expect(res.status).toBe(401);
  });

  it("401s with a wrong token", async () => {
    process.env.CRON_SECRET = "real";
    const res = await cronTick(req({ authorization: "Bearer fake" }));
    expect(res.status).toBe(401);
  });

  it.skipIf(!HAS_DB)(
    "200s with CRON_SECRET and returns a TickReport",
    async () => {
      process.env.CRON_SECRET = "real";
      const res = await cronTick(req({ authorization: "Bearer real" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tickId).toBeTypeOf("string");
      expect(body.reason).toBe("cron");
      expect(body.planned).toBeTypeOf("number");
    },
  );

  it.skipIf(!HAS_DB)(
    "200s with OPS_ADMIN_TOKEN as fallback",
    async () => {
      process.env.OPS_ADMIN_TOKEN = "ops-only";
      const res = await cronTick(req({ authorization: "Bearer ops-only" }));
      expect(res.status).toBe(200);
    },
  );
});

describe("/api/ops/tick — auth", () => {
  it("401s when OPS_ADMIN_TOKEN is unset", async () => {
    const res = await opsTick(req({ authorization: "Bearer anything" }));
    expect(res.status).toBe(401);
  });

  it("401s with a wrong token", async () => {
    process.env.OPS_ADMIN_TOKEN = "right";
    const res = await opsTick(req({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
  });

  it.skipIf(!HAS_DB)(
    "200s with matching OPS_ADMIN_TOKEN and reports reason='manual'",
    async () => {
      process.env.OPS_ADMIN_TOKEN = "right";
      const res = await opsTick(req({ authorization: "Bearer right" }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.reason).toBe("manual");
    },
  );
});
