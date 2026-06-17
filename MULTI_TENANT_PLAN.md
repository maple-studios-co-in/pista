# Pista — Multi-Tenant Architecture Plan

Turning Pista from a single ordering app into a **SaaS platform** where Pista (the
company) provisions and manages many cafés, each with its own branded storefront,
menu, customers and admin dashboard.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Storefront URL model | **Subdomain per cafe** — `cbtl.pista…`, `bluetokai.pista…` |
| Onboarding | **Pista-provisioned** — super-admin creates each cafe + owner |
| Customer accounts | **Per cafe** — isolated; each cafe owns its diners |
| This deliverable | **Plan only** — build after approval |

---

## 1. The three surfaces

One Next.js app serves three audiences, separated by hostname:

| Surface | Host | Who | What |
| --- | --- | --- | --- |
| **Platform / marketing + Super-admin** | `pista…` (apex) + `console.pista…` | Pista staff | Marketing site; **super-admin** to manage cafés, plans, platform analytics |
| **Cafe storefront** | `<cafe>.pista…` | Diners | Branded menu, AI, cart, checkout, account — scoped to that cafe |
| **Cafe admin** | `<cafe>.pista…/admin` | Cafe owner/staff | The existing dashboard, scoped to that cafe only |

---

## 2. Tenancy model — shared database, row-level isolation

A single database where every cafe-owned row carries a `tenantId`. This is the
right fit for this scale (simpler than schema-per-tenant or db-per-tenant) as long
as **every query is scoped by tenant** through a shared helper (see §5).

- New top-level model: **`Tenant`** (a cafe).
- Add `tenantId` to: `Category`, `Item`, `Order`, `Discount`, and tenant `User`s.
- The current `Brand` (white-label config) becomes **per-tenant** (fields folded
  into `Tenant`, or a `Brand` row per `tenantId`).

---

## 3. Roles & auth

Four roles:

| Role | Scope | Can do |
| --- | --- | --- |
| `superadmin` | Global (no tenant) | Manage all cafés, plans, platform analytics, impersonate |
| `owner` | One tenant | Full cafe admin (menu, orders, branding, discounts, staff) |
| `staff` | One tenant | Limited cafe admin (e.g. orders + menu, no branding/billing) |
| `customer` | One tenant | Order, view own orders, rewards |

Session (JWT) carries `role` + `tenantId` (null for superadmin). Guards:
`requireSuperadmin()`, `requireTenantAdmin(tenantId)`, plus the existing customer
session check. Customer email becomes **unique per tenant** (composite
`@@unique([tenantId, email])`) so the same person can be a customer at two cafés.

---

## 4. Tenant resolution (subdomain → tenant)

