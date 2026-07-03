import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getTenantLLMConfig } from "./llm";

// AI menu-image generation (OpenAI-compatible /images/generations).
// Saves to public/uploads/menu/ and returns the public path, or null on any
// failure — callers always fall back to the curated pool (lib/foodImages).
export async function generateMenuImage(tenant, itemName, desc = "") {
  const cfg = getTenantLLMConfig(tenant);
  if (!cfg.key) return null;
  try {
    const res = await fetch(`${cfg.base}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({
        model: cfg.imageModel,
        prompt: `Professional café menu photography of ${itemName}${desc ? ` — ${desc}` : ""}. Top-down on a warm ceramic plate or cup, marble café table, soft natural window light, shallow depth of field, appetizing, no text, no people.`,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return null;

    const dir = path.join(process.cwd(), "public", "uploads", "menu");
    fs.mkdirSync(dir, { recursive: true });
    const file = `${tenant.slug}-${crypto.createHash("md5").update(itemName).digest("hex").slice(0, 10)}.png`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(b64, "base64"));
    return `/uploads/menu/${file}`;
  } catch {
    return null;
  }
}
