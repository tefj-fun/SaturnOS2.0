import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';
import { inviteUser } from '@/api/invitations';
import { getProfile } from '@/api/profiles';
import {
  listProjectMembers,
  updateProjectMember,
  deleteProjectMember,
} from '@/api/projectMembers';
import { getPermissionsForProjectRole } from '@/api/rbac';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Plus,
  Crown,
  Edit3,
  Eye,
  PenTool,
  Trash2,
  MoreVertical,
  Shield,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';

const ROLE_CONFIGS = {
  owner: {
    label: 'Owner',
    color: 'bg-red-100 text-red-800',
    icon: <Crown className="w-3 h-3" />,
    permissions: getPermissionsForProjectRole('owner')
  },
  editor: {
    label: 'Editor', 
    color: 'bg-purple-100 text-purple-800',
    icon: <Edit3 className="w-3 h-3" />,
    permissions: getPermissionsForProjectRole('editor')
  },
  annotator: {
    label: 'Annotator',
    color: 'bg-blue-100 text-blue-800', 
    icon: <PenTool className="w-3 h-3" />,
    permissions: getPermissionsForProjectRole('annotator')
  },
  viewer: {
    label: 'Viewer',
    color: 'bg-gray-100 text-gray-800',
    icon: <Eye className="w-3 h-3" />,
    permissions: getPermissionsForProjectRole('viewer')
  }
};

const PERMISSION_LABELS = {
  view_project: 'View Project',
  edit_project: 'Edit Project Details',
  delete_project: 'Delete Project',
  manage_steps: 'Manage Steps',
  upload_datasets: 'Upload Datasets',
  annotate: 'Create Annotations',
  train_models: 'Train Models',
  view_results: 'View Results',
  manage_members: 'Manage Team Members',
  export_data: 'Export Data'
};

