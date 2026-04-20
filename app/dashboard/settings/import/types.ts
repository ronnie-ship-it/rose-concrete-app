// Types + tiny helper shared between the server actions and the client
// <ImportForm>. Lives in its own module so the "use server" file only
// exports async functions — Next.js 15+ is strict about that in some
// bundler modes, and a plain helper next to the server actions was the
// likeliest source of the /dashboard/settings/import 500 we saw after
// migrations 019–021 landed.

import type { ImportKind } from "@/lib/jobber-import";

/**
 * Skip counters bucketed by category. Helps the user see at a glance
 * whether the failures were "client X not found" vs "already imported"
 * vs "DB rejected the row" — which the `reasons` list only conveys by
 * pattern-matching individual lines (and is capped at MAX_REASONS).
 */
export type SkipBreakdown = {
  /** Mapper returned null (missing required CSV column). */
  mapper_invalid: number;
  /** Parent record (client/project) not found in the DB. */
  parent_missing: number;
  /** Row already exists in the DB (by external_id or natural key). */
  already_imported: number;
  /** Duplicate within the file itself. */
  duplicate_in_file: number;
  /** Database rejected the insert — unique/FK/check/type error. */
  db_error: number;
  /** Catch-all for anything else. */
  other: number;
};

export type ImportResult =
  | {
      ok: true;
      inserted: number;
      skipped: number;
      reasons: string[];
      breakdown?: SkipBreakdown;
    }
  | { ok: false; error: string };

export type PreviewResult =
  | {
      ok: true;
      kind: ImportKind;
      total: number;
      valid: number;
      sample: unknown[];
      invalid: { row: number; reason: string }[];
    }
  | { ok: false; error: string };

export function emptyBreakdown(): SkipBreakdown {
  return {
    mapper_invalid: 0,
    parent_missing: 0,
    already_imported: 0,
    duplicate_in_file: 0,
    db_error: 0,
    other: 0,
  };
}
