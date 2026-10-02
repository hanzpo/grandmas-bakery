import type { ReactNode } from "react";
import { ALLERGEN_LABELS, localized, useI18n } from "../i18n";
import { money } from "../lib/format";
import type { MenuItem } from "../lib/menu";

export function ProductCard({ item, action }: { item: MenuItem; action?: ReactNode }) {
  const { lang, t } = useI18n();
  const { name, description } = localized(item, lang);
  return (
    <article className={`card flex flex-col ${item.is_flavor_of_month ? "border-terracotta ring-2 ring-terracotta/20" : ""}`}>
      {item.is_flavor_of_month && (
        <span className="mb-2 self-start rounded-full bg-terracotta px-3 py-1 text-xs font-semibold text-white">
          {t("flavorOfMonth")}
        </span>
      )}
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xl">{name}</h3>
        <span className="font-semibold">{money(item.price_cents)}</span>
      </div>
      {description && <p className="mt-1 text-muted">{description}</p>}
      <p className="mt-3 text-sm">
        {item.allergens.length > 0 ? (
          <>
            <span className="font-medium">{t("contains")}: </span>
            {item.allergens.map((a) => ALLERGEN_LABELS[lang][a] ?? a).join(", ")}
          </>
        ) : (
          <span className="text-sage">{t("noAllergens")}</span>
        )}
      </p>
      {action && <div className="mt-auto pt-4">{action}</div>}
    </article>
  );
}
