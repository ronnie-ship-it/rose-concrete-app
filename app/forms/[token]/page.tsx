import { notFound } from "next/navigation";
import type { Viewport } from "next";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { FormItem } from "@/lib/customer-forms";
import { FormRenderer } from "./form-renderer";

export const metadata = {
  title: "Rose Concrete — please confirm",
  robots: { index: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // prevent iOS pinch-zoom stealing focus from the signature pad
  themeColor: "#1B2A4A",
};

type Params = Promise<{ token: string }>;

/**
 * Public customer-form page. No session — the URL token is the sole
 * credential. Renders welcome video (if any), intro copy, items
 * (acknowledge / initials / text / signature), and a Submit button
 * wired to `submitCustomerFormAction`.
 *
 * Mobile-first layout: full-bleed header, generous tap targets,
 * sticky Submit button on narrow viewports, signature canvas sized
 * to the viewport width so it's actually usable with a finger.
 */
export default async function PublicFormPage({
  params,
}: {
  params: Params;
}) {
  const { token } = await params;
  const supabase = createServiceRoleClient();
  const { data: form } = await supabase
    .from("customer_forms")
    .select(
      "id, token, kind, status, title, intro_markdown, video_url, items, sent_at, completed_at, project:projects!inner(name, client:clients(name))",
    )
    .eq("token", token)
    .single();
  if (!form) notFound();

  const project = Array.isArray(form.project) ? form.project[0] : form.project;
  const client = project?.client
    ? Array.isArray(project.client)
      ? project.client[0]
      : project.client
    : null;

  const { data: businessProfile } = await supabase
    .from("business_profile")
    .select("company_name, phone, email")
    .limit(1)
    .maybeSingle();
  const brand = {
    name: (businessProfile?.company_name as string | null) ?? "Rose Concrete",
    phone: (businessProfile?.phone as string | null) ?? null,
    email: (businessProfile?.email as string | null) ?? null,
  };

  if (form.status === "completed") {
    return (
      <main className="min-h-screen bg-cream">
        <header className="bg-brand-600 px-4 pb-6 pt-8 text-white">
          <div className="mx-auto max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-100">
              {brand.name}
            </p>
            <h1 className="mt-2 text-2xl font-bold">
              Thanks — we have what we need.
            </h1>
            <p className="mt-1 text-sm text-brand-100">
              {project?.name ?? "Your project"}
            </p>
          </div>
        </header>
        <section className="mx-auto max-w-xl px-4 py-8">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900 shadow-sm">
            <p className="text-base font-semibold">✓ Submitted</p>
            <p className="mt-1">
              Your answers are on file. If anything changes just reply to
              Ronnie at{" "}
              {brand.phone ? (
                <a className="underline" href={`tel:${brand.phone}`}>
                  {brand.phone}
                </a>
              ) : (
                "the number on your quote"
              )}
              {brand.email ? (
                <>
                  {" "}
                  or{" "}
                  <a className="underline" href={`mailto:${brand.email}`}>
                    {brand.email}
                  </a>
                </>
              ) : null}
              .
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream pb-24 sm:pb-10">
      {/* Branded header — full-bleed so it reads on mobile. */}
      <header className="bg-brand-600 px-4 pb-6 pt-8 text-white">
        <div className="mx-auto max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-100">
            {brand.name}
          </p>
          <h1 className="mt-2 text-xl font-bold sm:text-2xl">
            {form.title}
          </h1>
          {project?.name && (
            <p className="mt-1 text-sm text-brand-100">
              {project.name}
              {client?.name ? ` · ${client.name}` : ""}
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-xl space-y-5 px-4 pt-6">
        {form.video_url && (
          <section className="overflow-hidden rounded-xl border border-neutral-200 bg-black shadow-sm">
            <VideoPlayer url={form.video_url as string} />
          </section>
        )}

        {form.intro_markdown && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
            {form.intro_markdown}
          </p>
        )}

        <FormRenderer
          token={form.token as string}
          items={(form.items ?? []) as FormItem[]}
          initialSignerName={(client?.name as string | null) ?? ""}
        />

        <footer className="pt-8 text-center text-[11px] text-neutral-500">
          {brand.name} · Licensed &amp; insured · San Diego County
          {brand.phone && (
            <>
              {" · "}
              <a className="underline" href={`tel:${brand.phone}`}>
                {brand.phone}
              </a>
            </>
          )}
        </footer>
      </div>
    </main>
  );
}

/** YouTube / Vimeo / direct MP4 auto-detect. */
function VideoPlayer({ url }: { url: string }) {
  const yt = parseYoutubeId(url);
  if (yt) {
    return (
      <div className="aspect-video w-full">
        <iframe
          src={`https://www.youtube.com/embed/${yt}?rel=0&playsinline=1`}
          title="Welcome video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    );
  }
  const vimeo = parseVimeoId(url);
  if (vimeo) {
    return (
      <div className="aspect-video w-full">
        <iframe
          src={`https://player.vimeo.com/video/${vimeo}?playsinline=1`}
          title="Welcome video"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    );
  }
  return (
    <video
      controls
      preload="metadata"
      src={url}
      playsInline
      className="aspect-video w-full bg-black"
    />
  );
}

function parseYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const m = u.pathname.match(/\/embed\/([^/?]+)/);
      if (m) return m[1];
    }
  } catch {
    // not a URL — fall through
  }
  return null;
}

function parseVimeoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("vimeo.com")) return null;
    const m = u.pathname.match(/\/(\d{6,})/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}
