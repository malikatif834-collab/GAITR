import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  aiTools,
  alchemyScenarios,
  capabilitySynergies,
  decisionRecords,
} from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const [scenario] = await db
    .select()
    .from(alchemyScenarios)
    .where(eq(alchemyScenarios.id, id))
    .limit(1);

  if (!scenario) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const [decision] = await db
    .select()
    .from(decisionRecords)
    .where(eq(decisionRecords.id, scenario.decisionRecordId))
    .limit(1);

  const tools = scenario.toolIds.length
    ? await db.select().from(aiTools).where(inArray(aiTools.id, scenario.toolIds))
    : [];

  const matchedPatterns = scenario.matchedPatternIds.length
    ? await db
        .select()
        .from(capabilitySynergies)
        .where(inArray(capabilitySynergies.id, scenario.matchedPatternIds))
    : [];

  return NextResponse.json({ scenario, decision, tools, matchedPatterns });
}
