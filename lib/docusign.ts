import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Auto-send the DocuSign envelope for an accepted quote.
 *
 * This is gated three ways and will silently no-op if anything is missing:
 *   1. The `docusign_auto_send` feature flag must be on.
 *   2. DOCUSIGN_TEMPLATE_ID must be set (Ronnie's contract template).
 *   3. DOCUSIGN_ACCESS_TOKEN + DOCUSIGN_ACCOUNT_ID + DOCUSIGN_BASE_URL must be set.
 *      For the JWT-based long-lived flow, generate a token outside the app
 *      (e.g. via the DocuSign MCP or a small cron) and stash it in the env.
 *
 * Phase 0 dependencies that block this from working:
 *   - DocuSign MCP beta access for Ronnie's account
 *   - Confirmed templateId via getTemplates
 *   - Field-tab mapping confirmed (textTabs labels match what we send below)
 */
export async function maybeSendDocusignEnvelopeForQuote(
  quoteId: string
): Promise<{ sent: boolean; reason?: string }> {
  const supabase = createServiceRoleClient();

  // 1. Feature flag check.
  const { data: flag } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", "docusign_auto_send")
    .maybeSingle();
  if (!flag?.enabled) return { sent: false, reason: "feature_flag_off" };

  const templateId = process.env.DOCUSIGN_TEMPLATE_ID;
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
  const accessToken = process.env.DOCUSIGN_ACCESS_TOKEN;
  const baseUrl = process.env.DOCUSIGN_BASE_URL; // e.g. https://demo.docusign.net/restapi
  if (!templateId || !accountId || !accessToken || !baseUrl) {
    await supabase
      .from("quotes")
      .update({ docusign_status: "not_sent" })
      .eq("id", quoteId);
    return { sent: false, reason: "missing_env" };
  }

  // 2. Pull the quote + client + accepted total.
  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, number, accepted_total, deposit_amount, deposit_percent, deposit_nonrefundable, warranty_months, balance_terms, scope_markdown, accepted_by_name, project:projects(name, client:clients(name, email))"
    )
    .eq("id", quoteId)
    .single();
  if (!quote) return { sent: false, reason: "quote_not_found" };

  const project = Array.isArray(quote.project) ? quote.project[0] : quote.project;
  const client =
    project && (Array.isArray(project.client) ? project.client[0] : project.client);
  if (!client?.email) {
    return { sent: false, reason: "client_email_missing" };
  }

  const acceptedTotal = Number(quote.accepted_total ?? 0);
  const depositAmount =
    quote.deposit_amount != null
      ? Number(quote.deposit_amount)
      : Math.round(acceptedTotal * (Number(quote.deposit_percent ?? 50) / 100) * 100) /
        100;

  // 3. Build envelope definition. Field labels here MUST match the textTabs
  //    defined on Ronnie's template — confirm during Phase 0 wiring.
  const envelopeDefinition = {
    status: "sent",
    emailSubject: `Rose Concrete contract — ${project?.name ?? quote.number}`,
    templateId,
    templateRoles: [
      {
        roleName: "Client",
        name: client.name,
        email: client.email,
        tabs: {
          textTabs: [
            { tabLabel: "ProjectName", value: project?.name ?? "" },
            { tabLabel: "AcceptedTotal", value: acceptedTotal.toFixed(2) },
            { tabLabel: "DepositAmount", value: depositAmount.toFixed(2) },
            {
              tabLabel: "DepositNonrefundable",
              value: quote.deposit_nonrefundable ? "Yes" : "No",
            },
            {
              tabLabel: "WarrantyMonths",
              value: String(quote.warranty_months ?? 36),
            },
            {
              tabLabel: "BalanceTerms",
              value: quote.balance_terms ?? "Balance due upon completion.",
            },
            { tabLabel: "ScopeOfWork", value: quote.scope_markdown ?? "" },
          ],
        },
      },
    ],
  };

  // 4. Post to DocuSign.
  const url = `${baseUrl.replace(/\/$/, "")}/v2.1/accounts/${accountId}/envelopes`;
  let envelopeId: string | null = null;
  let docusignStatus: "sent" | "error" = "error";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(envelopeDefinition),
    });
    if (res.ok) {
      const json = (await res.json()) as { envelopeId?: string };
      envelopeId = json.envelopeId ?? null;
      docusignStatus = "sent";
    } else {
      console.error(
        "[docusign] envelope create failed",
        res.status,
        await res.text()
      );
    }
  } catch (err) {
    console.error("[docusign] fetch error", err);
  }

  await supabase
    .from("quotes")
    .update({
      docusign_envelope_id: envelopeId,
      docusign_status: docusignStatus,
    })
    .eq("id", quoteId);

  return { sent: docusignStatus === "sent", reason: docusignStatus };
}
