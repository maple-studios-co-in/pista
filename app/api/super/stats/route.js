import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSuperadmin();
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const [tenants, orders, customers] = await Promise.all([
    prisma.tenant.findMany(),
    prisma.order.findMany({ select: { total: true, tenantId: true } }),
    prisma.user.count({ where: { role: "customer" } }),
  ]);

  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const active = tenants.filter((t) => t.status === "active").length;

  const byTenant = {};
  for (const o of orders) byTenant[o.tenantId] = (byTenant[o.tenantId] || 0) + o.total;
  const topCafes = tenants
    .map((t) => ({ name: t.name, slug: t.slug, revenue: byTenant[t.id] || 0 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  const planMix = {};
  for (const t of tenants) planMix[t.plan] = (planMix[t.plan] || 0) + 1;

  return NextResponse.json({
    tenants: tenants.length,
    active,
    revenue,
    orders: orders.length,
    customers,
    topCafes,
    planMix,
  });
}
