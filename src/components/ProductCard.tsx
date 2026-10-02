import { ALLERGEN_LABELS, localized, useI18n } from "../i18n";
import { money } from "../lib/format";
import type { MenuItem } from "../lib/menu";
import { productArt } from "./public/productArt";

type Props = {
  item: MenuItem;
  index?: number;
  quantity?: number;
  onChange?: (quantity: number) => void;
};

export function ProductCard({ item, index = 0, quantity = 0, onChange }: Props) {
  const { lang, t } = useI18n();
  const { name, description } = localized(item, lang);
  const { Icon, tint } = productArt(item, index);

  const allergenLine =
    item.allergens.length > 0
      ? `${t("contains")}: ${item.allergens.map((a) => ALLERGEN_LABELS[lang][a] ?? a).join(", ")}`
      : t("noAllergens");

  return (
    <>
    {/* Phones/tablets: compact row so the menu isn't a mile long. */}
    <article className="flex gap-3 rounded-[20px] border-2 border-b-4 border-crumb bg-white p-3 lg:hidden">
      <div className={`relative flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-2xl ${tint}`}>
        <Icon className="h-14 w-14" />
        {item.is_flavor_of_month && (
          <span className="absolute -top-1.5 -left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-butter text-xs font-black text-cocoa shadow-[0_2px_0_var(--color-butter-depth)]" aria-label="Grandma's pick">★</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[17px] leading-tight font-black">{name}</h3>
          <span className="shrink-0 font-black">{money(item.price_cents)}</span>
        </div>
        {description && <p className="mt-0.5 line-clamp-2 text-sm leading-snug font-bold text-cinnamon">{description}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
          <p className="line-clamp-1 text-[11px] font-bold text-cinnamon">{allergenLine}</p>
          {onChange &&
            (quantity > 0 ? (
              <div className="flex shrink-0 items-center gap-1 rounded-full border-2 border-pistachio bg-pistachio-soft p-0.5">
                <button type="button" aria-label="Remove one" className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black" onClick={() => onChange(quantity - 1)}>−</button>
                <span className="w-5 text-center font-black text-pistachio-depth">{quantity}</span>
                <button type="button" aria-label="Add one" className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg font-black" onClick={() => onChange(quantity + 1)}>+</button>
              </div>
            ) : (
              <button
                type="button"
                aria-label={`${t("add")} ${name}`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-jam text-2xl font-black text-white shadow-[0_3px_0_var(--color-jam-depth)] active:translate-y-0.5 active:shadow-[0_1px_0_var(--color-jam-depth)]"
                onClick={() => onChange(1)}
              >
                +
              </button>
            ))}
        </div>
      </div>
    </article>

    <article className="hidden flex-col gap-3 rounded-[22px] border-2 border-b-[5px] border-crumb bg-white p-3.5 lg:flex">
      <div className={`relative flex h-36 items-center justify-center rounded-2xl ${tint}`}>
        <Icon className="h-24 w-24" />
        {item.is_flavor_of_month && (
          <span className="tag absolute top-2.5 left-2.5 bg-butter-soft text-butter-depth">Grandma's pick</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[19px] font-black leading-tight">{name}</h3>
          <span className="text-[17px] font-black">{money(item.price_cents)}</span>
        </div>
        {description && <p className="text-[15px] leading-snug font-bold text-cinnamon">{description}</p>}
        <p className="mt-1 text-xs font-bold text-cinnamon">{allergenLine}</p>
      </div>
      {onChange &&
        (quantity > 0 ? (
          <div className="flex h-12 items-center justify-between rounded-[14px] border-2 border-pistachio bg-pistachio-soft px-1.5">
            <button
              type="button"
              aria-label="Remove one"
              className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white text-xl font-black text-cocoa"
              onClick={() => onChange(quantity - 1)}
            >
              −
            </button>
            <span className="font-black text-pistachio-depth">{quantity} in cart</span>
            <button
              type="button"
              aria-label="Add one"
              className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white text-xl font-black text-cocoa"
              onClick={() => onChange(quantity + 1)}
            >
              +
            </button>
          </div>
        ) : (
          <button type="button" className="btn-primary h-12 w-full py-0" onClick={() => onChange(1)}>
            {t("add")}
          </button>
        ))}
    </article>
    </>
  );
}
