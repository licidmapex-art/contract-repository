import { EffectiveStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const statusChipStyles: Record<EffectiveStatus, string> = {
  active: "bg-success/15 text-success border-success/20",
  inactive: "bg-muted/10 text-muted border-border",
  expiring: "bg-warning/15 text-warning border-warning/20",
  upcoming_renewal: "bg-warning/15 text-warning border-warning/20",
  expired: "bg-danger/15 text-danger border-danger/20",
};

export const statusDotStyles: Record<EffectiveStatus, string> = {
  active: "bg-success",
  inactive: "bg-muted",
  expiring: "bg-warning",
  upcoming_renewal: "bg-warning",
  expired: "bg-danger",
};

export const statusLabels: Record<EffectiveStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  expiring: "Expiring soon",
  upcoming_renewal: "Upcoming renewal",
  expired: "Expired",
};

export const STATUS_FILTER_OPTIONS: EffectiveStatus[] = [
  "active",
  "upcoming_renewal",
  "expiring",
  "expired",
  "inactive",
];

export function StatusChip({ status }: { status: EffectiveStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusChipStyles[status]
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", statusDotStyles[status])} />
      {statusLabels[status]}
    </span>
  );
}
