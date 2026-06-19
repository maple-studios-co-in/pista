import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { waMode } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

function maskCfg(provider, cfg) {
  const mask = (v) => (v ? "•".repeat(Math.max(4, Math.min(12, String(v).length))) : "");
  if (provider === "meta") return { phoneId: cfg.phoneId || "", token: mask(cfg.token) };
  if (provider === "twilio") return { sid: cfg.sid || "", token: mask(cfg.token), from: cfg.from || "" };
  if (provider === "bsp") return { url: cfg.url || "", apiKey: mask(cfg.apiKey) };
  return {};
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const tenant = await prisma.tenant.findUnique({ where: { id: gate.tenantId } });
  let cfg = {};
  try {
    cfg = JSON.parse(tenant.waConfig || "{}");
  } catch {}
  return NextResponse.json({
    provider: tenant.waProvider || "",
    enabled: tenant.waEnabled,
    fromName: tenant.waFromName || tenant.storeName || tenant.name || "",
    triggers: tenant.waTriggers,
    nudges: tenant.waNudges,
    mode: waMode(tenant),
    config: maskCfg(tenant.waProvider, cfg),
  });
}

export async function PATCH(req) {
  const gate = await requireAdmin();
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status });

  let b;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const data = {};
  if ("enabled" in b) data.waEnabled = !!b.enabled;
  if ("triggers" in b) data.waTriggers = !!b.triggers;
  if ("nudges" in b) data.waNudges = !!b.nudges;
  if ("fromName" in b) data.waFromName = String(b.fromName || "").slice(0, 60) || null;
  if ("provider" in b) data.waProvider = b.provider ? String(b.provider) : null;

  // Merge new creds onto existing, skipping masked placeholders so a save that
  // doesn't re-enter secrets keeps the stored ones.
  if (b.config && typeof b.config === "object") {
    const cur = await prisma.tenant.findUnique({ where: { id: gate.tenantId }, select: { waConfig: true } });
    let existing = {};
    try {
      existing = JSON.parse(cur?.waConfig || "{}");
    } catch {}
    const merged = { ...existing };
    for (const [k, v] of Object.entries(b.config)) {
      if (v && !/^•+$/.test(String(v))) merged[k] = v;
    }
    data.waConfig = JSON.stringify(merged);
  }

  const tenant = await prisma.tenant.update({ where: { id: gate.tenantId }, data });
  return NextResponse.json({ ok: true, mode: waMode(tenant) });
}
