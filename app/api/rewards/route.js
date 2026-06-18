import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Storefront: active rewards for the current café (used at checkout + account).
export async function GET() {
  const tenant = await getCurrentTenant();
  if (!tenant) return NextResponse.json([]);
  const rewards = await prisma.reward.findMany({
    where: { tenantId: tenant.id, active: true },
    orderBy: { cost: "asc" },
  });
  return NextResponse.json(
    rewards.map((r) => ({ id: r.id, title: r.title, type: r.type, cost: r.cost, amount: r.amount, itemName: r.itemName }))
  );
}
