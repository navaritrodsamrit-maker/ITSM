import { Link } from "@tanstack/react-router";
import { Activity, MessageSquareText, RefreshCw } from "lucide-react";

import { SettingsDialog } from "@/components/itsm/settings-dialog";
import { ThemeToggle } from "@/components/itsm/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORT_GROUPS, type AppSettings } from "@/config";
import { cn } from "@/lib/utils";

const ALL_VALUE = "__all__";

export function TopBar({
  month,
  onMonthChange,
  supportGroup,
  onSupportGroupChange,
  lastUpdated,
  isFetching,
  onRefresh,
  settings,
  onSettingsChange,
  settingsOpen,
  onSettingsOpenChange,
}: {
  month: string;
  onMonthChange: (v: string) => void;
  supportGroup: string;
  onSupportGroupChange: (v: string) => void;
  lastUpdated: number | null;
  isFetching: boolean;
  onRefresh: () => void;
  settings: AppSettings;
  onSettingsChange: (next: AppSettings) => void;
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
}) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
          <Activity className="h-5 w-5" />
        </span>
        <h1 className="truncate text-lg font-bold tracking-tight">ITSM Monitor</h1>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Input
          type="month"
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className="w-40 font-mono text-sm"
          aria-label="เดือน/ปี"
        />
        <Select
          value={supportGroup === "" ? ALL_VALUE : supportGroup}
          onValueChange={(v) => onSupportGroupChange(v === ALL_VALUE ? "" : v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Support group" />
          </SelectTrigger>
          <SelectContent>
            {SUPPORT_GROUPS.map((g) => (
              <SelectItem key={g.label} value={g.value === "" ? ALL_VALUE : g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="text-right text-xs text-muted-foreground">
          <p>อัปเดตล่าสุด</p>
          <p className="font-mono">
            {lastUpdated ? new Date(lastUpdated).toLocaleTimeString("th-TH") : "—"}
          </p>
        </div>

        <Button variant="outline" size="icon" onClick={onRefresh} aria-label="รีเฟรช">
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
        <Button asChild variant="outline" size="icon" aria-label="ผู้ช่วย AI">
          <Link to="/chat">
            <MessageSquareText className="h-4 w-4" />
          </Link>
        </Button>
        <SettingsDialog
          settings={settings}
          onSave={onSettingsChange}
          open={settingsOpen}
          onOpenChange={onSettingsOpenChange}
        />
        <ThemeToggle />
      </div>
    </header>
  );
}
