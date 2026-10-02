import { useEffect, useRef, useState } from "react";
import { LANGUAGES, useI18n, type Lang } from "../../i18n";

const CODES = Object.keys(LANGUAGES) as Lang[];

/** Globe button + menu of languages in their own names. */
export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    // Focus the current language when the menu opens.
    itemRefs.current[CODES.indexOf(lang)]?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choose = (l: Lang) => {
    setLang(l);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    const i = itemRefs.current.findIndex((el) => el === document.activeElement);
    const move = (n: number) => {
      e.preventDefault();
      itemRefs.current[(i + n + CODES.length) % CODES.length]?.focus();
    };
    if (e.key === "ArrowDown") move(1);
    else if (e.key === "ArrowUp") move(-1);
    else if (e.key === "Home") move(-i);
    else if (e.key === "End") move(CODES.length - 1 - i);
    else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t("language")}: ${LANGUAGES[lang].native}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex h-11 items-center gap-1.5 rounded-[14px] border-2 border-b-4 bg-white px-2.5 text-sm font-black whitespace-nowrap sm:px-3 ${
          open ? "border-blueberry text-blueberry-depth" : "border-crumb"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
        </svg>
        <span>{LANGUAGES[lang].short}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("language")}
          onKeyDown={onMenuKey}
          className="absolute top-[calc(100%+8px)] right-0 z-50 w-56 max-w-[calc(100vw-2rem)] rounded-2xl border-2 border-crumb bg-white p-1.5 shadow-[0_4px_0_var(--color-crumb)]"
        >
          {CODES.map((code, i) => {
            const on = code === lang;
            return (
              <button
                key={code}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                lang={code}
                onClick={() => choose(code)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] font-extrabold outline-none focus-visible:ring-2 focus-visible:ring-blueberry ${
                  on ? "bg-blueberry-soft text-blueberry-depth" : "hover:bg-dough focus:bg-dough"
                }`}
              >
                <span>{LANGUAGES[code].native}</span>
                {on && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
