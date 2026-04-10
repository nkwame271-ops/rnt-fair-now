import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LabelOverride {
  feature_key: string;
  portal: string;
  custom_label: string;
}

let cachedLabels: LabelOverride[] | null = null;
let fetchPromise: Promise<void> | null = null;

const fetchLabels = async () => {
  const { data } = await supabase
    .from("feature_label_overrides")
    .select("feature_key, portal, custom_label");
  cachedLabels = (data || []).map((d: any) => ({
    feature_key: d.feature_key,
    portal: d.portal,
    custom_label: d.custom_label,
  }));
};

export const useFeatureLabels = (portal: "admin" | "landlord" | "tenant") => {
  const [labels, setLabels] = useState<LabelOverride[]>(cachedLabels || []);
  const [loading, setLoading] = useState(!cachedLabels);

  useEffect(() => {
    if (cachedLabels) {
      setLabels(cachedLabels);
      setLoading(false);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = fetchLabels().then(() => {
        fetchPromise = null;
      });
    }

    fetchPromise!.then(() => {
      setLabels(cachedLabels || []);
      setLoading(false);
    });
  }, []);

  const getLabel = (featureKey: string, defaultLabel: string): string => {
    const override = labels.find(l => l.feature_key === featureKey && l.portal === portal);
    return override?.custom_label || defaultLabel;
  };

  return { getLabel, loading };
};

export const invalidateLabelCache = () => {
  cachedLabels = null;
};
