import React, { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { inviteUser } from '@/api/invitations';
import {
  getCurrentAuthUser,
  getProfile,
  listProfiles,
  updateProfile,
  upsertProfile,
} from '@/api/profiles';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Settings as SettingsIcon,
  User as UserIcon,
  Shield,
  Bell,
  Palette,
  Globe,
  Key,
  Users,
  Plus,
  Trash2,
  Edit3,
  Crown,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';

const DEFAULT_PREFERENCES = {
  theme: 'light',
  notifications: {
    email: true,
    training_complete: true,
    inference_ready: false,
    weekly_summary: true
  },
  language: 'en',
  timezone: 'UTC-8',
  auto_save: true
};

const roleConfig = {
  admin: { 
    label: 'Administrator', 
    color: 'bg-red-100 text-red-800', 
    icon: <Crown className="w-3 h-3" />,
    permissions: ['all']
  },
  annotator: { 
    label: 'Annotator', 
    color: 'bg-blue-100 text-blue-800', 
    icon: <UserIcon className="w-3 h-3" />,
    permissions: ['create_projects', 'annotate', 'train_models']
  },
  viewer: { 
    label: 'Viewer', 
    color: 'bg-gray-100 text-gray-800', 
    icon: <UserIcon className="w-3 h-3" />,
    permissions: ['view_projects', 'view_results']
  }
};

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  
  const [newUser, setNewUser] = useState({
    email: '',
    full_name: '',
    role: 'viewer'
  });

  const [userSettings, setUserSettings] = useState(DEFAULT_PREFERENCES);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const user = await getCurrentAuthUser();
      if (!user) return;

      let profile = null;
      try {
        profile = await getProfile(user.id);
      } catch (error) {
        profile = null;
      }

      if (!profile) {
        profile = await upsertProfile({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email,
          role: 'viewer',
          status: 'active',
          preferences: DEFAULT_PREFERENCES,
          last_login: new Date().toISOString()
        });
      } else {
        await updateProfile(user.id, { last_login: new Date().toISOString() });
      }

      setCurrentUser(profile);
      setUserSettings(profile.preferences || DEFAULT_PREFERENCES);
      if (profile.role === 'admin') {
        await loadTeamMembers();
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const profiles = await listProfiles();
      setTeamMembers(profiles);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      if (!currentUser) return;
      const updated = await updateProfile(currentUser.id, {
        full_name: currentUser.full_name,
        preferences: userSettings
      });
      setCurrentUser(updated);
    } catch (error) {
      console.error('Error saving profile:', error);
    }
    setIsLoading(false);
  };

  const handleSettingChange = (category, key, value) => {
    setUserSettings(prev => ({
      ...prev,
      [category]: key === null
        ? value
        : typeof prev[category] === 'object'
          ? { ...prev[category], [key]: value }
          : { [key]: value }
    }));
  };

  const handleAddUser = async () => {
    if (!newUser.email) return;
    
    setIsLoading(true);
    try {
      await inviteUser({
        email: newUser.email,
        fullName: newUser.full_name || newUser.email.split('@')[0],
        role: newUser.role
      });
      await loadTeamMembers();
      setNewUser({ email: '', full_name: '', role: 'viewer' });
      setShowAddUserDialog(false);
    } catch (error) {
      console.error('Error inviting user:', error);
    }
    setIsLoading(false);
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      await updateProfile(userId, { role: newRole });
      await loadTeamMembers();
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const handleRemoveUser = async (userId) => {
    if (confirm('Are you sure you want to remove this user?')) {
      try {
        await updateProfile(userId, { status: 'inactive' });
        await loadTeamMembers();
      } catch (error) {
        console.error('Error removing user:', error);
      }
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  if (!currentUser) {
    return (
      <div className="min-h-screen p-6 md:p-8">
        <div className="max-w-6xl mx-auto">
          <Card className="glass-effect border-0 shadow-lg">
            <CardContent className="py-12 text-center text-gray-600">
              Loading settings...
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
            <SettingsIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600">Manage your account, preferences, and team access</p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <UserIcon className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Preferences
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="team" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Team & RBAC
              </TabsTrigger>
            )}
          </TabsList>

          {/* Profile Settings */}
          <TabsContent value="profile" className="space-y-6">
            <Card className="glass-effect border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-blue-600" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Update your personal information and account details.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
                    <UserIcon className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{currentUser.full_name}</h3>
                    <p className="text-gray-600">{currentUser.email}</p>
                    <Badge className={`mt-2 ${roleConfig[currentUser.role]?.color} border-0`}>
                      {roleConfig[currentUser.role]?.icon}
                      <span className="ml-1">{roleConfig[currentUser.role]?.label}</span>
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={currentUser.full_name}
                      onChange={(e) => setCurrentUser(prev => ({ ...prev, full_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      value={currentUser.email}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-xs text-gray-500">Email cannot be changed</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSaveProfile} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences */}
          <TabsContent value="preferences" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Appearance */}
              <Card className="glass-effect border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-purple-600" />
                    Appearance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Theme</Label>
                      <p className="text-sm text-gray-600">Choose your preferred theme</p>
                    </div>
                    <Select value={userSettings.theme} onValueChange={(value) => handleSettingChange('theme', null, value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Notifications */}
              <Card className="glass-effect border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-green-600" />
                    Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Email Notifications</Label>
                      <p className="text-sm text-gray-600">Receive notifications via email</p>
                    </div>
                    <Switch 
                      checked={userSettings.notifications?.email}
                      onCheckedChange={(checked) => handleSettingChange('notifications', 'email', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Training Complete</Label>
                      <p className="text-sm text-gray-600">Notify when training finishes</p>
                    </div>
                    <Switch 
                      checked={userSettings.notifications?.training_complete}
                      onCheckedChange={(checked) => handleSettingChange('notifications', 'training_complete', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Weekly Summary</Label>
                      <p className="text-sm text-gray-600">Weekly progress reports</p>
                    </div>
                    <Switch 
                      checked={userSettings.notifications?.weekly_summary}
                      onCheckedChange={(checked) => handleSettingChange('notifications', 'weekly_summary', checked)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* General Settings */}
              <Card className="glass-effect border-0 shadow-lg lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-600" />
                    General Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select value={userSettings.language} onValueChange={(value) => handleSettingChange('language', null, value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Timezone</Label>
                      <Select value={userSettings.timezone} onValueChange={(value) => handleSettingChange('timezone', null, value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UTC-8">Pacific Time (UTC-8)</SelectItem>
                          <SelectItem value="UTC-5">Eastern Time (UTC-5)</SelectItem>
                          <SelectItem value="UTC+0">UTC</SelectItem>
                          <SelectItem value="UTC+1">Central European Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-save</Label>
                        <p className="text-sm text-gray-600">Save work automatically</p>
                      </div>
                      <Switch 
                        checked={userSettings.auto_save}
                        onCheckedChange={(checked) => handleSettingChange('auto_save', null, checked)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                {isLoading ? 'Saving...' : 'Save Preferences'}
              </Button>
            </div>
          </TabsContent>

          {/* Team & RBAC (Admin Only) */}
          {isAdmin && (
            <TabsContent value="team" className="space-y-6">
              <Card className="glass-effect border-0 shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-red-600" />
                        Team Management & Access Control
                      </CardTitle>
                      <CardDescription>
                        Manage team members and their permissions across the platform.
                      </CardDescription>
                    </div>
                    <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
                      <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700">
                          <Plus className="w-4 h-4 mr-2" />
                          Add User
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Team Member</DialogTitle>
                          <DialogDescription>
                            Invite a new team member and set their permissions.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                              id="email"
                              placeholder="user@company.com"
                              value={newUser.email}
                              onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="fullName">Full Name</Label>
                            <Input
                              id="fullName"
                              placeholder="Jane Smith"
                              value={newUser.full_name}
                              onChange={(e) => setNewUser(prev => ({ ...prev, full_name: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Select value={newUser.role} onValueChange={(value) => setNewUser(prev => ({ ...prev, role: value }))}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="viewer">Viewer - Can view projects and results</SelectItem>
                                <SelectItem value="annotator">Annotator - Can create and annotate</SelectItem>
                                <SelectItem value="admin">Administrator - Full access</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleAddUser}>
                            Send Invitation
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Role Permissions Overview */}
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-3">Role Permissions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="space-y-2">
                        <Badge className="bg-gray-100 text-gray-800 border-0">
                          <UserIcon className="w-3 h-3 mr-1" />
                          Viewer
                        </Badge>
                        <ul className="text-gray-600 space-y-1">
                          <li>• View projects</li>
                          <li>• View results</li>
                          <li>• Export data</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <Badge className="bg-blue-100 text-blue-800 border-0">
                          <UserIcon className="w-3 h-3 mr-1" />
                          Annotator
                        </Badge>
                        <ul className="text-gray-600 space-y-1">
                          <li>• Create projects</li>
                          <li>• Annotate images</li>
                          <li>• Train models</li>
                          <li>• All viewer permissions</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <Badge className="bg-red-100 text-red-800 border-0">
                          <Crown className="w-3 h-3 mr-1" />
                          Administrator
                        </Badge>
                        <ul className="text-gray-600 space-y-1">
                          <li>• Manage team</li>
                          <li>• System settings</li>
                          <li>• Delete projects</li>
                          <li>• All permissions</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Team Members Table */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Login</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
                                <UserIcon className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{member.full_name}</p>
                                <p className="text-sm text-gray-600">{member.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`${roleConfig[member.role]?.color} border-0`}>
                              {roleConfig[member.role]?.icon}
                              <span className="ml-1">{roleConfig[member.role]?.label}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                              {member.status === 'active' ? (
                                <CheckCircle className="w-3 h-3 mr-1" />
                              ) : (
                                <AlertTriangle className="w-3 h-3 mr-1" />
                              )}
                              {member.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {member.last_login ? new Date(member.last_login).toLocaleDateString() : 'Never'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Select 
                                value={member.role} 
                                onValueChange={(value) => handleUpdateUserRole(member.id, value)}
                                disabled={member.id === currentUser.id}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                  <SelectItem value="annotator">Annotator</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              {member.id !== currentUser.id && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveUser(member.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
