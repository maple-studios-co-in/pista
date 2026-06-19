import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { analyzePlatform, platformNarrative } from "@/lib/aiInsights";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSuperadmin();
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const [tenants, orders, customers] = await Promise.all([
    prisma.tenant.findMany({
      select: { id: true, name: true, slug: true, plan: true, status: true, createdAt: true },
    }),
    prisma.order.findMany({ select: { tenantId: true, total: true, createdAt: true } }),
    prisma.user.count({ where: { role: "customer" } }),
  ]);

  const a = analyzePlatform({ tenants, orders });
  const narrative = await platformNarrative(a);

  return NextResponse.json({ ...a, customers, narrative });
}
