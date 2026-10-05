import { ExternalLink } from "lucide-react";

import { CountdownChip, PriorityBadge, StatusBadge } from "@/components/itsm/badges";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  TIER_LABEL,
  formatBangkok,
  formatCreateDate,
  itsmUrlFor,
  type EnrichedIncident,
} from "@/lib/incidents";

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={mono ? "font-mono text-sm break-words" : "text-sm break-words"}>
        {value || "—"}
      </p>
    </div>
  );
}

export function IncidentDrawer({
  incident,
  now,
  itsmBase,
  onOpenChange,
}: {
  incident: EnrichedIncident | null;
  now: Date;
  itsmBase: string;
  onOpenChange: (open: boolean) => void;
}) {
  const url = incident ? itsmUrlFor(incident, itsmBase) : null;

  return (
    <Sheet open={Boolean(incident)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-auto sm:max-w-lg">
        {incident && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 font-mono">
                {incident.incident_no}
                <PriorityBadge value={incident.priority_level} />
              </SheetTitle>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-8">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={incident.status} />
                <CountdownChip
                  tier={incident.tier}
                  deadline={incident.deadlineDate}
                  now={now}
                  size="lg"
                />
                <span className="text-xs text-muted-foreground">{TIER_LABEL[incident.tier]}</span>
              </div>

              {url ? (
                <Button asChild className="w-full">
                  <a href={url} target="_blank" rel="noopener">
                    เปิดใน ITSM <ExternalLink className="ml-1 h-4 w-4" />
                  </a>
                </Button>
              ) : (
                <Button className="w-full" disabled>
                  ไม่มีลิงก์ ITSM
                </Button>
              )}

              <Field label="หัวข้อปัญหา" value={incident.problemtopic} />

              <div className="grid grid-cols-2 gap-4">
                <Field label="Service" value={incident.service} />
                <Field label="Category" value={incident.category} />
                <Field label="Sub Category" value={incident.sub_category} />
                <Field label="Office" value={incident.office} />
                <Field label="Support Group" value={incident.support_group} />
                <Field label="หัวหน้าทีม" value={incident.group_header} />
                <Field label="ผู้รับผิดชอบ" value={incident.to_support_name} />
                <Field
                  label="เหลือเวลา (ชม.)"
                  value={String(incident.hoursLeft)}
                  mono
                />
                <Field label="Deadline" value={formatBangkok(incident.deadlineDate)} mono />
                <Field label="วันที่แจ้ง" value={formatCreateDate(incident.createDate)} mono />
                <Field label="Late" value={incident.isLate ? incident.lateStatus : "On time"} />
                <Field label="ID" value={String(incident.id ?? 0)} mono />
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
