import { supabase } from "./supabaseClient";

export async function listProjectMembers(projectId) {
  const { data, error } = await supabase
    .from("project_members")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getProjectMembership(projectId, userId) {
  const { data, error } = await supabase
    .from("project_members")
    .select("role, permissions, status")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function createProjectMember(member) {
  const { data, error } = await supabase
    .from("project_members")
    .insert(member)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function upsertProjectMember(member, onConflict = "project_id,user_email") {
  const { data, error } = await supabase
    .from("project_members")
    .upsert(member, { onConflict })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProjectMember(memberId, updates) {
  const { data, error } = await supabase
    .from("project_members")
    .update(updates)
    .eq("id", memberId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProjectMember(memberId) {
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("id", memberId);
  if (error) throw error;
}
