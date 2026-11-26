import { colorById, getLocale, productById, productImage, sizes } from "./dalia-catalog.mjs";

const storageKey = "dalia.bag.v1";
const maxQuantity = 99;
const noteLimit = 240;

const translations = {
  ar: {
    bag: "اختياراتي",
    close: "إغلاق",
    configure: "إختار اللون والمقاس",
    editTitle: "تعديل الاختيار",
    size: "المقاس",
    color: "اللون",
    quantity: "الكمية",
    add: "أضف إلى اختياراتي",
    edit: "تعديل",
    save: "حفظ التعديل",
    remove: "حذف",
    back: "الرجوع للاختيارات",
    continue: "واصل التسوّق",
    empty: "ما فما حتى قطعة في اختياراتك.",
    note: "تفضيل الألوان للطلب ككل (اختياري)",
    example: "مثال، قطعتين بالوردي وقطعة بالرمادي",
    review: "معاينة الطلب",
    demo: "نسخة للمراجعة فقط.",
    finish: "إغلاق المعاينة",
    clear: "إفراغ الاختيارات",
    clearQuestion: "تحب تفرّغ اختياراتك وتمسح الملاحظة؟",
    cancel: "الاحتفاظ بالاختيارات",
    selectSize: "إختار المقاس.",
    selectColor: "إختار اللون.",
    invalidQuantity: "إختار كمية بين 1 و99.",
    quantityLimit: "الحد الأقصى لهذا اللون والمقاس هو 99 قطعة.",
    lineChanged: "الاختيار تبدّل. ارجع للاختيارات وافتحه من جديد.",
    count: number => `${number} قطعة`,
  },
  fr: {
    bag: "Panier",
    close: "Fermer",
    configure: "Choisir la couleur et la taille",
    editTitle: "Modifier votre choix",
    size: "Taille",
    color: "Couleur",
    quantity: "Quantité",
    add: "Ajouter au panier",
    edit: "Modifier",
    save: "Enregistrer",
    remove: "Retirer",
    back: "Retour au panier",
    continue: "Continuer mes choix",
    empty: "Votre panier est encore vide.",
    note: "Préférence de couleurs (facultatif)",
    example: "Exemple : 2 roses et 1 gris",
    review: "Aperçu de la demande",
    demo: "Version de démonstration.",
    finish: "Fermer l’aperçu",
    clear: "Vider le panier",
    clearQuestion: "Retirer tous les articles et effacer la note ?",
    cancel: "Garder mes choix",
    selectSize: "Choisissez une taille.",
    selectColor: "Choisissez une couleur.",
    invalidQuantity: "Choisissez une quantité de 1 à 99.",
    quantityLimit: "Le panier accepte 99 pièces au maximum pour cette couleur et cette taille.",
    lineChanged: "Le choix a changé. Revenez au panier pour le rouvrir.",
    count: number => `${number} ${number === 1 ? "article" : "articles"}`,
  },
};

const bagHeader = document.querySelector("#open-bag");

function sizesFor(product) {
  return product.sizes ?? sizes;
}

function sameVariant(left, right) {
  return left.productId === right.productId && left.colorId === right.colorId && left.size === right.size;
}

function validLine(line) {
  if (!line || typeof line !== "object") return false;
  const product = productById(line.productId);
  return Boolean(colorById(product, line.colorId)
    && sizesFor(product).includes(line.size)
    && Number.isInteger(line.quantity)
    && line.quantity > 0
    && line.quantity <= maxQuantity);
}

function readBag(raw) {
  try {
    const data = JSON.parse(raw);
    const lines = Array.isArray(data?.lines) ? data.lines.filter(validLine) : [];
    const variants = [];
    for (const line of lines) {
      const existing = variants.find(item => sameVariant(item, line));
      if (existing) existing.quantity = Math.min(maxQuantity, existing.quantity + line.quantity);
      else variants.push({ productId: line.productId, colorId: line.colorId, size: line.size, quantity: line.quantity });
    }
    return {
      lines: variants,
      note: typeof data?.note === "string" ? data.note.slice(0, noteLimit) : "",
    };
  } catch {
    return { lines: [], note: "" };
  }
}

