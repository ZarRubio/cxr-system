import streamlit as st

from components.comparison import render_comparison
from components.demo_loader import render_demo_loader
from components.gradcam_view import render_gradcam
from components.history import add_to_history, render_history
from components.metrics import render_metrics
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
    background: #F4F7FB;
    color: #111827;
}
[data-testid="stHeader"] {
    background: rgba(244, 247, 251, 0.92);
}
.block-container {
    color: #111827;
    padding-top: 2rem;
    max-width: 1280px;
}
.block-container [data-testid="stMarkdownContainer"],
.block-container [data-testid="stMarkdownContainer"] p,
.block-container [data-testid="stMarkdownContainer"] li,
.block-container [data-testid="stMarkdownContainer"] span {
    color: inherit;
}
.block-container h1,
.block-container h2,
.block-container h3,
.block-container h4,
.block-container h5,
.block-container h6 {
    color: #0F172A;
}
[data-testid="stSidebar"] {
    background-color: #111827;
    border-right: 1px solid #1F2937;
}
[data-testid="stSidebar"] * {
    color: #E8EAF6 !important;
}
[data-testid="stSidebar"] code {
    background: #263244 !important;
    color: #F8FAFC !important;
    border: 1px solid #334155;
}
[data-testid="stSidebar"] [data-testid="stMetric"] {
    background: #172033;
    border: 1px solid #2B364A;
    border-radius: 8px;
    padding: 10px 12px;
}
[data-testid="stSidebar"] [data-testid="stMetric"] label,
[data-testid="stSidebar"] [data-testid="stMetric"] [data-testid="stMetricLabel"] {
    color: #CBD5E1 !important;
}
[data-testid="stSidebar"] [data-testid="stMetric"] [data-testid="stMetricValue"] {
    color: #FFFFFF !important;
}
.main-title {
    font-size: 30px;
    line-height: 1.15;
    font-weight: 800;
    color: #0F172A;
    margin-bottom: 4px;
}
.main-subtitle {
    font-size: 14px;
    color: #475569;
    margin-bottom: 20px;
}
.demo-note {
    border: 1px solid #D8E0EA;
    background: #FFFFFF;
    border-radius: 8px;
    padding: 12px 14px;
    color: #334155;
    font-size: 13px;
    margin-bottom: 16px;
}
.demo-mode-banner {
    background: #ECFDF5;
    border: 1px solid #A7F3D0;
    border-left: 4px solid #059669;
    border-radius: 8px;
    color: #064E3B;
    font-size: 13px;
    line-height: 1.55;
    margin-bottom: 16px;
    padding: 12px 14px;
}
.demo-mode-banner b {
    color: #064E3B;
}
.upload-panel {
    border: 1px dashed #60A5FA;
    background: #FFFFFF;
    border-radius: 8px;
    padding: 16px;
    color: #111827;
    margin-bottom: 12px;
}
.upload-panel span {
    color: #64748B;
    font-size: 13px;
}

[data-testid="stTabs"] button {
    font-weight: 700;
}
[data-testid="stTabs"] button p {
    color: #334155 !important;
}
[data-testid="stTabs"] button[aria-selected="true"] p {
    color: #DC2626 !important;
}

[data-testid="stFileUploader"] section {
    border-radius: 8px;
    border: 1px solid #D8E0EA;
    background: #FFFFFF;
}
[data-testid="stFileUploader"] section *,
[data-testid="stFileUploader"] small {
    color: #334155 !important;
}
[data-testid="stFileUploader"] button {
    background: #111827 !important;
    border: 1px solid #111827 !important;
    color: #FFFFFF !important;
}
[data-testid="stFileUploader"] button *,
[data-testid="stFileUploader"] button p,
[data-testid="stFileUploader"] button span,
[data-testid="stFileUploader"] button svg {
    color: #FFFFFF !important;
    fill: #FFFFFF !important;
    stroke: #FFFFFF !important;
}

.block-container [data-testid="stMetric"] {
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    padding: 10px 12px;
}
.block-container [data-testid="stMetric"] label,
.block-container [data-testid="stMetric"] [data-testid="stMetricLabel"],
.block-container [data-testid="stMetric"] [data-testid="stMetricValue"] {
    color: #0F172A !important;
}

[data-testid="stAlert"] {
    border-radius: 8px;
}

[data-testid="stExpander"] {
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
}
[data-testid="stExpander"] summary,
[data-testid="stExpander"] summary * {
    color: #0F172A !important;
}
.block-container label,
.block-container [data-testid="stWidgetLabel"],
.block-container [data-testid="stCaptionContainer"],
.block-container [data-testid="stSlider"] label {
    color: #334155 !important;
}
.block-container div[data-baseweb="select"] > div,
.block-container div[data-baseweb="select"] span {
    background: #FFFFFF !important;
    color: #111827 !important;
}
.demo-loader-label {
    color: #475569;
    font-size: 13px;
    font-weight: 700;
    margin: 10px 0 6px 0;
}

button[kind="primary"] {
    border-radius: 8px !important;
}

@media (max-width: 900px) {
    .block-container {
        padding: 1rem 0.85rem 2rem 0.85rem;
    }
    .main-title {
        font-size: 24px;
    }
    .main-subtitle,
    .demo-note,
    .upload-panel {
        font-size: 12px;
    }
    [data-testid="stHorizontalBlock"] {
        gap: 0.75rem;
    }
}

