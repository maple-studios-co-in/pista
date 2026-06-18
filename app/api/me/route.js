import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseTiers, tierFor } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, tenantId: true, points: true, _count: { select: { orders: true } } },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let tier = null;
  if (user.tenantId) {
    const t = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { tiers: true } });
    tier = tierFor(user.points, parseTiers(t?.tiers));
  }

  return NextResponse.json({
    id: user.id, name: user.name, email: user.email, role: user.role,
    tenantId: user.tenantId, points: user.points, orders: user._count.orders, tier,
  });
}
