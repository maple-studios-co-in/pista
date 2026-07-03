"use client";

import { useEffect, useState } from "react";
import { formatINR } from "@/lib/menu";

// Lightweight SVG charts — no external chart lib.
function Bars({ data, x, y, fmt = (v) => v, color = "#3A6B4D", height = 150 }) {
  const max = Math.max(1, ...data.map((d) => d[y]));
  const step = Math.max(1, Math.ceil(data.length / 10)); // label every Nth
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="group relative flex-1 rounded-t"
            style={{ height: `${(d[y] / max) * 100}%`, background: color, minWidth: 3 }}>
            <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] text-white group-hover:block">
              {d[x]}: {fmt(d[y])}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        {data.filter((_, i) => i % step === 0).map((d, i) => <span key={i}>{d[x]}</span>)}
      </div>
    </div>
  );
}

function HRow({ label, value, max, fmt, color = "#3A6B4D" }) {
  return (
    <div className="mb-2 grid grid-cols-[110px_1fr_74px] items-center gap-2 text-[12.5px]">
      <span className="truncate">{label}</span>
      <div className="h-3.5 overflow-hidden rounded-full bg-canvas">
        <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
      <b className="text-right tabular-nums">{fmt(value)}</b>
    </div>
  );
}

const Card = ({ title, note, children }) => (
  <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
    <h3 className="text-sm font-bold">{title}</h3>
    {note && <p className="mb-3 mt-0.5 text-[12px] text-muted">{note}</p>}
    {children}
  </div>
);

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/admin/analytics?days=${days}`)
      .then((r) => (r.ok ? r.json() : r.json().then((e) => Promise.reject(e.error))))
      .then(setD)
      .catch((e) => setErr(String(e)));
  }, [days]);

  if (err) return <div className="p-8 text-sm text-red-600">{err}</div>;
  if (!d) return <div className="p-8 text-sm text-muted">Loading analytics…</div>;

  const methodEntries = Object.entries(d.method).sort((a, b) => b[1] - a[1]);
  const mMax = Math.max(1, ...methodEntries.map(([, v]) => v));
  const iMax = Math.max(1, ...d.topItems.map((t) => t.qty));
  const lMax = Math.max(1, ...(d.locations.length ? d.locations.map((l) => l.revenue) : [1]));
  const srcTotal = Math.max(1, d.source.pos + d.source.online);

  return (
    <div className="mx-auto max-w-5xl p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <div className="ml-auto flex gap-1 rounded-xl border border-line bg-white p-1">
          {[7, 30, 90].map((n) => (
            <button key={n} onClick={() => setDays(n)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold ${days === n ? "bg-brand text-white" : "text-muted"}`}>
              {n}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Revenue", formatINR(d.kpis.revenue)],
          ["Orders", d.kpis.orders],
          ["Avg order", formatINR(d.kpis.aov)],
          ["Trend", d.kpis.growth === null ? "—" : `${d.kpis.growth > 0 ? "+" : ""}${d.kpis.growth}%`],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <div className="font-serif text-xl font-semibold">{v}</div>
            <div className="mt-1 text-[12px] text-muted">{l}{l === "Trend" ? " (vs prior half)" : ""}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4">
        <Card title={`Revenue by day — last ${d.days} days`}>
          <Bars data={d.byDay} x="label" y="revenue" fmt={formatINR} />
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Orders by hour" note="When your counter is busiest">
            <Bars data={d.byHour.map((h) => ({ ...h, label: `${h.h}:00` }))} x="label" y="orders" color="#C2643C" height={120} />
          </Card>
          <Card title="Counter vs online" note="Revenue share by channel">
            <div className="mb-2 flex h-6 overflow-hidden rounded-full">
              <div className="grid place-items-center bg-brand text-[10.5px] font-bold text-white" style={{ width: `${(d.source.pos / srcTotal) * 100}%` }}>
                {Math.round((d.source.pos / srcTotal) * 100)}%
              </div>
              <div className="grid flex-1 place-items-center bg-accent text-[10.5px] font-bold text-white">
                {Math.round((d.source.online / srcTotal) * 100)}%
              </div>
            </div>
            <div className="mb-4 flex justify-between text-[12px] text-muted">
              <span>■ POS {formatINR(d.source.pos)}</span><span>Online {formatINR(d.source.online)} ■</span>
            </div>
            {methodEntries.map(([m, v]) => (
              <HRow key={m} label={m.toUpperCase()} value={v} max={mMax} fmt={formatINR} />
            ))}
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Top items" note="By quantity sold">
            {d.topItems.map((t) => <HRow key={t.name} label={t.name} value={t.qty} max={iMax} fmt={(v) => `×${v}`} color="#C2643C" />)}
          </Card>
          <Card title="Revenue by location" note={d.locations.length ? "Across your outlets" : "Add locations in Settings to split revenue by outlet"}>
            {d.locations.map((l) => <HRow key={l.label} label={l.label} value={l.revenue} max={lMax} fmt={formatINR} />)}
            {!d.locations.length && <div className="text-[13px] text-muted">No location data yet.</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}
