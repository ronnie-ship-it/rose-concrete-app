import { BookingForm } from "./booking-form";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const metadata = { title: "Request a concrete quote — Rose Concrete" };

export type BookableService = {
  id: string;
  label: string;
  category: string;
  unit: string;
  unit_price: number;
};

/**
 * Public booking page. Designed to be embedded into
 * sandiegoconcrete.ai with an <iframe> or copy-pasted URL, so the
 * layout stands alone and doesn't require the dashboard shell.
 *
 * We fetch the bookable products server-side (is_bookable_online=true
 * AND is_active=true) and pass them to the form so customers can
 * pick a specific service if they already know what they want. The
 * generic SERVICE_TYPES dropdown covers folks who don't.
 */
export default async function BookPage() {
  const supabase = createServiceRoleClient();
  const { data: raw } = await supabase
    .from("line_item_templates")
    .select(
      "id, title, booking_display_name, category, unit, unit_price, is_bookable_online, is_active",
    )
    .eq("is_active", true)
    .eq("is_bookable_online", true)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });
  const services: BookableService[] = (raw ?? []).map((r) => ({
    id: r.id as string,
    label:
      ((r.booking_display_name as string | null) ?? "").trim() ||
      (r.title as string),
    category: (r.category as string) ?? "General",
    unit: (r.unit as string) ?? "job",
    unit_price: Number(r.unit_price ?? 0),
  }));

  return (
    <div className="min-h-screen bg-cream px-4 py-10">
      <div className="mx-auto max-w-lg space-y-6">
        <header className="rounded-lg bg-brand-600 px-6 py-6 text-white shadow-sm">
          <h1 className="text-2xl font-bold">Request a concrete quote</h1>
          <p className="mt-1 text-sm text-brand-100">
            Tell us what you&apos;re thinking — driveways, patios, sidewalks,
            RV pads. We&apos;ll reply within one business day.
          </p>
        </header>

        <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <BookingForm services={services} />
        </section>

        <footer className="pt-2 text-center text-xs text-neutral-500">
          Rose Concrete · San Diego, CA · Licensed &amp; insured
        </footer>
      </div>
    </div>
  );
}
