import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSuperadmin();
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 250 });
  return NextResponse.json(
    logs.map((l) => ({
      id: l.id,
      actorEmail: l.actorEmail,
      actorRole: l.actorRole,
      action: l.action,
      target: l.target,
      meta: l.meta ? safeParse(l.meta) : null,
      createdAt: l.createdAt,
    }))
  );
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
