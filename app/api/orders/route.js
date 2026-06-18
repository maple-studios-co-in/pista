import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orders = await prisma.order.findMany({
    where: { userId: session.user.id, tenantId: session.user.tenantId ?? undefined },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  return NextResponse.json(orders);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 400 });
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant || tenant.status !== "active") return NextResponse.json({ error: "This store is currently unavailable." }, { status: 403 });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const lines = Array.isArray(body?.lines) ? body.lines : [];
  if (lines.length === 0) return NextResponse.json({ error: "Cart is empty" }, { status: 400 });

  // Validate items belong to THIS tenant; recompute totals server-side.
  const ids = [...new Set(lines.map((l) => l.id))];
  const dbItems = await prisma.item.findMany({ where: { id: { in: ids }, tenantId } });
  const byId = Object.fromEntries(dbItems.map((i) => [i.id, i]));

  const clean = [];
  for (const l of lines) {
    const it = byId[l.id];
    if (!it) continue;
    const qty = Math.max(1, Math.min(50, Number(l.qty) || 1));
    const unit = Math.max(0, Number(l.unit) || it.price);
    clean.push({ itemId: it.id, name: it.name, size: l.size || "Regular", milk: l.milk || null, unit, qty });
  }
  if (clean.length === 0) return NextResponse.json({ error: "No valid items" }, { status: 400 });

  const subtotal = clean.reduce((s, l) => s + l.unit * l.qty, 0);
  const tax = Math.round(subtotal * 0.05);
  const reward = Math.round(subtotal * 0.05);

  let discount = 0;
  let discountCode = null;
  if (body.discountCode) {
    const code = String(body.discountCode).toUpperCase().replace(/\s+/g, "");
    const promo = await prisma.discount.findFirst({ where: { code, tenantId, active: true } });
    if (promo) {
      discount = Math.round((subtotal * promo.percent) / 100);
      discountCode = promo.code;
    }
  }

  // Loyalty: redeem a reward with points
  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  let loyaltyDiscount = 0;
  let pointsRedeemed = 0;
  let rewardTitle = null;
  if (body.rewardId) {
    const reward = await prisma.reward.findFirst({ where: { id: body.rewardId, tenantId, active: true } });
    if (reward && (dbUser?.points || 0) >= reward.cost) {
      pointsRedeemed = reward.cost;
      rewardTitle = reward.title;
      if (reward.type === "discount") {
        loyaltyDiscount = Math.min(reward.amount, subtotal);
      } else if (reward.type === "freeItem" && reward.itemId) {
        const freeItem = await prisma.item.findFirst({ where: { id: reward.itemId, tenantId } });
        if (freeItem) clean.push({ itemId: freeItem.id, name: `${freeItem.name} (reward)`, size: "Regular", milk: null, unit: 0, qty: 1 });
      }
    }
  }

  const total = subtotal + tax - reward - discount - loyaltyDiscount;

  // Dine-in: associate the order with a table (from the table QR)
  let tableId = null, tableLabel = null;
  if (body.tableId) {
    const table = await prisma.table.findFirst({ where: { id: body.tableId, tenantId, active: true } });
    if (table) { tableId = table.id; tableLabel = table.label; }
  }
  const fulfilment = tableId ? "dinein" : (body.fulfilment || "pickup");

  // Loyalty: earn points by tenant's earn rate (points per ₹100 of subtotal)
  const earnRate = tenant.loyaltyEarnRate ?? 10;
  const pointsEarned = Math.floor((subtotal * earnRate) / 100);

  const order = await prisma.order.create({
    data: {
      tenantId,
      userId: session.user.id,
      subtotal, tax, reward, discount, discountCode, loyaltyDiscount, pointsRedeemed, rewardTitle, total,
      fulfilment,
      tableId, tableLabel,
      payment: body.payment || "upi",
      items: { create: clean },
    },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { points: { increment: pointsEarned - pointsRedeemed } },
  });

  return NextResponse.json({ id: order.id, total: order.total, status: order.status });
}
