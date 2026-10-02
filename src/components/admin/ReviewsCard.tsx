import { useState } from "react";

// Demo data: stands in for the Google Business Profile / Yelp integration.
type Review = {
  id: number;
  source: "Google" | "Yelp";
  author: string;
  stars: number;
  daysAgo: number;
  text: string;
  reply?: string;
};

const REVIEWS: Review[] = [
  {
    id: 1,
    source: "Google",
    author: "Priya S.",
    stars: 5,
    daysAgo: 1,
    text: "The Fall Parfait is unreal. Pumpkin cream, cinnamon apples, crunchy granola. Grandma remembered my name on my second visit!",
  },
  {
    id: 2,
    source: "Yelp",
    author: "Marcus T.",
    stars: 2,
    daysAgo: 2,
    text: "Food is great but I waited 15 minutes for a pre-ordered pickup. Would love a text when it's ready.",
  },
  {
    id: 3,
    source: "Google",
    author: "Dana L.",
    stars: 5,
    daysAgo: 4,
    text: "Ordered 30 parfaits for a campus open house on two days' notice. Everything was perfect and the students loved them.",
    reply: "Thank you Dana! We loved baking for the university. Come back anytime. — Grandma",
  },
  {
    id: 4,
    source: "Google",
    author: "Wei C.",
    stars: 5,
    daysAgo: 6,
    text: "肉桂卷太好吃了！The menu in Chinese made ordering so easy for my parents.",
  },
  {
    id: 5,
    source: "Yelp",
    author: "Hannah K.",
    stars: 4,
    daysAgo: 9,
    text: "Cozy little shop, sourdough is the real deal. Wish they had more nut-free options for my son.",
  },
  {
    id: 6,
    source: "Google",
    author: "Eleanor P.",
    stars: 5,
    daysAgo: 12,
    text: "Every Saturday for three years. Extra strawberries, always. This place is a treasure.",
    reply: "See you Saturday, Eleanor! The strawberries are waiting. — Grandma",
  },
];

const DISTRIBUTION = { 5: 142, 4: 31, 3: 9, 2: 4, 1: 2 } as Record<number, number>;
const TOTAL = Object.values(DISTRIBUTION).reduce((a, b) => a + b, 0);
const AVERAGE = Object.entries(DISTRIBUTION).reduce((s, [k, v]) => s + Number(k) * v, 0) / TOTAL;

function Stars({ value, size = "text-base" }: { value: number; size?: string }) {
  return (
    <span className={`${size} tracking-tight`} aria-label={`${value} out of 5 stars`}>
      <span className="text-butter-depth">{"★".repeat(Math.round(value))}</span>
      <span className="text-crumb">{"★".repeat(5 - Math.round(value))}</span>
    </span>
  );
}

export function ReviewsCard() {
  const [replies, setReplies] = useState<Record<number, string>>({});
  const [drafting, setDrafting] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const needsReply = REVIEWS.filter((r) => !r.reply && !replies[r.id]).length;

  return (
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold">Reviews</h2>
          <p className="text-sm text-cinnamon">Google Maps &amp; Yelp</p>
        </div>
        {needsReply > 0 && <span className="tag bg-jam-soft text-jam-depth">{needsReply} need a reply</span>}
      </div>

      <div className="mt-4 flex items-center gap-5 rounded-2xl bg-dough p-4">
        <div className="text-center">
          <p className="text-4xl font-black">{AVERAGE.toFixed(1)}</p>
          <Stars value={AVERAGE} />
          <p className="text-xs font-bold text-cinnamon">{TOTAL} reviews</p>
        </div>
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((n) => (
            <div key={n} className="flex items-center gap-2 text-xs font-extrabold text-cinnamon">
              <span className="w-3">{n}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-butter" style={{ width: `${(DISTRIBUTION[n] / TOTAL) * 100}%` }} />
              </div>
              <span className="w-7 text-right">{DISTRIBUTION[n]}</span>
            </div>
          ))}
        </div>
      </div>

      <ul className="mt-4 max-h-[460px] space-y-3 overflow-y-auto pr-1">
        {REVIEWS.map((r) => {
          const reply = r.reply ?? replies[r.id];
          const low = r.stars <= 2;
          return (
            <li key={r.id} className={`rounded-2xl border-2 p-3.5 ${low && !reply ? "border-jam/40 bg-jam-soft/50" : "border-crumb bg-white"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-butter-soft text-sm font-black">{r.author[0]}</span>
                  <div>
                    <p className="text-sm leading-tight font-black">{r.author}</p>
                    <Stars value={r.stars} size="text-sm" />
                  </div>
                </div>
                <div className="text-right">
                  <span className={`tag ${r.source === "Google" ? "bg-blueberry-soft text-blueberry-depth" : "bg-jam-soft text-jam-depth"}`}>{r.source}</span>
                  <p className="mt-1 text-xs font-bold text-cinnamon">{r.daysAgo === 1 ? "yesterday" : `${r.daysAgo}d ago`}</p>
                </div>
              </div>
              <p className="mt-2 text-sm font-semibold">{r.text}</p>

              {reply ? (
                <p className="mt-2 rounded-xl bg-pistachio-soft px-3 py-2 text-sm font-bold text-pistachio-depth">↳ {reply}</p>
              ) : drafting === r.id ? (
                <div className="mt-2 space-y-2">
                  <textarea className="input text-sm" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                  <div className="flex gap-2">
                    <button
                      className="btn-primary px-4 py-2 text-xs"
                      disabled={!draft.trim()}
                      onClick={() => {
                        setReplies({ ...replies, [r.id]: draft.trim() });
                        setDrafting(null);
                      }}
                    >
                      Post reply
                    </button>
                    <button className="text-xs font-extrabold text-cinnamon" onClick={() => setDrafting(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  className="mt-2 text-sm font-extrabold text-blueberry"
                  onClick={() => {
                    setDrafting(r.id);
                    setDraft(
                      low
                        ? `So sorry about the wait, ${r.author.split(" ")[0]}. We're adding pickup texts so you know the moment it's ready. Next treat's on me! — Grandma`
                        : `Thank you so much, ${r.author.split(" ")[0]}! It means the world. See you soon. — Grandma`,
                    );
                  }}
                >
                  Reply
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
