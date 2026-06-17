"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SectionCard, Stat, formatINR } from "@/components/AdminUI";

export default function PlatformOverview() {
  const [s, setS] = useState(null);

  useEffect(() => {
    fetch("/api/super/stats").then((r) => (r.ok ? r.json() : null)).then(setS).catch(() => {});
  }, []);

  if (!s) return <div className="text-sm text-muted">Loading platform…</div>;

  const maxRev = Math.max(1, ...s.topCafes.map((c) => c.revenue));

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform overview</h1>
          <p className="text-sm text-muted">Across all cafés on Pista.</p>
        </div>
        <Link href="/super/cafes" className="rounded-xl bg-brand px-4 py-2.5 text-[13px] font-bold text-white">Manage cafés →</Link>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Cafés" value={s.tenants} sub={`${s.active} active`} icon="🏪" />
        <Stat label="Platform revenue" value={formatINR(s.revenue)} icon="💰" />
        <Stat label="Orders" value={s.orders} icon="🧾" />
        <Stat label="Customers" value={s.customers} icon="👥" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Top cafés by revenue">
          <div className="p-4">
            {s.topCafes.length === 0 && <div className="text-sm text-muted">No cafés yet.</div>}
            {s.topCafes.map((c) => (
              <div key={c.slug} className="mb-3 last:mb-0">
                <div className="mb-1 flex justify-between text-[13px]">
                  <span className="font-semibold">{c.name} <span className="text-muted">· {c.slug}</span></span>
                  <span className="text-muted">{formatINR(c.revenue)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-canvas">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${(c.revenue / maxRev) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Plans">
          <div className="p-4">
            {Object.keys(s.planMix).length === 0 && <div className="text-sm text-muted">—</div>}
            {Object.entries(s.planMix).map(([plan, n]) => (
              <div key={plan} className="flex items-center justify-between border-b border-line py-2.5 text-[13px] capitalize last:border-0">
                <span className="font-semibold">{plan}</span>
                <span className="text-muted">{n} café{n > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
