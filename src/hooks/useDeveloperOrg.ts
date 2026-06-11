import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type DeveloperOrg = {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string | null;
  website_url: string | null;
  agency_type: string | null;
  intended_use_case: string | null;
  dsa_signed_at: string | null;
  dsa_version_accepted: string | null;
  owner_user_id: string;
  created_at: string;
};

export type DeveloperKey = {
  id: string;
  organization_id: string | null;
  agency_name: string;
  key_prefix: string | null;
  environment: string;
  scopes: string[] | null;
  is_active: boolean;
  revoked_at: string | null;
  expires_at: string | null;
  last_used_at: string | null;
  rate_limit_per_minute: number;
  current_plan_id: string | null;
  created_at: string;
};

export function useDeveloperOrg() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["developer-org", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("developer_organizations" as any)
        .select("*")
        .eq("owner_user_id", user!.id)
        .maybeSingle();
      return ((data as unknown) as DeveloperOrg | null) ?? null;
    },
  });
}

export function useDeveloperKeys(orgId?: string | null) {
  return useQuery({
    queryKey: ["developer-keys", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("api_keys_developer_view" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      return ((data as unknown) as DeveloperKey[] | null) ?? [];
    },
  });
}
