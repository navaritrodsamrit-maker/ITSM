from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="ITSM_", extra="ignore")

    base_url: str = "https://itsm.cpall.co.th"
    cookie: str = ""                  # ITSM_COOKIE ใน .env (session cookie ชื่อ "itsm")
    cookie_file: str = "/data/itsm_cookie"   # ถ้ามีไฟล์นี้ = ใช้ค่าในไฟล์แทน (อัปเดตผ่าน UI)
    admin_token: str = ""             # ITSM_ADMIN_TOKEN: ต้องมีถึงจะอัปเดต cookie ผ่าน API ได้
    timeout: float = 30.0
    support_group: str = "Application Support"   # กรองผลลัพธ์เริ่มต้น ("" = ไม่กรอง)
    tz: str = "Asia/Bangkok"

    # แจ้งเตือน MS Teams
    teams_webhook: str = ""            # ITSM_TEAMS_WEBHOOK (Power Automate / Workflows URL)
    alert_hours: float = 24.0          # ITSM_ALERT_HOURS: แจ้งเฉพาะงานที่เหลือ < ชม.นี้ (รวมที่เลยกำหนด)
    services: str = "Store Retention Management,Human Resource Management"  # ITSM_SERVICES
    always_status: str = "รอดำเนินการ Assign"   # ITSM_ALWAYS_STATUS: status พวกนี้แจ้งเสมอ ไม่สน deadline

    # CORS: โดเมน frontend ที่อนุญาต (คั่นด้วย ,) — "*" = ทุกโดเมน
    cors_origins: str = "*"            # ITSM_CORS_ORIGINS เช่น https://itsm-watcher.vercel.app

    # RAG / Ollama
    ollama_url: str = "http://host.docker.internal:11434"   # ITSM_OLLAMA_URL
    chat_model: str = "qwen3:8b"      # ITSM_CHAT_MODEL
    embed_model: str = "bge-m3"       # ITSM_EMBED_MODEL (ต้อง ollama pull ก่อน)
    rag_db: str = "/data/rag.db"
    rag_top_k: int = 5
    rag_chunk_chars: int = 900
    rag_chunk_overlap: int = 150

    def current_cookie(self) -> str:
        """cookie ที่ใช้จริง: ไฟล์ (ถ้ามี) > env ITSM_COOKIE."""
        try:
            v = Path(self.cookie_file).read_text().strip()
            if v:
                return v
        except OSError:
            pass
        return self.cookie

    def save_cookie(self, value: str) -> None:
        p = Path(self.cookie_file)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(value.strip() + "\n")

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def service_list(self) -> list[str]:
        return [s.strip() for s in self.services.split(",") if s.strip()]

    @property
    def always_status_list(self) -> list[str]:
        return [s.strip().casefold() for s in self.always_status.split(",") if s.strip()]


settings = Settings()
