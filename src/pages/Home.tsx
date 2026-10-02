import { BAKERY, todaysHours } from "../lib/bakery";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { BunBun } from "../components/illustrations";
import { ProductCard } from "../components/ProductCard";
import { useCartCount } from "../components/PublicLayout";
import { titleCase } from "../components/public/productArt";
import { localized, useI18n } from "../i18n";
import { money } from "../lib/format";
import { useMenu, type MenuItem } from "../lib/menu";

const FEATURES = [
  {
    title: "Made from scratch",
    body: "Everything is baked in our kitchen each morning. No mixes, no shortcuts.",
    tint: "bg-jam-soft text-jam",
    icon: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  },
  {
    title: "Call or text any time",
    body: "Our phone line takes orders day and night. Grandma calls you back for anything tricky.",
    tint: "bg-blueberry-soft text-blueberry",
    icon: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  },
  {
    title: "Quick pickup",
    body: "Pick a time at checkout. Your order waits for you at the counter, still warm.",
    tint: "bg-pistachio-soft text-pistachio-depth",
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l3 2" />
      </>
    ),
  },
];

export default function Home() {
  const { t, lang } = useI18n();
  const menu = useMenu();
  const [params] = useSearchParams();
  const { setCount } = useCartCount();
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [step, setStep] = useState<"cart" | "details">("cart");
  const [form, setForm] = useState({ name: "", email: "", phone: "", pickup_at: "", notes: "", marketing_opt_in: false });

  const items = menu.data ?? [];
  const categories = useMemo(() => ["all", ...new Set(items.map((p) => p.category))], [items]);
  const shown = category === "all" ? items : items.filter((p) => p.category === category);
  const lines = items.filter((p) => cart[p.id]).map((p) => ({ product: p, quantity: cart[p.id] }));
  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const total = lines.reduce((s, l) => s + l.product.price_cents * l.quantity, 0);

  useEffect(() => setCount(count), [count, setCount]);
  useEffect(() => {
    if (count === 0) setStep("cart");
  }, [count]);

  const setQty = (id: string, q: number) => setCart(({ [id]: _, ...rest }) => (q > 0 ? { ...rest, [id]: q } : rest));

  const checkout = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name: form.name, email: form.email, phone: form.phone || undefined, marketing_opt_in: form.marketing_opt_in },
          items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
          pickup_at: form.pickup_at ? new Date(form.pickup_at).toISOString() : undefined,
          notes: form.notes || undefined,
        }),
      });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error ?? "Checkout failed");
      return body.url;
    },
    onSuccess: (url) => location.assign(url),
  });

  const featured: MenuItem | undefined = items.find((p) => p.is_flavor_of_month) ?? items[0];

  return (
    <>
      {/* Hero */}
      <section className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-10 px-4 pt-10 pb-10 sm:px-6 sm:pt-14">
        <div className="flex flex-[1_1_420px] flex-col gap-5">
          <div className="flex items-center gap-2 self-start rounded-full bg-pistachio-soft px-3.5 py-2 text-sm font-black text-[#24692b]">
            <span className="h-2.5 w-2.5 rounded-full bg-pistachio" />
            {todaysHours()}
          </div>
          <h1 className="text-[clamp(40px,6vw,64px)] leading-[1.02] font-black tracking-[-0.02em]">
            Baked this morning,
            <br />
            <span className="text-jam">by Grandma.</span>
          </h1>
          <p className="max-w-[480px] text-[19px] leading-normal font-bold text-cinnamon">{t("tagline")} Order online for pickup, or just call or text us.</p>
          <div className="flex flex-wrap gap-3">
            <a href="#menu" className="btn-primary h-14 px-7">{t("orderNow")}</a>
            <a href={BAKERY.phoneHref} className="btn-ghost h-14 px-7">Call or text us</a>
          </div>
        </div>
        <div className="relative flex flex-[1_1_360px] justify-center">
          <div className="flex aspect-square w-full max-w-[420px] items-center justify-center rounded-[48px] border-b-8 border-[#f5d98a] bg-butter-soft">
            <BunBun className="w-[78%]" />
          </div>
          {featured && (
            <div className="absolute bottom-6 left-0 flex flex-col gap-0.5 rounded-[18px] border-2 border-b-4 border-crumb bg-white px-4 py-3">
              <span className="text-xs font-black tracking-[0.1em] text-cinnamon uppercase">Just out of the oven</span>
              <span className="text-[17px] font-black">{localized(featured, lang).name}</span>
            </div>
          )}
        </div>
      </section>

      {/* Menu + cart */}
      <section id="menu" className="mx-auto flex max-w-[1120px] scroll-mt-20 flex-col gap-5 px-4 pt-6 pb-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">Fresh today</span>
            <h2 className="text-[40px] leading-none font-black">The menu</h2>
          </div>
          {categories.length > 2 && (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  className={category === c ? "chip-active h-11" : "chip h-11"}
                  onClick={() => setCategory(c)}
                >
                  {c === "all" ? "All" : titleCase(c)}
                </button>
              ))}
            </div>
          )}
        </div>
        {params.get("cancelled") && (
          <div className="rounded-2xl border-2 border-b-4 border-butter bg-butter-soft px-4 py-3 font-extrabold text-[#6b4d00]">
            {t("cancelled")}
          </div>
        )}

        <div className="flex flex-wrap items-start gap-6">
          <div className="grid min-w-0 flex-[999_1_520px] grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
            {menu.isPending &&
              Array.from({ length: 3 }, (_, i) => <div key={i} className="h-80 animate-pulse rounded-[22px] bg-dough" />)}
            {shown.map((item, i) => (
              <ProductCard key={item.id} item={item} index={i} quantity={cart[item.id] ?? 0} onChange={(q) => setQty(item.id, q)} />
            ))}
          </div>

          <aside id="cart" className="card flex-[1_1_280px] scroll-mt-24 p-5 lg:sticky lg:top-24">
            <h3 className="text-xl font-black">{t("yourOrder")}</h3>
            {lines.length === 0 ? (
              <p className="mt-3 text-[15px] font-bold text-cinnamon">Nothing yet. Tap ADD on something tasty.</p>
            ) : (
              <ul className="mt-3 space-y-2 border-b-2 border-crumb pb-3">
                {lines.map((l) => (
                  <li key={l.product.id} className="flex justify-between gap-2 text-[15px] font-extrabold">
                    <span>{l.quantity} × {localized(l.product, lang).name}</span>
                    <span>{money(l.product.price_cents * l.quantity)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex justify-between text-lg font-black">
              <span>Subtotal</span>
              <span>{money(total)}</span>
            </div>

            {step === "cart" ? (
              <button type="button" className="btn-primary mt-4 w-full" disabled={count === 0} onClick={() => setStep("details")}>
                Checkout
              </button>
            ) : (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  checkout.mutate();
                }}
              >
                {(
                  [
                    ["name", "text", true, "e.g. Rosa"],
                    ["email", "email", true, "you@example.com"],
                    ["phone", "tel", false, ""],
                    ["pickup_at", "datetime-local", false, ""],
                  ] as const
                ).map(([key, type, required, placeholder]) => (
                  <div key={key}>
                    <label className="label" htmlFor={key}>{t(key === "pickup_at" ? "pickup" : key)}</label>
                    <input
                      id={key}
                      type={type}
                      required={required}
                      placeholder={placeholder}
                      className="input"
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    />
                  </div>
                ))}
                <div>
                  <label className="label" htmlFor="notes">{t("notes")}</label>
                  <textarea id="notes" rows={2} className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <label className="flex items-start gap-2 text-sm font-bold text-cinnamon">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-jam"
                    checked={form.marketing_opt_in}
                    onChange={(e) => setForm({ ...form, marketing_opt_in: e.target.checked })}
                  />
                  {t("optIn")}
                </label>
                <button className="btn-primary w-full" disabled={checkout.isPending}>
                  {checkout.isPending ? "One moment…" : `${t("pay")} · ${money(total)}`}
                </button>
                <button type="button" className="w-full text-sm font-extrabold text-blueberry" onClick={() => setStep("cart")}>
                  Back
                </button>
                {checkout.error && (
                  <p className="rounded-xl bg-jam-soft px-3 py-2 text-sm font-extrabold text-jam-depth">{checkout.error.message}</p>
                )}
              </form>
            )}
          </aside>
        </div>
      </section>

      {/* Features */}
      <section className="border-y-2 border-crumb bg-dough">
        <div className="mx-auto grid max-w-[1120px] gap-4 px-4 py-12 sm:px-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card flex flex-col gap-2 p-5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${f.tint}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
                  {f.icon}
                </svg>
              </div>
              <h3 className="text-lg font-black">{f.title}</h3>
              <p className="text-[15px] leading-snug font-bold text-cinnamon">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Visit */}
      <section id="visit" className="mx-auto flex max-w-[1120px] scroll-mt-20 flex-wrap gap-10 px-4 py-14 sm:px-6">
        <div className="flex flex-[1_1_320px] flex-col gap-4">
          <h2 className="text-[40px] leading-none font-black">Come say hi</h2>
          {[
            ["Address", BAKERY.address],
            ["Hours", BAKERY.hoursSummary],
            ["Call or text", BAKERY.phone],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="eyebrow">{k}</div>
              <div className="text-lg font-black">{v}</div>
            </div>
          ))}
        </div>
        <iframe
          title="Map to Grandma's Bakery"
          src={BAKERY.mapsEmbed}
          loading="lazy"
          className="min-h-[260px] flex-[1_1_420px] rounded-3xl border-2 border-crumb"
          style={{ boxShadow: "0 4px 0 var(--color-crumb)" }}
        />
      </section>
    </>
  );
}
