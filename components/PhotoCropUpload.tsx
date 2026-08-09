"use client";
import { useState, useRef, useCallback } from "react";

const OUTPUT_W = 300;
const OUTPUT_H = 400; // 3:4 passport-photo ratio

export default function PhotoCropUpload({ onCropped }: { onCropped: (blob: Blob | null) => void }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; offX: number; offY: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      alert("Please choose a JPG or PNG image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImgSrc(reader.result as string);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setPreviewUrl(null);
    };
    reader.readAsDataURL(file);
  }

  function onPointerDown(e: React.PointerEvent) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, offX: offset.x, offY: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset({ x: dragRef.current.offX + dx, y: dragRef.current.offY + dy });
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  const confirmCrop = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_W;
    canvas.height = OUTPUT_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    const baseScale = Math.max(OUTPUT_W / naturalW, OUTPUT_H / naturalH);
    const scale = baseScale * zoom;
    const drawW = naturalW * scale;
    const drawH = naturalH * scale;
    const drawX = (OUTPUT_W - drawW) / 2 + offset.x;
    const drawY = (OUTPUT_H - drawH) / 2 + offset.y;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // Iteratively reduce JPEG quality until the output is under 500KB —
    // a passport photo at OUTPUT_W x OUTPUT_H rarely needs more than this
    // to look sharp, so quality loss is minimal in practice.
    const MAX_BYTES = 500 * 1024;
    const tryQuality = (quality: number) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          if (blob.size > MAX_BYTES && quality > 0.3) {
            tryQuality(quality - 0.1);
          } else {
            onCropped(blob);
            setPreviewUrl(URL.createObjectURL(blob));
          }
        },
        "image/jpeg",
        quality
      );
    };
    tryQuality(0.85);
  }, [zoom, offset, onCropped]);

  function reset() {
    setImgSrc(null);
    setPreviewUrl(null);
    onCropped(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div>
      {!imgSrc && !previewUrl && (
        <div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleFileSelect} className="text-sm" />
          <p className="text-xs text-slate-400 mt-1">Passport-size photo · JPG or PNG · will be compressed to under 500KB</p>
        </div>
      )}

      {imgSrc && !previewUrl && (
        <div>
          <div
            className="relative overflow-hidden bg-slate-100 rounded-lg border-2 border-dashed border-brand/40 cursor-move touch-none select-none"
            style={{ width: OUTPUT_W, height: OUTPUT_H }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <img
              ref={imgRef}
              src={imgSrc}
              alt=""
              draggable={false}
              className="absolute pointer-events-none"
              style={{
                left: "50%",
                top: "50%",
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                maxWidth: "none",
                width: OUTPUT_W,
                height: OUTPUT_H,
                objectFit: "cover",
              }}
              onLoad={() => {
                // Re-center on load so initial framing is sensible.
              }}
            />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-slate-400">Zoom</span>
            <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
          </div>
          <p className="text-xs text-slate-400 mt-1">Drag the photo to reposition, use the slider to zoom.</p>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={reset} className="btn-secondary text-xs">Choose Different Photo</button>
            <button type="button" onClick={confirmCrop} className="btn-primary text-xs">✓ Confirm Crop</button>
          </div>
        </div>
      )}

      {previewUrl && (
        <div>
          <img src={previewUrl} alt="Cropped preview" className="rounded-lg border" style={{ width: OUTPUT_W / 2, height: OUTPUT_H / 2 }} />
          <button type="button" onClick={reset} className="text-xs text-brand underline block mt-2">Change Photo</button>
        </div>
      )}
    </div>
  );
}
