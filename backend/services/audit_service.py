import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from settings import settings

logger = logging.getLogger("cxr.audit")


def write_audit_event(event: dict[str, Any]) -> None:
    """Persist a patient-safe audit event locally and through structured stdout logs."""
    payload = {
        "timestamp": datetime.now(UTC).isoformat(),
        **event,
    }
    # Cloud Run captures stdout/stderr in Cloud Logging. Keeping the complete
    # audit payload in structured fields makes the trail survive instance restarts.
    logger.info("audit_event", extra=payload)

    if not settings.audit_log_path:
        return
    path = Path(settings.audit_log_path)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=True) + "\n")
    except OSError:
        logger.exception("audit_write_failed", extra={"event_type": event.get("event_type")})
