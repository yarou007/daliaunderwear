const translations = {
  ar: {
    skip:"انتقل للمحتوى", navigation:"الموقع", collectionNav:"المجموعة", howNav:"دليل الاختيار", bag:"اختياراتي",
    heroLabel:"ملابس داخلية نسائية", headline:"راحة لكل يوم",
    intro:"قصّات بسيطة وتفاصيل أنيقة. إختار المقاس والألوان اللي تناسبك.",
    discover:"تصفّح المجموعة", heroAlt:"قميص داخلي وردي بياقة مزخرفة على مانيكان", trustSize:"مقاس لكل قطعة",
    trustColor:"ألوان على ذوقك", trustReview:"ملخّص لكل الاختيارات",
    collectionTitle:"مجموعة Dalia", collectionDescription:"قمصان وسراويل داخلية بتصاميم لكل يوم.",
    guideTitle:"دليل الاختيار", detailAlt:"تفاصيل الزخرفة والعقدة على القماش الوردي",
    sizeTitle:"مقاس مستقل لكل قطعة", sizeCopy:"إختار المقاس لكل قطعة. تنجم تزيد نفس الموديل بمقاسات مختلفة.",
    colorsTitle:"تنسيق الألوان", colorsCopy:"حدّد الكمية لكل لون. الألوان والمقاسات تظهر في «اختياراتي».",
    noteTitle:"ملاحظة للطلب", noteCopy:"تنجم تكتب تفضيلك للألوان، مثلاً «قطعتين بالوردي وقطعة بالرمادي».",
    choose:"إختار قطعك", footer:"معاينة المجموعة"
  },
  fr: {
    skip:"Aller au contenu", navigation:"Navigation", collectionNav:"Collection", howNav:"Comment choisir", bag:"Mes choix",
    heroLabel:"Lingerie du quotidien", headline:"À l’aise dès la première couche.",
    intro:"Des caracos et des culottes pour tous les jours. Choisissez votre taille et composez vos couleurs.",
    discover:"Découvrir la collection", heroAlt:"Caraco rose à dentelle sur un mannequin", trustSize:"Une taille par pièce",
    trustColor:"Vos couleurs à mixer", trustReview:"Vos choix dans un seul récapitulatif",
    collectionTitle:"La collection Dalia", collectionDescription:"Découvrez chaque détail et composez votre sélection.",
    guideTitle:"À chacune ses essentiels.", detailAlt:"Détail du nœud et de la dentelle sur le tissu rose",
    sizeTitle:"Une taille par pièce", sizeCopy:"Choisissez la taille de chaque pièce. Le même modèle peut être ajouté dans deux tailles.",
    colorsTitle:"Un mix de couleurs à votre goût", colorsCopy:"Ajoutez les teintes de votre choix avec leur quantité, puis retrouvez le mélange dans « Mes choix ».",
    noteTitle:"Une note pour toute la commande", noteCopy:"Par exemple, « deux roses et une grise ». À vous de voir si vous souhaitez ajouter une précision.",
    choose:"Choisir mes pièces", footer:"Aperçu de la collection • tailles et couleurs à titre d’essai"
  }
};

const switchButton = document.querySelector("#language");

switchButton.addEventListener("click", () => {
  const locale = document.documentElement.lang.startsWith("ar") ? "fr" : "ar";
  document.documentElement.lang = locale === "ar" ? "ar-TN" : "fr";
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  document.title = locale === "ar" ? "Dalia | ملابس داخلية نسائية" : "Dalia | Lingerie du quotidien";
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
