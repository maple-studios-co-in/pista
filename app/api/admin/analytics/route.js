import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Café analytics — last N days (default 30), paid orders only.
export async function GET(req) {
  const gate = await requireAdmin();
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const days = Math.min(90, Math.max(7, parseInt(new URL(req.url).searchParams.get("days") || "30", 10)));

  const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - (days - 1));
  const orders = await prisma.order.findMany({
    where: { tenantId: gate.tenantId, createdAt: { gte: since }, paymentStatus: "paid" },
    include: { items: true },
  });

  // revenue by day
  const byDay = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since); d.setDate(since.getDate() + i);
    byDay.push({ key: d.toDateString(), label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), revenue: 0, orders: 0 });
  }
  const idx = Object.fromEntries(byDay.map((d, i) => [d.key, i]));
  const byHour = Array.from({ length: 24 }, (_, h) => ({ h, orders: 0 }));
  const method = {}; const source = { pos: 0, online: 0 };
  const itemQty = {}; const locs = {};
  let revenue = 0;

  for (const o of orders) {
    const dkey = new Date(o.createdAt).toDateString();
    if (dkey in idx) { byDay[idx[dkey]].revenue += o.total; byDay[idx[dkey]].orders += 1; }
    byHour[new Date(o.createdAt).getHours()].orders += 1;
    const m = o.source === "pos" ? (o.paymentMethod || "cash") : "online";
    method[m] = (method[m] || 0) + o.total;
    source[o.source === "pos" ? "pos" : "online"] += o.total;
    if (o.locationLabel) locs[o.locationLabel] = (locs[o.locationLabel] || 0) + o.total;
    for (const it of o.items) itemQty[it.name] = (itemQty[it.name] || 0) + it.qty;
    revenue += o.total;
  }

  const count = orders.length;
  const half = Math.floor(days / 2);
  const prevRev = byDay.slice(0, half).reduce((s, d) => s + d.revenue, 0);
  const currRev = byDay.slice(days - half).reduce((s, d) => s + d.revenue, 0);
  const growth = prevRev > 0 ? Math.round(((currRev - prevRev) / prevRev) * 100) : null;

  return NextResponse.json({
    days,
    kpis: { revenue, orders: count, aov: count ? Math.round(revenue / count) : 0, growth },
    byDay: byDay.map(({ label, revenue, orders }) => ({ label, revenue, orders })),
    byHour,
    method,
    source,
    locations: Object.entries(locs).map(([label, revenue]) => ({ label, revenue })).sort((a, b) => b.revenue - a.revenue),
    topItems: Object.entries(itemQty).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, qty]) => ({ name, qty })),
  });
}
