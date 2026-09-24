import type { APIRoute } from "astro";
export const GET: APIRoute = ({ site }) => new Response(import.meta.env.PUBLIC_STAGING_SITE === "1"
  ? "User-agent: *\nDisallow: /\n"
  : `User-agent: *\nAllow: /\nSitemap: ${new URL("sitemap.xml", site)}\n`, { headers: { "content-type": "text/plain" } });
