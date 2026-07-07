export const AUTOMATIC_RENEWAL_FIELD_KEY = "automatic_renewal";

export function parseAutomaticRenewal(
  value: string | null | undefined
): boolean | null {
  if (value == null || !String(value).trim()) return null;

  const normalized = String(value).trim().toLowerCase();
  if (["true", "yes", "1", "automatic", "auto", "automatically"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "0", "none", "manual", "not automatic"].includes(normalized)) {
    return false;
  }
  return null;
}

export function serializeAutomaticRenewal(value: boolean | null): string | null {
  if (value === true) return "true";
  if (value === false) return "false";
  return null;
}

export function formatAutomaticRenewal(value: boolean | null): string {
  if (value === true) return "Yes — automatic renewal";
  if (value === false) return "No";
  return "Unknown";
}

export const AUTOMATIC_RENEWAL_PLAYBOOK = `Determine whether the contract automatically renews or extends at the end of its initial term (or each renewal period) unless a party gives notice to terminate or not renew.
Return true if the contract states automatic renewal, extension, or rollover.
Return false if renewal requires an explicit new agreement or is clearly manual only.
Return null if the contract does not address renewal or it is unclear.`;
