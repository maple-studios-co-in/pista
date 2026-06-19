import { prisma } from "./db";
import { parseTiers, tierFor } from "./loyalty";

// Customer segments a café can target with WhatsApp. Each has a predicate over
// an enriched customer record (see tenantCustomers()).
export const SEGMENTS = [
  { key: "all", label: "All opted-in", desc: "Everyone who allows WhatsApp", emoji: "📣" },
  { key: "loyal", label: "Loyal regulars", desc: "5 or more orders", emoji: "💚" },
  { key: "gold", label: "Gold & above", desc: "Top loyalty tiers", emoji: "🏆" },
  { key: "near_reward", label: "Close to a reward", desc: "Within 80 points of a reward", emoji: "🎁" },
  { key: "lapsed", label: "Lapsed (30d+)", desc: "No order in 30 days", emoji: "🌙" },
  { key: "new", label: "New customers", desc: "Joined in the last 14 days", emoji: "✨" },
];

const DAY = 86400000;

// Returns each customer enriched with order stats + loyalty tier.
export async function tenantCustomers(tenantId) {
  const [users, tenant, rewards, agg] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, role: "customer" },
      select: { id: true, name: true, email: true, phone: true, points: true, waOptIn: true, createdAt: true },
    }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { tiers: true } }),
    prisma.reward.findMany({ where: { tenantId, active: true }, select: { cost: true } }),
    prisma.order.groupBy({
      by: ["userId"],
      where: { tenantId },
      _count: { _all: true },
      _sum: { total: true },
      _max: { createdAt: true },
    }),
  ]);

  const tiers = parseTiers(tenant?.tiers);
  const minReward = rewards.length ? Math.min(...rewards.map((r) => r.cost)) : null;
  const byUser = Object.fromEntries(agg.map((a) => [a.userId, a]));
  const now = Date.now();

  return users.map((u) => {
    const a = byUser[u.id];
    const orderCount = a?._count?._all || 0;
    const spend = a?._sum?.total || 0;
    const lastOrder = a?._max?.createdAt ? new Date(a._max.createdAt) : null;
    const daysSinceOrder = lastOrder ? Math.floor((now - lastOrder.getTime()) / DAY) : null;
    const daysSinceJoin = Math.floor((now - new Date(u.createdAt).getTime()) / DAY);
    const tier = tierFor(u.points, tiers).name;
    const toReward = minReward != null ? minReward - u.points : null;
    return { ...u, orderCount, spend, lastOrder, daysSinceOrder, daysSinceJoin, tier, toReward };
  });
}

export function inSegment(c, key) {
  switch (key) {
    case "all":
      return true;
    case "loyal":
      return c.orderCount >= 5;
    case "gold":
      return c.tier === "Gold" || c.tier === "Platinum";
    case "near_reward":
      return c.toReward != null && c.toReward <= 80; // close to, or already past
    case "lapsed":
      return c.daysSinceOrder != null && c.daysSinceOrder >= 30;
    case "new":
      return c.daysSinceJoin <= 14 && c.orderCount <= 1;
    default:
      return true;
  }
}

// Opted-in customers in a segment. (Phone optional — demo mode logs anyway.)
export async function buildAudience(tenantId, segmentKey) {
  const customers = await tenantCustomers(tenantId);
  return customers.filter((c) => c.waOptIn && inSegment(c, segmentKey));
}

export async function segmentCounts(tenantId) {
  const customers = await tenantCustomers(tenantId);
  const opted = customers.filter((c) => c.waOptIn);
  return SEGMENTS.map((s) => ({ ...s, count: opted.filter((c) => inSegment(c, s.key)).length }));
}
