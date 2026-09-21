"""Filtro de entrada para detectar imagenes claramente incompatibles con una CXR."""

import io
from dataclasses import dataclass

import numpy as np
import pydicom
from PIL import Image

_CXR_MODALITIES = {"CR", "DX", "DR", "RG"}
_NON_CXR_MODALITIES = {"CT", "MR", "US", "MG", "NM", "PT", "XA", "RF"}


@dataclass(frozen=True)
class CXRScreeningResult:
    status: str
    score: float
    method: str
    reasons: tuple[str, ...]
    reject: bool = False

    def response_data(self) -> dict:
        """Campos publicos; ``reject`` es una decision interna del pipeline."""
        return {
            "status": self.status,
            "score": self.score,
            "method": self.method,
            "reasons": list(self.reasons),
        }


def _dicom_modality(file_bytes: bytes) -> str | None:
    try:
        dataset = pydicom.dcmread(
            io.BytesIO(file_bytes),
            stop_before_pixels=True,
            specific_tags=["Modality"],
            force=False,
        )
    except Exception:
        return None
    value = str(getattr(dataset, "Modality", "") or "").strip().upper()
    return value or None


def _color_fraction(file_bytes: bytes) -> float:
    """Fraccion de pixeles con cromaticidad visible en un PNG/JPG."""
    try:
        with Image.open(io.BytesIO(file_bytes)) as source:
            if len(source.getbands()) < 3:
                return 0.0
            sample = source.convert("RGB")
            sample.thumbnail((256, 256))
            rgb = np.asarray(sample, dtype=np.int16)
    except Exception:
        return 0.0
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    return float(np.mean(chroma > 24))


def classify_cxr(file_bytes: bytes, fmt: str, img_array: np.ndarray) -> CXRScreeningResult:
    """
    Clasifica la compatibilidad tecnica de la entrada con una radiografia de torax.

    No estima calidad diagnostica. Solo rechaza evidencia fuerte: modalidad DICOM
    no radiografica, fotografia claramente cromatica o imagen practicamente plana.
    El resto se marca como compatible o dudoso para evitar falsos rechazos.
    """
    if fmt == "dicom":
        modality = _dicom_modality(file_bytes)
        if modality in _CXR_MODALITIES:
            return CXRScreeningResult(
                status="likely_cxr",
                score=0.99,
                method="dicom_modality",
                reasons=(f"Modalidad DICOM {modality} compatible con radiografia.",),
            )
        if modality in _NON_CXR_MODALITIES:
            return CXRScreeningResult(
                status="not_cxr",
                score=0.01,
                method="dicom_modality",
                reasons=(f"Modalidad DICOM {modality} no compatible con radiografia de torax.",),
                reject=True,
            )

    image = img_array.astype(np.float32)
    h, w = image.shape[:2]
    aspect = max(h, w) / max(min(h, w), 1)
    std = float(image.std())
    p05, p95 = np.percentile(image, [5, 95])
    dynamic_range = float(p95 - p05)
    color_fraction = 0.0 if fmt == "dicom" else _color_fraction(file_bytes)

    if color_fraction > 0.35:
        return CXRScreeningResult(
            status="not_cxr",
            score=0.02,
            method="visual_heuristics_v1",
            reasons=("La imagen contiene color en gran parte del campo, compatible con una fotografia.",),
            reject=True,
        )

    if std < 3.0 or dynamic_range < 10.0:
        return CXRScreeningResult(
            status="not_cxr",
            score=0.05,
            method="visual_heuristics_v1",
            reasons=("La imagen no contiene variacion de intensidad suficiente para una radiografia.",),
            reject=True,
        )

    score = 0.45
    reasons: list[str] = []

    if color_fraction <= 0.02:
        score += 0.20
        reasons.append("Predominio monocromatico compatible con radiografia.")
    elif color_fraction > 0.12:
        score -= 0.25
        reasons.append("Se detecto color visible en una proporcion inusual para radiografia.")

    if aspect <= 1.8:
        score += 0.15
    else:
        score -= 0.30
        reasons.append("Relacion de aspecto atipica para una radiografia de torax.")

    if 12.0 <= std <= 110.0 and dynamic_range >= 60.0:
        score += 0.15
    else:
        score -= 0.15
        reasons.append("Distribucion de intensidades poco habitual para una radiografia.")

    # Un campo circular o sectorial con las cuatro esquinas negras es frecuente
    # en CT/US exportadas como imagen. Solo reduce el score: no basta para rechazar.
    patch_h = max(h // 8, 1)
    patch_w = max(w // 8, 1)
    corners = np.concatenate(
        [
            image[:patch_h, :patch_w].ravel(),
            image[:patch_h, -patch_w:].ravel(),
            image[-patch_h:, :patch_w].ravel(),
            image[-patch_h:, -patch_w:].ravel(),
        ]
    )
    center = image[h // 3 : 2 * h // 3, w // 3 : 2 * w // 3]
    if float(corners.mean()) + 55.0 < float(center.mean()):
        score -= 0.20
        reasons.append("Campo circular o sectorial posible; verificar que no sea CT o ecografia.")

    score = round(min(max(score, 0.0), 1.0), 3)
    status = "likely_cxr" if score >= 0.65 else "uncertain"
    if not reasons:
        reasons.append("Caracteristicas tecnicas compatibles con radiografia de torax.")
    return CXRScreeningResult(
        status=status,
        score=score,
        method="visual_heuristics_v1",
        reasons=tuple(reasons),
    )
