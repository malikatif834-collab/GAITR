import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authorizeCron, authorizeOps, bearerFromRequest } from "./auth";

/* Pure tests for the auth helpers — no DB, no network. Manipulates
   env vars per test and restores after. */

const origOps = process.env.OPS_ADMIN_TOKEN;
const origCron = process.env.CRON_SECRET;

beforeEach(() => {
  delete process.env.OPS_ADMIN_TOKEN;
  delete process.env.CRON_SECRET;
});

afterEach(() => {
  if (origOps !== undefined) process.env.OPS_ADMIN_TOKEN = origOps;
  if (origCron !== undefined) process.env.CRON_SECRET = origCron;
});

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://test/", { headers });
}

describe("ops/auth — bearerFromRequest", () => {
  it("parses Authorization: Bearer", () => {
    expect(bearerFromRequest(req({ authorization: "Bearer abc123" }))).toBe(
      "abc123",
    );
  });
  it("parses x-ops-token", () => {
    expect(bearerFromRequest(req({ "x-ops-token": "xyz" }))).toBe("xyz");
  });
  it("returns undefined when neither header is set", () => {
    expect(bearerFromRequest(req())).toBeUndefined();
  });
});

describe("ops/auth — authorizeOps", () => {
  it("rejects when OPS_ADMIN_TOKEN is unset (no surface)", () => {
    expect(authorizeOps(req({ authorization: "Bearer anything" }))).toBe(false);
  });
  it("accepts a matching bearer token", () => {
    process.env.OPS_ADMIN_TOKEN = "secret-A";
    expect(authorizeOps(req({ authorization: "Bearer secret-A" }))).toBe(true);
  });
  it("rejects a mismatched token", () => {
    process.env.OPS_ADMIN_TOKEN = "secret-A";
    expect(authorizeOps(req({ authorization: "Bearer wrong" }))).toBe(false);
  });
  it("rejects empty bearer", () => {
    process.env.OPS_ADMIN_TOKEN = "secret-A";
    expect(authorizeOps(req())).toBe(false);
  });
});

describe("ops/auth — authorizeCron", () => {
  it("accepts CRON_SECRET", () => {
    process.env.CRON_SECRET = "vercel-injected";
    expect(authorizeCron(req({ authorization: "Bearer vercel-injected" }))).toBe(true);
  });
  it("accepts OPS_ADMIN_TOKEN as a fallback (operator override)", () => {
    process.env.OPS_ADMIN_TOKEN = "ops-token";
    expect(authorizeCron(req({ authorization: "Bearer ops-token" }))).toBe(true);
  });
  it("rejects when no header and no env", () => {
    expect(authorizeCron(req())).toBe(false);
  });
  it("rejects a bearer that matches neither secret", () => {
    process.env.CRON_SECRET = "real";
    process.env.OPS_ADMIN_TOKEN = "ops";
    expect(authorizeCron(req({ authorization: "Bearer fake" }))).toBe(false);
  });
});
