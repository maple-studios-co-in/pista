"use client";

import { useState } from "react";
import { useBrand } from "@/components/Providers";
import { BRAND } from "@/lib/menu";
import { SectionCard } from "@/components/AdminUI";

function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} className={`relative h-6 w-10 rounded-full ${on ? "bg-brand" : "bg-gray-300"}`}>
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${on ? "right-1" : "left-1"}`} />
    </button>
  );
}

export default function SettingsPage() {
  const { brand, setBrand, saveBrand } = useBrand();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (key) => { setBrand({ ...brand, [key]: !brand[key] }); setSaved(false); };

  // Locations editor: setLoc(i, null) removes; setLoc(length, {..}) appends.
  const setLoc = (i, val) => {
    const next = [...(brand.locations || [])];
    if (val === null) next.splice(i, 1);
    else next[i] = val;
    setBrand({ ...brand, locations: next });
    setSaved(false);
  };

  async function publish() {
    setSaving(true);
    await saveBrand(brand);
    setSaving(false);
    setSaved(true);
  }

  const AI = [
    ["aiAssistant", "AI ordering assistant", 'Chat-based "what should I eat" recommendations'],
    ["aiCards", "Food intelligence cards", "Auto-generate origin, ingredients, allergens & nutrition"],
    ["aiUpsell", "Smart upsell & pairings", "Suggest add-ons in the cart based on the order"],
    ["aiLoyalty", "AI loyalty rewards", "Personalised discounts to drive repeat visits"],
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted">Store details and AI feature flags.</p>
        </div>
        <button onClick={publish} disabled={saving} className="rounded-xl bg-brand-dark px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-50">
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
        </button>
      </header>

      <SectionCard title="Store" className="mb-6">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-ink/70">Store name</label>
            <input className="w-full rounded-lg border border-line px-3 py-2.5 text-[13px] outline-none focus:border-brand" value={brand.storeName || ""} placeholder={BRAND.store}
              onChange={(e) => { setBrand({ ...brand, storeName: e.target.value }); setSaved(false); }} />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-ink/70">Address</label>
            <input className="w-full rounded-lg border border-line px-3 py-2.5 text-[13px] outline-none focus:border-brand" value={brand.address || ""} placeholder={BRAND.address}
              onChange={(e) => { setBrand({ ...brand, address: e.target.value }); setSaved(false); }} />
          </div>
          <Info label="Subdomain" value={brand.subdomain || "—"} />
          <Info label="Currency" value="INR (₹)" />
        </div>
      </SectionCard>

      <SectionCard title="Locations" className="mb-6">
        <div className="p-5">
          <p className="mb-3 text-[12.5px] text-muted">Outlets your customers can pick from in the app header. Analytics splits revenue by location.</p>
          {(brand.locations || []).map((l, i) => (
            <div key={l.id || i} className="mb-2 flex gap-2">
              <input className="w-40 rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-brand" value={l.label} placeholder="Label (e.g. Indiranagar)"
                onChange={(e) => setLoc(i, { ...l, label: e.target.value })} />
              <input className="flex-1 rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-brand" value={l.address || ""} placeholder="Address"
                onChange={(e) => setLoc(i, { ...l, address: e.target.value })} />
              <button onClick={() => setLoc(i, null)} className="rounded-lg border border-line px-3 text-[13px] font-bold text-red-600">✕</button>
            </div>
          ))}
          <button onClick={() => setLoc((brand.locations || []).length, { id: `loc-${Date.now()}`, label: "", address: "" })}
            className="mt-1 rounded-xl border border-line bg-canvas px-3.5 py-2 text-[13px] font-bold">+ Add location</button>
        </div>
      </SectionCard>

      <SectionCard title="AI features">
        {AI.map(([key, title, desc], i) => (
          <div key={key} className={`flex items-center gap-3 px-5 py-4 ${i ? "border-t border-line" : ""}`}>
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold">{title}</div>
              <div className="text-[12px] text-muted">{desc}</div>
            </div>
            <Toggle on={!!brand[key]} onClick={() => toggle(key)} />
          </div>
        ))}
      </SectionCard>

      <p className="mt-6 text-center text-[11px] text-muted">Shoku white-label platform · settings persist to your brand workspace.</p>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-[12px] font-semibold text-muted">{label}</div>
      <div className="mt-0.5 text-[14px] font-semibold">{value}</div>
    </div>
  );
}
