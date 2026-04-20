/**
 * Best-effort AI alt-text generation for project_media uploads.
 *
 * Calls the Anthropic Messages API with the public image URL and a tight
 * prompt. Falls back to a sensible default when:
 *   - ANTHROPIC_API_KEY is unset (dev / local without API access)
 *   - The API call fails for any reason
 *   - The model returns something obviously bad (empty, too long, etc.)
 *
 * Used by the upload server action — non-blocking. If alt-text generation
 * fails, the upload still succeeds with the fallback.
 *
 * Direct fetch to avoid taking a new SDK dependency. Keeps the
 * marketing-side bundle clean and lets us swap providers without
 * touching @anthropic-ai/sdk.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5"; // fast + cheap, plenty for alt text
const MAX_ALT_TEXT_CHARS = 125; // WCAG guidance for image alt text

export type AltTextContext = {
  /** Service type tag on the project this photo is from. Improves the
   *  prompt's specificity ("describe this concrete patio" vs generic). */
  serviceType?: string | null;
  /** Phase tag (before/during/after/detail/reference). */
  phase?: string;
  /** Project name — sometimes informative, often noisy. Optional. */
  projectName?: string | null;
};

export type AltTextResult =
  | { ok: true; alt_text: string; source: "ai" | "fallback" }
  | { ok: false; error: string; alt_text: string; source: "fallback" };

function fallbackAltText(ctx: AltTextContext): string {
  const phase = ctx.phase ?? "after";
  const service = ctx.serviceType
    ? ctx.serviceType.replace(/_/g, " ")
    : "concrete";
  return `${capFirst(phase)} photo of a ${service} project by Rose Concrete in San Diego.`;
}

function capFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Generate alt text for an image at `publicUrl`. Returns the AI result
 * when ANTHROPIC_API_KEY is set and the call succeeds; otherwise the
 * caller-supplied fallback. Never throws.
 */
export async function generateAltText(
  publicUrl: string,
  ctx: AltTextContext = {},
): Promise<AltTextResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback = fallbackAltText(ctx);
  if (!apiKey) {
    return { ok: false, error: "ANTHROPIC_API_KEY not set", alt_text: fallback, source: "fallback" };
  }

  const serviceLine = ctx.serviceType
    ? `The photo is of a ${ctx.serviceType.replace(/_/g, " ")} project.`
    : "The photo is of a concrete project.";
  const phaseLine = ctx.phase
    ? `The photo is tagged "${ctx.phase}" (e.g. before-state, mid-pour, finished work, closeup detail, or reference inspiration).`
    : "";

  const prompt =
    `Generate a single sentence of alt text for this photo, for use on a concrete contractor's marketing website. ` +
    serviceLine +
    " " +
    phaseLine +
    " " +
    `Be factual — describe what you see (surface, finish, setting, vehicles or furniture if visible). ` +
    `No marketing fluff, no superlatives, no opinions. ` +
    `Maximum ${MAX_ALT_TEXT_CHARS} characters. Output the alt text only — no surrounding quotes, no preamble.`;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "url", url: publicUrl } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Anthropic ${res.status}: ${body.slice(0, 200)}`,
        alt_text: fallback,
        source: "fallback",
      };
    }
    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = json.content?.find((c) => c.type === "text")?.text?.trim();
    if (!text || text.length === 0) {
      return {
        ok: false,
        error: "Empty model response",
        alt_text: fallback,
        source: "fallback",
      };
    }
    // Sanity check + truncate.
    const cleaned = text
      .replace(/^["']|["']$/g, "") // strip wrapping quotes if any slipped through
      .slice(0, MAX_ALT_TEXT_CHARS);
    return { ok: true, alt_text: cleaned, source: "ai" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      alt_text: fallback,
      source: "fallback",
    };
  }
}
