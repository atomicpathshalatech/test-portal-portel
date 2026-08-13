"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { ModuleElementJson } from "@/lib/moduleExtraction";

const CANVAS_WIDTH_PX = 700; // fixed on-screen width; scale derived from this vs pageWidth (in PDF points)

type SaveState = "idle" | "saving" | "saved" | "error";

export default function PageCanvas({
  moduleId,
  pageNumber,
  pageWidth,
  pageHeight,
  initialElements,
  initialNeedsReview,
}: {
  moduleId: string;
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  initialElements: ModuleElementJson[];
  initialNeedsReview: boolean;
}) {
  const [elements, setElements] = useState<ModuleElementJson[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refImageUrl, setRefImageUrl] = useState<string | null>(null);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    id: string;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const scale = CANVAS_WIDTH_PX / pageWidth;
  const canvasHeightPx = pageHeight * scale;

  // Reference image + any extracted-image element assets, all served through signed URLs.
  useEffect(() => {
    fetch(`/api/module-studio/${moduleId}/file?page=${pageNumber}`)
      .then((r) => r.json())
      .then((d) => d.url && setRefImageUrl(d.url));
  }, [moduleId, pageNumber]);

  useEffect(() => {
    elements
      .filter((el) => el.type === "IMAGE" && el.assetId && !assetUrls[el.assetId])
      .forEach((el) => {
        fetch(`/api/module-studio/${moduleId}/file?asset=${encodeURIComponent(el.assetId!)}`)
          .then((r) => r.json())
          .then((d) => d.url && setAssetUrls((prev) => ({ ...prev, [el.assetId!]: d.url })));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements.length]);

  const persist = useCallback(
    async (next: ModuleElementJson[]) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/module-studio/${moduleId}/pages/${pageNumber}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ elements: next }),
        });
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    },
    [moduleId, pageNumber]
  );

  function updateElement(id: string, patch: Partial<ModuleElementJson>) {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...patch } : el)));
  }

  function onPointerDown(e: React.PointerEvent, id: string, mode: "move" | "resize") {
    e.stopPropagation();
    const el = elements.find((x) => x.id === id);
    if (!el) return;
    setSelectedId(id);
    dragState.current = {
      id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
      origW: el.width,
      origH: el.height,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragState.current;
    if (!drag) return;
    const dxPt = (e.clientX - drag.startX) / scale;
    const dyPt = (e.clientY - drag.startY) / scale;

    if (drag.mode === "move") {
      updateElement(drag.id, {
        x: Math.max(0, drag.origX + dxPt),
        y: Math.max(0, drag.origY + dyPt),
      });
    } else {
      updateElement(drag.id, {
        width: Math.max(10, drag.origW + dxPt),
        height: Math.max(10, drag.origH + dyPt),
      });
    }
  }

  function onPointerUp() {
    if (!dragState.current) return;
    dragState.current = null;
    // Persist current state (functional read via setElements callback trick avoided —
    // elements is already up to date from the move handlers above).
    setElements((current) => {
      persist(current);
      return current;
    });
  }

  function deleteSelected() {
    if (!selectedId) return;
    const next = elements.filter((el) => el.id !== selectedId);
    setElements(next);
    setSelectedId(null);
    persist(next);
  }

  function commitTextEdit(id: string, content: string) {
    const next = elements.map((el) => (el.id === id ? { ...el, content } : el));
    setElements(next);
    setEditingId(null);
    persist(next);
  }

  const selected = elements.find((el) => el.id === selectedId) || null;

  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-sm">
        <span
          className={
            saveState === "saving"
              ? "text-slate-400"
              : saveState === "error"
              ? "text-red-600"
              : saveState === "saved"
              ? "text-emerald-600"
              : "text-slate-400"
          }
        >
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved ✓"}
          {saveState === "error" && "Save failed — retry"}
          {saveState === "idle" && "No unsaved changes"}
        </span>
        {selected && (
          <button onClick={deleteSelected} className="text-red-600 hover:underline hover:opacity-70 transition-opacity duration-150">
            Delete selected ({selected.type})
          </button>
        )}
        <span className="text-slate-400 ml-auto">
          {elements.length} elements · click to select, drag to move, corner handle to resize, double-click text to edit
        </span>
      </div>

      <div
        ref={canvasRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={() => setSelectedId(null)}
        className="relative bg-slate-200 mx-auto border border-slate-300 shadow-sm select-none"
        style={{ width: CANVAS_WIDTH_PX, height: canvasHeightPx }}
      >
        {refImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={refImageUrl}
            alt={`Page ${pageNumber} reference`}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-90"
          />
        )}

        {elements.map((el) => {
          const style: React.CSSProperties = {
            position: "absolute",
            left: el.x * scale,
            top: el.y * scale,
            width: el.width * scale,
            height: el.height * scale,
            border: selectedId === el.id ? "2px solid #4f46e5" : el.locked ? "1px dashed rgba(180,83,9,0.5)" : "1px dashed rgba(79,70,229,0.4)",
            background: el.type === "IMAGE" ? "transparent" : "rgba(255,255,255,0.55)",
            cursor: el.locked ? "not-allowed" : "move",
            overflow: "hidden",
            fontSize: el.fontSize ? el.fontSize * scale : 10,
            lineHeight: 1.2,
            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
            opacity: el.opacity ?? 1,
          };

          return (
            <div
              key={el.id}
              style={style}
              onPointerDown={(e) => !el.locked && onPointerDown(e, el.id, "move")}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (el.type !== "IMAGE" && !el.locked) setEditingId(el.id);
              }}
            >
              {el.locked && (
                <span className="absolute top-0 left-0 bg-amber-500 text-white text-[8px] px-1 leading-tight">
                  {el.type}
                </span>
              )}
              {el.type === "IMAGE" && el.assetId && assetUrls[el.assetId] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assetUrls[el.assetId]} alt="" className="w-full h-full object-contain pointer-events-none" />
              )}

              {el.type !== "IMAGE" && editingId === el.id && (
                <textarea
                  autoFocus
                  defaultValue={el.content}
                  className="w-full h-full text-xs p-0.5 resize-none border-0 outline-none bg-white"
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => commitTextEdit(el.id, e.target.value)}
                />
              )}

              {el.type !== "IMAGE" && editingId !== el.id && (
                <span className="px-0.5 text-slate-800 whitespace-pre-wrap break-words">{el.content}</span>
              )}

              {selectedId === el.id && (
                <div
                  onPointerDown={(e) => onPointerDown(e, el.id, "resize")}
                  className="absolute bottom-0 right-0 w-3 h-3 bg-indigo-600 cursor-nwse-resize"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
