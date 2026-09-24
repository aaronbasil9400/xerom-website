import type { APIRoute } from "astro";
const routes = ["", "experiences", "pricing", "book", "visit", "events", "whats-new", "booking-policy", "privacy"];
export const GET: APIRoute = ({ site }) => new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((route) => `<url><loc>${new URL(route, site)}</loc></url>`).join("")}</urlset>`, { headers: { "content-type": "application/xml" } });
