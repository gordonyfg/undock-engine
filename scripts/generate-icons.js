import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Simple CRC32 implementation
function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }

  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([len, typeAndData, crcBuf]);
}

function generatePng(size) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0); // width
  ihdrData.writeUInt32BE(size, 4); // height
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(6, 9); // color type 6: RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Scanlines: raw pixel data
  // Color: Blue #1a73e8 (R: 26, G: 115, B: 232, A: 255)
  // Inside: white icon shape
  const rowLength = size * 4 + 1; // 1 filter byte per row
  const rawData = Buffer.alloc(rowLength * size);

  for (let y = 0; y < size; y++) {
    const rowStart = y * rowLength;
    rawData[rowStart] = 0; // Filter: None

    for (let x = 0; x < size; x++) {
      const pixelStart = rowStart + 1 + x * 4;

      // Rounded rectangle boundary
      const radius = Math.max(2, Math.floor(size * 0.2));
      const inBox =
        x >= 1 &&
        x < size - 1 &&
        y >= 1 &&
        y < size - 1;

      // Draw undock icon: background blue with white arrow/window
      if (inBox) {
        // Base rounded rect in Blue #1a73e8
        let r = 26, g = 115, b = 232, a = 255;

        // Draw an inner window / arrow in white
        const margin = Math.floor(size * 0.25);
        const innerSize = size - margin * 2;
        const isBorder = (x === margin || x === size - margin || y === margin || y === size - margin) &&
                         (x >= margin && x <= size - margin && y >= margin && y <= size - margin);
        const isArrow = (x + y >= size && x >= size - margin - 2 && y <= margin + 2);

        if (isBorder || isArrow) {
          r = 255; g = 255; b = 255; a = 255;
        }

        rawData[pixelStart] = r;
        rawData[pixelStart + 1] = g;
        rawData[pixelStart + 2] = b;
        rawData[pixelStart + 3] = a;
      } else {
        // Transparent
        rawData[pixelStart] = 0;
        rawData[pixelStart + 1] = 0;
        rawData[pixelStart + 2] = 0;
        rawData[pixelStart + 3] = 0;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.resolve('icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 48, 128].forEach((size) => {
  const pngBuf = generatePng(size);
  const filePath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, pngBuf);
  console.log(`Generated icon: ${filePath} (${pngBuf.length} bytes)`);
});
