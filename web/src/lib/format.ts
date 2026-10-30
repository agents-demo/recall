export {
  fmtTime,
  fmtDate,
  fmtDateTime,
  fmtDuration,
  pct,
  speakerName,
  speakerInitials,
  speakerColor,
  classNames,
  clamp,
} from "./engine";

export function statusLabel(value: string): string {
  const labels: Record<string, string> = {
    captured: "Captured",
    sent: "Sent to PPMA",
    queued: "Queued",
    tombstoned: "Tombstone",
    granted: "Granted",
    withdrawn: "Withdrawn",
    pending: "Pending",
    delivered: "Delivered",
    pass: "Pass",
    watch: "Watch",
    active: "Active",
    retired: "Retired",
    suppressed: "Suppressed",
  };
  return labels[value] ?? value;
}
