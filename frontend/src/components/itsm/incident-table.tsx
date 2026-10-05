import { ArrowDown, ArrowUp, ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { CountdownChip, PriorityBadge, StatusBadge } from "@/components/itsm/badges";
import { MultiSelect } from "@/components/itsm/multi-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatBangkok, itsmUrlFor, type EnrichedIncident, type Tier } from "@/lib/incidents";

const ROW_TINT: Record<Tier, string> = {
  overdue: "bg-overdue/10 hover:bg-overdue/16",
  critical: "bg-critical/10 hover:bg-critical/16",
  warning: "bg-warning/8 hover:bg-warning/14",
  ok: "hover:bg-accent/60",
};

type SortKey = "hoursLeft" | "priority_level" | "incident_no" | "service" | "status" | "deadline";

export function IncidentTable({
  incidents,
  now,
  itsmBase,
  serviceOptions,
  showDone,
  onShowDoneChange,
  onSelect,
}: {
  incidents: EnrichedIncident[];
  now: Date;
  itsmBase: string;
  serviceOptions: string[];
  showDone: boolean;
  onShowDoneChange: (v: boolean) => void;
  onSelect: (incident: EnrichedIncident) => void;
}) {
  const [serviceFilter, setServiceFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("hoursLeft");
  const [asc, setAsc] = useState(true);

  const statusOptions = useMemo(
    () => Array.from(new Set(incidents.map((i) => i.status).filter(Boolean))).sort(),
    [incidents],
  );
  const priorityOptions = useMemo(
    () => Array.from(new Set(incidents.map((i) => i.priority_level).filter(Boolean))).sort(),
    [incidents],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = incidents.filter((i) => {
      if (serviceFilter.length && !serviceFilter.includes(i.service)) return false;
      if (statusFilter.length && !statusFilter.includes(i.status)) return false;
      if (priorityFilter.length && !priorityFilter.includes(i.priority_level)) return false;
      if (
        q &&
        ![i.incident_no, i.problemtopic, i.to_support_name]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });

    const dir = asc ? 1 : -1;
    return filtered.sort((a, b) => {
      if (sortKey === "hoursLeft") return (a.hoursLeft - b.hoursLeft) * dir;
      if (sortKey === "deadline")
        return ((a.deadlineDate?.getTime() ?? 0) - (b.deadlineDate?.getTime() ?? 0)) * dir;
      const av = String(a[sortKey === "priority_level" ? "priority_level" : sortKey] ?? "");
      const bv = String(b[sortKey === "priority_level" ? "priority_level" : sortKey] ?? "");
      return av.localeCompare(bv) * dir;
    });
  }, [incidents, serviceFilter, statusFilter, priorityFilter, search, sortKey, asc]);

  function sortBy(key: SortKey) {
    if (key === sortKey) setAsc(!asc);
    else {
      setSortKey(key);
      setAsc(true);
    }
  }

  function SortHead({
    label,
    keyName,
    className,
  }: {
    label: string;
    keyName: SortKey;
    className?: string;
  }) {
    return (
      <th className={cn("px-3 py-2 text-left font-medium", className)}>
        <button
          type="button"
          onClick={() => sortBy(keyName)}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          {label}
          {sortKey === keyName &&
            (asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </button>
      </th>
    );
  }

  function IncidentLink({ incident }: { incident: EnrichedIncident }) {
    const url = itsmUrlFor(incident, itsmBase);
    if (!url) return <span className="font-mono text-sm">{incident.incident_no}</span>;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 font-mono text-sm underline-offset-4 hover:underline"
      >
        {incident.incident_no}
        <ExternalLink className="h-3 w-3 opacity-70" />
      </a>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา incident / หัวข้อ / ผู้รับผิดชอบ"
            className="pl-8"
          />
        </div>
        <MultiSelect
          label="Service"
          options={serviceOptions}
          selected={serviceFilter}
          onChange={setServiceFilter}
        />
        <MultiSelect
          label="Status"
          options={statusOptions}
          selected={statusFilter}
          onChange={setStatusFilter}
        />
        <MultiSelect
          label="Priority"
          options={priorityOptions}
          selected={priorityFilter}
          onChange={setPriorityFilter}
        />
        <div className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5">
          <Switch id="show-done" checked={showDone} onCheckedChange={onShowDoneChange} />
          <Label htmlFor="show-done" className="text-xs">
            แสดงงานที่ปิดแล้ว
          </Label>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden max-h-[70vh] overflow-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface-2 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <SortHead label="Priority" keyName="priority_level" />
              <SortHead label="Incident No" keyName="incident_no" />
              <SortHead label="Service" keyName="service" />
              <SortHead label="Status" keyName="status" />
              <th className="px-3 py-2 text-left font-medium">หัวข้อปัญหา</th>
              <th className="px-3 py-2 text-left font-medium">ผู้รับผิดชอบ</th>
              <SortHead label="Deadline" keyName="deadline" />
              <SortHead label="เหลือเวลา" keyName="hoursLeft" />
              <th className="px-3 py-2 text-left font-medium">Late</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((incident) => (
              <tr
                key={`${incident.incident_no}-${incident.id}`}
                onClick={() => onSelect(incident)}
                className={cn(
                  "cursor-pointer border-t border-border transition",
                  incident.isDone ? "opacity-50 hover:bg-accent/40" : ROW_TINT[incident.tier],
                )}
              >
                <td className="px-3 py-2">
                  <PriorityBadge value={incident.priority_level} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <IncidentLink incident={incident} />
                </td>
                <td className="max-w-40 truncate px-3 py-2">{incident.service}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={incident.status} />
                </td>
                <td className="max-w-80 px-3 py-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="line-clamp-2 text-left">{incident.problemtopic}</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">{incident.problemtopic}</TooltipContent>
                  </Tooltip>
                </td>
                <td className="whitespace-nowrap px-3 py-2">{incident.to_support_name}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                  {formatBangkok(incident.deadlineDate)}
                </td>
                <td className="px-3 py-2">
                  <CountdownChip
                    tier={incident.tier}
                    deadline={incident.deadlineDate}
                    now={now}
                    size="lg"
                  />
                </td>
                <td className="px-3 py-2 text-xs">
                  {incident.isLate ? (
                    <span className="font-semibold text-overdue">เลยกำหนด</span>
                  ) : (
                    <span className="text-muted-foreground">ตรงเวลา</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">ไม่พบรายการที่ตรงเงื่อนไข</p>
        )}
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-border md:hidden">
        {rows.map((incident) => (
          <button
            key={`m-${incident.incident_no}-${incident.id}`}
            type="button"
            onClick={() => onSelect(incident)}
            className={cn(
              "block w-full p-3 text-left",
              incident.isDone ? "opacity-50" : ROW_TINT[incident.tier],
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <PriorityBadge value={incident.priority_level} />
                <IncidentLink incident={incident} />
              </div>
              <CountdownChip
                tier={incident.tier}
                deadline={incident.deadlineDate}
                now={now}
                size="md"
              />
            </div>
            <p className="mt-2 line-clamp-2 text-sm">{incident.problemtopic}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <StatusBadge status={incident.status} />
              <span className="truncate">{incident.service}</span>
              <span>· {incident.to_support_name}</span>
              <span className="font-mono">· {formatBangkok(incident.deadlineDate)}</span>
            </div>
          </button>
        ))}
        {rows.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">ไม่พบรายการที่ตรงเงื่อนไข</p>
        )}
      </div>
    </section>
  );
}
