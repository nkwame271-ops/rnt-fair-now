import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FeatureFlag {
  feature_key: string;
  label: string;
  description: string | null;
  is_enabled: boolean;
  category: string;
  fee_amount: number | null;
  fee_enabled: boolean;
}

let cachedFlags: FeatureFlag[] | null = null;
let fetchPromise: Promise<FeatureFlag[]> | null = null;
let cachedAt = 0;
const CACHE_TTL = 30_000; // 30 seconds

const fetchFlags = async (): Promise<FeatureFlag[]> => {
  const now = Date.now();
  if (cachedFlags && now - cachedAt < CACHE_TTL) return cachedFlags;
  if (fetchPromise) return fetchPromise;
  fetchPromise = (async () => {
    const { data } = await supabase
      .from("feature_flags")
      .select("feature_key, label, description, is_enabled, category, fee_amount, fee_enabled");
    cachedFlags = (data as FeatureFlag[]) || [];
    cachedAt = Date.now();
    fetchPromise = null;
    return cachedFlags;
  })();
  return fetchPromise;
};

export const invalidateFeatureFlags = () => {
  cachedFlags = null;
  fetchPromise = null;
  cachedAt = 0;
};

export const useFeatureFlag = (key: string): { enabled: boolean; loading: boolean } => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFlags().then((flags) => {
      const flag = flags.find((f) => f.feature_key === key);
      setEnabled(flag?.is_enabled ?? false);
      setLoading(false);
    });
  }, [key]);

  return { enabled, loading };
};

export const useAllFeatureFlags = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFlags().then((f) => {
      setFlags(f);
      setLoading(false);
    });
  }, []);

  return { flags, loading, refetch: () => {
    invalidateFeatureFlags();
    setLoading(true);
    fetchFlags().then((f) => {
      setFlags(f);
      setLoading(false);
    });
  }};
};

export const useFeatureFlagsByCategory = (category: string) => {
  const { flags, loading, refetch } = useAllFeatureFlags();
  const filtered = flags.filter((f) => f.category === category);
  return { flags: filtered, loading, refetch };
};

export const useFeeConfig = (key: string): { amount: number; enabled: boolean; loading: boolean } => {
  const [amount, setAmount] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Always fetch fresh for fee checks — bypass stale cache
    invalidateFeatureFlags();
    fetchFlags().then((flags) => {
      const flag = flags.find((f) => f.feature_key === key);
      setAmount(flag?.fee_amount ?? 0);
      setEnabled(flag?.fee_enabled ?? true);
      setLoading(false);
    });
  }, [key]);

  return { amount, enabled, loading };
};
