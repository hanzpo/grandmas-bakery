import { lazy, Suspense, useState } from "react";
import { useI18n } from "../i18n";
import { Grandma } from "./illustrations";
import { useCartCount } from "./RootLayout";

// The panel pulls in the ElevenLabs SDK, so it loads on first open.
const ChatPanel = lazy(() => import("./ChatPanel"));

/**
 * Floating "Ask Grandma" chat on the customer site (hidden on admin pages, see RootLayout).
 * Text chat plus a voice call with the ElevenLabs agent; see `useBakeryAgent`.
 */
export function ChatWidget() {
  const { t } = useI18n();
  const { count } = useCartCount();
  const [open, setOpen] = useState(false);
  // Keep the panel (and its conversation) mounted after the first open.
  const [loaded, setLoaded] = useState(false);

  // Sit above the phone "View order" bar when the cart has items.
  const lift = count > 0 ? "bottom-22 lg:bottom-6" : "bottom-4 sm:bottom-6";

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => {
            setLoaded(true);
            setOpen(true);
          }}
          className={`btn-primary fixed right-4 z-35 h-16 gap-2.5 px-2 sm:right-6 sm:pr-5 ${lift}`}
          aria-haspopup="dialog"
        >
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white">
            <Grandma className="h-[88%] w-[88%] translate-y-[4%]" />
          </span>
          <span className="hidden sm:inline">{t("chatOpen")}</span>
          <span className="sr-only sm:hidden">{t("chatOpen")}</span>
        </button>
      )}
      {loaded && (
        <Suspense fallback={null}>
          <ChatPanel open={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
