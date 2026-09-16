import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface OwnerAuthEnv {
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUDIENCE?: string;
  OWNER_EMAILS?: string;
}

export interface OwnerIdentity {
  actorId: string;
  email: string;
  subject: string;
}

type TokenVerifier = (token: string, options: { issuer: string; audience: string; jwksUrl: URL }) => Promise<JWTPayload>;

const remoteVerifier: TokenVerifier = async (token, options) => {
  const result = await jwtVerify(token, createRemoteJWKSet(options.jwksUrl), {
    issuer: options.issuer,
    audience: options.audience,
  });
  return result.payload;
};

function parseOwnerEmails(value: string | undefined): Set<string> {
  return new Set((value ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export async function verifyOwnerRequest(request: Request, env: OwnerAuthEnv, verifier: TokenVerifier = remoteVerifier): Promise<OwnerIdentity | null> {
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.replace(/\/$/, "");
  const audience = env.ACCESS_AUDIENCE;
  const owners = parseOwnerEmails(env.OWNER_EMAILS);
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!teamDomain || !audience || owners.size === 0 || !token) return null;
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(teamDomain)) return null;

  try {
    const payload = await verifier(token, {
      issuer: teamDomain,
      audience,
      jwksUrl: new URL("/cdn-cgi/access/certs", teamDomain),
    });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    const subject = typeof payload.sub === "string" ? payload.sub : "";
    if (!email || !subject || !owners.has(email)) return null;
    return { actorId: `access:${subject}`, email, subject };
  } catch {
    return null;
  }
}

export function verifyOwnerMutationOrigin(request: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("Origin");
  const fetchSite = request.headers.get("Sec-Fetch-Site");
  const csrf = request.headers.get("X-Xerom-CSRF");
  return origin === requestUrl.origin && fetchSite === "same-origin" && csrf === "race-control-v1";
}

export function ownerDeniedResponse(): Response {
  return Response.json({ error: { code: "OWNER_ACCESS_DENIED", message: "Owner access is required.", retryable: false } }, {
    status: 403,
    headers: { "cache-control": "no-store" },
  });
}
