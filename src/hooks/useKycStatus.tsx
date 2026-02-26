import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type KycStatus = "none" | "pending" | "verified" | "rejected";

export const useKycStatus = () => {
  const { user, role } = useAuth();
  const [kycStatus, setKycStatus] = useState<KycStatus>("none");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || role === "regulator") {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase
        .from("kyc_verifications")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();

      setKycStatus((data?.status as KycStatus) || "none");
      setLoading(false);
    };

    fetch();
  }, [user, role]);

  return { kycStatus, loading, isVerified: kycStatus === "verified" };
};
