import { colorById, getLocale, productById, productImage, products, sizes } from "./dalia-catalog.mjs";
import { packs, packById, packPriceLabel, packContents } from "./dalia-packs.mjs";

const translations = {
  ar: {
    title: "إطلب باكك توّا",
    close: "سكر",
    pack: "إختار الباك",
    tops: "القمصان",
    briefs: "السراويل",
    size: "المقاس",
    colors: "ألوان",
    optional: "(اختياري)",
    note: "ملاحظة على الألوان (اختياري)",
    example: "مثال: قطعتين وردي وقطعة رمادي",
    phone: "رقم التليفون",
    phoneHint: "أكتب رقم تونسي فيه 8 أرقام باش نكلّموك ونأكّدوا معاك الطلب.",
    invalidPhone: "أكتب رقم تونسي صحيح فيه 8 أرقام.",
    total: "المجموع",
    unknownPrice: "عند التأكيد",
    confirm: "تأكيد الطلب",
    sending: "قاعدين نبعثوا الطلب…",
    orderRetry: "ما نجّمناش نتأكّدوا إذا تسجّل الطلب. عاود جرّب بنفس التفاصيل.",
    orderConflict: "ما نجّمناش نثبّتوا وضعية الطلب. عاود جرّب بتفاصيل أول محاولة.",
    received: "وصلنا طلبك",
    callback: "نكلّموك على الرقم هذا باش نأكّدوا معاك الاختيارات.",
    addOnPrompt: "تحب تزيد باك مع طلبك؟",
    add: "زيد الباك",
    adding: "قاعدين نبعثوا الإضافة…",
    addonRetry: "ما نجّمناش نتأكّدوا إذا تسجّلت الإضافة. عاود جرّب بنفس الاختيارات.",
    addonConflict: "ما نجّمناش نثبّتوا وضعية الإضافة. عاود جرّب باختيارات أول محاولة.",
    skip: "لا، شكراً",
    finish: "ارجع للباكات",
    basePack: "الباك الأساسي",
    extraPack: "الباك الإضافي",
    addOnTotal: "المجموع مع الإضافة",
    optionalSize: "اختياري",
  },
  fr: {
    title: "Choisir un pack",
    close: "Fermer",
    pack: "Pack",
    tops: "Caracos",
    briefs: "Culottes",
    size: "Taille",
    colors: "Couleurs",
    optional: "(facultatif)",
    note: "Note sur les couleurs (facultatif)",
    example: "Exemple : deux roses et un gris",
    phone: "Numéro de téléphone",
    phoneHint: "Indiquez un numéro tunisien à 8 chiffres pour que nous puissions confirmer votre commande par téléphone.",
    invalidPhone: "Entrez un numéro tunisien valide à 8 chiffres.",
    total: "Total",
    unknownPrice: "À confirmer",
    confirm: "Confirmer la demande",
    sending: "Envoi de votre demande…",
    orderRetry: "Impossible de vérifier si votre demande a été enregistrée. Réessayez avec les mêmes détails.",
    orderConflict: "Impossible de confirmer l’état de cette demande. Réessayez avec les détails du premier envoi.",
    received: "Demande reçue",
    callback: "Nous vous appellerons à ce numéro pour confirmer vos choix.",
    addOnPrompt: "Envie d’ajouter un pack ?",
    add: "Ajouter le pack",
    adding: "Envoi de l’ajout…",
    addonRetry: "Impossible de vérifier si le pack a été ajouté. Réessayez avec les mêmes choix.",
    addonConflict: "Impossible de confirmer l’état de l’ajout. Réessayez avec les choix du premier envoi.",
    skip: "Non, merci",
    finish: "Revenir aux packs",
    basePack: "Pack principal",
    extraPack: "Pack ajouté",
    addOnTotal: "Total avec le pack ajouté",
    optionalSize: "Facultatif",
  },
};

const garmentTypes = [
  { key: "tops", category: "camisoles" },
  { key: "briefs", category: "briefs" },
];
const colorsByType = Object.fromEntries(garmentTypes.map(({ key, category }) => {
  const byId = new Map();
  for (const product of products.filter(product => product.category === category)) {
    for (const color of product.colors) {
      if (!byId.has(color.id)) byId.set(color.id, color);
    }
  }
  return [key, byId];
}));

