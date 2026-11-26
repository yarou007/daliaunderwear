import { packById } from "../../../public/dalia-packs.mjs";
import { products, sizes } from "../../../public/dalia-catalog.mjs";

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const allowedStatuses = new Set(["pending", "confirmed", "unreachable", "cancelled"]);
const orderFields = "id,phone,base_pack,addon_pack,total,status,created_at,updated_at,confirmed_at";
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const publicKey = Deno.env.get("SUPABASE_ANON_KEY");
const colorOptions = {
  tops: new Set(products.filter(item => item.category === "camisoles").flatMap(item => item.colors.map(color => color.id))),
  briefs: new Set(products.filter(item => item.category === "briefs").flatMap(item => item.colors.map(color => color.id))),
};
const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Dalia-Api": "1",
};

class ApiError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { ...responseHeaders, ...headers } });
}

function invalid() {
  throw new ApiError(400, "INVALID_REQUEST");
}

function conflict() {
  throw new ApiError(409, "ORDER_CONFLICT");
}

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") ?? "")) invalid();
  const reader = request.body?.getReader();
  if (!reader) invalid();
  const decoder = new TextDecoder();
  let content = "";
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 8192) {
      await reader.cancel();
      throw new ApiError(413, "INVALID_REQUEST");
    }
    content += decoder.decode(value, { stream: true });
  }
  let payload;
  try {
    payload = JSON.parse(content + decoder.decode());
  } catch {
    invalid();
  }
  if (!object(payload)) invalid();
  return payload;
}

function supabaseFetch(path, key, { method = "GET", bearer = key, body, prefer } = {}) {
  if (!supabaseUrl || !key) throw new ApiError(503, "UNAVAILABLE");
  const headers = new Headers({ apikey: key, Authorization: `Bearer ${bearer}`, Accept: "application/json" });
  if (body) headers.set("Content-Type", "application/json");
  if (prefer) headers.set("Prefer", prefer);
  return fetch(new URL(path, supabaseUrl), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(7000),
  });
}

async function db(table, query, options) {
  const params = new URLSearchParams(query);
  const response = await supabaseFetch(`/rest/v1/${table}?${params}`, serviceKey, options);
  if (!response.ok) throw new ApiError(503, "UNAVAILABLE");
  return response.json();
}

function normalizedPack(selection) {
  if (!object(selection) || typeof selection.packId !== "string") invalid();
  const pack = packById(selection.packId);
  if (!pack) invalid();
  const { sizes: packSizes = {}, colors: packColors = {}, note = "" } = selection;
  if (!object(packSizes) || !object(packColors) || typeof note !== "string" || note.length > 240) invalid();

  const types = Object.keys(pack.contents).filter(type => pack.contents[type] > 0);
  if ([...Object.keys(packSizes), ...Object.keys(packColors)].some(type => !types.includes(type))) invalid();
  const checkedSizes = {};
  const checkedColors = {};
  for (const type of types) {
    const size = packSizes[type];
    if (size !== undefined && size !== "") {
      if (!sizes.includes(size)) invalid();
      checkedSizes[type] = size;
    }
    const colors = packColors[type] ?? [];
    if (!Array.isArray(colors) || colors.length > colorOptions[type].size
      || colors.some(color => !colorOptions[type].has(color))) invalid();
    if (colors.length) checkedColors[type] = [...new Set(colors)].sort();
  }
  return { packId: pack.id, sizes: checkedSizes, colors: checkedColors, note: note.trim(), price: pack.price };
}

function samePack(saved, submitted) {
  return saved.packId === submitted.packId && saved.note === submitted.note
    && Object.keys(colorOptions).every(type => saved.sizes[type] === submitted.sizes[type]
      && (saved.colors[type] ?? []).join(",") === (submitted.colors[type] ?? []).join(","));
}