function loadBag() {
  try {
    return readBag(window.localStorage.getItem(storageKey));
  } catch {
    return { lines: [], note: "" };
  }
}

let bag = loadBag();
let view = "bag";
let configuration = null;
let clearPending = false;
let opener = null;

function node(tag, className, label) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (label != null) element.textContent = label;
  return element;
}

function button(className, label, action) {
  const element = node("button", className, label);
  element.type = "button";
  if (action) element.addEventListener("click", action);
  return element;
}

const dialog = node("dialog", "bag-dialog");
dialog.id = "bag-dialog";
dialog.setAttribute("aria-labelledby", "bag-title");
const shell = node("div", "bag-shell");
const head = node("header", "bag-head");
const heading = node("h2", "bag-heading");
heading.id = "bag-title";
heading.tabIndex = -1;
const closeButton = button("bag-close", "×", () => dialog.close());
head.append(heading, closeButton);
const content = node("div", "bag-content");
shell.append(head, content);
dialog.append(shell);
document.body.append(dialog);

function totalQuantity() {
  return bag.lines.reduce((count, line) => count + line.quantity, 0);
}

function updateCount() {
  const count = totalQuantity();
  const labels = translations[getLocale()];
  for (const badge of document.querySelectorAll("[data-bag-count]")) {
    badge.textContent = String(count);
  }
  if (bagHeader) {
    bagHeader.setAttribute("aria-label", `${labels.bag} · ${labels.count(count)}`);
    bagHeader.setAttribute("aria-controls", dialog.id);
    bagHeader.setAttribute("aria-haspopup", "dialog");
  }
}

function saveBag() {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(bag));
  } catch {
    // The open tab still holds selections if storage is disabled.
  }
  updateCount();
}

function redraw(focusHeading = true) {
  const language = getLocale();
  const labels = translations[language];
  dialog.lang = language;
  dialog.dir = language === "fr" ? "ltr" : "rtl";
  closeButton.setAttribute("aria-label", labels.close);

  if (view === "configure") {
    heading.textContent = configuration.original ? labels.editTitle : labels.configure;
    content.replaceChildren(configureView(language, labels));
  } else if (view === "review") {
    heading.textContent = labels.review;
    content.replaceChildren(reviewView(language, labels));
  } else {
    heading.textContent = labels.bag;
    content.replaceChildren(bagView(language, labels));
  }
  if (focusHeading && dialog.open) {
    heading.focus();
    dialog.scrollTop = 0;
    content.scrollTop = 0;
  }
}

function show(nextView) {
  view = nextView;
  clearPending = false;
  if (!dialog.open) {
    opener = document.activeElement;
    redraw(false);
    dialog.showModal();
    heading.focus();
  } else {
    redraw();
  }
}

function imageLabel(product, color) {
  const language = getLocale();
  return `${product.name[language]} · ${color.name[language]}`;
}

function imageFor(product, color, className) {
  const image = node("img", className);
  image.src = productImage(color);
  image.alt = imageLabel(product, color);
  return image;
}

function openConfigure(productId, colorId, original = null) {
  const product = productById(productId);
  if (!product?.colors.length) return;
  const color = colorById(product, colorId) ?? product.colors[0];
  configuration = {
    product,
    colorId: color.id,
    size: original?.size ?? "",
    quantity: original?.quantity.toString() ?? "1",
    original,
  };
  show("configure");
}

function option(group, value, label, checked, CSSColor) {
  const container = node("label", "bag-choice");
  const radio = node("input");
  radio.type = "radio";
  radio.name = group;
  radio.value = value;
  radio.checked = checked;

  const caption = node("span", "bag-choice-label");
  if (CSSColor) {
    const swatch = node("span", "bag-color-dot");
    swatch.style.setProperty("--bag-swatch", CSSColor);
    swatch.setAttribute("aria-hidden", "true");
    caption.append(swatch);
  }
  caption.append(document.createTextNode(label));
  container.append(radio, caption);
  return container;
}

