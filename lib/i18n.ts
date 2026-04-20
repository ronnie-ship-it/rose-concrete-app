/**
 * Tiny i18n helper for the crew PWA. Ronnie's crew is bilingual; a handful
 * of them are Spanish-first and would rather not mentally translate "Clock
 * in" / "Mark complete" every day.
 *
 * Rather than pull in react-intl or next-intl (~60 KB for 15 strings), we:
 *   1. Store the user's `lang` preference in a cookie (see lib/preferences).
 *   2. Use a flat dictionary keyed by an English phrase.
 *   3. Provide a `t(lang, key)` lookup — missing Spanish keys fall back to
 *      the English phrase, so a half-translated screen never crashes.
 *
 * If a third locale ever shows up, add another map here + a dropdown; no
 * need to restructure.
 */
import type { LangPref } from "@/lib/preferences";

type Dict = Record<string, string>;

const es: Dict = {
  Today: "Hoy",
  Week: "Semana",
  Upload: "Subir",
  Forms: "Formularios",
  "Signed in as": "Sesión iniciada como",
  "Nothing scheduled today. Enjoy the breather.":
    "Nada programado hoy. Disfruta el descanso.",
  "Clock in": "Entrar",
  "Clock out": "Salir",
  "On my way": "En camino",
  "Mark complete": "Marcar completo",
  "Marked complete": "Marcado completo",
  "Add photo": "Agregar foto",
  "Required photo": "Foto requerida",
  "Call": "Llamar",
  "visit": "visita",
  "visits": "visitas",
  "on your plate.": "en tu lista.",
  "Hey": "Hola",
  "Sign out": "Cerrar sesión",
  "Today — Rose Concrete": "Hoy — Rose Concrete",
  "Language": "Idioma",
  "English": "English",
  "Español": "Español",
  // Schedule / upload / form screens
  "This week": "Esta semana",
  "Upload a photo": "Sube una foto",
  "Submit": "Enviar",
  "Saving…": "Guardando…",
  "Saved": "Guardado",
  "Notes": "Notas",
  "Add a note": "Agregar una nota",
  "Back": "Atrás",
  "Duration": "Duración",
  "Client": "Cliente",
  "Address": "Dirección",
  "min": "min",
};

const maps: Record<Exclude<LangPref, "en">, Dict> = { es };

/** Translate a string; returns the English key if no translation exists. */
export function t(lang: LangPref, key: string): string {
  if (lang === "en") return key;
  return maps[lang]?.[key] ?? key;
}

/** Plural helper — English-style s/no-s only, which is enough for our copy. */
export function tPlural(
  lang: LangPref,
  count: number,
  singular: string,
  plural: string,
): string {
  return count === 1 ? t(lang, singular) : t(lang, plural);
}
