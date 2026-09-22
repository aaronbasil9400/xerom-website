import { describe, expect, it } from "vitest";
import { readImageDimensions, validateHeroImage } from "@/lib/media/image-validation";

describe("hero image validation", () => {
  function png(width: number, height: number, size = 24) {
    const bytes = new Uint8Array(Math.max(size, 24)); const view = new DataView(bytes.buffer);
    bytes.set([0x89,0x50,0x4e,0x47], 0); view.setUint32(16, width); view.setUint32(20, height); return bytes;
  }
  it("reads PNG dimensions and accepts the preserved 16:9 master", () => {
    expect(readImageDimensions(png(1600, 900), "image/png")).toEqual({ width: 1600, height: 900 });
    expect(validateHeroImage(png(1600, 900), "image/png")).toEqual({ width: 1600, height: 900 });
  });
  it("rejects undersized, wrong-ratio, and unsupported images", () => {
    expect(() => validateHeroImage(png(1280, 720), "image/png")).toThrow("1600");
    expect(() => validateHeroImage(png(1600, 1000), "image/png")).toThrow("16:9");
    expect(() => validateHeroImage(png(1600, 900), "image/gif")).toThrow("JPEG");
  });
});
