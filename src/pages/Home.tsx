import { Link } from "react-router";
import { ProductCard } from "../components/ProductCard";
import { useI18n } from "../i18n";
import { useMenu } from "../lib/menu";

export default function Home() {
  const { t } = useI18n();
  const menu = useMenu();
  return (
    <>
      <section className="py-10 text-center md:py-16">
        <h1 className="text-4xl font-extrabold text-terracotta md:text-6xl">Grandma's Bakery</h1>
        <p className="mt-3 text-lg text-muted">{t("tagline")}</p>
        <Link to="/order" className="btn-primary mt-6 text-lg">{t("orderNow")}</Link>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {menu.data?.map((item) => <ProductCard key={item.id} item={item} />)}
      </section>
    </>
  );
}
