# Shoku — Demo Playbook

**For the Shoku team demoing to prospective cafés.** This is the script we run in a live pitch: what to open, in what order, what to say, and how to handle the questions that always come up. Aim for **12–15 minutes** end to end, then Q&A.

All prices in ₹. The demo café is **The Coffee Bean & Tea Leaf (CBTL)** — it has POS enabled, three locations, and ~30 days of realistic sales already loaded, so every chart and report looks real.

---

## 0. Before the call (2-minute setup checklist)

- [ ] Open these tabs in order and sign in ahead of time (nothing kills a demo like a login screen):
  1. **Storefront** — the customer app (`getshoku.com` or the CBTL subdomain)
  2. **Admin → Overview** (`/admin`) — signed in as the café owner
  3. **Admin → POS Billing** (`/admin/pos`)
  4. **Admin → Analytics** (`/admin/analytics`)
  5. **Super-admin → Cafés** (`/super/cafes`) — signed in as Shoku staff
- [ ] Demo logins: owner `demo@shoku.app` / `password`; super-admin `super@shoku.app` / `password`. **Change these before any external/recorded demo.**
- [ ] Have a phone ready (or a second window) to show the storefront as a customer would see it.
- [ ] Know the prospect: single outlet or chain? Currently on Petpooja/Rista? Paying aggregator commission? Tailor emphasis (below).

---

## 1. Open on the pain (60 sec — no screen yet)

> "Right now, every order that comes through Zomato or Swiggy costs you 20–30% in commission. And your billing software — Petpooja, Rista — is a separate system that doesn't know anything about your online customers. Shoku is one branded app: your customers order direct at zero commission, and it doubles as your POS at the counter. Same menu, same loyalty, one dashboard. Let me show you."

Keep it to two sentences of pain, then get on screen fast.

---

## 2. The customer storefront (2–3 min)

Open the **storefront**. Talk track: *"This is the café's own app — their name, their colours, their menu. No 'Shoku' branding, no app to download, it's just a web link on a QR code."*

Show, quickly:
- **Browse the menu** — tap a category, open an item. Point out the **"Know your cup" AI panel** (origin, calories, allergens) — *"this is auto-generated, the café doesn't write it."*
- **Location picker** in the header — *"multi-outlet chains: the customer picks which branch, and the café sees revenue per branch."* (Great moment if the prospect is a chain.)
- **Add to cart → checkout** — show how fast it is. Mention **loyalty points earned**.
- If they have a QR/dine-in angle: mention **scan-at-table ordering**.

**Don't** deep-dive every screen. The storefront's job is to make it feel real and premium.

---

## 3. POS Billing — the wedge (3–4 min) ⭐

This is the differentiator vs a pure ordering app. Open **Admin → POS Billing**.

> "This is the counter. Your cashier rings up walk-ins right here — the same menu as the app."

Do a **live sale**:
1. Tap 3–4 items — show the ticket building on the right.
2. Type a phone number → *"if they're a regular, they earn loyalty on counter purchases too — something Petpooja won't do, because it doesn't know your online customers."*
3. Pick **Cash**, tap **Bill**.
4. The **GST invoice** prints (sequential number, CGST/SGST split, GSTIN) and a **kitchen KOT** goes to the kitchen. *"Proper GST invoicing, day one."*

Then hit **Day-end report**: *"At close, one screen: total sales, cash vs UPI vs card, GST collected, top items — export to CSV for your accountant."*

**The line that lands:** *"You're replacing your billing software AND your aggregator dependence with one system — for less than either costs you."*

---

## 4. Analytics — the owner's daily habit (2 min)

Open **Admin → Analytics**. Flip the **30d** switch.

- **Revenue by day** and **Orders by hour** — *"staff for your real rush, not a guess."*
- **Counter vs online** — *"watch this split shift toward direct, commission-free orders over time."*
- **Revenue by location** — for chains, per-branch performance at a glance.
- **Top items** — menu decisions backed by data.

Message: *"This is why owners open Shoku every morning. It's not just billing — it's the business."*

---

## 5. Onboarding is painless — CSV import (90 sec)

Prospects fear the switch. Kill that fear. Open **Admin → Menu → ⬆ Import CSV**.

> "Moving your menu over is a spreadsheet upload. Name, category, price — and we find a professional photo for every item automatically. You're not photographing 80 items. On higher plans we generate custom AI images."

Show the template + the preview. *"Your whole menu, live in minutes."*

---

## 6. The Shoku control room — super-admin (90 sec)

Switch to **Super-admin → Cafés**. This shows we operate a real platform (reassures on reliability/support).

- The café list with live revenue.
- **Manage** a café → show **plan**, the **POS add-on** toggle, and **AI settings** — *"we tune the AI model and cost to each plan; enterprise chains can even bring their own key."*

Keep it brief — this is *our* view, not theirs. It's a trust signal, not a feature dump.

---

## 7. Close — pricing & next step (2 min)

Anchor value before price: *"One system replacing an aggregator's commission and your billing software."*

- **Starter / Growth / Enterprise** — flat monthly SaaS, **0% commission**, keep 100% of every order.
- **POS add-on** — ₹1,499/mo.
- Next step: *"We can have your branded app and menu live this week. Want me to set up a trial with your actual menu?"*

Always end with a concrete next action + a date.

---

## Tailoring the demo

| Prospect | Lead with | Spend most time on |
|---|---|---|
| Single independent café | Zero commission + own branding | Storefront, POS, onboarding |
| Small chain (2–5 outlets) | Locations + per-branch analytics | Location picker, Analytics |
| Currently on Petpooja/Rista | "One system, not two" + loyalty on counter sales | POS, Day-end, Analytics |
| High delivery volume | Commission math (20–30% saved) | Storefront, the revenue split chart |

## Objection handling

- **"We already have Petpooja."** — *"Keep it if you like — but Petpooja can't take commission-free online orders or run your loyalty across counter and app. Shoku is both, in one."*
- **"Switching sounds like work."** — Show the CSV import. *"Menu's a spreadsheet upload; we handle images. Live this week."*
- **"What about our data?"** — Each café is isolated; the owner sees their own data; exports are one click (Day-end CSV, order history).
- **"Is the AI reliable / expensive?"** — Every AI feature degrades gracefully to sensible defaults if a model is unavailable, and we scale the model to the plan so cost matches value.
- **"No app download?"** — Correct — it's a web app on their own address. One QR, no App Store friction.

## Never do this

- Don't demo on a café with no data — always use **CBTL** (loaded) so charts look alive.
- Don't click into half-built areas or say "this is coming soon" more than once.
- Don't quote a hard discount on the call — anchor value first, take pricing offline if pushed.
- Don't leave the default demo passwords on a recorded or shared session.
