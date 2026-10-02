import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { ProductCard } from "../components/ProductCard";
import { localized, useI18n } from "../i18n";
import { money } from "../lib/format";
import { useMenu } from "../lib/menu";

export default function Order() {
  const { t, lang } = useI18n();
  const menu = useMenu();
  const [params] = useSearchParams();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ name: "", email: "", phone: "", pickup_at: "", notes: "", marketing_opt_in: false });

  const lines = (menu.data ?? []).filter((p) => cart[p.id]).map((p) => ({ product: p, quantity: cart[p.id] }));
  const total = lines.reduce((s, l) => s + l.product.price_cents * l.quantity, 0);
  const setQty = (id: string, q: number) =>
    setCart(({ [id]: _, ...rest }) => (q > 0 ? { ...rest, [id]: q } : rest));

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

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section className="grid gap-4 sm:grid-cols-2">
        {params.get("cancelled") && <p className="card sm:col-span-2">{t("cancelled")}</p>}
        {menu.data?.map((item) => (
          <ProductCard
            key={item.id}
            item={item}
            action={
              cart[item.id] ? (
                <div className="flex items-center gap-3">
                  <button className="btn-ghost px-4" onClick={() => setQty(item.id, cart[item.id] - 1)}>−</button>
                  <span className="w-8 text-center text-lg font-semibold">{cart[item.id]}</span>
                  <button className="btn-ghost px-4" onClick={() => setQty(item.id, cart[item.id] + 1)}>+</button>
                </div>
              ) : (
                <button className="btn-primary w-full" onClick={() => setQty(item.id, 1)}>{t("add")}</button>
              )
            }
          />
        ))}
      </section>

      <form
        className="card h-fit space-y-4 lg:sticky lg:top-4"
        onSubmit={(e) => {
          e.preventDefault();
          checkout.mutate();
        }}
      >
        <h2 className="text-2xl">{t("yourOrder")}</h2>
        <ul className="space-y-1">
          {lines.map((l) => (
            <li key={l.product.id} className="flex justify-between">
              <span>{l.quantity} × {localized(l.product, lang).name}</span>
              <span>{money(l.product.price_cents * l.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-crust pt-3 text-lg font-semibold">
          <span>{t("total")}</span>
          <span>{money(total)}</span>
        </div>
        {(
          [
            ["name", "text", true],
            ["email", "email", true],
            ["phone", "tel", false],
            ["pickup_at", "datetime-local", false],
          ] as const
        ).map(([key, type, required]) => (
          <div key={key}>
            <label className="label" htmlFor={key}>{t(key === "pickup_at" ? "pickup" : key)}</label>
            <input
              id={key}
              type={type}
              required={required}
              className="input"
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </div>
        ))}
        <div>
          <label className="label" htmlFor="notes">{t("notes")}</label>
          <textarea id="notes" className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.marketing_opt_in} onChange={(e) => setForm({ ...form, marketing_opt_in: e.target.checked })} />
          {t("optIn")}
        </label>
        <button className="btn-primary w-full text-lg" disabled={lines.length === 0 || checkout.isPending}>
          {t("pay")} · {money(total)}
        </button>
        {checkout.error && <p className="text-berry">{checkout.error.message}</p>}
      </form>
    </div>
  );
}
