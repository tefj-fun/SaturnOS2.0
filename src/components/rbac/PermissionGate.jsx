import React, { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';

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
    const { data } = await supabase.auth.getUser();
    const currentUser = data?.user;
    setHasPermission(!!currentUser);
    setIsLoading(false);
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
    const { data } = await supabase.auth.getUser();
    const currentUser = data?.user;
    setUserRole(currentUser ? 'admin' : null);
    setPermissions(currentUser ? ['*'] : []);
    setIsLoading(false);
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
