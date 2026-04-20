"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signChangeOrderAction } from "@/app/dashboard/change-orders/actions";

/**
 * Finger signature pad — touch + mouse. Renders a responsive canvas and
 * captures pointer events as SVG-ish strokes. Export is canvas.toDataURL()
 * which plays nicely with an `<img>` tag on the sign-confirmation page.
 */
export function SignPad({ token }: { token: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const hasInk = useRef(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Reset styling
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    // Size based on container
    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = 200 * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `200px`;
      const c = canvas.getContext("2d");
      if (c) {
        c.scale(dpr, dpr);
        c.lineWidth = 2;
        c.lineCap = "round";
        c.strokeStyle = "#111";
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    last.current = pos(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const p = pos(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    hasInk.current = true;
  }

  function onUp() {
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    hasInk.current = false;
  }

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Please type your name.");
      return;
    }
    if (!hasInk.current) {
      setError("Please sign with your finger.");
      return;
    }
    const dataUrl = canvasRef.current?.toDataURL("image/png");
    if (!dataUrl) {
      setError("Could not read signature.");
      return;
    }
    setBusy(true);
    const res = await signChangeOrderAction(token, name.trim(), dataUrl);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <label className="block text-sm font-medium text-neutral-700">
        Your name
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Type your full name"
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />

      <label className="mt-3 block text-sm font-medium text-neutral-700">
        Sign here (finger or mouse)
      </label>
      <div className="mt-1 w-full rounded-md border border-dashed border-neutral-400 bg-neutral-50">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
          className="block touch-none"
          style={{ touchAction: "none" }}
        />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={clear}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="flex-1 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Signing…" : "Sign & submit"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
