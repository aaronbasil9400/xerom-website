import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const publicSiteKey = process.env.PUBLIC_TURNSTILE_SITE_KEY;
if (!publicSiteKey) throw new Error("Set PUBLIC_TURNSTILE_SITE_KEY to the hostname-scoped staging widget before building.");
const siteUrl = process.env.SITE_URL ?? "https://xerom-website.xerombookings.workers.dev";
const result = spawnSync(npm, ["run", "build"], {
  env: { ...process.env, PUBLIC_TURNSTILE_SITE_KEY: publicSiteKey, SITE_URL: siteUrl, PUBLIC_STAGING_SITE: "1" },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
