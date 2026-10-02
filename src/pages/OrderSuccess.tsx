import { Link, useSearchParams } from "react-router";
import { useI18n } from "../i18n";

export default function OrderSuccess() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  return (
    <div className="card mx-auto mt-10 max-w-lg text-center">
      <h1 className="text-3xl text-terracotta">{t("thanks")}</h1>
      {params.get("order") && <p className="mt-2 text-5xl font-display font-extrabold">#{params.get("order")}</p>}
      <p className="mt-4 text-muted">{t("thanksBody")}</p>
      <Link to="/" className="btn-ghost mt-6">{t("backToMenu")}</Link>
    </div>
  );
}
