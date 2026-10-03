import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { downloadCsv } from "../../../lib/csv";
import { date, isoDay } from "../../../lib/format";
import { supabase } from "../../../lib/supabase";

/** Email list + taste poll results: the "who to reach and what they want" half of Marketing. */
export function AudienceCards() {
  const { data: customers = [] } = useQuery({
    queryKey: ["customer_stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customer_stats").select("*").order("lifetime_cents", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: optedIn = [], error: optedInError } = useQuery({
    queryKey: ["customers", "marketing_opt_in"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email, phone, loyalty_points")
        .eq("marketing_opt_in", true)
        .not("email", "is", null)
        .order("name");
      if (error) throw error;
      return data.filter((c) => c.email?.trim());
    },
  });

  const { data: poll = [], error: pollError } = useQuery({
    queryKey: ["flavor_poll"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_flavor_poll");
      if (error) throw error;
      return data.map((p) => ({ ...p, votes: Number(p.votes) })).sort((a, b) => b.votes - a.votes);
    },
  });


  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <EmailList customers={optedIn} stats={customers} error={optedInError} />
      <PollResults poll={poll} error={pollError} />
    </section>
  );
}

type OptedIn = { id: string; name: string; email: string | null; phone: string | null; loyalty_points: number };
type CustomerStat = { id: string | null; last_order_at: string | null };

function EmailList({ customers, stats, error }: { customers: OptedIn[]; stats: CustomerStat[]; error: Error | null }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const lastOrder = new Map(stats.map((s) => [s.id, s.last_order_at]));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(customers.map((c) => c.email!.trim()).join(", "));
      setCopyError(false);
      setCopied(true);
    } catch {
      setCopyError(true);
    }
  };

  const download = () =>
    downloadCsv(`email-list-${isoDay()}.csv`, [
      ["Name", "Email", "Phone", "Points", "Last order"],
      ...customers.map((c) => {
        const last = lastOrder.get(c.id);
        return [c.name, c.email, c.phone, c.loyalty_points, last ? date(last) : ""];
      }),
    ]);

  return (
    <section className="card">
      <h2 className="mb-1 text-xl font-extrabold">Email list</h2>
      <p className="mb-4 text-sm text-cinnamon">Customers who said yes to news & specials</p>
      {error ? (
        <p className="text-jam">{error.message}</p>
      ) : (
        <>
          <p className="text-4xl font-black text-jam">{customers.length.toLocaleString()}</p>
          <p className="mb-4 text-sm font-bold text-cinnamon">
            {customers.length === 1 ? "person" : "people"} to email
          </p>
          <div className="flex flex-wrap gap-3">
            <button className="btn-blue" disabled={customers.length === 0} onClick={copy}>
              {copied ? "Copied! ✓" : "Copy emails"}
            </button>
            <button className="btn-ghost" disabled={customers.length === 0} onClick={download}>
              Download CSV
            </button>
          </div>
          {copyError && <p className="mt-3 text-jam">Couldn't copy. Try "Download CSV" instead.</p>}
          <p className="mt-4 rounded-2xl bg-blueberry-soft px-4 py-3 text-sm text-blueberry-depth">
            Tip: in Gmail, paste the emails into the <b className="font-black">Bcc</b> box so customers can't see each
            other's addresses. Or upload the CSV to Mailchimp to send a pretty newsletter.
          </p>
        </>
      )}
    </section>
  );
}

type PollItem = { id: string; name: string; description: string; price_cents: number; votes: number };

function PollResults({ poll, error }: { poll: PollItem[]; error: Error | null }) {
  const max = Math.max(0, ...poll.map((p) => p.votes));
  const total = poll.reduce((s, p) => s + p.votes, 0);
  return (
    <section className="card">
      <h2 className="mb-1 text-xl font-extrabold">Taste poll results</h2>
      <p className="mb-4 text-sm text-cinnamon">
        Flavors customers are voting on at the website{total > 0 ? ` · ${total.toLocaleString()} votes so far` : ""}
      </p>
      {error && <p className="text-jam">{error.message}</p>}
      {!error && poll.length === 0 && (
        <Empty>
          No flavors in the poll. Tick "Taste poll" on the{" "}
          <Link to="/admin/menu" className="font-extrabold text-blueberry underline">
            Menu page
          </Link>{" "}
          to add some.
        </Empty>
      )}
      <ul className="space-y-4">
        {poll.map((p) => {
          const leader = max > 0 && p.votes === max;
          return (
            <li key={p.id}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="font-extrabold">
                  {p.name}
                  {leader && <span className="tag ml-2 bg-butter text-cocoa">In the lead</span>}
                </span>
                <span className="shrink-0 font-black">
                  {p.votes.toLocaleString()} {p.votes === 1 ? "vote" : "votes"}
                </span>
              </div>
              <div className="h-6 overflow-hidden rounded-full bg-dough">
                <div
                  className={`h-full rounded-full ${leader ? "bg-jam" : "bg-blueberry"}`}
                  style={{ width: max > 0 ? `${(p.votes / max) * 100}%` : "0%" }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {poll.length > 0 && max > 0 && (
        <p className="mt-5 rounded-2xl bg-pistachio-soft px-4 py-3 text-sm text-pistachio-depth">
          Ready to pick a winner? On the{" "}
          <Link to="/admin/menu" className="font-extrabold underline">
            Menu page
          </Link>
          , tick "On menu" for it and untick "Taste poll".
        </p>
      )}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-cinnamon">{children}</p>;
}
