/**
 * Shrinks photos on the phone before they go to the server, so a 5 MB camera photo becomes a small JPEG.
 * Logos are cropped to a square from the centre; cover photos keep their shape.
 */
export type ImageKind = 'logo' | 'cover';

const LIMIT: Record<ImageKind, number> = { logo: 380_000, cover: 600_000 }; // data URL length, under the server's caps

export async function shrinkImage(file: File, kind: ImageKind): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  let side = kind === 'logo' ? 320 : 1400;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (kind === 'logo') {
      const s = Math.min(bitmap.width, bitmap.height);
      canvas.width = canvas.height = Math.min(side, s);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, (bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s, 0, 0, canvas.width, canvas.height);
      // Logos often have a clear background: keep PNG when it is small enough.
      const png = canvas.toDataURL('image/png');
      if (png.length <= LIMIT.logo) return png;
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    }
    const jpg = canvas.toDataURL('image/jpeg', 0.82);
    if (jpg.length <= LIMIT[kind]) return jpg;
    side = Math.round(side * 0.75);
  }
  throw new Error('image_too_large');
}