async function createOrder(body) {
  if (typeof body.requestId !== "string" || !uuid.test(body.requestId)
    || typeof body.phone !== "string" || !/^(?:\+216)?\d{8}$/.test(body.phone)) invalid();
  const phone = `+216${body.phone.slice(-8)}`;
  const basePack = normalizedPack(body.basePack);

  const [created] = await db("dalia_orders", { on_conflict: "request_id", select: "id,total" }, {
    method: "POST",
    prefer: "resolution=ignore-duplicates,return=representation",
    body: { request_id: body.requestId, phone, base_pack: basePack, total: basePack.price },
  });
  if (created) return json(created, 201);
  const [existing] = await db("dalia_orders", {
    select: "id,phone,base_pack,total",
    request_id: `eq.${body.requestId}`,
  });
  if (!existing || existing.phone !== phone || !samePack(existing.base_pack, basePack)) conflict();
  return json({ id: existing.id, total: existing.total });
}

async function addPack(id, body) {
  if (typeof body.requestId !== "string" || !uuid.test(body.requestId)) invalid();
  const addonPack = normalizedPack(body.addonPack);
  const match = { id: `eq.${id}`, request_id: `eq.${body.requestId}` };

  const [current] = await db("dalia_orders", { ...match, select: "id,base_pack,addon_pack,total,status" });
  if (!current) throw new ApiError(404, "NOT_FOUND");
  if (current.base_pack.packId === addonPack.packId) invalid();
  if (current.addon_pack && samePack(current.addon_pack, addonPack)) {
    return json({ id, total: current.total });
  }
  if (current.status !== "pending" || current.addon_pack) conflict();

  const [updated] = await db("dalia_orders", {
    ...match, status: "eq.pending", addon_pack: "is.null", select: "id,total",
  }, {
    method: "PATCH",
    prefer: "return=representation",
    body: { addon_pack: addonPack, total: current.base_pack.price + addonPack.price },
  });
  if (updated) return json(updated);

  const [latest] = await db("dalia_orders", { ...match, select: "addon_pack,total" });
  if (latest?.addon_pack && samePack(latest.addon_pack, addonPack)) return json({ id, total: latest.total });
  conflict();
}

function tokenFrom(request) {
  const token = request.headers.get("X-Dalia-Session");
  return /^[\w-]+(?:\.[\w-]+){2}$/.test(token ?? "") ? token : null;
}

async function managerExists(userId) {
  if (!uuid.test(userId ?? "")) return false;
  const [manager] = await db("dalia_order_managers", { select: "user_id", user_id: `eq.${userId}` });
  return Boolean(manager);
}

async function managerId(request) {
  const bearer = tokenFrom(request);
  if (!bearer) throw new ApiError(401, "SIGN_IN_REQUIRED");
  const response = await supabaseFetch("/auth/v1/user", publicKey, { bearer });
  if (response.status === 401 || response.status === 403) throw new ApiError(401, "SIGN_IN_REQUIRED");
  if (!response.ok) throw new ApiError(503, "UNAVAILABLE");
  const { id } = await response.json();
  if (!await managerExists(id)) throw new ApiError(403, "MANAGER_REQUIRED");
  return id;
}

async function managerEmail(identifier) {
  const handle = identifier.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handle)) return handle;
  if (!/^[a-z0-9][a-z0-9_-]{1,31}$/.test(handle)) return null;
  const [manager] = await db("dalia_order_managers", { select: "user_id", username: `eq.${handle}` });
  if (!manager) return null;
  const response = await supabaseFetch(`/auth/v1/admin/users/${manager.user_id}`, serviceKey);
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiError(503, "UNAVAILABLE");
  const { email } = await response.json();
  return email ?? null;
}

