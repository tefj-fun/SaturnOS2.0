import { supabase } from "./supabaseClient";

const DEFAULT_BUCKET = "sops";
const CONTENT_TYPE_BY_EXT = {
  ".yaml": "text/plain",
  ".yml": "text/plain",
  ".txt": "text/plain",
  ".names": "text/plain",
  ".json": "application/json",
  ".csv": "text/csv",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
};

const YAML_TYPES = new Set(["text/yaml", "application/x-yaml", "application/yaml"]);

const guessContentType = (file, path, options) => {
  if (options?.contentType) return options.contentType;
  if (file?.type && !YAML_TYPES.has(file.type)) return file.type;
  const name = (path || file?.name || "").toLowerCase();
  const ext = name.includes(".") ? `.${name.split(".").pop()}` : "";
  return CONTENT_TYPE_BY_EXT[ext] || "application/octet-stream";
};

const withContentType = (file, contentType, fallbackName) => {
  if (!contentType || typeof Blob === "undefined" || !(file instanceof Blob)) return file;
  const existingType = file.type || "";
  if (existingType === contentType) return file;
  if (typeof File !== "undefined" && file instanceof File) {
    return new File([file], file.name || fallbackName, { type: contentType });
  }
  return new Blob([file], { type: contentType });
};

export function getStoragePathFromUrl(url, bucket) {
  if (!url || !bucket) return null;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const publicPrefix = `/storage/v1/object/public/${bucket}/`;
    const signedPrefix = `/storage/v1/object/sign/${bucket}/`;
    const objectPrefix = `/storage/v1/object/${bucket}/`;

    if (path.includes(publicPrefix)) {
      return decodeURIComponent(path.split(publicPrefix)[1]);
    }
    if (path.includes(signedPrefix)) {
      return decodeURIComponent(path.split(signedPrefix)[1]);
    }
    if (path.includes(objectPrefix)) {
      return decodeURIComponent(path.split(objectPrefix)[1]);
    }
  } catch {
    return null;
  }
  return null;
}

export async function createSignedImageUrl(bucket, path, { expiresIn = 3600, transform } = {}) {
  if (!path) return null;
  const storage = supabase.storage.from(bucket);

  if (transform) {
    const { data, error } = await storage.createSignedUrl(path, expiresIn, { transform });
    if (!error && data?.signedUrl) return data.signedUrl;
  }

  const { data, error } = await storage.createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
}

export async function uploadToSupabaseStorage(file, path, bucketOrOptions = DEFAULT_BUCKET) {
  if (!file) throw new Error("No file provided");
  let bucket = DEFAULT_BUCKET;
  let options = {};
  if (typeof bucketOrOptions === "string") {
    bucket = bucketOrOptions;
  } else if (bucketOrOptions && typeof bucketOrOptions === "object") {
    bucket = bucketOrOptions.bucket || DEFAULT_BUCKET;
    options = bucketOrOptions;
  }
  // Avoid leading slashes so Supabase doesn't treat it as absolute
  const cleanPath = path?.replace(/^\/+/, "");
  const fallbackName = file?.name || "upload.bin";
  const objectPath = cleanPath || `${Date.now()}-${fallbackName}`;
  const contentType = guessContentType(file, objectPath, options);
  const uploadBody = withContentType(file, contentType, fallbackName);
  const uploadOptions = { upsert: true, cacheControl: "3600" };
  if (contentType) {
    uploadOptions.contentType = contentType;
  }

  // Upload with upsert to allow replacing
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, uploadBody, uploadOptions);

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return { path: data.path, publicUrl: urlData?.publicUrl };
}