Next.js **middleware** parses the host and passes the cafe slug downstream; the DB
lookup happens in the server layer (Prisma can't run in edge middleware).

```js
// middleware.js (sketch)
const host = req.headers.get("host");               // cbtl.pista.maplestudios.co.in
const base = "pista.maplestudios.co.in";
const sub  = host.endsWith(base) ? host.slice(0, -(base.length + 1)) : "";

if (!sub || sub === "www")        -> marketing / platform context (no tenant)
else if (RESERVED.has(sub))       -> console/superadmin or 404
else  -> rewrite with header  x-tenant-slug = sub
```

Reserved subdomains (never assignable to a cafe): `www`, `console`, `admin`,
`api`, `app`, `mail`, `assets`, `static`. Then a cached server helper resolves the
record:

```js
// lib/tenant.js
export const getTenant = cache(async (slug) =>
  prisma.tenant.findUnique({ where: { slug } }));   // 404 / "suspended" page if missing/inactive
```

Storefront layout + every tenant API reads `x-tenant-slug` (via `headers()`),
resolves the tenant, and scopes all data to `tenant.id`.

---

## 5. Query scoping (the security-critical part)

All tenant data flows through helpers that **inject `tenantId`** so a request for
cafe A can never read cafe B's rows:

```js
// every storefront/cafe-admin query
prisma.item.findMany({ where: { tenantId, live: true } })
prisma.order.findMany({ where: { tenantId, userId } })
```

A thin wrapper (`tenantDb(tenantId)`) or lint rule ensures no tenant query is
written without a `tenantId`. Super-admin queries are the only ones allowed to
span tenants, behind `requireSuperadmin()`.

---

## 6. Data model changes (Prisma sketch)

```prisma
model Tenant {
  id         String   @id @default(cuid())
  name       String
  slug       String   @unique          // subdomain label, e.g. "cbtl"
  status     String   @default("active") // active | trial | suspended
  plan       String   @default("growth") // starter | growth | enterprise
  // white-label (moved from Brand)
  brandHex   String   @default("#7AB04A")
  darkHex    String   @default("#36511F")
  font       String   @default("Inter")
  aiAssistant Boolean @default(true)
  aiCards     Boolean @default(true)
  aiUpsell    Boolean @default(true)
  aiLoyalty   Boolean @default(false)
  // store info
  storeName  String?
  address    String?
  createdAt  DateTime @default(now())

  categories Category[]
  items      Item[]
  orders     Order[]
  discounts  Discount[]
  users      User[]
}

model User {
  id        String  @id @default(cuid())
  tenantId  String?                       // null for superadmin
  tenant    Tenant? @relation(fields: [tenantId], references: [id])
  email     String
  password  String
  name      String?
  role      String  @default("customer")  // superadmin | owner | staff | customer
  points    Int     @default(0)
  // ...
  @@unique([tenantId, email])             // email unique *within* a cafe
}

// Category, Item, Order, Discount: each gains
//   tenantId String
//   tenant   Tenant @relation(fields: [tenantId], references: [id])
//   + indexes on tenantId
```

---

## 7. Super-admin dashboard (Pista) — `console.pista…`

The new piece. Features:

- **Cafés list** — every tenant: name, subdomain, plan, status, #orders, revenue,
  signup date. Search/filter.
- **Create a café (provisioning)** — name + slug → creates the tenant, seeds
  default categories (and optionally a starter menu), creates the **owner** account
  (temp password / invite), and triggers SSL for the new subdomain (see §10).
- **Edit café** — plan, status (activate/suspend/trial), white-label defaults,
  owner contact.
- **Suspend / reactivate** — suspended cafés show a "store unavailable" page.
- **Platform analytics** — revenue + orders across all cafés, active cafés, growth,
  top cafés, MRR by plan.
- **Impersonate / "view as"** — open a café's admin or storefront to support them
  (audit-logged).
- **Audit log** — who provisioned/suspended what, and impersonation events.

Routes: `/super` (or the `console.` host) → `/super`, `/super/cafes`,
`/super/cafes/[id]`, `/super/cafes/new`, `/super/analytics`, `/super/audit`.

---

## 8. Cafe admin — mostly the dashboard you already have

The existing `/admin` (overview, orders, menu, customers, discounts, branding,
settings) stays — every page/API just gets **scoped to the logged-in admin's
`tenantId`**. The "Branding" page now edits that café's white-label record. No new
screens needed; it's a scoping pass over existing code.

---

## 9. Storefront — tenant-aware

The customer app (`/`, `/menu`, `/item`, `/ai`, `/cart`, `/checkout`, `/account`)
loads the **tenant's** brand (colours/font applied via the existing CSS-variable
system) and the **tenant's** menu, and writes orders/customers against that
tenant. The current marketing landing moves to the apex host; cafe subdomains show
the storefront instead.

---

## 10. Infrastructure — wildcard subdomains + TLS on your VPS

**DNS:** add a wildcard A record so any cafe subdomain hits the VPS:

```
*.pista   A   <your-vps-ip>     (in maplestudios.co.in DNS)
```

**Nginx:** one server block handles all cafe subdomains, proxying to the app:

