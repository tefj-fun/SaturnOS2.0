import { supabase } from "./supabaseClient";

// Projects
export async function listProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createProject(projectData) {
  const { data, error } = await supabase
    .from("projects")
    .insert(projectData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(projectId, updates) {
  const { error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", projectId);
  if (error) throw error;
}

export async function deleteProject(projectId) {
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);
  if (error) throw error;
}

// SOP Steps
export async function listStepsByProject(projectId) {
  const { data, error } = await supabase
    .from("sop_steps")
    .select("*")
    .eq("project_id", projectId)
    .order("step_number", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function deleteStepsByProject(projectId) {
  const { error } = await supabase
    .from("sop_steps")
    .delete()
    .eq("project_id", projectId);
  if (error) throw error;
}
