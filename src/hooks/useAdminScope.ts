import { useAdminProfile } from "@/hooks/useAdminProfile";

/**
 * Full region / multi-office scope for regulator query filtering. Database RLS
 * remains the security boundary; this hook keeps totals and controls consistent.
 */
export const useAdminScope = () => {
  const { profile, loading } = useAdminProfile();

  // Unscoped (sees everything): super admin, main admin, or no admin profile (legacy)
  const isUnscoped = profile?.scopeType === "ALL_REGIONS";
  const scopeOfficeIds = isUnscoped ? [] : profile?.officeIds || [];
  const scopeOfficeId = scopeOfficeIds.length === 1 ? scopeOfficeIds[0] : null;

  return {
    scopeOfficeId,
    scopeOfficeIds,
    scopeType: profile?.scopeType || null,
    scopeRegionId: profile?.regionId || null,
    isUnscoped,
    officeName: profile?.officeName || null,
    loading,
  };
};