@media (max-width: 640px) {
    [data-testid="stSidebar"] {
        display: none;
    }
    .main-title {
        font-size: 22px;
    }
    [data-testid="stTabs"] button {
        font-size: 12px;
        padding-left: 8px;
        padding-right: 8px;
    }
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
    demo_mode = st.checkbox(
        "Modo demo",
        value=True,
        help="Usa imagenes sinteticas precargadas para presentar el flujo sin archivos reales.",
    )
    technical_mode = st.checkbox(
        "Modo tecnico",
        value=False,
        help="Muestra controles avanzados, comparacion, metricas y detalles de trazabilidad.",
    )
    st.divider()

    model_type = model_info.get("type", "ensemble")
    cache_entries = model_info.get("cache_entries", 0)
    st.markdown("**Modelo**")
    st.caption("Ensemble CNN-ViT v1 (4 capas) + v2 (6 capas)")
    st.caption("Backbone: DenseNet121 pre-entrenado NIH")
    st.caption(f"Pesos ensemble: 0.3 × v1 + 0.7 × v2")
    if model_info_available:
        st.caption(f"Cache API: {cache_entries} entradas")
    else:
        st.caption("Backend metadata: no disponible")
    st.caption(f"Flujo activo: `{'demo sintetica' if demo_mode else 'carga manual'}`")

    st.divider()
    st.markdown("**14 clases detectables**")
    classes_info = {
        "Atelectasis": "Colapso pulmonar parcial/total",
        "Cardiomegaly": "Posible cardiomegalia",
        "Consolidation": "Ocupacion alveolar",
        "Edema": "Edema pulmonar",
        "Effusion": "Posible derrame pleural",
        "Emphysema": "Hiperinsuflacion alveolar",
        "Fibrosis": "Patron fibrotico pulmonar",
        "Hernia": "Hernia diafragmatica",
        "Infiltration": "Infiltrado / TB / neumonia",
        "Mass": "Lesion > 3 cm",
        "Nodule": "Lesion focal < 3 cm",
        "Pleural_Thickening": "Engrosamiento pleural",
        "Pneumonia": "Consolidacion neumofica",
        "Pneumothorax": "Posible neumotorax",
    }
    for cls, desc in classes_info.items():
        st.caption(f"· {cls}: {desc}")

    if technical_mode:
        st.divider()
        st.markdown("**Rendimiento reportado**")
        st.metric("AUC Macro (test)", f"{model_info.get('auc_macro', 0.8045):.4f}")
        st.metric("AUC Macro (val)", f"{model_info.get('val_auc_macro', 0.7950):.4f}")
        metrics = model_info.get("metrics", {})
        if metrics:
            for cls in ["Effusion", "Emphysema", "Cardiomegaly", "Hernia"]:
                auc = metrics.get(cls, {}).get("auc", 0)
                if auc:
                    st.metric(f"{cls} AUC", f"{auc:.3f}")

    st.divider()
    total = st.session_state.get("total_analyses", 0)
    st.metric("Analisis (sesion)", total, help="Numero de analisis completados en esta sesion")
    st.divider()
    st.caption("Uso exclusivamente academico.")
    st.caption("No reemplaza el criterio del radiologo.")


if technical_mode:
    tab1, tab2, tab3, tab4 = st.tabs(["Analisis", "Historial", "Comparacion", "Metricas"])
else:
    tab1, tab2 = st.tabs(["Analisis", "Historial"])

with tab1:
    st.markdown(
        '<p class="main-title">Analisis de radiografia de torax</p>'
        '<p class="main-subtitle">Hospital Nacional Arzobispo Loayza - HNAL 2026</p>',
        unsafe_allow_html=True,
    )
    st.markdown(
        """
        <div class="demo-note">
            Flujo recomendado: cargar imagen, analizar, revisar el resultado principal,
            validar el mapa de calor y descargar el reporte PDF.
        </div>
        """,
        unsafe_allow_html=True,
    )

    if not model_info_available:
        from utils.api_client import BACKEND_URL
        st.info(
            f"Metadatos del backend no disponibles (BACKEND_URL={BACKEND_URL}). "
            "La demo puede continuar; verifica que el backend este corriendo y accesible."
        )
    elif model_info.get("startup_error"):
        st.warning(f"Backend en modo degradado: {model_info['startup_error']}")

    if demo_mode:
        st.markdown(
            """
            <div class="demo-mode-banner">
                <b>Modo demo activo.</b> Selecciona un caso sintetico para mostrar el flujo completo:
                inferencia, probabilidades, mapa de calor y reporte PDF. Las imagenes no son diagnosticas.
            </div>
            """,
            unsafe_allow_html=True,
        )
        file_bytes, filename = render_demo_loader()
    else:
        st.session_state.pop("demo_selection", None)
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
        gradcam_method = "gradcam"
        mc_passes = 1
        if technical_mode:
            with st.expander("Opciones avanzadas", expanded=False):
                gradcam_method = st.selectbox(
                    "Método de mapa de calor",
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
                response = call_predict_api(file_bytes, filename, gradcam_method, mc_passes, False)

                if "error" not in response:
                    status.update(
                        label=f"Analisis completado en {response['processing_time_ms']:.0f} ms",
                        state="complete",
                        expanded=False,
                    )
                    add_to_history(filename, response)
                    st.session_state["total_analyses"] = (
                        st.session_state.get("total_analyses", 0) + 1
                    )
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
                render_results(response, model_info, show_technical=technical_mode)
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
    render_history(model_info, show_technical=technical_mode)

if technical_mode:
    with tab3:
        st.markdown("## Comparacion de radiografias")
        render_comparison(model_info, show_technical=technical_mode)

    with tab4:
        st.markdown("## Rendimiento del modelo")
        render_metrics(model_info)

st.divider()
st.caption("Uso academico. Este sistema no reemplaza el criterio clinico del radiologo.")
