import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from settings import settings

logger = logging.getLogger("cxr.audit")


def write_audit_event(event: dict[str, Any]) -> None:
    """Append a patient-safe audit event without image bytes or DICOM metadata."""
    payload = {
        "timestamp": datetime.now(UTC).isoformat(),
        **event,
    }
    path = Path(settings.audit_log_path)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=True) + "\n")
    except OSError:
        logger.exception("audit_write_failed", extra={"event_type": event.get("event_type")})
