/**
 * Unit tests for the known-caller suppression gate.
 *
 * Run with: npm test
 *
 * Uses Node's built-in `node:test` runner via the `tsx` loader. No
 * network — Supabase / Jobber / OpenPhone are all stubbed in-process.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isKnownInboundCaller } from "@/lib/known-caller";
import {
  phoneMatchVariants,
  type OpenPhoneAdapter,
  type OpenPhoneContactSummary,
} from "@/lib/openphone";

// ---------- Supabase stub ----------
//
// The real Supabase query builder is fluent (`from().select().in().limit().
// maybeSingle()`). The gate only uses these chains, so we stub just those
// methods. Each table can be configured to return a row, return null, or
// throw — covering the three cases the gate needs to distinguish.

type StubRow = Record<string, unknown> | null;
type StubBehavior =
  | { kind: "row"; row: StubRow }
  | { kind: "error"; message: string }
  | { kind: "throw"; message: string };

type StubConfig = Partial<Record<"communications" | "clients", StubBehavior>>;

function makeSupabaseStub(config: StubConfig): SupabaseClient {
  function chain(table: string) {
    const behavior = config[table as keyof StubConfig] ?? {
      kind: "row" as const,
      row: null,
    };
    const exec = async () => {
      if (behavior.kind === "throw") throw new Error(behavior.message);
      if (behavior.kind === "error") {
        return { data: null, error: { message: behavior.message } };
      }
      return { data: behavior.row, error: null };
    };
    // Every method returns `this` until `maybeSingle()` resolves.
    const builder: Record<string, unknown> = {};
    const passthrough = ["select", "in", "eq", "or", "limit", "order"];
    for (const m of passthrough) builder[m] = () => builder;
    builder.maybeSingle = exec;
    builder.single = exec;
    return builder;
  }
  return { from: (table: string) => chain(table) } as unknown as SupabaseClient;
}

// ---------- OpenPhone stub ----------

function makeOpenPhoneStub(opts: {
  configured: boolean;
  contact?: OpenPhoneContactSummary;
  throws?: string;
}): OpenPhoneAdapter {
  return {
    async listCallsForPhone() {
      return [];
    },
    async listMessagesForPhone() {
      return [];
    },
    async listRecentInboundCalls() {
      return [];
    },
    async listCallsSince() {
      return [];
    },
    async listMessagesSince() {
      return [];
    },
    async startCall() {
      return { ok: false };
    },
    async sendMessage() {
      return { ok: false, error: "stub", skip: true };
    },
    async findContactByPhone() {
      if (opts.throws) throw new Error(opts.throws);
      return opts.contact ?? null;
    },
    isConfigured() {
      return opts.configured;
    },
  };
}

// ---------- Jobber lookup stubs ----------

const jobberHit = async () => true;
const jobberMiss = async () => false;
const jobberThrow = async () => {
  throw new Error("jobber 500");
};

// Mirrors the production lookup: takes a token + phone, queries Jobber,
// verifies the returned phoneNumbers via phoneMatchVariants. We re-implement
// just the verification part here so the format-mismatch test exercises
// real logic, not a hand-tuned boolean.
function makeJobberLookupReturning(rawNumberFromJobber: string) {
  return async (_token: string, phone: string) => {
    const queryVariants = new Set(phoneMatchVariants(phone));
    for (const v of phoneMatchVariants(rawNumberFromJobber)) {
      if (queryVariants.has(v)) return true;
    }
    return false;
  };
}

// ---------- shared phone fixtures ----------

const E164 = "+16195379408";
const RAW_FORMATTED = "(619) 537-9408";

// ---------- the tests ----------

describe("isKnownInboundCaller", () => {
  it("returns known=false when all four sources miss", async () => {
    const result = await isKnownInboundCaller(E164, {
      supabase: makeSupabaseStub({}),
      openphone: makeOpenPhoneStub({ configured: true, contact: null }),
      jobberToken: "tok",
      jobberLookup: jobberMiss,
    });
    assert.equal(result.known, false);
    assert.deepEqual(result.sources, []);
    assert.equal(result.clientId, null);
    assert.deepEqual(result.errors, []);
  });

  it("returns known=true with sources=['communications'] when prior history exists", async () => {
    const result = await isKnownInboundCaller(E164, {
      supabase: makeSupabaseStub({
        communications: {
          kind: "row",
          row: { id: "c1", client_id: "cli-1" },
        },
      }),
      openphone: makeOpenPhoneStub({ configured: true, contact: null }),
      jobberToken: "tok",
      jobberLookup: jobberMiss,
    });
    assert.equal(result.known, true);
    assert.deepEqual(result.sources, ["communications"]);
    assert.equal(result.clientId, "cli-1");
  });

  it("returns clientId=null when communications hit but row has no client_id", async () => {
    const result = await isKnownInboundCaller(E164, {
      supabase: makeSupabaseStub({
        communications: { kind: "row", row: { id: "c1", client_id: null } },
      }),
      openphone: makeOpenPhoneStub({ configured: true, contact: null }),
      jobberToken: "tok",
      jobberLookup: jobberMiss,
    });
    assert.equal(result.known, true);
    assert.deepEqual(result.sources, ["communications"]);
    assert.equal(result.clientId, null);
  });

  it("returns known=true with sources=['clients'] and clientId set when clients matches", async () => {
    const result = await isKnownInboundCaller(E164, {
      supabase: makeSupabaseStub({
        clients: { kind: "row", row: { id: "cli-2" } },
      }),
      openphone: makeOpenPhoneStub({ configured: true, contact: null }),
      jobberToken: "tok",
      jobberLookup: jobberMiss,
    });
    assert.equal(result.known, true);
    assert.deepEqual(result.sources, ["clients"]);
    assert.equal(result.clientId, "cli-2");
  });

  it("returns known=true with sources=['jobber'] when only Jobber hits", async () => {
    const result = await isKnownInboundCaller(E164, {
      supabase: makeSupabaseStub({}),
      openphone: makeOpenPhoneStub({ configured: true, contact: null }),
      jobberToken: "tok",
      jobberLookup: jobberHit,
    });
    assert.equal(result.known, true);
    assert.deepEqual(result.sources, ["jobber"]);
    assert.equal(result.clientId, null);
  });

  it("returns known=true with sources=['openphone'] when only OpenPhone hits", async () => {
    const result = await isKnownInboundCaller(E164, {
      supabase: makeSupabaseStub({}),
      openphone: makeOpenPhoneStub({
        configured: true,
        contact: { id: "op-1" },
      }),
      jobberToken: "tok",
      jobberLookup: jobberMiss,
    });
    assert.equal(result.known, true);
    assert.deepEqual(result.sources, ["openphone"]);
    assert.equal(result.clientId, null);
  });

  it("matches across formats: Jobber returns '(619) 537-9408' while query is +16195379408", async () => {
    // The whole reason for the verify step in findJobberClientByPhone:
    // Jobber stores phones in display format, our query is E.164. Both
    // collapse to the same digit set, so phoneMatchVariants must catch
    // it. If this test breaks, repeat callers from Jobber slip through
    // and the noisy-email bug regresses.
    const lookup = makeJobberLookupReturning(RAW_FORMATTED);
    const result = await isKnownInboundCaller(E164, {
      supabase: makeSupabaseStub({}),
      openphone: makeOpenPhoneStub({ configured: true, contact: null }),
      jobberToken: "tok",
      jobberLookup: lookup,
    });
    assert.equal(result.known, true, "Jobber match must verify across formats");
    assert.deepEqual(result.sources, ["jobber"]);
  });

  it("rejects fuzzy Jobber matches when the returned number is a different phone", async () => {
    // searchTerm is a substring match in Jobber — a query for
    // "+16195379408" could fuzzy-match a different client whose number
    // contains a substring overlap. The verify step must reject that.
    const lookup = makeJobberLookupReturning("+15551234567");
    const result = await isKnownInboundCaller(E164, {
      supabase: makeSupabaseStub({}),
      openphone: makeOpenPhoneStub({ configured: true, contact: null }),
      jobberToken: "tok",
      jobberLookup: lookup,
    });
    assert.equal(result.known, false);
    assert.deepEqual(result.sources, []);
  });

  it("fails open when all four sources throw — caller still treated as unknown", async () => {
    const result = await isKnownInboundCaller(E164, {
      supabase: makeSupabaseStub({
        communications: { kind: "throw", message: "comm boom" },
        clients: { kind: "throw", message: "clients boom" },
      }),
      openphone: makeOpenPhoneStub({
        configured: true,
        throws: "openphone 500",
      }),
      jobberToken: "tok",
      jobberLookup: jobberThrow,
    });
    assert.equal(result.known, false);
    assert.deepEqual(result.sources, []);
    assert.equal(result.errors.length, 4);
    const sources = result.errors.map((e) => e.source).sort();
    assert.deepEqual(sources, [
      "clients",
      "communications",
      "jobber",
      "openphone",
    ]);
  });

  it("one throw + one match → known=true and the throw is still logged", async () => {
    const result = await isKnownInboundCaller(E164, {
      supabase: makeSupabaseStub({
        communications: { kind: "row", row: { id: "c1", client_id: "cli-9" } },
      }),
      openphone: makeOpenPhoneStub({
        configured: true,
        throws: "openphone 500",
      }),
      jobberToken: "tok",
      jobberLookup: jobberMiss,
    });
    assert.equal(result.known, true);
    assert.deepEqual(result.sources, ["communications"]);
    assert.equal(result.clientId, "cli-9");
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].source, "openphone");
  });

  it("Supabase errors (non-throw) are treated as fail-open and recorded", async () => {
    const result = await isKnownInboundCaller(E164, {
      supabase: makeSupabaseStub({
        communications: { kind: "error", message: "RLS denied" },
      }),
      openphone: makeOpenPhoneStub({ configured: true, contact: null }),
      jobberToken: "tok",
      jobberLookup: jobberMiss,
    });
    assert.equal(result.known, false);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].source, "communications");
    assert.match(result.errors[0].error, /RLS denied/);
  });

  it("skips Jobber when no token is available (not an error)", async () => {
    const result = await isKnownInboundCaller(E164, {
      supabase: makeSupabaseStub({}),
      openphone: makeOpenPhoneStub({ configured: true, contact: null }),
      jobberToken: null,
      jobberLookup: async () => {
        throw new Error("should not be called when token is null");
      },
    });
    assert.equal(result.known, false);
    assert.deepEqual(result.errors, []);
  });

  it("skips OpenPhone when the adapter is the stub (not an error)", async () => {
    const result = await isKnownInboundCaller(E164, {
      supabase: makeSupabaseStub({}),
      openphone: makeOpenPhoneStub({ configured: false }),
      jobberToken: "tok",
      jobberLookup: jobberMiss,
    });
    assert.equal(result.known, false);
    assert.deepEqual(result.errors, []);
  });

  it("normalises raw '(619) 537-9408' to E.164 and queries the Supabase variants", async () => {
    // Capture the `in()` filter values to prove the queries see normalised
    // variants, not the raw input.
    const captured: { table: string; values: unknown }[] = [];
    const supa = {
      from(table: string) {
        const b: Record<string, unknown> = {};
        const passthrough = ["select", "eq", "or", "limit", "order"];
        for (const m of passthrough) b[m] = () => b;
        b.in = (_col: string, values: unknown) => {
          captured.push({ table, values });
          return b;
        };
        b.maybeSingle = async () => ({ data: null, error: null });
        b.single = b.maybeSingle;
        return b;
      },
    } as unknown as SupabaseClient;

    await isKnownInboundCaller(RAW_FORMATTED, {
      supabase: supa,
      openphone: makeOpenPhoneStub({ configured: true, contact: null }),
      jobberToken: "tok",
      jobberLookup: jobberMiss,
    });

    const comm = captured.find((c) => c.table === "communications");
    const cli = captured.find((c) => c.table === "clients");
    assert.ok(comm, "communications lookup must have run");
    assert.ok(cli, "clients lookup must have run");
    // Variants for +16195379408 must include the E.164 string.
    assert.ok(
      (comm!.values as string[]).includes(E164),
      `expected variants to include ${E164}, got ${JSON.stringify(comm!.values)}`,
    );
  });

  it("returns known=false with no lookups attempted when phone is empty", async () => {
    let supaCalled = false;
    const supa = {
      from() {
        supaCalled = true;
        return {} as never;
      },
    } as unknown as SupabaseClient;

    const result = await isKnownInboundCaller("", {
      supabase: supa,
      openphone: makeOpenPhoneStub({ configured: true, contact: null }),
      jobberToken: "tok",
      jobberLookup: async () => {
        throw new Error("should not be called");
      },
    });
    assert.equal(result.known, false);
    assert.equal(supaCalled, false);
  });
});
