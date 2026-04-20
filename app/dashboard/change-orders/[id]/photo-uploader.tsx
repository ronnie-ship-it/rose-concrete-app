"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadChangeOrderPhotoAction } from "../actions";

export function PhotoUploader({ changeOrderId }: { changeOrderId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const res = await uploadChangeOrderPhotoAction(changeOrderId, fd);
      if (!res.ok) setError(res.error);
      e.target.value = "";
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <label className="inline-flex cursor-pointer items-center rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
        {pending ? "Uploading…" : "Add photo"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onChange}
          className="hidden"
          disabled={pending}
        />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
