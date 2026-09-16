import { defineMiddleware } from "astro:middleware";
import { env as cloudflareEnv } from "cloudflare:workers";
import { ownerDeniedResponse, verifyOwnerRequest } from "@/lib/security/owner";

const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
};

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const ownerRoute = url.pathname === "/race-control" || url.pathname.startsWith("/race-control/") || url.pathname.startsWith("/api/admin/");
  if (ownerRoute) {
    const localDevelopment = import.meta.env.DEV && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (localDevelopment) {
      context.locals.owner = { actorId: "local:race-control-fixture", email: "fixture@localhost.invalid", subject: "local-fixture" };
    } else {
      const identity = await verifyOwnerRequest(context.request, cloudflareEnv as typeof cloudflareEnv & CloudflareEnv);
      if (!identity) return ownerDeniedResponse();
      context.locals.owner = identity;
    }
  }
  const response = await next();
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
  if (url.protocol === "https:") headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  if (ownerRoute) headers.set("Cache-Control", "private, no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
});
