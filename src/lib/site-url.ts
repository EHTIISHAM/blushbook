/**
 * The public origin of this deployment, without a trailing slash.
 *
 * Behind a reverse proxy the request's own origin can come back as http:// or
 * as an internal container hostname, which would send a magic link somewhere
 * unreachable. NEXT_PUBLIC_SITE_URL is the source of truth when it is set;
 * the request origin is only a fallback for local development.
 */
export function siteUrl(fallbackOrigin: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configured) return fallbackOrigin.replace(/\/$/, "");

  return configured.replace(/\/$/, "");
}
