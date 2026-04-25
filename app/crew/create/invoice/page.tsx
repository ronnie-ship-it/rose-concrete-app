import { requireRole } from "@/lib/auth";
import {
  CrewCreateChrome,
  FieldStacked,
  PickerButton,
  AddLink,
  DropdownRow,
  SectionLabel,
  SectionRow,
  PlusButton,
  SectionSpacer,
  ToggleRow,
} from "../chrome";

export const metadata = { title: "New invoice — Rose Concrete" };

/**
 * Crew "New Invoice" — Jobber-mobile parity.
 *
 *   - "Billed to" label + "🔍 Select Existing Client" picker
 *   - First name / Last name / Property address
 *   - "Add Phone Number" / "Add Email" green links
 *   - "Overview" section:
 *     - Invoice title (default "For Services Rendered")
 *     - Issued / Date sent dropdown
 *     - Payment terms / Residential default (Net 30)
 *     - Salesperson / Please select
 *   - "Product / Service" / Line items + green +
 *   - Subtotal $0.00
 *   - Discount $0.00 (green)
 *   - Tax $0.00 (green)
 *   - Total $0.00 (highlighted gray bg)
 *   - "Invoice payment settings" section
 *     - Toggle: Accept card payments (ON)
 *     - Toggle: Accept bank payments (ACH) (ON)
 *     - Toggle: Accept partial payments (OFF)
 *   - "Client message" + green +
 *   - "Contract / Disclaimer" → arrow + body text
 *   - Bottom: green "Review and Send" + green "Save" link
 *
 * For now this routes to the existing dashboard payments flow on
 * submit — the mobile form handoff the rich Jobber UI; the office
 * desktop flow handles the actual creation.
 */
export default async function CrewNewInvoice() {
  await requireRole(["crew", "admin", "office"]);

  return (
    <CrewCreateChrome
      title="New Invoice"
      saveLabel="Review and Send"
      saveHref="/dashboard/payments"
      secondaryLabel="Save"
      secondaryHref="/dashboard/payments"
    >
      <SectionLabel>Billed to</SectionLabel>
      <PickerButton
        href="/dashboard/clients"
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        }
        label="Select Existing Client"
      />
      <FieldStacked label="" name="first_name" placeholder="First name" />
      <FieldStacked label="" name="last_name" placeholder="Last name" />
      <FieldStacked label="" name="property_address" placeholder="Property address" />
      <AddLink
        href="#phone"
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.8 12.8 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.8 12.8 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        }
        label="Add Phone Number"
      />
      <AddLink
        href="#email"
        icon={
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 7l9 6 9-6" />
          </svg>
        }
        label="Add Email"
      />

      <SectionSpacer />

      <SectionLabel>Overview</SectionLabel>
      <FieldStacked
        label="Invoice title"
        name="title"
        defaultValue="For Services Rendered"
      />
      <DropdownRow name="issued" label="Issued" value="Date sent" />
      <DropdownRow
        name="payment_terms"
        label="Payment terms"
        value="Residential default (Net 30)"
      />

      <SectionSpacer />

      <DropdownRow name="salesperson" label="Salesperson" value="Please select" />

      <SectionSpacer />

      <SectionLabel>Product / Service</SectionLabel>
      <SectionRow icon={null} label="Line items" trailing={<PlusButton />} />

      {/* Totals — Subtotal/Discount/Tax/Total in a stacked summary */}
      <div className="px-4 py-2">
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
          <SummaryRow label="Subtotal" value="$0.00" />
          <SummaryRow label="Discount" value="$0.00" valueClass="text-[#1A7B40]" />
          <SummaryRow label="Tax" value="$0.00" valueClass="text-[#1A7B40]" />
          <SummaryRow label="Total" value="$0.00" highlight />
        </div>
      </div>

      <SectionSpacer />

      <SectionLabel>Invoice payment settings</SectionLabel>
      <p className="px-4 pb-2 text-xs text-neutral-500 dark:text-neutral-400">
        Updating payment options on this invoice won&apos;t change your{" "}
        <span className="font-bold text-[#1A7B40] underline">
          default payment preferences
        </span>
        .
      </p>
      <ToggleRow
        name="accept_card"
        label="Accept card payments"
        defaultChecked
      />
      <ToggleRow
        name="accept_ach"
        label="Accept bank payments (ACH)"
        defaultChecked
      />
      <ToggleRow name="accept_partial" label="Accept partial payments" />

      <SectionSpacer />

      <SectionRow
        icon={null}
        label="Client message"
        trailing={<PlusButton />}
      />

      <SectionSpacer />

      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-[#1a2332] dark:text-white">
            Contract / Disclaimer
          </p>
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#1A7B40]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </div>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          Thank you for your business. Please contact us with any questions
          regarding this invoice.
        </p>
      </div>
    </CrewCreateChrome>
  );
}

function SummaryRow({
  label,
  value,
  valueClass = "text-[#1a2332] dark:text-white",
  highlight = false,
}: {
  label: string;
  value: string;
  valueClass?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-3 ${
        highlight
          ? "bg-neutral-50 dark:bg-neutral-700/40"
          : "border-b border-neutral-100 last:border-0 dark:border-neutral-700"
      }`}
    >
      <span className="text-sm text-[#1a2332] dark:text-white">{label}</span>
      <span className={`text-sm font-bold ${valueClass}`}>{value}</span>
    </div>
  );
}
