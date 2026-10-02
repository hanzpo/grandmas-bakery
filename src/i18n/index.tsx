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
    menuSections: "Menu sections",
    items: "items",
    viewOrder: "View order",
    chatOpen: "Ask Grandma",
    chatTitle: "Grandma",
    chatSubtitle: "Ask me about the menu, or order for pickup.",
    chatPlaceholder: "Type a message…",
    chatSend: "Send",
    chatClose: "Close chat",
    chatTalk: "Call Grandma",
    chatHangUp: "Hang up",
    chatConnecting: "Connecting",
    chatListening: "Listening",
    chatSpeaking: "Talking",
    chatThinking: "Grandma is typing",
    chatEmpty: "Hello, dear! Come in, come in. Ask me what's fresh today, or tell me what you'd like to pick up.",
    chatError: "Oh dear, I couldn't hear you. Please try again, or call the bakery.",
    chatSuggestMenu: "What's on the menu?",
    chatSuggestHours: "When are you open?",
    chatSuggestAllergens: "Anything nut-free?",
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
    menuSections: "Secciones del menú",
    items: "artículos",
    viewOrder: "Ver pedido",
    chatOpen: "Pregúntale a la abuela",
    chatTitle: "La abuela",
    chatSubtitle: "Pregúntame por el menú o pide para recoger.",
    chatPlaceholder: "Escribe un mensaje…",
    chatSend: "Enviar",
    chatClose: "Cerrar chat",
    chatTalk: "Llamar a la abuela",
    chatHangUp: "Colgar",
    chatConnecting: "Conectando",
    chatListening: "Escuchando",
    chatSpeaking: "Hablando",
    chatThinking: "La abuela está escribiendo",
    chatEmpty: "¡Hola, cariño! Pasa, pasa. Pregúntame qué hay fresco hoy o dime qué quieres recoger.",
    chatError: "Ay, no te escuché bien. Inténtalo de nuevo o llama a la panadería.",
    chatSuggestMenu: "¿Qué hay en el menú?",
    chatSuggestHours: "¿Cuándo abren?",
    chatSuggestAllergens: "¿Algo sin frutos secos?",
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
    menuSections: "菜单分类",
    items: "件",
    viewOrder: "查看订单",
    chatOpen: "问问奶奶",
    chatTitle: "奶奶",
    chatSubtitle: "问问菜单，或预订自取。",
    chatPlaceholder: "输入消息…",
    chatSend: "发送",
    chatClose: "关闭聊天",
    chatTalk: "给奶奶打电话",
    chatHangUp: "挂断",
    chatConnecting: "连接中",
    chatListening: "正在听",
    chatSpeaking: "正在说",
    chatThinking: "奶奶正在输入",
    chatEmpty: "你好呀，乖！快进来。问问奶奶今天有什么新鲜的，或者告诉我想取些什么。",
    chatError: "哎呀，奶奶没听清。请再试一次，或致电面包店。",
    chatSuggestMenu: "菜单上有什么？",
    chatSuggestHours: "营业时间是？",
    chatSuggestAllergens: "有不含坚果的吗？",
  },
} satisfies Record<Lang, Record<string, string>>;

export const ALLERGEN_LABELS: Record<Lang, Record<string, string>> = {
  en: { dairy: "Dairy", gluten: "Gluten", nuts: "Nuts", egg: "Egg", soy: "Soy" },
  es: { dairy: "Lácteos", gluten: "Gluten", nuts: "Frutos secos", egg: "Huevo", soy: "Soja" },
  zh: { dairy: "乳制品", gluten: "麸质", nuts: "坚果", egg: "鸡蛋", soy: "大豆" },
};

/** Menu sections, in the order the customer menu shows them. Unknown categories go last. */
export const CATEGORIES = ["parfait", "pastry", "bread", "cookie", "cake", "drink"] as const;

export const CATEGORY_LABELS: Record<Lang, Record<string, string>> = {
  en: { parfait: "Parfaits", pastry: "Pastries", bread: "Breads", cookie: "Cookies & Bars", cake: "Cakes & Pies", drink: "Drinks" },
  es: { parfait: "Parfaits", pastry: "Bollería", bread: "Panes", cookie: "Galletas y barras", cake: "Pasteles y pays", drink: "Bebidas" },
  zh: { parfait: "芭菲", pastry: "酥点", bread: "面包", cookie: "曲奇和甜点棒", cake: "蛋糕和派", drink: "饮品" },
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
