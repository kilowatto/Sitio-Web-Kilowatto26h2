// Pure-JS metadata stripping — Workers has no native image libraries (no sips/sharp/libheif),
// so this only handles JPEG/PNG directly. HEIC/video still need the local script (macOS `sips`).

// Builds a minimal EXIF APP1 segment containing ONLY the Orientation tag (0x0112) — no GPS,
// no camera make/model/serial, no timestamps. Losing Orientation entirely made phone photos
// (shot in portrait) display sideways once every other tag was stripped; this keeps just
// enough for the browser to auto-rotate without keeping anything privacy-sensitive.
function buildMinimalOrientationApp1(orientation: number): number[] {
  const tiffAndIfd = [
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // "II", 42, offset to IFD0 = 8
    0x01, 0x00, // 1 IFD entry
    0x12, 0x01, // tag 0x0112 Orientation
    0x03, 0x00, // type SHORT
    0x01, 0x00, 0x00, 0x00, // count 1
    orientation & 0xff, 0x00, 0x00, 0x00, // value + padding
    0x00, 0x00, 0x00, 0x00, // next IFD offset = none
  ];
  const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
  const payload = [...exifHeader, ...tiffAndIfd];
  const length = payload.length + 2; // length field counts itself
  return [0xff, 0xe1, (length >> 8) & 0xff, length & 0xff, ...payload];
}

export function stripJpegMetadata(bytes: Uint8Array, orientation?: number): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes; // not a JPEG, leave as-is
  const out: number[] = [0xff, 0xd8];
  if (orientation && orientation >= 1 && orientation <= 8 && orientation !== 1) {
    out.push(...buildMinimalOrientationApp1(orientation));
  }
  let i = 2;
  while (i < bytes.length - 1) {
    if (bytes[i] !== 0xff) {
      // Not a marker boundary (shouldn't happen before SOS) — bail out safely.
      for (let j = i; j < bytes.length; j++) out.push(bytes[j]);
      break;
    }
    const marker = bytes[i + 1];
    if (marker === 0xda) {
      // Start of Scan — everything from here to EOI is compressed image data, copy verbatim.
      for (let j = i; j < bytes.length; j++) out.push(bytes[j]);
      break;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      // Markers with no length field.
      out.push(0xff, marker);
      i += 2;
      continue;
    }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    const isMetadata = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe; // APPn or COM
    if (!isMetadata) {
      for (let j = i; j < i + 2 + length; j++) out.push(bytes[j]);
    }
    i += 2 + length;
  }
  return new Uint8Array(out);
}

export function stripPngMetadata(bytes: Uint8Array): Uint8Array {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!sig.every((b, idx) => bytes[idx] === b)) return bytes; // not a PNG
  const out: number[] = [...sig];
  let i = 8;
  const strip = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME", "pHYs"]);
  while (i < bytes.length) {
    const length = (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3];
    const type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
    const chunkTotal = 4 + 4 + length + 4;
    if (!strip.has(type)) {
      for (let j = i; j < i + chunkTotal; j++) out.push(bytes[j]);
    }
    i += chunkTotal;
    if (type === "IEND") break;
  }
  return new Uint8Array(out);
}
