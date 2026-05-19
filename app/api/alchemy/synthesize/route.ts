import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { synthesizeScenario } from "@/lib/alchemy/synthesize";
import { SynthesizeRequestSchema } from "@/lib/alchemy/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid-json", message: "Body must be valid JSON." },
      { status: 400 },
    );
  }

  let parsed;
  try {
    parsed = SynthesizeRequestSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "validation-failed", issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  try {
    const result = await synthesizeScenario(parsed.toolIds);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "synthesis-failed";
    return NextResponse.json(
      { error: "synthesis-failed", message },
      { status: 500 },
    );
  }
}
