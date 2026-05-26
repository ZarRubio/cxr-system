import base64

import streamlit as st


def render_gradcam(response: dict, original_bytes: bytes) -> None:
    """Renders a toggle between the original image and the Grad-CAM overlay."""
    if "error" in response or "gradcam_image" not in response:
        return

    st.markdown("#### Mapa de calor Grad-CAM")
    st.caption(f"Regiones relevantes para la predicción: **{response['gradcam_class']}**")

    show_gradcam = st.toggle("Mostrar Grad-CAM", value=True)

    if show_gradcam:
        gradcam_data = response["gradcam_image"]
        # Strip data URI prefix if present
        if "," in gradcam_data:
            gradcam_data = gradcam_data.split(",", 1)[1]
        gradcam_bytes = base64.b64decode(gradcam_data)
        st.image(gradcam_bytes, caption="Grad-CAM overlay", use_container_width=True)
    else:
        st.image(original_bytes, caption="Imagen original", use_container_width=True)
