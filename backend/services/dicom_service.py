import io

import numpy as np
import pydicom


def extract_pixels_from_dicom(dicom_bytes: bytes) -> np.ndarray:
    """
    Extracts pixel data from a DICOM file.
    Never exposes patient metadata (name, ID, date, etc.).
    Returns (H, W) uint8 array normalized to [0, 255].
    """
    ds = pydicom.dcmread(io.BytesIO(dicom_bytes))
    pixels = ds.pixel_array.astype(np.float32)
    pmin, pmax = pixels.min(), pixels.max()
    pixels = (pixels - pmin) / (pmax - pmin + 1e-8) * 255.0
    return pixels.astype(np.uint8)
