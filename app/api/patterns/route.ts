import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { capabilitySynergies } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const patterns = await db
    .select()
    .from(capabilitySynergies)
    .orderBy(asc(capabilitySynergies.name));
  return NextResponse.json({ patterns });
}
