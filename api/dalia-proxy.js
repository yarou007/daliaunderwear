const routePattern = /^(?:login|logout|orders(?:\/[0-9a-f-]{36}(?:\/addon)?)?)$/;
const maxBodyBytes = 8192;
const cookieName = "__Secure-dalia_session";
const tokenPattern = /^[\w-]+(?:\.[\w-]+){2}$/;

function sessionCookie(token, seconds) {
  return `${cookieName}=${token}; Path=/api/dalia; Max-Age=${seconds}; Secure; HttpOnly; SameSite=Strict`;
}

export default async function handleDaliaProxy(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const route = req.query.route;
  if (typeof route !== "string" || !routePattern.test(route)) {
    return res.status(404).json({ code: "NOT_FOUND" });
  }

  const method = req.method;
  const expectedMethods = route === "orders"
    ? ["GET", "POST"]
    : route.startsWith("orders/") && !route.endsWith("/addon") ? ["PATCH"] : ["POST"];
  if (!expectedMethods.includes(method)) {
    res.setHeader("Allow", expectedMethods.join(", "));
    return res.status(405).json({ code: "METHOD_NOT_ALLOWED" });
  }
  if (req.headers["sec-fetch-site"] === "cross-site"
    || (req.headers.origin && req.headers.origin !== `https://${req.headers.host}`)) {
    return res.status(403).json({ code: "FORBIDDEN" });
  }
  if (route === "logout") {
    res.setHeader("Set-Cookie", sessionCookie("", 0));
    return res.status(200).json({ ok: true });
  }

  const endpoint = process.env.DALIA_SUPABASE_EDGE_URL;
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/functions\/v1\/dalia-api$/.test(endpoint ?? "")) {
    return res.status(503).json({ code: "UNAVAILABLE" });
  }

  let body;
  const headers = new Headers({ Accept: "application/json" });
  if (method !== "GET") {
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] ?? "")) {
      return res.status(415).json({ code: "INVALID_REQUEST" });
    }
    body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (!body || Buffer.byteLength(body) > maxBodyBytes) {
      return res.status(body ? 413 : 400).json({ code: "INVALID_REQUEST" });
    }
    headers.set("Content-Type", "application/json");
  }

  if (route !== "login" && typeof req.headers.cookie === "string") {
    const token = req.headers.cookie.split(/;\s*/)
      .find(cookie => cookie.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (tokenPattern.test(token ?? "")) headers.set("X-Dalia-Session", token);
  }

  const url = new URL(`${endpoint}/${route}`);
  if (method === "GET") {
    for (const key of ["status", "limit", "offset"]) {
      if (typeof req.query[key] === "string") url.searchParams.set(key, req.query[key]);
    }
  }

  try {
    const upstream = await fetch(url, {
      method, headers, body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (upstream.headers.get("X-Dalia-Api") !== "1") throw new Error("Unrecognized response");
    const response = await upstream.json();
    if (route === "login" && upstream.ok) {
      const token = upstream.headers.get("X-Dalia-Session");
      const seconds = Number(upstream.headers.get("X-Dalia-Session-Max-Age"));
      if (!tokenPattern.test(token ?? "") || !Number.isInteger(seconds) || seconds < 1 || seconds > 3600) {
        throw new Error("Missing upstream session");
      }
      res.setHeader("Set-Cookie", sessionCookie(token, seconds));
    }
    if (upstream.status === 429) res.setHeader("Retry-After", "30");
    return res.status(upstream.status).json(response);
  } catch {
    return res.status(503).json({ code: "UNAVAILABLE" });
  }
}
