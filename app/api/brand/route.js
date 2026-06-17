import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

function toBrand(t) {
  if (!t) return null;
  return {
    name: t.name,
    brandHex: t.brandHex,
    darkHex: t.darkHex,
    font: t.font,
    subdomain: t.slug,
    aiAssistant: t.aiAssistant,
    aiCards: t.aiCards,
    aiUpsell: t.aiUpsell,
    aiLoyalty: t.aiLoyalty,
    storeName: t.storeName,
    address: t.address,
  };
}

export async function GET() {
  const tenant = await getCurrentTenant();
  return NextResponse.json(toBrand(tenant) || {});
}

export async function PUT(req) {
  const gate = await requireAdmin();
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const allowed = ["name", "brandHex", "darkHex", "font", "aiAssistant", "aiCards", "aiUpsell", "aiLoyalty", "storeName", "address"];
  const data = {};
  for (const k of allowed) if (k in body) data[k] = body[k];

  const tenant = await prisma.tenant.update({ where: { id: gate.tenantId }, data });
  return NextResponse.json(toBrand(tenant));
}
