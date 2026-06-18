import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const tables = await prisma.table.findMany({
    where: { tenantId: gate.tenantId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { orders: true } } },
  });
  return NextResponse.json(tables.map((t) => ({ id: t.id, label: t.label, active: t.active, orders: t._count.orders })));
}

export async function POST(req) {
  const gate = await requireAdmin();
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });
  let b;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const label = String(b.label || "").trim().slice(0, 30);
  if (!label) return NextResponse.json({ error: "Table name is required." }, { status: 400 });
  const table = await prisma.table.create({ data: { tenantId: gate.tenantId, label } });
  return NextResponse.json(table);
}
