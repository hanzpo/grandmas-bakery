import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { type adminDb, normalizeErrors, toError, upsertCustomer } from "./lib";

type Row = { id: string; name: string; email: string | null; phone: string | null; marketing_opt_in: boolean };

/** Just enough of the Supabase query builder for upsertCustomer, over an in-memory table. */
function fakeDb(rows: Row[]) {
  const same = (a: unknown, b: unknown) => typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
  const table = {
    select: () => ({
      eq: (col: keyof Row, val: string) => ({
        maybeSingle: async () => ({ data: rows.find((r) => same(r[col], val)) ?? null, error: null }),
      }),
    }),
    insert: (row: Omit<Row, "id">) => ({
      select: () => ({
        single: async () => {
          const clash = rows.some((r) => same(r.email, row.email) || same(r.phone, row.phone));
          if (clash) return { data: null, error: { message: "duplicate key value violates unique constraint" } };
          const created = { id: `new-${rows.length + 1}`, ...row };
          rows.push(created);
          return { data: created, error: null };
        },
      }),
    }),
    update: (patch: Partial<Row>) => ({
      eq: async (col: keyof Row, val: string) => {
        rows.filter((r) => r[col] === val).forEach((r) => Object.assign(r, patch));
        return { error: null };
      },
    }),
  };
  return { from: () => table } as unknown as ReturnType<typeof adminDb>;
}

const seed = (): Row[] => [
  { id: "eleanor", name: "Eleanor Park", email: "eleanor@example.com", phone: "555-0201", marketing_opt_in: false },
  { id: "sam", name: "Sam Okafor", email: "sam@example.com", phone: "555-0202", marketing_opt_in: false },
  { id: "walkin", name: "Phone Only", email: null, phone: "555-0300", marketing_opt_in: false },
];

describe("upsertCustomer", () => {
  it("matches a returning customer by email, case-insensitively", async () => {
    const rows = seed();
    expect(await upsertCustomer(fakeDb(rows), { name: "Sam", email: " SAM@example.com " })).toBe("sam");
    expect(rows).toHaveLength(3);
  });

  it("prefers the email match when the phone belongs to someone else", async () => {
    const rows = seed();
    expect(await upsertCustomer(fakeDb(rows), { name: "Sam", email: "sam@example.com", phone: "555-0201" })).toBe("sam");
  });

  it("creates a new customer, without the phone, when only the phone matches someone else", async () => {
    const rows = seed();
    const id = await upsertCustomer(fakeDb(rows), { name: "Ann", email: "ann@example.com", phone: "555-0201" });
    expect(id).not.toBe("eleanor");
    expect(rows.find((r) => r.id === id)).toMatchObject({ email: "ann@example.com", phone: null });
  });

  it("never links an emailed checkout to a phone-only customer, or rewrites that record", async () => {
    const rows = seed();
    const id = await upsertCustomer(fakeDb(rows), { name: "Pat", email: "pat@example.com", phone: "555-0300", marketing_opt_in: true });
    expect(id).not.toBe("walkin");
    expect(rows.find((r) => r.id === "walkin")).toMatchObject({ email: null, marketing_opt_in: false });
    expect(rows.find((r) => r.id === id)).toMatchObject({ email: "pat@example.com", phone: null });
  });

  it("finds a returning customer whose phone has punctuation in it", async () => {
    const rows = [...seed(), { id: "cy", name: "Cy", email: "cy@example.com", phone: "+1 555, 0300 (ext. 2)", marketing_opt_in: false }];
    expect(await upsertCustomer(fakeDb(rows), { name: "Cy", email: "cy@example.com", phone: "+1 555, 0300 (ext. 2)" })).toBe("cy");
  });

  it("matches phone-only callers by phone (voice orders)", async () => {
    expect(await upsertCustomer(fakeDb(seed()), { name: "Eleanor", phone: "555-0201" })).toBe("eleanor");
  });

  it("subscribes a returning customer who opts in", async () => {
    const rows = seed();
    await upsertCustomer(fakeDb(rows), { name: "Sam", email: "sam@example.com", marketing_opt_in: true });
    expect(rows.find((r) => r.id === "sam")?.marketing_opt_in).toBe(true);
  });
});

describe("toError", () => {
  it("keeps Errors and wraps plain error objects", () => {
    const err = new Error("boom");
    expect(toError(err)).toBe(err);
    expect(toError({ message: "duplicate key", code: "23505" }).message).toBe("duplicate key");
    expect(toError("nope").message).toBe("nope");
  });

  it("lets the API answer JSON when a route throws a Supabase-style error", async () => {
    const app = new Hono();
    app.use(normalizeErrors);
    app.get("/", () => {
      throw { message: "duplicate key" };
    });
    app.onError((err, c) => c.json({ error: err.message }, 500));
    const res = await app.request("/");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "duplicate key" });
  });
});
