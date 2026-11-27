import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { portalPath } from "../lib/dalia-portal.mjs";

const contentTypes = new Map([
  ["index.html", "text/html; charset=utf-8"],
  ["portal.css", "text/css; charset=utf-8"],
  ["portal.mjs", "application/javascript; charset=utf-8"],
]);

export default async function handleDaliaPortal(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  const path = portalPath(req.query.slug);
  const file = req.query.asset ?? "index.html";
  const contentType = contentTypes.get(file);
  if (!path || !contentType) return res.status(404).send("Not Found");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).send("Method Not Allowed");
  }

  res.setHeader("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'");
  try {
    let body = await readFile(join(process.cwd(), "portal", file), "utf8");
    if (file === "index.html") {
      body = body.replace("<head>", `<head>\n  <base href="${path}/">\n  <meta name="referrer" content="no-referrer">`);
    }
    res.setHeader("Content-Type", contentType);
    if (req.method === "HEAD") return res.status(200).end();
    return res.status(200).send(body);
  } catch {
    return res.status(503).send("Unavailable");
  }
}
