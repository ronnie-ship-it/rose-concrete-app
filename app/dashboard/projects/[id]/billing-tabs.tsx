"use client";

/**
 * Two-tab wrapper for the project-page Billing section: Invoicing
 * (the milestones list + generate-invoice action) and Reminders
 * (the payment_reminders per milestone). Mirrors Jobber's "Invoicing"
 * vs "Reminders" tabs so Ronnie finds what he expects.
 *
 * The sidebar (see InvoiceSidebar) sits next to both tabs since the
 * invoice-level controls apply regardless of which pane is showing.
 */
import { useState, type ReactNode } from "react";

type Tab = "invoicing" | "reminders";

export function BillingTabs({
  invoicing,
  reminders,
  sidebar,
}: {
  invoicing: ReactNode;
  reminders: ReactNode;
  sidebar: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("invoicing");
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="min-w-0 space-y-4">
        <div
          role="tablist"
          aria-label="Billing"
          className="flex items-center gap-1 border-b border-neutral-200"
        >
          <TabButton
            active={tab === "invoicing"}
            onClick={() => setTab("invoicing")}
          >
            Invoicing
          </TabButton>
          <TabButton
            active={tab === "reminders"}
            onClick={() => setTab("reminders")}
          >
            Reminders
          </TabButton>
        </div>
        <div role="tabpanel">
          {tab === "invoicing" ? invoicing : reminders}
        </div>
      </div>
      <div>{sidebar}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${
        active
          ? "border-brand-600 text-brand-700"
          : "border-transparent text-neutral-500 hover:text-neutral-800"
      }`}
    >
      {children}
    </button>
  );
}
