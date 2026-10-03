import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { date } from "../../lib/format";
import { supabase } from "../../lib/supabase";

async function api<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`/api/newsletter/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json;
}

const NOTE_KEY = "newsletter-note";

export default function Newsletter() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState(() => {
    try {
      return localStorage.getItem(NOTE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [debounced, setDebounced] = useState(note);
  const [testTo, setTestTo] = useState("");
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  // Remember the draft and re-render the preview shortly after typing stops.
  useEffect(() => {
    try {
      localStorage.setItem(NOTE_KEY, note);
    } catch {}
    const t = setTimeout(() => setDebounced(note), 500);
    return () => clearTimeout(t);
  }, [note]);

  const preview = useQuery({
    queryKey: ["newsletter-preview", debounced],
    queryFn: () => api<{ subject: string; html: string; subscribers: number }>("preview", { note: debounced }),
    placeholderData: (prev) => prev,
  });

  const issues = useQuery({
    queryKey: ["newsletter-issues"],
    queryFn: async () => {
      const { data, error } = await supabase.from("newsletter_issues").select("*").order("sent_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
  });

  const sendTest = useMutation({
    mutationFn: () => api<{ ok: true }>("test", { to: testTo, note }),
    onSuccess: () => setFlash({ ok: true, text: `Test sent to ${testTo}. Check your inbox (and spam, just in case).` }),
    onError: (e: Error) => setFlash({ ok: false, text: e.message }),
  });

  const sendAll = useMutation({
    mutationFn: () => api<{ sent: number; failed: number }>("send", { note }),
    onSuccess: (r) => {
      setFlash({ ok: true, text: `Sent to ${r.sent} subscriber${r.sent === 1 ? "" : "s"}${r.failed ? ` (${r.failed} failed)` : ""}.` });
      queryClient.invalidateQueries({ queryKey: ["newsletter-issues"] });
    },
    onError: (e: Error) => setFlash({ ok: false, text: e.message }),
  });

  const subs = preview.data?.subscribers ?? 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Weekly email</p>
          <h1 className="text-4xl font-black">Newsletter</h1>
        </div>
        <span className="tag bg-pistachio-soft text-pistachio-depth">
          {subs} subscriber{subs === 1 ? "" : "s"}
        </span>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-6">
          <section className="card space-y-3">
            <h2 className="text-xl font-extrabold">Grandma's note</h2>
            <p className="text-sm font-bold text-cinnamon">
              Goes at the top of the email. The flavor of the month, new items and best sellers fill in automatically from the menu.
            </p>
            <textarea
              className="input"
              rows={6}
              maxLength={2000}
              placeholder="Hello, dears! The ovens have been busy this week…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </section>

          <section className="card space-y-3">
            <h2 className="text-xl font-extrabold">Send a test</h2>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendTest.mutate();
              }}
            >
              <input className="input" type="email" required placeholder="you@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              <button className="btn-blue shrink-0" disabled={sendTest.isPending}>
                {sendTest.isPending ? "Sending…" : "Send test"}
              </button>
            </form>
          </section>

          <section className="card space-y-3">
            <h2 className="text-xl font-extrabold">Send this week's issue</h2>
            <p className="text-sm font-bold text-cinnamon">Every customer who asked for Grandma's specials gets a copy with their own unsubscribe link.</p>
            <button
              className="btn-primary w-full"
              disabled={!subs || sendAll.isPending}
              onClick={() => {
                if (confirm(`Send "${preview.data?.subject}" to ${subs} subscriber${subs === 1 ? "" : "s"}?`)) sendAll.mutate();
              }}
            >
              {sendAll.isPending ? "Sending…" : `Send to ${subs} subscriber${subs === 1 ? "" : "s"}`}
            </button>
          </section>

          {flash && (
            <p className={`rounded-2xl px-4 py-3 text-sm font-extrabold ${flash.ok ? "bg-pistachio-soft text-pistachio-depth" : "bg-jam-soft text-jam-depth"}`}>
              {flash.text}
            </p>
          )}

          <section className="card">
            <h2 className="mb-3 text-xl font-extrabold">Past issues</h2>
            {issues.data?.length ? (
              <ul className="space-y-2">
                {issues.data.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 rounded-2xl bg-dough px-4 py-2.5 text-sm">
                    <span className="font-extrabold">{i.subject}</span>
                    <span className="shrink-0 font-bold text-cinnamon">
                      {date(i.sent_at)} · {i.recipients} sent
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-bold text-cinnamon">No issues sent yet.</p>
            )}
          </section>
        </div>

        <section className="card p-0">
          <div className="border-b-2 border-crumb px-5 py-3">
            <p className="eyebrow">Preview</p>
            <p className="font-extrabold">{preview.data?.subject ?? "…"}</p>
          </div>
          {preview.error ? (
            <p className="p-5 font-bold text-jam">{(preview.error as Error).message}</p>
          ) : (
            <iframe title="Newsletter preview" srcDoc={preview.data?.html ?? ""} className="h-[900px] w-full rounded-b-3xl bg-flour" />
          )}
        </section>
      </div>
    </div>
  );
}
