/**
 * iPhone photos are often HEIC/HEIF, sometimes even when the file is
 * named .jpg. The backend checks the real file content and only accepts
 * JPEG, PNG and WebP, so HEIC is converted to JPEG in the browser first.
 */

const HEIF_BRANDS = ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1", "avci"];

/** True if the file's bytes (not its name or type) say HEIC/HEIF. */
export async function isHeif(file: File): Promise<boolean> {
  if (/^image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name)) return true;
  const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const text = String.fromCharCode(...header);
  if (text.slice(4, 8) !== "ftyp") return false;
  // Major brand at 8–12, compatible brands after offset 16.
  const brands = [text.slice(8, 12), ...(text.slice(16).match(/.{4}/g) ?? [])];
  return brands.some((brand) => HEIF_BRANDS.includes(brand));
}

function jpegName(name: string) {
  return `${name.replace(/\.[^.]+$/, "") || "photo"}.jpg`;
}

/** Safari (and anything else that can decode HEIC natively) — no library needed. */
async function convertNatively(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  } catch {
    return null;
  }
}

/**
 * Returns a file the backend will accept: HEIC/HEIF becomes JPEG, anything
 * else is returned unchanged. Throws if a HEIC photo can't be converted.
 */
export async function normalizeImageFile(file: File): Promise<File> {
  if (!(await isHeif(file))) return file;

  let blob = await convertNatively(file);
  if (!blob) {
    // Chrome/Firefox can't decode HEIC — load the converter only now.
    const { default: heic2any } = await import("heic2any");
    const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    blob = Array.isArray(result) ? result[0] : result;
  }
  if (!blob) throw new Error("Couldn't convert this photo.");
  return new File([blob], jpegName(file.name), { type: "image/jpeg", lastModified: file.lastModified });
}
