/**
 * Pure-SVG donut chart for the Job Profitability widget.
 *
 * Four slices — Line items (blue), Labour (amber), Expenses (slate),
 * Profit (green or red if negative). Legend on the right, center text
 * shows the big "$X,XXX profit" number + margin %.
 *
 * No chart library — dependencies would mean another KB per page
 * load, and a donut is 20 lines of trig. This is a server component;
 * nothing here needs interactivity.
 */
import { money } from "@/lib/format";
import type { ProfitabilityBreakdown } from "@/lib/project-profitability";

const COLORS = {
  lineItems: "#2563eb", // blue-600
  labour: "#d97706", // amber-600
  expenses: "#475569", // slate-600
  profitPos: "#059669", // emerald-600
  profitNeg: "#dc2626", // red-600
  bg: "#f1f5f9", // slate-100 (empty-state ring)
};

export function ProfitabilityDonut({
  data,
}: {
  data: ProfitabilityBreakdown;
}) {
  const { revenue, lineItems, labour, expenses, profit, marginPct } = data;
  // Denominator for the arcs: when we've lost money (profit < 0) the
  // revenue is already "used up" by costs, so draw the ring at cost total
  // and show the negative profit as a warning callout instead.
  const profitSlice = Math.max(profit, 0);
  const denom = Math.max(revenue, lineItems + labour + expenses);
  const slices = [
    { label: "Line items", value: lineItems, color: COLORS.lineItems },
    { label: "Labour", value: labour, color: COLORS.labour },
    { label: "Expenses", value: expenses, color: COLORS.expenses },
    {
      label: "Profit",
      value: profitSlice,
      color: profit < 0 ? COLORS.profitNeg : COLORS.profitPos,
    },
  ];
  const total = slices.reduce((s, x) => s + x.value, 0);
  const hasData = total > 0 && denom > 0;

  // Donut geometry.
  const size = 180;
  const r = 72;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  // Precompute stroke-dasharray offsets so we can draw contiguous
  // arcs around the circle.
  let cumulative = 0;
  const arcs = slices.map((s) => {
    const frac = hasData ? s.value / denom : 0;
    const arcLen = frac * circumference;
    const dash = `${arcLen} ${circumference - arcLen}`;
    const offset = circumference - cumulative;
    cumulative += arcLen;
    return { ...s, dash, offset, frac };
  });

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
      <div className="relative h-[180px] w-[180px] flex-shrink-0">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="h-full w-full -rotate-90"
          aria-label={`Project profitability: ${money(profit)} profit on ${money(revenue)} revenue`}
        >
          {/* Background ring so the empty area is still visible when
              a slice is small. */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={COLORS.bg}
            strokeWidth={22}
          />
          {hasData &&
            arcs.map((a, i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={a.color}
                strokeWidth={22}
                strokeDasharray={a.dash}
                strokeDashoffset={a.offset}
              />
            ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span
            className={`text-lg font-bold ${
              profit < 0 ? "text-red-700" : "text-neutral-900"
            }`}
          >
            {money(profit)}
          </span>
          <span className="text-[11px] uppercase tracking-wide text-neutral-500">
            Profit
          </span>
          {marginPct !== null && (
            <span
              className={`mt-0.5 text-[11px] font-semibold ${
                marginPct < 15
                  ? "text-red-600"
                  : marginPct >= 30
                    ? "text-emerald-700"
                    : "text-amber-700"
              }`}
            >
              {marginPct.toFixed(1)}% margin
            </span>
          )}
        </div>
      </div>

      <dl className="flex-1 space-y-1.5 text-sm">
        <Row label="Total price" value={money(revenue)} emphasize />
        <Row
          label="Line items"
          value={`− ${money(lineItems)}`}
          color={COLORS.lineItems}
        />
        <Row
          label="Labour"
          value={`− ${money(labour)}`}
          color={COLORS.labour}
        />
        <Row
          label="Expenses"
          value={`− ${money(expenses)}`}
          color={COLORS.expenses}
        />
        <Row
          label="= Profit"
          value={money(profit)}
          color={profit < 0 ? COLORS.profitNeg : COLORS.profitPos}
          emphasize
        />
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  color,
  emphasize,
}: {
  label: string;
  value: string;
  color?: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-neutral-600">
        {color && (
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: color }}
          />
        )}
        <span className={emphasize ? "font-semibold text-neutral-900" : ""}>
          {label}
        </span>
      </dt>
      <dd
        className={
          emphasize ? "font-semibold text-neutral-900" : "text-neutral-700"
        }
      >
        {value}
      </dd>
    </div>
  );
}
