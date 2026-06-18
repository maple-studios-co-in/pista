export const DEFAULT_TIERS = [
  { name: "Member", min: 0 },
  { name: "Silver", min: 300 },
  { name: "Gold", min: 800 },
  { name: "Platinum", min: 2000 },
];

export function parseTiers(s) {
  try {
    const t = JSON.parse(s || "[]");
    return Array.isArray(t) && t.length ? t : DEFAULT_TIERS;
  } catch {
    return DEFAULT_TIERS;
  }
}

// Returns the current tier + progress to the next one.
export function tierFor(points, tiers) {
  const t = [...(tiers || DEFAULT_TIERS)].sort((a, b) => a.min - b.min);
  let cur = t[0] || { name: "Member", min: 0 };
  for (const x of t) if (points >= x.min) cur = x;
  const next = t.find((x) => x.min > points) || null;
  return {
    name: cur.name,
    min: cur.min,
    next: next ? { name: next.name, min: next.min, toGo: next.min - points } : null,
  };
}
