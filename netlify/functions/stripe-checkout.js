import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_STARTER_ID = process.env.STRIPE_PRICE_STARTER_ID;
const STRIPE_PRICE_TEAM_ID = process.env.STRIPE_PRICE_TEAM_ID;
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

const PLAN_PRICE_IDS = {
  starter: STRIPE_PRICE_STARTER_ID,
  team: STRIPE_PRICE_TEAM_ID,
};

const ALLOWED_PRICE_IDS = Object.values(PLAN_PRICE_IDS).filter(Boolean);

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

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload" });
  }

  const { priceId, plan, successUrl, cancelUrl } = payload;
  const resolvedPriceId = priceId || PLAN_PRICE_IDS[plan];
  if (!resolvedPriceId) {
    return jsonResponse(400, { error: "priceId or plan is required" });
  }
  if (priceId && !ALLOWED_PRICE_IDS.includes(priceId)) {
    return jsonResponse(400, { error: "priceId not allowed" });
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

  const user = authData.user;
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, email, stripe_customer_id")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id || null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email || user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await serviceClient
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const origin = getOrigin(event.headers || {});
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    allow_promotion_codes: true,
    line_items: [{ price: resolvedPriceId, quantity: 1 }],
    success_url: successUrl || `${origin}/billing?checkout=success`,
    cancel_url: cancelUrl || `${origin}/pricing`,
    client_reference_id: user.id,
    metadata: {
      supabase_user_id: user.id,
    },
  });

  return jsonResponse(200, { url: session.url });
};
