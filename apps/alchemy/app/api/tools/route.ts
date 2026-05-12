import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { aiTools } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const tools = await db.select().from(aiTools).orderBy(asc(aiTools.name));
  return NextResponse.json({ tools });
}
