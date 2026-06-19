import { prisma } from "./db";

// Provider-agnostic WhatsApp sender. With no provider/credentials configured a
// café runs in "demo" mode: messages are personalized and logged (so the whole
// flow is demonstrable) but never actually dispatched. Drop real credentials in
// the café's settings to switch a single café to live sending — no code change.

function parseCfg(s) {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
}

function hasCreds(provider, c) {
  if (provider === "meta") return !!(c.phoneId && c.token);
  if (provider === "twilio") return !!(c.sid && c.token && c.from);
  if (provider === "bsp") return !!(c.url && c.apiKey);
  return false;
}

export function waMode(tenant) {
  const p = tenant?.waProvider;
  if (!tenant?.waEnabled || !p) return "demo";
  return hasCreds(p, parseCfg(tenant.waConfig)) ? p : "demo";
}

// --- Provider adapters (only invoked when live creds exist) ---
async function viaMeta(cfg, to, body) {
  const res = await fetch(`https://graph.facebook.com/v19.0/${cfg.phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body } }),
  });
  if (!res.ok) throw new Error(`meta ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const d = await res.json().catch(() => ({}));
  return d?.messages?.[0]?.id || null;
}

async function viaTwilio(cfg, to, body) {
  const auth = Buffer.from(`${cfg.sid}:${cfg.token}`).toString("base64");
  const form = new URLSearchParams({ From: `whatsapp:${cfg.from}`, To: `whatsapp:${to}`, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Messages.json`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${auth}` },
    body: form,
  });
  if (!res.ok) throw new Error(`twilio ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const d = await res.json().catch(() => ({}));
  return d?.sid || null;
}

async function viaBsp(cfg, to, body) {
  // Generic Indian BSP webhook (AiSensy / Interakt / Gupshup style REST endpoint).
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ to, message: body, ...(cfg.extra || {}) }),
  });
  if (!res.ok) throw new Error(`bsp ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const d = await res.json().catch(() => ({}));
  return d?.id || d?.messageId || null;
}

// Sends (or demo-logs) one WhatsApp message and records it. Never throws.
export async function sendWhatsApp({ tenant, to, body, kind = "campaign", userId = null, toName = null, campaignId = null }) {
  const mode = waMode(tenant);
  let status = "demo";
  let provider = mode === "demo" ? null : mode;
  let error = null;

  if (mode !== "demo" && to && !String(to).startsWith("demo")) {
    try {
      const cfg = parseCfg(tenant.waConfig);
      if (mode === "meta") await viaMeta(cfg, to, body);
      else if (mode === "twilio") await viaTwilio(cfg, to, body);
      else await viaBsp(cfg, to, body);
      status = "sent";
    } catch (e) {
      status = "failed";
      error = String(e?.message || e).slice(0, 300);
    }
  }

  return prisma.message.create({
    data: {
      tenantId: tenant.id,
      campaignId,
      userId,
      kind,
      to: to || "(no number)",
      toName,
      body,
      status,
      provider,
      error,
    },
  });
}
