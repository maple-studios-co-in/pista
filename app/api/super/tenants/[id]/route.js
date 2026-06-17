import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  const gate = await requireSuperadmin();
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let b;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const allowed = ["name", "status", "plan", "brandHex", "darkHex", "font", "storeName", "address"];
  const data = {};
  for (const k of allowed) if (k in b) data[k] = b[k];

  const tenant = await prisma.tenant.update({ where: { id: params.id }, data });
  return NextResponse.json({ id: tenant.id, status: tenant.status, plan: tenant.plan });
}
