// HTTP helpers of the account routes (plan 04-01; 04-RESEARCH « Anti-Patterns », Pitfall 5, T-04-20).
//   json(body, status, headers?)  a JSON answer that no cache keeps (cache-control: no-store)
//   readJson(request, schema)     the body of a POST: application/json only (415), at most
//                                 MAX_API_BODY bytes (413), valid JSON and the schema's shape (400)
//   writeAllowed(request, url)    the Origin header is present and is the Worker's own origin
// A cookie-authenticated write needs both: a cross-site form cannot send JSON, a cross-site fetch of
// JSON needs a CORS preflight the Worker never grants, and a null Origin (a sandboxed frame, a
// redirect) is refused, unlike the anonymous POST /api/tables (index.ts sameOrigin).

import { MAX_API_BODY, toBase64Url } from "@toc/protocol";

export function json(body: unknown, status: number, headers?: HeadersInit): Response {
  const all = new Headers(headers);
  all.set("cache-control", "no-store");
  return Response.json(body, { status, headers: all });
}

/** A strict schema of @toc/protocol (zod/mini): what readJson checks the body against. */
type Schema<T> = { safeParse(data: unknown): { success: true; data: T } | { success: false } };

export type ReadResult<T> = { ok: true; body: T } | { ok: false; response: Response };

export async function readJson<T>(
  request: Request,
  schema: Schema<T>,
  max = MAX_API_BODY,
): Promise<ReadResult<T>> {
  const type = (request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase();
  if (type !== "application/json") {
    return { ok: false, response: json({ error: "content-type" }, 415) };
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > max) return { ok: false, response: json({ error: "body" }, 413) };
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > max) return { ok: false, response: json({ error: "body" }, 413) };
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { ok: false, response: json({ error: "body" }, 400) };
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) return { ok: false, response: json({ error: "body" }, 400) };
  return { ok: true, body: parsed.data };
}

/** The request comes from a page of this Worker's own origin (T-04-20); a null Origin is refused. */
export function writeAllowed(request: Request, url: URL): boolean {
  return request.headers.get("Origin") === url.origin;
}

/** 405 with the allowed method. */
export const notAllowed = (allow: string) =>
  new Response(null, { status: 405, headers: { allow, "cache-control": "no-store" } });

/** base64url SHA-256 of a text: invitation codes and session tokens are stored this way only. */
export async function sha256Url(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return toBase64Url(new Uint8Array(digest));
}

/** Random bytes as base64url (ids, tokens, codes). */
export function randomUrl(length: number): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(length)));
}
