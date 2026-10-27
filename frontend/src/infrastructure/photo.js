// Adaptador de imagen del navegador: reduce peso antes de enviar al servidor.
const MAX_BYTES = 4 * 1024 * 1024;
export const photoSize = (bytes) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
export function canvasJpeg(canvas, quality = 0.9) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("No se pudo preparar la foto.")),
      "image/jpeg",
      quality,
    ),
  );
}
function dataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer la foto."));
    reader.readAsDataURL(blob);
  });
}
export async function preparePhoto(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Usa la cámara o selecciona una foto JPG, PNG o WebP.");
  if (file.size > 25 * 1024 * 1024)
    throw new Error(
      "La imagen original supera 25 MB. Toma otra foto de menor tamaño.",
    );
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "No se pudo abrir esa foto. Toma otra o selecciona JPG, PNG o WebP.",
    );
  }
  try {
    const ratio = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    if (Math.min(canvas.width, canvas.height) < 480)
      throw new Error(
        "La foto es demasiado pequeña. Tómala con más resolución para ver el equipo completo.",
      );
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob = await canvasJpeg(canvas, 0.9);
    if (blob.size > MAX_BYTES) blob = await canvasJpeg(canvas, 0.85);
    if (blob.size > MAX_BYTES)
      throw new Error(
        "No se pudo reducir la foto a 4 MB manteniendo el detalle. Toma otra con buena luz y un fondo sencillo.",
      );
    const preview = await dataUrl(blob);
    return {
      base64: preview.split(",")[1],
      preview,
      width: canvas.width,
      height: canvas.height,
      size: blob.size,
      originalSize: file.size,
    };
  } finally {
    bitmap.close();
  }
}
