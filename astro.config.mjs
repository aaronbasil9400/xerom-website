import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  site: process.env.SITE_URL ?? "https://xerom.my",
  devToolbar: { enabled: false },
  output: "server",
  session: false,
  adapter: cloudflare({
    imageService: "compile",
    platformProxy: { enabled: true },
    inspectorPort: false,
  }),
  build: {
    inlineStylesheets: "always",
  },
  vite: {
    build: {
      cssMinify: "lightningcss",
    },
  },
});
