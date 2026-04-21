/**
 * Generate PWA icons from public/logo.png.
 *
 * Three sizes + two purposes:
 *
 *   1. icon-192.png (192×192, maskable)   — Android home-screen mask.
 *      Logo fits inside the centre 82% so Android's rounded-square /
 *      circle mask doesn't clip it.
 *
 *   2. icon-512.png (512×512, maskable)   — same, bigger. Used by
 *      Android "install to home screen" and splash-screen generation.
 *
 *   3. apple-icon-180.png (180×180, tight fit) — Apple's recommended
 *      touch-icon size. iOS rounds the corners itself, so we do NOT
 *      apply a safe-zone inset — the logo fills ~96% of the square so
 *      it looks tight on the home screen. We also symlink this to
 *      /apple-touch-icon.png so iOS finds it without a `<link>` tag.
 *
 * Run: node scripts/generate-pwa-icons.mjs
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { copyFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const SOURCE = join(root, "public", "logo.png");

// Rose Concrete brand navy (tailwind brand-600).
const BRAND = { r: 0x1b, g: 0x2a, b: 0x4a, alpha: 1 };

const TARGETS = [
  // Android maskable icons — 82% safe zone.
  { size: 192, out: "icon-192.png", inset: 0.82, background: BRAND },
  { size: 512, out: "icon-512.png", inset: 0.82, background: BRAND },
  // Apple touch icon — tight fit, iOS rounds corners.
  { size: 180, out: "apple-icon-180.png", inset: 0.96, background: BRAND },
];

async function main() {
  for (const { size, out, inset, background } of TARGETS) {
    const innerSize = Math.round(size * inset);
    const resizedLogo = await sharp(SOURCE)
      .resize(innerSize, innerSize, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const outputPath = join(root, "public", out);
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background,
      },
    })
      .composite([{ input: resizedLogo, gravity: "center" }])
      .png({ compressionLevel: 9 })
      .toFile(outputPath);

    console.log(`✓ wrote public/${out} (${size}×${size})`);
  }

  // iOS looks for /apple-touch-icon.png at the root without any
  // <link> tag — serve the 180px as that default path so stray
  // Safari installs always find a proper icon.
  const appleSrc = join(root, "public", "apple-icon-180.png");
  const appleAlias = join(root, "public", "apple-touch-icon.png");
  copyFileSync(appleSrc, appleAlias);
  console.log(`✓ aliased public/apple-touch-icon.png → apple-icon-180.png`);
}

main().catch((err) => {
  console.error("✗ icon generation failed:", err);
  process.exit(1);
});
