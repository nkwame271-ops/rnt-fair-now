// LOCKED project domain constants (frontend mirror of supabase/functions/_shared/project-domain.ts).
// Do NOT change without product approval — prevents drift to sibling workspace domains.
export const ROOT_DOMAIN = "rentcontrolghana.com" as const;
export const SENDER_DOMAIN = "notify.rentcontrolghana.com" as const;
export const PUBLIC_URL = "https://www.rentcontrolghana.com" as const;
export const SUPPORT_EMAIL = "info@rentcontrolghana.com" as const;

export function verifyUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${PUBLIC_URL}${p}`;
}
