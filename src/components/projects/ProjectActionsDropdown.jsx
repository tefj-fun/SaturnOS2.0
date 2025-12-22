import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash2, Layers, Copy, Spline } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function ProjectActionsDropdown({ project, onEdit, onDelete, onDuplicate }) {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => navigate(createPageUrl(`StepManagement?projectId=${project.id}`))}>
          <Layers className="w-4 h-4 mr-2" />
          <span>Manage Steps</span>
        </DropdownMenuItem>
        
        {project.status === 'completed' && (
           <DropdownMenuItem onSelect={() => navigate(createPageUrl(`TrainingConfiguration?projectId=${project.id}`))}>
              <Spline className="w-4 h-4 mr-2" />
              <span>Train Model</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onEdit}>
          <Edit className="w-4 h-4 mr-2" />
          <span>Edit Project</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDuplicate}>
          <Copy className="w-4 h-4 mr-2" />
          <span>Duplicate</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDelete} className="text-red-600 focus:text-red-600 focus:bg-red-50">
          <Trash2 className="w-4 h-4 mr-2" />
          <span>Delete Project</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
