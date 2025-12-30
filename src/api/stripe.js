import { supabase } from "@/api/supabaseClient";

const CHECKOUT_URL =
  import.meta.env.VITE_STRIPE_CHECKOUT_URL ||
  "/.netlify/functions/stripe-checkout";
const PORTAL_URL =
  import.meta.env.VITE_STRIPE_PORTAL_URL || "/.netlify/functions/stripe-portal";

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message || "Unable to fetch auth session");
  }
  const token = data?.session?.access_token;
  if (!token) {
    throw new Error("Sign in required");
  }
  return token;
}

async function postJson(url, body) {
  const token = await getAccessToken();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body || {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "Request failed");
  }
  return payload;
}

export async function startCheckout({ plan, priceId, successUrl, cancelUrl }) {
  return postJson(CHECKOUT_URL, { plan, priceId, successUrl, cancelUrl });
}

export async function createPortalSession({ returnUrl } = {}) {
  return postJson(PORTAL_URL, { returnUrl });
}
