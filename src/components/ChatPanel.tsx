import { ConversationProvider } from "@elevenlabs/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useI18n } from "../i18n";
import { BAKERY } from "../lib/bakery";
import { useBakeryAgent } from "../lib/useBakeryAgent";
import { Grandma } from "./illustrations";

const Icon = ({ d, size = 22 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const MIC = "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3";
const SEND = "M4 12l16-8-6 16-2-7z";
const CLOSE = "M6 6l12 12M18 6L6 18";
// Red gingham, like the tablecloth in Grandma's kitchen.
const GINGHAM = {
  backgroundColor: "var(--color-jam-soft)",
  backgroundImage:
    "linear-gradient(90deg, color-mix(in srgb, var(--color-jam) 14%, transparent) 50%, transparent 50%), linear-gradient(color-mix(in srgb, var(--color-jam) 14%, transparent) 50%, transparent 50%)",
  backgroundSize: "18px 18px",
};

/** Grandma's portrait in a round frame. Rings green while she listens, blue while she talks. */
function Portrait({ size, ring }: { size: string; ring?: "listening" | "speaking" }) {
  const ringCls = ring === "speaking" ? "ring-4 ring-blueberry/40" : ring === "listening" ? "ring-4 ring-pistachio/40" : "";
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-jam-depth/30 bg-white ${size} ${ringCls}`}>
      <Grandma className="h-[88%] w-[88%] translate-y-[4%]" />
    </span>
  );
}

const HANG_UP = "M3 14c5-5 13-5 18 0l-2.5 2.5-3-1.5v-2.5a10 10 0 0 0-5 0V15l-3 1.5z";

/** Bars that bounce while Grandma is talking. */
function SpeakingBars({ active }: { active: boolean }) {
  return (
    <span className="flex h-5 items-end gap-0.5" aria-hidden="true">
      {[0, 150, 300, 450].map((delay) => (
        <span
          key={delay}
          className={`w-1 rounded-full bg-current ${active ? "h-5 animate-pulse" : "h-1.5"}`}
          style={{ animationDelay: `${delay}ms`, animationDuration: "700ms" }}
        />
      ))}
    </span>
  );
}

type Props = { open: boolean; onClose: () => void };

/** Loaded on first open (keeps the ElevenLabs SDK out of the main bundle), then stays mounted. */
export default function ChatPanel(props: Props) {
  return (
    <ConversationProvider agentId={BAKERY.voiceAgentId}>
      <Panel {...props} />
    </ConversationProvider>
  );
}

function Panel({ open, onClose }: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const agent = useBakeryAgent();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onCall = agent.mode === "voice";

  // A voice call shouldn't keep running behind a closed panel.
  const close = () => {
    if (onCall) agent.endVoice();
    onClose();
  };

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [agent.messages.length, agent.thinking]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const send = (text: string) => {
    const msg = text.trim();
    if (!msg) return;
    agent.sendText(msg);
    setDraft("");
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
  };

  const statusPill = !onCall
    ? null
    : agent.status === "connecting"
      ? { label: t("chatConnecting"), cls: "bg-butter-soft text-butter-depth" }
      : agent.isSpeaking
        ? { label: t("chatSpeaking"), cls: "bg-blueberry-soft text-blueberry-depth" }
        : { label: t("chatListening"), cls: "bg-pistachio-soft text-pistachio-depth" };

  const suggestions = [t("chatSuggestMenu"), t("chatSuggestHours"), t("chatSuggestAllergens")];

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="chat-title"
      hidden={!open}
      className="fixed inset-x-0 bottom-0 z-35 flex h-[min(640px,85dvh)] flex-col overflow-hidden rounded-t-3xl border-2 border-b-0 border-crumb bg-white sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[400px] sm:rounded-3xl sm:border-b-2"
      style={{ boxShadow: "0 4px 0 var(--color-crumb)" }}
    >
      {/* Header */}
      <header className="flex items-center gap-3 border-b-2 border-crumb px-4 py-3" style={GINGHAM}>
        <Portrait
          size="h-14 w-14"
          ring={onCall && agent.status === "connected" ? (agent.isSpeaking ? "speaking" : "listening") : undefined}
        />
        <div className="min-w-0 flex-1">
          <h2 id="chat-title" className="text-xl leading-tight font-black">{t("chatTitle")}</h2>
          {statusPill ? (
            <span className={`tag mt-0.5 gap-1.5 ${statusPill.cls}`}>
              {agent.status === "connected" && <SpeakingBars active={agent.isSpeaking} />}
              {statusPill.label}
            </span>
          ) : (
            <p className="text-sm leading-snug text-cocoa/80">{t("chatSubtitle")}</p>
          )}
        </div>
        <button type="button" onClick={close} className="btn-icon shrink-0" aria-label={t("chatClose")}>
          <Icon d={CLOSE} />
        </button>
      </header>

      {/* Messages */}
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-flour px-4 py-4" aria-live="polite">
        {agent.messages.length === 0 && !agent.thinking && !onCall && (
          <div className="flex flex-col items-center gap-4 pt-2 text-center">
            <Portrait size="h-28 w-28" />
            <p className="max-w-[30ch] rounded-2xl border-2 border-butter/60 bg-butter-soft px-4 py-3 text-[15px]">{t("chatEmpty")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {agent.messages.map((m) =>
          m.source === "ai" ? (
            <div key={m.id} className="flex items-end gap-2">
              <Portrait size="h-8 w-8" />
              <p className="max-w-[80%] rounded-2xl rounded-bl-md border-2 border-butter/60 bg-butter-soft px-4 py-2.5 text-[15px] whitespace-pre-line">{m.message}</p>
            </div>
          ) : (
            <p key={m.id} className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-blueberry px-4 py-2.5 text-[15px] text-white">
              {m.message}
            </p>
          ),
        )}
        {agent.thinking && (
          <div className="flex items-end gap-2" aria-label={t("chatThinking")}>
            <Portrait size="h-8 w-8" />
            <span className="flex gap-1 rounded-2xl rounded-bl-md border-2 border-butter/60 bg-butter-soft px-4 py-3.5">
              {[0, 200, 400].map((d) => (
                <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-cinnamon" style={{ animationDelay: `${d}ms` }} />
              ))}
            </span>
          </div>
        )}
        {agent.error && <p className="rounded-2xl bg-jam-soft px-4 py-2.5 text-sm text-jam-depth">{t("chatError")}</p>}
      </div>

      {/* Composer */}
      <div className="space-y-3 border-t-2 border-crumb bg-white p-3">
        {onCall ? (
          <button type="button" onClick={agent.endVoice} className="btn-primary h-14 w-full">
            <Icon d={HANG_UP} />
            {t("chatHangUp")}
          </button>
        ) : (
          <>
            <form onSubmit={onSubmit} className="flex gap-2">
              <label htmlFor="chat-input" className="sr-only">{t("chatPlaceholder")}</label>
              <input
                id="chat-input"
                ref={inputRef}
                className="input h-12 flex-1 py-0"
                placeholder={t("chatPlaceholder")}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoComplete="off"
              />
              <button type="submit" className="btn-blue h-12 w-12 shrink-0 p-0" aria-label={t("chatSend")} disabled={!draft.trim()}>
                <Icon d={SEND} />
              </button>
            </form>
            <button type="button" onClick={agent.startVoice} className="btn-ghost h-12 w-full">
              <Icon d={MIC} />
              {t("chatTalk")}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
