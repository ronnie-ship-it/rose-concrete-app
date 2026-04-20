/**
 * Payment-method math. Single source of truth so the admin UI, the public
 * pay page, the public quote-accept page, and the QBO receipt emails all
 * compute the same numbers.
 *
 * Default rates:
 *   - Credit card: 2.9% + $0.30 (standard processor)
 *   - ACH:         $10 flat (typical ACH-through-QBO/Stripe)
 *   - Check:       no fee
 *
 * All three are configurable via public.invoice_settings so Ronnie can edit
 * from /dashboard/settings/invoicing without a redeploy.
 */

export type PaymentMethod = "check" | "ach" | "credit_card";

export const PAYMENT_METHODS: PaymentMethod[] = ["check", "ach", "credit_card"];

export type FeeConfig = {
  // Credit card
  cc_fee_percent: number; // e.g. 0.0290
  cc_fee_flat_cents: number; // e.g. 30
  cc_fee_absorb: boolean; // true = Rose eats the fee

  // ACH
  ach_fee_percent: number; // e.g. 0.0000
  ach_fee_flat_cents: number; // e.g. 1000 ($10)
  ach_fee_absorb: boolean;
};

export const DEFAULT_FEE_CONFIG: FeeConfig = {
  cc_fee_percent: 0.029,
  cc_fee_flat_cents: 30,
  cc_fee_absorb: false,
  ach_fee_percent: 0.0,
  ach_fee_flat_cents: 1000,
  ach_fee_absorb: false,
};

/**
 * Row returned by `select * from invoice_settings`. Older rows created
 * before migration 024 don't have the ACH columns; we coalesce to the
 * defaults so the fee math is stable regardless of DB state.
 */
export type InvoiceSettingsRow = Partial<{
  cc_fee_percent: number | string | null;
  cc_fee_flat_cents: number | null;
  cc_fee_absorb: boolean | null;
  ach_fee_percent: number | string | null;
  ach_fee_flat_cents: number | null;
  ach_fee_absorb: boolean | null;
}>;

export function feeConfigFromRow(row: InvoiceSettingsRow | null): FeeConfig {
  const r = row ?? {};
  return {
    cc_fee_percent:
      r.cc_fee_percent != null
        ? Number(r.cc_fee_percent)
        : DEFAULT_FEE_CONFIG.cc_fee_percent,
    cc_fee_flat_cents:
      r.cc_fee_flat_cents ?? DEFAULT_FEE_CONFIG.cc_fee_flat_cents,
    cc_fee_absorb: r.cc_fee_absorb ?? DEFAULT_FEE_CONFIG.cc_fee_absorb,
    ach_fee_percent:
      r.ach_fee_percent != null
        ? Number(r.ach_fee_percent)
        : DEFAULT_FEE_CONFIG.ach_fee_percent,
    ach_fee_flat_cents:
      r.ach_fee_flat_cents ?? DEFAULT_FEE_CONFIG.ach_fee_flat_cents,
    ach_fee_absorb: r.ach_fee_absorb ?? DEFAULT_FEE_CONFIG.ach_fee_absorb,
  };
}

/**
 * Gross-up fee formula: make the customer pay enough extra that the
 * business nets the full `amount` after the processor takes their cut.
 *
 *   total × (1 - percent) - flat = amount
 *   total = (amount + flat) / (1 - percent)
 *   fee   = total - amount
 */
function grossUpFee(
  amount: number,
  percent: number,
  flatCents: number,
  absorb: boolean,
): number {
  if (absorb) return 0;
  if (amount <= 0) return 0;
  const flat = flatCents / 100;
  if (percent <= 0) {
    // Flat-only — no division needed.
    return round2(flat);
  }
  const total = (amount + flat) / (1 - percent);
  const fee = total - amount;
  return round2(fee);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ----- credit card -----

export function computeCardFee(
  amount: number,
  cfg: FeeConfig = DEFAULT_FEE_CONFIG,
): number {
  return grossUpFee(
    amount,
    cfg.cc_fee_percent,
    cfg.cc_fee_flat_cents,
    cfg.cc_fee_absorb,
  );
}

export function computeCardTotal(
  amount: number,
  cfg: FeeConfig = DEFAULT_FEE_CONFIG,
): number {
  return round2(amount + computeCardFee(amount, cfg));
}

// ----- ACH -----

export function computeAchFee(
  amount: number,
  cfg: FeeConfig = DEFAULT_FEE_CONFIG,
): number {
  return grossUpFee(
    amount,
    cfg.ach_fee_percent,
    cfg.ach_fee_flat_cents,
    cfg.ach_fee_absorb,
  );
}

export function computeAchTotal(
  amount: number,
  cfg: FeeConfig = DEFAULT_FEE_CONFIG,
): number {
  return round2(amount + computeAchFee(amount, cfg));
}

// ----- unified -----

/**
 * Single lookup — the UI, the accept action, and the receipt builder all
 * call this. Returns `{ fee, total }` for any supported method.
 *
 * Check is always zero-fee; ACH and credit card go through the gross-up
 * formula with their own percent/flat defaults. Returning both values
 * (fee + total) keeps rounding consistent across callers — they never
 * have to do `Math.round(total - amount)` themselves.
 */
export function computeForMethod(
  method: PaymentMethod,
  amount: number,
  cfg: FeeConfig = DEFAULT_FEE_CONFIG,
): { fee: number; total: number } {
  if (method === "check") {
    return { fee: 0, total: round2(amount) };
  }
  if (method === "ach") {
    const fee = computeAchFee(amount, cfg);
    return { fee, total: round2(amount + fee) };
  }
  const fee = computeCardFee(amount, cfg);
  return { fee, total: round2(amount + fee) };
}

// ----- human-readable copy -----

export function describeCardFee(cfg: FeeConfig = DEFAULT_FEE_CONFIG): string {
  if (cfg.cc_fee_absorb) return "No processing fee — Rose Concrete covers it.";
  const pct = (cfg.cc_fee_percent * 100).toFixed(2).replace(/\.?0+$/, "");
  const flat = (cfg.cc_fee_flat_cents / 100).toFixed(2);
  if (cfg.cc_fee_flat_cents === 0) return `${pct}% processing fee`;
  return `${pct}% + $${flat} processing fee`;
}

export function describeAchFee(cfg: FeeConfig = DEFAULT_FEE_CONFIG): string {
  if (cfg.ach_fee_absorb) return "No bank-transfer fee — Rose Concrete covers it.";
  const pct = (cfg.ach_fee_percent * 100).toFixed(2).replace(/\.?0+$/, "");
  const flat = (cfg.ach_fee_flat_cents / 100).toFixed(2);
  if (cfg.ach_fee_percent === 0) return `$${flat} bank-transfer fee`;
  if (cfg.ach_fee_flat_cents === 0) return `${pct}% bank-transfer fee`;
  return `${pct}% + $${flat} bank-transfer fee`;
}

export function methodLabel(method: PaymentMethod): string {
  if (method === "check") return "Check";
  if (method === "ach") return "ACH bank transfer";
  return "Credit card";
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
