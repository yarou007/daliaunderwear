import { colorById, getLocale, productById, productImage } from "./dalia-catalog.mjs";
import { packs, packById, packContents, packPriceLabel } from "./dalia-packs.mjs";

const grid = document.querySelector("#pack-grid");
const startingPrice = document.querySelector("#starting-price");
const labels = {
  ar: {
    choose: "إختار الباك",
    configure: "إختار",
    from: "باكات من",
    saving: amount => `توفّر ${amount} مقارنة بالباكين وحدهم`,
  },
  fr: {
    choose: "Choisir ce pack",
    configure: "Choisir",
    from: "Packs dès",
    saving: amount => `${amount} de moins que les deux packs séparés`,
  },
};

function packPhoto({ productId, colorId }) {
  const color = colorById(productById(productId), colorId);
  return `<img class="pack-photo" src="${productImage(color)}" alt="" width="600" height="600" loading="lazy" decoding="async">`;
}

function render() {
  const locale = getLocale();
  const lowestPrice = Math.min(...packs.map(pack => pack.price));
  startingPrice.innerHTML = `${labels[locale].from} <bdi>${packPriceLabel({ price: lowestPrice }, locale)}</bdi>`;
  grid.innerHTML = packs.map(pack => {
    const name = pack.name[locale];
    const contents = packContents(pack, locale);
    const price = packPriceLabel(pack, locale);
    const savings = pack.id === "mix-20" ? packById("briefs-10").price + packById("tops-10").price - pack.price : 0;
    const featured = savings > 0;
    return `<article class="pack-card${featured ? " pack-card-featured" : ""}" aria-labelledby="pack-title-${pack.id}">
      <h3 class="pack-title" id="pack-title-${pack.id}">${name}</h3>
      <div class="pack-media" data-photo-count="${pack.images.length}">${pack.images.map(packPhoto).join("")}</div>
      <p class="pack-contents">${name === contents ? "" : contents}</p>
      <p class="pack-price"><bdi>${price}</bdi></p>
      ${featured ? `<p class="pack-saving">${labels[locale].saving(packPriceLabel({ price: savings }, locale))}</p>` : ""}
      <button class="pack-action" type="button" data-pack-id="${pack.id}" aria-label="${labels[locale].configure} ${name}">${labels[locale].choose}</button>
    </article>`;
  }).join("");
}

if (grid) {
  render();
  grid.addEventListener("click", event => {
    const button = event.target.closest("[data-pack-id]");
    const pack = packById(button?.dataset.packId);
    if (!pack) return;
    window.dispatchEvent(new CustomEvent("dalia:order", { detail: { packId: pack.id } }));
  });
  window.addEventListener("dalia:locale", render);
}
