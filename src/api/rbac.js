export const PROJECT_ROLE_PERMISSIONS = {
  owner: [
    "view_project",
    "edit_project",
    "delete_project",
    "manage_steps",
    "upload_datasets",
    "annotate",
    "train_models",
    "view_results",
    "manage_members",
    "export_data",
  ],
  editor: [
    "view_project",
    "edit_project",
    "manage_steps",
    "upload_datasets",
    "annotate",
    "train_models",
    "view_results",
    "export_data",
  ],
  annotator: [
    "view_project",
    "upload_datasets",
    "annotate",
    "train_models",
    "view_results",
  ],
  viewer: ["view_project", "view_results"],
};

export function getPermissionsForProjectRole(role) {
  return PROJECT_ROLE_PERMISSIONS[role] || [];
}
