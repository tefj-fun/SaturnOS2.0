import React, { useState, useEffect } from 'react';
import { User } from '@/api/entities';
import { ProjectMember } from '@/api/entities';

/**
 * PermissionGate - Component that conditionally renders children based on user permissions
 * @param {string} projectId - The project ID to check permissions for
 * @param {string|string[]} permission - Required permission(s) to show children
 * @param {string} fallback - Fallback component to show when permission is denied
 * @param {boolean} requireAll - Whether all permissions are required (default: false, any permission)
 * @param {React.ReactNode} children - Content to show when permission is granted
 */
export default function PermissionGate({ 
  projectId, 
  permission, 
  fallback = null, 
  requireAll = false, 
  children 
}) {
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkPermission();
  }, [projectId, permission]);

  const checkPermission = async () => {
    try {
      const currentUser = await User.me();
      
      // System admin has all permissions
      if (currentUser.role === 'admin') {
        setHasPermission(true);
        setIsLoading(false);
        return;
      }

      if (!projectId) {
        // If no project specified, check global user role
        setHasPermission(true);
        setIsLoading(false);
        return;
      }

      // Check project-specific permissions
      const projectMembers = await ProjectMember.filter({ 
        project_id: projectId, 
        user_email: currentUser.email 
      });

      if (projectMembers.length === 0) {
        setHasPermission(false);
        setIsLoading(false);
        return;
      }

      const member = projectMembers[0];
      const userPermissions = member.permissions || [];
      
      // Handle single permission or array of permissions
      const requiredPermissions = Array.isArray(permission) ? permission : [permission];
      
      let hasRequiredPermission;
      if (requireAll) {
        // User must have ALL specified permissions
        hasRequiredPermission = requiredPermissions.every(perm => 
          userPermissions.includes(perm)
        );
      } else {
        // User must have ANY of the specified permissions
        hasRequiredPermission = requiredPermissions.some(perm => 
          userPermissions.includes(perm)
        );
      }

      setHasPermission(hasRequiredPermission);
      setIsLoading(false);

    } catch (error) {
      console.error('Error checking permissions:', error);
      setHasPermission(false);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return null; // or a loading spinner
  }

  return hasPermission ? children : fallback;
}

/**
 * useProjectPermissions - Hook to check permissions programmatically
 */
export function useProjectPermissions(projectId) {
  const [permissions, setPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    loadUserPermissions();
  }, [projectId]);

  const loadUserPermissions = async () => {
    try {
      const currentUser = await User.me();
      setUserRole(currentUser.role);

      // System admin has all permissions
      if (currentUser.role === 'admin') {
        setPermissions([
          'view_project', 'edit_project', 'delete_project', 'manage_steps',
          'upload_datasets', 'annotate', 'train_models', 'view_results',
          'manage_members', 'export_data'
        ]);
        setIsLoading(false);
        return;
      }

      if (!projectId) {
        setPermissions([]);
        setIsLoading(false);
        return;
      }

      const projectMembers = await ProjectMember.filter({ 
        project_id: projectId, 
        user_email: currentUser.email 
      });

      if (projectMembers.length > 0) {
        setPermissions(projectMembers[0].permissions || []);
      } else {
        setPermissions([]);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading user permissions:', error);
      setPermissions([]);
      setIsLoading(false);
    }
  };

  const hasPermission = (permission) => {
    if (userRole === 'admin') return true;
    if (Array.isArray(permission)) {
      return permission.some(perm => permissions.includes(perm));
    }
    return permissions.includes(permission);
  };

  const hasAllPermissions = (permissionList) => {
    if (userRole === 'admin') return true;
    return permissionList.every(perm => permissions.includes(perm));
  };

  return { 
    permissions, 
    hasPermission, 
    hasAllPermissions, 
    isLoading,
    userRole,
    isAdmin: userRole === 'admin'
  };
}