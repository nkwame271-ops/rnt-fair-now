// LOCKED project domain constants. Do NOT change without product approval.
// Prevents this project's emails/links from drifting to a sibling workspace domain.
export const ROOT_DOMAIN = "rentcontrolghana.com" as const;
export const SENDER_DOMAIN = "notify.rentcontrolghana.com" as const;
export const FROM_ADDRESS = "RentControlGhana <noreply@notify.rentcontrolghana.com>" as const;
export const PUBLIC_URL = "https://www.rentcontrolghana.com" as const;
export const SUPPORT_EMAIL = "info@rentcontrolghana.com" as const;

export function verifyUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${PUBLIC_URL}${p}`;
}