let draft;
let receipt;
let offer;
let offerVisible = false;
let opener;
let requestId;
let pending = false;

function element(tag, className = "", text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function control(className, text, onClick) {
  const button = element("button", className, text);
  button.type = "button";
  if (onClick) button.addEventListener("click", onClick);
  return button;
}

const dialog = element("dialog", "pack-checkout");
dialog.id = "pack-checkout";
dialog.setAttribute("aria-labelledby", "pack-check-title");
const shell = element("div", "pack-check-shell");
const heading = element("h2", "pack-check-title");
heading.id = "pack-check-title";
heading.tabIndex = -1;
const closeButton = control("pack-check-close", "×", () => dialog.close());
const head = element("header", "pack-check-head");
head.append(heading, closeButton);
const body = element("div", "pack-check-body");
shell.append(head, body);
dialog.append(shell);
document.body.append(dialog);

function packTypes(pack) {
  return garmentTypes.filter(({ key }) => pack.contents[key] > 0);
}

function packSelection(pack, previous) {
  return {
    packId: pack.id,
    sizes: Object.fromEntries(packTypes(pack).map(({ key }) => [key, previous?.sizes[key] ?? ""])),
    colors: Object.fromEntries(packTypes(pack).map(({ key }) => [key, [...(previous?.colors[key] ?? [])]])),
    note: previous?.note ?? "",
  };
}

function totalLabel(selections, locale, labels) {
  const prices = selections.map(selection => packById(selection.packId)?.price);
  if (!prices.every(price => Number.isFinite(price) && price >= 0)) return labels.unknownPrice;
  return packPriceLabel({ price: prices.reduce((total, price) => total + price, 0) }, locale);
}

function normalizedPhone(value) {
  const normalized = value
    .replace(/[٠-٩۰-۹]/gu, digit => String(digit.charCodeAt(0) & 15))
    .replace(/[\s().-]/gu, "");
  const parts = normalized.match(/^(?:(?:\+|00)216)?([0-9]{2})([0-9]{3})([0-9]{3})$/);
  if (!parts) return null;
  const [, first, middle, last] = parts;
  return { digits: first + middle + last, displayed: `+216 ${first} ${middle} ${last}` };
}

function orderSelection(selection) {
  const base = packSelection(packById(selection.packId), selection);
  for (const colors of Object.values(base.colors)) colors.sort();
  base.note = base.note.trim();
  return base;
}

async function sendOrder(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw Object.assign(new Error("Order request failed"), { status: response.status });

  const saved = await response.json();
  if (typeof saved?.id !== "string" || !saved.id || !Number.isFinite(saved.total) || saved.total < 0) {
    throw new Error("Invalid order response");
  }
  return saved;
}

function pauseEditing(form, button, waitingLabel) {
  const controls = [...form.elements].filter(input => !input.disabled);
  const label = button.textContent;
  pending = true;
  closeButton.disabled = true;
  form.setAttribute("aria-busy", "true");
  button.textContent = waitingLabel;
  for (const input of controls) input.disabled = true;

  return () => {
    pending = false;
    closeButton.disabled = false;
    form.removeAttribute("aria-busy");
    button.textContent = label;
    for (const input of controls) input.disabled = false;
  };
}

function revealError(error, message, button) {
  error.textContent = message;
  error.hidden = false;
  button.focus();
}

function resetBodyScroll() {
  dialog.scrollTop = 0;
  body.scrollTop = 0;
}

function render(focus = false) {
  const locale = getLocale();
  const labels = translations[locale];
  closeButton.setAttribute("aria-label", labels.close);
  dialog.lang = locale;
  dialog.dir = locale === "fr" ? "ltr" : "rtl";
  dialog.classList.toggle("pack-check-confirmed", Boolean(receipt));
  heading.textContent = receipt ? labels.received : labels.title;
  body.replaceChildren(receipt ? renderReceipt(locale, labels) : renderOrder(locale, labels));
  if (focus && dialog.open) {
    heading.focus();
    resetBodyScroll();
  }
}

function choosePack(validPacks, selectedId, locale, legendText, onChange, showPhotos = false) {
  const group = element("fieldset", "pack-check-section");
  group.append(element("legend", "pack-check-label", legendText));
  const grid = element("div", "pack-check-grid");
  for (const pack of validPacks) {
    const label = element("label", "pack-check-card");
    const input = element("input");
    input.type = "radio";
    input.name = "pack";
    input.value = pack.id;
    input.checked = pack.id === selectedId;
    input.addEventListener("change", () => onChange(pack));

    const card = element("span", "pack-check-card-content");
    if (showPhotos) {
      const media = element("span", "pack-check-card-media");
      for (const { productId, colorId } of pack.images) {
        const color = colorById(productById(productId), colorId);
        if (!color) continue;
        const image = element("img", "pack-check-card-image");
        image.src = productImage(color);
        image.alt = "";
        media.append(image);
      }
      if (media.childElementCount) card.append(media);
    }
    const description = element("span", "pack-check-card-copy");
    const name = pack.name[locale];
    const contents = packContents(pack, locale);
    description.append(element("strong", "pack-check-card-name", name));
    if (contents !== name) description.append(element("span", "pack-check-card-detail", contents));
    description.append(element("span", "pack-check-card-price", packPriceLabel(pack, locale)));
    card.append(description);
    label.append(input, card);
    grid.append(label);
  }
  group.append(grid);
  return group;
}

function sizeFields(selection, labels) {
  const fields = element("div", "pack-check-options");
  for (const { key } of packTypes(packById(selection.packId))) {
    const label = element("label", "pack-check-field");
    label.append(element("span", "pack-check-label", `${labels.size} · ${labels[key]}`));
    const select = element("select", "pack-check-input");
    select.name = `size-${key}`;
    select.dir = "auto";
    const placeholder = element("option", "", labels.optionalSize);
    placeholder.value = "";
    select.append(placeholder);
    for (const size of sizes) {
      const choice = element("option", "", size);
      choice.value = size;
      select.append(choice);
    }
    select.value = selection.sizes[key];
    select.addEventListener("change", () => { selection.sizes[key] = select.value; });
    label.append(select);
    fields.append(label);
  }
  return fields;
}

function colorFields(selection, locale, labels) {
  const wrapper = element("div", "pack-check-options");
  for (const { key } of packTypes(packById(selection.packId))) {
    const fieldset = element("fieldset", "pack-check-section");
    const colorLabel = locale === "ar" ? `${labels.colors} ${labels[key]}` : `${labels.colors} · ${labels[key]}`;
    fieldset.append(element("legend", "pack-check-label", `${colorLabel} ${labels.optional}`));
    const swatches = element("div", "pack-check-swatches");
    for (const color of colorsByType[key].values()) {
      const label = element("label", "pack-check-choice");
      const input = element("input");
      input.type = "checkbox";
      input.name = `color-${key}`;
      input.value = color.id;
      input.checked = selection.colors[key].includes(color.id);
      input.addEventListener("change", () => {
        const selected = new Set(selection.colors[key]);
        if (input.checked) selected.add(color.id);
        else selected.delete(color.id);
        selection.colors[key] = [...selected];
      });
      const content = element("span", "pack-check-choice-label");
      const swatch = element("span", "pack-check-swatch");
      swatch.style.setProperty("--pack-swatch", color.swatch);
      swatch.setAttribute("aria-hidden", "true");
      content.append(swatch, document.createTextNode(color.name[locale]));
      label.append(input, content);
      swatches.append(label);
    }
    fieldset.append(swatches);
    wrapper.append(fieldset);
  }
  return wrapper;
}

function preferenceFields(selection, locale, labels) {
  const section = element("div", "pack-check-section pack-check-preferences");
  const label = element("label", "pack-check-field");
  const note = element("textarea", "pack-check-note");
  note.name = "color-note";
  note.rows = 2;
  note.maxLength = 240;
  note.placeholder = labels.example;
  note.value = selection.note;
  note.addEventListener("input", () => { selection.note = note.value; });
  label.append(element("span", "pack-check-label", labels.note), note);
  section.append(sizeFields(selection, labels), colorFields(selection, locale, labels), label);
  return section;
}

function totalRow(selections, label, locale, labels, savedTotal) {
  const row = element("div", "pack-check-total");
  const amount = savedTotal === undefined
    ? totalLabel(selections, locale, labels)
    : packPriceLabel({ price: savedTotal }, locale);
  row.append(element("span", "", label), element("strong", "", amount));
  return row;
}

function renderOrder(locale, labels) {
  const form = element("form", "pack-check-form");
  form.noValidate = true;
  const error = element("p", "pack-check-error");
  error.id = "pack-check-error";
  error.setAttribute("role", "alert");
  error.hidden = true;

  const packPicker = choosePack(packs, draft.packId, locale, labels.pack, pack => {
    draft = { ...packSelection(pack, draft), phone: draft.phone };
    preferences.replaceChildren(preferenceFields(draft, locale, labels));
    total.replaceWith(total = totalRow([draft], labels.total, locale, labels));
    error.hidden = true;
    window.daliaTrack?.("Pack selected", pack.id);
  });

  const preferences = element("div", "pack-check-config");
  preferences.append(preferenceFields(draft, locale, labels));
  const phoneLabel = element("label", "pack-check-field");
  const phone = element("input", "pack-check-input");
  phone.type = "tel";
  phone.name = "phone";
  phone.required = true;
  phone.dir = "ltr";
  phone.inputMode = "tel";
  phone.autocomplete = "off";
  phone.maxLength = 24;
  phone.placeholder = "XX XXX XXX";
  phone.value = draft.phone;
  phone.setAttribute("aria-describedby", "pack-check-phone-hint pack-check-error");
  const phoneHint = element("small", "pack-check-phone-hint", labels.phoneHint);
  phoneHint.id = "pack-check-phone-hint";
  phone.addEventListener("input", () => {
    draft.phone = phone.value;
    phone.removeAttribute("aria-invalid");
    error.hidden = true;
  });
  phoneLabel.append(element("span", "pack-check-label", labels.phone), phone, phoneHint);

  let total = totalRow([draft], labels.total, locale, labels);
  const actions = element("div", "pack-check-actions");
  const submit = control("pack-check-primary", labels.confirm);
  submit.type = "submit";
  actions.append(submit);

  form.append(packPicker, preferences, phoneLabel, total, error, actions);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (pending) return;
    const phoneValue = normalizedPhone(phone.value);
    if (!phoneValue) {
      error.textContent = labels.invalidPhone;
      error.hidden = false;
      phone.setAttribute("aria-invalid", "true");
      phone.focus();
      return;
    }

    const basePack = orderSelection(draft);
    const resumeEditing = pauseEditing(form, submit, labels.sending);
    error.hidden = true;
    let saved;
    try {
      requestId ??= crypto.randomUUID();
      saved = await sendOrder("/api/dalia/orders", { requestId, phone: phoneValue.digits, basePack });
    } catch (problem) {
      resumeEditing();
      revealError(error, problem.status === 409 ? labels.orderConflict : labels.orderRetry, submit);
      return;
    }
    resumeEditing();

    receipt = { id: saved.id, requestId, total: saved.total, base: basePack, addon: null, phone: phoneValue.displayed };
    phone.value = "";
    draft = null;
    requestId = null;
    offer = null;
    offerVisible = true;
    render(true);
    window.daliaTrack?.("Order requested", basePack.packId);
  });
  return form;
}

