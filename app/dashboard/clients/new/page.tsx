import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { ClientForm } from "../client-form";
import { createClientAction } from "../actions";

export const metadata = { title: "New client — Rose Concrete" };

export default async function NewClientPage() {
  await requireRole(["admin", "office"]);
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/clients"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← Clients
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-neutral-900">New client</h1>
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <ClientForm action={createClientAction} submitLabel="Create client" />
      </div>
    </div>
  );
}