function configureView(language, labels) {
  const { product, original } = configuration;
  const form = node("form", "bag-form");
  form.noValidate = true;

  const preview = node("div", "bag-config-product");
  const photo = imageFor(product, colorById(product, configuration.colorId), "bag-product-image");
  const details = node("div", "bag-product-info");
  details.append(node("h3", "bag-line-title", product.name[language]));
  preview.append(photo, details);

  const colorGroup = node("fieldset", "bag-option-group");
  const colors = node("div", "bag-choices");
  for (const color of product.colors) {
    colors.append(option("color", color.id, color.name[language], configuration.colorId === color.id, color.swatch));
  }
  colorGroup.append(node("legend", "bag-label", labels.color), colors);

  const sizeGroup = node("fieldset", "bag-option-group");
  const sizeChoices = node("div", "bag-choices");
  for (const size of sizesFor(product)) {
    sizeChoices.append(option("size", size, size, configuration.size === size));
  }
  sizeGroup.append(node("legend", "bag-label", labels.size), sizeChoices);

  const quantity = node("label", "bag-quantity", labels.quantity);
  const amount = node("input", "bag-quantity-input");
  amount.name = "quantity";
  amount.type = "number";
  amount.inputMode = "numeric";
  amount.min = "1";
  amount.max = String(maxQuantity);
  amount.step = "1";
  amount.value = configuration.quantity;
  quantity.append(amount);

  const error = node("p", "bag-error");
  error.setAttribute("role", "alert");
  error.hidden = true;

  form.addEventListener("input", event => {
    const field = event.target;
    if (field.name === "size") configuration.size = field.value;
    if (field.name === "color") {
      configuration.colorId = field.value;
      const color = colorById(product, field.value);
      photo.src = productImage(color);
      photo.alt = imageLabel(product, color);
    }
    if (field.name === "quantity") configuration.quantity = field.value;
    error.hidden = true;
  });

  const actions = node("div", "bag-actions");
  const submit = button("bag-primary", original ? labels.save : labels.add);
  submit.type = "submit";
  actions.append(submit);
  if (original) actions.append(button("bag-secondary", labels.back, () => show("bag")));
  form.append(preview, colorGroup, sizeGroup, quantity, error, actions);

  form.addEventListener("submit", event => {
    event.preventDefault();
    const line = {
      productId: product.id,
      colorId: configuration.colorId,
      size: configuration.size,
      quantity: amount.valueAsNumber,
    };

    function report(message, field) {
      error.textContent = message;
      error.hidden = false;
      field?.focus();
    }

    if (!colorById(product, line.colorId)) return report(labels.selectColor, colors.querySelector("input"));
    if (!sizesFor(product).includes(line.size)) return report(labels.selectSize, sizeChoices.querySelector("input"));
    if (!validLine(line)) return report(labels.invalidQuantity, amount);

    const index = original ? bag.lines.findIndex(item => sameVariant(item, original)) : -1;
    if (original && (index < 0 || bag.lines[index].quantity !== original.quantity)) return report(labels.lineChanged);

    const remaining = [...bag.lines];
    if (original) remaining.splice(index, 1);
    const duplicate = remaining.findIndex(item => sameVariant(item, line));
    if (duplicate >= 0) {
      const quantity = remaining[duplicate].quantity + line.quantity;
      if (quantity > maxQuantity) return report(labels.quantityLimit, amount);
      remaining[duplicate] = { ...line, quantity };
    } else {
      remaining.splice(original ? index : remaining.length, 0, line);
    }
    bag.lines = remaining;
    saveBag();
    show("bag");
  });

  return form;
}

