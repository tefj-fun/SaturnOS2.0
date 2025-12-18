import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  } catch (err) {
    return jsonResponse(400, { error: "Invalid JSON payload" });
  }

  const {
    email,
    fullName,
    role = "viewer",
    projectId,
    projectRole = "viewer",
    permissions = [],
  } = payload;

  if (!email) {
    return jsonResponse(400, { error: "email is required" });
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

  const requesterId = authData.user.id;

  const { data: requesterProfile } = await serviceClient
    .from("profiles")
    .select("role, status")
    .eq("id", requesterId)
    .single();

  const isAdmin =
    requesterProfile?.role === "admin" &&
    requesterProfile?.status === "active";

  let isOwner = false;
  if (projectId) {
    const { data: memberRow } = await serviceClient
      .from("project_members")
      .select("role")
      .eq("project_id", projectId)
      .eq("user_id", requesterId)
      .single();
    isOwner = memberRow?.role === "owner" || memberRow?.role === "admin";
  }

  if (!isAdmin && !(projectId && isOwner)) {
    return jsonResponse(403, { error: "Not authorized to invite users" });
  }

  const { data: inviteData, error: inviteError } =
    await serviceClient.auth.admin.inviteUserByEmail(email, {
      data: { role },
    });

  if (inviteError || !inviteData?.user) {
    return jsonResponse(500, { error: inviteError?.message || "Invite failed" });
  }

  const invitedUserId = inviteData.user.id;

  await serviceClient.from("profiles").upsert(
    {
      id: invitedUserId,
      email,
      full_name: fullName || email,
      role,
      status: "invited",
    },
    { onConflict: "id" }
  );

  if (projectId) {
    await serviceClient.from("project_members").upsert(
      {
        project_id: projectId,
        user_id: invitedUserId,
        user_email: email,
        user_name: fullName || email.split("@")[0],
        role: projectRole,
        permissions,
        status: "pending",
        invited_by: requesterId,
        invited_date: new Date().toISOString(),
      },
      { onConflict: "project_id,user_email" }
    );
  }

  return jsonResponse(200, {
    invited: true,
    userId: invitedUserId,
    projectId: projectId || null,
  });
};
