import io

import numpy as np
import pydicom
from pydicom.errors import InvalidDicomError


def _first_value(value):
    if isinstance(value, pydicom.multival.MultiValue):
        return value[0]
    return value


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
