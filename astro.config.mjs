import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  site: "https://xerom.my",
  devToolbar: { enabled: false },
  output: "server",
  session: false,
  adapter: cloudflare({
    imageService: "compile",
    platformProxy: { enabled: true },
  }),
  build: {
    inlineStylesheets: "auto",
  },
  vite: {
    build: {
      cssMinify: "lightningcss",
    },
  },
});
