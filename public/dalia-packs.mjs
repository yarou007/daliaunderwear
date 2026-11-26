export const packs = [
  {
    id: "mix-6",
    name: { ar: "باك 6 قطع", fr: "Pack mixte de 6 pièces" },
    contents: { tops: 3, briefs: 3 },
    price: 35,
    images: [{ productId: "lace-camisole", colorId: "gray" }, { productId: "printed-brief", colorId: "blue" }],
  },
  {
    id: "mix-8",
    name: { ar: "باك 8 قطع", fr: "Pack mixte de 8 pièces" },
    contents: { tops: 4, briefs: 4 },
    price: 45,
    images: [{ productId: "straight-camisole", colorId: "white" }, { productId: "ivory-brief", colorId: "ivory" }],
  },
  {
    id: "mix-20",
    name: { ar: "باك 10 + 10", fr: "Pack mixte 10 + 10" },
    contents: { tops: 10, briefs: 10 },
    price: 89,
    images: [{ productId: "lace-camisole", colorId: "rose" }, { productId: "rib-lace-brief", colorId: "rose" }],
  },
  {
    id: "briefs-10",
    name: { ar: "10 سراويل داخلية", fr: "10 culottes" },
    contents: { tops: 0, briefs: 10 },
    price: 45,
    images: [{ productId: "rib-lace-brief", colorId: "rose" }],
  },
  {
    id: "tops-10",
    name: { ar: "10 قمصان داخلية", fr: "10 caracos" },
    contents: { tops: 10, briefs: 0 },
    price: 59,
    images: [{ productId: "lace-camisole", colorId: "rose" }],
  },
];

const contentNames = {
  ar: { tops: "قمصان داخلية", briefs: "سراويل داخلية" },
  fr: { tops: "caracos", briefs: "culottes" },
};

export function packById(id) {
  return packs.find(pack => pack.id === id);
}

export function packContents(pack, locale) {
  const names = contentNames[locale];
  return Object.entries(pack.contents)
    .filter(([, quantity]) => quantity > 0)
    .map(([type, quantity]) => `${quantity} ${names[type]}`)
    .join(" + ");
}

export function packPriceLabel(pack, locale) {
  if (!Number.isFinite(pack.price)) return locale === "fr" ? "Prix à confirmer" : "السعر عند التأكيد";
  const amount = Intl.NumberFormat("fr-TN", { maximumFractionDigits: 3 }).format(pack.price);
  return `${amount} ${locale === "fr" ? "DT" : "د.ت"}`;
}
