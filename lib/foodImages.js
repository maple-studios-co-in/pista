// Keyword → curated food photography (Unsplash IDs already used across the app,
// so they're known-good). Used by the menu importer so cafés get decent images
// with zero effort; AI generation (lib/imageGen) overrides when configured.

const POOL = [
  // [keywords, photoId] — order matters: more specific terms are listed first
  // so e.g. "chai latte" matches chai, not the generic latte rule below.
  [["matcha", "green tea"], "1568649929103-28ffbefaca1e"],
  [["masala", "chai", "tea latte"], "1571934811356-5cc061b6821f"],
  [["iced tea", "lemon tea", "black tea", "green iced"], "1499638673689-79a0b5115d87"],
  [["ice blended", "frappe", "shake", "cold coffee", "smoothie", "cold brew", "iced"], "1461023058943-07fcbe16d735"],
  [["espresso", "americano", "black coffee", "long black", "filter"], "1551030173-122aabc4489c"],
  [["cappuccino"], "1534778101976-62847782c213"],
  [["mocha", "chocolate", "cocoa", "brownie"], "1572490122747-3968b75cc699"],
  [["latte", "flat white", "cortado"], "1572442388796-11668a67e53d"],
  [["croissant", "pastry", "danish", "puff", "bake", "muffin", "cookie", "cake"], "1555507036-ab1f4038808a"],
  [["sandwich", "wrap", "toast", "panini", "burger", "roll"], "1539252554453-80ab65ce3586"],
];
const DEFAULT_DRINK = "1536256263959-770b48d82b0a";
const DEFAULT_FOOD = "1517256064527-09c73fc73e38";

export function imageFor(name = "", categoryLabel = "") {
  const hay = `${name} ${categoryLabel}`.toLowerCase();
  for (const [keys, id] of POOL) {
    if (keys.some((k) => hay.includes(k))) return url(id);
  }
  const foodish = /food|bake|snack|meal|kitchen|dessert|breakfast|lunch/.test(hay);
  return url(foodish ? DEFAULT_FOOD : DEFAULT_DRINK);
}

const url = (id) => `https://images.unsplash.com/photo-${id}?w=700&q=80`;