export default function ProjectMembersDialog({ open, onOpenChange, project }) {
  const [members, setMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [customPermissions, setCustomPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadCurrentUser = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return;
      let profile = null;
      try {
        profile = await getProfile(user.id);
      } catch {
        profile = null;
      }
      setCurrentUser({
        id: user.id,
        email: user.email,
        role: profile?.role || null
      });
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  }, []);

  const loadProjectMembers = useCallback(async () => {
    if (!project?.id) return;
    try {
      const projectMembers = await listProjectMembers(project.id);
      setMembers(projectMembers);
    } catch (error) {
      console.error('Error loading project members:', error);
    }
  }, [project?.id]);

  useEffect(() => {
    if (open && project) {
      loadProjectMembers();
      loadCurrentUser();
    }
  }, [open, project, loadProjectMembers, loadCurrentUser]);

  const handleInviteMember = async () => {
    if (!inviteEmail || !project) return;
    
    setIsLoading(true);
    try {
      const permissions = customPermissions.length > 0 ? customPermissions : ROLE_CONFIGS[inviteRole].permissions;
      await inviteUser({
        email: inviteEmail,
        fullName: inviteEmail.split('@')[0],
        role: "viewer",
        projectId: project.id,
        projectRole: inviteRole,
        permissions
      });

      await loadProjectMembers();
      setShowInviteForm(false);
      setInviteEmail('');
      setInviteRole('viewer');
      setCustomPermissions([]);
    } catch (error) {
      console.error('Error inviting member:', error);
    }
    setIsLoading(false);
  };

  const handleUpdateMemberRole = async (memberId, newRole) => {
    try {
      const permissions = ROLE_CONFIGS[newRole].permissions;
      await updateProjectMember(memberId, { 
        role: newRole,
        permissions: permissions 
      });
      await loadProjectMembers();
    } catch (error) {
      console.error('Error updating member role:', error);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm('Are you sure you want to remove this member from the project?')) return;
    
    try {
      await deleteProjectMember(memberId);
      await loadProjectMembers();
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  const canManageMembers = () => {
    const currentMember = members.find(m => m.user_id === currentUser?.id || m.user_email === currentUser?.email);
    return currentUser?.role === 'admin' || currentMember?.role === 'owner' || currentMember?.role === 'admin';
  };

  const handlePermissionToggle = (permission) => {
    setCustomPermissions(prev => 
      prev.includes(permission) 
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Project Team - {project.name}
          </DialogTitle>
          <DialogDescription>
            Manage team members and their permissions for this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invite New Member */}
          {canManageMembers() && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Invite Team Member
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!showInviteForm ? (
                  <Button onClick={() => setShowInviteForm(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Invite Member
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="inviteEmail">Email Address</Label>
                        <Input
                          id="inviteEmail"
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="user@company.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="inviteRole">Role</Label>
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ROLE_CONFIGS).map(([key, config]) => (
                              <SelectItem key={key} value={key}>
                                <div className="flex items-center gap-2">
                                  {config.icon}
                                  {config.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Custom Permissions */}
                    <div>
                      <Label className="text-sm font-medium mb-3 block">Custom Permissions (Optional)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                              id={key}
                              checked={customPermissions.includes(key)}
                              onCheckedChange={() => handlePermissionToggle(key)}
                            />
                            <label htmlFor={key} className="text-sm">{label}</label>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Leave empty to use default role permissions
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        onClick={handleInviteMember} 
                        disabled={!inviteEmail || isLoading}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isLoading ? 'Inviting...' : 'Send Invitation'}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setShowInviteForm(false);
                          setInviteEmail('');
                          setCustomPermissions([]);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Current Members */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Current Members ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    {canManageMembers() && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const roleConfig = ROLE_CONFIGS[member.role];
                    const statusConfig = {
                      active: { icon: <CheckCircle className="w-3 h-3" />, color: 'bg-green-100 text-green-800' },
                      pending: { icon: <Clock className="w-3 h-3" />, color: 'bg-yellow-100 text-yellow-800' },
                      inactive: { icon: <AlertTriangle className="w-3 h-3" />, color: 'bg-gray-100 text-gray-800' }
                    };

                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-semibold text-xs">
                                {member.user_name?.charAt(0).toUpperCase() || member.user_email?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{member.user_name || member.user_email.split('@')[0]}</p>
                              <p className="text-sm text-gray-500">{member.user_email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${roleConfig.color} border-0`}>
                            {roleConfig.icon}
                            <span className="ml-1">{roleConfig.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`${statusConfig[member.status]?.color} border-0`}>
                            {statusConfig[member.status]?.icon}
                            <span className="ml-1 capitalize">{member.status}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {member.joined_date ? new Date(member.joined_date).toLocaleDateString() : 'Pending'}
                        </TableCell>
                        {canManageMembers() && (
                          <TableCell>
                            {member.user_email !== currentUser?.email && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {Object.entries(ROLE_CONFIGS).map(([key, config]) => (
                                    <DropdownMenuItem
                                      key={key}
                                      onClick={() => handleUpdateMemberRole(member.id, key)}
                                      disabled={member.role === key}
                                    >
                                      {config.icon}
                                      <span className="ml-2">Make {config.label}</span>
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuItem
                                    onClick={() => handleRemoveMember(member.id)}
                                    className="text-red-600 focus:text-red-700"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span className="ml-2">Remove</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {members.length === 0 && (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-600">No team members yet</p>
                  <p className="text-sm text-gray-500">Invite team members to collaborate on this project</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Role Permissions Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Role Permissions Reference</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(ROLE_CONFIGS).map(([key, config]) => (
                  <div key={key} className="p-3 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={`${config.color} border-0`}>
                        {config.icon}
                        <span className="ml-1">{config.label}</span>
                      </Badge>
                    </div>
                    <ul className="text-sm space-y-1">
                      {config.permissions.map(permission => (
                        <li key={permission} className="flex items-center gap-1 text-gray-600">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          {PERMISSION_LABELS[permission]}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
