/**
 * Client-side image downscaling for uploads.
 *
 * Phones produce 8MP+ photos; a profile avatar renders at ~50px. Downscaling
 * before upload keeps requests fast on mobile connections. The backend
 * re-normalizes regardless (512px webp), so this is a bandwidth optimization,
 * not the source of truth.
 */

const MAX_INPUT_BYTES = 10 * 1024 * 1024; // refuse absurd inputs outright

export async function downscaleImageToDataUrl(file, { maxDimension = 1024, quality = 0.85 } = {}) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Image is too large (max 10MB). Please choose a smaller photo.');
  }

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  if (bitmap.close) bitmap.close();

  // Prefer webp; some older Safari versions silently return PNG for webp
  // requests, so fall back to jpeg if webp didn't actually happen.
  let dataUrl = canvas.toDataURL('image/webp', quality);
  if (!dataUrl.startsWith('data:image/webp')) {
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}

function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read the image.')); };
    img.src = url;
  });
}
