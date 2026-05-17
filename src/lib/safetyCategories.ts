export type SafetyCategory =
  | "sexual_harassment"
  | "physical_assault"
  | "digital_abuse"
  | "threats"
  | "domestic_violence"
  | "suspicious_activity"
  | "property_invasion"
  | "health_security"
  | "other";

export type EmergencyType = "police" | "medical" | "fire" | "security" | "other";

export const SAFETY_CATEGORIES: { value: SafetyCategory; label: string }[] = [
  { value: "sexual_harassment", label: "Sexual harassment" },
  { value: "physical_assault", label: "Physical assault" },
  { value: "digital_abuse", label: "Digital abuse / cyberbullying" },
  { value: "threats", label: "Threats or intimidation" },
  { value: "domestic_violence", label: "Domestic or hostel violence" },
  { value: "suspicious_activity", label: "Suspicious activity" },
  { value: "property_invasion", label: "Property invasion" },
  { value: "health_security", label: "Emergency health or security concern" },
  { value: "other", label: "Other safety issue" },
];

export const EMERGENCY_TYPES: { value: EmergencyType; label: string; tel?: string }[] = [
  { value: "police", label: "Police", tel: "191" },
  { value: "medical", label: "Medical", tel: "193" },
  { value: "fire", label: "Fire", tel: "192" },
  { value: "security", label: "Campus / Property Security" },
  { value: "other", label: "Other" },
];

export const SAFETY_STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  under_review: "Under Review",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
  false_alert: "False Alert",
};

export const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};
