"use client";
import { useEffect, useState } from "react";

type Profile = {
  id: string;
  name: string;
  logoUrl: string | null;
  tagline: string | null;
  websiteUrl: string | null;
  headerConfig: any;
  footerConfig: any;
  watermarkConfig: any;
};

const EMPTY: Omit<Profile, "id"> = {
  name: "",
  logoUrl: "",
  tagline: "",
  websiteUrl: "",
  headerConfig: { enabled: true, brandName: "", tagline: "", showSubjectClass: true },
  footerConfig: { enabled: true, leftText: "", centerText: "", rightText: "", showPageNumber: true },
  watermarkConfig: { enabled: false, text: "", opacity: 0.12, rotation: -30 },
};

export default function BrandSettingsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<Profile | (typeof EMPTY & { id?: undefined }) | null>(null);
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  function load() {
    fetch("/api/module-studio/brand-profiles")
      .then((r) => r.json())
      .then((d) => setProfiles(d.profiles || []));
  }
  useEffect(load, []);

  async function save() {
    if (!editing) return;
    setStatus("saving");
    const isNew = !editing.id;
    const res = await fetch(
      isNew ? "/api/module-studio/brand-profiles" : `/api/module-studio/brand-profiles/${editing.id}`,
      {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      }
    );
    setStatus("idle");
    if (res.ok) {
      setEditing(null);
      load();
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Brand Settings</h1>
        {!editing && (
          <button className="btn-primary" onClick={() => setEditing({ ...EMPTY })}>
            + New Brand Profile
          </button>
        )}
      </div>

      {!editing && (
        <div className="space-y-3">
          {profiles.length === 0 && <p className="text-slate-400 text-sm">No brand profiles yet.</p>}
          {profiles.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-slate-900">{p.name}</p>
                <p className="text-xs text-slate-400">
                  {p.headerConfig?.enabled ? "Header on" : "Header off"} ·{" "}
                  {p.footerConfig?.enabled ? "Footer on" : "Footer off"} ·{" "}
                  {p.watermarkConfig?.enabled ? "Watermark on" : "Watermark off"}
                </p>
              </div>
              <button className="btn-secondary text-sm" onClick={() => setEditing(p)}>
                Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Profile Name</label>
            <input
              className="input w-full"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
          </div>

          <fieldset className="bg-white border border-slate-200 rounded-2xl p-4">
            <legend className="text-sm font-semibold text-slate-700 px-1">Header</legend>
            <label className="flex items-center gap-2 text-sm mb-3">
              <input
                type="checkbox"
                checked={editing.headerConfig?.enabled}
                onChange={(e) =>
                  setEditing({ ...editing, headerConfig: { ...editing.headerConfig, enabled: e.target.checked } })
                }
              />
              Apply header to pages
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                className="input"
                placeholder="Brand name (e.g. Atomic Pathshala)"
                value={editing.headerConfig?.brandName || ""}
                onChange={(e) =>
                  setEditing({ ...editing, headerConfig: { ...editing.headerConfig, brandName: e.target.value } })
                }
              />
              <input
                className="input"
                placeholder="Tagline (e.g. LEARN • EXPLORE • EXCEL)"
                value={editing.headerConfig?.tagline || ""}
                onChange={(e) =>
                  setEditing({ ...editing, headerConfig: { ...editing.headerConfig, tagline: e.target.value } })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm mt-3">
              <input
                type="checkbox"
                checked={editing.headerConfig?.showSubjectClass}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    headerConfig: { ...editing.headerConfig, showSubjectClass: e.target.checked },
                  })
                }
              />
              Show subject / class on the right
            </label>
          </fieldset>

          <fieldset className="bg-white border border-slate-200 rounded-2xl p-4">
            <legend className="text-sm font-semibold text-slate-700 px-1">Footer</legend>
            <label className="flex items-center gap-2 text-sm mb-3">
              <input
                type="checkbox"
                checked={editing.footerConfig?.enabled}
                onChange={(e) =>
                  setEditing({ ...editing, footerConfig: { ...editing.footerConfig, enabled: e.target.checked } })
                }
              />
              Apply footer to pages
            </label>
            <div className="grid grid-cols-3 gap-3">
              <input
                className="input"
                placeholder="Left text"
                value={editing.footerConfig?.leftText || ""}
                onChange={(e) =>
                  setEditing({ ...editing, footerConfig: { ...editing.footerConfig, leftText: e.target.value } })
                }
              />
              <input
                className="input"
                placeholder="Center text"
                value={editing.footerConfig?.centerText || ""}
                onChange={(e) =>
                  setEditing({ ...editing, footerConfig: { ...editing.footerConfig, centerText: e.target.value } })
                }
              />
              <input
                className="input"
                placeholder="Right text"
                value={editing.footerConfig?.rightText || ""}
                onChange={(e) =>
                  setEditing({ ...editing, footerConfig: { ...editing.footerConfig, rightText: e.target.value } })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm mt-3">
              <input
                type="checkbox"
                checked={editing.footerConfig?.showPageNumber}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    footerConfig: { ...editing.footerConfig, showPageNumber: e.target.checked },
                  })
                }
              />
              Show page number
            </label>
          </fieldset>

          <fieldset className="bg-white border border-slate-200 rounded-2xl p-4">
            <legend className="text-sm font-semibold text-slate-700 px-1">Watermark</legend>
            <label className="flex items-center gap-2 text-sm mb-3">
              <input
                type="checkbox"
                checked={editing.watermarkConfig?.enabled}
                onChange={(e) =>
                  setEditing({ ...editing, watermarkConfig: { ...editing.watermarkConfig, enabled: e.target.checked } })
                }
              />
              Apply watermark to pages
            </label>
            <div className="grid grid-cols-3 gap-3">
              <input
                className="input col-span-2"
                placeholder="Watermark text"
                value={editing.watermarkConfig?.text || ""}
                onChange={(e) =>
                  setEditing({ ...editing, watermarkConfig: { ...editing.watermarkConfig, text: e.target.value } })
                }
              />
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                max="1"
                placeholder="Opacity (0-1)"
                value={editing.watermarkConfig?.opacity ?? 0.12}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    watermarkConfig: { ...editing.watermarkConfig, opacity: parseFloat(e.target.value) },
                  })
                }
              />
            </div>
          </fieldset>

          <div className="flex gap-3">
            <button className="btn-primary" onClick={save} disabled={status === "saving"}>
              {status === "saving" ? "Saving…" : "Save Brand Profile"}
            </button>
            <button className="btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
