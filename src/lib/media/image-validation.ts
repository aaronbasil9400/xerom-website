export const heroImageRequirements = {
  aspectRatio: "16:9",
  recommendedWidth: 1600,
  recommendedHeight: 900,
  minimumWidth: 1600,
  minimumHeight: 900,
  maximumBytes: 8 * 1024 * 1024,
  allowedTypes: ["image/jpeg", "image/png", "image/webp"] as const,
} as const;

export interface ImageDimensions { width: number; height: number }

function uint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

export function readImageDimensions(bytes: Uint8Array, contentType: string): ImageDimensions | null {
  if (contentType === "image/png" && bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (contentType === "image/jpeg" && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (length < 2 || offset + length + 2 > bytes.length) return null;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        return { height: (bytes[offset + 5] << 8) | bytes[offset + 6], width: (bytes[offset + 7] << 8) | bytes[offset + 8] };
      }
      offset += length + 2;
    }
  }
  if (contentType === "image/webp" && bytes.length >= 30 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === "VP8X") return { width: 1 + uint24LE(bytes, 24), height: 1 + uint24LE(bytes, 27) };
    if (chunk === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
    if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
      const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

export function validateHeroImage(bytes: Uint8Array, contentType: string): ImageDimensions {
  if (!(heroImageRequirements.allowedTypes as readonly string[]).includes(contentType)) throw new Error("Use a JPEG, PNG, or WebP image.");
  if (bytes.byteLength === 0 || bytes.byteLength > heroImageRequirements.maximumBytes) throw new Error("The hero image must be no larger than 8 MB.");
  const dimensions = readImageDimensions(bytes, contentType);
  if (!dimensions) throw new Error("The image file could not be read.");
  if (dimensions.width < heroImageRequirements.minimumWidth || dimensions.height < heroImageRequirements.minimumHeight) throw new Error("The hero image must be at least 1600 × 900 pixels.");
  if (dimensions.width * 9 !== dimensions.height * 16) throw new Error("The hero image must use the existing 16:9 aspect ratio.");
  return dimensions;
}
