"use client";

const MAX_IMAGE_WIDTH = 1080;
const INITIAL_QUALITY = 0.78;
const MIN_QUALITY = 0.7;
const TARGET_MAX_BYTES = 800 * 1024;

function canCompressImage(file: File) {
  if (file.type === "image/gif") return false;
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(file.name);
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image decode failed."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

export async function compressImageForUpload(file: File) {
  if (!canCompressImage(file)) return file;

  try {
    const image = await loadImage(file);
    const scale = Math.min(MAX_IMAGE_WIDTH / image.naturalWidth, 1);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(image, 0, 0, width, height);

    const outputType = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
    let quality = INITIAL_QUALITY;
    let blob = await canvasToBlob(canvas, outputType, quality);

    while (blob && blob.size > TARGET_MAX_BYTES && quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - 0.04);
      blob = await canvasToBlob(canvas, outputType, quality);
    }

    if (!blob || blob.size >= file.size) return file;

    const extension = outputType === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.${extension}`, {
      type: outputType,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
