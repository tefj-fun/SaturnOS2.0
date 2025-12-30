import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function getBearerToken(headers) {
  const authHeader =
    headers.authorization || headers.Authorization || headers.AUTHORIZATION;
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

function getOrigin(headers) {
  const origin =
    headers.origin ||
    headers.Origin ||
    headers.REFERER ||
    headers.referer ||
    "";
  if (!origin) return "http://localhost:8888";
  try {
    const url = new URL(origin);
    return url.origin;
  } catch {
    return origin.split("/").slice(0, 3).join("/");
  }
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  if (
    !stripe ||
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    return jsonResponse(500, { error: "Missing Stripe or Supabase env vars" });
  }

  const token = getBearerToken(event.headers || {});
  if (!token) {
    return jsonResponse(401, { error: "Missing authorization token" });
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

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", authData.user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return jsonResponse(400, { error: "No Stripe customer on file" });
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    payload = {};
  }

  const origin = getOrigin(event.headers || {});
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: payload.returnUrl || `${origin}/billing`,
  });

  return jsonResponse(200, { url: session.url });
};
