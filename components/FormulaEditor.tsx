"use client";
import { useRef, useState, useEffect } from "react";
import FormulaText from "./FormulaText";
import SymbolPicker from "./SymbolPicker";
import ChemistryPicker from "./ChemistryPicker";

type MenuState = "closed" | "menu" | "chemistry" | "equation";

export default function FormulaEditor({
  value,
  onChange,
  rows = 3,
  placeholder,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  compact?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [menuState, setMenuState] = useState<MenuState>("closed");

  // Click-outside closes whatever is open (menu or a sub-picker)
  useEffect(() => {
    if (menuState === "closed") return;
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setMenuState("closed");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuState]);

  function insertAtCursor(text: string, cursorOffsetOverride?: number) {
    const el = ref.current;
    if (!el) {
      onChange(value + text);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const next = before + text + after;
    onChange(next);
    const cursorPos = cursorOffsetOverride ?? start + text.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursorPos, cursorPos);
    });
  }

  function insertSnippet(snippet: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);

    let inserted: string;
    if (selected && snippet.includes("{}")) {
      inserted = snippet.replace("{}", `{${selected}}`);
    } else {
      inserted = snippet;
    }

    const wrapped = `$${inserted}$`;
    onChange(before + wrapped + after);

    const emptyBraceIdx = selected ? -1 : inserted.indexOf("{}");
    const cursorPos = emptyBraceIdx >= 0 ? start + 1 + emptyBraceIdx + 1 : start + wrapped.length;

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursorPos, cursorPos);
    });
  }

  async function uploadAndInsertImage(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        insertAtCursor(`![](${data.url})`);
      }
    } finally {
      setUploading(false);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) uploadAndInsertImage(file);
        return;
      }
    }
  }

  const MENU_ITEMS = [
    { key: "image" as const, icon: "🖼️", label: "Image / Media", hint: "Ctrl+V to paste too" },
    { key: "chemistry" as const, icon: "🧪", label: "Chemical Structure", hint: null },
    { key: "equation" as const, icon: "Σ", label: "Equation", hint: null },
  ];

  function handleMenuItemClick(key: "image" | "chemistry" | "equation") {
    if (key === "image") {
      fileInputRef.current?.click();
      setMenuState("closed");
    } else if (key === "chemistry") {
      setMenuState("chemistry");
    } else {
      setMenuState("equation");
    }
  }

  return (
    <div>
      <div className="relative" ref={wrapperRef}>
        <textarea
          ref={ref}
          className="input font-mono text-sm resize-none"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadAndInsertImage(file);
            e.target.value = "";
          }}
        />

        {/* Single "+" trigger, inside the box's bottom-right corner */}
        <div className="absolute bottom-1.5 right-1.5">
          <button
            type="button"
            title="Add symbol, image, or chemistry notation"
            onClick={() => setMenuState((s) => (s === "closed" ? "menu" : "closed"))}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-sm transition-colors ${
              menuState !== "closed" ? "bg-slate-200 text-slate-700" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            }`}
          >
            {uploading ? "…" : "+"}
          </button>

          {menuState === "menu" && (
            <div className="absolute bottom-full right-0 mb-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 w-56">
              {MENU_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleMenuItemClick(item.key)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left"
                >
                  <span className="w-5 text-center">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                </button>
              ))}
            </div>
          )}

          {menuState === "chemistry" && (
            <ChemistryPicker
              onInsert={(snippet) => {
                insertSnippet(snippet);
                setMenuState("closed");
              }}
              onClose={() => setMenuState("closed")}
            />
          )}

          {menuState === "equation" && (
            <SymbolPicker
              open
              onInsert={(snippet) => {
                insertSnippet(snippet);
                setMenuState("closed");
              }}
              onClose={() => setMenuState("closed")}
            />
          )}
        </div>
      </div>

      {value && (
        <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
          <div className="text-xs text-slate-400 mb-1">Preview</div>
          <FormulaText text={value} className="text-slate-800" />
        </div>
      )}
    </div>
  );
}
