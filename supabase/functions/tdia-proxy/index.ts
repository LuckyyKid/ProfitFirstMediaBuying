// TDIA Backend Proxy
// Forwards requests to https://api.tdiaconnect.ca with a server-side bearer token.
// Supports JSON requests and Server-Sent Events streaming.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const BASE = Deno.env.get("TDIA_API_BASE_URL") ?? "https://api.tdiaconnect.ca";
const TOKEN = Deno.env.get("TDIA_API_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  // Accept the upstream path either as ?path=/api/... or as everything after /tdia-proxy/
  let path = url.searchParams.get("path") ?? "";
  if (!path) {
    const idx = url.pathname.indexOf("/tdia-proxy");
    if (idx !== -1) path = url.pathname.slice(idx + "/tdia-proxy".length);
  }
  if (!path.startsWith("/")) path = "/" + path;

  if (path === "/" || path === "") {
    return new Response(
      JSON.stringify({ error: "Missing path", hint: "Use ?path=/api/v1/health" }),
      { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  // Forward any extra query params (e.g. last_event_id) — but drop our own `path`.
  const forwardParams = new URLSearchParams(url.search);
  forwardParams.delete("path");
  const qs = forwardParams.toString();
  const upstreamUrl = `${BASE}${path}${qs ? `?${qs}` : ""}`;

  if (!TOKEN) {
    return new Response(
      JSON.stringify({ error: "TDIA_API_TOKEN not configured" }),
      { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: req.headers.get("accept") ?? "application/json",
  };
  const ct = req.headers.get("content-type");
  if (ct) headers["content-type"] = ct;

  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Upstream fetch failed", detail: String(err) }),
      { status: 502, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }

  const respHeaders: Record<string, string> = { ...corsHeaders };
  const upstreamCT = upstream.headers.get("content-type") ?? "application/octet-stream";
  respHeaders["content-type"] = upstreamCT;

  // Upstream 5xx HTML/proxy failures should be passed through as plain text, not streamed,
  // so the function always fully consumes the body and avoids edge runtime body read errors.
  if (upstream.status >= 500) {
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers: respHeaders });
  }

  // Preserve a few useful headers when present.
  for (const h of ["content-disposition", "cache-control", "etag", "last-modified"]) {
    const v = upstream.headers.get(h);
    if (v) respHeaders[h] = v;
  }

  // Stream SSE and binary (PDF) responses directly.
  if (upstreamCT.includes("text/event-stream") || upstreamCT.includes("application/pdf") || upstreamCT.startsWith("image/")) {
    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
  }

  const buf = await upstream.arrayBuffer();
  return new Response(buf, { status: upstream.status, headers: respHeaders });
});
