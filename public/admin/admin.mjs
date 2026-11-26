import { products } from "../dalia-catalog.mjs";
import { packById, packContents } from "../dalia-packs.mjs";

const statuses = {
  pending: "À appeler",
  confirmed: "Confirmée",
  unreachable: "Sans réponse",
  cancelled: "Annulée",
};
const packTypes = [
  { key: "tops", name: "Caracos", category: "camisoles" },
  { key: "briefs", name: "Culottes", category: "briefs" },
];
const colorLabels = Object.fromEntries(packTypes.map(({ key, category }) => [
  key,
  new Map(products.filter(product => product.category === category)
    .flatMap(product => product.colors.map(color => [color.id, color.name.fr]))),
]));
const pageSize = 50;
const currency = new Intl.NumberFormat("fr-TN", { maximumFractionDigits: 3 });
const dateTime = new Intl.DateTimeFormat("fr-TN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Tunis",
});

const select = selector => document.querySelector(selector);
const loginPanel = select("#login-panel");
const loginForm = select("#login-form");
const loginError = select("#login-error");
const signIn = select("#sign-in");
const sessionCheck = select("#session-check");
const ordersPanel = select("#orders-panel");
const list = select("#orders-list");
const statusMessage = select("#list-status");
const listError = select("#list-error");
const template = select("#order-template");
const logout = select("#logout");
const refresh = select("#refresh");
const filters = Array.from(document.querySelectorAll("[data-filter]"));
const pagination = select("#pagination");
const previous = select("#previous");
const next = select("#next");

let session = 0;
let authenticated = false;
let status = "pending";
let offset = 0;
let hasMore = false;
let orders = [];
let currentLoad;
let loggingOut = false;
const saving = new Set();

function element(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text != null) result.textContent = text;
  return result;
}

function action(className, label, onClick) {
  const button = element("button", "button " + className, label);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}

function feedback(target, message = "") {
  target.textContent = message;
  target.hidden = !message;
}

async function request(path, { method = "GET", body, signal } = {}) {
  const response = await fetch(path, {
    method,
    headers: {
      Accept: "application/json",
      ...(body && { "Content-Type": "application/json" }),
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw Object.assign(new Error("Request failed"), { status: response.status });
  return response.json();
}

function unavailable(error, fallback) {
  if (error.status === 429) return "Trop de tentatives. Réessayez dans quelques instants.";
  if (error.status === 503) return "Le service des commandes est indisponible pour le moment.";
  return fallback;
}

function showLogin(message = "", focus = false) {
  session += 1;
  authenticated = false;
  currentLoad?.abort();
  currentLoad = undefined;
  saving.clear();
  orders = [];
  status = "pending";
  offset = 0;
  hasMore = false;
  list.replaceChildren();
  statusMessage.textContent = "";
  feedback(listError);
  sessionCheck.hidden = true;
  ordersPanel.hidden = true;
  logout.hidden = true;
  loginPanel.hidden = false;
  loginForm.elements.password.value = "";
  feedback(loginError, message);
  if (focus) loginForm.elements.identifier.focus();
}

function showOrders(focus = false) {
  authenticated = true;
  sessionCheck.hidden = true;
  loginPanel.hidden = true;
  ordersPanel.hidden = false;
  logout.hidden = false;
  if (focus) select("#orders-title").focus();
}

function lostAccess(error, initial = false) {
  if (error.status === 401) {
    showLogin(initial ? "" : "Votre session a expiré. Reconnectez-vous.", !initial);
    return true;
  }
  if (error.status === 403) {
    showLogin("Ce compte n’a pas accès à l’espace commandes.", !initial);
    return true;
  }
  return false;
}

function syncControls() {
  const busy = Boolean(currentLoad) || loggingOut;
  filters.forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.filter === status));
    button.disabled = loggingOut;
  });
  refresh.disabled = loggingOut;
  previous.disabled = offset === 0 || busy;
  next.disabled = !hasMore || busy;
  pagination.hidden = offset === 0 && !hasMore;
  select("#page-number").textContent = "Page " + (offset / pageSize + 1);
  list.setAttribute("aria-busy", String(busy));
  list.inert = busy;
}

function amount(value) {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? currency.format(number) + " DT" : "—";
}

function dateLabel(value) {
  const date = value && new Date(value);
  return date && Number.isFinite(date.getTime()) ? dateTime.format(date) : "";
}

function phoneNumber(value) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[\s().-]/g, "").match(/^(?:(?:\+|00)216)?(\d{2})(\d{3})(\d{3})$/);
  if (!digits) return null;
  const [, prefix, middle, end] = digits;
  return { link: `tel:+216${prefix}${middle}${end}`, label: `${prefix} ${middle} ${end}` };
}