```nginx
server {
    server_name ~^(?<sub>.+)\.pista\.maplestudios\.co\.in$;
    location / { proxy_pass http://127.0.0.1:3000; /* + forwarded headers */ }
}
```

**TLS — two options:**

- **A. Per-subdomain certs (recommended now).** When a café is provisioned, run
  `certbot --nginx -d <slug>.pista.maplestudios.co.in` (HTTP-01, no DNS API
  needed). Simple; just one automated step in the provisioning flow.
- **B. Wildcard cert** for `*.pista.maplestudios.co.in` — one cert for all, but
  requires a **DNS-01** challenge (e.g. `acme.sh` with the Hostinger DNS API).
  Cleaner at scale; more setup. Start with A, move to B later.

The app process itself doesn't change — still one PM2 service on port 3000.

---

## 11. Migration plan (existing data → first tenant)

Non-destructive, ordered so the current live cafe keeps working:

1. Add `Tenant` model + nullable `tenantId` columns (`prisma migrate`).
2. Create the **first tenant** from today's `Brand`/data (e.g. slug `cbtl` or a
   demo cafe); copy the current Brand fields into it.
3. **Backfill** `tenantId` on all existing `Category`, `Item`, `Order`, `Discount`,
   and customer `User` rows to that tenant.
4. Promote the current admin to `owner` of that tenant; create a separate
   **superadmin** account (global).
5. Make `tenantId` non-null; switch `User` email uniqueness to `@@unique([tenantId, email])`.
6. Point that tenant's subdomain (e.g. `cbtl.pista…`) and issue its cert.

A one-off script (`prisma/migrate-to-multitenant.js`) does steps 2–5.

---

## 12. Security considerations

- **Isolation:** every tenant query carries `tenantId`; no raw client-supplied
  `tenantId` is trusted — it always comes from the resolved host/session.
- **Cross-tenant IDOR:** fetch-by-id always adds `AND tenantId = …`.
- **Cookie/session isolation:** host-only cookies per subdomain keep café sessions
  separate; superadmin lives on its own host.
- **Reserved slugs** + slug validation (lowercase, dns-safe, blocklist).
- **Impersonation is audit-logged** and clearly indicated in the UI.

---

## 13. Key technical risk to validate first

**NextAuth across many hosts.** The current setup uses a single `NEXTAUTH_URL`.
Multi-subdomain auth needs either:

- Upgrade to **Auth.js v5** with `trustHost: true` (handles dynamic host cleanly), or
- Keep v4 but resolve tenant in `authorize()` from the request host and set
  cookie/callback handling per host.

Recommendation: do a small spike on this in Phase 1 before building broadly, since
it underpins every login.

---

## 14. Phased roadmap

| Phase | Scope | Outcome |
| --- | --- | --- |
| **1 — Foundation** | `Tenant` model, `tenantId` everywhere, tenant resolution middleware, query-scoping helpers, NextAuth multi-host spike, migrate current data into one tenant | Existing cafe runs unchanged, now as "tenant #1" |
| **2 — Super-admin** | `console.` surface: list/create/suspend cafés, provisioning (seed + owner + cert), platform analytics, impersonation, audit log | Pista can onboard & manage cafés |
| **3 — Storefront/admin polish** | Per-tenant branding fully wired, suspended/empty states, staff role, owner invites | Production-ready white-label |
| **4 — Infra at scale** | Wildcard cert (DNS-01), provisioning automation, backups per tenant | Smooth scaling |
| **5 — Later** | Billing/plans (Stripe/Razorpay), self-serve signup, custom domains, per-tenant data export | Commercial platform |

---

## 15. Open questions for later

- **Billing:** manual/offline at first, or wire a payment provider for plans?
- **Custom domains** (`order.thecafe.com`): Phase 5, on top of subdomains.
- **Data residency / export:** per-tenant export + delete for offboarding.
- **Plan limits:** enforce item/outlet caps per plan tier?
