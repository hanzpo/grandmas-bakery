import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../shared/database.types";
import { adminDb } from "./lib";

type Db = SupabaseClient<Database>;
type CallStatus = Database["public"]["Enums"]["supply_call_status"];
type RunStatus = Database["public"]["Enums"]["supply_run_status"];

const OUTBOUND_URL = "https://api.elevenlabs.io/v1/convai/twilio/outbound-call";
const TERMINAL_QUOTE = new Set<CallStatus>(["quoted", "failed", "skipped"]);
const NOT_DIALABLE =
  "Not a dialable phone number. A 10-digit US or Canadian number is rewritten to +1; numbers like 555-0101 are not dialable.";

export type SupplyCallView = {
  id: string;
  supplier_id: string;
  supplier_name: string | null;
  purpose: "quote" | "order";
  status: CallStatus;
  to_number: string | null;
  conversation_id: string | null;
  error: string | null;
};

export type SupplyRunView = {
  id: string;
  status: RunStatus;
  trigger: string;
  notes: string | null;
  winner_supplier_id: string | null;
  created_at: string;
  calls: SupplyCallView[];
};

export type ReclaimResult = {
  started: boolean;
  reason: "nothing low" | "already in progress" | null;
  run: SupplyRunView | null;
};

type Line = { id: string; name: string; unit: string; quantity: number };
type QuoteInput = { name: string; available: boolean; price?: number | null };
type ToolOk = { ok: true; body: Record<string, unknown> };
type ToolErr = { ok: false; status: 400; error: string };