function packLine(selection, addon) {
  const item = element("li");
  if (addon) item.append(element("p", "admin-pack-added", "Pack ajouté"));
  const pack = packById(selection.packId);
  const name = pack?.name.fr || selection.packId || "Pack";
  const title = element("div", "admin-pack-row");
  title.append(element("span", "admin-pack-name", name), element("span", "admin-pack-price", amount(selection.price)));
  item.append(title);
  const contents = pack && packContents(pack, "fr");
  if (contents && contents !== name) item.append(element("p", "admin-pack-detail", contents));
  for (const { key, name } of packTypes) {
    const size = selection.sizes?.[key];
    const ids = selection.colors?.[key];
    const colors = Array.isArray(ids) ? ids.map(id => colorLabels[key].get(id)).filter(Boolean) : [];
    const detail = [size, colors.join(", ")].filter(Boolean).join(" · ");
    if (detail) item.append(element("p", "admin-pack-meta", `${name} · ${detail}`));
  }
  if (typeof selection.note === "string" && selection.note.trim()) {
    item.append(element("p", "admin-pack-note", "Note sur les couleurs · " + selection.note.trim()));
  }
  return item;
}

function setRowActions(order, controls, error) {
  if (!Object.hasOwn(statuses, order.status) || order.status === "cancelled") return;

  const normal = element("div", "admin-inline-actions");
  const cancel = action("admin-cancel-link", "Annuler", () => {
    feedback(error);
    normal.hidden = true;
    guard.hidden = false;
    keep.focus();
  });
  const guard = element("div", "admin-cancel-guard");
  guard.hidden = true;
  const guardActions = element("div", "admin-inline-actions");
  const keep = action("admin-quiet", "Garder la commande", () => {
    guard.hidden = true;
    normal.hidden = false;
    cancel.focus();
  });
  const confirmCancel = action("primary", "Confirmer l’annulation", () => {
    void updateStatus(order, "cancelled", controls, error);
  });
  guardActions.append(keep, confirmCancel);
  guard.append(element("p", "", "Annuler cette commande ?"), guardActions);

  if (order.status === "pending" || order.status === "unreachable") {
    normal.append(action("primary", "Confirmer après appel", () => {
      void updateStatus(order, "confirmed", controls, error);
    }));
  }
  if (order.status === "pending") {
    normal.append(action("admin-quiet", "Pas de réponse", () => {
      void updateStatus(order, "unreachable", controls, error);
    }));
  }
  normal.append(cancel);
  controls.append(normal, guard);
  if (saving.has(order.id)) setRowBusy(controls, true);
}

function setRowBusy(controls, busy) {
  controls.setAttribute("aria-busy", String(busy));
  for (const button of controls.querySelectorAll("button")) button.disabled = busy;
}

function orderCard(order) {
  const card = template.content.firstElementChild.cloneNode(true);
  card.dataset.orderId = order.id;
  const find = selector => card.querySelector(selector);
  const reference = find(".admin-order-reference");
  const shortId = String(order.id ?? "").replace(/-/g, "").slice(-8).toUpperCase();
  reference.textContent = shortId ? `Commande ${shortId}` : "Commande";
  reference.title = String(order.id ?? "");
  const created = find(".admin-created");
  created.textContent = dateLabel(order.created_at);
  if (created.textContent) created.dateTime = order.created_at;
  const call = find(".admin-call");
  const phone = phoneNumber(order.phone);
  if (phone) {
    call.href = phone.link;
    call.textContent = "Appeler " + phone.label;
  } else {
    call.hidden = true;
  }
  const confirmedDate = order.status === "confirmed" && dateLabel(order.confirmed_at);
  if (confirmedDate) {
    const confirmed = find(".admin-order-confirmed");
    confirmed.textContent = "Confirmée le " + confirmedDate;
    confirmed.hidden = false;
  }

  const packs = find(".admin-order-packs");
  if (order.base_pack) packs.append(packLine(order.base_pack, false));
  if (order.addon_pack) packs.append(packLine(order.addon_pack, true));
  const badge = find(".admin-status-tag");
  badge.textContent = Object.hasOwn(statuses, order.status) ? statuses[order.status] : "Statut inconnu";
  badge.dataset.status = order.status;
  find(".admin-total strong").textContent = amount(order.total);
  setRowActions(order, find(".admin-row-actions"), find(".admin-row-error"));
  return card;
}

function renderOrders(notice = "") {
  const fragment = document.createDocumentFragment();
  for (const order of orders) fragment.append(orderCard(order));
  list.replaceChildren(fragment);
  const description = orders.length
    ? `${orders.length} ${orders.length === 1 ? "commande affichée" : "commandes affichées"}.`
    : "Aucune commande pour ce statut.";
  statusMessage.textContent = notice ? `${notice} ${description}` : description;
}

