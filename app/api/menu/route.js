import { NextResponse } from "next/server";
import { prisma, parseItem } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  const tenant = await getCurrentTenant();
  if (!tenant) return NextResponse.json({ categories: [], items: [] });

  const [categories, items] = await Promise.all([
    prisma.category.findMany({ where: { tenantId: tenant.id }, orderBy: { sort: "asc" } }),
    prisma.item.findMany({
      where: { tenantId: tenant.id, ...(all ? {} : { live: true }) },
      orderBy: [{ sort: "asc" }],
      include: { category: true },
    }),
  ]);

  return NextResponse.json({
    categories: categories.map((c) => ({ id: c.id, label: c.label })),
    items: items.map(parseItem),
  });
}
