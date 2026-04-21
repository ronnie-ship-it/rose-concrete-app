import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  // metadataBase resolves relative OG image URLs to the marketing apex.
  // Per-route layouts (e.g. app/(marketing)/layout.tsx) can override.
  metadataBase: new URL("https://sandiegoconcrete.ai"),
  title: "Rose Concrete",
  description: "Rose Concrete operations platform",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Rose Concrete",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    // iOS-only touch icon. 180×180 is Apple's recommended size and the
    // icon is a tight-fit (no maskable safe-zone padding) because iOS
    // rounds the corners itself. Using the 192px maskable icon here
    // would leave visible brand-navy padding inside the rounded iOS
    // tile — which, combined with the old red theme_color, is why
    // users saw a red/navy tile with a tiny logo instead of the full
    // Rose badge.
    apple: [{ url: "/apple-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Brand navy — matches manifest.webmanifest's theme_color so iOS /
  // Android don't synthesize a red fallback tile when they can't
  // resolve the icon.
  themeColor: "#1B2A4A",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read theme + language preference cookies server-side so the class and
  // lang attribute are correct on first paint (no flash of wrong theme).
  const store = await cookies();
  const theme = store.get("theme")?.value === "dark" ? "dark" : "light";
  const lang = store.get("lang")?.value === "es" ? "es" : "en";
  return (
    <html lang={lang} className={theme === "dark" ? "dark" : undefined}>
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased dark:bg-brand-900 dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}
