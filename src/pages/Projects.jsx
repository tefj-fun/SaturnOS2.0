
import React, { useState, useEffect } from "react";
import { Project } from "@/api/entities";
import { SOPStep } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  FileText,
  PenTool,
  CheckCircle,
  Clock,
  ArrowRight,
  Folder,
  MoreVertical // Added for dropdown menu
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { // Added for dropdown menu
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import CreateProjectDialog from "../components/projects/CreateProjectDialog";
import EditProjectDialog from "../components/projects/EditProjectDialog";
import DeleteProjectDialog from "../components/projects/DeleteProjectDialog";
import ReviewOnPhoneDialog from "../components/projects/ReviewOnPhoneDialog"; // New Import

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);
  const [reviewingProject, setReviewingProject] = useState(null); // New State

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const data = await Project.list('-created_date');
      setProjects(data);
    } catch (error) {
      console.error("Error loading projects:", error);
    }
    setIsLoading(false);
  };

  const getProjectProgress = async (projectId) => {
    try {
      const steps = await SOPStep.filter({ project_id: projectId });
      if (steps.length === 0) return 0;
      const annotatedSteps = steps.filter(step => step.is_annotated).length;
      return Math.round((annotatedSteps / steps.length) * 100);
    } catch (error) {
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
    await Project.create(projectData);
    setShowCreateDialog(false);
    loadProjects();
  };

  const handleUpdateProject = async (projectId, projectData) => {
    await Project.update(projectId, projectData);
    setEditingProject(null);
    loadProjects();
  };

  const handleDeleteProject = async (projectId) => {
    // Delete all steps first
    const steps = await SOPStep.filter({ project_id: projectId });
    for (const step of steps) {
      await SOPStep.delete(step.id);
    }

    // Delete project
    await Project.delete(projectId);
    setDeletingProject(null);
    loadProjects();
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Projects</h1>
            <p className="text-gray-600 text-lg">Manage your annotation projects and SOPs</p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-teal-600 hover:bg-teal-700 shadow-lg hover:shadow-xl transition-all duration-300"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Project
          </Button>
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
        ) : projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <Folder className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No projects yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Create your first annotation project to get started with guided LLM annotation.
            </p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-teal-600 hover:bg-teal-700"
              size="lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Project
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence>
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  getStatusConfig={getStatusConfig}
                  getProjectProgress={getProjectProgress}
                  onEdit={setEditingProject}
                  onDelete={setDeletingProject}
                  onReview={setReviewingProject} // New Prop
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
        />

        <ReviewOnPhoneDialog // New Component
          open={!!reviewingProject}
          project={reviewingProject}
          onOpenChange={(open) => !open && setReviewingProject(null)}
        />
      </div>
    </div>
  );
}

// New component for project actions dropdown
function ProjectActionsDropdown({ project, onEdit, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 px-2">
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">More options</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(project)}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDelete(project)} className="text-red-600 focus:text-red-700">
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectCard({ project, getStatusConfig, getProjectProgress, onEdit, onDelete, onReview }) { // Added onReview
  const [progress, setProgress] = useState(0);
  const statusConfig = getStatusConfig(project.status);
  const StatusIcon = statusConfig.icon;

  useEffect(() => {
    if (project.status === 'annotation_in_progress' || project.status === 'completed') {
      getProjectProgress(project.id).then(setProgress);
    }
  }, [project.id, project.status]);

  const getNextAction = () => {
    switch (project.status) {
      case 'created':
        return {
          label: 'Upload SOP',
          url: createPageUrl(`ProjectSetup?id=${project.id}`),
          color: 'bg-blue-600 hover:bg-blue-700'
        };
      case 'sop_uploaded':
      case 'steps_generated':
        return {
          label: 'Start Annotation',
          url: createPageUrl(`AnnotationStudio?projectId=${project.id}`),
          color: 'bg-teal-600 hover:bg-teal-700'
        };
      case 'annotation_in_progress':
        return {
          label: 'Continue Annotation',
          url: createPageUrl(`AnnotationStudio?projectId=${project.id}`),
          color: 'bg-teal-600 hover:bg-teal-700'
        };
      case 'completed':
        return {
          label: 'View Results',
          url: createPageUrl(`AnnotationStudio?projectId=${project.id}`),
          color: 'bg-green-600 hover:bg-green-700'
        };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="h-full glass-effect hover:shadow-xl transition-all duration-300 border-0 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start mb-2">
            <CardTitle className="text-xl font-bold text-gray-900 truncate">
              {project.name}
            </CardTitle>
            <Badge className={`${statusConfig.color} border-0 font-medium`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>
          {project.description && (
            <p className="text-gray-600 text-sm line-clamp-2">
              {project.description}
            </p>
          )}
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
            Created {new Date(project.created_date).toLocaleDateString()}
          </div>

          <div className="flex gap-2 mb-4">
            {nextAction && (
              <Link to={nextAction.url} className="flex-1">
                <Button
                  className={`w-full ${nextAction.color} shadow-md hover:shadow-lg transition-all duration-300`}
                  size="sm"
                >
                  {nextAction.label}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
            
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onReview(project)}
            >
              Review on Phone
            </Button>

            <ProjectActionsDropdown
              project={project}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
