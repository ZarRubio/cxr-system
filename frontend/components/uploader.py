import io

import numpy as np
import streamlit as st
from PIL import Image

MAX_FILE_BYTES = 15 * 1024 * 1024
MIN_FILE_BYTES = 1 * 1024


def _dicom_preview(file_bytes: bytes) -> np.ndarray | None:
    try:
        import pydicom

        ds = pydicom.dcmread(io.BytesIO(file_bytes), force=False)
        pixels = ds.pixel_array.astype(np.float32)
        pmin, pmax = pixels.min(), pixels.max()
        pixels = (pixels - pmin) / (pmax - pmin + 1e-8) * 255.0
        if getattr(ds, "PhotometricInterpretation", "").upper() == "MONOCHROME1":
            pixels = 255.0 - pixels
        return pixels.astype(np.uint8)
    except Exception:
        return None


def _image_preview(file_bytes: bytes) -> Image.Image | None:
    try:
        return Image.open(io.BytesIO(file_bytes)).convert("L")
    except Exception:
        return None


def render_uploader() -> tuple[bytes | None, str | None]:
    """Renders the file uploader widget. Returns (file_bytes, filename) or (None, None)."""
    st.markdown(
        """
        <div class="upload-panel">
            <b>Carga una radiografia de torax</b><br>
            <span>Formatos admitidos: PNG, JPG, JPEG o DICOM. Tamano maximo: 15 MB.</span>
        </div>
        """,
        unsafe_allow_html=True,
    )
    uploaded = st.file_uploader(
        "Cargar radiografia de torax",
        type=["png", "jpg", "jpeg", "dcm"],
        help="Formatos soportados: PNG, JPG o DICOM (.dcm)",
        label_visibility="collapsed",
    )

    if uploaded is None:
        return None, None

    file_bytes = uploaded.read()
    size = len(file_bytes)

    if size < MIN_FILE_BYTES:
        st.error("El archivo es demasiado pequeno para ser una imagen valida.")
        return None, None
    if size > MAX_FILE_BYTES:
        st.error("La imagen supera el limite de 15 MB.")
        return None, None

    col1, col2 = st.columns([1, 2])
    with col1:
        if uploaded.name.lower().endswith(".dcm"):
            preview = _dicom_preview(file_bytes)
            if preview is not None:
                st.image(preview, caption="Previsualizacion DICOM", width=250, clamp=True)
            else:
                st.warning("DICOM cargado, pero no se pudo renderizar el pixel array.")
        else:
            preview = _image_preview(file_bytes)
            if preview is not None:
                st.image(preview, caption="Imagen cargada", width=250)
            else:
                st.error("No se pudo previsualizar la imagen.")
                return None, None
    with col2:
        st.metric("Formato", uploaded.type or uploaded.name.split(".")[-1].upper())
        st.metric("Tamano", f"{size / 1024:.1f} KB")

    return file_bytes, uploaded.name
