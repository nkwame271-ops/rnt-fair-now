import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AdminProfile {
  adminType: "main_admin" | "sub_admin";
  officeId: string | null;
  officeName: string | null;
  allowedFeatures: string[];
  mutedFeatures: string[];
  isMainAdmin: boolean;
}

let cachedProfile: AdminProfile | null = null;
let cachedUserId: string | null = null;

export const useAdminProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<AdminProfile | null>(cachedUserId === user?.id ? cachedProfile : null);
  const [loading, setLoading] = useState(!profile);

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }

    if (cachedUserId === user.id && cachedProfile) {
      setProfile(cachedProfile);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data, error } = await supabase
        .from("admin_staff")
        .select("admin_type, office_id, office_name, allowed_features, muted_features")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data) {
        // No admin_staff record — treat as main_admin if they're the original admin
        // or as sub_admin with no permissions
        setProfile(null);
        setLoading(false);
        return;
      }

      const p: AdminProfile = {
        adminType: (data as any).admin_type as "main_admin" | "sub_admin",
        officeId: (data as any).office_id,
        officeName: (data as any).office_name,
        allowedFeatures: (data as any).allowed_features || [],
        mutedFeatures: (data as any).muted_features || [],
        isMainAdmin: (data as any).admin_type === "main_admin",
      };

      cachedProfile = p;
      cachedUserId = user.id;
      setProfile(p);
      setLoading(false);
    };

    fetch();
  }, [user?.id]);

  return { profile, loading, refetch: () => { cachedProfile = null; cachedUserId = null; } };
};

export const GHANA_OFFICES = [
  { id: "accra_central", name: "Accra Central Office" },
  { id: "accra_north", name: "Accra North Office" },
  { id: "tema", name: "Tema Office" },
  { id: "kumasi", name: "Kumasi Office" },
  { id: "kumasi_south", name: "Kumasi South Office" },
  { id: "takoradi", name: "Takoradi Office" },
  { id: "cape_coast", name: "Cape Coast Office" },
  { id: "tamale", name: "Tamale Office" },
  { id: "sunyani", name: "Sunyani Office" },
  { id: "ho", name: "Ho Office" },
  { id: "koforidua", name: "Koforidua Office" },
  { id: "bolgatanga", name: "Bolgatanga Office" },
  { id: "wa", name: "Wa Office" },
  { id: "techiman", name: "Techiman Office" },
  { id: "goaso", name: "Goaso Office" },
  { id: "damongo", name: "Damongo Office" },
  { id: "nalerigu", name: "Nalerigu Office" },
  { id: "dambai", name: "Dambai Office" },
  { id: "sefwi_wiawso", name: "Sefwi Wiawso Office" },
  { id: "tarkwa", name: "Tarkwa Office" },
  { id: "obuasi", name: "Obuasi Office" },
  { id: "nkawkaw", name: "Nkawkaw Office" },
  { id: "winneba", name: "Winneba Office" },
  { id: "kasoa", name: "Kasoa Office" },
  { id: "madina", name: "Madina Office" },
  { id: "ashaiman", name: "Ashaiman Office" },
  { id: "teshie_nungua", name: "Teshie-Nungua Office" },
  { id: "dansoman", name: "Dansoman Office" },
  { id: "kaneshie", name: "Kaneshie Office" },
  { id: "achimota", name: "Achimota Office" },
  { id: "adenta", name: "Adenta Office" },
  { id: "dome", name: "Dome Office" },
  { id: "lapaz", name: "Lapaz Office" },
  { id: "spintex", name: "Spintex Office" },
  { id: "east_legon", name: "East Legon Office" },
  { id: "airport_area", name: "Airport Area Office" },
  { id: "osu", name: "Osu Office" },
  { id: "la", name: "La Office" },
  { id: "cantonment", name: "Cantonment Office" },
  { id: "dzorwulu", name: "Dzorwulu Office" },
  { id: "roman_ridge", name: "Roman Ridge Office" },
  { id: "weija", name: "Weija Office" },
  { id: "awoshie", name: "Awoshie Office" },
  { id: "ablekuma", name: "Ablekuma Office" },
  { id: "amasaman", name: "Amasaman Office" },
  { id: "nsawam", name: "Nsawam Office" },
  { id: "suhum", name: "Suhum Office" },
  { id: "oda", name: "Oda Office" },
  { id: "akim_oda", name: "Akim Oda Office" },
  { id: "swedru", name: "Swedru Office" },
  { id: "mankessim", name: "Mankessim Office" },
  { id: "elmina", name: "Elmina Office" },
  { id: "saltpond", name: "Saltpond Office" },
  { id: "keta", name: "Keta Office" },
  { id: "hohoe", name: "Hohoe Office" },
  { id: "kpando", name: "Kpando Office" },
  { id: "nkwanta", name: "Nkwanta Office" },
  { id: "bawku", name: "Bawku Office" },
  { id: "navrongo", name: "Navrongo Office" },
  { id: "yendi", name: "Yendi Office" },
  { id: "bimbilla", name: "Bimbilla Office" },
  { id: "salaga", name: "Salaga Office" },
  { id: "kintampo", name: "Kintampo Office" },
  { id: "berekum", name: "Berekum Office" },
  { id: "dormaa", name: "Dormaa Office" },
  { id: "bibiani", name: "Bibiani Office" },
];

// Maps feature keys to regulator nav routes
export const FEATURE_ROUTE_MAP: Record<string, string[]> = {
  dashboard: ["/regulator/dashboard"],
  tenants: ["/regulator/tenants"],
  landlords: ["/regulator/landlords"],
  properties: ["/regulator/properties"],
  complaints: ["/regulator/complaints"],
  applications: ["/regulator/applications"],
  agreements: ["/regulator/agreements"],
  agreement_templates: ["/regulator/agreement-templates"],
  rent_assessments: ["/regulator/rent-assessments"],
  terminations: ["/regulator/terminations"],
  rent_cards: ["/regulator/rent-cards"],
  escrow: ["/regulator/escrow"],
  analytics: ["/regulator/analytics"],
  kyc: ["/regulator/kyc"],
  engine_room: ["/regulator/engine-room"],
  invite_staff: ["/regulator/invite-staff"],
  feedback: ["/regulator/feedback"],
  support_chats: ["/regulator/support-chats"],
  api_keys: ["/regulator/api-keys"],
};

// Reverse: route → feature key
export const getFeatureKeyForRoute = (route: string): string | null => {
  for (const [key, routes] of Object.entries(FEATURE_ROUTE_MAP)) {
    if (routes.includes(route)) return key;
  }
  return null;
};
