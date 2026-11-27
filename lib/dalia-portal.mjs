export function portalPath(slug) {
  const configuredSlug = process.env.DALIA_PORTAL_SLUG;
  if (typeof slug !== "string" || !/^[a-f0-9]{16}$/.test(slug) || slug !== configuredSlug) return null;
  return `/equipe/${slug}`;
}
