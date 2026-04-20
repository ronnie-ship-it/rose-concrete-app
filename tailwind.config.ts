import type { Config } from "tailwindcss";

/**
 * Rose Concrete brand palette — matches the logo.
 *
 *   Primary navy  #1B2A4A  (brand.600 — use for primary buttons, headings,
 *                           the active sidebar state, links)
 *   Accent teal   #2ABFBF  (accent.500 — secondary buttons, highlights,
 *                           focus rings, progress indicators)
 *   Cream         #F5EFE0  (cream — page backgrounds under cards)
 *   White         #FFFFFF  (card surfaces, sidebar)
 *
 * 50 / 100 / 300 / 700 / 900 shades are tints/shades of the primary so
 * hover states, subtle fills, and dark accents all stay in-family.
 */
const config: Config = {
  // Dark mode is a user preference stored in a cookie; when dark, we add
  // class="dark" to <html> in the root layout. Tailwind's `dark:` variants
  // then flip colors via `darkMode: "class"`.
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef1f7",
          100: "#d7dde9",
          200: "#a9b3cb",
          300: "#7a89ad",
          400: "#4c5f8f",
          500: "#2d416f",
          600: "#1B2A4A",
          700: "#162139",
          800: "#111829",
          900: "#0a0f1a",
        },
        accent: {
          50:  "#e9f9f9",
          100: "#c8f1f1",
          200: "#92e5e5",
          300: "#5cd8d8",
          400: "#2ABFBF",
          500: "#2ABFBF",
          600: "#1f9999",
          700: "#177373",
          800: "#104c4c",
          900: "#082626",
        },
        cream: {
          DEFAULT: "#F5EFE0",
          50:  "#fdfbf5",
          100: "#F5EFE0",
          200: "#e8dcbc",
          300: "#d8c692",
        },
      },
      fontFamily: {
        sans: ["system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
