// Auto-format phone number: 024 555 1234
export const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
};

// Auto-format Ghana Card: GHA-XXXXXXXXX-X
export const formatGhanaCard = (value: string): string => {
  const upper = value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  // If user types raw digits after GHA-, auto-insert dashes
  const clean = upper.replace(/^GHA-?/, "").replace(/-/g, "");
  if (!clean) return upper.startsWith("G") ? upper.slice(0, 4) : upper;
  
  const digits = clean.slice(0, 10);
  if (digits.length <= 9) return `GHA-${digits}`;
  return `GHA-${digits.slice(0, 9)}-${digits.slice(9, 10)}`;
};

// Validation helpers
export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const isValidPhone = (phone: string) => phone.replace(/\D/g, "").length === 10;
export const isValidGhanaCard = (value: string) => /^GHA-\d{9}-\d$/.test(value);
export const isValidPassword = (password: string) => password.length >= 6;
