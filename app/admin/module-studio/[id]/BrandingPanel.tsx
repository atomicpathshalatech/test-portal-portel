"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Profile = { id: string; name: string };

export default function BrandingPanel({
  moduleId,
  currentBrandProfileId,
}: {
  moduleId: string;
  currentBrandProfileId: string | null;
}) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState(currentBrandProfileId || "");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(!!currentBrandProfileId);

  useEffect(() => {
    fetch("/api/module-studio/brand-profiles")
      .then((r) => r.json())
      .then((d) => setProfiles(d.profiles || []));
  }, []);

  async function apply() {
    if (!selected) return;
    setApplying(true);
    const res = await fetch(`/api/module-studio/${moduleId}/apply-branding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandProfileId: selected }),
    });
    setApplying(false);
    if (res.ok) {
      setApplied(true);
      router.refresh();
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700">Branding</h2>
        <Link href="/admin/module-studio/brand-settings" className="text-xs text-indigo-600">
          Manage brand profiles
        </Link>
      </div>

      {profiles.length === 0 ? (
        <p className="text-sm text-slate-400">
          No brand profiles yet —{" "}
          <Link href="/admin/module-studio/brand-settings" className="text-indigo-600">
            create one
          </Link>
          .
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Select a brand profile…</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={apply} disabled={!selected || applying}>
            {applying ? "Applying…" : applied ? "Re-apply" : "Apply Branding"}
          </button>
          {applied && <span className="text-emerald-600 text-sm">Applied ✓</span>}
        </div>
      )}
      <p className="text-xs text-slate-400 mt-2">
        Applies header/footer/watermark to every page as locked elements. Re-applying replaces
        the previous branding, not additive.
      </p>
    </div>
  );
}
