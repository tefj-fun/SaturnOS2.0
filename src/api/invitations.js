import { supabase } from "./supabaseClient";

const INVITE_USER_URL =
  import.meta.env.VITE_INVITE_USER_URL || "/.netlify/functions/invite-user";

export async function inviteUser(payload) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data?.session?.access_token;
  if (!token) {
    throw new Error("Missing auth session");
  }

  const response = await fetch(INVITE_USER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Invite failed");
  }

  return response.json();
}
