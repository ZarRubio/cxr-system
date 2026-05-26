import streamlit as st

from components.comparison import render_comparison
from components.gradcam_view import render_gradcam
from components.history import add_to_history, render_history
from components.results import render_results
from components.uploader import render_uploader
from utils.api_client import call_predict_api, get_model_info
from utils.report import build_prediction_pdf

st.set_page_config(
    page_title="CXR Classifier - HNAL",
    page_icon="CXR",
    layout="wide",
)


@st.cache_data(ttl=60)
def cached_model_info() -> dict:
    return get_model_info()


model_info = cached_model_info()
model_info_error = model_info.get("error")
model_info_available = not model_info_error

st.markdown(
    """
<style>
html, body, [class*="css"] {
    font-family: 'Inter', 'Segoe UI', sans-serif;
}
.stApp, [data-testid="stAppViewContainer"] {
    background: #0F172A;
    color: #E5E7EB;
}
[data-testid="stHeader"] {
    background: rgba(15, 23, 42, 0.92);
}
.block-container {
    color: #E5E7EB;
    padding-top: 2rem;
}
[data-testid="stSidebar"] {
    background-color: #111827;
    border-right: 1px solid #1F2937;
}
[data-testid="stSidebar"] * {
    color: #E8EAF6 !important;
}
.main-title {
    font-size: 30px;
    line-height: 1.15;
    font-weight: 800;
    color: #F8FAFC;
    margin-bottom: 4px;
}
.main-subtitle {
    font-size: 14px;
    color: #CBD5E1;
    margin-bottom: 20px;
}
.demo-note {
    border: 1px solid #334155;
    background: #111827;
    border-radius: 8px;
    padding: 12px 14px;
    color: #CBD5E1;
    font-size: 13px;
    margin-bottom: 16px;
}
.upload-panel {
    border: 1px dashed #60A5FA;
    background: #111827;
    border-radius: 8px;
    padding: 16px;
    color: #E5E7EB;
    margin-bottom: 12px;
}
.upload-panel span {
    color: #9CA3AF;
    font-size: 13px;
}
#MainMenu {visibility: hidden;}
footer {visibility: hidden;}
</style>
""",
    unsafe_allow_html=True,
)


