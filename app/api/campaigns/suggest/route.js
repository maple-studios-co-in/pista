import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { suggestCopy } from "@/lib/aiMessage";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const gate = await requireAdmin();
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let b;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: gate.tenantId } });
  const copy = await suggestCopy({
    tenant,
    goal: String(b.goal || "promo"),
    segmentLabel: String(b.segmentLabel || "customers"),
    notes: String(b.notes || "").slice(0, 200),
  });
  return NextResponse.json({ copy });
}