async function login(body) {
  if (typeof body.identifier !== "string" || !body.identifier.trim() || body.identifier.length > 254
    || typeof body.password !== "string" || !body.password || body.password.length > 1024) invalid();
  const email = await managerEmail(body.identifier);
  if (!email) throw new ApiError(401, "INVALID_CREDENTIALS");
  const response = await supabaseFetch("/auth/v1/token?grant_type=password", publicKey, {
    method: "POST",
    body: { email, password: body.password },
  });
  if (response.status === 429) throw new ApiError(429, "TRY_LATER");
  if (response.status === 400 || response.status === 401 || response.status === 422) {
    throw new ApiError(401, "INVALID_CREDENTIALS");
  }
  if (!response.ok) throw new ApiError(503, "UNAVAILABLE");
  const session = await response.json();
  if (!await managerExists(session.user?.id)) throw new ApiError(403, "MANAGER_REQUIRED");

  const token = session.access_token;
  if (!/^[\w-]+(?:\.[\w-]+){2}$/.test(token ?? "") || !Number.isInteger(session.expires_in)) {
    throw new ApiError(503, "UNAVAILABLE");
  }
  return json({ ok: true }, 200, {
    "X-Dalia-Session": token,
    "X-Dalia-Session-Max-Age": String(Math.min(session.expires_in, 3600)),
  });
}

async function listOrders(query) {
  const status = query.get("status") ?? "pending";
  const limit = Number(query.get("limit") ?? "50");
  const offset = Number(query.get("offset") ?? "0");
  if (!allowedStatuses.has(status) || !Number.isInteger(limit) || limit < 1 || limit > 50
    || !Number.isSafeInteger(offset) || offset < 0 || offset > 100000) invalid();

  const orders = await db("dalia_orders", {
    select: orderFields, status: `eq.${status}`, order: "created_at.desc,id.desc",
    limit: String(limit + 1), offset: String(offset),
  });
  return json({ orders: orders.slice(0, limit), hasMore: orders.length > limit });
}

async function changeStatus(id, userId, body) {
  const { status, updatedAt } = body;
  if (!["confirmed", "unreachable", "cancelled"].includes(status)
    || typeof updatedAt !== "string" || updatedAt.length > 40 || !Number.isFinite(Date.parse(updatedAt))) invalid();
  const patch = { status };
  if (status === "confirmed") {
    patch.confirmed_at = new Date().toISOString();
    patch.confirmed_by = userId;
  }
  const previousStatuses = status === "cancelled" ? "in.(pending,unreachable,confirmed)" : "in.(pending,unreachable)";
  const [updated] = await db("dalia_orders", {
    id: `eq.${id}`, updated_at: `eq.${updatedAt}`, status: previousStatuses, select: orderFields,
  }, { method: "PATCH", prefer: "return=representation", body: patch });
  if (!updated) conflict();
  return json({ order: updated });
}

export async function handleDaliaRequest(request) {
  const url = new URL(request.url);
  const route = /^\/(?:functions\/v1\/)?dalia-api\/(login|logout|orders)(?:\/([^/]+)(\/addon)?)?$/.exec(url.pathname);
  if (!route) return json({ code: "NOT_FOUND" }, 404);
  const [, action, id, addon] = route;
  if (id && (action !== "orders" || !uuid.test(id))) return json({ code: "NOT_FOUND" }, 404);

  try {
    const { method } = request;
    if (action === "login" && method === "POST") return await login(await readJson(request));
    if (action === "orders") {
      if (method === "POST" && addon) return await addPack(id, await readJson(request));
      if (method === "POST" && !id) return await createOrder(await readJson(request));
      if (method === "GET" && !id) {
        await managerId(request);
        return await listOrders(url.searchParams);
      }
      if (method === "PATCH" && id && !addon) {
        const userId = await managerId(request);
        return await changeStatus(id, userId, await readJson(request));
      }
    }
    return json({ code: "METHOD_NOT_ALLOWED" }, 405);
  } catch (error) {
    if (error instanceof ApiError) return json({ code: error.code }, error.status);
    return json({ code: "UNAVAILABLE" }, 503);
  }
}

if (import.meta.main) Deno.serve(handleDaliaRequest);
