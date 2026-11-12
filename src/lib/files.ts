"use client";

/**
 * Read a receipt/proof photo and downscale it to a reasonably sized JPEG data
 * URL. This demo keeps images in SQLite; production would use object storage.
 */
export async function imageFileToDataUrl(
  file: File,
  maxDimension = 1200,
  quality = 0.72,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("That image is larger than 12 MB.");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });

  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    if (dataUrl.length > 3_000_000) {
      throw new Error("That image is too large after encoding.");
    }
    return dataUrl;
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not open that image."));
    img.src = dataUrl;
  });

  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;
  context.drawImage(image, 0, 0, width, height);
  const compressed = canvas.toDataURL("image/jpeg", quality);

  return compressed.length < dataUrl.length ? compressed : dataUrl;
}

export function formatFileKb(dataUrl: string): string {
  const base64 = dataUrl.split(",")[1] ?? "";
  const bytes = Math.floor((base64.length * 3) / 4);
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
