"use client";
import { useState } from "react";
import FormulaText from "./FormulaText";

type SymbolItem = { label: string; insert: string };

const TEMPLATE_CATEGORIES: Record<string, SymbolItem[]> = {
  Fraction: [
    { label: "a/b", insert: "\\frac{}{}" },
    { label: "½", insert: "\\frac{1}{2}" },
  ],
  Script: [
    { label: "x²", insert: "^{}" },
    { label: "x₂", insert: "_{}" },
    { label: "xⁿ_m", insert: "^{}_{}" },
  ],
  Radical: [
    { label: "√", insert: "\\sqrt{}" },
    { label: "ⁿ√", insert: "\\sqrt[n]{}" },
  ],
  Integral: [
    { label: "∫", insert: "\\int" },
    { label: "∫ₐᵇ", insert: "\\int_{a}^{b}" },
    { label: "∮", insert: "\\oint" },
  ],
  "Large Operator": [
    { label: "Σ", insert: "\\sum_{i=1}^{n}" },
    { label: "Π", insert: "\\prod_{i=1}^{n}" },
    { label: "∪", insert: "\\bigcup" },
    { label: "∩", insert: "\\bigcap" },
  ],
  Bracket: [
    { label: "()", insert: "\\left({}\\right)" },
    { label: "[]", insert: "\\left[{}\\right]" },
    { label: "{}", insert: "\\left\\{{}\\right\\}" },
    { label: "|x|", insert: "\\left|{}\\right|" },
    { label: "⟨⟩", insert: "\\langle{}\\rangle" },
  ],
  Function: [
    { label: "sin", insert: "\\sin" },
    { label: "cos", insert: "\\cos" },
    { label: "tan", insert: "\\tan" },
    { label: "log", insert: "\\log" },
    { label: "ln", insert: "\\ln" },
  ],
  Accent: [
    { label: "x̂", insert: "\\hat{x}" },
    { label: "x̄", insert: "\\bar{x}" },
    { label: "x⃗", insert: "\\vec{x}" },
    { label: "ẋ", insert: "\\dot{x}" },
    { label: "ẍ", insert: "\\ddot{x}" },
  ],
  "Limit & Log": [
    { label: "lim", insert: "\\lim_{x \\to 0}" },
    { label: "logₐ", insert: "\\log_{a}" },
  ],
  Matrix: [{ label: "⎡ ⎤", insert: "\\begin{bmatrix} 1 & 0 \\\\ 0 & 1 \\end{bmatrix}" }],
};

const SYMBOL_CATEGORIES: Record<string, SymbolItem[]> = {
  "Basic Math": [
    "\\pm", "\\infty", "=", "\\neq", "\\sim", "\\times", "\\div", "!", "\\propto", "<", "\\ll", ">", "\\gg",
    "\\leq", "\\geq", "\\mp", "\\equiv", "\\forall", "\\partial", "\\sqrt{}", "\\sqrt[3]{}", "\\cup", "\\cap",
    "\\emptyset", "\\%", "^\\circ", "\\Delta", "\\nabla", "\\in", "\\notin", "+", "-", "\\neg",
  ].map((s) => ({ label: s.replace(/\\/g, ""), insert: s })),
  "Greek Letters": [
    "\\alpha", "\\beta", "\\gamma", "\\delta", "\\epsilon", "\\zeta", "\\eta", "\\theta", "\\iota", "\\kappa",
    "\\lambda", "\\mu", "\\nu", "\\xi", "\\pi", "\\rho", "\\sigma", "\\tau", "\\upsilon", "\\phi", "\\chi",
    "\\psi", "\\omega", "\\Gamma", "\\Delta", "\\Theta", "\\Lambda", "\\Pi", "\\Sigma", "\\Phi", "\\Omega",
  ].map((s) => ({ label: s.replace(/\\/g, ""), insert: s })),
  Arrows: [
    "\\rightarrow", "\\leftarrow", "\\leftrightarrow", "\\Rightarrow", "\\Leftarrow", "\\Leftrightarrow",
    "\\uparrow", "\\downarrow", "\\rightleftharpoons",
  ].map((s) => ({ label: s.replace(/\\/g, ""), insert: s })),
  Sets: ["\\cup", "\\cap", "\\subset", "\\supset", "\\subseteq", "\\in", "\\notin", "\\emptyset"].map((s) => ({
    label: s.replace(/\\/g, ""),
    insert: s,
  })),
};

const ALL_CATEGORIES: Record<string, SymbolItem[]> = { ...TEMPLATE_CATEGORIES, ...SYMBOL_CATEGORIES };

export default function SymbolPicker({
  onInsert,
  open,
  onClose,
}: {
  onInsert: (latex: string) => void;
  open: boolean;
  onClose: () => void;
}) {
  const [activeCat, setActiveCat] = useState("Basic Math");
  const [typed, setTyped] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-brand to-brand-dark px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <span className="text-xl">Σ</span> Equation Builder
          </h3>
          <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none">
            ✕
          </button>
        </div>

        <div className="p-5">
          <label className="text-xs font-medium text-slate-500 mb-1 block">Type LaTeX directly</label>
          <div className="flex gap-2 mb-2">
            <input
              className="input font-mono text-sm flex-1"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="e.g. \frac{1}{2} or x^2"
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
              className="btn-primary text-sm px-4 disabled:opacity-40"
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
            <span className="text-xs font-medium text-slate-500">Or pick a symbol</span>
            <select
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50"
              value={activeCat}
              onChange={(e) => setActiveCat(e.target.value)}
            >
              {Object.keys(ALL_CATEGORIES).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-7 gap-2 max-h-52 overflow-y-auto p-1">
            {ALL_CATEGORIES[activeCat].map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onInsert(item.insert)}
                title={item.insert}
                className="aspect-square flex items-center justify-center text-base bg-slate-50 border border-slate-200 rounded-xl hover:bg-brand-light hover:border-brand/40 hover:scale-105 transition-all shadow-sm"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
