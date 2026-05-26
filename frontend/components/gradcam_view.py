import base64
import io

import streamlit as st
from PIL import Image


def _decode_data_uri(data_uri: str) -> bytes:
    if "," in data_uri:
        data_uri = data_uri.split(",", 1)[1]
    return base64.b64decode(data_uri)


def _blend_original_with_cam(original_bytes: bytes, gradcam_bytes: bytes, opacity: float) -> bytes:
    original = Image.open(io.BytesIO(original_bytes)).convert("RGB").resize((224, 224))
    gradcam = Image.open(io.BytesIO(gradcam_bytes)).convert("RGB").resize((224, 224))
    blended = Image.blend(original, gradcam, opacity)
    buf = io.BytesIO()
    blended.save(buf, format="PNG")
    return buf.getvalue()


def render_gradcam(response: dict, original_bytes: bytes) -> None:
    """Renders an adjustable Grad-CAM overlay."""
    if "error" in response or "gradcam_image" not in response:
        return

    st.markdown("#### Mapa de calor")
    st.caption(f"Regiones usadas por el modelo para la clase: **{response['gradcam_class']}**")

    opacity = st.slider(
        "Opacidad del mapa",
        0.0,
        1.0,
        0.65,
        0.05,
        help="Este control solo cambia la visualizacion; no vuelve a ejecutar el modelo.",
    )
    gradcam_bytes = _decode_data_uri(response["gradcam_image"])

    try:
        image_bytes = _blend_original_with_cam(original_bytes, gradcam_bytes, opacity)
        st.image(image_bytes, caption="Overlay ajustable", width="stretch")
    except Exception:
        st.image(gradcam_bytes, caption="Mapa de calor", width="stretch")
