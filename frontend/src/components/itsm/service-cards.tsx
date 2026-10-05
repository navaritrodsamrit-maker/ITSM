import { CheckCircle2, ExternalLink } from "lucide-react";

import { CountdownChip, TIER_DOT } from "@/components/itsm/badges";
import { cn } from "@/lib/utils";
import { TIER_LABEL, TIER_ORDER, itsmUrlFor, type EnrichedIncident, type Tier } from "@/lib/incidents";

const GLOW: Record<Tier, string> = {
  overdue: "glow-overdue",
  critical: "glow-critical",
  warning: "glow-warning",
  ok: "glow-ok",
};

export function ServiceCards({
  services,
  incidents,
  now,
  itsmBase,
  activeService,
  onSelectService,
}: {
  services: string[];
  incidents: EnrichedIncident[];
  now: Date;
  itsmBase: string;
  activeService: string | null;
  onSelectService: (service: string | null) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {services.map((service) => {
        const open = incidents.filter((i) => i.service === service && !i.isDone);
        const counts = TIER_ORDER.map((tier) => ({
          tier,
          count: open.filter((i) => i.tier === tier).length,
        }));
        const worst = TIER_ORDER.find((tier) => open.some((i) => i.tier === tier)) ?? "ok";
        const mostUrgent = [...open].sort((a, b) => a.hoursLeft - b.hoursLeft)[0];
        const url = mostUrgent ? itsmUrlFor(mostUrgent, itsmBase) : null;
        const active = activeService === service;

        return (
          <button
            key={service}
            type="button"
            onClick={() => onSelectService(active ? null : service)}
            className={cn(
              "rounded-2xl border border-border bg-surface p-4 text-left shadow-sm transition hover:bg-surface-2",
              open.length > 0 && GLOW[worst],
              active && "ring-2 ring-ring",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 truncate text-sm font-semibold">{service}</h3>
              <span className="shrink-0 font-mono text-2xl font-bold tabular-nums">
                {open.length}
              </span>
            </div>

            {open.length === 0 ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-ok">
                <CheckCircle2 className="h-5 w-5" />
                ไม่มีงานค้าง
              </div>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {counts.map(({ tier, count }) => (
                    <span key={tier} className="inline-flex items-center gap-1.5">
                      <span className={cn("h-2 w-2 rounded-full", TIER_DOT[tier])} />
                      {TIER_LABEL[tier]} <span className="font-mono font-semibold">{count}</span>
                    </span>
                  ))}
                </div>
                {mostUrgent && (
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        ด่วนที่สุด
                      </p>
                      <p className="truncate font-mono text-xs">{mostUrgent.incident_no}</p>
                    </div>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1"
                      >
                        <CountdownChip
                          tier={mostUrgent.tier}
                          deadline={mostUrgent.deadlineDate}
                          now={now}
                          size="lg"
                        />
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </a>
                    ) : (
                      <CountdownChip
                        tier={mostUrgent.tier}
                        deadline={mostUrgent.deadlineDate}
                        now={now}
                        size="lg"
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
