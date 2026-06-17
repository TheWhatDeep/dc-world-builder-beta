// Image processing pipeline. Every uploaded image yields a bounded display copy and a
// small thumbnail (both webp), while the original bytes are preserved for export fidelity.
import sharp from 'sharp';

// sharp can leak memory across many large images; cap its cache modestly.
sharp.cache({ items: 50, memory: 64 });

const DISPLAY_QUALITY = 82;
const THUMB_QUALITY = 76;

// Decode + re-encode defensively: `failOn: 'none'` tolerates slightly malformed files,
// `.rotate()` bakes in EXIF orientation (phones rely on it), `withoutEnlargement` avoids
// upscaling small source images.
function pipeline(buf, dim) {
  return sharp(buf, { failOn: 'none' })
    .rotate()
    .resize({ width: dim, height: dim, fit: 'inside', withoutEnlargement: true });
}

// Returns { display, thumb, width, height } where width/height are the ORIGINAL pixel
// dimensions. Throws if the buffer is not a decodable image.
export async function processImage(buf, { maxDim, thumbDim }) {
  const meta = await sharp(buf, { failOn: 'none' }).metadata();
  if (!meta.width || !meta.height) {
    const err = new Error('Unsupported or corrupt image.');
    err.statusCode = 415;
    throw err;
  }
  const [display, thumb] = await Promise.all([
    pipeline(buf, maxDim).webp({ quality: DISPLAY_QUALITY }).toBuffer(),
    pipeline(buf, thumbDim).webp({ quality: THUMB_QUALITY }).toBuffer(),
  ]);
  return { display, thumb, width: meta.width, height: meta.height };
}
