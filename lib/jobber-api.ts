/**
 * Jobber GraphQL API client — one-shot import of notes + note attachments.
 *
 * Endpoint: https://api.getjobber.com/api/graphql
 * Auth:     Bearer <ACCESS_TOKEN>  (60-min expiry, Ronnie pastes at import time)
 * Version:  X-JOBBER-GRAPHQL-VERSION header REQUIRED on every request
 *
 * Why this lives in its own module:
 *   * Keeps the "which fields exist on a ClientNote" detail in one place.
 *     Jobber's schema evolves, so if Ronnie's API version returns slightly
 *     different shapes, we adapt here rather than chasing refs across
 *     actions.ts.
 *   * Exposes only the two high-level operations the importer needs —
 *     `fetchClientsPage()` and `downloadAttachment()` — so the server
 *     action stays small and readable.
 */

const JOBBER_GRAPHQL_URL = "https://api.getjobber.com/api/graphql";
const JOBBER_AUTHORIZE_URL = "https://api.getjobber.com/api/oauth/authorize";
const JOBBER_TOKEN_URL = "https://api.getjobber.com/api/oauth/token";
// Supported for ~18 months from release; bump when we see deprecation warnings
// in the response's `warnings` field. Pinned explicitly so schema drift doesn't
// silently break us.
const JOBBER_API_VERSION = "2024-05-08";

// ---------- OAuth 2.0 helpers ----------

export type JobberTokenBundle = {
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO timestamp
};

/**
 * Build the URL Ronnie's browser redirects to so Jobber can prompt him
 * to authorize our app. The `state` is a one-time CSRF token we'll match
 * on the callback.
 */
export function buildJobberAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const sp = new URLSearchParams({
    client_id: params.clientId,
    response_type: "code",
    redirect_uri: params.redirectUri,
    state: params.state,
  });
  return `${JOBBER_AUTHORIZE_URL}?${sp.toString()}`;
}

/**
 * Exchange the `code` Jobber returned on the OAuth callback for an
 * access_token + refresh_token pair. Uses form-encoded body per the
 * OAuth spec (Jobber's /api/oauth/token accepts this; only /api/graphql
 * is locked to application/json).
 */
export async function exchangeJobberCode(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<
  | { ok: true; tokens: JobberTokenBundle }
  | { ok: false; error: string }
> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
  });
  let res: Response;
  try {
    res = await fetch(JOBBER_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Token exchange network error",
    };
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Jobber token endpoint ${res.status}: ${errBody.slice(0, 300)}`,
    };
  }
  const json = (await res.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } | null;
  if (!json?.access_token || !json.refresh_token) {
    return {
      ok: false,
      error: "Jobber token response missing access_token or refresh_token.",
    };
  }
  const expiresInSec = json.expires_in ?? 3600;
  return {
    ok: true,
    tokens: {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(),
    },
  };
}

/**
 * Spend a refresh_token for a fresh access_token. Called by the import
 * runner when the stored access_token is within a minute of expiring.
 * Jobber rotates the refresh_token on every exchange, so the caller
 * must persist whatever comes back.
 */
export async function refreshJobberTokens(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<
  | { ok: true; tokens: JobberTokenBundle }
  | { ok: false; error: string }
> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
  });
  let res: Response;
  try {
    res = await fetch(JOBBER_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Token refresh network error",
    };
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Jobber refresh ${res.status}: ${errBody.slice(0, 300)}`,
    };
  }
  const json = (await res.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  } | null;
  if (!json?.access_token || !json.refresh_token) {
    return { ok: false, error: "Jobber refresh response missing tokens." };
  }
  const expiresInSec = json.expires_in ?? 3600;
  return {
    ok: true,
    tokens: {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(),
    },
  };
}

export type JobberClientPage = {
  clients: JobberClient[];
  nextCursor: string | null;
  hasNextPage: boolean;
};

export type JobberClient = {
  id: string; // Jobber node id
  name: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  emails: string[];
  phones: string[];
  notes: JobberClientNote[];
  noteAttachments: JobberAttachment[];
};

export type JobberClientNote = {
  id: string;
  message: string;
  createdAt: string;
  author: string | null;
};

export type JobberAttachment = {
  id: string;
  fileName: string;
  contentType: string;
  url: string;
  sizeBytes: number | null;
  createdAt: string;
};

export type JobberFetchError = {
  ok: false;
  status: number;
  error: string;
};

// ---------- low-level GraphQL ----------

type GraphQLError = { message: string; path?: string[] };

async function jobberGraphQL<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>
): Promise<{ ok: true; data: T } | JobberFetchError> {
  let res: Response;
  try {
    res = await fetch(JOBBER_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-JOBBER-GRAPHQL-VERSION": JOBBER_API_VERSION,
      },
      body: JSON.stringify({ query, variables }),
      // Jobber rate-limits; never let Next cache.
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Network failure",
    };
  }

  if (res.status === 401) {
    return {
      ok: false,
      status: 401,
      error:
        "Jobber rejected the token (401). Access tokens expire after ~60 minutes — regenerate from the Developer Center and paste again.",
    };
  }
  if (res.status === 403) {
    return {
      ok: false,
      status: 403,
      error: "Jobber rejected the token (403). Check that the app has the right scopes.",
    };
  }
  if (res.status === 429) {
    return {
      ok: false,
      status: 429,
      error: "Jobber rate limit hit (429). Wait a minute and click Resume.",
    };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: `Jobber ${res.status}: ${body.slice(0, 300)}`,
    };
  }

  const json = (await res.json().catch(() => null)) as
    | { data?: T; errors?: GraphQLError[] }
    | null;
  if (!json) {
    return { ok: false, status: res.status, error: "Jobber response was not JSON." };
  }
  if (json.errors && json.errors.length > 0) {
    return {
      ok: false,
      status: res.status,
      error: `GraphQL: ${json.errors.map((e) => e.message).join("; ")}`,
    };
  }
  if (!json.data) {
    return { ok: false, status: res.status, error: "Jobber returned no data." };
  }
  return { ok: true, data: json.data };
}

