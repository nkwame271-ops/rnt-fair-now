import { useAdminProfile } from "@/hooks/useAdminProfile";

/**
 * useAdminScope — small wrapper over useAdminProfile that returns the office_id
 * a non-super/main admin staff is scoped to. Super/main admins are unscoped (null).
 *
 * Used for query-layer filtering across complaints, receipts, etc. RLS is unchanged;
 * this is purely an application-layer scoping helper.
 */
export const useAdminScope = () => {
  const { profile, loading } = useAdminProfile();

  // Unscoped (sees everything): super admin, main admin, or no admin profile (legacy)
  const isUnscoped = !profile || profile.isSuperAdmin || profile.isMainAdmin;
  const scopeOfficeId = isUnscoped ? null : profile?.officeId || null;

  return {
    scopeOfficeId,
    isUnscoped,
    officeName: profile?.officeName || null,
    loading,
  };
};
