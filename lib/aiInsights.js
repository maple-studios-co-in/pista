import { llmComplete } from "./llm";

// Indicative monthly subscription per plan (₹). Used for MRR + forecast.
export const PLAN_PRICE = { starter: 1499, growth: 3999, enterprise: 9999 };

const DAY = 86400000;

function monthKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key) {
  const [y, m] = key.split("-");
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short" });
}

// Build the last `n` month buckets ending this month.
function monthSeries(n, now = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: monthKey(d), label: monthLabel(monthKey(d)), revenue: 0, orders: 0, cafes: 0 });
  }
  return out;
}

// Core analytics. tenants: [{id,name,slug,plan,status,createdAt}], orders:[{tenantId,total,createdAt}]
export function analyzePlatform({ tenants, orders, now = new Date() }) {
  const months = 6;
  const rev = monthSeries(months, now);
  const idx = Object.fromEntries(rev.map((m, i) => [m.key, i]));

  // Revenue & orders by month
  for (const o of orders) {
    const k = monthKey(o.createdAt);
    if (k in idx) {
      rev[idx[k]].revenue += o.total;
      rev[idx[k]].orders += 1;
    }
  }
  // New cafés by month
  for (const t of tenants) {
    const k = monthKey(t.createdAt);
    if (k in idx) rev[idx[k]].cafes += 1;
  }

  // MRR by plan (active + trial cafés)
  const mrrByPlan = {};
  let mrr = 0;
  for (const t of tenants) {
    if (t.status === "suspended") continue;
    const price = PLAN_PRICE[t.plan] ?? PLAN_PRICE.growth;
    mrrByPlan[t.plan] = (mrrByPlan[t.plan] || 0) + price;
    mrr += price;
  }

  // Per-café order recency + revenue for at-risk detection
  const lastOrder = {};
  const tRev = {};
  for (const o of orders) {
    const ts = new Date(o.createdAt).getTime();
    if (!lastOrder[o.tenantId] || ts > lastOrder[o.tenantId]) lastOrder[o.tenantId] = ts;
    tRev[o.tenantId] = (tRev[o.tenantId] || 0) + o.total;
  }
  const nowMs = now.getTime();
  const atRisk = [];
  for (const t of tenants) {
    if (t.status === "suspended") {
      atRisk.push({ name: t.name, slug: t.slug, plan: t.plan, reason: "Suspended account", severity: "high" });
      continue;
    }
    const last = lastOrder[t.id];
    const days = last ? Math.floor((nowMs - last) / DAY) : null;
    if (days == null) {
      const age = Math.floor((nowMs - new Date(t.createdAt).getTime()) / DAY);
      if (age >= 14) atRisk.push({ name: t.name, slug: t.slug, plan: t.plan, reason: "No orders since signup", severity: "high" });
    } else if (days >= 21) {
      atRisk.push({ name: t.name, slug: t.slug, plan: t.plan, reason: `No orders in ${days} days`, severity: days >= 45 ? "high" : "med" });
    }
  }
  atRisk.sort((a, b) => (a.severity === "high" ? -1 : 1) - (b.severity === "high" ? -1 : 1));

  // Forecast next-month revenue: weighted recent growth on the trailing series
  const series = rev.map((m) => m.revenue);
  const forecast = projectNext(series);
  const last3 = series.slice(-3);
  const prev3 = series.slice(-6, -3);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const momGrowth = sum(prev3) > 0 ? (sum(last3) - sum(prev3)) / sum(prev3) : 0;

  return {
    months: rev,
    totals: {
      cafes: tenants.length,
      active: tenants.filter((t) => t.status === "active").length,
      trial: tenants.filter((t) => t.status === "trial").length,
      revenue: orders.reduce((s, o) => s + o.total, 0),
      orders: orders.length,
      mrr,
      arr: mrr * 12,
    },
    mrrByPlan,
    atRisk,
    forecast: { nextMonth: forecast, momGrowth },
    topCafes: tenants
      .map((t) => ({ name: t.name, slug: t.slug, plan: t.plan, revenue: tRev[t.id] || 0 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6),
  };
}

// Simple robust projection: last value adjusted by average recent growth, floored at 0.
function projectNext(series) {
  const s = series.filter((_, i) => i >= series.length - 4);
  if (s.length < 2) return Math.round(series[series.length - 1] || 0);
  let growth = 0;
  let n = 0;
  for (let i = 1; i < s.length; i++) {
    if (s[i - 1] > 0) {
      growth += (s[i] - s[i - 1]) / s[i - 1];
      n++;
    }
  }
  const g = n ? Math.max(-0.5, Math.min(0.6, growth / n)) : 0;
  return Math.max(0, Math.round((s[s.length - 1] || 0) * (1 + g)));
}

function inr(n) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

// Narrative "what changed & why" — LLM when available, else a data-grounded summary.
export async function platformNarrative(a) {
  const m = a.months;
  const cur = m[m.length - 1];
  const prev = m[m.length - 2] || cur;
  const facts = {
    thisMonthRevenue: cur.revenue,
    lastMonthRevenue: prev.revenue,
    thisMonthOrders: cur.orders,
    newCafesThisMonth: cur.cafes,
    mrr: a.totals.mrr,
    atRisk: a.atRisk.length,
    forecastNext: a.forecast.nextMonth,
    momGrowthPct: Math.round(a.forecast.momGrowth * 100),
  };

  const llm = await llmComplete(
    "You are a SaaS analytics co-pilot for a café ordering platform. Given JSON metrics, write 3 short, specific bullet insights (plain text, no markdown bullets, one per line) a founder would act on. Mention concrete numbers. Be candid about risks.",
    JSON.stringify(facts),
    { max: 260, temperature: 0.5 }
  );
  if (llm) return { source: "ai", lines: llm.split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean).slice(0, 4) };

  const lines = [];
  const dRev = cur.revenue - prev.revenue;
  const pct = prev.revenue > 0 ? Math.round((dRev / prev.revenue) * 100) : (cur.revenue > 0 ? 100 : 0);
  lines.push(
    `Revenue this month is ${inr(cur.revenue)} across ${cur.orders} orders — ${dRev >= 0 ? "up" : "down"} ${Math.abs(pct)}% vs last month (${inr(prev.revenue)}).`
  );
  lines.push(
    `Recurring revenue stands at ${inr(a.totals.mrr)} MRR (${inr(a.totals.arr)} ARR) from ${a.totals.active} active cafés; ${cur.cafes} new café${cur.cafes === 1 ? "" : "s"} joined this month.`
  );
  if (a.atRisk.length) {
    lines.push(
      `${a.atRisk.length} café${a.atRisk.length === 1 ? "" : "s"} look at-risk (e.g. ${a.atRisk[0].name} — ${a.atRisk[0].reason.toLowerCase()}). A check-in or win-back campaign is worth queuing.`
    );
  } else {
    lines.push(`No cafés are currently flagged at-risk — retention looks healthy.`);
  }
  lines.push(`At the current trend, next month projects to about ${inr(a.forecast.nextMonth)} in order revenue.`);
  return { source: "heuristic", lines };
}
