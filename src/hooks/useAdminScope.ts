import { useAdminProfile, getOfficesForRegion } from "@/hooks/useAdminProfile";

/**
 * Full region / multi-office scope for regulator query filtering. Database RLS
 * remains the security boundary; this hook keeps totals and controls consistent.
 *
 * A region-scoped admin (SPECIFIC_REGION_ALL_OFFICES) usually has no explicit
 * office_ids row, so the region is expanded into its offices here. That lets
 * office selectors offer every office in the region instead of locking to one.
 */
export const useAdminScope = () => {
  const { profile, loading } = useAdminProfile();

  // Unscoped (sees everything): super admin, main admin, or no admin profile (legacy)
  const isUnscoped = profile?.scopeType === "ALL_REGIONS";

  const explicitOfficeIds = profile?.officeIds || [];
  const regionOfficeIds =
    profile?.scopeType === "SPECIFIC_REGION_ALL_OFFICES" && profile?.regionId
      ? getOfficesForRegion(profile.regionId).map((o) => o.id)
      : [];

  const scopeOfficeIds = isUnscoped
    ? []
    : explicitOfficeIds.length > 0
      ? explicitOfficeIds
      : regionOfficeIds;

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
