"use client";

/**
 * Tiny canvas-based signature pad. Works with mouse + touch; emits
 * the signed image as a base64 PNG data URL via `onChange`. No deps
 * — react-signature-canvas would pull in 30 KB for something we can
 * write in 80 lines.
 *
 * Accepts a name input above the canvas (Jobber stores "Signed by
 * <name>" alongside the image); a Clear button lives bottom-right.
 */
import { useEffect, useRef, useState } from "react";

export type SignatureData = {
  name: string;
  pngDataUrl: string;
};

export function SignaturePad({
  onChange,
  initialName = "",
  label = "Sign here",
}: {
  onChange: (data: SignatureData | null) => void;
  initialName?: string;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const hasStroke = useRef(false);
  const [name, setName] = useState(initialName);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // Scale for device-pixel ratio so the line isn't chunky on retina.
    const ratio = Math.max(window.devicePixelRatio ?? 1, 1);
    const w = c.clientWidth;
    const h = c.clientHeight;
    c.width = w * ratio;
    c.height = h * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  function emit() {
    const c = canvasRef.current;
    if (!c || !hasStroke.current) {
      onChange(null);
      return;
    }
    const png = c.toDataURL("image/png");
    onChange({ name: name.trim(), pngDataUrl: png });
  }

  function coords(e: React.PointerEvent<HTMLCanvasElement>): {
    x: number;
    y: number;
  } {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    last.current = coords(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const p = coords(e);
    if (!ctx || !last.current) return;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    hasStroke.current = true;
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = false;
    last.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
    emit();
  }

  function clearPad() {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    hasStroke.current = false;
    emit();
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Full name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            // Re-emit so the parent gets the updated name even if the
            // stroke hasn't changed.
            if (hasStroke.current) {
              const c = canvasRef.current;
              if (c) onChange({ name: e.target.value.trim(), pngDataUrl: c.toDataURL("image/png") });
            }
          }}
          placeholder="Jane Customer"
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
          {label}
        </label>
        <div className="relative mt-1 overflow-hidden rounded-md border border-neutral-300 bg-white">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={(e) => {
              if (drawing.current) onPointerUp(e);
            }}
            style={{ width: "100%", height: 160, touchAction: "none" }}
          />
          <button
            type="button"
            onClick={clearPad}
            className="absolute right-2 top-2 rounded border border-neutral-200 bg-white/90 px-2 py-0.5 text-[11px] text-neutral-600 hover:bg-white"
          >
            Clear
          </button>
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">
          Draw your signature with your finger or mouse.
        </p>
      </div>
    </div>
  );
}
