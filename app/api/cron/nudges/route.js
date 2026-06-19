import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tenantCustomers } from "@/lib/segments";
import { sendWhatsApp } from "@/lib/whatsapp";
import { personalize } from "@/lib/aiMessage";

export const dynamic = "force-dynamic";

const DAY = 86400000;

// Runs the automated reward-close + win-back nudges across all cafés that have
// nudges enabled. Auth: superadmin session, or a CRON_SECRET (header x-cron-key
// or ?key=) so it can be wired to a scheduler / GitHub Action.
async function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(req.url);
    if (url.searchParams.get("key") === secret || req.headers.get("x-cron-key") === secret) return true;
  }
  const session = await getServerSession(authOptions);
  return session?.user?.role === "superadmin";
}

async function run(req) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenants = await prisma.tenant.findMany({ where: { status: "active", waNudges: true } });
  const since = new Date(Date.now() - 7 * DAY);
  let total = 0;
  const perTenant = [];

  for (const tenant of tenants) {
    const customers = await tenantCustomers(tenant.id);
    const recent = await prisma.message.findMany({
      where: { tenantId: tenant.id, kind: "nudge", createdAt: { gte: since } },
      select: { userId: true },
    });
    const recentSet = new Set(recent.map((r) => r.userId));

    let sent = 0;
    for (const c of customers) {
      if (!c.waOptIn || recentSet.has(c.id)) continue;
      let body = null;
      if (c.toReward != null && c.toReward >= 1 && c.toReward <= 60) {
        body = personalize("Hi {name}, you're just {toReward} points from a reward at {brand} 🎁 One more visit and it's yours!", c, tenant);
      } else if (c.daysSinceOrder != null && c.daysSinceOrder >= 30 && c.daysSinceOrder <= 60) {
        body = personalize("Hi {name}, we miss you at {brand} ☕ Here's 15% off your next order this week — come say hi!", c, tenant);
      }
      if (!body) continue;
      await sendWhatsApp({ tenant, to: c.phone || `demo:${c.email}`, body, kind: "nudge", userId: c.id, toName: c.name });
      sent++;
      if (sent >= 200) break;
    }
    total += sent;
    perTenant.push({ slug: tenant.slug, sent });
  }

  return NextResponse.json({ ok: true, totalSent: total, tenants: perTenant });
}

export async function POST(req) {
  return run(req);
}
export async function GET(req) {
  return run(req);
}
