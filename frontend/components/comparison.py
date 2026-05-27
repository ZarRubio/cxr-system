import streamlit as st

from components.gradcam_view import _blend_original_with_cam, _decode_data_uri
from components.results import render_results
from utils.api_client import call_predict_api


def _show_gradcam_overlay(response: dict, original_bytes: bytes, opacity: float) -> None:
    """Muestra el overlay Grad-CAM con la opacidad indicada."""
    if "error" in response or "gradcam_image" not in response:
        return
    gradcam_bytes = _decode_data_uri(response["gradcam_image"])
    try:
        blended = _blend_original_with_cam(original_bytes, gradcam_bytes, opacity)
        st.image(
            blended,
            caption=f"Grad-CAM — {response.get('gradcam_class', '')}",
            width="stretch",
        )
    except Exception:
        st.image(gradcam_bytes, caption="Mapa de calor", width="stretch")


def render_comparison(model_info: dict | None = None, show_technical: bool = False) -> None:
    """Muestra dos radiografias en paralelo con inferencia y Grad-CAM."""
    st.caption(
        "Carga dos imagenes para comparar hallazgos lado a lado con el mismo modelo."
    )

    col1, col2 = st.columns(2)
    with col1:
        st.markdown("#### Imagen A")
        file_a = st.file_uploader(
            "Cargar imagen A", type=["png", "jpg", "jpeg", "dcm"], key="cmp_a"
        )
    with col2:
        st.markdown("#### Imagen B")
        file_b = st.file_uploader(
            "Cargar imagen B", type=["png", "jpg", "jpeg", "dcm"], key="cmp_b"
        )

    if not (file_a and file_b):
        st.info("Carga ambas imagenes para habilitar la comparacion.")
        return

    # Detectar cambio de archivos y limpiar resultados guardados
    cmp_key = f"{file_a.name}:{file_a.size}:{file_b.name}:{file_b.size}"
    if st.session_state.get("cmp_key") != cmp_key:
        st.session_state.pop("cmp_results", None)

    if st.button("Comparar ambas", type="primary", width="stretch"):
        bytes_a = file_a.read()
        bytes_b = file_b.read()
        with st.spinner("Analizando imagen A..."):
            resp_a = call_predict_api(bytes_a, file_a.name)
        with st.spinner("Analizando imagen B..."):
            resp_b = call_predict_api(bytes_b, file_b.name)
        st.session_state["cmp_key"] = cmp_key
        st.session_state["cmp_results"] = {
            "resp_a": resp_a,
            "resp_b": resp_b,
            "bytes_a": bytes_a,
            "bytes_b": bytes_b,
        }

    cmp = st.session_state.get("cmp_results")
    if not cmp:
        return

    # ── Slider de opacidad compartido ────────────────────────────────────────
    st.markdown("---")
    opacity = st.slider(
        "Opacidad del mapa de calor",
        0.0,
        1.0,
        0.65,
        0.05,
        key="cmp_opacity",
        help="Ajusta la intensidad del Grad-CAM en ambas imagenes simultaneamente.",
    )

    # ── Resultados lado a lado ────────────────────────────────────────────────
    col1, col2 = st.columns(2)

    with col1:
        st.markdown(f"#### A — `{file_a.name}`")
        resp_a = cmp["resp_a"]
        bytes_a = cmp["bytes_a"]

        if "error" not in resp_a:
            _show_gradcam_overlay(resp_a, bytes_a, opacity)
        elif not file_a.name.lower().endswith(".dcm"):
            st.image(bytes_a, width="stretch")

        render_results(resp_a, model_info, show_technical=show_technical)

    with col2:
        st.markdown(f"#### B — `{file_b.name}`")
        resp_b = cmp["resp_b"]
        bytes_b = cmp["bytes_b"]

        if "error" not in resp_b:
            _show_gradcam_overlay(resp_b, bytes_b, opacity)
        elif not file_b.name.lower().endswith(".dcm"):
            st.image(bytes_b, width="stretch")

        render_results(resp_b, model_info, show_technical=show_technical)
