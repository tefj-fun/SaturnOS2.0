import { supabase } from "./supabaseClient";

const DEFAULT_BUCKET = "sops";
const SIGNED_URL_CONCURRENCY = 6;
const SIGNED_URL_CACHE_BUFFER_MS = 30 * 1000;
const SIGNED_URL_CACHE_MAX_ENTRIES = 2000;
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
const signedUrlCache = new Map();
const signedUrlInFlight = new Map();

const createLimiter = (limit) => {
  let activeCount = 0;
  const queue = [];

  const next = () => {
    if (activeCount >= limit || queue.length === 0) return;
    const { fn, resolve, reject } = queue.shift();
    activeCount += 1;
    Promise.resolve()
      .then(fn)
      .then(resolve, reject)
      .finally(() => {
        activeCount -= 1;
        next();
      });
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
};

const signedUrlLimiter = createLimiter(SIGNED_URL_CONCURRENCY);

const stableStringify = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${key}:${stableStringify(value[key])}`).join(",")}}`;
};

const buildSignedUrlCacheKey = (bucket, path, expiresIn, transform) =>
  `${bucket}::${path}::${expiresIn}::${stableStringify(transform)}`;

const getCachedSignedUrl = (key) => {
  const entry = signedUrlCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt - Date.now() <= SIGNED_URL_CACHE_BUFFER_MS) {
    signedUrlCache.delete(key);
    return null;
  }
  return entry.url;
};

const pruneSignedUrlCache = () => {
  if (signedUrlCache.size <= SIGNED_URL_CACHE_MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of signedUrlCache.entries()) {
    if (!entry || entry.expiresAt <= now) {
      signedUrlCache.delete(key);
    }
    if (signedUrlCache.size <= SIGNED_URL_CACHE_MAX_ENTRIES) return;
  }
};

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
    const renderPublicPrefix = `/storage/v1/render/image/public/${bucket}/`;
    const renderSignedPrefix = `/storage/v1/render/image/sign/${bucket}/`;

    if (path.includes(publicPrefix)) {
      return decodeURIComponent(path.split(publicPrefix)[1]);
    }
    if (path.includes(signedPrefix)) {
      return decodeURIComponent(path.split(signedPrefix)[1]);
    }
    if (path.includes(objectPrefix)) {
      return decodeURIComponent(path.split(objectPrefix)[1]);
    }
    if (path.includes(renderPublicPrefix)) {
      return decodeURIComponent(path.split(renderPublicPrefix)[1]);
    }
    if (path.includes(renderSignedPrefix)) {
      return decodeURIComponent(path.split(renderSignedPrefix)[1]);
    }
  } catch {
    return null;
  }
  return null;
}

export async function createSignedImageUrl(bucket, path, { expiresIn = 3600, transform } = {}) {
  if (!path) return null;
  const cacheKey = buildSignedUrlCacheKey(bucket, path, expiresIn, transform);
  const cached = getCachedSignedUrl(cacheKey);
  if (cached) return cached;
  if (signedUrlInFlight.has(cacheKey)) return signedUrlInFlight.get(cacheKey);
  const storage = supabase.storage.from(bucket);

  const requestPromise = signedUrlLimiter(async () => {
    if (transform) {
      const { data, error } = await storage.createSignedUrl(path, expiresIn, { transform });
      if (!error && data?.signedUrl) return data.signedUrl;
    }

    const { data, error } = await storage.createSignedUrl(path, expiresIn);
    if (error) throw error;
    return data?.signedUrl || null;
  });

  signedUrlInFlight.set(cacheKey, requestPromise);
  try {
    const signedUrl = await requestPromise;
    if (signedUrl) {
      signedUrlCache.set(cacheKey, {
        url: signedUrl,
        expiresAt: Date.now() + Math.max(expiresIn, 1) * 1000,
      });
      pruneSignedUrlCache();
    }
    return signedUrl;
  } finally {
    signedUrlInFlight.delete(cacheKey);
  }
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
