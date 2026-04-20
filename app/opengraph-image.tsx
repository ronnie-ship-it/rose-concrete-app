import { ImageResponse } from "next/og";

/**
 * Default OG image generated at request time by Next's edge ImageResponse.
 *
 * Replaces the static /public/og-default.png reference in metadata. Per-page
 * OG images can override by adding their own opengraph-image.tsx in the
 * page's folder, but the default is good enough for most marketing pages.
 *
 * Brand navy gradient + huge brand name + tagline + phone + license.
 * Renders to a 1200×630 PNG which is the canonical OG dimension.
 */

export const runtime = "edge";
export const alt =
  "Rose Concrete and Development — San Diego's Veteran-Owned Concrete Pros · (619) 537-9408";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          backgroundImage:
            "linear-gradient(135deg, #1B2A4A 0%, #0a0f1a 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top — eyebrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 22,
            color: "#5cd8d8",
            letterSpacing: 4,
            textTransform: "uppercase",
            fontWeight: 800,
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              backgroundColor: "#2ABFBF",
              borderRadius: 999,
            }}
          />
          San Diego County · CA License #1130763
        </div>

        {/* Center — headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              lineHeight: 1.0,
              letterSpacing: -2,
            }}
          >
            Rose Concrete
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 38,
              color: "#e8dcbc",
              lineHeight: 1.2,
              maxWidth: 920,
            }}
          >
            San Diego&apos;s Veteran-Owned Concrete Pros
          </div>
        </div>

        {/* Bottom — phone + trust */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 28,
            borderTop: "2px solid rgba(255,255,255,0.15)",
            fontSize: 26,
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 900,
              color: "#2ABFBF",
              letterSpacing: -1,
            }}
          >
            (619) 537-9408
          </div>
          <div
            style={{
              display: "flex",
              gap: 24,
              color: "#cbd5e1",
              fontWeight: 600,
            }}
          >
            <span>Veteran-Owned</span>
            <span style={{ color: "#5cd8d8" }}>·</span>
            <span>Fully Insured</span>
            <span style={{ color: "#5cd8d8" }}>·</span>
            <span>In-House Crew</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
