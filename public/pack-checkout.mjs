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
    phoneHint: "رقم تونسي فيه 8 أرقام.",
    invalidPhone: "أكتب رقم تونسي صحيح فيه 8 أرقام.",
    total: "المجموع",
    unknownPrice: "عند التأكيد",
    confirm: "تأكيد الطلب",
    demo: "هذي معاينة. الطلب ما يتبعتش وما يتسجّلش.",
    received: "تمّت معاينة الطلب",
    callback: "في الطلب العادي، نكلّموك على الرقم هذا باش نأكّدوا معاك الاختيارات.",
    addOnPrompt: "تحب تزيد باك مع طلبك؟",
    add: "زيد الباك",
    skip: "لا، شكراً",
    finish: "سكر المعاينة",
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
    phoneHint: "Numéro tunisien à 8 chiffres.",
    invalidPhone: "Entrez un numéro tunisien valide à 8 chiffres.",
    total: "Total",
    unknownPrice: "À confirmer",
    confirm: "Confirmer la demande",
    demo: "Aperçu uniquement. La commande n’est ni envoyée ni enregistrée.",
    received: "Aperçu de la demande confirmé",
    callback: "Pour une vraie commande, ce numéro servirait à confirmer vos choix par téléphone.",
    addOnPrompt: "Envie d’ajouter un pack ?",
    add: "Ajouter le pack",
    skip: "Non, merci",
    finish: "Fermer l’aperçu",
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
  return parts ? `+216 ${parts[1]} ${parts[2]} ${parts[3]}` : "";
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

function totalRow(selections, label, locale, labels) {
  const row = element("div", "pack-check-total");
  row.append(element("span", "", label), element("strong", "", totalLabel(selections, locale, labels)));
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
  phone.setAttribute("aria-describedby", "pack-check-phone-hint");
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

  form.append(element("p", "pack-check-notice", labels.demo), packPicker, preferences, phoneLabel, total, error, actions);
  form.addEventListener("submit", event => {
    event.preventDefault();
    const phoneValue = normalizedPhone(phone.value);
    if (!phoneValue) {
      error.textContent = labels.invalidPhone;
      error.hidden = false;
      phone.setAttribute("aria-invalid", "true");
      phone.focus();
      return;
    }

    receipt = { base: packSelection(packById(draft.packId), draft), addon: null, phone: phoneValue };
    phone.value = "";
    draft = null;
    offer = null;
    offerVisible = true;
    render(true);
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
    element("p", "pack-check-notice", labels.demo),
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
  panel.append(list, totalRow(selections, labels.total, locale, labels));

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
  const details = element("div", "pack-check-config");
  const picker = choosePack(alternatives, offer?.packId, locale, labels.extraPack, pack => {
    offer = packSelection(pack);
    updateOffer();
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
      details.replaceChildren(
        preferenceFields(offer, locale, labels),
        totalRow([receipt.base, offer], labels.addOnTotal, locale, labels),
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
  form.append(header, picker, details, actions);
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!offerVisible || !offer || receipt.addon) return;
    const chosen = alternatives.find(pack => pack.id === offer.packId);
    if (!chosen) return;
    receipt.addon = packSelection(chosen, offer);
    offer = null;
    offerVisible = false;
    render(true);
  });
  return form;
}

function open(packId) {
  const pack = packById(packId) ?? packById("mix-8") ?? packs[0];
  if (!pack || dialog.open) return;
  opener = document.activeElement;
  draft = { ...packSelection(pack), phone: "" };
  receipt = null;
  offer = null;
  offerVisible = false;
  render();
  dialog.showModal();
  heading.focus();
  resetBodyScroll();
}

dialog.addEventListener("close", () => {
  if (dialog.open) return;
  draft = null;
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
  if (dialog.open) render();
});
