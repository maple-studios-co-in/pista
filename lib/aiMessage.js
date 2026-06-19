import { llmComplete } from "./llm";

// Personalized WhatsApp copy. Templates use tokens: {name} {brand} {tier} {points}.
// personalize() fills tokens per-customer (cheap, deterministic). suggestCopy()
// drafts a campaign template from a goal — via LLM when available, else a
// curated heuristic library.

function firstName(c) {
  return ((c?.name || "").trim().split(/\s+/)[0] || "there").replace(/[^\p{L}\p{N}'-]/gu, "");
}

export function personalize(template, customer, tenant) {
  const brand = tenant?.storeName || tenant?.name || "our café";
  return String(template || "")
    .replace(/\{name\}/gi, firstName(customer))
    .replace(/\{brand\}/gi, brand)
    .replace(/\{tier\}/gi, customer?.tier || "Member")
    .replace(/\{points\}/gi, String(customer?.points ?? 0))
    .replace(/\{toReward\}/gi, String(Math.max(0, customer?.toReward ?? 0)))
    .trim();
}

// Goal-driven starter templates (used as LLM fallback and as quick-pick chips).
export const GOALS = [
  { key: "winback", label: "Win back lapsed customers", segment: "lapsed" },
  { key: "reward", label: "Nudge toward a reward", segment: "near_reward" },
  { key: "vip", label: "Thank loyal regulars", segment: "loyal" },
  { key: "promo", label: "Announce an offer", segment: "all" },
  { key: "newdrop", label: "New menu / seasonal drop", segment: "all" },
];

const HEURISTIC = {
  winback: "Hi {name}, we miss you at {brand}! ☕ It's been a while — here's 15% off your next order this week. Tap to reorder your favourite.",
  reward: "Hi {name}! You're just {toReward} points away from a free reward at {brand}. One more visit and it's yours. 🎁",
  vip: "Hi {name}, thank you for being one of our {tier} regulars at {brand} 💚 Your next coffee is on us — show this message at the counter.",
  promo: "Hi {name}! Today only at {brand}: buy any coffee, get a pastry for ₹1. 🥐 Order ahead to skip the queue.",
  newdrop: "Hi {name}, something new just landed at {brand} ✨ Our seasonal menu is live — be one of the first to try it.",
};

export async function suggestCopy({ tenant, goal = "promo", segmentLabel = "customers", notes = "" }) {
  const brand = tenant?.storeName || tenant?.name || "the café";
  const system =
    "You are a marketing copywriter for independent cafés. Write ONE short, warm WhatsApp message (max 240 chars, 1 emoji max), using the tokens {name} and {brand} verbatim where natural. No markdown, no quotes around the message.";
  const user = `Café: ${brand}. Goal: ${goal}. Audience: ${segmentLabel}. ${notes ? "Notes: " + notes : ""}`.trim();
  const out = await llmComplete(system, user, { max: 160, temperature: 0.8 });
  if (out) return out.replace(/^["']|["']$/g, "").trim();
  return HEURISTIC[goal] || HEURISTIC.promo;
}
