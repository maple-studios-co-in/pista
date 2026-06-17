import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(req) {
  let code = "";
  try {
    code = String((await req.json())?.code || "").toUpperCase().replace(/\s+/g, "");
  } catch {}
  if (!code) return NextResponse.json({ valid: false });

  const tenant = await getCurrentTenant();
  const d = tenant ? await prisma.discount.findFirst({ where: { code, tenantId: tenant.id, active: true } }) : null;
  if (!d) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: true, code: d.code, percent: d.percent });
}
