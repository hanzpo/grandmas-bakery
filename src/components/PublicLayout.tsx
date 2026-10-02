import { BAKERY } from "../lib/bakery";
import { createContext, useContext, useState } from "react";
import { Link, Outlet } from "react-router";
import { I18nProvider, LANGUAGES, useI18n, type Lang } from "../i18n";
import { BunBunLogo } from "./illustrations";

/** Cart count shared with the header badge. Home owns the cart and reports its size here. */
const CartCountContext = createContext<{ count: number; setCount: (n: number) => void }>({
  count: 0,
  setCount: () => {},
});
export const useCartCount = () => useContext(CartCountContext);

function Header() {
  const { lang, setLang } = useI18n();
  const { count } = useCartCount();
  return (
    <header className="sticky top-0 z-30 border-b-2 border-crumb bg-white">
      <div className="mx-auto flex max-w-[1120px] items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="Grandma's Bakery home">
          <BunBunLogo className="h-9 w-11" />
          <span className="text-lg font-black whitespace-nowrap sm:text-xl">
            Grandma's <span className="text-jam">Bakery</span>
          </span>
        </Link>
        <nav aria-label="Site" className="ml-auto flex items-center gap-2 sm:gap-5">
          <a href="/#menu" className="hidden font-extrabold sm:inline">Menu</a>
          <a href="/#visit" className="hidden font-extrabold sm:inline">Visit</a>
          <select
            aria-label="Language"
            className="h-11 w-16 rounded-[14px] border-2 border-crumb bg-white px-1 text-sm font-extrabold sm:w-auto sm:px-2"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
          >
            {Object.entries(LANGUAGES).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
          <a
            href="/#cart"
            aria-label={`Cart, ${count} items`}
            className="flex h-11 items-center gap-2 rounded-[14px] border-2 border-b-4 border-crumb bg-white px-3 text-[15px] font-black sm:px-4"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
              <path d="M6 8h12l-1 12H7z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
            <span className="hidden sm:inline">Cart</span>
            {count > 0 && (
              <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-jam px-1.5 text-xs font-black text-white">
                {count}
              </span>
            )}
          </a>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t-2 border-crumb">
      <div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-2 px-4 py-6 text-sm font-extrabold text-cinnamon sm:px-6">
        <span>Grandma's Bakery · {BAKERY.address}</span>
        <span>Made with butter and love</span>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  const [count, setCount] = useState(0);
  return (
    <I18nProvider>
      <CartCountContext.Provider value={{ count, setCount }}>
        <div className="min-h-screen bg-flour">
          <Header />
          <main>
            <Outlet />
          </main>
          <Footer />
        </div>
      </CartCountContext.Provider>
    </I18nProvider>
  );
}
