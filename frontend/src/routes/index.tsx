import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { TierPill } from "@/components/itsm/badges";
import { IncidentDrawer } from "@/components/itsm/incident-drawer";
import { IncidentTable } from "@/components/itsm/incident-table";
import { ServiceCards } from "@/components/itsm/service-cards";
import { TopBar } from "@/components/itsm/top-bar";
import { DEFAULT_SUPPORT_GROUP, defaultSettings, loadSettings, saveSettings, type AppSettings } from "@/config";
import { useNow } from "@/hooks/use-now";
import { enrich, type EnrichedIncident, type Tier } from "@/lib/incidents";
import { fetchAllServices } from "@/lib/itsm-api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ITSM Monitor — เฝ้าระวัง Incident แบบเรียลไทม์" },
      {
        name: "description",
        content:
          "แดชบอร์ดมอนิเตอร์ Incident ของทีม IT Service Management พร้อมนับเวลาถอยหลังตาม SLA แยกตามระดับความเร่งด่วน",
      },
      { property: "og:title", content: "ITSM Monitor — เฝ้าระวัง Incident แบบเรียลไทม์" },
      {
        property: "og:description",
        content: "ติดตามงานค้าง เลยกำหนด และงานวิกฤตของทุก Service ในหน้าจอเดียว",
      },
    ],
  }),
  component: Dashboard,
});

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function Dashboard() {
  const now = useNow(1000);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [month, setMonth] = useState(currentMonth());
  const [supportGroup, setSupportGroup] = useState(DEFAULT_SUPPORT_GROUP);
  const [tierFilter, setTierFilter] = useState<Tier | null>(null);
  const [serviceFocus, setServiceFocus] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [selected, setSelected] = useState<EnrichedIncident | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const firstLoadRef = useRef(true);
  const knownUrgentRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  function updateSettings(next: AppSettings) {
    setSettings(next);
    saveSettings(next);
  }

  const year = month.slice(0, 4);

  const query = useQuery({
    queryKey: [
      "itsm",
      settings.apiBase,
      settings.services.join("|"),
      month,
      year,
      supportGroup,
    ],
    queryFn: () =>
      fetchAllServices(
        { apiBase: settings.apiBase, services: settings.services, month, year, supportGroup },
        firstLoadRef.current,
      ),
    refetchInterval: settings.pollIntervalMs,
    placeholderData: (prev) => prev,
    retry: false,
  });

  const data = query.data;

  useEffect(() => {
    if (data) firstLoadRef.current = false;
    if (data?.usedMock) {
      toast.warning("ไม่สามารถเชื่อมต่อ API ได้ — กำลังแสดงข้อมูลตัวอย่าง");
    }
  }, [data]);

  useEffect(() => {
    if (data?.failedServices?.length && !data.usedMock) {
      toast.error(`ดึงข้อมูลบางส่วนไม่สำเร็จ: ${data.failedServices.join(", ")}`);
    }
  }, [data]);

  useEffect(() => {
    if (query.error) toast.error("เชื่อมต่อ API ไม่สำเร็จ — แสดงข้อมูลล่าสุดที่มี");
  }, [query.error]);

  const incidents = useMemo(() => {
    const raw = (data?.results ?? []).flatMap((r) => r.incidents);
    return raw.map((i) => enrich(i, now, settings.criticalHours, settings.warningHours));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, settings.criticalHours, settings.warningHours, Math.floor(now.getTime() / 60_000)]);

  // Sound / toast when incidents newly become critical or overdue between polls.
  useEffect(() => {
    const urgent = incidents.filter(
      (i) => !i.isDone && (i.tier === "critical" || i.tier === "overdue"),
    );
    const fresh = urgent.filter((i) => !knownUrgentRef.current.has(i.incident_no));
    if (knownUrgentRef.current.size > 0 && fresh.length > 0) {
      toast.error(`มีงานเข้าสู่สถานะเร่งด่วน ${fresh.length} รายการ`);
      if (settings.soundEnabled && typeof window !== "undefined" && "AudioContext" in window) {
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = 880;
          gain.gain.value = 0.05;
          osc.connect(gain).connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
        } catch {
          /* ignore */
        }
      }
    }
    urgent.forEach((i) => knownUrgentRef.current.add(i.incident_no));
  }, [incidents, settings.soundEnabled]);

  const counts = useMemo(() => {
    const active = incidents.filter((i) => !i.isDone);
    return {
      overdue: active.filter((i) => i.tier === "overdue").length,
      critical: active.filter((i) => i.tier === "critical").length,
      warning: active.filter((i) => i.tier === "warning").length,
    };
  }, [incidents]);

  const visible = useMemo(() => {
    let list = incidents;
    if (!showDone) list = list.filter((i) => !i.isDone);
    if (serviceFocus) list = list.filter((i) => i.service === serviceFocus);
    if (tierFilter) list = list.filter((i) => i.tier === tierFilter && !i.isDone);
    return list;
  }, [incidents, showDone, serviceFocus, tierFilter]);

  const alertTotal = counts.overdue + counts.critical + counts.warning;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar
        month={month}
        onMonthChange={(v) => setMonth(v || currentMonth())}
        supportGroup={supportGroup}
        onSupportGroupChange={setSupportGroup}
        lastUpdated={data?.fetchedAt ?? null}
        isFetching={query.isFetching}
        onRefresh={() => query.refetch()}
        settings={settings}
        onSettingsChange={updateSettings}
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
      />

      {data?.unauthorized && (
        <div className="flex items-center gap-2 border-b border-overdue/40 bg-overdue/15 px-4 py-2 text-sm font-medium text-overdue">
          <AlertTriangle className="h-4 w-4" />
          เซสชัน ITSM หมดอายุ ติดต่อผู้ดูแล
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="ml-auto rounded-md border border-overdue/40 px-2.5 py-1 text-xs font-semibold hover:bg-overdue/20"
          >
            อัปเดต cookie
          </button>
        </div>
      )}

      {alertTotal > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur">
          {counts.overdue > 0 && (
            <TierPill
              tier="overdue"
              count={counts.overdue}
              active={tierFilter === "overdue"}
              onClick={() => setTierFilter(tierFilter === "overdue" ? null : "overdue")}
            />
          )}
          {counts.critical > 0 && (
            <TierPill
              tier="critical"
              count={counts.critical}
              active={tierFilter === "critical"}
              onClick={() => setTierFilter(tierFilter === "critical" ? null : "critical")}
            />
          )}
          {counts.warning > 0 && (
            <TierPill
              tier="warning"
              count={counts.warning}
              active={tierFilter === "warning"}
              onClick={() => setTierFilter(tierFilter === "warning" ? null : "warning")}
            />
          )}
          {(tierFilter || serviceFocus) && (
            <button
              type="button"
              onClick={() => {
                setTierFilter(null);
                setServiceFocus(null);
              }}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          )}
        </div>
      )}

      <main className="space-y-5 p-4">
        <ServiceCards
          services={settings.services}
          incidents={incidents}
          now={now}
          itsmBase={settings.itsmBase}
          activeService={serviceFocus}
          onSelectService={setServiceFocus}
        />

        <IncidentTable
          incidents={visible}
          now={now}
          itsmBase={settings.itsmBase}
          serviceOptions={settings.services}
          showDone={showDone}
          onShowDoneChange={setShowDone}
          onSelect={setSelected}
        />
      </main>

      <IncidentDrawer
        incident={selected}
        now={now}
        itsmBase={settings.itsmBase}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}
