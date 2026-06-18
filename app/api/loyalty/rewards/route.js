import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

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
  const title = String(b.title || "").trim();
  const cost = Math.max(1, Number(b.cost) || 0);
  const type = b.type === "freeItem" ? "freeItem" : "discount";
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  const data = { tenantId: gate.tenantId, title, type, cost, active: b.active !== false };
  if (type === "discount") {
    data.amount = Math.max(1, Number(b.amount) || 0);
  } else {
    const item = b.itemId ? await prisma.item.findFirst({ where: { id: b.itemId, tenantId: gate.tenantId } }) : null;
    if (!item) return NextResponse.json({ error: "Pick a valid menu item for the free-item reward." }, { status: 400 });
    data.itemId = item.id;
    data.itemName = item.name;
  }
  const reward = await prisma.reward.create({ data });
  return NextResponse.json(reward);
}
