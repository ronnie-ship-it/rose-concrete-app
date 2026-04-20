"use client";

/**
 * Enrollment widget — asks the user's browser to register the service
 * worker + subscribe to push. Shows current state: unsupported / blocked /
 * off / on, and the enable/disable button.
 *
 * Renders minimally (a tiny card) so it can be dropped into a settings
 * page without dominating the layout.
 */
import { useEffect, useState } from "react";
import {
  subscribePushAction,
  unsubscribePushAction,
} from "@/app/actions/push";

type State = "unsupported" | "denied" | "off" | "on" | "working";

// VAPID public key must be available to the client. Next.js only exposes
// env vars prefixed NEXT_PUBLIC_ to the browser.
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function PushEnroll() {
  const [state, setState] = useState<State>("working");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported()) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        setState(sub ? "on" : "off");
      } catch {
        setState("off");
      }
    })();
  }, []);

  async function enable() {
    setError(null);
    if (!VAPID_PUBLIC) {
      setError(
        "Push not configured yet — ask Ronnie to set NEXT_PUBLIC_VAPID_PUBLIC_KEY.",
      );
      return;
    }
    setState("working");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      // TS widens Uint8Array<ArrayBufferLike> on some lib versions in a way
      // PushManager.subscribe doesn't accept — pass the backing buffer
      // slice so the BufferSource typing lines up.
      const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC);
      const applicationServerKey = keyBytes.buffer.slice(
        keyBytes.byteOffset,
        keyBytes.byteOffset + keyBytes.byteLength,
      ) as ArrayBuffer;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      const json = sub.toJSON();
      const res = await subscribePushAction({
        endpoint: sub.endpoint,
        p256dh: (json.keys?.p256dh as string) ?? "",
        auth: (json.keys?.auth as string) ?? "",
        user_agent: navigator.userAgent,
      });
      if (!res.ok) {
        setError(res.error);
        setState("off");
        return;
      }
      setState("on");
    } catch (err) {
      setError((err as Error).message);
      setState("off");
    }
  }

  async function disable() {
    setError(null);
    setState("working");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await unsubscribePushAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch (err) {
      setError((err as Error).message);
      setState("on");
    }
  }

  const label =
    state === "unsupported"
      ? "Your browser doesn't support push notifications."
      : state === "denied"
        ? "Notifications blocked — enable them in your browser settings."
        : state === "on"
          ? "Push notifications are on."
          : "Push notifications are off.";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            Push notifications
          </h3>
          <p className="mt-0.5 text-xs text-neutral-600">{label}</p>
        </div>
        {state === "off" && (
          <button
            type="button"
            onClick={enable}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Turn on
          </button>
        )}
        {state === "on" && (
          <button
            type="button"
            onClick={disable}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700"
          >
            Turn off
          </button>
        )}
        {state === "working" && (
          <span className="text-xs text-neutral-500">Working…</span>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