// ---------- validate token ----------

/**
 * Cheap whoami-ish call. Returns a short descriptor on success, or an
 * error result the UI can display verbatim.
 */
export async function validateJobberToken(
  token: string
): Promise<
  | { ok: true; account: { id: string; name: string | null } }
  | JobberFetchError
> {
  const q = `
    query ValidateToken {
      account {
        id
        name
      }
    }
  `;
  const res = await jobberGraphQL<{ account: { id: string; name: string | null } }>(
    token,
    q,
    {}
  );
  if (!res.ok) return res;
  return { ok: true, account: res.data.account };
}

// ---------- fetch one page of clients + their notes + attachments ----------

/**
 * Pulls up to `pageSize` clients with their last 50 notes and
 * noteAttachments each. Pagination is cursor-based on `clients.edges`.
 *
 * Returned `nextCursor` is the `endCursor` from the clients connection.
 * Hand it back in on the next call. `null` / `hasNextPage=false` means
 * we've seen every client.
 *
 * NOTE ON SCHEMA: Jobber's schema evolves; field names may drift across
 * API versions. Exceptions are caught at the GraphQL layer and surfaced
 * to the importer so Ronnie sees the message rather than a crash.
 */
export async function fetchClientsPage(
  token: string,
  cursor: string | null,
  pageSize: number
): Promise<
  | { ok: true; page: JobberClientPage }
  | JobberFetchError
> {
  const q = `
    query ClientsWithNotes($first: Int!, $after: String) {
      clients(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            name
            companyName
            firstName
            lastName
            emails { description address }
            phoneNumbers { description number }
            notes(first: 50) {
              edges {
                node {
                  id
                  message
                  createdAt
                  lastEditedBy { name { full } }
                }
              }
            }
            noteAttachments(first: 50) {
              edges {
                node {
                  id
                  fileName
                  contentType
                  url
                  fileSize
                  createdAt
                }
              }
            }
          }
        }
      }
    }
  `;

  type Raw = {
    clients: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: Array<{
        node: {
          id: string;
          name: string;
          companyName: string | null;
          firstName: string | null;
          lastName: string | null;
          emails: Array<{ description: string | null; address: string }> | null;
          phoneNumbers: Array<{
            description: string | null;
            number: string;
          }> | null;
          notes: {
            edges: Array<{
              node: {
                id: string;
                message: string;
                createdAt: string;
                lastEditedBy: { name: { full: string | null } | null } | null;
              };
            }>;
          } | null;
          noteAttachments: {
            edges: Array<{
              node: {
                id: string;
                fileName: string;
                contentType: string | null;
                url: string;
                fileSize: number | null;
                createdAt: string;
              };
            }>;
          } | null;
        };
      }>;
    };
  };

  const res = await jobberGraphQL<Raw>(token, q, {
    first: pageSize,
    after: cursor,
  });
  if (!res.ok) return res;

  const clients: JobberClient[] = res.data.clients.edges.map((edge) => {
    const n = edge.node;
    return {
      id: n.id,
      name: n.name,
      companyName: n.companyName,
      firstName: n.firstName,
      lastName: n.lastName,
      emails: (n.emails ?? []).map((e) => e.address).filter(Boolean),
      phones: (n.phoneNumbers ?? []).map((p) => p.number).filter(Boolean),
      notes: (n.notes?.edges ?? []).map((e) => ({
        id: e.node.id,
        message: e.node.message,
        createdAt: e.node.createdAt,
        author: e.node.lastEditedBy?.name?.full ?? null,
      })),
      noteAttachments: (n.noteAttachments?.edges ?? []).map((e) => ({
        id: e.node.id,
        fileName: e.node.fileName,
        contentType: e.node.contentType ?? "application/octet-stream",
        url: e.node.url,
        sizeBytes: e.node.fileSize,
        createdAt: e.node.createdAt,
      })),
    };
  });

  return {
    ok: true,
    page: {
      clients,
      hasNextPage: res.data.clients.pageInfo.hasNextPage,
      nextCursor: res.data.clients.pageInfo.endCursor,
    },
  };
}

// ---------- attachment download ----------

/**
 * Download the blob behind `url`. Jobber's noteAttachments.url returns a
 * pre-signed S3 link so no auth header is needed (Authorization header
 * against that URL actually breaks the request). Returns bytes + the
 * content-type the server reported. Caller owns the Storage upload.
 *
 * Files over `maxBytes` are skipped with an error — don't want a 500MB
 * attachment blowing the Vercel function memory.
 */
export async function downloadAttachment(
  url: string,
  maxBytes: number
): Promise<
  | { ok: true; bytes: Uint8Array; contentType: string | null }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return {
        ok: false,
        error: `Download ${res.status} ${res.statusText}`,
      };
    }
    const lenHeader = res.headers.get("content-length");
    if (lenHeader) {
      const len = Number(lenHeader);
      if (Number.isFinite(len) && len > maxBytes) {
        return {
          ok: false,
          error: `File too large (${len} bytes, max ${maxBytes}).`,
        };
      }
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) {
      return {
        ok: false,
        error: `File too large (${buf.byteLength} bytes, max ${maxBytes}).`,
      };
    }
    return {
      ok: true,
      bytes: new Uint8Array(buf),
      contentType: res.headers.get("content-type"),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Download failed.",
    };
  }
}
