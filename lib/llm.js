// Optional LLM bridge. When OPENAI_API_KEY (or an OpenAI-compatible LLM_API_KEY)
// is set, callers get real model output; otherwise this returns null and callers
// fall back to the built-in heuristics — so every AI feature works with zero
// external dependencies, and upgrades automatically the moment a key is present.
const KEY = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || "";
const BASE = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
const MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

export function llmEnabled() {
  return !!KEY;
}

// Returns a string (or parsed object when json:true), or null on any failure.
export async function llmComplete(system, user, { json = false, max = 600, temperature = 0.7 } = {}) {
  if (!KEY) return null;
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature,
        max_tokens: max,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    return json ? JSON.parse(text) : text;
  } catch {
    return null;
  }
}
