import hashlib
import io
import re

import numpy as np
import pydicom
from pydicom.errors import InvalidDicomError


def _first_value(value):
    if isinstance(value, pydicom.multival.MultiValue):
        return value[0]
    return value


def _parse_age(raw: str | None) -> int | None:
    """PatientAge DICOM viene como '045Y', '030M', etc. Devuelve anos enteros."""
    if not raw:
        return None
    match = re.match(r"^(\d{1,3})([DWMY])?$", str(raw).strip().upper())
    if not match:
        return None
    value, unit = int(match.group(1)), match.group(2) or "Y"
    if unit == "Y":
        age = value
    elif unit == "M":
        age = value // 12
    else:  # dias o semanas -> menor de 1 ano
        age = 0
    return age if 0 <= age <= 130 else None


def extract_study_metadata(dicom_bytes: bytes) -> dict | None:
    """
    Extrae SOLO metadatos no identificantes del DICOM: edad, sexo, proyeccion
    y un pseudo-ID (hash del StudyInstanceUID). Nombre, ID de paciente, fechas
    y demas PHI nunca se leen — pseudonimizacion por diseno (Ley 29733).
    """
    try:
        ds = pydicom.dcmread(io.BytesIO(dicom_bytes), stop_before_pixels=True, force=False)
    except (InvalidDicomError, Exception):
        return None

    sex_raw = str(getattr(ds, "PatientSex", "") or "").strip().upper()
    sex = sex_raw if sex_raw in ("M", "F", "O") else None

    view_raw = str(getattr(ds, "ViewPosition", "") or "").strip().upper()
    view_position = view_raw if view_raw in ("PA", "AP", "LL", "RL", "LATERAL") else None

    study_uid = str(getattr(ds, "StudyInstanceUID", "") or "")
    study_hash = hashlib.sha256(study_uid.encode()).hexdigest()[:10].upper() if study_uid else None

    meta = {
        "patient_age": _parse_age(getattr(ds, "PatientAge", None)),
        "patient_sex": sex,
        "view_position": view_position,
        "study_hash": study_hash,
    }
    return meta if any(v is not None for v in meta.values()) else None


def extract_pixels_from_dicom(dicom_bytes: bytes) -> np.ndarray:
    """
    Extracts pixel data from a DICOM file.
    Never exposes patient metadata (name, ID, date, etc.).
    Returns (H, W) uint8 array normalized to [0, 255].
    """
    try:
        ds = pydicom.dcmread(io.BytesIO(dicom_bytes), force=False)
    except InvalidDicomError as exc:
        raise ValueError("Archivo DICOM invalido.") from exc

    try:
        pixels = ds.pixel_array.astype(np.float32)
    except Exception as exc:
        raise ValueError("El DICOM no contiene pixeles decodificables.") from exc

    slope = float(getattr(ds, "RescaleSlope", 1.0))
    intercept = float(getattr(ds, "RescaleIntercept", 0.0))
    pixels = pixels * slope + intercept

    center = _first_value(getattr(ds, "WindowCenter", None))
    width = _first_value(getattr(ds, "WindowWidth", None))
    if center is not None and width is not None:
        center = float(center)
        width = max(float(width), 1.0)
        low = center - width / 2.0
        high = center + width / 2.0
        pixels = np.clip(pixels, low, high)

    pmin, pmax = pixels.min(), pixels.max()
    pixels = (pixels - pmin) / (pmax - pmin + 1e-8) * 255.0

    if getattr(ds, "PhotometricInterpretation", "").upper() == "MONOCHROME1":
        pixels = 255.0 - pixels

    return pixels.astype(np.uint8)