function summaryLine(selection, caption, locale, labels) {
  const pack = packById(selection.packId);
  const item = element("li", "pack-check-summary-item");
  const name = pack.name[locale];
  const contents = packContents(pack, locale);
  item.append(
    element("p", "pack-check-label", caption),
    element("h3", "pack-check-card-name", name),
  );
  if (contents !== name) item.append(element("p", "pack-check-card-detail", contents));
  item.append(element("p", "pack-check-card-price", packPriceLabel(pack, locale)));
  for (const { key } of packTypes(pack)) {
    const parts = [labels[key]];
    if (selection.sizes[key]) parts.push(selection.sizes[key]);
    const colors = selection.colors[key].map(id => colorsByType[key].get(id)?.name[locale]).filter(Boolean);
    if (colors.length) parts.push(colors.join(locale === "ar" ? "، " : ", "));
    if (parts.length > 1) item.append(element("p", "pack-check-summary-meta", parts.join(" · ")));
  }
  if (selection.note.trim()) item.append(element("p", "pack-check-summary-note", selection.note.trim()));
  return item;
}

function renderReceipt(locale, labels) {
  const panel = document.createDocumentFragment();
  const phone = element("bdi", "", receipt.phone);
  phone.dir = "ltr";
  const contact = element("p", "pack-check-receipt-phone");
  contact.append(element("span", "pack-check-label", labels.phone), phone);
  panel.append(
    contact,
    element("p", "pack-check-callback", labels.callback),
  );
  const list = element("ul", "pack-check-summary");
  list.append(summaryLine(receipt.base, labels.basePack, locale, labels));
  const selections = [receipt.base];
  if (receipt.addon) {
    list.append(summaryLine(receipt.addon, labels.extraPack, locale, labels));
    selections.push(receipt.addon);
  }
  panel.append(list, totalRow(selections, labels.total, locale, labels, receipt.total));

  const alternatives = packs.filter(pack => pack.id !== receipt.base.packId).slice(0, 4);
  if (offerVisible && alternatives.length) {
    panel.append(renderOffers(alternatives, locale, labels));
  } else {
    const actions = element("div", "pack-check-actions");
    actions.append(control("pack-check-primary", labels.finish, () => dialog.close()));
    panel.append(actions);
  }
  return panel;
}

