import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AdminProfile {
  adminType: "main_admin" | "sub_admin" | "super_admin";
  officeId: string | null;
  officeName: string | null;
  allowedFeatures: string[];
  mutedFeatures: string[];
  isMainAdmin: boolean;
  isSuperAdmin: boolean;
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
        setProfile(null);
        setLoading(false);
        return;
      }

      const p: AdminProfile = {
        adminType: (data as any).admin_type as "main_admin" | "sub_admin" | "super_admin",
        officeId: (data as any).office_id,
        officeName: (data as any).office_name,
        allowedFeatures: (data as any).allowed_features || [],
        mutedFeatures: (data as any).muted_features || [],
        isMainAdmin: (data as any).admin_type === "main_admin" || (data as any).admin_type === "super_admin",
        isSuperAdmin: (data as any).admin_type === "super_admin",
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

// Region → Office hierarchy for all 16 regions of Ghana
export const GHANA_REGIONS_OFFICES: { region: string; offices: { id: string; name: string }[] }[] = [
  {
    region: "Greater Accra",
    offices: [
      { id: "accra_central", name: "ACCRA Central Office (HQ)" },
      { id: "adenta", name: "Adenta" },
      { id: "weija", name: "Weija" },
      { id: "adjen_kotoku", name: "Adjen Kotoku" },
      { id: "ningo_prampram", name: "Ningo- Prampram" },
      { id: "ashaiman", name: "Ashaiman" },
      { id: "tema_new_town", name: "Tema New Town" },
      { id: "amasaman", name: "Amasaman" },
      { id: "dodowa", name: "Dodowa" },
      { id: "tema", name: "Tema" },
      { id: "spintex", name: "Spintex" },
      { id: "sowutuom", name: "Sowutuom" },
      { id: "attah_deka", name: "Attah Deka" },
      { id: "dansoman", name: "Dansoman" },
      { id: "ofankor", name: "Ofankor" },
    ],
  },
  {
    region: "Central",
    offices: [
      { id: "cape_coast", name: "Cape Coast" },
      { id: "winneba", name: "Winneba" },
      { id: "agona_swedru", name: "Agona Swedru" },
      { id: "buduburam", name: "Buduburam" },
      { id: "mankessim", name: "Mankessim" },
      { id: "kasoa", name: "Kasoa" },
    ],
  },
  {
    region: "Western",
    offices: [
      { id: "takoradi", name: "Takoradi" },
      { id: "tarkwa", name: "Tarkwa" },
      { id: "wassa_akropong", name: "Wassa Akropong" },
      { id: "jomoro", name: "Jomoro" },
      { id: "ellembele", name: "Ellembele" },
    ],
  },
  {
    region: "Eastern",
    offices: [
      { id: "koforidua", name: "Koforidua" },
      { id: "krobo_odumase", name: "Krobo Odumase" },
      { id: "kibi", name: "Kibi" },
      { id: "nkawkaw", name: "Nkawkaw" },
      { id: "asamankese", name: "Asamankese" },
      { id: "akim_oda", name: "Akim Oda" },
      { id: "nsawam", name: "Nsawam" },
    ],
  },
  {
    region: "Ashanti",
    offices: [
      { id: "kumasi", name: "Kumasi" },
      { id: "ejisu", name: "Ejisu" },
      { id: "mamponteng", name: "Mamponteng" },
      { id: "asokore_mampong", name: "Asokore Mampong" },
      { id: "ashanti_mampong", name: "Ashanti Mampong" },
      { id: "obuasi", name: "Obuasi" },
      { id: "konongo", name: "Konongo" },
      { id: "nkawie", name: "Nkawie" },
      { id: "effiduase", name: "Effiduase" },
      { id: "asanti_bekwai", name: "Asanti Bekwai" },
      { id: "agogo", name: "Agogo" },
      { id: "offinso", name: "Offinso" },
    ],
  },
  {
    region: "Bono East",
    offices: [
      { id: "kintampo", name: "Kintampo" },
      { id: "nkoranza", name: "Nkoranza" },
      { id: "techiman", name: "Techiman" },
    ],
  },
  {
    region: "Bono",
    offices: [
      { id: "brekum", name: "Brekum" },
      { id: "sunyani", name: "Sunyani" },
      { id: "dormaa_east", name: "Dormaa East" },
    ],
  },
  {
    region: "Northern",
    offices: [
      { id: "tamale", name: "Tamale" },
      { id: "yendi", name: "Yendi" },
    ],
  },
  {
    region: "Upper West",
    offices: [
      { id: "wa", name: "Wa" },
      { id: "lawra", name: "Lawra" },
      { id: "jirapa", name: "Jirapa" },
    ],
  },
  {
    region: "Upper East",
    offices: [
      { id: "bolgatanga", name: "Bolgatanga" },
      { id: "navrongo", name: "Navrongo" },
    ],
  },
  {
    region: "Ahafo",
    offices: [
      { id: "goaso", name: "Goaso" },
    ],
  },
  {
    region: "Volta",
    offices: [
      { id: "kpando_hohoe", name: "Kpando/ Hohoe" },
      { id: "keta", name: "Keta" },
      { id: "denu", name: "Denu" },
      { id: "ho", name: "Ho" },
      { id: "hohoe", name: "Hohoe" },
      { id: "akatsi", name: "Akatsi" },
    ],
  },
  {
    region: "Oti",
    offices: [
      { id: "kedjebi", name: "Kedjebi" },
    ],
  },
  {
    region: "Western North",
    offices: [
      { id: "sefwi_wiawso", name: "Sefwi Wiawso" },
    ],
  },
];

// Derived flat list for backward compatibility
export const GHANA_OFFICES = GHANA_REGIONS_OFFICES.flatMap(r => r.offices);

// All region names
export const GHANA_REGIONS = GHANA_REGIONS_OFFICES.map(r => r.region);

// Helper: get offices for a given region
export const getOfficesForRegion = (region: string): { id: string; name: string }[] => {
  return GHANA_REGIONS_OFFICES.find(r => r.region === region)?.offices || [];
};

// Helper: get region for a given office ID
export const getRegionForOffice = (officeId: string): string | null => {
  for (const r of GHANA_REGIONS_OFFICES) {
    if (r.offices.some(o => o.id === officeId)) return r.region;
  }
  return null;
};

// Helper: get region for a given office name
export const getRegionForOfficeName = (officeName: string): string | null => {
  for (const r of GHANA_REGIONS_OFFICES) {
    if (r.offices.some(o => o.name === officeName)) return r.region;
  }
  return null;
};

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
  sms_broadcast: ["/regulator/sms-broadcast"],
  api_keys: ["/regulator/api-keys"],
  office_wallet: ["/regulator/office-fund-requests"],
  payout_settings: ["/regulator/office-payout-settings"],
  rent_reviews: ["/regulator/rent-reviews"],
  payment_errors: ["/regulator/payment-errors"],
  receipts: ["/regulator/receipts"],
  super_admin: ["/regulator/super-admin"],
};

// Reverse: route → feature key
export const getFeatureKeyForRoute = (route: string): string | null => {
  for (const [key, routes] of Object.entries(FEATURE_ROUTE_MAP)) {
    if (routes.includes(route)) return key;
  }
  return null;
};
