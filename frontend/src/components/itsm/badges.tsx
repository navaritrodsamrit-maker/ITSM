import { cn } from "@/lib/utils";
import { countdownText, TIER_LABEL, type Tier } from "@/lib/incidents";

const PRIO_CLASS: Record<string, string> = {
  S1: "bg-prio-s1/18 text-prio-s1 border-prio-s1/45",
  S2: "bg-prio-s2/18 text-prio-s2 border-prio-s2/45",
  S3: "bg-prio-s3/18 text-prio-s3 border-prio-s3/45",
  S4: "bg-prio-s4/15 text-prio-s4 border-prio-s4/40",
};

export function PriorityBadge({ value }: { value: string }) {
  const key = (value ?? "").toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-9 items-center justify-center rounded-md border font-mono text-xs font-bold",
        PRIO_CLASS[key] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {key || "—"}
    </span>
  );
}

function statusClass(status: string) {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "open" || s === "new") return "bg-st-open/18 text-st-open border-st-open/45";
  if (s === "in progress" || s === "inprogress")
    return "bg-st-progress/18 text-st-progress border-st-progress/45";
  if (s === "work around" || s === "workaround")
    return "bg-st-workaround/18 text-st-workaround border-st-workaround/45";
  if (s === "pending" || s === "hold" || s === "on hold")
    return "bg-st-pending/18 text-st-pending border-st-pending/45";
  if (s === "resolved" || s === "closed") return "bg-ok/18 text-ok border-ok/45";
  return "bg-muted text-muted-foreground border-border";
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusClass(status),
      )}
    >
      {status || "—"}
    </span>
  );
}

const TIER_CHIP: Record<Tier, string> = {
  overdue: "bg-overdue/20 text-overdue border-overdue/50",
  critical: "bg-critical/20 text-critical border-critical/50 animate-pulse-urgent",
  warning: "bg-warning/20 text-warning border-warning/50",
  ok: "bg-ok/18 text-ok border-ok/45",
};

export const TIER_DOT: Record<Tier, string> = {
  overdue: "bg-overdue",
  critical: "bg-critical",
  warning: "bg-warning",
  ok: "bg-ok",
};

export function CountdownChip({
  tier,
  deadline,
  now,
  size = "md",
  className,
}: {
  tier: Tier;
  deadline: Date | null;
  now: Date;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <span
      title={TIER_LABEL[tier]}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border font-mono font-bold tabular-nums",
        size === "lg" ? "px-3 py-1.5 text-2xl" : "px-2.5 py-1 text-base",
        TIER_CHIP[tier],
        className,
      )}
    >
      {countdownText(deadline, now)}
    </span>
  );
}

export function TierPill({
  tier,
  count,
  active,
  onClick,
}: {
  tier: Tier;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const label =
    tier === "critical"
      ? `${TIER_LABEL[tier]} ${count} (< 8 ชม.)`
      : tier === "warning"
        ? `ใกล้ครบ ${count}`
        : `${TIER_LABEL[tier]} ${count}`;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition",
        TIER_CHIP[tier],
        active && "ring-2 ring-ring ring-offset-2 ring-offset-background",
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", TIER_DOT[tier])} />
      {label}
    </button>
  );
}
