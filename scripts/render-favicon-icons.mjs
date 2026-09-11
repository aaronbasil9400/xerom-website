import fs from "node:fs/promises";
import sharp from "sharp";

const svg = await fs.readFile("public/favicon.svg");
for (const [size, name] of [[32, "favicon-32x32.png"], [180, "apple-touch-icon.png"], [192, "icon-192.png"], [512, "icon-512.png"]]) {
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(svg).resize({ width: Math.round(size * .9), height: Math.round(size * .9), fit: "contain" }).png().toBuffer(), gravity: "center" }])
    .png()
    .toFile(`public/${name}`);
}
