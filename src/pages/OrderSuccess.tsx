import { BAKERY } from "../lib/bakery";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { BunBunHappy } from "../components/illustrations";

const STEPS = [
  { label: "Ordered", state: "done" },
  { label: "Baking", state: "active" },
  { label: "Ready", state: "todo" },
] as const;

const STEP_STYLE = {
  done: { dot: "bg-pistachio text-white shadow-[0_3px_0_var(--color-pistachio-depth)]", text: "text-pistachio-depth" },
  active: { dot: "bg-butter text-cocoa shadow-[0_3px_0_var(--color-butter-depth)]", text: "text-[#6b4d00]" },
  todo: { dot: "bg-dough text-cinnamon shadow-[0_3px_0_var(--color-crumb)]", text: "text-cinnamon" },
};

const ICONS = {
  done: <path d="M5 12l5 5 9-10" />,
  active: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  todo: (
    <>
      <path d="M6 8h12l-1 12H7z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
};

export default function OrderSuccess() {
  // Paid: start the next visit with an empty cart.
  useEffect(() => {
    try {
      localStorage.removeItem("cart");
    } catch {}
  }, []);
  const [params] = useSearchParams();
  const order = params.get("order");

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-5 py-10 text-center">
      <BunBunHappy className="mx-auto w-44" />
      <div>
        <h1 className="text-[32px] leading-tight font-black">
          Your order is
          <br />
          in the oven!
        </h1>
        <p className="mt-2 text-lg font-bold text-cinnamon">We'll have it warm and ready at pickup time.</p>
      </div>

      <ol className="grid grid-cols-3 gap-2">
        {STEPS.map((s) => (
          <li key={s.label} className="flex flex-col items-center gap-2">
            <span className={`flex h-11 w-11 items-center justify-center rounded-full ${STEP_STYLE[s.state].dot}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
                {ICONS[s.state]}
              </svg>
            </span>
            <span className={`text-sm font-black ${STEP_STYLE[s.state].text}`}>{s.label}</span>
          </li>
        ))}
      </ol>

      <div className="card p-5 text-left">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Order number</span>
          <span className="text-2xl font-black">{order ? `#${order}` : "—"}</span>
        </div>
        <p className="mt-3 border-t-2 border-crumb pt-3 text-[15px] font-bold text-cinnamon">
          A receipt is on its way to your email. Show this number at the counter.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Link to="/" className="btn-primary h-14 w-full">Got it</Link>
        <a href={BAKERY.mapsLink} target="_blank" rel="noreferrer" className="btn-ghost h-14 w-full">Get directions</a>
      </div>
    </div>
  );
}
