import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { useAuth } from "@/hooks/useAuth";

interface VisibilityRule {
  module_key: string;
  section_key: string;
  visibility: string;
  allowed_admin_ids: string[];
  label_override: string | null;
  level: string;
}

let cachedRules: VisibilityRule[] | null = null;

export const useModuleVisibility = (moduleKey: string, sectionKey?: string) => {
  const { user } = useAuth();
  const { profile } = useAdminProfile();
  const [rules, setRules] = useState<VisibilityRule[]>(cachedRules || []);
  const [loading, setLoading] = useState(!cachedRules);

  useEffect(() => {
    if (cachedRules) {
      setRules(cachedRules);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase
        .from("module_visibility_config")
        .select("module_key, section_key, visibility, allowed_admin_ids, label_override, level");
      const parsed = (data || []).map((d: any) => ({
        module_key: d.module_key,
        section_key: d.section_key,
        visibility: d.visibility,
        allowed_admin_ids: d.allowed_admin_ids || [],
        label_override: d.label_override,
        level: d.level,
      }));
      cachedRules = parsed;
      setRules(parsed);
      setLoading(false);
    };
    fetch();
  }, []);

  const isVisible = (modKey: string, secKey: string): boolean => {
    // Super admin sees everything
    if (profile?.isSuperAdmin) return true;

    const rule = rules.find(r => r.module_key === modKey && r.section_key === secKey);
    if (!rule) return true; // No rule = visible to all

    if (rule.visibility === "all") return true;
    if (rule.visibility === "super_admin_only") return false;
    if (rule.visibility === "selected_admins") {
      return user?.id ? (rule.allowed_admin_ids || []).includes(user.id) : false;
    }
    return true;
  };

  const visible = sectionKey ? isVisible(moduleKey, sectionKey) : true;

  return { visible, loading, isVisible };
};

export const invalidateVisibilityCache = () => {
  cachedRules = null;
};
