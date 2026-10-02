import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en, type Messages } from "./locales/en";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { ko } from "./locales/ko";
import { pa } from "./locales/pa";
import { tl } from "./locales/tl";
import { vi } from "./locales/vi";
import { zh } from "./locales/zh";

export const LANGUAGES = {
  en: { native: "English", short: "EN" },
  fr: { native: "Français", short: "FR" },
  es: { native: "Español", short: "ES" },
  zh: { native: "简体中文", short: "中文" },
  ko: { native: "한국어", short: "한국어" },
  vi: { native: "Tiếng Việt", short: "VI" },
  pa: { native: "ਪੰਜਾਬੀ", short: "ਪੰ" },
  tl: { native: "Tagalog", short: "TL" },
} as const;
export type Lang = keyof typeof LANGUAGES;

const MESSAGES: Record<Lang, Messages> = { en, fr, es, zh, ko, vi, pa, tl };

/** BCP 47 tag for Intl APIs and <html lang>. */
export const INTL_LOCALE: Record<Lang, string> = {
  en: "en-CA",
  fr: "fr-CA",
  es: "es",
  zh: "zh-CN",
  ko: "ko",
  vi: "vi",
  pa: "pa-Guru",
  tl: "fil",
};

export type MessageKey = keyof Messages;
type Vars = Record<string, string | number>;

const fill = (template: string, vars?: Vars) =>
  vars ? template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : template;

export const ALLERGEN_LABELS: Record<Lang, Record<string, string>> = {
  en: { dairy: "Dairy", gluten: "Gluten", nuts: "Nuts", egg: "Egg", soy: "Soy", sesame: "Sesame" },
  fr: { dairy: "Lait", gluten: "Gluten", nuts: "Noix", egg: "Œufs", soy: "Soya", sesame: "Sésame" },
  es: { dairy: "Lácteos", gluten: "Gluten", nuts: "Frutos secos", egg: "Huevo", soy: "Soja", sesame: "Sésamo" },
  zh: { dairy: "乳制品", gluten: "麸质", nuts: "坚果", egg: "鸡蛋", soy: "大豆", sesame: "芝麻" },
  ko: { dairy: "유제품", gluten: "글루텐", nuts: "견과류", egg: "달걀", soy: "대두", sesame: "참깨" },
  vi: { dairy: "Sữa", gluten: "Gluten", nuts: "Các loại hạt", egg: "Trứng", soy: "Đậu nành", sesame: "Mè" },
  pa: { dairy: "ਡੇਅਰੀ", gluten: "ਗਲੂਟਨ", nuts: "ਗਿਰੀਆਂ", egg: "ਆਂਡਾ", soy: "ਸੋਇਆ", sesame: "ਤਿਲ" },
  tl: { dairy: "Gatas", gluten: "Gluten", nuts: "Mani", egg: "Itlog", soy: "Soya", sesame: "Linga" },
};

/** Menu sections, in the order the customer menu shows them. Unknown categories go last. */
export const CATEGORIES = ["parfait", "pastry", "bread", "cookie", "cake", "drink"] as const;

const CATEGORY_KEYS: Record<(typeof CATEGORIES)[number], MessageKey> = {
  parfait: "catParfait",
  pastry: "catPastry",
  bread: "catBread",
  cookie: "catCookie",
  cake: "catCake",
  drink: "catDrink",
};

export const CATEGORY_LABELS = Object.fromEntries(
  (Object.keys(MESSAGES) as Lang[]).map((l) => [
    l,
    Object.fromEntries(CATEGORIES.map((c) => [c, MESSAGES[l][CATEGORY_KEYS[c]]])),
  ]),
) as Record<Lang, Record<string, string>>;

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: MessageKey, vars?: Vars) => string;
  locale: string;
};
const I18nContext = createContext<Ctx | null>(null);

const isLang = (v: string | null | undefined): v is Lang => !!v && v in LANGUAGES;

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem("lang");
    if (isLang(saved)) return saved;
  } catch {}
  const preferred = typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    if (base === "fil") return "tl";
    if (isLang(base)) return base;
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = INTL_LOCALE[lang];
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
    } catch {}
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      locale: INTL_LOCALE[lang],
      t: (key, vars) => fill(MESSAGES[lang][key] ?? en[key], vars),
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

/** Pick a product's translated name/description, falling back to English. */
export function localized(
  p: { name: string; description: string | null; translations: unknown },
  lang: Lang,
) {
  const tr = (p.translations as Record<string, { name?: string; description?: string }> | null)?.[lang];
  return { name: tr?.name ?? p.name, description: tr?.description ?? p.description };
}
