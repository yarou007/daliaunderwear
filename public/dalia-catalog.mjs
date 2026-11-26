export const sizes = ["S", "M", "L", "XL", "2XL", "3XL"];

export const products = [
  {
    id: "lace-camisole",
    category: "camisoles",
    name: { ar: "قميص داخلي", fr: "Caraco" },
    colors: [
      { id: "rose", name: { ar: "وردي فاتح", fr: "Rose poudré" }, image: "lace-rose.webp", swatch: "#c9929a" },
      { id: "gray", name: { ar: "رمادي", fr: "Gris" }, image: "lace-gray.webp", swatch: "#989697" },
      { id: "black", name: { ar: "أسود", fr: "Noir" }, image: "lace-black.webp", swatch: "#29262a" },
    ],
  },
  {
    id: "straight-camisole",
    category: "camisoles",
    name: { ar: "قميص داخلي أبيض", fr: "Caraco blanc" },
    colors: [{ id: "white", name: { ar: "أبيض", fr: "Blanc" }, image: "straight-white.webp", swatch: "#f3eee6" }],
  },
  {
    id: "lace-band-camisole",
    category: "camisoles",
    name: { ar: "قميص داخلي بني وردي", fr: "Caraco brun rosé" },
    colors: [{ id: "taupe", name: { ar: "بني وردي", fr: "Taupe" }, image: "band-taupe.webp", swatch: "#9b8273" }],
  },
  {
    id: "ivory-brief",
    category: "briefs",
    name: { ar: "سروال داخلي عاجي", fr: "Culotte ivoire" },
    colors: [{ id: "ivory", name: { ar: "عاجي", fr: "Ivoire" }, image: "brief-ivory.webp", swatch: "#e9dfc8" }],
  },
  {
    id: "rib-lace-brief",
    category: "briefs",
    name: { ar: "سروال داخلي وردي", fr: "Culotte rose" },
    colors: [{ id: "rose", name: { ar: "وردي فاتح", fr: "Rose poudré" }, image: "brief-rose.webp", swatch: "#cb98a0" }],
  },
  {
    id: "printed-brief",
    category: "briefs",
    name: { ar: "سروال داخلي أزرق", fr: "Culotte bleue" },
    colors: [{ id: "blue", name: { ar: "أزرق", fr: "Bleu" }, image: "brief-blue.webp", swatch: "#7394ab" }],
  },
  {
    id: "heart-brief",
    category: "briefs",
    name: { ar: "سروال داخلي أحمر", fr: "Culotte rouge" },
    colors: [{ id: "red", name: { ar: "أحمر", fr: "Rouge" }, image: "brief-red.webp", swatch: "#ac3b49" }],
  },
];

export function getLocale() {
  return document.documentElement.lang.toLowerCase().startsWith("fr") ? "fr" : "ar";
}

export function productById(id) {
  return products.find(product => product.id === id);
}

export function colorById(product, colorId) {
  return product?.colors.find(color => color.id === colorId);
}

export function productImage(color) {
  return `/images/${color.image}`;
}
