import { useEffect, useState } from "react";
import { ALLERGEN_LABELS, useI18n } from "../../i18n";

type Item = { allergens: string[] };

const STORAGE_KEY = "avoid-allergens";
/** Known allergens in a stable order; anything new sorts after them. */
const ORDER = Object.keys(ALLERGEN_LABELS.en);

/** Allergens the customer is avoiding, remembered on this device. */
export function useAvoidedAllergens() {
  const [avoid, setAvoid] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      return Array.isArray(saved) ? saved.filter((a): a is string => typeof a === "string") : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(avoid));
    } catch {}
  }, [avoid]);
  return [avoid, setAvoid] as const;
}

/** Items that contain none of the avoided allergens. */
export function withoutAllergens<T extends Item>(items: T[], avoid: string[]): T[] {
  return avoid.length === 0 ? items : items.filter((p) => !p.allergens.some((a) => avoid.includes(a)));
}

type Props = { items: Item[]; avoid: string[]; onChange: (avoid: string[]) => void };

/** "Avoiding something?" chips above the menu. Hides nothing itself: the page filters with withoutAllergens(). */
export function AllergenFilter({ items, avoid, onChange }: Props) {
  const { t, lang } = useI18n();
  const rank = (a: string) => (ORDER.indexOf(a) === -1 ? ORDER.length : ORDER.indexOf(a));
  const allergens = [...new Set(items.flatMap((p) => p.allergens))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  if (allergens.length === 0) return null;

  const active = avoid.filter((a) => allergens.includes(a));
  const hidden = items.length - withoutAllergens(items, active).length;
  const toggle = (a: string) => onChange(avoid.includes(a) ? avoid.filter((x) => x !== a) : [...avoid, a]);

  return (
    <div className="flex flex-col gap-3 rounded-3xl border-2 border-crumb bg-dough p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span id="avoid-heading" className="text-[17px] font-black">{t("avoiding")}</span>
        <span className="text-sm font-bold text-cinnamon">{t("avoidingHint")}</span>
      </div>
      <div role="group" aria-labelledby="avoid-heading" className="flex flex-wrap items-center gap-2">
        {allergens.map((a) => {
          const on = active.includes(a);
          return (
            <button key={a} type="button" aria-pressed={on} className={`${on ? "chip-active" : "chip"} h-11`} onClick={() => toggle(a)}>
              {ALLERGEN_LABELS[lang][a] ?? a}
            </button>
          );
        })}
        {active.length > 0 && (
          <>
            <span className="tag bg-blueberry-soft text-blueberry-depth" role="status">
              {t("itemsHidden", { n: hidden })}
            </span>
            <button type="button" className="h-11 px-2 text-sm font-extrabold text-blueberry" onClick={() => onChange([])}>
              {t("showAll")}
            </button>
          </>
        )}
      </div>
      {active.length > 0 && (
        <>
          {hidden === items.length && (
            <p className="rounded-2xl border-2 border-b-4 border-butter bg-butter-soft px-4 py-3 font-extrabold text-cocoa">{t("nothingLeft")}</p>
          )}
          <p className="text-xs font-bold text-cinnamon">{t("traces")}</p>
        </>
      )}
    </div>
  );
}
