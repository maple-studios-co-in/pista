import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { parseTiers } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const t = await prisma.tenant.findUnique({ where: { id: gate.tenantId } });
  const rewards = await prisma.reward.findMany({ where: { tenantId: gate.tenantId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ earnRate: t?.loyaltyEarnRate ?? 10, tiers: parseTiers(t?.tiers), rewards });
}

export async function PUT(req) {
  const gate = await requireAdmin();
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });
  let b;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const data = {};
  if ("earnRate" in b) data.loyaltyEarnRate = Math.max(0, Math.min(100, Number(b.earnRate) || 0));
  if (Array.isArray(b.tiers)) {
    const clean = b.tiers
      .filter((x) => x && x.name)
      .map((x) => ({ name: String(x.name).slice(0, 30), min: Math.max(0, Number(x.min) || 0) }));
    data.tiers = JSON.stringify(clean);
  }
  const t = await prisma.tenant.update({ where: { id: gate.tenantId }, data });
  return NextResponse.json({ earnRate: t.loyaltyEarnRate, tiers: parseTiers(t.tiers) });
}
