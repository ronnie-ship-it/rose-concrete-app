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
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#b91c1c",
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
