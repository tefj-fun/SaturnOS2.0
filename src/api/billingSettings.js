import { supabase } from "./supabaseClient";

const DEFAULT_BILLING_KEY = "default";

export async function fetchBillingSettings() {
  const { data, error } = await supabase
    .from("billing_settings")
    .select("monthly_spend_cap")
    .eq("key", DEFAULT_BILLING_KEY)
    .maybeSingle();
  if (error) throw error;
  return data || { monthly_spend_cap: null };
}

export async function upsertBillingSettings({ monthlySpendCap }) {
  const payload = {
    key: DEFAULT_BILLING_KEY,
    monthly_spend_cap: monthlySpendCap,
  };

  const { data, error } = await supabase
    .from("billing_settings")
    .upsert(payload, { onConflict: "key" })
    .select()
    .single();
  if (error) throw error;
  return data;
}
