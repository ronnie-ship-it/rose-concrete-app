"use client";

import { useEffect } from "react";

/**
 * Preserves free-text form fields across the crew create-flow picker
 * round-trips. Tapping "Add client" / "Add team" navigates to a
 * separate picker page, which unmounts the form and would otherwise
 * wipe anything typed (title, description, dates, amounts). We stash
 * the current text / textarea / date / number values in sessionStorage
 * and restore them when the form re-mounts on the way back.
 *
 * Picked IDs (client_id, user_id, project_id) ride back through the URL
 * and are re-rendered server-side, so this only has to cover the fields
 * the user types by hand.
 *
 *   restore = true   → returning from a picker; repopulate saved values
 *   restore = false  → fresh open from the "+" menu; start clean
 */
export function PreserveDraft({
  formKey,
  restore,
}: {
  formKey: string;
  restore: boolean;
}) {
  useEffect(() => {
    const key = `crewdraft:${formKey}`;
    const form = document.querySelector("form");
    if (!form) return;

    const typedFields = () =>
      Array.from(
        form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          "input[name], textarea[name]",
        ),
      ).filter((el) => {
        const t = (el as HTMLInputElement).type;
        return (
          t !== "hidden" && t !== "checkbox" && t !== "radio" && t !== "submit"
        );
      });

    if (restore) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(key) || "{}") as Record<
          string,
          string
        >;
        for (const el of typedFields()) {
          if (!el.value && typeof saved[el.name] === "string") {
            el.value = saved[el.name];
          }
        }
      } catch {
        // ignore malformed / unavailable storage
      }
    } else {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // ignore
      }
    }

    const save = () => {
      const data: Record<string, string> = {};
      for (const el of typedFields()) data[el.name] = el.value;
      try {
        sessionStorage.setItem(key, JSON.stringify(data));
      } catch {
        // ignore quota / unavailable storage
      }
    };
    const clear = () => {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // ignore
      }
    };

    form.addEventListener("input", save);
    form.addEventListener("submit", clear);
    return () => {
      form.removeEventListener("input", save);
      form.removeEventListener("submit", clear);
    };
  }, [formKey, restore]);

  return null;
}
