// AWS Signature V4 for S3 — WebCrypto only, no dependencies.
// Shared by the page and the Node test harness (test/s3.test.mjs).

const encoder = new TextEncoder();
export const UNSIGNED = "UNSIGNED-PAYLOAD";

export async function sha256Hex(data) {
  const buf = typeof data === "string" ? encoder.encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, typeof data === "string" ? encoder.encode(data) : data));
}

// RFC 3986 percent-encoding; '/' kept when encodeSlash is false (path segments).
export function uriEncode(str, encodeSlash = true) {
  let out = "";
  for (const ch of str) {
    if (/[A-Za-z0-9\-._~]/.test(ch)) out += ch;
    else if (ch === "/") out += encodeSlash ? "%2F" : "/";
    else out += [...encoder.encode(ch)].map(b => "%" + b.toString(16).toUpperCase().padStart(2, "0")).join("");
  }
  return out;
}

export function amzDate(d = new Date()) {
  const s = d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return { full: s, short: s.slice(0, 8) };
}

export async function signingKey(cfg, short) {
  let key = encoder.encode("AWS4" + cfg.secretKey);
  for (const part of [short, cfg.region, "s3", "aws4_request"]) key = await hmac(key, part);
  return key;
}

/** Build a signed request: { url, headers }. path must start with '/'. */
export async function signRequest(cfg, method, path, query = [], body = null, extraHeaders = {}) {
  const host = new URL(cfg.endpoint).host;
  const { full, short } = amzDate();
  const payloadHash = body ? await sha256Hex(body) : UNSIGNED;

  const sortedQuery = [...query]
    .map(([k, v]) => [uriEncode(k), uriEncode(String(v))])
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1));
  const canonicalQuery = sortedQuery.map(([k, v]) => `${k}=${v}`).join("&");

  const raw = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": full, ...extraHeaders };
  const headerNames = Object.keys(raw).map(h => h.toLowerCase()).sort();
  const byLower = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), v]));
  const canonicalHeaders = headerNames.map(h => `${h}:${String(byLower[h]).trim()}\n`).join("");
  const signedHeaders = headerNames.join(";");

  const canonicalRequest = [
    method, uriEncode(path, false), canonicalQuery, canonicalHeaders, signedHeaders, payloadHash,
  ].join("\n");

  const scope = `${short}/${cfg.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", full, scope, await sha256Hex(canonicalRequest)].join("\n");
  const key = await signingKey(cfg, short);
  const signature = [...await hmac(key, stringToSign)].map(b => b.toString(16).padStart(2, "0")).join("");

  return {
    url: `${cfg.endpoint.replace(/\/+$/, "")}${uriEncode(path, false)}${canonicalQuery ? "?" + canonicalQuery : ""}`,
    headers: {
      ...raw,
      Authorization: `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, `
        + `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

/** Presigned GET URL (browser/player can fetch it directly). */
export async function presignGet(cfg, key, seconds = 3600) {
  const { full, short } = amzDate();
  const scope = `${short}/${cfg.region}/s3/aws4_request`;
  const query = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${cfg.accessKey}/${scope}`],
    ["X-Amz-Date", full],
    ["X-Amz-Expires", String(seconds)],
    ["X-Amz-SignedHeaders", "host"],
  ].map(([k, v]) => [uriEncode(k), uriEncode(v)])
   .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
   .map(([k, v]) => `${k}=${v}`).join("&");

  const path = "/" + [cfg.bucket, key].filter(Boolean).join("/");
  const host = new URL(cfg.endpoint).host;
  const canonicalRequest = ["GET", uriEncode(path, false), query, `host:${host}\n`, "host", UNSIGNED].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", full, scope, await sha256Hex(canonicalRequest)].join("\n");
  const keyBytes = await signingKey(cfg, short);
  const sig = [...await hmac(keyBytes, stringToSign)].map(b => b.toString(16).padStart(2, "0")).join("");
  return `${cfg.endpoint.replace(/\/+$/, "")}${uriEncode(path, false)}?${query}&X-Amz-Signature=${sig}`;
}

/** One S3 call; throws Error("<Code> · <Message>") on failure. */
export async function s3(cfg, method, keyPath, { query = [], body = null, headers = {}, fetchImpl = fetch } = {}) {
  const path = "/" + [cfg.bucket, keyPath].filter(Boolean).join("/");
  const signed = await signRequest(cfg, method, path, query, body, headers);
  const res = await fetchImpl(signed.url, { method, headers: signed.headers, body });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const code = (text.match(/<Code>([^<]+)<\/Code>/) || [])[1] || `HTTP ${res.status}`;
    const msg = (text.match(/<Message>([^<]+)<\/Message>/) || [])[1] || "";
    throw new Error(`${code}${msg ? " · " + msg : ""}`);
  }
  return res;
}
