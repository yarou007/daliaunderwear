import { inject, track } from "@vercel/analytics";
import { packById } from "../public/dalia-packs.mjs";

const storefrontHosts = new Set(["www.daliaunderwear.com", "daliaunderwear.com", "dalia-boutique.vercel.app"]);
const storefrontPaths = new Set(["/", "/index.html"]);
const packEvents = new Set(["Pack selected", "Order requested", "Add-on accepted"]);

if (storefrontHosts.has(location.hostname) && storefrontPaths.has(location.pathname)) {
  inject({
    mode: "production",
    beforeSend(event) {
      const page = new URL(event.url, location.origin);
      if (page.origin !== location.origin || !storefrontPaths.has(page.pathname)) return null;
      return { ...event, url: location.origin + "/" };
    },
  });

  window.daliaTrack = (event, packId) => {
    if (!packEvents.has(event) || !packById(packId)) return;
    try {
      track(event, { pack_id: packId });
    } catch {
      // An analytics error should never interrupt ordering.
    }
  };
}
