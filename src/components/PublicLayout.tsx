import { BAKERY } from "../lib/bakery";
import { Link, Outlet } from "react-router";
import { useI18n } from "../i18n";
import { BunBunLogo } from "./illustrations";
import { LanguageSwitcher } from "./public/LanguageSwitcher";
import { useCartCount } from "./RootLayout";

function Header() {
  const { t } = useI18n();
  const { count } = useCartCount();
  return (
    <header className="sticky top-0 z-30 border-b-2 border-crumb bg-white">
      <div className="mx-auto flex max-w-[1120px] items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label={t("homeAria")}>
          <BunBunLogo className="h-9 w-11" />
          <span className="text-lg font-black whitespace-nowrap sm:text-xl">
            Grandma's <span className="text-jam">Bakery</span>
          </span>
        </Link>
        <nav aria-label={t("siteNav")} className="ml-auto flex items-center gap-2 sm:gap-5">
          <a href="/#menu" className="hidden font-extrabold sm:inline">{t("navMenu")}</a>
          <a href="/#visit" className="hidden font-extrabold sm:inline">{t("navVisit")}</a>
          <LanguageSwitcher />
          <a
            href="/#cart"
            aria-label={t("cartAria", { count })}
            className="flex h-11 items-center gap-2 rounded-[14px] border-2 border-b-4 border-crumb bg-white px-3 text-[15px] font-black sm:px-4"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
              <path d="M6 8h12l-1 12H7z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
            <span className="hidden sm:inline">{t("cart")}</span>
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
  const { t } = useI18n();
  return (
    <footer className="border-t-2 border-crumb">
      <div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-2 px-4 py-6 text-sm font-extrabold text-cinnamon sm:px-6">
        <span>Grandma's Bakery · {BAKERY.address}</span>
        <span>{t("footerTagline")}</span>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-flour">
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
