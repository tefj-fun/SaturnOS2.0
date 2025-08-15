import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, AlertTriangle } from "lucide-react";

export default function DeleteProjectDialog({ open, project, onOpenChange, onDeleteProject }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!project) return;

    setIsDeleting(true);
    try {
      await onDeleteProject(project.id);
    } catch (error) {
      console.error("Error deleting project:", error);
    }
    setIsDeleting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass-effect border-0 shadow-2xl">
        <DialogHeader className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Delete Project
          </DialogTitle>
          <p className="text-gray-600">
            This action cannot be undone
          </p>
        </DialogHeader>
        
        <div className="space-y-6 mt-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Deleting "{project?.name}" will permanently remove:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All annotation steps</li>
                <li>All uploaded datasets</li>
                <li>All annotation data</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-1">{project?.name}</h4>
            {project?.description && (
              <p className="text-sm text-gray-600">{project.description}</p>
            )}
          </div>
          
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-gray-200"
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              className="flex-1 bg-red-600 hover:bg-red-700 shadow-lg"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Project"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}