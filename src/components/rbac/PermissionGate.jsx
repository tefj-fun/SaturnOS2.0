import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';
import { getPermissionsForProjectRole } from '@/api/rbac';

/**
 * PermissionGate - Component that conditionally renders children based on user permissions
 * @param {string} projectId - The project ID to check permissions for
 * @param {string|string[]} permission - Required permission(s) to show children
 * @param {string} fallback - Fallback component to show when permission is denied
 * @param {React.ReactNode} children - Content to show when permission is granted
 */
export default function PermissionGate({ 
  projectId, 
  permission, 
  fallback = null, 
  children 
}) {
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkPermission = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const currentUser = data?.user;
      if (!currentUser) {
        setHasPermission(false);
        setIsLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", currentUser.id)
        .single();

      if (profile?.role === "admin") {
        setHasPermission(true);
        setIsLoading(false);
        return;
      }

      if (!projectId) {
        setHasPermission(false);
        setIsLoading(false);
        return;
      }

      const { data: member } = await supabase
        .from("project_members")
        .select("permissions, role")
        .eq("project_id", projectId)
        .eq("user_id", currentUser.id)
        .single();

      const permissions = member?.permissions?.length
        ? member.permissions
        : getPermissionsForProjectRole(member?.role);

      const canAccess = Array.isArray(permission)
        ? permission.some((perm) => permissions?.includes(perm))
        : permissions?.includes(permission);

      setHasPermission(!!canAccess);
      setIsLoading(false);
    } catch (error) {
      console.error("Permission check failed:", error);
      setHasPermission(false);
      setIsLoading(false);
    }
  }, [projectId, permission]);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

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

  const loadUserPermissions = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const currentUser = data?.user;
      if (!currentUser) {
        setUserRole(null);
        setPermissions([]);
        setIsLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", currentUser.id)
        .single();

      if (profile?.role === "admin") {
        setUserRole("admin");
        setPermissions(["*"]);
        setIsLoading(false);
        return;
      }

      if (!projectId) {
        setUserRole(profile?.role || null);
        setPermissions([]);
        setIsLoading(false);
        return;
      }

      const { data: member } = await supabase
        .from("project_members")
        .select("role, permissions")
        .eq("project_id", projectId)
        .eq("user_id", currentUser.id)
        .single();

      const derivedPermissions = member?.permissions?.length
        ? member.permissions
        : getPermissionsForProjectRole(member?.role);

      setUserRole(member?.role || null);
      setPermissions(derivedPermissions || []);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load permissions:", error);
      setUserRole(null);
      setPermissions([]);
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadUserPermissions();
  }, [loadUserPermissions]);

  const hasPermission = (permission) => {
    if (userRole === 'admin') return true;
    if (permissions.includes('*')) return true;
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
