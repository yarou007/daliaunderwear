import { categories, products, productById, colorById, productImage, getLocale } from "./dalia-catalog.mjs";

const grid = document.querySelector("#product-grid");
const filters = document.querySelector("#category-filters");
const selectedColors = new Map();
const labels = {
  ar: { color: "اللون", colors: "إختار اللون", configure: "إختار المقاس" },
  fr: { color: "Coloris", colors: "Choisir le coloris", configure: "Choisir ma taille" },
};
let category = "all";

function selectedColor(product) {
  return colorById(product, selectedColors.get(product.id)) || product.colors[0];
}

function imageAlt(product, color, locale) {
  return `${product.name[locale]} – ${color.name[locale]}`;
}

function colorPicker(product, color, locale) {
  const colorName = `<span class="color-preview" data-color-name aria-live="polite">${labels[locale].color} · ${color.name[locale]}</span>`;
  if (product.colors.length === 1) return colorName;
  const swatches = product.colors.map(item => `
    <button class="swatch" type="button" data-color="${item.id}" aria-label="${item.name[locale]}"
      aria-pressed="${item === color}" title="${item.name[locale]}" style="--swatch: ${item.swatch}"></button>
  `).join("");
  return `<div class="product-colors" role="group" aria-label="${labels[locale].colors}">${swatches}</div>${colorName}`;
}

function render() {
  const locale = getLocale();
  filters.innerHTML = categories.map(item => `
    <button class="category-filter" type="button" data-category="${item.id}" aria-pressed="${category === item.id}">
      ${item.name[locale]}
    </button>`).join("");

  const visibleProducts = category === "all" ? products : products.filter(product => product.category === category);
  grid.innerHTML = visibleProducts.map(product => {
    const color = selectedColor(product);
    return `<article class="product-card" data-product-id="${product.id}" aria-labelledby="name-${product.id}">
      <div class="product-media">
        <img class="product-image" src="${productImage(color)}" alt="${imageAlt(product, color, locale)}" loading="lazy" decoding="async">
      </div>
      <div class="product-body">
        <h3 class="product-title" id="name-${product.id}">${product.name[locale]}</h3>
        ${colorPicker(product, color, locale)}
        <button class="product-action" type="button" data-configure>${labels[locale].configure}</button>
      </div>
    </article>`;
  }).join("");
}

function changeCategory(event) {
  const button = event.target.closest("[data-category]");
  if (!button || !categories.some(item => item.id === button.dataset.category) || button.dataset.category === category) return;
  category = button.dataset.category;
  render();
  filters.querySelector(`[data-category="${category}"]`).focus();
}

function handleProductAction(event) {
  const card = event.target.closest("[data-product-id]");
  if (!card) return;
  const product = productById(card.dataset.productId);
  const swatch = event.target.closest("[data-color]");
  if (swatch) {
    const color = colorById(product, swatch.dataset.color);
    if (!color) return;
    selectedColors.set(product.id, color.id);
    const locale = getLocale();
    const image = card.querySelector(".product-image");
    image.src = productImage(color);
    image.alt = imageAlt(product, color, locale);
    card.querySelector("[data-color-name]").textContent = `${labels[locale].color} · ${color.name[locale]}`;
    card.querySelectorAll("[data-color]").forEach(button => {
      button.setAttribute("aria-pressed", String(button === swatch));
    });
    return;
  }
  if (event.target.closest("[data-configure]")) {
    window.dispatchEvent(new CustomEvent("dalia:configure", {
      detail: { productId: product.id, colorId: selectedColor(product).id },
    }));
  }
}

if (grid && filters) {
  render();
  filters.addEventListener("click", changeCategory);
  grid.addEventListener("click", handleProductAction);
  window.addEventListener("dalia:locale", render);
}
