
import { useState, useEffect } from "react";
import { listProjects, createProject, updateProject, deleteProject, deleteProjects, listStepsByProject } from "@/api/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  FileText,
  PenTool,
  CheckCircle,
  Clock,
  Folder,
  MoreVertical,
  Search,
  Filter,
  Trash2,
  X,
  AlertTriangle,
  ArrowUpDown,
  Layers,
  Spline, // New Icon Import for Training Model
  Users // New Icon Import for Users
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import CreateProjectDialog from "../components/projects/CreateProjectDialog";
import EditProjectDialog from "../components/projects/EditProjectDialog";
import DeleteProjectDialog from "../components/projects/DeleteProjectDialog";
import ReviewOnPhoneDialog from "../components/projects/ReviewOnPhoneDialog";
import LoadingOverlay from "../components/projects/LoadingOverlay";
import ProjectMembersDialog from "../components/projects/ProjectMembersDialog";
import { useProjectPermissions } from "../components/rbac/PermissionGate";

// Normalize project created date across legacy and Supabase fields
const getCreatedDate = (project) =>
  project.created_at ||
  project.created_date ||
  project.createdAt ||
  project.createdDate ||
  new Date().toISOString();

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);
  const [reviewingProject, setReviewingProject] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [selectedProjects, setSelectedProjects] = useState(new Set());
  const [showBulkDeleteAlert, setShowBulkDeleteAlert] = useState(false);

  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [selectedProjectForMembers, setSelectedProjectForMembers] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    let processedProjects = projects;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      processedProjects = processedProjects.filter(project =>
        project.name.toLowerCase().includes(query) ||
        (project.description && project.description.toLowerCase().includes(query))
      );
    }

    if (statusFilter !== "all") {
      processedProjects = processedProjects.filter(project => project.status === statusFilter);
    }

    const sortedProjects = [...processedProjects].sort((a, b) => {
      switch (sortOrder) {
        case 'oldest':
          return new Date(getCreatedDate(a)) - new Date(getCreatedDate(b));
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'status': {
          const statusOrder = ['created', 'sop_uploaded', 'steps_generated', 'annotation_in_progress', 'completed'];
          const statusA = statusOrder.indexOf(a.status);
          const statusB = statusOrder.indexOf(b.status);
          if (statusA === -1 && statusB === -1) return 0;
          if (statusA === -1) return 1;
          if (statusB === -1) return -1;
          return statusA - statusB;
        }
        case 'newest':
        default:
          return new Date(getCreatedDate(b)) - new Date(getCreatedDate(a));
      }
    });

    setFilteredProjects(sortedProjects);
  }, [projects, searchQuery, statusFilter, sortOrder]);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await listProjects();
      setProjects(data);
    } catch (error) {
      console.error("Error loading projects:", error);
    }
    setIsLoading(false);
  };

  const getProjectProgress = async (projectId) => {
    try {
      const steps = await listStepsByProject(projectId);
      if (steps.length === 0) return 0;
      const annotatedSteps = steps.filter(step => step.is_annotated).length;
      return Math.round((annotatedSteps / steps.length) * 100);
    } catch {
      return 0;
    }
  };

  const getStatusConfig = (status) => {
    const configs = {
      created: {
        label: "Created",
        color: "bg-gray-100 text-gray-700",
        icon: Clock
      },
      sop_uploaded: {
        label: "SOP Uploaded",
        color: "bg-blue-100 text-blue-700",
        icon: FileText
      },
      steps_generated: {
        label: "Steps Ready",
        color: "bg-amber-100 text-amber-700",
        icon: FileText
      },
      annotation_in_progress: {
        label: "In Progress",
        color: "bg-teal-100 text-teal-700",
        icon: PenTool
      },
      completed: {
        label: "Completed",
        color: "bg-green-100 text-green-700",
        icon: CheckCircle
      }
    };
    return configs[status] || configs.created;
  };

  const handleCreateProject = async (projectData) => {
    try {
      const newProject = await createProject({
        ...projectData,
        created_at: new Date().toISOString()
      });
      setShowCreateDialog(false);
      if (newProject?.id) {
        // Send users straight into setup for the new project
        navigate(`${createPageUrl("ProjectSetup")}?id=${newProject.id}`);
      } else {
        loadProjects();
      }
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

  const handleUpdateProject = async (projectId, projectData) => {
    await updateProject(projectId, projectData);
    setEditingProject(null);
    loadProjects();
  };

  const handleDeleteProject = async (projectId) => {
    setIsDeleting(true);
    try {
      await deleteProject(projectId);
      setDeletingProject(null);

      const newSelected = new Set(selectedProjects);
      newSelected.delete(projectId);
      setSelectedProjects(newSelected);

      loadProjects();
    } catch (error) {
      console.error("Error deleting project:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectProject = (projectId, checked) => {
    const newSelected = new Set(selectedProjects);
    if (checked) {
      newSelected.add(projectId);
    } else {
      newSelected.delete(projectId);
    }
    setSelectedProjects(newSelected);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = new Set(filteredProjects.map(p => p.id));
      setSelectedProjects(allIds);
    } else {
      setSelectedProjects(new Set());
    }
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    setShowBulkDeleteAlert(false);
    try {
      const projectsToDelete = Array.from(selectedProjects);
      await deleteProjects(projectsToDelete);

      setSelectedProjects(new Set());
      loadProjects();
    } catch (error) {
      console.error("Error bulk deleting projects:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setSortOrder("newest");
    setSelectedProjects(new Set());
  };

  const getProjectActions = (project) => {
    const actions = [];

    if (project.status === "created" || project.status === "sop_uploaded") {
      actions.push({
        label: "Setup Project",
        action: () => navigate(createPageUrl(`ProjectSetup?id=${project.id}`)),
        variant: "default",
        customColor: "bg-blue-600 hover:bg-blue-700",
        permission: "edit_project"
      });
    } else if (project.status === "steps_generated") {
      actions.push({
        label: "Review Steps",
        action: () => navigate(createPageUrl(`StepManagement?projectId=${project.id}`)),
        variant: "default",
        customColor: "bg-blue-600 hover:bg-blue-700",
        permission: "manage_steps"
      });
    } else if (project.status === "annotation_in_progress") {
      actions.push({
        label: "Continue Annotation",
        action: () => navigate(createPageUrl(`AnnotationStudio?projectId=${project.id}`)),
        variant: "default",
        customColor: "bg-blue-600 hover:bg-blue-700",
        permission: "annotate"
      });
    } else if (project.status === "completed") {
      actions.push({
        label: "Train Model",
        action: () => {
          console.log("Navigating to training page for project:", project.id);
          navigate(createPageUrl(`TrainingConfiguration?projectId=${project.id}`));
        },
        variant: "default",
        icon: <Spline className="w-4 h-4" />,
        customColor: "bg-green-600 hover:bg-green-700",
        permission: "train_models"
      });
      actions.push({
        label: "View Annotations",
        action: () => navigate(createPageUrl(`AnnotationStudio?projectId=${project.id}`)),
        variant: "outline",
        customColor: "",
        permission: "view_project"
      });
    }

    return actions;
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <LoadingOverlay
        isLoading={isDeleting}
        text="Deleting project(s)... Please wait."
      />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Projects</h1>
            <p className="text-gray-600 text-lg">Manage your annotation projects and SOPs</p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-300"
            size="lg"
            disabled={isDeleting}
          >
            <Plus className="w-5 h-5 mr-2" />
            New Project
          </Button>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center flex-wrap">
            {/* Search */}
            <div className="flex-1 relative min-w-0 w-full sm:min-w-[250px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search projects by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
                disabled={isDeleting}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                  disabled={isDeleting}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-gray-500" />
              <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isDeleting}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="sop_uploaded">SOP Uploaded</SelectItem>
                  <SelectItem value="steps_generated">Steps Ready</SelectItem>
                  <SelectItem value="annotation_in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <ArrowUpDown className="w-4 h-4 text-gray-500" />
              <Select value={sortOrder} onValueChange={setSortOrder} disabled={isDeleting}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="name_asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name_desc">Name (Z-A)</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            {(searchQuery || statusFilter !== "all" || sortOrder !== "newest") && (
              <Button variant="outline" onClick={clearFilters} size="sm" className="w-full sm:w-auto" disabled={isDeleting}>
                Clear Filters
              </Button>
            )}
          </div>

          {/* Bulk Actions */}
          {selectedProjects.size > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="secondary">
                  {selectedProjects.size} selected
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedProjects(new Set())}
                    disabled={isDeleting}
                  >
                    Clear Selection
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteAlert(true)}
                  disabled={isDeleting}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected ({selectedProjects.size})
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Bulk Delete Confirmation Alert */}
        {showBulkDeleteAlert && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Are you sure you want to delete {selectedProjects.size} selected project(s)?
                This action cannot be undone and will also delete all associated steps and data.
                <br />
                <small className="text-amber-700 mt-1 block">
                  Note: Large deletions may take a few moments to complete.
                </small>
              </span>
              <div className="flex gap-2 sm:ml-4">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  Delete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkDeleteAlert(false)}
                >
                  Cancel
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Results Summary */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <p className="text-sm text-gray-600">
            Showing {filteredProjects.length} of {projects.length} projects
            {searchQuery && (
                <span> matching &quot;{searchQuery}&quot;</span>
            )}
            {statusFilter !== "all" && (
              <span> with status &quot;{getStatusConfig(statusFilter).label}&quot;</span>
            )}
          </p>

          {/* Select All Checkbox */}
          {filteredProjects.length > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={filteredProjects.length > 0 && filteredProjects.every(p => selectedProjects.has(p.id))}
                onCheckedChange={handleSelectAll}
                disabled={isDeleting}
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          )}
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-20 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <Folder className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {projects.length === 0 ? "No projects yet" : "No projects match your filters"}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {projects.length === 0
                ? "Create your first annotation project to get started with guided LLM annotation."
                : "Try adjusting your search query or filters to find the projects you're looking for."
              }
            </p>
            {projects.length === 0 ? (
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Your First Project
              </Button>
            ) : (
              <Button
                onClick={clearFilters}
                variant="outline"
                size="lg"
              >
                Clear Filters
              </Button>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence>
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isSelected={selectedProjects.has(project.id)}
                  onSelect={handleSelectProject}
                  getStatusConfig={getStatusConfig}
                  getProjectProgress={getProjectProgress}
                  projectActions={getProjectActions(project)}
                  onEdit={setEditingProject}
                  onDelete={setDeletingProject}
                  onReview={setReviewingProject}
                  onMembers={(project) => {
                    setSelectedProjectForMembers(project);
                    setShowMembersDialog(true);
                  }}
                  isDeleting={isDeleting}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        <CreateProjectDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreateProject={handleCreateProject}
        />

        <EditProjectDialog
          open={!!editingProject}
          project={editingProject}
          onOpenChange={(open) => !open && setEditingProject(null)}
          onUpdateProject={handleUpdateProject}
        />

        <DeleteProjectDialog
          open={!!deletingProject}
          project={deletingProject}
          onOpenChange={(open) => !open && setDeletingProject(null)}
          onDeleteProject={handleDeleteProject}
          isDeleting={isDeleting}
        />

        <ReviewOnPhoneDialog
          open={!!reviewingProject}
          project={reviewingProject}
          onOpenChange={(open) => !open && setReviewingProject(null)}
        />

        <ProjectMembersDialog
          open={showMembersDialog}
          onOpenChange={setShowMembersDialog}
          project={selectedProjectForMembers}
        />
      </div>
    </div>
  );
}

// Updated ProjectCard component to include selection checkbox and dynamic actions
function ProjectCard({
  project,
  isSelected,
  onSelect,
  getStatusConfig,
  getProjectProgress,
  projectActions,
  onEdit,
  onDelete,
  onMembers,
  isDeleting
}) {
  const [progress, setProgress] = useState(0);
  const statusConfig = getStatusConfig(project.status);
  const StatusIcon = statusConfig.icon;
  const { hasPermission, isLoading } = useProjectPermissions(project.id);
  const bypassPermissions = import.meta.env.VITE_BYPASS_PERMISSIONS === 'true' || import.meta.env.VITE_SUPABASE_REQUIRE_AUTH !== 'true';
  const permissionsLoading = !bypassPermissions && isLoading;
  const actionReady = !permissionsLoading;
  const canAccess = (permission) => bypassPermissions || hasPermission(permission);
  const visibleActions = actionReady
    ? projectActions.filter((action) => !action.permission || canAccess(action.permission))
    : [];
  const canEdit = canAccess("edit_project");
  const canDelete = canAccess("delete_project");

  useEffect(() => {
    if (project.status === 'annotation_in_progress' || project.status === 'completed') {
      getProjectProgress(project.id).then(setProgress);
    }
  }, [project.id, project.status, getProjectProgress]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ y: isDeleting ? 0 : -4 }}
      transition={{ duration: 0.2 }}
      className="group"
    >
      <Card className={`h-full glass-effect hover:shadow-xl transition-all duration-300 shadow-lg ${
        isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
      } ${isDeleting ? 'opacity-50 pointer-events-none' : ''} group-hover:scale-[1.02] border-0`}>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelect(project.id, checked)}
                className="mt-1"
                disabled={isDeleting}
              />
              <div className="flex-1 min-w-0">
                <CardTitle className="text-xl font-bold text-gray-900 truncate">
                  {project.name}
                </CardTitle>
                {project.description && (
                  <p className="text-gray-600 text-sm line-clamp-2 mt-1">
                    {project.description}
                  </p>
                )}
              </div>
            </div>
            <Badge className={`${statusConfig.color} border-0 font-medium ml-2 flex-shrink-0 whitespace-nowrap self-start`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {(project.status === 'annotation_in_progress' || project.status === 'completed') && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <div className="text-xs text-gray-500 mb-4">
            Created {new Date(getCreatedDate(project)).toLocaleDateString()}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {actionReady && (
              <>
                {visibleActions.map((action, index) => (
                  <Button
                    key={index}
                    variant={action.variant}
                    onClick={action.action}
                    disabled={isDeleting}
                    className={`flex-1 ${action.customColor || ''} shadow-md hover:shadow-lg transition-all duration-300`}
                    size="sm"
                  >
                    {action.icon && <span className="mr-2">{action.icon}</span>}
                    {action.label}
                  </Button>
                ))}

                {canAccess("view_project") && (
                  <Link to={createPageUrl(`StepManagement?projectId=${project.id}`)} className={isDeleting ? 'pointer-events-none' : ''}>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isDeleting}
                      className="px-3"
                    >
                      <Layers className="w-4 h-4" />
                    </Button>
                  </Link>
                )}

                {canAccess("manage_members") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onMembers(project)}
                    disabled={isDeleting}
                    className="px-3"
                  >
                    <Users className="w-4 h-4" />
                  </Button>
                )}

                <ProjectActionsDropdown
                  canEdit={canEdit}
                  canDelete={canDelete}
                  isLoading={permissionsLoading}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  project={project}
                  isDeleting={isDeleting}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Project actions dropdown component
function ProjectActionsDropdown({ project, onEdit, onDelete, isDeleting, canEdit, canDelete, isLoading }) {
  const noActions = !canEdit && !canDelete && !isLoading;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 px-2" disabled={isDeleting}>
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">More options</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit && (
          <DropdownMenuItem onClick={() => onEdit(project)} disabled={isDeleting || isLoading}>
            Edit
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem
            onClick={() => onDelete(project)}
            className="text-red-600 focus:text-red-700"
            disabled={isDeleting || isLoading}
          >
            Delete
          </DropdownMenuItem>
        )}
        {noActions && (
          <DropdownMenuItem disabled className="text-gray-500">
            No actions available
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
