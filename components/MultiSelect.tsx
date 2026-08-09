"use client";
import { useState, useRef, useEffect } from "react";

export default function MultiSelect({
  values,
  onChange,
  options,
  placeholder = "Select...",
  disabled,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggle(opt: string) {
    if (values.includes(opt)) onChange(values.filter((v) => v !== opt));
    else onChange([...values, opt]);
  }

  function addCustom() {
    const v = customInput.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setCustomInput("");
  }

  function remove(v: string) {
    onChange(values.filter((x) => x !== v));
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between text-left disabled:opacity-50"
      >
        <span className={values.length === 0 ? "text-slate-400" : ""}>
          {values.length === 0 ? placeholder : `${values.length} topic${values.length > 1 ? "s" : ""} selected`}
        </span>
        <span className={`material-symbols-outlined text-lg text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>expand_more</span>
      </button>

      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 bg-brand-light text-brand text-xs font-medium px-2.5 py-1 rounded-full">
              {v}
              <button type="button" onClick={() => remove(v)} className="hover:text-danger">✕</button>
            </span>
          ))}
        </div>
      )}

      {open && !disabled && (
        <div className="absolute z-30 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-lg py-1.5">
          <div className="max-h-56 overflow-y-auto">
            {options.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">No topics found for this chapter.</div>}
            {options.map((opt) => {
              const checked = values.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-brand-light flex items-center gap-2.5"
                >
                  <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${checked ? "bg-brand border-brand" : "border-slate-300"}`}>
                    {checked && <span className="material-symbols-outlined text-white text-xs">check</span>}
                  </span>
                  <span className={checked ? "text-brand font-medium" : "text-slate-700"}>{opt}</span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-slate-100 mt-1.5 pt-1.5 px-3 flex gap-2">
            <input
              className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5"
              placeholder="Add custom topic..."
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <button type="button" onClick={addCustom} className="text-xs text-brand font-medium px-2">Add</button>
          </div>
        </div>
      )}
    </div>
  );
}
