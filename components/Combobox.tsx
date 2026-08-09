"use client";
import { useState, useRef, useEffect } from "react";

export default function Combobox({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [value]);

  const filtered = options.filter((o) => o.toLowerCase().includes(query.toLowerCase()));

  function select(v: string) {
    onChange(v);
    setQuery(v);
    setOpen(false);
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <input
          className="input pr-9"
          disabled={disabled}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          tabIndex={-1}
        >
          <span className={`material-symbols-outlined text-lg transition-transform ${open ? "rotate-180" : ""}`}>expand_more</span>
        </button>
      </div>

      {open && !disabled && (
        <div className="absolute z-30 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto py-1.5">
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400">No matches — your typed text will be used as-is.</div>
          )}
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => select(opt)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-brand-light hover:text-brand flex items-center justify-between group"
            >
              <span>{opt}</span>
              {opt === value && <span className="material-symbols-outlined text-brand text-base">check</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
