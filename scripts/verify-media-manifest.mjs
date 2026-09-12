import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const base = "src/assets/images";
const manifest = JSON.parse(await fs.readFile(path.join(base, "media-manifest.json"), "utf8"));
let checked = 0;
for (const asset of Object.values(manifest.assets)) {
  for (const source of asset.sources) {
    const file = path.join(base, source.path);
    const bytes = await fs.readFile(file);
    const metadata = await sharp(bytes).metadata();
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (metadata.width !== source.width || metadata.height !== source.height) throw new Error(`${source.path}: expected ${source.width}x${source.height}, got ${metadata.width}x${metadata.height}`);
    if (hash !== source.sha256) throw new Error(`${source.path}: SHA-256 mismatch`);
    checked++;
  }
}
console.log(`Verified ${checked} manifested image derivatives.`);
