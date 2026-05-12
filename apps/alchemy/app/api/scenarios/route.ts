import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { alchemyScenarios } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const scenarios = await db
    .select()
    .from(alchemyScenarios)
    .orderBy(desc(alchemyScenarios.createdAt))
    .limit(50);
  return NextResponse.json({ scenarios });
}