function renderOffers(alternatives, locale, labels) {
  const form = element("form", "pack-check-form pack-check-upsell");
  const error = element("p", "pack-check-error");
  error.setAttribute("role", "alert");
  error.hidden = true;
  const details = element("div", "pack-check-config");
  const picker = choosePack(alternatives, offer?.packId, locale, labels.extraPack, pack => {
    offer = packSelection(pack);
    updateOffer();
    error.hidden = true;
    window.daliaTrack?.("Pack selected", pack.id);
  }, true);
  const actions = element("div", "pack-check-actions");
  const add = control("pack-check-primary", labels.add);
  add.type = "submit";
  const skip = control("pack-check-secondary", labels.skip, () => {
    offer = null;
    offerVisible = false;
    render(true);
  });

  function updateOffer() {
    if (offer) {
      const price = packById(offer.packId).price;
      const estimatedTotal = Number.isFinite(price) ? receipt.total + price : undefined;
      details.replaceChildren(
        preferenceFields(offer, locale, labels),
        totalRow([receipt.base, offer], labels.addOnTotal, locale, labels, estimatedTotal),
      );
    } else {
      details.replaceChildren();
    }
    add.disabled = !offer;
  }

  updateOffer();
  const header = element("div", "pack-check-upsell-head");
  header.append(element("h3", "pack-check-upsell-title", labels.addOnPrompt), skip);
  actions.append(add);
  form.append(header, picker, details, error, actions);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (pending || !offerVisible || !offer || receipt.addon) return;
    const addonPack = orderSelection(offer);
    const resumeEditing = pauseEditing(form, add, labels.adding);
    error.hidden = true;
    let saved;
    try {
      saved = await sendOrder(`/api/dalia/orders/${encodeURIComponent(receipt.id)}/addon`, {
        requestId: receipt.requestId,
        addonPack,
      });
      if (saved.id !== receipt.id) throw new Error("Invalid add-on response");
    } catch (problem) {
      resumeEditing();
      revealError(error, problem.status === 409 ? labels.addonConflict : labels.addonRetry, add);
      return;
    }
    resumeEditing();

    receipt.addon = addonPack;
    receipt.total = saved.total;
    offer = null;
    offerVisible = false;
    render(true);
    window.daliaTrack?.("Add-on accepted", addonPack.packId);
  });
  return form;
}

function open(packId) {
  const selectedPack = packById(packId);
  const pack = selectedPack ?? packById("mix-8") ?? packs[0];
  if (!pack || dialog.open) return;
  opener = document.activeElement;
  draft = { ...packSelection(pack), phone: "" };
  requestId = null;
  receipt = null;
  offer = null;
  offerVisible = false;
  render();
  dialog.showModal();
  heading.focus();
  resetBodyScroll();
  if (selectedPack) window.daliaTrack?.("Pack selected", selectedPack.id);
}

dialog.addEventListener("cancel", event => {
  if (pending) event.preventDefault();
});

dialog.addEventListener("close", () => {
  if (dialog.open) return;
  draft = null;
  requestId = null;
  receipt = null;
  offer = null;
  offerVisible = false;
  body.replaceChildren();
  if (opener?.isConnected) opener.focus();
  opener = null;
});

window.addEventListener("dalia:order", event => {
  open(event.detail?.packId);
});
document.querySelector("#quick-order")?.addEventListener("click", () => open());
window.addEventListener("dalia:locale", () => {
  if (dialog.open && !pending) render();
});
