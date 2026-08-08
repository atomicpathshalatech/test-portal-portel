"use client";
import { useState } from "react";
import FormulaText from "./FormulaText";

type SymbolItem = { label: string; insert: string };

const CATEGORIES: Record<string, SymbolItem[]> = {
  Subscripts: [
    { label: "H₂O", insert: "H_2O" },
    { label: "CO₂", insert: "CO_2" },
    { label: "H₂SO₄", insert: "H_2SO_4" },
    { label: "Xₙ", insert: "X_{n}" },
    { label: "Xₐ Yᵦ", insert: "X_{a}Y_{b}" },
    { label: "CaCO₃", insert: "CaCO_3" },
  ],
  "Arrows & Reactions": [
    { label: "→", insert: "\\rightarrow" },
    { label: "⇌", insert: "\\rightleftharpoons" },
    { label: "Δ→", insert: "\\xrightarrow{\\Delta}" },
    { label: "catalyst→", insert: "\\xrightarrow{\\text{catalyst}}" },
    { label: "↑ (gas)", insert: "\\uparrow" },
    { label: "↓ (ppt)", insert: "\\downarrow" },
  ],
  "Charges & Isotopes": [
    { label: "X⁺", insert: "X^{+}" },
    { label: "X²⁺", insert: "X^{2+}" },
    { label: "X⁻", insert: "X^{-}" },
    { label: "X²⁻", insert: "X^{2-}" },
    { label: "¹⁴₆C", insert: "{}^{14}_{6}C" },
    { label: "e⁻", insert: "e^{-}" },
  ],
  "Functional Groups": [
    { label: "–OH", insert: "-OH" },
    { label: "–COOH", insert: "-COOH" },
    { label: "–NH₂", insert: "-NH_2" },
    { label: "–CHO", insert: "-CHO" },
    { label: "–C≡N", insert: "-C\\equiv N" },
    { label: "=O", insert: "=O" },
  ],
  Bonds: [
    { label: "single", insert: "-" },
    { label: "double", insert: "=" },
    { label: "triple", insert: "\\equiv" },
    { label: "Δ (heat)", insert: "\\Delta" },
  ],
};

export default function ChemistryPicker({
  onInsert,
  onClose,
}: {
  onInsert: (latex: string) => void;
  onClose: () => void;
}) {
  const [activeCat, setActiveCat] = useState("Subscripts");
  const [typed, setTyped] = useState("");

  return (
    <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-700 px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <span className="text-xl">🧪</span> Chemistry Notation
          </h3>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">
            ✕
          </button>
        </div>

        <div className="p-5">
          <label className="text-xs font-medium text-slate-500 mb-1 block">Type chemical notation directly</label>
          <div className="flex gap-2 mb-2">
            <input
              className="input font-mono text-sm flex-1"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="e.g. H_2SO_4 or X^{2+}"
              onKeyDown={(e) => {
                if (e.key === "Enter" && typed.trim()) {
                  onInsert(typed);
                  setTyped("");
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (typed.trim()) {
                  onInsert(typed);
                  setTyped("");
                }
              }}
              disabled={!typed.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 rounded-full disabled:opacity-40"
            >
              Insert
            </button>
          </div>
          {typed.trim() && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
              <span className="text-xs text-slate-400">Preview:</span>
              <FormulaText text={`$${typed}$`} />
            </div>
          )}

          <div className="flex items-center justify-between mb-2 mt-4">
            <span className="text-xs font-medium text-slate-500">Or pick common notation</span>
            <select
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50"
              value={activeCat}
              onChange={(e) => setActiveCat(e.target.value)}
            >
              {Object.keys(CATEGORIES).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES[activeCat].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onInsert(item.insert)}
                title={item.insert}
                className="px-3 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl hover:bg-emerald-50 hover:border-emerald-300 hover:scale-105 transition-all shadow-sm"
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            Notation shortcuts only — not a molecular structure/drawing editor.
          </p>
        </div>
      </div>
    </div>
  );
}