function listLines(language, labels, editable) {
  const list = node("ul", "bag-list");
  for (const line of bag.lines) {
    const product = productById(line.productId);
    const color = colorById(product, line.colorId);
    const item = node("li", "bag-line");
    const info = node("div", "bag-line-info");
    const name = product.name[language];
    info.append(
      node("h3", "bag-line-title", name),
      node("p", "bag-line-meta", `${labels.color} · ${color.name[language]}  /  ${labels.size} · ${line.size}`),
      node("p", "bag-line-count", `× ${line.quantity}`),
    );
    item.append(imageFor(product, color, "bag-line-image"), info);

    if (editable) {
      const actions = node("div", "bag-line-actions");
      const edit = button("bag-link", labels.edit, () => openConfigure(product.id, color.id, { ...line }));
      const remove = button("bag-link", labels.remove, () => {
        bag.lines = bag.lines.filter(item => !sameVariant(item, line));
        saveBag();
        redraw();
      });
      const description = `${name} · ${color.name[language]} · ${line.size}`;
      edit.setAttribute("aria-label", `${labels.edit} ${description}`);
      remove.setAttribute("aria-label", `${labels.remove} ${description}`);
      actions.append(edit, remove);
      item.append(actions);
    }
    list.append(item);
  }
  return list;
}

function bagView(language, labels) {
  const fragment = document.createDocumentFragment();
  if (bag.lines.length) {
    fragment.append(node("p", "bag-muted", labels.count(totalQuantity())), listLines(language, labels, true));
  } else {
    fragment.append(node("p", "bag-empty", labels.empty));
  }

  if (bag.lines.length || bag.note) {
    const notes = node("label", "bag-notes");
    const note = node("textarea", "bag-note");
    note.rows = 2;
    note.maxLength = noteLimit;
    note.placeholder = labels.example;
    note.value = bag.note;
    note.addEventListener("input", () => {
      bag.note = note.value;
      saveBag();
    });
    notes.append(node("span", "bag-label", labels.note), note);
    fragment.append(notes);
  }

  const actions = node("div", "bag-actions");
  if (bag.lines.length) {
    actions.append(button("bag-primary", labels.review, () => show("review")));
  }
  actions.append(button("bag-secondary", labels.continue, () => dialog.close()));
  if (!clearPending && (bag.lines.length || bag.note)) {
    actions.append(button("bag-link", labels.clear, () => {
      clearPending = true;
      redraw(false);
      content.querySelector("[data-cancel-clear]").focus();
    }));
  }
  fragment.append(actions);

  if (clearPending) {
    const confirmation = node("div", "bag-notice");
    const choices = node("div", "bag-actions");
    const cancel = button("bag-secondary", labels.cancel, () => {
      clearPending = false;
      redraw();
    });
    cancel.setAttribute("data-cancel-clear", "");
    choices.append(
      button("bag-primary", labels.clear, () => {
        bag = { lines: [], note: "" };
        saveBag();
        show("bag");
      }),
      cancel,
    );
    confirmation.append(node("p", "", labels.clearQuestion), choices);
    fragment.append(confirmation);
  }
  return fragment;
}

function reviewView(language, labels) {
  const fragment = document.createDocumentFragment();
  fragment.append(node("p", "bag-notice", labels.demo));
  if (bag.lines.length) {
    fragment.append(node("p", "bag-muted", labels.count(totalQuantity())), listLines(language, labels, false));
  } else {
    fragment.append(node("p", "bag-empty", labels.empty));
  }
  if (bag.note.trim()) {
    const preferences = node("div", "bag-summary-note");
    preferences.append(node("h3", "bag-label", labels.note), node("p", "", bag.note));
    fragment.append(preferences);
  }
  const actions = node("div", "bag-actions");
  actions.append(
    button("bag-primary", labels.finish, () => dialog.close()),
    button("bag-secondary", labels.back, () => show("bag")),
  );
  fragment.append(actions);
  return fragment;
}

dialog.addEventListener("close", () => {
  if (dialog.open) return;
  configuration = null;
  clearPending = false;
  if (opener?.isConnected) opener.focus();
  else bagHeader?.focus();
  opener = null;
});

bagHeader?.addEventListener("click", () => show("bag"));
window.addEventListener("dalia:configure", ({ detail }) => {
  if (detail) openConfigure(detail.productId, detail.colorId);
});
window.addEventListener("dalia:locale", () => {
  updateCount();
  if (dialog.open) redraw();
});
window.addEventListener("storage", event => {
  if (event.key !== storageKey) return;
  bag = readBag(event.newValue);
  updateCount();
  if (dialog.open && view !== "configure") redraw();
});
updateCount();