/** 10-digit US and Canadian numbers become +1. Fictional 555-01xx and short seed numbers are not dialable. */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  let e164: string | null = null;
  if (trimmed.startsWith("+")) {
    const candidate = `+${digits}`;
    if (/^\+[1-9]\d{7,14}$/.test(candidate)) e164 = candidate;
  } else if (digits.length === 10) {
    e164 = `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    e164 = `+${digits}`;
  }
  if (!e164) return null;
  if (e164.startsWith("+1") && e164.length === 12) {
    const national = e164.slice(2);
    const exchange = national.slice(3, 6);
    const line = Number(national.slice(6));
    if (exchange === "555" && line >= 100 && line <= 199) return null;
  }
  return e164;
}

/** Dollars per unit → cents, keeping fractional cents (0.009 dollars is 0.9 cents). */
export function dollarsToCents(dollars: number) {
  return Math.round(dollars * 1_000_000) / 10_000;
}

export async function startReclaim(env: Env, trigger: "manual" | "poll"): Promise<ReclaimResult> {
  const db = adminDb(env);
  const active = await findActive(db);
  if (active) {
    return { started: false, reason: "already in progress", run: await present(db, active.id) };
  }

  const lines = await linesToBuy(db);
  if (lines.length === 0) return { started: false, reason: "nothing low", run: null };

  const inserted = await db.from("supply_runs").insert({ status: "quoting", trigger }).select("id").single();
  if (inserted.error) {
    if (inserted.error.code === "23505") {
      const again = await findActive(db);
      if (again) return { started: false, reason: "already in progress", run: await present(db, again.id) };
    }
    throw inserted.error;
  }
  const runId = inserted.data.id;

  const { error: itemError } = await db.from("supply_run_items").insert(
    lines.map((line) => ({ run_id: runId, ingredient_id: line.id, quantity: line.quantity })),
  );
  if (itemError) throw itemError;

  const { data: suppliers, error: supplierError } = await db.from("suppliers").select("id, name, phone").order("name");
  if (supplierError) throw supplierError;

  for (const supplier of suppliers) {
    await startQuoteCall(db, env, runId, supplier, lines);
  }
  await maybeAdvance(db, env, runId);
  return { started: true, reason: null, run: await present(db, runId) };
}

export async function recordQuote(
  env: Env,
  body: { run_id: string; supplier_id: string; conversation_id: string; items: QuoteInput[] },
): Promise<ToolOk | ToolErr> {
  const db = adminDb(env);
  const { data: run, error: runError } = await db
    .from("supply_runs")
    .select("id, status")
    .eq("id", body.run_id)
    .maybeSingle();
  if (runError) throw runError;
  if (!run) return { ok: false, status: 400, error: "No grocery run matches this call." };
  if (run.status !== "quoting") {
    return { ok: false, status: 400, error: "record_quote is only for a price call, and this run is no longer collecting quotes." };
  }

  const { data: calls, error: callError } = await db
    .from("supply_calls")
    .select("id, purpose, status, conversation_id, supplier_id")
    .eq("run_id", body.run_id)
    .eq("supplier_id", body.supplier_id);
  if (callError) throw callError;

  if (calls.some((call) => call.purpose === "order" && call.conversation_id === body.conversation_id)) {
    return { ok: false, status: 400, error: "record_quote is only for a price call. Do not use it while placing the order." };
  }
  const quoteCall = calls.find((call) => call.purpose === "quote");
  if (!quoteCall) return { ok: false, status: 400, error: "This store has no price call on this run." };
  if (quoteCall.status === "failed" || quoteCall.status === "skipped") {
    return { ok: false, status: 400, error: "This price call was not dialed, so a quote cannot be saved." };
  }
  if (quoteCall.conversation_id && quoteCall.conversation_id !== body.conversation_id) {
    return { ok: false, status: 400, error: "This conversation does not match the price call." };
  }

  const { data: runItems, error: itemError } = await db
    .from("supply_run_items")
    .select("ingredient_id, quantity")
    .eq("run_id", body.run_id);
  if (itemError) throw itemError;
  const names = await ingredientNames(db, runItems.map((item) => item.ingredient_id));
  const catalog = runItems.map((item) => ({ id: item.ingredient_id, name: names.get(item.ingredient_id)?.name ?? item.ingredient_id }));

  const rows: Database["public"]["Tables"]["supply_quotes"]["Insert"][] = [];
  const seen = new Set<string>();
  for (const item of body.items) {
    const match = matchIngredient(catalog, item.name);
    if (!match.ok) return { ok: false, status: 400, error: match.error };
    if (seen.has(match.ingredient.id)) {
      return { ok: false, status: 400, error: `"${match.ingredient.name}" was sent more than once.` };
    }
    seen.add(match.ingredient.id);
    if (item.available && (item.price == null || Number.isNaN(item.price))) {
      return { ok: false, status: 400, error: `"${match.ingredient.name}" needs a price in dollars per unit.` };
    }
    rows.push({
      run_id: body.run_id,
      supplier_id: body.supplier_id,
      ingredient_id: match.ingredient.id,
      available: item.available,
      price_cents: item.available ? dollarsToCents(item.price ?? 0) : null,
      conversation_id: body.conversation_id,
    });
  }

  const { error: quoteError } = await db.from("supply_quotes").upsert(rows, {
    onConflict: "run_id,supplier_id,ingredient_id",
  });
  if (quoteError) throw quoteError;

  await markCall(db, quoteCall.id, { status: "quoted", conversation_id: body.conversation_id, error: null });
  await maybeAdvance(db, env, body.run_id);
  return { ok: true, body: { recorded: true, items: rows.length } };
}

export async function confirmSupplyOrder(
  env: Env,
  body: { run_id: string; supplier_id: string; conversation_id: string },
): Promise<ToolOk | ToolErr> {
  const db = adminDb(env);
  const { data: existing, error: existingError } = await db
    .from("supply_orders")
    .select("supplier_id, total_cents")
    .eq("run_id", body.run_id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    if (existing.supplier_id !== body.supplier_id) {
      return { ok: false, status: 400, error: "An order for this run was already placed with a different store." };
    }
    await markPlaced(db, body.run_id);
    return {
      ok: true,
      body: { placed: true, already_placed: true, supplier_id: existing.supplier_id, total_cents: Number(existing.total_cents) },
    };
  }

  const { data: run, error: runError } = await db
    .from("supply_runs")
    .select("id, status, winner_supplier_id")
    .eq("id", body.run_id)
    .maybeSingle();
  if (runError) throw runError;
  if (!run) return { ok: false, status: 400, error: "No grocery run matches this call." };
  if (run.status !== "ordering" || run.winner_supplier_id !== body.supplier_id) {
    return { ok: false, status: 400, error: "confirm_supply_order is only for the store chosen to fill the whole list, while that order call is in progress." };
  }

  const { data: calls, error: callError } = await db
    .from("supply_calls")
    .select("id, purpose, conversation_id")
    .eq("run_id", body.run_id)
    .eq("supplier_id", body.supplier_id);
  if (callError) throw callError;
  const orderCall = calls.find((call) => call.purpose === "order");
  const quoteCall = calls.find((call) => call.purpose === "quote");
  if (!orderCall) return { ok: false, status: 400, error: "There is no order call for this store." };
  if (quoteCall?.conversation_id === body.conversation_id && orderCall.conversation_id !== body.conversation_id) {
    return { ok: false, status: 400, error: "confirm_supply_order is only for the order call, not the price call." };
  }
  if (orderCall.conversation_id && orderCall.conversation_id !== body.conversation_id) {
    return { ok: false, status: 400, error: "This conversation does not match the order call." };
  }

  const priced = await pricedLines(db, body.run_id, body.supplier_id);
  if (!priced.ok) return priced;

  const { error: orderError } = await db.from("supply_orders").insert({
    run_id: body.run_id,
    supplier_id: body.supplier_id,
    total_cents: priced.total,
    conversation_id: body.conversation_id,
    notes: "Placed by phone. Delivery has not arrived.",
  });
  if (orderError) {
    if (orderError.code === "23505") {
      const again = await db.from("supply_orders").select("supplier_id, total_cents").eq("run_id", body.run_id).single();
      if (again.error) throw again.error;
      await markPlaced(db, body.run_id);
      return {
        ok: true,
        body: { placed: true, already_placed: true, supplier_id: again.data.supplier_id, total_cents: Number(again.data.total_cents) },
      };
    }
    throw orderError;
  }

  const { error: priceError } = await db.from("supplier_prices").insert(
    priced.lines.map((line) => ({
      supplier_id: body.supplier_id,
      ingredient_id: line.ingredient_id,
      price_cents: line.price_cents,
      notes: "Confirmed on a grocery order call",
    })),
  );
  if (priceError) {
    await db.from("supply_orders").delete().eq("run_id", body.run_id);
    throw priceError;
  }

  await markCall(db, orderCall.id, { status: "ordered", conversation_id: body.conversation_id, error: null });
  await markPlaced(db, body.run_id);
  return { ok: true, body: { placed: true, supplier_id: body.supplier_id, total_cents: priced.total } };
}

async function startQuoteCall(
  db: Db,
  env: Env,
  runId: string,
  supplier: { id: string; name: string; phone: string | null },
  lines: Line[],
) {
  const phone = toE164(supplier.phone);
  const { data: call, error } = await db
    .from("supply_calls")
    .insert({
      run_id: runId,
      supplier_id: supplier.id,
      purpose: "quote",
      status: phone ? "pending" : "skipped",
      to_number: supplier.phone,
      error: phone ? null : NOT_DIALABLE,
    })
    .select("id")
    .single();
  if (error) throw error;
  if (!phone) return;

  await dial(db, env, call.id, phone, {
    call_purpose: "quote",
    supplier_name: supplier.name,
    supplier_id: supplier.id,
    run_id: runId,
    shopping_list: shoppingList(lines, false),
  });
}

async function maybeAdvance(db: Db, env: Env, runId: string) {
  const { data: run, error } = await db.from("supply_runs").select("id, status").eq("id", runId).single();
  if (error) throw error;
  if (run.status !== "quoting") return;

  const { data: calls, error: callError } = await db
    .from("supply_calls")
    .select("supplier_id, status")
    .eq("run_id", runId)
    .eq("purpose", "quote");
  if (callError) throw callError;
  if (!calls.every((call) => TERMINAL_QUOTE.has(call.status))) return;

  const quoted = new Set(calls.filter((call) => call.status === "quoted").map((call) => call.supplier_id));
  const winner = await pickWinner(db, runId, quoted);
  if (!winner) {
    const notes = calls.length === 0
      ? "No suppliers to call."
      : calls.some((call) => call.status === "quoted")
        ? "No store quoted every item as available, so no order was placed."
        : "No store could be quoted, so no order was placed.";
    await failRun(db, runId, notes);
    return;
  }

  const claimed = await db
    .from("supply_runs")
    .update({ status: "ordering", winner_supplier_id: winner, updated_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("status", "quoting")
    .select("id")
    .maybeSingle();
  if (claimed.error) throw claimed.error;
  if (!claimed.data) return;
  await dialOrder(db, env, runId, winner);
}

async function pickWinner(db: Db, runId: string, quoted: Set<string>) {
  const { data: items, error } = await db.from("supply_run_items").select("ingredient_id, quantity").eq("run_id", runId);
  if (error) throw error;
  const { data: quotes, error: quoteError } = await db
    .from("supply_quotes")
    .select("supplier_id, ingredient_id, price_cents, available")
    .eq("run_id", runId);
  if (quoteError) throw quoteError;

  const qty = new Map(items.map((item) => [item.ingredient_id, Number(item.quantity)]));
  const covered = new Map<string, number>();
  const totals = new Map<string, number>();
  for (const quote of quotes) {
    if (!quoted.has(quote.supplier_id) || !quote.available || quote.price_cents == null) continue;
    const quantity = qty.get(quote.ingredient_id);
    if (quantity == null) continue;
    covered.set(quote.supplier_id, (covered.get(quote.supplier_id) ?? 0) + 1);
    totals.set(quote.supplier_id, (totals.get(quote.supplier_id) ?? 0) + Number(quote.price_cents) * quantity);
  }

  let winner: string | null = null;
  let best = Infinity;
  for (const [supplierId, count] of covered) {
    if (count !== items.length) continue;
    const total = totals.get(supplierId) ?? Infinity;
    if (total < best || (total === best && winner != null && supplierId < winner)) {
      best = total;
      winner = supplierId;
    }
  }
  return winner;
}

async function dialOrder(db: Db, env: Env, runId: string, supplierId: string) {
  const { data: supplier, error } = await db.from("suppliers").select("id, name, phone").eq("id", supplierId).single();
  if (error) throw error;
  const phone = toE164(supplier.phone);
  const { data: call, error: callError } = await db
    .from("supply_calls")
    .insert({
      run_id: runId,
      supplier_id: supplierId,
      purpose: "order",
      status: phone ? "pending" : "skipped",
      to_number: supplier.phone,
      error: phone ? null : NOT_DIALABLE,
    })
    .select("id")
    .single();
  if (callError) throw callError;
  if (!phone) {
    await failRun(db, runId, "The chosen store has no dialable phone, so the order was not placed.");
    return;
  }

  const priced = await pricedLines(db, runId, supplierId);
  if (!priced.ok) {
    await markCall(db, call.id, { status: "failed", error: priced.error });
    await failRun(db, runId, priced.error);
    return;
  }
  const names = await ingredientNames(db, priced.lines.map((line) => line.ingredient_id));
  const lines = priced.lines.map((line) => {
    const ingredient = names.get(line.ingredient_id);
    return {
      id: line.ingredient_id,
      name: ingredient?.name ?? line.ingredient_id,
      unit: ingredient?.unit ?? "",
      quantity: line.quantity,
      price_cents: line.price_cents,
    };
  });

  const result = await dial(db, env, call.id, phone, {
    call_purpose: "order",
    supplier_name: supplier.name,
    supplier_id: supplierId,
    run_id: runId,
    shopping_list: shoppingList(lines, true),
  });
  if (!result.ok) await failRun(db, runId, result.error ?? "The order call was not placed.");
}

async function dial(db: Db, env: Env, callId: string, toNumber: string, variables: Record<string, string>) {
  const result = await placeOutbound(env, toNumber, variables);
  if (!result.ok) {
    await markCall(db, callId, { status: "failed", error: result.error });
    return { ok: false as const, error: result.error };
  }
  await markCall(db, callId, { status: "dialing", conversation_id: result.conversationId, error: null });
  return { ok: true as const, error: null };
}

async function placeOutbound(env: Env, toNumber: string, variables: Record<string, string>) {
  const missing = [
    !env.ELEVENLABS_API_KEY ? "ELEVENLABS_API_KEY" : null,
    !env.SUPPLY_AGENT_ID ? "SUPPLY_AGENT_ID" : null,
    !env.SUPPLY_PHONE_NUMBER_ID ? "SUPPLY_PHONE_NUMBER_ID" : null,
  ].filter((name): name is string => name != null);
  if (missing.length) {
    return { ok: false as const, error: `Missing ${missing.join(", ")}. The call was not placed.`, conversationId: null };
  }

  try {
    const res = await fetch(OUTBOUND_URL, {
      method: "POST",
      headers: {
        "xi-api-key": env.ELEVENLABS_API_KEY ?? "",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        agent_id: env.SUPPLY_AGENT_ID,
        agent_phone_number_id: env.SUPPLY_PHONE_NUMBER_ID,
        to_number: toNumber,
        conversation_initiation_client_data: { dynamic_variables: variables },
      }),
    });
    const body: unknown = await res.json().catch(() => null);
    const success = body && typeof body === "object" && "success" in body ? (body as { success: unknown }).success : true;
    if (!res.ok || success === false) {
      return { ok: false as const, error: clip(apiErrorMessage(body, res.status)), conversationId: null };
    }
    return { ok: true as const, error: null, conversationId: conversationIdOf(body) };
  } catch (err) {
    return { ok: false as const, error: clip(err instanceof Error ? err.message : "Outbound call failed."), conversationId: null };
  }
}

async function pricedLines(db: Db, runId: string, supplierId: string): Promise<
  | { ok: true; total: number; lines: { ingredient_id: string; quantity: number; price_cents: number }[] }
  | ToolErr
> {
  const { data: items, error } = await db.from("supply_run_items").select("ingredient_id, quantity").eq("run_id", runId);
  if (error) throw error;
  const { data: quotes, error: quoteError } = await db
    .from("supply_quotes")
    .select("ingredient_id, price_cents, available")
    .eq("run_id", runId)
    .eq("supplier_id", supplierId);
  if (quoteError) throw quoteError;
  const byIngredient = new Map(quotes.map((quote) => [quote.ingredient_id, quote]));
  const lines = [];
  let total = 0;
  for (const item of items) {
    const quote = byIngredient.get(item.ingredient_id);
    if (!quote?.available || quote.price_cents == null) {
      return { ok: false, status: 400, error: "This store did not quote every item as available." };
    }
    const price = Number(quote.price_cents);
    const quantity = Number(item.quantity);
    total += price * quantity;
    lines.push({ ingredient_id: item.ingredient_id, quantity, price_cents: price });
  }
  return { ok: true, total: Math.round(total * 10000) / 10000, lines };
}

async function present(db: Db, runId: string): Promise<SupplyRunView> {
  const { data: run, error } = await db
    .from("supply_runs")
    .select("id, status, trigger, notes, winner_supplier_id, created_at")
    .eq("id", runId)
    .single();
  if (error) throw error;
  const { data: calls, error: callError } = await db
    .from("supply_calls")
    .select("id, supplier_id, purpose, status, to_number, conversation_id, error")
    .eq("run_id", runId)
    .order("created_at");
  if (callError) throw callError;
  const names = await supplierNames(db, calls.map((call) => call.supplier_id));
  return {
    ...run,
    calls: calls.map((call) => ({ ...call, supplier_name: names.get(call.supplier_id) ?? null })),
  };
}

async function findActive(db: Db) {
  const { data, error } = await db
    .from("supply_runs")
    .select("id")
    .in("status", ["quoting", "ordering"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function linesToBuy(db: Db): Promise<Line[]> {
  const { data, error } = await db.from("ingredients").select("id, name, unit, quantity_on_hand, reorder_threshold").order("name");
  if (error) throw error;
  const lines: Line[] = [];
  for (const row of data) {
    const onHand = Number(row.quantity_on_hand);
    const threshold = Number(row.reorder_threshold);
    if (!(onHand <= threshold)) continue;
    const quantity = Math.round((2 * threshold - onHand) * 1000) / 1000;
    if (!(quantity > 0)) continue;
    lines.push({ id: row.id, name: row.name, unit: row.unit, quantity });
  }
  return lines;
}

async function ingredientNames(db: Db, ids: string[]) {
  const unique = [...new Set(ids)];
  const map = new Map<string, { name: string; unit: string }>();
  if (unique.length === 0) return map;
  const { data, error } = await db.from("ingredients").select("id, name, unit").in("id", unique);
  if (error) throw error;
  for (const row of data) map.set(row.id, { name: row.name, unit: row.unit });
  return map;
}

async function supplierNames(db: Db, ids: string[]) {
  const unique = [...new Set(ids)];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data, error } = await db.from("suppliers").select("id, name").in("id", unique);
  if (error) throw error;
  for (const row of data) map.set(row.id, row.name);
  return map;
}

async function markCall(
  db: Db,
  id: string,
  patch: { status: CallStatus; error?: string | null; conversation_id?: string | null },
) {
  const { error } = await db.from("supply_calls").update(patch).eq("id", id);
  if (error) throw error;
}

async function markPlaced(db: Db, runId: string) {
  const { error } = await db
    .from("supply_runs")
    .update({ status: "placed", updated_at: new Date().toISOString() })
    .eq("id", runId)
    .in("status", ["ordering", "placed"]);
  if (error) throw error;
}

async function failRun(db: Db, runId: string, notes: string) {
  const { error } = await db
    .from("supply_runs")
    .update({ status: "failed", notes, updated_at: new Date().toISOString() })
    .eq("id", runId)
    .in("status", ["quoting", "ordering"]);
  if (error) throw error;
}

function shoppingList(lines: (Line & { price_cents?: number })[], withPrices: boolean) {
  return lines
    .map((line) => {
      const amount = (Math.round(line.quantity * 1000) / 1000).toString();
      const base = `${line.name}: ${amount} ${line.unit}`;
      if (!withPrices || line.price_cents == null) return base;
      return `${base} at ${formatDollars(line.price_cents)} per ${line.unit}`;
    })
    .join("\n");
}

function formatDollars(cents: number) {
  const dollars = Math.abs(cents) / 100;
  const trimmed = dollars.toFixed(6).replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
  const [whole, frac = ""] = trimmed.split(".");
  const fraction = frac.length >= 2 ? frac : `${frac}00`.slice(0, 2);
  return `${cents < 0 ? "-" : ""}$${whole}.${fraction}`;
}

function matchIngredient<T extends { id: string; name: string }>(rows: T[], spoken: string) {
  const needle = normalize(spoken);
  const exact = rows.filter((row) => normalize(row.name) === needle);
  const hits = exact.length
    ? exact
    : rows.filter((row) => {
        const name = normalize(row.name);
        return name.includes(needle) || needle.includes(name);
      });
  if (hits.length === 1) return { ok: true as const, ingredient: hits[0]! };
  const names = rows.map((row) => row.name).join(", ");
  const error = hits.length === 0
    ? `"${spoken}" is not on the shopping list. Available: ${names}.`
    : `"${spoken}" matches more than one item (${hits.map((row) => row.name).join(", ")}). Ask which one.`;
  return { ok: false as const, error };
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function conversationIdOf(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const id = record.conversation_id ?? record.conversationId;
  return typeof id === "string" && id ? id : null;
}

function apiErrorMessage(body: unknown, status: number) {
  if (body && typeof body === "object") {
    const record = body as { detail?: unknown; message?: unknown };
    if (typeof record.message === "string" && record.message) return record.message;
    if (typeof record.detail === "string" && record.detail) return record.detail;
    if (record.detail && typeof record.detail === "object" && "message" in record.detail) {
      const message = (record.detail as { message?: unknown }).message;
      if (typeof message === "string" && message) return message;
    }
  }
  return `Outbound call failed (${status}).`;
}

function clip(value: string) {
  return value.length > 400 ? `${value.slice(0, 397)}...` : value;
}
