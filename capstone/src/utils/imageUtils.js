// Crops a picked image to a small square JPEG data URL for profile pictures
export const MAX_AVATAR_SOURCE_BYTES = 8 * 1024 * 1024; // refuse absurdly large originals

export function fileToAvatarDataUrl(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }
    if (file.size > MAX_AVATAR_SOURCE_BYTES) {
      reject(new Error("That image is too large — please choose one under 8 MB."));
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;

      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      // Paint white first, since JPEG has no transparency
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image. Try a JPG or PNG."));
    };

    img.src = url;
  });
}