with st.sidebar:
    st.markdown(
        """
        <div style="padding:8px 0 16px 0">
            <div style="font-size:22px;font-weight:800;color:#fff">CXR Classifier</div>
            <div style="font-size:12px;color:#9FA8DA;margin-top:4px">
                Sistema academico de apoyo diagnostico
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.divider()

    checkpoint = model_info.get("checkpoint", "sprint3_model.pt")
    cache_entries = model_info.get("cache_entries", 0)
    st.markdown("**Modelo**")
    st.caption("CNN-ViT (DenseNet121 + Vision Transformer)")
    st.caption(f"Checkpoint: `{checkpoint}`")
    if model_info_available:
        st.caption(f"Cache API: {cache_entries} entradas")
    else:
        st.caption("Backend metadata: no disponible")

    st.divider()
    st.markdown("**Clases detectables**")
    classes_info = {
        "No Finding": "Radiografia sin hallazgos relevantes",
        "Cardiomegaly": "Posible cardiomegalia",
        "Effusion": "Posible derrame pleural",
        "Infiltration": "Posible infiltrado / TB / neumonia",
    }
    for cls, desc in classes_info.items():
        st.caption(f"{cls}: {desc}")

    st.divider()
    st.markdown("**Rendimiento reportado**")
    st.metric("AUC Macro", f"{model_info.get('auc_macro', 0.865):.3f}")
    metrics = model_info.get("metrics", {})
    if metrics:
        st.metric("Cardiomegaly AUC", f"{metrics.get('Cardiomegaly', {}).get('auc', 0):.3f}")
        st.metric("Effusion AUC", f"{metrics.get('Effusion', {}).get('auc', 0):.3f}")

    st.divider()
    st.caption("Uso exclusivamente academico.")
    st.caption("No reemplaza el criterio del radiologo.")


tab1, tab2, tab3 = st.tabs(["Analisis", "Historial", "Comparacion"])

with tab1:
    st.markdown(
        '<p class="main-title">Analisis de radiografia de torax</p>'
        '<p class="main-subtitle">Hospital Nacional Arzobispo Loayza - HNAL 2026</p>',
        unsafe_allow_html=True,
    )
    st.markdown(
        """
        <div class="demo-note">
            Flujo recomendado para demo: cargar imagen, analizar, revisar probabilidades,
            ajustar opacidad del Grad-CAM y descargar el reporte PDF.
        </div>
        """,
        unsafe_allow_html=True,
    )

    if not model_info_available:
        st.info(
            "Metadatos del backend no disponibles. La demo puede continuar; "
            "verifica que el backend actualizado este corriendo en http://localhost:8000."
        )
    elif model_info.get("startup_error"):
        st.warning(f"Backend en modo degradado: {model_info['startup_error']}")

    file_bytes, filename = render_uploader()

    if file_bytes and filename:
        upload_key = f"{filename}:{len(file_bytes)}"
        if st.session_state.get("active_upload_key") != upload_key:
            st.session_state["active_upload_key"] = upload_key
            st.session_state.pop("last_prediction", None)
            st.session_state.pop("last_prediction_file_bytes", None)
            st.session_state.pop("last_prediction_filename", None)
            st.session_state.pop("last_analysis_key", None)

        st.markdown("---")
        with st.expander("Opciones avanzadas", expanded=False):
            gradcam_method = st.selectbox(
                "Mapa de calor",
                ["gradcam", "gradcam++", "scorecam"],
                index=0,
                help="Grad-CAM es rapido. Grad-CAM++ puede localizar mejor hallazgos pequenos. Score-CAM es mas lento.",
            )
            mc_passes = st.slider(
                "MC Dropout",
                1,
                20,
                1,
                help="Use 1 para demo rapida. Use 8-10 si desea estimar incertidumbre.",
            )

        analysis_key = f"{upload_key}:{gradcam_method}:{mc_passes}"
        previous_analysis_key = st.session_state.get("last_analysis_key")
        has_prediction = st.session_state.get("last_prediction") is not None
        should_analyze = st.button("Analizar radiografia", type="primary", width="stretch")

        if has_prediction and previous_analysis_key and previous_analysis_key != analysis_key:
            should_analyze = True
            st.info("Cambio detectado. Reprocesando automaticamente.")

        if should_analyze:
            response = None
            with st.status("Analizando radiografia...", expanded=True) as status:
                st.write("Validando archivo y formato...")
                st.write("Preprocesando imagen...")
                st.write("Ejecutando inferencia CNN-ViT...")
                response = call_predict_api(file_bytes, filename, gradcam_method, mc_passes)

                if "error" not in response:
                    st.write("Generando mapa de calor...")
                    status.update(
                        label=f"Analisis completado en {response['processing_time_ms']:.0f} ms",
                        state="complete",
                        expanded=False,
                    )
                    add_to_history(filename, response)
                else:
                    status.update(label="No se pudo completar el analisis", state="error")

            if response:
                st.session_state["last_prediction"] = response
                st.session_state["last_prediction_file_bytes"] = file_bytes
                st.session_state["last_prediction_filename"] = filename
                st.session_state["last_analysis_key"] = analysis_key

        response = st.session_state.get("last_prediction")
        stored_bytes = st.session_state.get("last_prediction_file_bytes")
        stored_filename = st.session_state.get("last_prediction_filename", filename)
        if response and stored_bytes:
            col_results, col_gradcam = st.columns([1, 1])
            with col_results:
                render_results(response, model_info)
                if "error" not in response:
                    try:
                        pdf_bytes = build_prediction_pdf(stored_filename, stored_bytes, response)
                        st.download_button(
                            "Descargar reporte PDF",
                            data=pdf_bytes,
                            file_name=f"{stored_filename.rsplit('.', 1)[0]}_reporte_cxr.pdf",
                            mime="application/pdf",
                            width="stretch",
                        )
                    except Exception as exc:
                        st.warning(str(exc))
            with col_gradcam:
                render_gradcam(response, stored_bytes)

with tab2:
    st.markdown("## Historial de analisis")
    render_history(model_info)

with tab3:
    st.markdown("## Comparacion de radiografias")
    render_comparison(model_info)

st.divider()
st.caption("Uso academico. Este sistema no reemplaza el criterio clinico del radiologo.")
