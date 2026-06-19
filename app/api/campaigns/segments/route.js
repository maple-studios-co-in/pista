import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { segmentCounts } from "@/lib/segments";
import { GOALS } from "@/lib/aiMessage";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const segments = await segmentCounts(gate.tenantId);
  return NextResponse.json({ segments, goals: GOALS });
}
