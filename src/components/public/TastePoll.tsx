import { ALLERGEN_LABELS, localized, useI18n } from "../../i18n";
import { useFlavorPoll, useVoteForFlavor } from "../../lib/poll";
import { BunBunHappy } from "../illustrations";
import { productArt } from "./productArt";

/** "Help Grandma pick the next flavor": vote on candidate recipes. Renders nothing when there's no poll. */
export function TastePoll() {
  const { t, lang } = useI18n();
  const poll = useFlavorPoll();
  const { voted, vote } = useVoteForFlavor();

  const candidates = poll.data ?? [];
  if (poll.isError || candidates.length === 0) return null;

  // Results show once this device has voted, so earlier votes don't sway the first pick.
  const showResults = voted.length > 0;
  const total = candidates.reduce((s, c) => s + c.votes, 0);
  const top = Math.max(...candidates.map((c) => c.votes));

  return (
    <section id="taste-poll" aria-labelledby="taste-poll-heading" className="mx-auto flex max-w-[1120px] scroll-mt-20 flex-col gap-5 px-4 pt-6 pb-14 sm:px-6">
      <div className="flex items-end gap-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="eyebrow">{t("pollEyebrow")}</span>
          <h2 id="taste-poll-heading" className="text-[clamp(30px,5vw,40px)] leading-none font-black">{t("pollTitle")}</h2>
          <p className="max-w-[560px] text-[17px] leading-snug font-bold text-cinnamon">{t("pollBody")}</p>
        </div>
        <BunBunHappy className="hidden h-24 w-32 shrink-0 sm:block" />
      </div>

      {vote.isSuccess && (
        <p role="status" className="rounded-2xl bg-pistachio-soft px-4 py-3 font-extrabold text-pistachio-depth">{t("pollThanks")}</p>
      )}
      {vote.isError && (
        <p role="alert" className="rounded-xl bg-jam-soft px-3 py-2 text-sm font-extrabold text-jam-depth">{t("voteFailed")}</p>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 max-sm:grid-cols-1 max-sm:gap-3">
        {candidates.map((c, i) => {
          const { name, description } = localized(c, lang);
          const { Icon, tint } = productArt(c, i);
          const mine = voted.includes(c.id);
          const pct = total > 0 ? Math.round((c.votes / total) * 100) : 0;
          const leading = c.votes > 0 && c.votes === top;
          const allergenLine =
            c.allergens.length > 0
              ? `${t("contains")}: ${c.allergens.map((a) => ALLERGEN_LABELS[lang][a] ?? a).join(", ")}`
              : t("noAllergens");
          return (
            <article key={c.id} className="flex flex-col gap-3 rounded-[22px] border-2 border-b-[5px] border-crumb bg-white p-3.5">
              <div className={`relative flex h-28 items-center justify-center rounded-2xl lg:h-36 ${tint}`}>
                <Icon className="h-20 w-20 lg:h-24 lg:w-24" />
                {showResults && leading && (
                  <span className="tag absolute top-2.5 left-2.5 bg-butter-soft text-butter-depth">★ {pct}%</span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <h3 className="text-[19px] leading-tight font-black">{name}</h3>
                {description && <p className="text-[15px] leading-snug font-bold text-cinnamon">{description}</p>}
                <p className="mt-1 text-xs font-bold text-cinnamon">{allergenLine}</p>
              </div>
              {showResults && (
                <div className="flex flex-col gap-1.5">
                  <div
                    className="h-3 overflow-hidden rounded-full bg-dough"
                    role="progressbar"
                    aria-label={name}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                  >
                    <div className={`h-full rounded-full ${leading ? "bg-jam" : "bg-blueberry"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-sm font-extrabold">
                    <span>{pct}%</span>
                    <span className="text-cinnamon">
                      {c.votes} {t(c.votes === 1 ? "voteOne" : "voteMany")}
                    </span>
                  </div>
                </div>
              )}
              {mine ? (
                <div className="flex h-12 items-center justify-center gap-2 rounded-[14px] border-2 border-pistachio bg-pistachio-soft font-black text-pistachio-depth">
                  ✓ {t("youVoted")}
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-primary h-12 w-full py-0"
                  disabled={vote.isPending}
                  onClick={() => vote.mutate(c.id)}
                >
                  {vote.isPending && vote.variables === c.id ? t("voting") : t("vote")}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
