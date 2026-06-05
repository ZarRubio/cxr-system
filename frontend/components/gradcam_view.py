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
    """Renders an adjustable Grad-CAM overlay, or a load button if not yet computed."""
    if "error" in response:
        return

    st.markdown("#### Mapa de calor")
    st.caption(f"Regiones usadas por el modelo para la clase: **{response.get('gradcam_class', '')}**")

    gradcam_uri = response.get("gradcam_image", "")

    if not gradcam_uri:
        from utils.api_client import call_predict_api
        st.caption("El análisis rápido no incluye el mapa de calor.")
        if st.button("Generar mapa de calor Grad-CAM", type="primary", use_container_width=True):
            with st.spinner("Generando mapa de calor... (~1-2 min en CPU)"):
                updated = call_predict_api(
                    original_bytes,
                    response.get("gradcam_class", "imagen") + ".png",
                    gradcam_method="gradcam",
                    mc_passes=1,
                    include_gradcam=True,
                )
                if "error" not in updated and updated.get("gradcam_image"):
                    response["gradcam_image"] = updated["gradcam_image"]
                    st.rerun()
                else:
                    st.error("No se pudo generar el mapa de calor.")
        return

    opacity = st.slider(
        "Opacidad del mapa",
        0.0,
        1.0,
        0.65,
        0.05,
        help="Este control solo cambia la visualizacion; no vuelve a ejecutar el modelo.",
    )
    gradcam_bytes = _decode_data_uri(gradcam_uri)

    try:
        image_bytes = _blend_original_with_cam(original_bytes, gradcam_bytes, opacity)
        st.image(image_bytes, caption="Overlay ajustable", width="stretch")
    except Exception:
        st.image(gradcam_bytes, caption="Mapa de calor", width="stretch")
