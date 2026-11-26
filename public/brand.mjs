const translations = {
  ar: {
    skip: "انتقل للمحتوى",
    navigation: "الموقع",
    packsNav: "الباكات",
    howNav: "طريقة الطلب",
    order: "إطلب توّا",
    heroLabel: "ملابس داخلية نسائية",
    headline: "راحة لكل يوم",
    intro: "قمصان وسراويل داخلية في باكات. إختار المقاس والألوان على ذوقك.",
    discover: "تصفّح الباكات",
    heroAlt: "قميص داخلي وردي على مانيكان",
    trustSize: "مقاس لكل نوع",
    trustColor: "ألوان على ذوقك",
    trustCall: "التأكيد بالتليفون",
    packsTitle: "إختار الباك اللي يناسبك",
    packsDescription: "باكات قمصان، باكات سراويل، وباكات تجمع الاثنين.",
    guideTitle: "كيفاش تطلب؟",
    detailAlt: "تفاصيل القماش الوردي",
    guidePack: "إختار الباك.",
    guideOptions: "حدّد المقاسات والألوان، أو اكتب تفضيلاتك.",
    guidePhone: "خلّي رقم التليفون باش نأكّدوا معاك التفاصيل.",
    footer: "معاينة Dalia · الأسعار للتجربة",
  },
  fr: {
    skip: "Aller au contenu",
    navigation: "Navigation",
    packsNav: "Les packs",
    howNav: "Comment commander",
    order: "Commander",
    heroLabel: "Lingerie féminine",
    headline: "Le confort au quotidien",
    intro: "Des caracos et des culottes en packs. Choisissez vos tailles et vos couleurs.",
    discover: "Voir les packs",
    heroAlt: "Caraco rose sur un mannequin",
    trustSize: "Une taille par type de pièce",
    trustColor: "Les couleurs à votre goût",
    trustCall: "Confirmation par téléphone",
    packsTitle: "Choisissez votre pack",
    packsDescription: "Des packs de caracos, de culottes et des packs mixtes.",
    guideTitle: "Comment commander ?",
    detailAlt: "Détail du tissu rose",
    guidePack: "Choisissez votre pack.",
    guideOptions: "Sélectionnez vos tailles et couleurs ou indiquez vos préférences.",
    guidePhone: "Indiquez votre numéro pour confirmer les détails par téléphone.",
    footer: "Aperçu Dalia · Prix à titre d’essai",
  },
};

const switchButton = document.querySelector("#language");

switchButton.addEventListener("click", () => {
  const locale = document.documentElement.lang.startsWith("ar") ? "fr" : "ar";
  document.documentElement.lang = locale === "ar" ? "ar-TN" : "fr";
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  document.title = locale === "ar" ? "Dalia | ملابس داخلية نسائية" : "Dalia | Lingerie féminine";
  for (const element of document.querySelectorAll("[data-copy]")) {
    element.textContent = translations[locale][element.dataset.copy];
  }
  for (const element of document.querySelectorAll("[data-alt]")) {
    element.alt = translations[locale][element.dataset.alt];
  }
  for (const element of document.querySelectorAll("[data-aria]")) {
    element.setAttribute("aria-label", translations[locale][element.dataset.aria]);
  }
  switchButton.textContent = locale === "ar" ? "FR" : "عربي";
  switchButton.lang = locale === "ar" ? "fr" : "ar";
  switchButton.setAttribute("aria-label", locale === "ar" ? "Version française" : "النسخة بالتونسي");
  window.dispatchEvent(new CustomEvent("dalia:locale", { detail: { locale } }));
});