async function loadOrders({ filter = status, start = offset, initial = false, notice = "", focusOrder = "" } = {}) {
  if ((!authenticated && !initial) || loggingOut) return;
  currentLoad?.abort();
  const controller = new AbortController();
  const generation = session;
  currentLoad = controller;
  syncControls();
  feedback(listError);
  statusMessage.textContent = "Chargement des commandes…";
  const query = new URLSearchParams({ status: filter, limit: pageSize, offset: start });

  try {
    const result = await request("/api/dalia/orders?" + query, { signal: controller.signal });
    if (controller !== currentLoad || session !== generation) return;
    if (!Array.isArray(result.orders)) throw new Error("Invalid orders response");
    if (start > 0 && !result.orders.length) {
      return await loadOrders({ filter, start: Math.max(0, start - pageSize), initial, notice, focusOrder });
    }
    status = filter;
    offset = start;
    hasMore = result.hasMore === true;
    orders = result.orders;
    if (initial) showOrders();
    renderOrders(notice);
    currentLoad = undefined;
    syncControls();
    if (focusOrder) {
      const card = Array.from(list.children).find(child => child.dataset.orderId === focusOrder);
      (card?.querySelector(".admin-order-reference") ?? statusMessage).focus();
    }
  } catch (error) {
    if (controller !== currentLoad || session !== generation) return;
    if (lostAccess(error, initial)) return;
    const message = unavailable(error, "Impossible de charger les commandes. Réessayez.");
    if (initial) {
      showLogin(message);
    } else {
      statusMessage.textContent = orders.length ? "Commandes précédemment chargées." : "";
      feedback(listError, message);
    }
  } finally {
    if (currentLoad === controller) {
      currentLoad = undefined;
      syncControls();
    }
  }
}

async function updateStatus(order, nextStatus, controls, errorTarget) {
  if (!authenticated || loggingOut || saving.has(order.id)) return;
  const generation = session;
  saving.add(order.id);
  setRowBusy(controls, true);
  feedback(errorTarget);
  try {
    const result = await request("/api/dalia/orders/" + encodeURIComponent(order.id), {
      method: "PATCH",
      body: { status: nextStatus, updatedAt: order.updated_at },
    });
    if (session !== generation) return;
    saving.delete(order.id);
    if (result.order?.id === order.id) {
      orders = orders.flatMap(row => row.id !== order.id ? [row]
        : result.order.status === status ? [result.order] : []);
      renderOrders();
    }
    await loadOrders({ notice: "Statut enregistré.", focusOrder: order.id });
  } catch (error) {
    if (session !== generation || lostAccess(error)) return;
    if (error.status === 409) {
      saving.delete(order.id);
      await loadOrders({ notice: "Cette commande a été modifiée. Vérifiez le statut actuel.", focusOrder: order.id });
    } else {
      const message = unavailable(error, "Le statut n’a pas été enregistré. Réessayez.");
      feedback(errorTarget.isConnected ? errorTarget : listError, message);
    }
  } finally {
    if (session === generation) {
      saving.delete(order.id);
      const currentCard = Array.from(list.children).find(child => child.dataset.orderId === order.id);
      setRowBusy(currentCard?.querySelector(".admin-row-actions") ?? controls, false);
    }
  }
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (signIn.disabled) return;
  const identifierField = loginForm.elements.identifier;
  const passwordField = loginForm.elements.password;
  const identifier = identifierField.value.trim();
  if (!identifier || !passwordField.value) {
    feedback(loginError, "Saisissez votre identifiant et votre mot de passe.");
    (identifier ? passwordField : identifierField).focus();
    return;
  }
  signIn.disabled = true;
  signIn.textContent = "Connexion…";
  feedback(loginError);
  try {
    const result = await request("/api/dalia/login", {
      method: "POST",
      body: { identifier, password: passwordField.value },
    });
    if (!result.ok) throw new Error("Invalid sign-in response");
    showOrders(true);
    await loadOrders();
  } catch (error) {
    const message = error.status === 401 ? "Identifiant ou mot de passe incorrect."
      : error.status === 403 ? "Ce compte n’a pas accès à l’espace commandes."
        : unavailable(error, "Connexion indisponible. Réessayez.");
    feedback(loginError, message);
    passwordField.focus();
  } finally {
    passwordField.value = "";
    signIn.disabled = false;
    signIn.textContent = "Se connecter";
  }
});

logout.addEventListener("click", async () => {
  if (!authenticated || loggingOut) return;
  loggingOut = true;
  logout.disabled = true;
  syncControls();
  try {
    const result = await request("/api/dalia/logout", { method: "POST", body: {} });
    if (!result.ok) throw new Error("Invalid sign-out response");
    showLogin("", true);
  } catch (error) {
    if (error.status === 401) showLogin("", true);
    else feedback(listError, unavailable(error, "Impossible de vous déconnecter. Réessayez."));
  } finally {
    loggingOut = false;
    logout.disabled = false;
    syncControls();
  }
});

refresh.addEventListener("click", () => void loadOrders());
filters.forEach(button => button.addEventListener("click", () => {
  const filter = button.dataset.filter;
  if (filter !== status || currentLoad) void loadOrders({ filter, start: 0 });
}));
previous.addEventListener("click", () => {
  if (offset > 0 && !currentLoad) void loadOrders({ start: offset - pageSize });
});
next.addEventListener("click", () => {
  if (hasMore && !currentLoad) void loadOrders({ start: offset + pageSize });
});
window.addEventListener("pageshow", event => {
  if (event.persisted && authenticated) void loadOrders();
});

signIn.disabled = false;
void loadOrders({ initial: true });
