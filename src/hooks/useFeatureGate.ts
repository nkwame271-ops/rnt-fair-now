import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface GateContext {
  role?: string;
  dashboard?: string;
  institution?: string;
  adminCategory?: string;
  subKey?: string;
}

// Simple cache: key -> boolean
const cache = new Map<string, { value: boolean; at: number }>();
const TTL = 30_000;

const buildCacheKey = (
  userId: string | undefined,
  featureKey: string,
  ctx: GateContext = {}
) =>
  [
    userId ?? "anon",
    featureKey,
    ctx.subKey ?? "",
    ctx.role ?? "",
    ctx.dashboard ?? "",
    ctx.institution ?? "",
    ctx.adminCategory ?? "",
  ].join("|");

export const invalidateFeatureGateCache = () => cache.clear();

/**
 * Resolves a feature flag with full per-target override layering.
 * Returns `{ visible, loading }`. When `visible === false`, callers must render nothing.
 */
export const useFeatureGate = (
  featureKey: string,
  ctx: GateContext = {}
): { visible: boolean; loading: boolean } => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const key = buildCacheKey(user?.id, featureKey, ctx);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < TTL) {
      setVisible(cached.value);
      setLoading(false);
      return;
    }

    (async () => {
      const { data, error } = await supabase.rpc("resolve_feature_access", {
        _user_id: user?.id ?? null,
        _feature_key: featureKey,
        _sub_key: ctx.subKey ?? null,
        _role: ctx.role ?? null,
        _dashboard: ctx.dashboard ?? null,
        _institution: ctx.institution ?? null,
        _admin_category: ctx.adminCategory ?? null,
      } as any);
      if (cancelled) return;
      const value = !error && Boolean(data);
      cache.set(key, { value, at: Date.now() });
      setVisible(value);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.id,
    featureKey,
    ctx.subKey,
    ctx.role,
    ctx.dashboard,
    ctx.institution,
    ctx.adminCategory,
  ]);

  // Realtime: invalidate cache on any override change
  useEffect(() => {
    const channel = supabase
      .channel(`feature_gate_${featureKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feature_flag_overrides" },
        () => invalidateFeatureGateCache()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_feature_overrides" },
        () => invalidateFeatureGateCache()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [featureKey]);

  return { visible, loading };
};

interface GateProps {
  feature: string;
  ctx?: GateContext;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/** Convenience wrapper. Renders children only when the feature resolves to enabled. */
export const FeatureGate = ({ feature, ctx, fallback = null, children }: GateProps) => {
  const { visible, loading } = useFeatureGate(feature, ctx);
  if (loading || !visible) return <>{fallback}</>;
  return <>{children}</>;
};
