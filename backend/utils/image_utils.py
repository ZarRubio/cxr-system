import io

import cv2
import numpy as np
import torch
from PIL import Image

# Limite explicito contra bombas de descompresion: PIL lanza DecompressionBombError
# antes de materializar imagenes absurdamente grandes en memoria.
Image.MAX_IMAGE_PIXELS = 8192 * 8192


def detect_format(file_bytes: bytes, filename: str) -> str:
    """Detects PNG, JPG, or DICOM by magic bytes, falling back to filename extension."""
    if file_bytes[:4] == b"\x89PNG":
        return "png"
    if file_bytes[:2] == b"\xff\xd8":
        return "jpg"
    if b"DICM" in file_bytes[:132]:
        return "dicom"
    if filename.lower().endswith(".dcm"):
        return "dicom"
    return "jpg"


def load_image_as_array(file_bytes: bytes, fmt: str) -> np.ndarray:
    """Converts image bytes to a (H, W) uint8 grayscale numpy array."""
    if fmt == "dicom":
        from services.dicom_service import extract_pixels_from_dicom
        return extract_pixels_from_dicom(file_bytes)
    img = Image.open(io.BytesIO(file_bytes)).convert("L")
    return np.array(img)


def validate_source_channels(file_bytes: bytes, fmt: str) -> None:
    """Reject non-DICOM images with unsupported channel layouts before inference."""
    if fmt == "dicom":
        return
    img = Image.open(io.BytesIO(file_bytes))
    bands = img.getbands()
    if len(bands) > 3:
        raise ValueError(f"La imagen tiene {len(bands)} canales; maximo permitido: 3.")


def preprocess_for_model(img_array: np.ndarray) -> torch.Tensor:
    """
    Applies TorchXRayVision normalization (NOT ImageNet stats).
    (H, W) uint8 → (1, 1, 224, 224) float32 tensor in [-1024, 1024].
    """
    img = img_array.astype(np.float32)
    img = (img / 255.0) * 2048.0 - 1024.0          # xrv range: [-1024, 1024]
    img = cv2.resize(img, (224, 224))
    return torch.from_numpy(img).unsqueeze(0).unsqueeze(0)  # (1, 1, 224, 224)
