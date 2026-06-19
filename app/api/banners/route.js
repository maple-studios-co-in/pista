import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Public: active banners for the current café (used by the live menu app).
// Admin (?manage=1): all banners for the signed-in café.
export async function GET(req) {
  const manage = new URL(req.url).searchParams.get("manage") === "1";
  if (manage) {
    const gate = await requireAdmin();
    if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });
    const banners = await prisma.banner.findMany({ where: { tenantId: gate.tenantId }, orderBy: [{ sort: "asc" }, { createdAt: "desc" }] });
    return NextResponse.json(banners);
  }
  const tenant = await getCurrentTenant();
  if (!tenant) return NextResponse.json([]);
  const banners = await prisma.banner.findMany({
    where: { tenantId: tenant.id, active: true },
    orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json(banners.map((b) => ({ id: b.id, title: b.title, subtitle: b.subtitle, imageUrl: b.imageUrl, link: b.link })));
}

export async function POST(req) {
  const gate = await requireAdmin();
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });
  let b;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const imageUrl = String(b.imageUrl || "").trim();
  if (!imageUrl) return NextResponse.json({ error: "An image is required." }, { status: 400 });
  if (imageUrl.length > 3_000_000) return NextResponse.json({ error: "Image is too large (max ~2MB)." }, { status: 400 });

  const count = await prisma.banner.count({ where: { tenantId: gate.tenantId } });
  const banner = await prisma.banner.create({
    data: {
      tenantId: gate.tenantId,
      title: b.title ? String(b.title).slice(0, 80) : null,
      subtitle: b.subtitle ? String(b.subtitle).slice(0, 120) : null,
      imageUrl,
      link: b.link ? String(b.link).slice(0, 300) : null,
      active: b.active !== false,
      sort: count,
    },
  });
  return NextResponse.json(banner);
}
