/**
 * Gmail adapter — REST-based, powered by a long-lived OAuth refresh
 * token. Previously a stub; now a working adapter when the three
 * env vars are set:
 *
 *   GMAIL_CLIENT_ID        — OAuth client ID (Google Cloud project)
 *   GMAIL_CLIENT_SECRET    — paired client secret
 *   GMAIL_REFRESH_TOKEN    — user-granted refresh token for the
 *                            watched mailbox (typically ronnie@)
 *
 * Flow:
 *   1. POST /token with grant_type=refresh_token → access_token
 *      (cached for ~55 min; Gmail access tokens expire in 1h).
 *   2. GET /users/me/messages?q=after:<unix> → list of message ids.
 *   3. GET /users/me/messages/<id>?format=full → full message
 *      (headers + parts). Parse `From`, `Subject`, `Date`, snippet,
 *      and recursively walk parts to extract attachments.
 *   4. GET /users/me/messages/<id>/attachments/<aid> → base64url
 *      bytes for a specific attachment.
 *
 * When any of the three env vars is missing, `getGmailAdapter()`
 * returns the stub so the app keeps running without Gmail wired
 * (the auto-attach cron just sees `listRecent=[]`).
 *
 * We don't store credentials in the DB yet — env-var only — because
 * Rose is single-tenant (one Gmail account to watch). If we add
 * multi-tenant later, move these to a `gmail_credentials` table with
 * per-user rows and refresh tokens.
 */
export type GmailMessageRef = {
  id: string;
  thread_id: string;
  subject: string;
  from: string;
  received_at: string;   // ISO
  snippet: string;
  has_attachments: boolean;
  attachments: GmailAttachment[];
};

export type GmailAttachment = {
  attachment_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
};

export type GmailAdapter = {
  /** Return messages received after `since`, newest first, up to `limit`. */
  listRecent(
    since: Date,
    limit: number
  ): Promise<GmailMessageRef[]>;
  /** Download one attachment's bytes. */
  getAttachmentBytes(
    messageId: string,
    attachmentId: string
  ): Promise<{ bytes: Uint8Array } | null>;
  /** Whether the adapter has credentials. UI branches on this for the
   *  Settings → Gmail auto-forward page to show "not configured". */
  isConfigured(): boolean;
};

export function createStubGmailAdapter(): GmailAdapter {
  return {
    async listRecent() {
      return [];
    },
    async getAttachmentBytes() {
      return null;
    },
    isConfigured() {
      return false;
    },
  };
}

// ───── Real OAuth-backed REST adapter ─────

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";

type TokenCache = { token: string; expiresAt: number };
let accessTokenCache: TokenCache | null = null;

async function accessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  if (accessTokenCache && Date.now() < accessTokenCache.expiresAt) {
    return accessTokenCache.token;
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Gmail OAuth refresh failed ${res.status}: ${body.slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  // Buffer 5 min so we don't race the expiry.
  accessTokenCache = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 300) * 1000,
  };
  return json.access_token;
}

async function gmailFetch<T>(
  path: string,
  accessTok: string,
): Promise<T> {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessTok}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Gmail ${res.status} ${res.statusText} on ${path}: ${body.slice(0, 200)}`,
    );
  }
  return (await res.json()) as T;
}

type GmailListResp = {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
};

type GmailMessagePart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { size?: number; attachmentId?: string; data?: string };
  parts?: GmailMessagePart[];
};

type GmailFullMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
};

function headerOf(parts: GmailMessagePart | undefined, name: string): string {
  const h = parts?.headers?.find(
    (x) => x.name.toLowerCase() === name.toLowerCase(),
  );
  return h?.value ?? "";
}

function walkAttachments(
  part: GmailMessagePart | undefined,
): GmailAttachment[] {
  if (!part) return [];
  const out: GmailAttachment[] = [];
  const visit = (p: GmailMessagePart) => {
    if (p.body?.attachmentId && p.filename) {
      out.push({
        attachment_id: p.body.attachmentId,
        filename: p.filename,
        mime_type: p.mimeType ?? "application/octet-stream",
        size_bytes: p.body.size ?? 0,
      });
    }
    for (const child of p.parts ?? []) visit(child);
  };
  visit(part);
  return out;
}

/** base64url → Uint8Array. Node's Buffer handles base64url natively
 *  but we stay runtime-agnostic here since the adapter is also
 *  imported from edge-style routes. */
function base64UrlDecode(s: string): Uint8Array {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4 === 0 ? "" : "=".repeat(4 - (norm.length % 4));
  const bin = atob(norm + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function createRealGmailAdapter(creds: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): GmailAdapter {
  const tok = () =>
    accessToken(creds.clientId, creds.clientSecret, creds.refreshToken);

  return {
    isConfigured: () => true,
    async listRecent(since, limit) {
      const token = await tok();
      const afterUnix = Math.floor(since.getTime() / 1000);
      // `q` is Gmail's search language. `after:` is seconds-since-epoch.
      // `in:inbox` restricts to the primary inbox (skip Sent/Spam/Trash).
      const q = encodeURIComponent(`after:${afterUnix} in:inbox`);
      const list = await gmailFetch<GmailListResp>(
        `/users/me/messages?q=${q}&maxResults=${Math.min(limit, 100)}`,
        token,
      );
      const ids = (list.messages ?? []).map((m) => m.id);
      if (ids.length === 0) return [];

      // Gmail's batch API is painful via REST; fan out with Promise.all.
      const full = await Promise.all(
        ids.map((id) =>
          gmailFetch<GmailFullMessage>(
            `/users/me/messages/${id}?format=full`,
            token,
          ).catch(() => null),
        ),
      );

      const refs: GmailMessageRef[] = [];
      for (const msg of full) {
        if (!msg) continue;
        const attachments = walkAttachments(msg.payload);
        const internal = msg.internalDate
          ? new Date(Number(msg.internalDate))
          : new Date();
        refs.push({
          id: msg.id,
          thread_id: msg.threadId,
          subject: headerOf(msg.payload, "Subject"),
          from: headerOf(msg.payload, "From"),
          received_at: internal.toISOString(),
          snippet: msg.snippet ?? "",
          has_attachments: attachments.length > 0,
          attachments,
        });
      }
      return refs;
    },
    async getAttachmentBytes(messageId, attachmentId) {
      try {
        const token = await tok();
        const resp = await gmailFetch<{ data?: string; size?: number }>(
          `/users/me/messages/${messageId}/attachments/${attachmentId}`,
          token,
        );
        if (!resp.data) return null;
        return { bytes: base64UrlDecode(resp.data) };
      } catch (err) {
        console.warn("[gmail] attachment fetch failed", err);
        return null;
      }
    },
  };
}

export function getGmailAdapter(): GmailAdapter {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (clientId && clientSecret && refreshToken) {
    return createRealGmailAdapter({ clientId, clientSecret, refreshToken });
  }
  return createStubGmailAdapter();
}
