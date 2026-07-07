import { EffectiveStatus } from "@/lib/types";
import { parseAutomaticRenewal } from "@/lib/contracts/automatic-renewal";

export function computeEffectiveStatus(
  contractStatus: "active" | "inactive",
  expiryDate: string | null | undefined,
  referenceDate: Date = new Date(),
  automaticRenewal: boolean | null = null
): EffectiveStatus {
  if (contractStatus === "inactive") return "inactive";
  if (!expiryDate) return "active";

  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return "active";

  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  if (expiry < today) return "expired";

  const sixtyDaysOut = new Date(today);
  sixtyDaysOut.setDate(sixtyDaysOut.getDate() + 60);

  if (expiry <= sixtyDaysOut) {
    return automaticRenewal === true ? "upcoming_renewal" : "expiring";
  }

  return "active";
}

export function getMetadataValue(
  values: { metadata_fields?: { key: string } | null; value: string | null }[],
  key: string
): string | null {
  const match = values.find((v) => v.metadata_fields?.key === key);
  return match?.value ?? null;
}

export function computeEffectiveStatusFromMetadata(
  contractStatus: "active" | "inactive",
  metadataValues: {
    metadata_fields?: { key: string } | null;
    value: string | null;
  }[],
  referenceDate: Date = new Date()
): EffectiveStatus {
  const expiryDate = getMetadataValue(metadataValues, "expiry_date");
  const automaticRenewal = parseAutomaticRenewal(
    getMetadataValue(metadataValues, "automatic_renewal")
  );
  return computeEffectiveStatus(
    contractStatus,
    expiryDate,
    referenceDate,
    automaticRenewal
  );
}
