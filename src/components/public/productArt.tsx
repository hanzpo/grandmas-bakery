import type { ComponentType, SVGProps } from "react";
import {
  BananaBreadIcon,
  CinnamonRollIcon,
  CookieIcon,
  CupcakeIcon,
  MugIcon,
  PieIcon,
  SourdoughIcon,
} from "../illustrations";

type Art = { Icon: ComponentType<SVGProps<SVGSVGElement>>; tint: string };

const RULES: [RegExp, Art][] = [
  [/coffee|latte|tea\b|hot-chocolate|lemonade/i, { Icon: MugIcon, tint: "bg-blueberry-soft" }],
  [/sourdough|loaf|bread|baguette/i, { Icon: SourdoughIcon, tint: "bg-dough" }],
  [/cinnamon|roll|bun|croissant|scone|turnover/i, { Icon: CinnamonRollIcon, tint: "bg-butter-soft" }],
  [/cupcake|cake|muffin|parfait|strawberry|berry/i, { Icon: CupcakeIcon, tint: "bg-jam-soft" }],
  [/cookie|biscuit|snickerdoodle|brownie|bar\b/i, { Icon: CookieIcon, tint: "bg-pistachio-soft" }],
  [/pie|tart|fall|pumpkin|apple/i, { Icon: PieIcon, tint: "bg-blueberry-soft" }],
  [/banana|yogurt|cup/i, { Icon: BananaBreadIcon, tint: "bg-butter-soft" }],
];

const FALLBACK: Art[] = [
  { Icon: CupcakeIcon, tint: "bg-jam-soft" },
  { Icon: CookieIcon, tint: "bg-pistachio-soft" },
  { Icon: PieIcon, tint: "bg-blueberry-soft" },
  { Icon: CinnamonRollIcon, tint: "bg-butter-soft" },
];

/** Illustration for each menu section (kiosk rail and section headers). */
export const CATEGORY_ART: Record<string, Art> = {
  parfait: { Icon: CupcakeIcon, tint: "bg-jam-soft" },
  pastry: { Icon: CinnamonRollIcon, tint: "bg-butter-soft" },
  bread: { Icon: SourdoughIcon, tint: "bg-dough" },
  cookie: { Icon: CookieIcon, tint: "bg-pistachio-soft" },
  cake: { Icon: PieIcon, tint: "bg-blueberry-soft" },
  drink: { Icon: MugIcon, tint: "bg-blueberry-soft" },
};

/** Pick an illustration + tinted panel for a product by its slug/name. */
export function productArt(p: { slug: string; name: string }, index = 0): Art {
  const key = `${p.slug} ${p.name}`;
  return RULES.find(([re]) => re.test(key))?.[1] ?? FALLBACK[index % FALLBACK.length];
}

export const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
