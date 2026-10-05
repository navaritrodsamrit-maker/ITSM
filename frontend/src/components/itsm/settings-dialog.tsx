import { KeyRound, Loader2, Settings2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE } from "@/config";
import type { AppSettings } from "@/config";

export function SettingsDialog({
  settings,
  onSave,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  settings: AppSettings;
  onSave: (next: AppSettings) => void;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [draft, setDraft] = useState(settings);
  const [servicesText, setServicesText] = useState(settings.services.join("\n"));
  const [cookieStatus, setCookieStatus] = useState<
    { state: "idle" } | { state: "loading" } | { state: "ok"; message: string } | { state: "error"; message: string }
  >({ state: "idle" });

  // ผู้ใช้พิมพ์ apiBase เองต่างจาก default ปัจจุบัน -> ถือเป็น override ถาวร
  // เท่ากับ default -> เลิก override กลับไป sync ตาม VITE_API_BASE ทุกครั้งที่ deploy เปลี่ยน
  function withApiBaseFlag(next: AppSettings): AppSettings {
    return { ...next, apiBaseIsCustom: next.apiBase.trim() !== API_BASE };
  }

  function openChange(next: boolean) {
    if (next) {
      setDraft(settings);
      setServicesText(settings.services.join("\n"));
      setCookieStatus({ state: "idle" });
    }
    if (controlledOnOpenChange) controlledOnOpenChange(next);
    else setInternalOpen(next);
  }

  async function updateCookie() {
    if (!draft.adminToken.trim()) {
      setCookieStatus({ state: "error", message: "กรุณากรอก Admin token" });
      return;
    }
    if (!draft.itsmCookie.trim()) {
      setCookieStatus({ state: "error", message: "กรุณากรอก ITSM cookie" });
      return;
    }
    setCookieStatus({ state: "loading" });
    try {
      const res = await fetch(
        `${draft.apiBase.replace(/\/$/, "")}/admin/itsm-cookie`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Admin-Token": draft.adminToken.trim(),
          },
          body: JSON.stringify({ cookie: draft.itsmCookie.trim() }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setCookieStatus({
          state: "error",
          message: `HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ""}`,
        });
        return;
      }
      onSave(withApiBaseFlag({ ...draft, services: draft.services }));
      setCookieStatus({ state: "ok", message: "อัปเดต cookie สำเร็จ" });
    } catch {
      setCookieStatus({ state: "error", message: "เชื่อมต่อ API ไม่สำเร็จ" });
    }
  }

  function submit() {
    const services = servicesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    onSave(withApiBaseFlag({ ...draft, services }));
    openChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={openChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="ตั้งค่า">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ตั้งค่าการมอนิเตอร์</DialogTitle>
          <DialogDescription>ค่าทั้งหมดถูกบันทึกไว้ในเบราว์เซอร์นี้</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="services">รายการ Service (บรรทัดละ 1 รายการ)</Label>
            <Textarea
              id="services"
              rows={4}
              value={servicesText}
              onChange={(e) => setServicesText(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="apiBase">API Base URL</Label>
              <Input
                id="apiBase"
                value={draft.apiBase}
                onChange={(e) => setDraft({ ...draft, apiBase: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="itsmBase">ITSM Base URL</Label>
              <Input
                id="itsmBase"
                value={draft.itsmBase}
                onChange={(e) => setDraft({ ...draft, itsmBase: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="poll">รอบดึงข้อมูล (วินาที)</Label>
              <Input
                id="poll"
                type="number"
                min={10}
                value={Math.round(draft.pollIntervalMs / 1000)}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    pollIntervalMs: Math.max(10, Number(e.target.value) || 60) * 1000,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="critical">เกณฑ์วิกฤต (ชม.)</Label>
              <Input
                id="critical"
                type="number"
                value={draft.criticalHours}
                onChange={(e) =>
                  setDraft({ ...draft, criticalHours: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warning">เกณฑ์ใกล้ครบกำหนด (ชม.)</Label>
              <Input
                id="warning"
                type="number"
                value={draft.warningHours}
                onChange={(e) => setDraft({ ...draft, warningHours: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="sound">แจ้งเตือนด้วยเสียงเมื่อมีงานวิกฤตใหม่</Label>
            <Switch
              id="sound"
              checked={draft.soundEnabled}
              onCheckedChange={(v) => setDraft({ ...draft, soundEnabled: v })}
            />
          </div>
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="space-y-2">
              <Label htmlFor="adminToken">Admin token</Label>
              <Input
                id="adminToken"
                type="password"
                value={draft.adminToken}
                onChange={(e) => setDraft({ ...draft, adminToken: e.target.value })}
                className="font-mono text-xs"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="itsmCookie">ITSM cookie</Label>
              <Textarea
                id="itsmCookie"
                rows={3}
                value={draft.itsmCookie}
                onChange={(e) => setDraft({ ...draft, itsmCookie: e.target.value })}
                className="font-mono text-xs"
                placeholder="session=..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={updateCookie}
                disabled={cookieStatus.state === "loading"}
              >
                {cookieStatus.state === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                อัปเดต cookie
              </Button>
              {cookieStatus.state === "ok" && (
                <p className="text-xs font-medium text-ok">{cookieStatus.message}</p>
              )}
              {cookieStatus.state === "error" && (
                <p className="text-xs font-medium text-overdue">{cookieStatus.message}</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => openChange(false)}>
            ยกเลิก
          </Button>
          <Button onClick={submit}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
