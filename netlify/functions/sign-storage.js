import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_BUCKETS = new Set(["datasets", "step-images", "sops"]);

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const getBearerToken = (headers) => {
  const authHeader =
    headers.authorization || headers.Authorization || headers.AUTHORIZATION;
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
};

const sanitizeTransform = (transform) => {
  if (!transform || typeof transform !== "object") return undefined;
  const output = {};
  if (Number.isFinite(Number(transform.width))) {
    output.width = Number(transform.width);
  }
  if (Number.isFinite(Number(transform.height))) {
    output.height = Number(transform.height);
  }
  if (transform.resize) output.resize = String(transform.resize);
  if (transform.format) output.format = String(transform.format);
  if (Number.isFinite(Number(transform.quality))) {
    output.quality = Number(transform.quality);
  }
  return Object.keys(output).length ? output : undefined;
};

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: "Missing Supabase env vars" });
  }

  const token = getBearerToken(event.headers || {});
  if (!token) {
    return jsonResponse(401, { error: "Missing authorization token" });
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload" });
  }

  const bucket = String(payload.bucket || "");
  const path = String(payload.path || "");
  const expiresIn = Number.isFinite(Number(payload.expiresIn))
    ? Number(payload.expiresIn)
    : 3600;
  const transform = sanitizeTransform(payload.transform);

  if (!bucket || !path) {
    return jsonResponse(400, { error: "bucket and path are required" });
  }
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return jsonResponse(403, { error: "Bucket not allowed" });
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } =
    await authClient.auth.getUser(token);
  if (authError || !authData?.user) {
    return jsonResponse(401, { error: "Invalid auth token" });
  }

  let signed = null;
  if (transform) {
    const { data, error } = await serviceClient.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn, { transform });
    if (!error && data?.signedUrl) {
      signed = data.signedUrl;
    }
  }

  if (!signed) {
    const { data, error } = await serviceClient.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);
    if (error || !data?.signedUrl) {
      return jsonResponse(400, { error: error?.message || "Failed to sign URL" });
    }
    signed = data.signedUrl;
  }

  return jsonResponse(200, { signedUrl: signed });
};
