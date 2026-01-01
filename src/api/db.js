import { supabase } from "./supabaseClient";
import { getPermissionsForProjectRole } from "./rbac";

// Projects
export async function listProjects() {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getProjectById(id) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createProject(projectData) {
  const { data: authData } = await supabase.auth.getSession();
  const currentUser = authData?.session?.user;
  const requireAuth = import.meta.env.VITE_SUPABASE_REQUIRE_AUTH === "true";
  if (!currentUser && requireAuth) {
    throw new Error("Sign in required to create a project.");
  }
  const payload = {
    ...projectData,
    created_by: currentUser?.id || null,
  };
  const { data, error } = await supabase
    .from("projects")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  if (!currentUser) {
    return data;
  }
  if (currentUser) {
    const ownerPermissions = getPermissionsForProjectRole("owner");
    const memberPayload = {
      project_id: data.id,
      user_id: currentUser.id,
      user_email: currentUser.email,
      user_name:
        currentUser.user_metadata?.full_name || currentUser.email,
      role: "owner",
      permissions: ownerPermissions,
      status: "active",
      joined_date: new Date().toISOString(),
    };
    const { error: memberError } = await supabase
      .from("project_members")
      .insert(memberPayload);
    if (memberError) {
      if (requireAuth) {
        throw memberError;
      }
      console.error("Failed to create project owner membership:", memberError);
    }
  }
  return data;
}

export async function updateProject(projectId, updates) {
  const { error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", projectId);
  if (error) throw error;
}

async function deletePendingTrainingRuns(projectIds) {
  if (!Array.isArray(projectIds) || projectIds.length === 0) return;
  const { error } = await supabase
    .from("training_runs")
    .delete()
    .in("project_id", projectIds)
    .in("status", ["queued"]);
  if (error) throw error;
}

export async function deleteProject(projectId) {
  await deletePendingTrainingRuns([projectId]);
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);
  if (error) throw error;
}

export async function deleteProjects(projectIds) {
  if (!Array.isArray(projectIds) || projectIds.length === 0) return;
  await deletePendingTrainingRuns(projectIds);
  const { error } = await supabase
    .from("projects")
    .delete()
    .in("id", projectIds);
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

export async function listAllSteps() {
  const { data, error } = await supabase
    .from("sop_steps")
    .select("*");
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

export async function createStep(stepData) {
  const { data, error } = await supabase
    .from("sop_steps")
    .insert(stepData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function bulkCreateSteps(steps) {
  const { error } = await supabase.from("sop_steps").insert(steps);
  if (error) throw error;
}

export async function updateStep(stepId, updates) {
  const { error } = await supabase
    .from("sop_steps")
    .update(updates)
    .eq("id", stepId);
  if (error) throw error;
}

export async function deleteStep(stepId) {
  const { error } = await supabase
    .from("sop_steps")
    .delete()
    .eq("id", stepId);
  if (error) throw error;
}

// Training runs (lightweight for dashboard)
export async function listTrainingRuns(limit = 10) {
  const { data, error } = await supabase
    .from("training_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

// Step images
export async function listStepImages(stepId) {
  const { data, error } = await supabase
    .from("step_images")
    .select("*")
    .eq("step_id", stepId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createStepImage(imageData) {
  const { data, error } = await supabase
    .from("step_images")
    .insert(imageData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createStepImages(imageData) {
  if (!Array.isArray(imageData) || imageData.length === 0) return [];
  const { error } = await supabase
    .from("step_images")
    .insert(imageData);
  if (error) throw error;
  return [];
}

export async function updateStepImage(imageId, updates) {
  const { error } = await supabase
    .from("step_images")
    .update(updates)
    .eq("id", imageId);
  if (error) throw error;
}

export async function deleteStepImage(imageId) {
  const { error } = await supabase
    .from("step_images")
    .delete()
    .eq("id", imageId);
  if (error) throw error;
}

export async function deleteStepImages(imageIds) {
  if (!Array.isArray(imageIds) || imageIds.length === 0) return;
  const { error } = await supabase
    .from("step_images")
    .delete()
    .in("id", imageIds);
  if (error) throw error;
}
