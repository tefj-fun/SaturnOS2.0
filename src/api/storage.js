import { supabase } from "./supabaseClient";

const DEFAULT_BUCKET = "sops";

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
  } catch (error) {
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

export async function uploadToSupabaseStorage(file, path, bucket = DEFAULT_BUCKET) {
  if (!file) throw new Error("No file provided");
  // Avoid leading slashes so Supabase doesn't treat it as absolute
  const cleanPath = path?.replace(/^\/+/, "");
  const objectPath = cleanPath || `${Date.now()}-${file.name}`;

  // Upload with upsert to allow replacing
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, file, { upsert: true, cacheControl: "3600" });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return { path: data.path, publicUrl: urlData?.publicUrl };
}
