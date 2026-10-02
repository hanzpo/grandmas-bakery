import { createContext, useContext, useState, type ReactNode } from "react";

export const LANGUAGES = { en: "English", es: "Español", zh: "中文" } as const;
export type Lang = keyof typeof LANGUAGES;

const strings = {
  en: {
    tagline: "Handmade parfaits, layered with love.",
    orderNow: "Order for pickup",
    flavorOfMonth: "Flavor of the month",
    contains: "Contains",
    noAllergens: "No common allergens",
    yourOrder: "Your order",
    name: "Name",
    email: "Email",
    phone: "Phone (optional)",
    pickup: "Pickup time",
    notes: "Notes (allergies, requests)",
    optIn: "Send me Grandma's specials & loyalty rewards",
    pay: "Pay with card",
    total: "Total",
    thanks: "Thank you! Your order is in.",
    thanksBody: "Grandma has your order. We'll have it ready at pickup time.",
    backToMenu: "Back to menu",
    add: "Add",
    cancelled: "Checkout cancelled. Your cart is still here.",
  },
  es: {
    tagline: "Parfaits hechos a mano, con mucho cariño.",
    orderNow: "Pedir para recoger",
    flavorOfMonth: "Sabor del mes",
    contains: "Contiene",
    noAllergens: "Sin alérgenos comunes",
    yourOrder: "Tu pedido",
    name: "Nombre",
    email: "Correo",
    phone: "Teléfono (opcional)",
    pickup: "Hora de recogida",
    notes: "Notas (alergias, peticiones)",
    optIn: "Envíenme ofertas y recompensas de la abuela",
    pay: "Pagar con tarjeta",
    total: "Total",
    thanks: "¡Gracias! Recibimos tu pedido.",
    thanksBody: "La abuela tiene tu pedido. Estará listo a la hora de recogida.",
    backToMenu: "Volver al menú",
    add: "Añadir",
    cancelled: "Pago cancelado. Tu carrito sigue aquí.",
  },
  zh: {
    tagline: "手工制作的芭菲，层层都是爱。",
    orderNow: "预订自取",
    flavorOfMonth: "本月口味",
    contains: "含有",
    noAllergens: "不含常见过敏原",
    yourOrder: "您的订单",
    name: "姓名",
    email: "电子邮件",
    phone: "电话（可选）",
    pickup: "取餐时间",
    notes: "备注（过敏、要求）",
    optIn: "给我发送奶奶的特惠和积分奖励",
    pay: "刷卡支付",
    total: "总计",
    thanks: "谢谢！订单已收到。",
    thanksBody: "奶奶已收到您的订单，取餐时会为您准备好。",
    backToMenu: "返回菜单",
    add: "添加",
    cancelled: "已取消付款，购物车仍保留。",
  },
} satisfies Record<Lang, Record<string, string>>;

export const ALLERGEN_LABELS: Record<Lang, Record<string, string>> = {
  en: { dairy: "Dairy", gluten: "Gluten", nuts: "Nuts", egg: "Egg", soy: "Soy" },
  es: { dairy: "Lácteos", gluten: "Gluten", nuts: "Frutos secos", egg: "Huevo", soy: "Soja" },
  zh: { dairy: "乳制品", gluten: "麸质", nuts: "坚果", egg: "鸡蛋", soy: "大豆" },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: keyof (typeof strings)["en"]) => string };
const I18nContext = createContext<Ctx | null>(null);

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem("lang");
    if (saved && saved in LANGUAGES) return saved as Lang;
  } catch {}
  const nav = navigator.language.slice(0, 2);
  return nav in LANGUAGES ? (nav as Lang) : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
    } catch {}
  };
  return (
    <I18nContext.Provider value={{ lang, setLang, t: (k) => strings[lang][k] }}>{children}</I18nContext.Provider>
  );
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
