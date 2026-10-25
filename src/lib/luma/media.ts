const DB = "luma-media";
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open media storage"));
  });
}

export async function saveMedia(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save that file"));
  });
  db.close();
}

export async function loadMedia(id: string): Promise<string | null> {
  const db = await openDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Could not read that file"));
  });
  db.close();
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

function blobToData(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that image"));
    reader.readAsDataURL(blob);
  });
}

export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1280;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare that image");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((next) => (next ? resolve(next) : reject(new Error("Could not prepare that image"))), "image/jpeg", 0.74);
  });
  return blobToData(blob);
}

export async function pixelate(dataUrl: string): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const tiny = document.createElement("canvas");
  const w = 28;
  const h = Math.max(1, Math.round((img.height / img.width) * w));
  tiny.width = w;
  tiny.height = h;
  const tinyCtx = tiny.getContext("2d");
  if (!tinyCtx) throw new Error("Could not prepare a teaser");
  tinyCtx.drawImage(img, 0, 0, w, h);
  const out = document.createElement("canvas");
  out.width = 480;
  out.height = Math.max(1, Math.round(480 * (h / w)));
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Could not prepare a teaser");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tiny, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.62);
}

export function capturePoster(file: File): Promise<{ poster: string; duration: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    const fail = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that video"));
    };
    video.onerror = fail;
    video.onloadeddata = () => {
      const target = Number.isFinite(video.duration) ? Math.min(0.3, video.duration / 3) : 0;
      if (target <= 0) {
        draw();
        return;
      }
      video.currentTime = target;
    };
    video.onseeked = draw;
    function draw() {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 960;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        fail();
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const seconds = Number.isFinite(video.duration) ? video.duration : 0;
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      URL.revokeObjectURL(url);
      resolve({
        poster: canvas.toDataURL("image/jpeg", 0.72),
        duration: `${m}:${s.toString().padStart(2, "0")}`,
      });
    }
  });
}
