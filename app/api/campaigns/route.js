import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { buildAudience } from "@/lib/segments";
import { personalize } from "@/lib/aiMessage";
import { sendWhatsApp, waMode } from "@/lib/whatsapp";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const MAX_SEND = 500;

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { tenantId } = gate;

  const [tenant, campaigns, messages] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.campaign.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.message.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 40 }),
  ]);

  return NextResponse.json({
    mode: waMode(tenant),
    fromName: tenant?.waFromName || tenant?.storeName || tenant?.name || "",
    campaigns,
    messages,
  });
}

export async function POST(req) {
  const gate = await requireAdmin();
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { tenantId, session } = gate;

  let b;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const name = String(b.name || "").trim() || "Untitled campaign";
  const segment = String(b.segment || "all");
  const template = String(b.template || "").trim();
  if (!template) return NextResponse.json({ error: "Message body is required." }, { status: 400 });

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const audience = (await buildAudience(tenantId, segment)).slice(0, MAX_SEND);

  const campaign = await prisma.campaign.create({
    data: { tenantId, name, segment, template, audience: audience.length, status: "draft" },
  });

  let sent = 0;
  for (const c of audience) {
    const body = personalize(template, c, tenant);
    await sendWhatsApp({
      tenant,
      to: c.phone || `demo:${c.email}`,
      body,
      kind: "campaign",
      userId: c.id,
      toName: c.name,
      campaignId: campaign.id,
    });
    sent++;
  }

  await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "sent", sentCount: sent } });
  await logAudit({ session, action: "campaign.send", target: tenant.slug, meta: { name, segment, sent } });

  return NextResponse.json({ id: campaign.id, audience: audience.length, sent, mode: waMode(tenant) });
}
