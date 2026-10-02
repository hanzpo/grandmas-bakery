import { Link, Outlet } from "react-router";
import { I18nProvider, LANGUAGES, useI18n, type Lang } from "../i18n";

function Header() {
  const { lang, setLang } = useI18n();
  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between p-4">
      <Link to="/" className="font-display text-2xl font-extrabold text-terracotta">Grandma's Bakery</Link>
      <select
        aria-label="Language"
        className="rounded-lg border border-crust bg-white px-3 py-2 text-sm"
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
      >
        {Object.entries(LANGUAGES).map(([code, label]) => (
          <option key={code} value={code}>{label}</option>
        ))}
      </select>
    </header>
  );
}

export function PublicLayout() {
  return (
    <I18nProvider>
      <Header />
      <main className="mx-auto max-w-5xl px-4 pb-16">
        <Outlet />
      </main>
    </I18nProvider>
  );
}
