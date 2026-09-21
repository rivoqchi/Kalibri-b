export type ImageDimensions = {
  width: number;
  height: number;
};

/** Keep in sync with Kalibri-f/lib/admin/image-dimensions.ts */
export const MEDIA_FOLDER_DIMENSIONS: Record<string, ImageDimensions> = {
  products: { width: 1200, height: 1500 },
  categories: { width: 512, height: 512 },
  brands: { width: 512, height: 512 },
  partners: { width: 512, height: 512 },
  services: { width: 512, height: 512 },
  directions: { width: 512, height: 512 },
  ads: { width: 2400, height: 800 },
  avatars: { width: 512, height: 512 },
};

export function formatImageDimensions(dims: ImageDimensions): string {
  return `${dims.width}×${dims.height}`;
}

/** Lightweight PNG / JPEG / WebP (VP8X) header parse — no sharp. */
export function readImageDimensions(
  buffer: Buffer,
): ImageDimensions | null {
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3 && length >= 7) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }

  if (
    buffer.length >= 30 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8X') {
      return {
        width:
          1 + buffer[24]! + (buffer[25]! << 8) + (buffer[26]! << 16),
        height:
          1 + buffer[27]! + (buffer[28]! << 8) + (buffer[29]! << 16),
      };
    }
    if (chunk === 'VP8 ' && buffer.length >= 30) {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunk === 'VP8L' && buffer.length >= 25) {
      const bits = buffer.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
  }

  return null;
}

export function assertFolderImageDimensions(
  folder: string,
  buffer: Buffer,
): void {
  const required = MEDIA_FOLDER_DIMENSIONS[folder];
  if (!required) return;

  const actual = readImageDimensions(buffer);
  if (!actual) return;

  if (
    actual.width !== required.width ||
    actual.height !== required.height
  ) {
    throw new Error(
      `${formatImageDimensions(required)} kerak (${actual.width}×${actual.height})`,
    );
  }
}
