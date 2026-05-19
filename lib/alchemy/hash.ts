import { createHash } from "node:crypto";

/**
 * Canonical SHA-256 of any JSON-serializable value. Object keys are sorted
 * recursively so semantically-equal inputs always hash identically.
 */
export function canonicalHash(value: unknown): string {
  return createHash("sha256")
    .update(canonicalStringify(value))
    .digest("hex");
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`).join(",")}}`;
}
