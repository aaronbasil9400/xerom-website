import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const publicSiteKey = process.env.PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA";
const result = spawnSync(npm, ["run", "build"], {
  env: { ...process.env, PUBLIC_TURNSTILE_SITE_KEY: publicSiteKey },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
